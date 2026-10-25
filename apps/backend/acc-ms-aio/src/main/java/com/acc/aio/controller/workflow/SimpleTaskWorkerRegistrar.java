package com.acc.aio.controller.workflow;

import com.acc.aio.config.WorkflowEngineConfiguration.WorkflowDefinitionRegistry;
import com.acc.workflow.adapters.transport.InProcessTransportAdapter;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.ports.PersistencePort;
import com.acc.workflow.worker.TaskOutcome;
import com.acc.workflow.worker.TaskWorkerDescriptor;
import com.acc.workflow.worker.WorkerConfig;
import com.acc.workflow.worker.WorkerHost;
import com.acc.workflow.worker.WorkflowTaskWorker;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Component
public class SimpleTaskWorkerRegistrar {

    private static final Logger log = LoggerFactory.getLogger(SimpleTaskWorkerRegistrar.class);

    private final WorkerRegistry workerRegistry;
    private final PersistencePort persistencePort;
    private final WorkflowEngineService engineService;
    private final WorkflowDefinitionRegistry definitionRegistry;
    private final ExecutionStreamBroadcaster broadcaster;
    private WorkerHost workerHost;

    public SimpleTaskWorkerRegistrar(
        WorkerRegistry workerRegistry,
        PersistencePort persistencePort,
        WorkflowEngineService engineService,
        WorkflowDefinitionRegistry definitionRegistry,
        ExecutionStreamBroadcaster broadcaster
    ) {
        this.workerRegistry = workerRegistry;
        this.persistencePort = persistencePort;
        this.engineService = engineService;
        this.definitionRegistry = definitionRegistry;
        this.broadcaster = broadcaster;
    }

    @PostConstruct
    public void init() {
        com.acc.workflow.ports.WorkerTransportPort transportAdapter = new com.acc.workflow.ports.WorkerTransportPort() {
            private final long responseTimeoutMs = 30000L;

            @Override
            public List<com.acc.workflow.core.model.TaskSnapshot> pollBatch(
                String tenantId, String taskType, String domain, int batchSize, String workerId
            ) {
                long now = System.currentTimeMillis();
                return persistencePort.pollTasks(tenantId, taskType, domain, batchSize, workerId, responseTimeoutMs, now);
            }

            @Override
            public void reportTaskResult(
                String taskId, String workerId, boolean completed, Map<String, Object> output,
                String errorMessage, long callbackAfterSeconds
            ) {
                long now = System.currentTimeMillis();
                String workflowId = persistencePort.getTaskExecution(taskId)
                    .map(com.acc.workflow.core.model.TaskSnapshot::workflowId)
                    .orElseGet(() -> taskId.split("_")[0]);
                com.acc.workflow.core.model.WorkflowSnapshot snap = persistencePort.getWorkflowSnapshot(workflowId).orElse(null);
                WorkflowDefinition def = snap != null
                    ? definitionRegistry.get(snap.tenantId(), snap.workflowKey())
                        .orElseGet(() -> new WorkflowDefinition(snap.workflowKey(), 1, snap.workflowKey(), "Fallback", 3600, List.of(), Map.of()))
                    : new WorkflowDefinition("fallback", 1, "Fallback", "Fallback", 3600, List.of(), Map.of());

                engineService.reportTaskResult(
                    workflowId, taskId, workerId, completed, output, errorMessage,
                    callbackAfterSeconds, def, now
                );
            }

            @Override
            public boolean heartbeat(String taskId, String workerId) {
                long newVisibleAt = System.currentTimeMillis() + responseTimeoutMs;
                return persistencePort.renewLease(taskId, workerId, newVisibleAt);
            }
        };

        this.workerHost = new WorkerHost(transportAdapter, "jvm-virtual-thread-worker-01");

        registerBuiltInCapabilities();
        scanAndRegisterAnnotatedMethods(this);
        this.workerHost.start();
    }

    @PreDestroy
    public void destroy() {
        if (this.workerHost != null) {
            this.workerHost.close();
        }
    }

    private void registerBuiltInCapabilities() {
        List<TaskWorkerDescriptor> descriptors = List.of(
            new TaskWorkerDescriptor(
                "checkInventory",
                "default",
                "Verifies SKU availability and allocates warehouse reservation slot.",
                16,
                15L,
                Map.of(
                    "type", "object",
                    "required", List.of("orderId"),
                    "properties", Map.of(
                        "orderId", Map.of("type", "string", "description", "Target order identifier"),
                        "sku", Map.of("type", "string", "description", "Product SKU code"),
                        "quantity", Map.of("type", "number", "description", "Requested quantity")
                    )
                ),
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "inStock", Map.of("type", "boolean"),
                        "warehouseId", Map.of("type", "string"),
                        "reservationCode", Map.of("type", "string")
                    )
                )
            ),
            new TaskWorkerDescriptor(
                "expressCourier",
                "default",
                "Books priority overnight air freight label and tracking number.",
                16,
                20L,
                Map.of(
                    "type", "object",
                    "required", List.of("orderId"),
                    "properties", Map.of(
                        "orderId", Map.of("type", "string"),
                        "destinationZone", Map.of("type", "string")
                    )
                ),
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "carrier", Map.of("type", "string"),
                        "trackingNumber", Map.of("type", "string"),
                        "estimatedDeliveryHours", Map.of("type", "number")
                    )
                )
            ),
            new TaskWorkerDescriptor(
                "groundPostal",
                "default",
                "Books economical ground parcel fulfillment route.",
                16,
                20L,
                Map.of(
                    "type", "object",
                    "required", List.of("orderId"),
                    "properties", Map.of(
                        "orderId", Map.of("type", "string"),
                        "postalCode", Map.of("type", "string")
                    )
                ),
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "carrier", Map.of("type", "string"),
                        "trackingNumber", Map.of("type", "string"),
                        "estimatedDeliveryDays", Map.of("type", "number")
                    )
                )
            ),
            new TaskWorkerDescriptor(
                "cancelCourierBooking",
                "default",
                "Revokes active carrier label and releases reserved manifest capacity.",
                16,
                15L,
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "orderId", Map.of("type", "string"),
                        "trackingNumber", Map.of("type", "string")
                    )
                ),
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "cancelled", Map.of("type", "boolean"),
                        "refundReference", Map.of("type", "string")
                    )
                )
            ),
            new TaskWorkerDescriptor(
                "validateOrder",
                "orders",
                "Executes KYC, sanctions screening, and velocity fraud heuristics on incoming order.",
                16,
                10L,
                Map.of(
                    "type", "object",
                    "required", List.of("orderId"),
                    "properties", Map.of(
                        "orderId", Map.of("type", "string"),
                        "OrderValue", Map.of("type", "number"),
                        "customerTier", Map.of("type", "string")
                    )
                ),
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "valid", Map.of("type", "boolean"),
                        "riskScore", Map.of("type", "number"),
                        "checkedAt", Map.of("type", "string")
                    )
                )
            ),
            new TaskWorkerDescriptor(
                "chargePayment",
                "billing",
                "Captures authorized funds across primary payment gateway with idempotency key.",
                16,
                25L,
                Map.of(
                    "type", "object",
                    "required", List.of("orderId", "amount"),
                    "properties", Map.of(
                        "orderId", Map.of("type", "string"),
                        "amount", Map.of("type", "number"),
                        "currency", Map.of("type", "string")
                    )
                ),
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "charged", Map.of("type", "boolean"),
                        "transactionId", Map.of("type", "string"),
                        "settledAt", Map.of("type", "string")
                    )
                )
            ),
            new TaskWorkerDescriptor(
                "publishCmsArticle",
                "cms",
                "Promotes reviewed content revision to live CDN edge cache.",
                16,
                15L,
                Map.of(
                    "type", "object",
                    "required", List.of("articleId"),
                    "properties", Map.of(
                        "articleId", Map.of("type", "string"),
                        "slug", Map.of("type", "string"),
                        "channel", Map.of("type", "string")
                    )
                ),
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "published", Map.of("type", "boolean"),
                        "cdnUrl", Map.of("type", "string"),
                        "publishedAt", Map.of("type", "string")
                    )
                )
            )
        );

        long now = System.currentTimeMillis();
        workerRegistry.registerWorkerWithCapabilities(
            "jvm-virtual-thread-worker-01",
            "127.0.0.1",
            "JAVA_VIRTUAL_THREADS",
            List.of("default", "orders", "billing", "cms"),
            128,
            0,
            0L,
            0L,
            1L,
            now,
            descriptors
        );
    }

    private void scanAndRegisterAnnotatedMethods(Object bean) {
        for (Method method : bean.getClass().getDeclaredMethods()) {
            WorkflowTaskWorker ann = method.getAnnotation(WorkflowTaskWorker.class);
            if (ann != null) {
                String taskName = ann.taskName();
                String domain = ann.domain();
                TaskWorkerDescriptor descriptor = workerRegistry.getTaskCatalog().stream()
                    .filter(d -> d.taskName().equals(taskName))
                    .findFirst()
                    .orElseGet(() -> new TaskWorkerDescriptor(
                        taskName,
                        domain,
                        ann.description(),
                        ann.maxConcurrency(),
                        ann.timeoutSeconds(),
                        Map.of("type", "object"),
                        Map.of("type", "object")
                    ));

                WorkerConfig cfg = new WorkerConfig(
                    taskName,
                    "system",
                    domain,
                    ann.maxConcurrency(),
                    50L,
                    2000L,
                    5,
                    10000L
                );

                workerHost.registerTask(descriptor, cfg, ctx -> {
                    try {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> out = (Map<String, Object>) method.invoke(bean, ctx.input());
                        String wfId = ctx.workflowId();
                        if (wfId != null && broadcaster != null) {
                            broadcaster.broadcast(wfId, "TASK_COMPLETED", Map.of(
                                "workflowId", wfId,
                                "taskReferenceName", ctx.referenceName(),
                                "output", out,
                                "timestamp", System.currentTimeMillis()
                            ));
                        }
                        return TaskOutcome.completed(out);
                    } catch (Exception e) {
                        log.warn("Worker execution failed for {}: {}", taskName, e.getMessage());
                        return TaskOutcome.failedRetryable("Worker invocation error: " + e.getMessage());
                    }
                });
            }
        }
    }

    @WorkflowTaskWorker(taskName = "checkInventory", domain = "default", description = "Verifies SKU availability")
    public Map<String, Object> checkInventory(Map<String, Object> input) {
        return Map.of(
            "inStock", true,
            "warehouseId", "WH-APAC-SG-01",
            "reservationCode", "RSV-" + Math.abs(input.hashCode() % 100000),
            "checkedAt", Instant.now().toString()
        );
    }

    @WorkflowTaskWorker(taskName = "expressCourier", domain = "default", description = "Books express air courier")
    public Map<String, Object> expressCourier(Map<String, Object> input) {
        return Map.of(
            "carrier", "DHL_EXPRESS_AIR",
            "trackingNumber", "EXP-" + System.currentTimeMillis() % 1000000,
            "estimatedDeliveryHours", 18
        );
    }

    @WorkflowTaskWorker(taskName = "groundPostal", domain = "default", description = "Books standard ground postal")
    public Map<String, Object> groundPostal(Map<String, Object> input) {
        return Map.of(
            "carrier", "UNIPOST_GROUND",
            "trackingNumber", "GND-" + System.currentTimeMillis() % 1000000,
            "estimatedDeliveryDays", 4
        );
    }

    @WorkflowTaskWorker(taskName = "cancelCourierBooking", domain = "default", description = "Saga compensation for courier")
    public Map<String, Object> cancelCourierBooking(Map<String, Object> input) {
        return Map.of(
            "cancelled", true,
            "refundReference", "REF-SAGA-" + System.currentTimeMillis() % 100000
        );
    }

    @WorkflowTaskWorker(taskName = "validateOrder", domain = "default", description = "Validates order compliance")
    public Map<String, Object> validateOrder(Map<String, Object> input) {
        return Map.of(
            "valid", true,
            "riskScore", 12,
            "checkedAt", Instant.now().toString()
        );
    }

    @WorkflowTaskWorker(taskName = "chargePayment", domain = "default", description = "Captures payment settlement")
    public Map<String, Object> chargePayment(Map<String, Object> input) {
        return Map.of(
            "charged", true,
            "transactionId", "TXN-" + System.currentTimeMillis() % 1000000,
            "settledAt", Instant.now().toString()
        );
    }

    @WorkflowTaskWorker(taskName = "publishCmsArticle", domain = "default", description = "Publishes CMS article")
    public Map<String, Object> publishCmsArticle(Map<String, Object> input) {
        return Map.of(
            "published", true,
            "cdnUrl", "https://cdn.acc.io/content/" + input.getOrDefault("articleId", "draft"),
            "publishedAt", Instant.now().toString()
        );
    }
}
