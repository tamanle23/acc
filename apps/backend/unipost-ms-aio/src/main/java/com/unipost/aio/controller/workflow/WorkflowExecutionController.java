package com.unipost.aio.controller.workflow;

import com.unipost.aio.config.WorkflowEngineConfiguration.WorkflowDefinitionRegistry;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.workflow.application.WorkflowEngineService;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;
import com.unipost.workflow.ports.PersistencePort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/workflow/executions")
public class WorkflowExecutionController {

    private final WorkflowEngineService engineService;
    private final PersistencePort persistencePort;
    private final WorkflowDefinitionRegistry registry;
    private final ExecutionStreamBroadcaster broadcaster;
    private final WorkflowApprovalsController approvalsController;

    @org.springframework.beans.factory.annotation.Autowired
    public WorkflowExecutionController(
        WorkflowEngineService engineService,
        PersistencePort persistencePort,
        WorkflowDefinitionRegistry registry,
        ExecutionStreamBroadcaster broadcaster,
        @org.springframework.beans.factory.annotation.Autowired(required = false) WorkflowApprovalsController approvalsController
    ) {
        this.engineService = engineService;
        this.persistencePort = persistencePort;
        this.registry = registry;
        this.broadcaster = broadcaster;
        this.approvalsController = approvalsController;
    }

    public WorkflowExecutionController(
        WorkflowEngineService engineService,
        PersistencePort persistencePort,
        WorkflowDefinitionRegistry registry,
        ExecutionStreamBroadcaster broadcaster
    ) {
        this(engineService, persistencePort, registry, broadcaster, null);
    }

    private String resolveTenantId(String headerTenantId) {
        if (headerTenantId != null && !headerTenantId.isBlank()) return headerTenantId;
        String ctx = TenantContextHolder.getTenantId();
        return (ctx != null && !ctx.isBlank()) ? ctx : "system";
    }

    private String resolveWorkspaceId(String headerWorkspaceId) {
        return (headerWorkspaceId != null && !headerWorkspaceId.isBlank()) ? headerWorkspaceId : "default";
    }

    public record StartWorkflowRequest(
        String workflowKey,
        Map<String, Object> input,
        java.util.List<String> breakpoints
    ) {
        public StartWorkflowRequest(String workflowKey, Map<String, Object> input) {
            this(workflowKey, input, null);
        }
    }

    public record UpdateBreakpointsRequest(java.util.List<String> breakpoints) {}
    public record RerunTaskRequest(Map<String, Object> modifiedInput) {}

    @PostMapping
    public ResponseEntity<?> startExecution(
        @RequestBody StartWorkflowRequest request,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
        @RequestHeader(value = "X-Workspace-Id", required = false) String headerWorkspaceId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        String workspaceId = resolveWorkspaceId(headerWorkspaceId);

        WorkflowDefinition def = registry.get(tenantId, request.workflowKey())
            .orElse(null);

        if (def == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                "error", "Workflow definition not found",
                "workflowKey", request.workflowKey()
            ));
        }

        String executionId = "wf_exec_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        long now = System.currentTimeMillis();

        Map<String, Object> effectiveInput = new java.util.LinkedHashMap<>();
        if (request.input() != null) {
            effectiveInput.putAll(request.input());
        }
        if (request.breakpoints() != null && !request.breakpoints().isEmpty()) {
            effectiveInput.put("__breakpoints", request.breakpoints());
        }

        WorkflowSnapshot snapshot = engineService.startWorkflow(
            executionId,
            tenantId,
            workspaceId,
            def,
            effectiveInput,
            now
        );

        if (approvalsController != null) {
            approvalsController.registerEngineApprovalTask(snapshot, def);
        }

        broadcaster.broadcast(executionId, "WORKFLOW_STARTED", Map.of(
            "workflowId", executionId,
            "status", snapshot.status().name(),
            "workflowKey", def.workflowKey(),
            "timestamp", now
        ));

        return ResponseEntity.status(HttpStatus.CREATED).body(snapshot);
    }

    @GetMapping(value = "/{id}/events", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter streamExecutionEvents(
        @PathVariable("id") String id
    ) {
        return broadcaster.register(id, 120000L);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getExecution(
        @PathVariable("id") String id,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        return persistencePort.getWorkflowSnapshot(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(null));
    }

    @PostMapping("/{id}/breakpoints")
    public ResponseEntity<?> updateBreakpoints(
        @PathVariable("id") String id,
        @RequestBody UpdateBreakpointsRequest request
    ) {
        long now = System.currentTimeMillis();
        java.util.List<String> bps = request != null && request.breakpoints() != null
            ? request.breakpoints()
            : java.util.List.of();
        WorkflowSnapshot updated = engineService.updateBreakpoints(id, bps, now).orElse(null);
        if (updated == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Execution not found", "id", id));
        }
        broadcaster.broadcast(id, "BREAKPOINTS_UPDATED", Map.of(
            "workflowId", id,
            "breakpoints", bps,
            "timestamp", now
        ));
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/pause")
    public ResponseEntity<?> pauseExecution(@PathVariable("id") String id) {
        long now = System.currentTimeMillis();
        WorkflowSnapshot updated = engineService.pauseExecution(id, now).orElse(null);
        if (updated == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Execution not found", "id", id));
        }
        broadcaster.broadcast(id, "WORKFLOW_PAUSED", Map.of(
            "workflowId", id,
            "status", updated.status().name(),
            "timestamp", now
        ));
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/resume")
    public ResponseEntity<?> resumeExecution(
        @PathVariable("id") String id,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        long now = System.currentTimeMillis();
        WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(id).orElse(null);
        if (snapshot == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Execution not found", "id", id));
        }
        WorkflowDefinition def = registry.get(tenantId, snapshot.workflowKey()).orElse(null);
        if (def == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Definition not found", "key", snapshot.workflowKey()));
        }
        WorkflowSnapshot resumed = engineService.resumeExecution(id, def, now).orElse(snapshot);
        if (approvalsController != null) {
            approvalsController.registerEngineApprovalTask(resumed, def);
        }
        broadcaster.broadcast(id, "WORKFLOW_RESUMED", Map.of(
            "workflowId", id,
            "status", resumed.status().name(),
            "timestamp", now
        ));
        return ResponseEntity.ok(resumed);
    }

    @PostMapping("/{id}/step")
    public ResponseEntity<?> stepOverExecution(
        @PathVariable("id") String id,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        long now = System.currentTimeMillis();
        WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(id).orElse(null);
        if (snapshot == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Execution not found", "id", id));
        }
        WorkflowDefinition def = registry.get(tenantId, snapshot.workflowKey()).orElse(null);
        if (def == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Definition not found", "key", snapshot.workflowKey()));
        }
        WorkflowSnapshot stepped = engineService.stepOverExecution(id, def, now).orElse(snapshot);
        if (approvalsController != null) {
            approvalsController.registerEngineApprovalTask(stepped, def);
        }
        broadcaster.broadcast(id, "WORKFLOW_STEPPED", Map.of(
            "workflowId", id,
            "status", stepped.status().name(),
            "timestamp", now
        ));
        return ResponseEntity.ok(stepped);
    }

    @PostMapping("/{id}/tasks/{taskRef}/rerun")
    public ResponseEntity<?> rerunTaskFromNode(
        @PathVariable("id") String id,
        @PathVariable("taskRef") String taskRef,
        @RequestBody(required = false) RerunTaskRequest request,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        long now = System.currentTimeMillis();
        WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(id).orElse(null);
        if (snapshot == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Execution not found", "id", id));
        }
        WorkflowDefinition def = registry.get(tenantId, snapshot.workflowKey()).orElse(null);
        if (def == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Definition not found", "key", snapshot.workflowKey()));
        }
        Map<String, Object> modifiedInput = request != null && request.modifiedInput() != null
            ? request.modifiedInput()
            : Collections.emptyMap();
        WorkflowSnapshot updated = engineService.rerunTaskFromNode(id, taskRef, modifiedInput, def, now).orElse(snapshot);
        broadcaster.broadcast(id, "TASK_RERUN_SCHEDULED", Map.of(
            "workflowId", id,
            "taskReferenceName", taskRef,
            "status", updated.status().name(),
            "timestamp", now
        ));
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/terminate")
    public ResponseEntity<?> terminateExecution(
        @PathVariable("id") String id,
        @RequestBody(required = false) Map<String, Object> body
    ) {
        long now = System.currentTimeMillis();
        String reason = body != null && body.containsKey("reason") ? String.valueOf(body.get("reason")) : "Manually terminated";
        persistencePort.updateWorkflowStatus(id, WorkflowStatus.FAILED, Collections.emptyMap(), reason, now);
        
        broadcaster.broadcast(id, "WORKFLOW_TERMINATED", Map.of(
            "workflowId", id,
            "status", "FAILED",
            "reason", reason,
            "timestamp", now
        ));

        return ResponseEntity.ok(Map.of("terminated", true, "workflowId", id));
    }

    @PostMapping("/{id}/compensate")
    public ResponseEntity<?> compensateExecution(
        @PathVariable("id") String id,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        long now = System.currentTimeMillis();

        WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(id).orElse(null);
        if (snapshot == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Execution not found", "id", id));
        }

        WorkflowDefinition def = registry.get(tenantId, snapshot.workflowKey()).orElse(null);
        if (def == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Definition not found", "key", snapshot.workflowKey()));
        }

        var compensator = new com.unipost.workflow.application.SagaCompensator();
        var compCommands = compensator.planCompensation(def, snapshot, now);

        for (var compCmd : compCommands) {
            persistencePort.saveTaskExecution(
                compCmd.taskId(), id, snapshot.tenantId(), snapshot.workspaceId(),
                compCmd.referenceName(), compCmd.taskType(), compCmd.domain(),
                com.unipost.workflow.core.model.TaskStatus.SCHEDULED, compCmd.attempt(), compCmd.input(),
                Collections.emptyMap(), null, compCmd.responseTimeoutMs(), now
            );
            persistencePort.enqueueTask(
                compCmd.taskId(), id, snapshot.tenantId(), snapshot.workspaceId(),
                compCmd.taskType(), compCmd.domain(), 0, compCmd.visibleAtEpochMs()
            );
        }

        persistencePort.updateWorkflowStatus(
            id, WorkflowStatus.COMPENSATED_FAILED, snapshot.outputPayload(),
            "Manual reverse compensation triggered", now
        );

        broadcaster.broadcast(id, "WORKFLOW_COMPENSATING", Map.of(
            "workflowId", id,
            "status", "COMPENSATED_FAILED",
            "scheduledCompensations", compCommands.size(),
            "timestamp", now
        ));

        return ResponseEntity.ok(Map.of(
            "compensated", true,
            "workflowId", id,
            "scheduledCompensations", compCommands.size()
        ));
    }
}
