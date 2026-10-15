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

    public WorkflowExecutionController(
        WorkflowEngineService engineService,
        PersistencePort persistencePort,
        WorkflowDefinitionRegistry registry,
        ExecutionStreamBroadcaster broadcaster
    ) {
        this.engineService = engineService;
        this.persistencePort = persistencePort;
        this.registry = registry;
        this.broadcaster = broadcaster;
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
        Map<String, Object> input
    ) {}

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

        WorkflowSnapshot snapshot = engineService.startWorkflow(
            executionId,
            tenantId,
            workspaceId,
            def,
            request.input() != null ? request.input() : Collections.emptyMap(),
            now
        );

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
