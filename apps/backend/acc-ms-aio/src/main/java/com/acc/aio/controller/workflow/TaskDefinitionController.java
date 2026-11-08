package com.acc.aio.controller.workflow;

import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.workflow.application.TaskDefinitionRegistry;
import com.acc.workflow.core.model.TaskDefinitionRecord;
import com.acc.workflow.core.model.WorkflowVersionStatus;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/workflow/task-definitions")
public class TaskDefinitionController {

    private final TaskDefinitionRegistry registry;

    public TaskDefinitionController(TaskDefinitionRegistry registry) {
        this.registry = registry;
    }

    private String resolveTenantId() {
        try {
            return TenantContextHolder.getRequiredTenantId();
        } catch (Exception e) {
            return "system";
        }
    }

    private String resolveUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.getName() != null) ? auth.getName() : "SYSTEM";
    }

    @GetMapping
    @PreAuthorize("hasAuthority('workflow:definition:read')")
    public ResponseEntity<List<TaskDefinitionRecord>> listLatestTaskDefinitions() {
        String tenantId = resolveTenantId();
        return ResponseEntity.ok(registry.listLatest(tenantId));
    }

    @GetMapping("/{name}")
    @PreAuthorize("hasAuthority('workflow:definition:read')")
    public ResponseEntity<TaskDefinitionRecord> getTaskDefinition(@PathVariable("name") String name) {
        String tenantId = resolveTenantId();
        return registry.resolve(tenantId, name, null)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @GetMapping("/{name}/versions")
    @PreAuthorize("hasAuthority('workflow:definition:read')")
    public ResponseEntity<List<TaskDefinitionRecord>> listTaskDefinitionVersions(@PathVariable("name") String name) {
        String tenantId = resolveTenantId();
        return ResponseEntity.ok(registry.listVersions(tenantId, name));
    }

    @GetMapping("/{name}/versions/{version}")
    @PreAuthorize("hasAuthority('workflow:definition:read')")
    public ResponseEntity<TaskDefinitionRecord> getTaskDefinitionVersion(
        @PathVariable("name") String name,
        @PathVariable("version") int version
    ) {
        String tenantId = resolveTenantId();
        return registry.resolve(tenantId, name, version)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    public record SaveTaskDefRequest(
        String name,
        String description,
        Integer retryCount,
        Integer retryDelaySeconds,
        Double backoffRate,
        Integer timeoutSeconds,
        Map<String, Object> inputSchema,
        Map<String, Object> outputSchema,
        String changelogNote
    ) {}

    @PostMapping
    @PreAuthorize("hasAuthority('workflow:definition:manage')")
    public ResponseEntity<?> createOrForkDraft(@RequestBody SaveTaskDefRequest request) {
        if (request == null || request.name() == null || request.name().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Task definition name is required"));
        }
        String tenantId = resolveTenantId();
        String user = resolveUsername();

        TaskDefinitionRecord saved = registry.createOrForkDraft(
            tenantId,
            request.name(),
            request.description(),
            request.retryCount() != null ? request.retryCount() : 3,
            request.retryDelaySeconds() != null ? request.retryDelaySeconds() : 2,
            request.backoffRate() != null ? request.backoffRate() : 2.0,
            request.timeoutSeconds() != null ? request.timeoutSeconds() : 30,
            request.inputSchema(),
            request.outputSchema(),
            request.changelogNote(),
            user
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PostMapping("/{name}/versions/{version}/publish")
    @PreAuthorize("hasAuthority('workflow:definition:manage')")
    public ResponseEntity<?> publishVersion(
        @PathVariable("name") String name,
        @PathVariable("version") int version
    ) {
        String tenantId = resolveTenantId();
        String user = resolveUsername();
        try {
            TaskDefinitionRecord published = registry.publishVersion(tenantId, name, version, user);
            return ResponseEntity.ok(published);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{name}/versions/{version}")
    @PreAuthorize("hasAuthority('workflow:definition:manage')")
    public ResponseEntity<?> deleteDraftVersion(
        @PathVariable("name") String name,
        @PathVariable("version") int version
    ) {
        String tenantId = resolveTenantId();
        try {
            boolean deleted = registry.deleteDraftVersion(tenantId, name, version);
            if (deleted) {
                return ResponseEntity.noContent().build();
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
