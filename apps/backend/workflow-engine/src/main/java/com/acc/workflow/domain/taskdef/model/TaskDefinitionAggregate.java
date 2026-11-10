package com.acc.workflow.domain.taskdef.model;

import com.acc.core.domain.AggregateRoot;
import com.acc.core.domain.exception.DomainValidationException;
import com.acc.core.domain.exception.ImmutableVersionConflictException;
import com.acc.workflow.domain.taskdef.valobj.TaskDefId;
import com.acc.workflow.domain.taskdef.valobj.TaskStatus;

import java.util.Map;
import java.util.Objects;

/**
 * Pure Domain Aggregate Root for Task Definitions.
 * Enforces the mathematical f_version hard-fork invariant and promotion invariants.
 * ZERO framework, JPA, Hibernate, or Jackson imports.
 */
public final class TaskDefinitionAggregate extends AggregateRoot<TaskDefId> {

    private final String tenantId;
    private final String name;
    private int version;
    private TaskStatus status;
    private String description;
    private int retryCount;
    private int retryDelaySeconds;
    private double backoffRate;
    private int timeoutSeconds;
    private Map<String, Object> inputSchema;
    private Map<String, Object> outputSchema;
    private Map<String, Object> executionContract;
    private String changelogNote;
    private final long createdAtEpochMs;
    private long updatedAtEpochMs;

    public TaskDefinitionAggregate(
        TaskDefId id, String tenantId, String name, int version, TaskStatus status,
        String description, int retryCount, int retryDelaySeconds, double backoffRate, int timeoutSeconds,
        Map<String, Object> inputSchema, Map<String, Object> outputSchema, Map<String, Object> executionContract,
        String changelogNote, long createdAtEpochMs, long updatedAtEpochMs
    ) {
        this.setId(Objects.requireNonNull(id, "TaskDefId cannot be null"));
        this.tenantId = Objects.requireNonNull(tenantId, "TenantId cannot be null");
        this.name = Objects.requireNonNull(name, "Task name cannot be null");
        if (version <= 0) {
            throw new DomainValidationException("Version must be positive: " + version);
        }
        this.version = version;
        this.status = Objects.requireNonNull(status, "Status cannot be null");
        this.description = description != null ? description : "";
        this.retryCount = Math.max(0, retryCount);
        this.retryDelaySeconds = Math.max(0, retryDelaySeconds);
        this.backoffRate = backoffRate > 0 ? backoffRate : 1.0;
        this.timeoutSeconds = Math.max(0, timeoutSeconds);
        this.inputSchema = inputSchema != null ? Map.copyOf(inputSchema) : Map.of();
        this.outputSchema = outputSchema != null ? Map.copyOf(outputSchema) : Map.of();
        this.executionContract = executionContract != null ? Map.copyOf(executionContract) : Map.of();
        this.changelogNote = changelogNote != null ? changelogNote : "";
        this.createdAtEpochMs = createdAtEpochMs;
        this.updatedAtEpochMs = updatedAtEpochMs;
    }

    public TaskDefinitionAggregate(
        TaskDefId id, String tenantId, String name, Integer version, TaskStatus status,
        String description, Integer retryCount, Integer retryDelaySeconds, Double backoffRate, Integer timeoutSeconds,
        Map<String, Object> inputSchema, Map<String, Object> outputSchema, Map<String, Object> executionContract,
        String changelogNote, Long createdAtEpochMs, Long updatedAtEpochMs
    ) {
        this(
            id, tenantId, name,
            version != null ? version : 1,
            status, description,
            retryCount != null ? retryCount : 0,
            retryDelaySeconds != null ? retryDelaySeconds : 0,
            backoffRate != null ? backoffRate : 1.0,
            timeoutSeconds != null ? timeoutSeconds : 0,
            inputSchema, outputSchema, executionContract, changelogNote,
            createdAtEpochMs != null ? createdAtEpochMs : 0L,
            updatedAtEpochMs != null ? updatedAtEpochMs : 0L
        );
    }

    /**
     * Mathematical f_version hard-fork invariant:
     * - If latest version is in DRAFT, mutates draft in-place.
     * - If latest version is in ACTIVE, DEPRECATED, or ARCHIVED, hard-forks new DRAFT with version = v_max + 1.
     */
    public static TaskDefinitionAggregate hardForkNewDraft(
        TaskDefinitionAggregate latestExisting,
        String tenantId,
        String name,
        String description,
        int retryCount,
        int retryDelaySeconds,
        double backoffRate,
        int timeoutSeconds,
        Map<String, Object> inputSchema,
        Map<String, Object> outputSchema,
        Map<String, Object> executionContract,
        String changelogNote,
        long nowEpochMs
    ) {
        if (latestExisting == null) {
            return new TaskDefinitionAggregate(
                TaskDefId.random(), tenantId, name, 1, TaskStatus.DRAFT,
                description, retryCount, retryDelaySeconds, backoffRate, timeoutSeconds,
                inputSchema, outputSchema, executionContract, changelogNote, nowEpochMs, nowEpochMs
            );
        }

        if (latestExisting.status() == TaskStatus.DRAFT) {
            latestExisting.updateDraft(
                description, retryCount, retryDelaySeconds, backoffRate, timeoutSeconds,
                inputSchema, outputSchema, executionContract, changelogNote, nowEpochMs
            );
            return latestExisting;
        }

        int nextVersion = latestExisting.version() + 1;
        return new TaskDefinitionAggregate(
            TaskDefId.random(), latestExisting.tenantId(), latestExisting.name(), nextVersion,
            TaskStatus.DRAFT, description, retryCount, retryDelaySeconds, backoffRate, timeoutSeconds,
            inputSchema, outputSchema, executionContract, changelogNote, nowEpochMs, nowEpochMs
        );
    }

    public void updateDraft(
        String description,
        int retryCount,
        int retryDelaySeconds,
        double backoffRate,
        int timeoutSeconds,
        Map<String, Object> inputSchema,
        Map<String, Object> outputSchema,
        Map<String, Object> executionContract,
        String changelogNote,
        long nowEpochMs
    ) {
        if (this.status != TaskStatus.DRAFT) {
            throw new ImmutableVersionConflictException(
                "Cannot mutate task definition in state " + this.status + ". Must hard-fork a new draft."
            );
        }
        this.description = description != null ? description : "";
        this.retryCount = Math.max(0, retryCount);
        this.retryDelaySeconds = Math.max(0, retryDelaySeconds);
        this.backoffRate = backoffRate > 0 ? backoffRate : 1.0;
        this.timeoutSeconds = Math.max(0, timeoutSeconds);
        this.inputSchema = inputSchema != null ? Map.copyOf(inputSchema) : Map.of();
        this.outputSchema = outputSchema != null ? Map.copyOf(outputSchema) : Map.of();
        this.executionContract = executionContract != null ? Map.copyOf(executionContract) : Map.of();
        this.changelogNote = changelogNote != null ? changelogNote : "";
        this.updatedAtEpochMs = nowEpochMs;
    }

    public void promoteToActive(long nowEpochMs) {
        if (this.status == TaskStatus.ARCHIVED) {
            throw new DomainValidationException("Cannot promote an ARCHIVED task definition");
        }
        this.status = TaskStatus.ACTIVE;
        this.updatedAtEpochMs = nowEpochMs;
    }

    public void deprecate(long nowEpochMs) {
        this.status = TaskStatus.DEPRECATED;
        this.updatedAtEpochMs = nowEpochMs;
    }

    public void archive(long nowEpochMs) {
        this.status = TaskStatus.ARCHIVED;
        this.updatedAtEpochMs = nowEpochMs;
    }

    public String tenantId() { return tenantId; }
    public String name() { return name; }
    public int version() { return version; }
    public TaskStatus status() { return status; }
    public String description() { return description; }
    public int retryCount() { return retryCount; }
    public int retryDelaySeconds() { return retryDelaySeconds; }
    public double backoffRate() { return backoffRate; }
    public int timeoutSeconds() { return timeoutSeconds; }
    public Map<String, Object> inputSchema() { return inputSchema; }
    public Map<String, Object> outputSchema() { return outputSchema; }
    public Map<String, Object> executionContract() { return executionContract; }
    public String changelogNote() { return changelogNote; }
    public long createdAtEpochMs() { return createdAtEpochMs; }
    public long updatedAtEpochMs() { return updatedAtEpochMs; }

    // Standard JavaBean accessors for framework and reflection compatibility
    public String getTenantId() { return tenantId; }
    public String getName() { return name; }
    public int getVersion() { return version; }
    public TaskStatus getStatus() { return status; }
    public String getDescription() { return description; }
    public int getRetryCount() { return retryCount; }
    public int getRetryDelaySeconds() { return retryDelaySeconds; }
    public double getBackoffRate() { return backoffRate; }
    public int getTimeoutSeconds() { return timeoutSeconds; }
    public Map<String, Object> getInputSchema() { return inputSchema; }
    public Map<String, Object> getOutputSchema() { return outputSchema; }
    public Map<String, Object> getExecutionContract() { return executionContract; }
    public String getChangelogNote() { return changelogNote; }
    public long getCreatedAtEpochMs() { return createdAtEpochMs; }
    public long getUpdatedAtEpochMs() { return updatedAtEpochMs; }
}
