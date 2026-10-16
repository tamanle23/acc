package com.unipost.aio.controller.workflow;

import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.workflow.application.WorkflowEngineService;
import com.unipost.workflow.core.model.TaskDlqRecord;
import com.unipost.workflow.ports.PersistencePort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/workflow/dlq")
public class WorkflowDlqController {

    private final WorkflowEngineService engineService;
    private final PersistencePort persistencePort;

    public WorkflowDlqController(WorkflowEngineService engineService, PersistencePort persistencePort) {
        this.engineService = engineService;
        this.persistencePort = persistencePort;
    }

    private String resolveTenantId(String headerTenantId) {
        if (headerTenantId != null && !headerTenantId.isBlank()) return headerTenantId;
        String ctx = TenantContextHolder.getTenantId();
        return (ctx != null && !ctx.isBlank()) ? ctx : "system";
    }

    @GetMapping
    public ResponseEntity<List<TaskDlqRecord>> listDlqTasks(
        @RequestParam(value = "status", required = false) String status,
        @RequestParam(value = "limit", defaultValue = "100") int limit,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(headerTenantId);
        List<TaskDlqRecord> tasks = persistencePort.listDlqTasks(tenantId, status, limit);
        return ResponseEntity.ok(tasks);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskDlqRecord> getDlqTask(@PathVariable("id") String id) {
        return persistencePort.getDlqTask(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/replay")
    public ResponseEntity<TaskDlqRecord> replayDlqTask(
        @PathVariable("id") String id,
        @RequestBody(required = false) Map<String, Object> payloadOverrides
    ) {
        long now = System.currentTimeMillis();
        return engineService.replayDlqTask(id, payloadOverrides, now)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> discardDlqTask(@PathVariable("id") String id) {
        boolean discarded = engineService.discardDlqTask(id);
        if (!discarded) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}
