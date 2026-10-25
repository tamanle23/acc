package com.acc.aio.controller.workflow;

import com.acc.aio.config.WorkflowEngineConfiguration.WorkflowDefinitionRegistry;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.ports.PersistencePort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/workflow/tasks")
public class TaskWorkerController {

    private final WorkflowEngineService engineService;
    private final PersistencePort persistencePort;
    private final WorkflowDefinitionRegistry registry;
    private final ExecutionStreamBroadcaster broadcaster;

    public TaskWorkerController(
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

    @GetMapping("/poll")
    public ResponseEntity<List<TaskSnapshot>> pollTasks(
        @RequestParam(value = "taskType", defaultValue = "SIMPLE") String taskType,
        @RequestParam(value = "domain", defaultValue = "default") String domain,
        @RequestParam(value = "workerId", defaultValue = "jvm-worker") String workerId,
        @RequestParam(value = "batchSize", defaultValue = "1") int batchSize,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        long now = System.currentTimeMillis();
        List<TaskSnapshot> tasks = persistencePort.pollTasks(
            tenantId,
            taskType,
            domain,
            batchSize,
            workerId,
            30000L,
            now
        );

        for (TaskSnapshot t : tasks) {
            broadcaster.broadcast(t.workflowId(), "TASK_IN_PROGRESS", Map.of(
                "workflowId", t.workflowId(),
                "taskId", t.taskId(),
                "taskReferenceName", t.taskReferenceName(),
                "taskType", t.taskType(),
                "status", "IN_PROGRESS",
                "workerId", workerId,
                "timestamp", now
            ));
        }

        return ResponseEntity.ok(tasks);
    }

    public record TaskResultRequest(
        boolean completed,
        Map<String, Object> output,
        String error,
        long callbackAfterSeconds
    ) {}

    @PostMapping("/{id}/result")
    public ResponseEntity<?> reportResult(
        @PathVariable("id") String taskId,
        @RequestBody TaskResultRequest request,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        long now = System.currentTimeMillis();

        TaskSnapshot task = persistencePort.getTaskExecution(taskId)
            .orElse(null);

        if (task == null) {
            return ResponseEntity.notFound().build();
        }

        WorkflowSnapshot wfSnapshot = persistencePort.getWorkflowSnapshot(task.workflowId())
            .orElse(null);

        if (wfSnapshot == null) {
            return ResponseEntity.notFound().build();
        }

        WorkflowDefinition def = registry.get(tenantId, wfSnapshot.workflowKey())
            .orElse(null);

        if (def == null) {
            // Build minimal placeholder definition if dynamic
            def = WorkflowDefinition.builder(wfSnapshot.workflowKey()).build();
        }

        engineService.reportTaskResult(
            task.workflowId(),
            taskId,
            "worker",
            request.completed(),
            request.output() != null ? request.output() : Collections.emptyMap(),
            request.error(),
            request.callbackAfterSeconds(),
            def,
            now
        );

        String eventStatus = request.completed() ? "TASK_COMPLETED" : "TASK_FAILED";
        broadcaster.broadcast(task.workflowId(), eventStatus, Map.of(
            "workflowId", task.workflowId(),
            "taskId", taskId,
            "taskReferenceName", task.taskReferenceName(),
            "status", request.completed() ? "COMPLETED" : "FAILED",
            "output", request.output() != null ? request.output() : Collections.emptyMap(),
            "error", request.error() != null ? request.error() : "",
            "timestamp", now
        ));

        // Check if workflow completed
        persistencePort.getWorkflowSnapshot(task.workflowId()).ifPresent(updatedWf -> {
            if (updatedWf.status().isTerminal()) {
                broadcaster.broadcast(task.workflowId(), "WORKFLOW_" + updatedWf.status().name(), Map.of(
                    "workflowId", task.workflowId(),
                    "status", updatedWf.status().name(),
                    "timestamp", System.currentTimeMillis()
                ));
            }
        });

        return ResponseEntity.ok(Map.of("acknowledged", true, "taskId", taskId));
    }

    @PostMapping("/{id}/heartbeat")
    public ResponseEntity<?> heartbeat(
        @PathVariable("id") String taskId,
        @RequestBody(required = false) Map<String, Object> body
    ) {
        String workerId = body != null && body.containsKey("workerId") ? String.valueOf(body.get("workerId")) : "worker";
        long newVisibleAt = System.currentTimeMillis() + 30000L;
        boolean renewed = persistencePort.renewLease(taskId, workerId, newVisibleAt);
        return ResponseEntity.ok(Map.of("renewed", renewed, "taskId", taskId));
    }

    public record TaskLogRequest(
        String level,
        String message,
        Object raw
    ) {}

    @PostMapping("/{id}/log")
    public ResponseEntity<?> appendTaskLog(
        @PathVariable("id") String taskId,
        @RequestBody TaskLogRequest request
    ) {
        TaskSnapshot task = persistencePort.getTaskExecution(taskId).orElse(null);
        if (task == null) {
            return ResponseEntity.notFound().build();
        }

        broadcaster.broadcastTaskLog(
            task.workflowId(),
            taskId,
            task.taskReferenceName(),
            request != null && request.level() != null ? request.level() : "INFO",
            request != null && request.message() != null ? request.message() : "",
            request != null ? request.raw() : null
        );

        return ResponseEntity.ok(Map.of("logged", true, "taskId", taskId));
    }

    @PostMapping("/{id}/claim")
    public ResponseEntity<?> claimTask(
        @PathVariable("id") String taskId,
        @RequestBody(required = false) Map<String, Object> body,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        TaskSnapshot task = persistencePort.getTaskExecution(taskId).orElse(null);
        if (task == null) {
            return ResponseEntity.notFound().build();
        }
        String principal = body != null && body.containsKey("userId") ? String.valueOf(body.get("userId")) : "operator";
        long now = System.currentTimeMillis();
        Map<String, Object> output = new java.util.HashMap<>(task.outputData());
        output.put("claimedBy", principal);
        output.put("claimedAt", now);

        persistencePort.updateTaskExecution(taskId, task.status(), output, null, now);
        broadcaster.broadcast(task.workflowId(), "TASK_CLAIMED", Map.of(
            "workflowId", task.workflowId(),
            "taskId", taskId,
            "taskReferenceName", task.taskReferenceName(),
            "claimedBy", principal,
            "claimedAt", now,
            "timestamp", now
        ));

        return ResponseEntity.ok(Map.of("claimed", true, "taskId", taskId, "claimedBy", principal));
    }

    @PostMapping("/{id}/unclaim")
    public ResponseEntity<?> unclaimTask(
        @PathVariable("id") String taskId,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        TaskSnapshot task = persistencePort.getTaskExecution(taskId).orElse(null);
        if (task == null) {
            return ResponseEntity.notFound().build();
        }
        long now = System.currentTimeMillis();
        Map<String, Object> output = new java.util.HashMap<>(task.outputData());
        output.remove("claimedBy");
        output.remove("claimedAt");

        persistencePort.updateTaskExecution(taskId, task.status(), output, null, now);
        broadcaster.broadcast(task.workflowId(), "TASK_UNCLAIMED", Map.of(
            "workflowId", task.workflowId(),
            "taskId", taskId,
            "taskReferenceName", task.taskReferenceName(),
            "timestamp", now
        ));

        return ResponseEntity.ok(Map.of("unclaimed", true, "taskId", taskId));
    }

    public record HumanTaskResolutionRequest(
        String action, // "APPROVE" | "REJECT"
        String comment,
        Map<String, Object> formData
    ) {}

    @PostMapping("/{id}/resolve")
    public ResponseEntity<?> resolveTask(
        @PathVariable("id") String taskId,
        @RequestBody HumanTaskResolutionRequest request,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        long now = System.currentTimeMillis();

        TaskSnapshot task = persistencePort.getTaskExecution(taskId).orElse(null);
        if (task == null) {
            return ResponseEntity.notFound().build();
        }

        WorkflowSnapshot wfSnapshot = persistencePort.getWorkflowSnapshot(task.workflowId()).orElse(null);
        if (wfSnapshot == null) {
            return ResponseEntity.notFound().build();
        }

        WorkflowDefinition def = registry.get(tenantId, wfSnapshot.workflowKey())
            .orElseGet(() -> WorkflowDefinition.builder(wfSnapshot.workflowKey()).build());

        boolean isApproved = "APPROVE".equalsIgnoreCase(request.action());
        Map<String, Object> resolvedOutput = new java.util.HashMap<>(task.outputData());
        resolvedOutput.put("decision", isApproved ? "APPROVED" : "REJECTED");
        if (request.comment() != null) {
            resolvedOutput.put("decisionComment", request.comment());
        }
        if (request.formData() != null) {
            resolvedOutput.putAll(request.formData());
        }

        engineService.reportTaskResult(
            task.workflowId(),
            taskId,
            "human-reviewer",
            isApproved,
            resolvedOutput,
            isApproved ? null : (request.comment() != null ? request.comment() : "Rejected by human reviewer"),
            0,
            def,
            now
        );

        String eventStatus = isApproved ? "TASK_COMPLETED" : "TASK_FAILED";
        broadcaster.broadcast(task.workflowId(), eventStatus, Map.of(
            "workflowId", task.workflowId(),
            "taskId", taskId,
            "taskReferenceName", task.taskReferenceName(),
            "status", isApproved ? "COMPLETED" : "FAILED",
            "decision", isApproved ? "APPROVED" : "REJECTED",
            "output", resolvedOutput,
            "timestamp", now
        ));

        persistencePort.getWorkflowSnapshot(task.workflowId()).ifPresent(updatedWf -> {
            if (updatedWf.status().isTerminal()) {
                broadcaster.broadcast(task.workflowId(), "WORKFLOW_" + updatedWf.status().name(), Map.of(
                    "workflowId", task.workflowId(),
                    "status", updatedWf.status().name(),
                    "timestamp", System.currentTimeMillis()
                ));
            }
        });

        return ResponseEntity.ok(Map.of("resolved", true, "taskId", taskId, "action", request.action()));
    }
}
