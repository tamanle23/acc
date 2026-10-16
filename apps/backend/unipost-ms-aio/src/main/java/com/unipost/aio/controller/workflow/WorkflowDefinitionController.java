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
}
