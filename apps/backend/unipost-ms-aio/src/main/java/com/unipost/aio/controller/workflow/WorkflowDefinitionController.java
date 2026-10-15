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
    private final AcyclicityGuard acyclicityGuard = new AcyclicityGuard();

    public WorkflowDefinitionController(WorkflowDefinitionRegistry registry) {
        this.registry = registry;
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

    @GetMapping
    public ResponseEntity<Collection<WorkflowDefinition>> listDefinitions(
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        return ResponseEntity.ok(registry.list(tenantId).values());
    }
}
