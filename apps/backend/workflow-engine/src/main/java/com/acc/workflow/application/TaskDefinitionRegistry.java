package com.acc.workflow.application;

import com.acc.workflow.core.model.TaskDefinitionRecord;
import com.acc.workflow.core.model.WorkflowVersionStatus;
import com.acc.workflow.ports.PersistencePort;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tenant-partitioned in-memory and persistent registry for TaskDefinitions.
 * Enforces hard-fork versioning semantics:
 * - ACTIVE versions are immutable.
 * - Editing forks a new version (version = MAX + 1) in DRAFT status.
 * - Promoting a DRAFT to ACTIVE deprecates previously ACTIVE versions.
 */
public class TaskDefinitionRegistry {

    private final PersistencePort persistencePort;
    private final Map<String, TaskDefinitionRecord> inMemoryFallbacks = new ConcurrentHashMap<>();

    public TaskDefinitionRegistry() {
        this(null);
    }

    public TaskDefinitionRegistry(PersistencePort persistencePort) {
        this.persistencePort = persistencePort;
        seedBuiltIns();
    }

    public PersistencePort persistencePort() {
        return this.persistencePort;
    }

    /**
     * Seeds canonical domain tasks into the registry if not already present.
     */
    public void seedBuiltIns() {
        List<TaskDefinitionRecord> builtIns = List.of(
            new TaskDefinitionRecord(
                "system:validateOrder:v1",
                "system",
                "validateOrder",
                1,
                WorkflowVersionStatus.ACTIVE,
                "Executes KYC, sanctions screening, and velocity fraud heuristics on incoming order.",
                3, 2, 2.0, 30,
                Map.of(
                    "type", "object",
                    "required", List.of("orderId"),
                    "properties", Map.of(
                        "orderId", Map.of("type", "string"),
                        "orderValue", Map.of("type", "number"),
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
                ),
                "Initial canonical validateOrder specification",
                System.currentTimeMillis(),
                "SYSTEM",
                System.currentTimeMillis(),
                System.currentTimeMillis(),
                "SYSTEM"
            ),
            new TaskDefinitionRecord(
                "system:checkInventory:v1",
                "system",
                "checkInventory",
                1,
                WorkflowVersionStatus.ACTIVE,
                "Verifies stock levels in warehouse and reserves allocation lease.",
                3, 2, 2.0, 30,
                Map.of(
                    "type", "object",
                    "required", List.of("sku", "quantity"),
                    "properties", Map.of(
                        "sku", Map.of("type", "string"),
                        "quantity", Map.of("type", "number"),
                        "warehouseZone", Map.of("type", "string")
                    )
                ),
                Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "inStock", Map.of("type", "boolean"),
                        "warehouseId", Map.of("type", "string"),
                        "reservationCode", Map.of("type", "string")
                    )
                ),
                "Initial canonical checkInventory specification",
                System.currentTimeMillis(),
                "SYSTEM",
                System.currentTimeMillis(),
                System.currentTimeMillis(),
                "SYSTEM"
            ),
            new TaskDefinitionRecord(
                "system:chargePayment:v1",
                "system",
                "chargePayment",
                1,
                WorkflowVersionStatus.ACTIVE,
                "Captures authorized funds across primary payment gateway with idempotency key.",
                3, 2, 2.0, 30,
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
                ),
                "Initial canonical chargePayment specification",
                System.currentTimeMillis(),
                "SYSTEM",
                System.currentTimeMillis(),
                System.currentTimeMillis(),
                "SYSTEM"
            ),
            new TaskDefinitionRecord(
                "system:expressCourier:v1",
                "system",
                "expressCourier",
                1,
                WorkflowVersionStatus.ACTIVE,
                "Books priority overnight air freight label and tracking number.",
                3, 2, 2.0, 30,
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
                ),
                "Initial canonical expressCourier specification",
                System.currentTimeMillis(),
                "SYSTEM",
                System.currentTimeMillis(),
                System.currentTimeMillis(),
                "SYSTEM"
            ),
            new TaskDefinitionRecord(
                "system:groundPostal:v1",
                "system",
                "groundPostal",
                1,
                WorkflowVersionStatus.ACTIVE,
                "Books economical ground parcel fulfillment route.",
                3, 2, 2.0, 30,
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
                ),
                "Initial canonical groundPostal specification",
                System.currentTimeMillis(),
                "SYSTEM",
                System.currentTimeMillis(),
                System.currentTimeMillis(),
                "SYSTEM"
            ),
            new TaskDefinitionRecord(
                "system:cancelCourierBooking:v1",
                "system",
                "cancelCourierBooking",
                1,
                WorkflowVersionStatus.ACTIVE,
                "Revokes active carrier label and releases reserved manifest capacity.",
                3, 2, 2.0, 30,
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
                ),
                "Initial canonical cancelCourierBooking specification",
                System.currentTimeMillis(),
                "SYSTEM",
                System.currentTimeMillis(),
                System.currentTimeMillis(),
                "SYSTEM"
            ),
            new TaskDefinitionRecord(
                "system:publishCmsArticle:v1",
                "system",
                "publishCmsArticle",
                1,
                WorkflowVersionStatus.ACTIVE,
                "Promotes reviewed content revision to live CDN edge cache.",
                3, 2, 2.0, 30,
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
                ),
                "Initial canonical publishCmsArticle specification",
                System.currentTimeMillis(),
                "SYSTEM",
                System.currentTimeMillis(),
                System.currentTimeMillis(),
                "SYSTEM"
            )
        );

        for (TaskDefinitionRecord record : builtIns) {
            inMemoryFallbacks.put("system:" + record.name() + ":v" + record.version(), record);
            if (persistencePort != null) {
                try {
                    if (persistencePort.getTaskDefinition("system", record.name(), record.version()).isEmpty()) {
                        persistencePort.saveTaskDefinition(record);
                    }
                } catch (Exception ignored) {
                    // Fallback to in-memory registration if database tables are still provisioning
                }
            }
        }
    }

    /**
     * Creates a new draft or forks an existing active version.
     */
    public TaskDefinitionRecord createOrForkDraft(
        String tenantId,
        String name,
        String description,
        int retryCount,
        int retryDelaySeconds,
        double backoffRate,
        int timeoutSeconds,
        Map<String, Object> inputSchema,
        Map<String, Object> outputSchema,
        String changelogNote,
        String author
    ) {
        String effectiveTenant = (tenantId != null && !tenantId.isBlank()) ? tenantId : "system";
        List<TaskDefinitionRecord> existingVersions = listVersions(effectiveTenant, name);

        int nextVersion = 1;
        if (!existingVersions.isEmpty()) {
            int maxVer = existingVersions.stream().mapToInt(TaskDefinitionRecord::version).max().orElse(0);
            Optional<TaskDefinitionRecord> latestDraft = existingVersions.stream()
                .filter(v -> v.version() == maxVer && v.status() == WorkflowVersionStatus.DRAFT)
                .findFirst();

            if (latestDraft.isPresent()) {
                // If the highest version is still a DRAFT, we can update it in place
                nextVersion = maxVer;
            } else {
                // Highest version is ACTIVE or DEPRECATED -> Hard Fork into next version
                nextVersion = maxVer + 1;
            }
        }

        long now = System.currentTimeMillis();
        String taskDefId = effectiveTenant + ":" + name + ":v" + nextVersion;
        TaskDefinitionRecord newRecord = new TaskDefinitionRecord(
            taskDefId,
            effectiveTenant,
            name,
            nextVersion,
            WorkflowVersionStatus.DRAFT,
            description,
            retryCount,
            retryDelaySeconds,
            backoffRate,
            timeoutSeconds,
            inputSchema,
            outputSchema,
            changelogNote,
            null,
            null,
            now,
            now,
            author != null ? author : "SYSTEM"
        );

        if (persistencePort != null) {
            persistencePort.saveTaskDefinition(newRecord);
        } else {
            inMemoryFallbacks.put(effectiveTenant + ":" + name + ":v" + nextVersion, newRecord);
        }

        return newRecord;
    }

    /**
     * Promotes a DRAFT version to ACTIVE and deprecates all previous ACTIVE versions.
     */
    public TaskDefinitionRecord publishVersion(String tenantId, String name, int version, String publisher) {
        String effectiveTenant = (tenantId != null && !tenantId.isBlank()) ? tenantId : "system";
        Optional<TaskDefinitionRecord> opt = resolve(effectiveTenant, name, version);
        if (opt.isEmpty()) {
            throw new IllegalArgumentException("Task definition " + name + " version " + version + " not found for tenant " + effectiveTenant);
        }
        TaskDefinitionRecord target = opt.get();
        long now = System.currentTimeMillis();

        // 1. Deprecate currently ACTIVE versions
        List<TaskDefinitionRecord> allVersions = listVersions(effectiveTenant, name);
        for (TaskDefinitionRecord v : allVersions) {
            if (v.version() != version && v.status() == WorkflowVersionStatus.ACTIVE) {
                if (persistencePort != null) {
                    persistencePort.updateTaskDefinitionStatus(effectiveTenant, name, v.version(), WorkflowVersionStatus.DEPRECATED, v.publishedAtMs(), v.publishedBy());
                } else {
                    inMemoryFallbacks.put(effectiveTenant + ":" + name + ":v" + v.version(),
                        new TaskDefinitionRecord(
                            v.taskDefId(), v.tenantId(), v.name(), v.version(),
                            WorkflowVersionStatus.DEPRECATED, v.description(), v.retryCount(),
                            v.retryDelaySeconds(), v.backoffRate(), v.timeoutSeconds(),
                            v.inputSchema(), v.outputSchema(), v.changelogNote(),
                            v.publishedAtMs(), v.publishedBy(), v.createdAtMs(), now, v.createdBy()
                        )
                    );
                }
            }
        }

        // 2. Promote target to ACTIVE
        if (persistencePort != null) {
            persistencePort.updateTaskDefinitionStatus(effectiveTenant, name, version, WorkflowVersionStatus.ACTIVE, now, publisher);
        } else {
            target = new TaskDefinitionRecord(
                target.taskDefId(), target.tenantId(), target.name(), target.version(),
                WorkflowVersionStatus.ACTIVE, target.description(), target.retryCount(),
                target.retryDelaySeconds(), target.backoffRate(), target.timeoutSeconds(),
                target.inputSchema(), target.outputSchema(), target.changelogNote(),
                now, publisher, target.createdAtMs(), now, target.createdBy()
            );
            inMemoryFallbacks.put(effectiveTenant + ":" + name + ":v" + version, target);
        }

        return resolve(effectiveTenant, name, version).orElse(target);
    }

    /**
     * Resolves a task definition by tenant, name, and optional version.
     * If version is null, resolves latest ACTIVE version.
     */
    public Optional<TaskDefinitionRecord> resolve(String tenantId, String name, Integer version) {
        String effectiveTenant = (tenantId != null && !tenantId.isBlank()) ? tenantId : "system";

        if (version != null && version > 0) {
            if (persistencePort != null) {
                Optional<TaskDefinitionRecord> res = persistencePort.getTaskDefinition(effectiveTenant, name, version);
                if (res.isPresent()) return res;
            }
            TaskDefinitionRecord rec = inMemoryFallbacks.get(effectiveTenant + ":" + name + ":v" + version);
            if (rec != null) return Optional.of(rec);
            return Optional.ofNullable(inMemoryFallbacks.get("system:" + name + ":v" + version));
        }

        // Version is null: Resolve latest ACTIVE
        if (persistencePort != null) {
            Optional<TaskDefinitionRecord> res = persistencePort.getLatestActiveTaskDefinition(effectiveTenant, name);
            if (res.isPresent()) return res;
        }

        return inMemoryFallbacks.values().stream()
            .filter(r -> (r.tenantId().equals(effectiveTenant) || "system".equals(r.tenantId()))
                && r.name().equals(name) && r.status() == WorkflowVersionStatus.ACTIVE)
            .max(Comparator.comparingInt(TaskDefinitionRecord::version));
    }

    /**
     * Lists the latest version of every task definition accessible to this tenant.
     */
    public List<TaskDefinitionRecord> listLatest(String tenantId) {
        String effectiveTenant = (tenantId != null && !tenantId.isBlank()) ? tenantId : "system";
        if (persistencePort != null) {
            return persistencePort.listTaskDefinitions(effectiveTenant);
        }

        Map<String, TaskDefinitionRecord> latestByName = new LinkedHashMap<>();
        for (TaskDefinitionRecord r : inMemoryFallbacks.values()) {
            if (r.tenantId().equals(effectiveTenant) || "system".equals(r.tenantId())) {
                latestByName.merge(r.name(), r, (existing, replace) ->
                    replace.version() > existing.version() ? replace : existing
                );
            }
        }
        return new ArrayList<>(latestByName.values());
    }

    /**
     * Lists all versions in the append-only ledger for a given task definition.
     */
    public List<TaskDefinitionRecord> listVersions(String tenantId, String name) {
        String effectiveTenant = (tenantId != null && !tenantId.isBlank()) ? tenantId : "system";
        if (persistencePort != null) {
            return persistencePort.listTaskDefinitionVersions(effectiveTenant, name);
        }

        List<TaskDefinitionRecord> list = new ArrayList<>();
        for (TaskDefinitionRecord r : inMemoryFallbacks.values()) {
            if ((r.tenantId().equals(effectiveTenant) || "system".equals(r.tenantId())) && r.name().equals(name)) {
                list.add(r);
            }
        }
        list.sort(Comparator.comparingInt(TaskDefinitionRecord::version));
        return list;
    }

    /**
     * Deletes a draft version. Active and Deprecated versions cannot be deleted to preserve history.
     */
    public boolean deleteDraftVersion(String tenantId, String name, int version) {
        String effectiveTenant = (tenantId != null && !tenantId.isBlank()) ? tenantId : "system";
        Optional<TaskDefinitionRecord> opt = resolve(effectiveTenant, name, version);
        if (opt.isEmpty()) return false;
        if (opt.get().status() != WorkflowVersionStatus.DRAFT) {
            throw new IllegalStateException("Only DRAFT versions can be deleted. Version " + version + " is " + opt.get().status());
        }

        if (persistencePort != null) {
            return persistencePort.deleteTaskDefinition(effectiveTenant, name, version);
        } else {
            return inMemoryFallbacks.remove(effectiveTenant + ":" + name + ":v" + version) != null;
        }
    }
}
