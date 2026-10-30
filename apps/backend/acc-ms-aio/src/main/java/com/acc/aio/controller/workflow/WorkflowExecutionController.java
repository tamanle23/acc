package com.acc.aio.controller.workflow;

import com.acc.aio.config.WorkflowEngineConfiguration.WorkflowDefinitionRegistry;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import com.acc.workflow.ports.PersistencePort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
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
    @PreAuthorize("hasAuthority('WORKFLOW_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<?> startExecution(
        @RequestBody StartWorkflowRequest request,
        @RequestHeader(value = "X-Workspace-Id", required = false) String headerWorkspaceId
    ) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        String workspaceId = resolveWorkspaceId(headerWorkspaceId);

        WorkflowDefinition def = registry.get(tenantId, request.workflowKey())
            .orElse(null);

        if (def == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                "error", "Workflow definition not found",
                "workflowKey", request.workflowKey()
            ));
        }

        String executionId = "wf-exec-" + UUID.randomUUID().toString().substring(0, 8);
        long now = System.currentTimeMillis();

        Map<String, Object> effectiveInput = new java.util.LinkedHashMap<>();
        if (request.input() != null) {
            effectiveInput.putAll(request.input());
        }
        if (request.breakpoints() != null && !request.breakpoints().isEmpty()) {
            effectiveInput.put("__breakpoints", request.breakpoints());
        }

        WorkflowSnapshot snapshot = engineService.startWorkflow(
            executionId, tenantId, workspaceId, def, effectiveInput, now
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

    @GetMapping
    @PreAuthorize("hasAuthority('WORKFLOW_READ') or hasRole('ADMIN')")
    public ResponseEntity<?> listExecutions(
        @RequestParam(value = "status", required = false) String statusStr,
        @RequestParam(value = "workflowKey", required = false) String workflowKey,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "page", defaultValue = "1") int page,
        @RequestParam(value = "size", defaultValue = "20") int size,
        @RequestParam(value = "limit", required = false) Integer limit,
        @RequestParam(value = "afterId", required = false) String afterId
    ) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        WorkflowStatus status = null;
        if (statusStr != null && !statusStr.isBlank() && !"ALL".equalsIgnoreCase(statusStr)) {
            try {
                status = WorkflowStatus.valueOf(statusStr.toUpperCase());
            } catch (Exception ignored) {}
        }

        List<WorkflowSnapshot> list = persistencePort.listWorkflowExecutions(tenantId, workflowKey, status);
        if (search != null && !search.isBlank()) {
            String lowerSearch = search.toLowerCase();
            list = list.stream()
                .filter(w -> (w.workflowId() != null && w.workflowId().toLowerCase().contains(lowerSearch)) ||
                             (w.workflowKey() != null && w.workflowKey().toLowerCase().contains(lowerSearch)))
                .toList();
        }

        // Keyset cursor pagination if afterId is provided
        if (afterId != null && !afterId.isBlank()) {
            int effectiveLimit = limit != null ? Math.max(1, limit) : size;
            int foundIdx = -1;
            for (int i = 0; i < list.size(); i++) {
                if (list.get(i).workflowId().equals(afterId)) {
                    foundIdx = i;
                    break;
                }
            }
            int start = foundIdx >= 0 ? foundIdx + 1 : 0;
            int end = Math.min(start + effectiveLimit, list.size());
            List<WorkflowSnapshot> paged = (start < list.size()) ? list.subList(start, end) : List.of();
            boolean hasMore = end < list.size();
            String nextCursor = (!paged.isEmpty() && hasMore) ? paged.get(paged.size() - 1).workflowId() : null;
            return ResponseEntity.ok(Map.of(
                "items", paged,
                "total", list.size(),
                "limit", effectiveLimit,
                "hasMore", hasMore,
                "nextCursor", nextCursor != null ? nextCursor : ""
            ));
        }

        // Standard Page offset pagination
        int effectiveSize = limit != null ? limit : Math.max(1, size);
        int pageNumber = Math.max(1, page);
        int start = (pageNumber - 1) * effectiveSize;
        int end = Math.min(start + effectiveSize, list.size());
        List<WorkflowSnapshot> content = (start < list.size()) ? list.subList(start, end) : List.of();
        int totalPages = list.isEmpty() ? 0 : (list.size() + effectiveSize - 1) / effectiveSize;

        Map<String, Object> response = new HashMap<>();
        response.put("content", content);
        response.put("items", content);
        response.put("total", list.size());
        response.put("totalElements", (long) list.size());
        response.put("totalPages", totalPages);
        response.put("page", pageNumber);
        response.put("size", effectiveSize);
        response.put("hasMore", end < list.size());

        return ResponseEntity.ok(response);
    }

    @GetMapping(value = "/{id}/events", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("hasAuthority('WORKFLOW_READ') or hasRole('ADMIN')")
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter streamExecutionEvents(
        @PathVariable("id") String id
    ) {
        return broadcaster.register(id, 120000L);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('WORKFLOW_READ') or hasRole('ADMIN')")
    public ResponseEntity<?> getExecution(
        @PathVariable("id") String id
    ) {
        return persistencePort.getWorkflowSnapshot(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(null));
    }

    @PostMapping("/{id}/breakpoints")
    @PreAuthorize("hasAuthority('WORKFLOW_WRITE') or hasRole('ADMIN')")
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
    @PreAuthorize("hasAuthority('WORKFLOW_WRITE') or hasRole('ADMIN')")
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
    @PreAuthorize("hasAuthority('WORKFLOW_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<?> resumeExecution(
        @PathVariable("id") String id
    ) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
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
    @PreAuthorize("hasAuthority('WORKFLOW_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<?> stepOverExecution(
        @PathVariable("id") String id
    ) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
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

    @PostMapping({ "/{id}/tasks/{taskRef}/rerun", "/{id}/tasks/{taskRef}/replay" })
    @PreAuthorize("hasAuthority('WORKFLOW_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<?> rerunTaskFromNode(
        @PathVariable("id") String id,
        @PathVariable("taskRef") String taskRef,
        @RequestBody(required = false) Map<String, Object> requestBody
    ) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        long now = System.currentTimeMillis();
        WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(id).orElse(null);
        if (snapshot == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Execution not found", "id", id));
        }
        WorkflowDefinition def = registry.get(tenantId, snapshot.workflowKey()).orElse(null);
        if (def == null) {
            def = WorkflowDefinition.builder(snapshot.workflowKey()).build();
        }

        // Resolve reference name if taskId was passed
        String targetRef = taskRef;
        if (!snapshot.tasksByRef().containsKey(targetRef)) {
            var taskOpt = persistencePort.getTaskExecution(taskRef);
            if (taskOpt.isPresent()) {
                targetRef = taskOpt.get().taskReferenceName();
            }
        }

        // Extract input overrides
        Map<String, Object> overrides = new HashMap<>();
        if (requestBody != null) {
            if (requestBody.get("modifiedInput") instanceof Map<?, ?> m) {
                for (var e : m.entrySet()) overrides.put(String.valueOf(e.getKey()), e.getValue());
            } else if (requestBody.get("payloadOverrides") instanceof Map<?, ?> p) {
                for (var e : p.entrySet()) overrides.put(String.valueOf(e.getKey()), e.getValue());
            } else {
                overrides.putAll(requestBody);
            }
        }

        // Clear any associated active DLQ record
        try {
            List<com.acc.workflow.core.model.TaskDlqRecord> dlqTasks = persistencePort.listDlqTasks(tenantId, "ACTIVE", 50);
            for (var dlq : dlqTasks) {
                if (id.equals(dlq.workflowId()) && (taskRef.equals(dlq.taskId()) || targetRef.equals(dlq.taskId()))) {
                    persistencePort.updateDlqStatus(dlq.dlqId(), "REPLAYED", now);
                }
            }
        } catch (Exception ignored) {}

        WorkflowSnapshot updated = engineService.rerunTaskFromNode(id, targetRef, overrides, def, now).orElse(snapshot);
        broadcaster.broadcast(id, "TASK_RERUN_SCHEDULED", Map.of(
            "workflowId", id,
            "taskReferenceName", targetRef,
            "status", updated.status().name(),
            "timestamp", now
        ));
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/terminate")
    @PreAuthorize("hasAuthority('WORKFLOW_WRITE') or hasRole('ADMIN')")
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
    @PreAuthorize("hasAuthority('WORKFLOW_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<?> compensateExecution(
        @PathVariable("id") String id
    ) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        long now = System.currentTimeMillis();

        WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(id).orElse(null);
        if (snapshot == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Execution not found", "id", id));
        }

        WorkflowDefinition def = registry.get(tenantId, snapshot.workflowKey()).orElse(null);
        if (def == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Definition not found", "key", snapshot.workflowKey()));
        }

        var compensator = new com.acc.workflow.application.SagaCompensator();
        var compCommands = compensator.planCompensation(def, snapshot, now);

        for (var compCmd : compCommands) {
            persistencePort.saveTaskExecution(
                compCmd.taskId(), id, snapshot.tenantId(), snapshot.workspaceId(),
                compCmd.referenceName(), compCmd.taskType(), compCmd.domain(),
                com.acc.workflow.core.model.TaskStatus.SCHEDULED, compCmd.attempt(), compCmd.input(),
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
