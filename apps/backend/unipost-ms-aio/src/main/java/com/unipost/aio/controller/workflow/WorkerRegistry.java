package com.unipost.aio.controller.workflow;

import com.unipost.workflow.worker.TaskWorkerDescriptor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WorkerRegistry {

    public record WorkerRegistration(
        String workerId,
        String hostIp,
        String runtime, // JAVA_VIRTUAL_THREADS, NODEJS_WORKER
        List<String> pollDomains,
        int concurrencyLimit,
        int activeLeases,
        long tasksCompletedCount,
        long errorCount,
        long uptimeSeconds,
        long lastHeartbeatEpochMs,
        String status, // HEALTHY, DEGRADED, OFFLINE, DRAINING
        List<TaskWorkerDescriptor> capabilities
    ) {
        public WorkerRegistration(
            String workerId,
            String hostIp,
            String runtime,
            List<String> pollDomains,
            int concurrencyLimit,
            int activeLeases,
            long tasksCompletedCount,
            long errorCount,
            long uptimeSeconds,
            long lastHeartbeatEpochMs,
            String status
        ) {
            this(
                workerId, hostIp, runtime, pollDomains, concurrencyLimit, activeLeases,
                tasksCompletedCount, errorCount, uptimeSeconds, lastHeartbeatEpochMs, status, List.of()
            );
        }
    }

    public record WorkerFleetSummary(
        int totalWorkers,
        int activeLeases,
        long totalCompletedTasks,
        int healthyCount,
        int degradedCount,
        int offlineCount,
        int drainingCount,
        double tasksPerSecond
    ) {}

    public record WorkerFleetResponse(
        WorkerFleetSummary summary,
        List<WorkerRegistration> workers
    ) {}

    private final Map<String, WorkerRegistration> workers = new ConcurrentHashMap<>();
    private final Map<String, TaskWorkerDescriptor> taskCatalog = new ConcurrentHashMap<>();

    public WorkerRegistry() {
        // Seed default JVM worker for initial out-of-the-box telemetry
        long now = System.currentTimeMillis();
        registerOrHeartbeat(
            "jvm-virtual-thread-worker-01",
            "127.0.0.1",
            "JAVA_VIRTUAL_THREADS",
            List.of("default", "orders", "billing", "cms"),
            128,
            0,
            0L,
            0L,
            1L,
            now
        );
    }

    public WorkerRegistration registerOrHeartbeat(
        String workerId,
        String hostIp,
        String runtime,
        List<String> pollDomains,
        int concurrencyLimit,
        int activeLeases,
        long tasksCompletedCount,
        long errorCount,
        long uptimeSeconds,
        long now
    ) {
        return registerWorkerWithCapabilities(
            workerId, hostIp, runtime, pollDomains, concurrencyLimit, activeLeases,
            tasksCompletedCount, errorCount, uptimeSeconds, now, null
        );
    }

    public WorkerRegistration registerWorkerWithCapabilities(
        String workerId,
        String hostIp,
        String runtime,
        List<String> pollDomains,
        int concurrencyLimit,
        int activeLeases,
        long tasksCompletedCount,
        long errorCount,
        long uptimeSeconds,
        long now,
        List<TaskWorkerDescriptor> capabilities
    ) {
        if (capabilities != null) {
            for (TaskWorkerDescriptor descriptor : capabilities) {
                if (descriptor != null && descriptor.taskName() != null) {
                    String key = (descriptor.domain() != null ? descriptor.domain() : "default") + ":" + descriptor.taskName();
                    taskCatalog.put(key, descriptor);
                }
            }
        }

        return workers.compute(workerId, (id, existing) -> {
            String status = "HEALTHY";
            if (existing != null && "DRAINING".equalsIgnoreCase(existing.status())) {
                status = "DRAINING";
            }
            List<TaskWorkerDescriptor> resolvedCaps = capabilities != null
                ? List.copyOf(capabilities)
                : (existing != null && existing.capabilities() != null ? existing.capabilities() : List.of());

            return new WorkerRegistration(
                workerId,
                hostIp != null ? hostIp : (existing != null ? existing.hostIp() : "127.0.0.1"),
                runtime != null ? runtime : (existing != null ? existing.runtime() : "JAVA_VIRTUAL_THREADS"),
                pollDomains != null ? pollDomains : (existing != null ? existing.pollDomains() : List.of("default")),
                concurrencyLimit > 0 ? concurrencyLimit : (existing != null ? existing.concurrencyLimit() : 64),
                activeLeases >= 0 ? activeLeases : (existing != null ? existing.activeLeases() : 0),
                tasksCompletedCount >= 0 ? tasksCompletedCount : (existing != null ? existing.tasksCompletedCount() : 0L),
                errorCount >= 0 ? errorCount : (existing != null ? existing.errorCount() : 0L),
                uptimeSeconds >= 0 ? uptimeSeconds : (existing != null ? existing.uptimeSeconds() : 1L),
                now,
                status,
                resolvedCaps
            );
        });
    }

    public void registerTaskDescriptor(TaskWorkerDescriptor descriptor) {
        if (descriptor != null && descriptor.taskName() != null) {
            String key = (descriptor.domain() != null ? descriptor.domain() : "default") + ":" + descriptor.taskName();
            taskCatalog.put(key, descriptor);
        }
    }

    public List<TaskWorkerDescriptor> getTaskCatalog() {
        return new ArrayList<>(taskCatalog.values());
    }

    public boolean drainWorker(String workerId) {
        WorkerRegistration existing = workers.get(workerId);
        if (existing == null) {
            return false;
        }
        workers.put(workerId, new WorkerRegistration(
            existing.workerId(),
            existing.hostIp(),
            existing.runtime(),
            existing.pollDomains(),
            existing.concurrencyLimit(),
            existing.activeLeases(),
            existing.tasksCompletedCount(),
            existing.errorCount(),
            existing.uptimeSeconds(),
            existing.lastHeartbeatEpochMs(),
            "DRAINING",
            existing.capabilities()
        ));
        return true;
    }

    public WorkerFleetResponse getFleet(long now) {
        List<WorkerRegistration> resolvedWorkers = new ArrayList<>();
        int healthy = 0;
        int degraded = 0;
        int offline = 0;
        int draining = 0;
        int totalLeases = 0;
        long totalCompleted = 0;

        for (WorkerRegistration w : workers.values()) {
            long age = Math.max(0, now - w.lastHeartbeatEpochMs());
            String computedStatus = w.status();

            if (!"DRAINING".equalsIgnoreCase(computedStatus)) {
                if (age > 30000) {
                    computedStatus = "OFFLINE";
                } else if (age > 15000) {
                    computedStatus = "DEGRADED";
                } else {
                    computedStatus = "HEALTHY";
                }
            }

            WorkerRegistration updated = new WorkerRegistration(
                w.workerId(),
                w.hostIp(),
                w.runtime(),
                w.pollDomains(),
                w.concurrencyLimit(),
                w.activeLeases(),
                w.tasksCompletedCount(),
                w.errorCount(),
                w.uptimeSeconds(),
                w.lastHeartbeatEpochMs(),
                computedStatus,
                w.capabilities()
            );
            resolvedWorkers.add(updated);

            if ("HEALTHY".equalsIgnoreCase(computedStatus)) healthy++;
            else if ("DEGRADED".equalsIgnoreCase(computedStatus)) degraded++;
            else if ("OFFLINE".equalsIgnoreCase(computedStatus)) offline++;
            else if ("DRAINING".equalsIgnoreCase(computedStatus)) draining++;

            totalLeases += updated.activeLeases();
            totalCompleted += updated.tasksCompletedCount();
        }

        WorkerFleetSummary summary = new WorkerFleetSummary(
            resolvedWorkers.size(),
            totalLeases,
            totalCompleted,
            healthy,
            degraded,
            offline,
            draining,
            totalLeases * 1.5
        );

        return new WorkerFleetResponse(summary, resolvedWorkers);
    }

    public void clear() {
        workers.clear();
        taskCatalog.clear();
    }
}
