package com.acc.workflow.application;

import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowDefinitionRecord;
import com.acc.workflow.core.model.WorkflowVersionStatus;
import com.acc.workflow.ports.PersistencePort;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tenant-partitioned in-memory and persistent registry for WorkflowDefinitions.
 */
public class WorkflowDefinitionRegistry {

    private final Map<String, Map<String, WorkflowDefinition>> tenantDefinitions = new ConcurrentHashMap<>();
    private final PersistencePort persistencePort;

    public WorkflowDefinitionRegistry() {
        this(null);
    }

    public WorkflowDefinitionRegistry(PersistencePort persistencePort) {
        this.persistencePort = persistencePort;
    }

    public PersistencePort persistencePort() {
        return this.persistencePort;
    }

    public void register(String tenantId, WorkflowDefinition definition) {
        tenantDefinitions.computeIfAbsent(tenantId, t -> new ConcurrentHashMap<>())
            .put(definition.workflowKey(), definition);

        if (persistencePort != null) {
            String defId = tenantId + "_" + definition.workflowKey() + "_v" + definition.version();
            long now = System.currentTimeMillis();
            persistencePort.saveDefinitionVersion(new WorkflowDefinitionRecord(
                defId, tenantId, definition.workflowKey(), definition.version(),
                WorkflowVersionStatus.ACTIVE,
                definition.name(), definition.description(), definition,
                now, "SYSTEM", now, now
            ));
        }
    }

    public Optional<WorkflowDefinition> get(String tenantId, String workflowKey) {
        Map<String, WorkflowDefinition> defs = tenantDefinitions.get(tenantId);
        if (defs != null && defs.containsKey(workflowKey)) {
            return Optional.of(defs.get(workflowKey));
        }
        // Check persistencePort
        if (persistencePort != null) {
            List<WorkflowDefinitionRecord> list = persistencePort.listDefinitionVersions(tenantId, workflowKey);
            if (!list.isEmpty()) {
                return Optional.of(list.get(list.size() - 1).definition());
            }
        }
        // Fallback to "system" default catalog
        Map<String, WorkflowDefinition> systemDefs = tenantDefinitions.get("system");
        return Optional.ofNullable(systemDefs != null ? systemDefs.get(workflowKey) : null);
    }

    public Optional<WorkflowDefinitionRecord> getVersion(String tenantId, String workflowKey, int version) {
        if (persistencePort != null) {
            return persistencePort.getDefinitionVersion(tenantId, workflowKey, version);
        }
        return get(tenantId, workflowKey).map(def -> new WorkflowDefinitionRecord(
            tenantId + "_" + workflowKey + "_v" + version, tenantId, workflowKey, version,
            WorkflowVersionStatus.ACTIVE,
            def.name(), def.description(), def, System.currentTimeMillis(), "SYSTEM", System.currentTimeMillis(), System.currentTimeMillis()
        ));
    }

    public List<WorkflowDefinitionRecord> listVersions(String tenantId, String workflowKey) {
        if (persistencePort != null) {
            return persistencePort.listDefinitionVersions(tenantId, workflowKey);
        }
        Optional<WorkflowDefinition> defOpt = get(tenantId, workflowKey);
        return defOpt.map(def -> List.of(new WorkflowDefinitionRecord(
            tenantId + "_" + workflowKey + "_v" + def.version(), tenantId, workflowKey, def.version(),
            WorkflowVersionStatus.ACTIVE,
            def.name(), def.description(), def, System.currentTimeMillis(), "SYSTEM", System.currentTimeMillis(), System.currentTimeMillis()
        ))).orElse(List.of());
    }

    public Map<String, WorkflowDefinition> list(String tenantId) {
        return tenantDefinitions.getOrDefault(tenantId, Map.of());
    }

    public Map<String, Map<String, WorkflowDefinition>> tenantDefinitions() {
        return tenantDefinitions;
    }
}
