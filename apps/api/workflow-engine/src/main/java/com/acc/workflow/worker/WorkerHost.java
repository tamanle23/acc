package com.acc.workflow.worker;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.ports.WorkerTransportPort;

import java.io.Closeable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Function;

/**
 * High-Ergonomics Worker Host managing concurrency via Semaphore & Virtual Threads,
 * executing registered handlers through a composable middleware chain.
 */
public final class WorkerHost implements Closeable {

    private final WorkerTransportPort transport;
    private final String workerId;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private final List<WorkerMiddleware> middlewares = new ArrayList<>();
    private final Map<String, RegisteredWorker> workers = new ConcurrentHashMap<>();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final ExecutorService virtualExecutor;
    private final List<Thread> pollerThreads = new ArrayList<>();

    private final Map<String, TaskWorkerDescriptor> descriptors = new ConcurrentHashMap<>();

    private record RegisteredWorker(
        WorkerConfig config,
        TaskHandler handler,
        Semaphore semaphore
    ) {}

    public WorkerHost(WorkerTransportPort transport, String workerId) {
        this.transport = transport;
        this.workerId = workerId;
        ExecutorService exec;
        try {
            // Check for Java 21+ newVirtualThreadPerTaskExecutor dynamically
            var method = Executors.class.getMethod("newVirtualThreadPerTaskExecutor");
            exec = (ExecutorService) method.invoke(null);
        } catch (Exception e) {
            exec = Executors.newCachedThreadPool(r -> {
                Thread t = new Thread(r, "worker-task-exec");
                t.setDaemon(true);
                return t;
            });
        }
        this.virtualExecutor = exec;
    }

    public String workerId() {
        return workerId;
    }

    public List<TaskWorkerDescriptor> getRegisteredDescriptors() {
        return List.copyOf(descriptors.values());
    }

    public WorkerHost use(WorkerMiddleware middleware) {
        this.middlewares.add(middleware);
        return this;
    }

    public WorkerHost register(WorkerConfig config, TaskHandler handler) {
        Semaphore sem = new Semaphore(config.maxConcurrency());
        String key = config.domain() + ":" + config.taskType();
        workers.put(key, new RegisteredWorker(config, handler, sem));
        descriptors.putIfAbsent(config.taskType(), new TaskWorkerDescriptor(
            config.taskType(), config.domain(), "Registered worker handler for " + config.taskType(),
            config.maxConcurrency(), 30L, Collections.emptyMap(), Collections.emptyMap()
        ));
        return this;
    }

    public WorkerHost registerTask(TaskWorkerDescriptor descriptor, WorkerConfig config, TaskHandler handler) {
        descriptors.put(descriptor.taskName(), descriptor);
        Semaphore sem = new Semaphore(config.maxConcurrency());
        String key = config.domain() + ":" + config.taskType();
        workers.put(key, new RegisteredWorker(config, handler, sem));
        return this;
    }

    public WorkerHost registerSimple(String taskType, Function<TaskContext, Map<String, Object>> fn) {
        return register(WorkerConfig.defaults(taskType), ctx -> TaskOutcome.completed(fn.apply(ctx)));
    }

    public WorkerHost registerSimple(String taskType, String domain, Function<TaskContext, Map<String, Object>> fn) {
        WorkerConfig cfg = new WorkerConfig(taskType, "system", domain, 10, 50L, 2000L, 5, 10000L);
        return register(cfg, ctx -> TaskOutcome.completed(fn.apply(ctx)));
    }

    public synchronized void start() {
        if (running.compareAndSet(false, true)) {
            for (RegisteredWorker rw : workers.values()) {
                Thread poller = new Thread(() -> pollLoop(rw), "worker-poller-" + rw.config.domain() + "-" + rw.config.taskType());
                poller.setDaemon(true);
                poller.start();
                pollerThreads.add(poller);
            }
        }
    }

    private void pollLoop(RegisteredWorker rw) {
        WorkerConfig cfg = rw.config();
        long currentDelayMs = cfg.basePollIntervalMs();

        while (running.get()) {
            try {
                int permits = rw.semaphore().availablePermits();
                if (permits > 0) {
                    int toPoll = Math.min(permits, cfg.pollBatchSize());
                    List<TaskSnapshot> tasks = transport.pollBatch(cfg.tenantId(), cfg.taskType(), cfg.domain(), toPoll, workerId);

                    if (!tasks.isEmpty()) {
                        currentDelayMs = 0L; // Burst draining
                        for (TaskSnapshot task : tasks) {
                            if (rw.semaphore().tryAcquire()) {
                                virtualExecutor.submit(() -> executeTask(task, rw));
                            }
                        }
                    } else {
                        // Exponential backoff
                        currentDelayMs = currentDelayMs == 0 ? cfg.basePollIntervalMs() : Math.min(currentDelayMs * 2, cfg.maxPollIntervalMs());
                    }
                } else {
                    currentDelayMs = cfg.basePollIntervalMs();
                }

                if (currentDelayMs > 0) {
                    Thread.sleep(currentDelayMs);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception ignored) {}
        }
    }

    private void executeTask(TaskSnapshot task, RegisteredWorker rw) {
        List<String> logs = new ArrayList<>();
        TaskContext context = new TaskContext() {
            @Override public String taskId() { return task.taskId(); }
            @Override public String workflowId() { return task.workflowId(); }
            @Override public String tenantId() { return rw.config().tenantId(); }
            @Override public String workspaceId() { return "default"; }
            @Override public String taskType() { return task.taskType().name(); }
            @Override public String referenceName() { return task.taskReferenceName(); }
            @Override public String domain() { return task.domain(); }
            @Override public int attempt() { return task.attempt(); }
            @Override public Map<String, Object> input() { return task.inputData(); }
            @Override
            public <T> T bindInput(Class<T> type) {
                return objectMapper.convertValue(task.inputData(), type);
            }
            @Override
            public void log(String message) {
                logs.add(System.currentTimeMillis() + ": " + message);
            }
            @Override public List<String> logs() { return Collections.unmodifiableList(logs); }
            @Override
            public void heartbeat() {
                transport.heartbeat(task.taskId(), workerId);
            }
        };

        try {
            TaskOutcome outcome = runMiddlewareChain(0, context, rw.handler());

            if (outcome instanceof TaskOutcome.Completed c) {
                transport.reportTaskResult(task.taskId(), workerId, true, c.output(), null, 0);
            } else if (outcome instanceof TaskOutcome.InProgress ip) {
                transport.reportTaskResult(task.taskId(), workerId, false, ip.partialOutput(), null, ip.callbackAfterSeconds());
            } else if (outcome instanceof TaskOutcome.Failed f) {
                transport.reportTaskResult(task.taskId(), workerId, false, f.output(), f.errorMessage(), 0);
            }
        } catch (Exception e) {
            transport.reportTaskResult(task.taskId(), workerId, false, Collections.emptyMap(), e.getMessage(), 0);
        } finally {
            rw.semaphore().release();
        }
    }

    private TaskOutcome runMiddlewareChain(int index, TaskContext context, TaskHandler handler) throws Exception {
        if (index < middlewares.size()) {
            WorkerMiddleware mw = middlewares.get(index);
            return mw.invoke(context, ctx -> runMiddlewareChain(index + 1, ctx, handler));
        }
        return handler.execute(context);
    }

    @Override
    public synchronized void close() {
        running.set(false);
        for (Thread t : pollerThreads) {
            t.interrupt();
        }
        virtualExecutor.shutdown();
        try {
            virtualExecutor.awaitTermination(3, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
