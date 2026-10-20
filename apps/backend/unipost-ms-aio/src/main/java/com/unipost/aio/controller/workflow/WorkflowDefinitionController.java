package com.unipost.aio.controller.workflow;

import com.unipost.aio.config.WorkflowEngineConfiguration.WorkflowDefinitionRegistry;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.workflow.core.graph.AcyclicityGuard;
import com.unipost.workflow.core.model.WorkflowDefinition;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collection;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/workflow/definitions")
public class WorkflowDefinitionController {

    private final WorkflowDefinitionRegistry registry;
    private final com.unipost.workflow.application.WorkflowEngineService engineService;
    private final AcyclicityGuard acyclicityGuard = new AcyclicityGuard();

    public WorkflowDefinitionController(WorkflowDefinitionRegistry registry) {
        this(registry, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkflowDefinitionController(
        WorkflowDefinitionRegistry registry,
        com.unipost.workflow.application.WorkflowEngineService engineService
    ) {
        this.registry = registry;
        this.engineService = engineService;
    }

    private String resolveTenantId(String headerTenantId) {
        if (headerTenantId != null && !headerTenantId.isBlank()) {
            return headerTenantId;
        }
        String ctxTenant = TenantContextHolder.getTenantId();
        return (ctxTenant != null && !ctxTenant.isBlank()) ? ctxTenant : "system";
    }

    @PostMapping
    public ResponseEntity<?> registerDefinition(
        @RequestBody WorkflowDefinition definition,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        try {
            // Kahn's & Tarjan verification of acyclicity
            acyclicityGuard.validateAndSort(definition);
            registry.register(tenantId, definition);
            return ResponseEntity.status(HttpStatus.CREATED).body(definition);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Invalid Workflow Definition",
                "message", e.getMessage()
            ));
        }
    }

    @GetMapping("/{key}")
    public ResponseEntity<?> getDefinition(
        @PathVariable("key") String key,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        return registry.get(tenantId, key)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body((WorkflowDefinition) null));
    }

    @GetMapping("/{key}/versions")
    public ResponseEntity<?> listDefinitionVersions(
        @PathVariable("key") String key,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        return ResponseEntity.ok(registry.listVersions(tenantId, key));
    }

    @GetMapping("/{key}/versions/{version}")
    public ResponseEntity<?> getDefinitionVersion(
        @PathVariable("key") String key,
        @PathVariable("version") int version,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        return registry.getVersion(tenantId, key, version)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @GetMapping
    public ResponseEntity<Collection<WorkflowDefinition>> listDefinitions(
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        return ResponseEntity.ok(registry.list(tenantId).values());
    }

    // --- Execution Migration & Audit Endpoints ---

    @PostMapping("/executions/{id}/migrate/dry-run")
    public ResponseEntity<?> dryRunMigration(
        @PathVariable("id") String executionId,
        @RequestBody WorkflowDefinition targetDefinition
    ) {
        try {
            var report = engineService.validateMigration(executionId, targetDefinition);
            return ResponseEntity.ok(report);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/executions/{id}/migrate")
    public ResponseEntity<?> migrateExecution(
        @PathVariable("id") String executionId,
        @RequestBody WorkflowDefinition targetDefinition,
        @RequestHeader(value = "X-Actor-Id", required = false) String actorId
    ) {
        try {
            var snapshot = engineService.migrateExecution(
                executionId, targetDefinition, actorId != null ? actorId : "OPERATOR", System.currentTimeMillis()
            );
            return ResponseEntity.ok(snapshot);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/executions/{id}/audit")
    public ResponseEntity<?> getAuditLedger(@PathVariable("id") String executionId) {
        return ResponseEntity.ok(engineService.getAuditLedger(executionId));
    }

    @GetMapping("/executions/{id}/audit/verify")
    public ResponseEntity<?> verifyAuditLedger(@PathVariable("id") String executionId) {
        return ResponseEntity.ok(engineService.verifyAuditLedger(executionId));
    }

    // --- Fleet / Batch Hot Migration Endpoints ---

    public record MigrationPreviewRequest(int targetVersion) {}
    public record BatchMigrateRequest(int targetVersion, List<String> executionIds, Boolean autoMigrateCompatibleOnly) {}

    @PostMapping("/{key}/migration-preview")
    public ResponseEntity<?> migrationPreview(
        @PathVariable("key") String workflowKey,
        @RequestBody MigrationPreviewRequest req,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        var targetRecordOpt = registry.getVersion(tenantId, workflowKey, req.targetVersion());
        if (targetRecordOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Target definition version not found"));
        }
        WorkflowDefinition targetDef = targetRecordOpt.get().definition();

        var persistence = registry.persistencePort();
        if (persistence == null) {
            return ResponseEntity.ok(Map.of(
                "summary", Map.of("fullyCompatible", 0, "requiresReview", 0, "incompatible", 0),
                "items", List.of()
            ));
        }

        List<com.unipost.workflow.core.model.WorkflowSnapshot> runningExecutions = persistence.listWorkflowExecutions(
            tenantId, workflowKey, com.unipost.workflow.core.model.WorkflowStatus.RUNNING
        );

        int fullyCompatible = 0;
        int requiresReview = 0;
        int incompatible = 0;

        List<Map<String, Object>> items = new java.util.ArrayList<>();
        for (var exec : runningExecutions) {
            var report = engineService.validateMigration(exec.workflowId(), targetDef);
            String tierStr = report.tier() != null ? report.tier().name() : (report.compatible() ? "FULLY_COMPATIBLE" : "INCOMPATIBLE_BLOCK");
            if ("FULLY_COMPATIBLE".equals(tierStr)) fullyCompatible++;
            else if ("CONDITIONAL_REQUIRES_MANUAL_REVIEW".equals(tierStr)) requiresReview++;
            else incompatible++;

            items.add(Map.of(
                "workflowId", exec.workflowId(),
                "currentVersion", exec.version(),
                "status", exec.status().name(),
                "tier", tierStr,
                "compatible", report.compatible(),
                "completedTasks", report.completedTasksPreserved(),
                "activeTasks", report.activeFrontierTasks(),
                "warnings", report.warnings(),
                "issues", report.issues()
            ));
        }

        return ResponseEntity.ok(Map.of(
            "workflowKey", workflowKey,
            "targetVersion", req.targetVersion(),
            "summary", Map.of(
                "total", runningExecutions.size(),
                "fullyCompatible", fullyCompatible,
                "requiresReview", requiresReview,
                "incompatible", incompatible
            ),
            "items", items
        ));
    }

    @PostMapping("/{key}/batch-migrate")
    public ResponseEntity<?> batchMigrate(
        @PathVariable("key") String workflowKey,
        @RequestBody BatchMigrateRequest req,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
        @RequestHeader(value = "X-Actor-Id", required = false) String actorId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        var targetRecordOpt = registry.getVersion(tenantId, workflowKey, req.targetVersion());
        if (targetRecordOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Target definition version not found"));
        }
        WorkflowDefinition targetDef = targetRecordOpt.get().definition();

        var persistence = registry.persistencePort();
        if (persistence == null) {
            return ResponseEntity.ok(Map.of("migrated", 0, "failed", 0, "results", List.of()));
        }

        List<com.unipost.workflow.core.model.WorkflowSnapshot> runningExecutions = persistence.listWorkflowExecutions(
            tenantId, workflowKey, com.unipost.workflow.core.model.WorkflowStatus.RUNNING
        );

        List<String> targetIds = req.executionIds();
        boolean autoCompatible = Boolean.TRUE.equals(req.autoMigrateCompatibleOnly());

        int migrated = 0;
        int failed = 0;
        List<Map<String, Object>> results = new java.util.ArrayList<>();
        String opId = actorId != null ? actorId : "BATCH_OPERATOR";
        long now = System.currentTimeMillis();

        for (var exec : runningExecutions) {
            boolean shouldMigrate = false;
            if (targetIds != null && targetIds.contains(exec.workflowId())) {
                shouldMigrate = true;
            } else if (autoCompatible) {
                var report = engineService.validateMigration(exec.workflowId(), targetDef);
                if (report.tier() == com.unipost.workflow.core.model.MigrationTier.FULLY_COMPATIBLE) {
                    shouldMigrate = true;
                }
            }

            if (shouldMigrate) {
                try {
                    engineService.migrateExecution(exec.workflowId(), targetDef, opId, now);
                    migrated++;
                    results.add(Map.of("workflowId", exec.workflowId(), "success", true));
                } catch (Exception e) {
                    failed++;
                    results.add(Map.of("workflowId", exec.workflowId(), "success", false, "error", e.getMessage()));
                }
            }
        }

        return ResponseEntity.ok(Map.of(
            "workflowKey", workflowKey,
            "targetVersion", req.targetVersion(),
            "migrated", migrated,
            "failed", failed,
            "results", results
        ));
    }

    public record SimulateWorkflowRequest(
        WorkflowDefinition definition,
        Map<String, Object> inputParameters
    ) {}

    @PostMapping("/simulate")
    public ResponseEntity<?> simulateWorkflowDefinition(
        @RequestBody SimulateWorkflowRequest req,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        if (req == null || req.definition() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Workflow definition is required for simulation"));
        }
        long now = System.currentTimeMillis();
        if (engineService != null) {
            com.unipost.workflow.core.model.WorkflowSnapshot simSnapshot =
                engineService.simulateExecution(req.definition(), req.inputParameters(), now);
            return ResponseEntity.ok(simSnapshot);
        }

        // Standalone fallback simulation if engineService not autowired
        return ResponseEntity.ok(Map.of(
            "workflowId", "sim-preview",
            "status", "COMPLETED",
            "simulated", true,
            "timestamp", now
        ));
    }
}

