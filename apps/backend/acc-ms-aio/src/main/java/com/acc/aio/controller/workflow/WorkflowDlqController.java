package com.acc.aio.controller.workflow;

import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.model.TaskDlqRecord;
import com.acc.workflow.ports.PersistencePort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

/**
 * Sovereign Custodian Dead-Letter Queue (DLQ) REST Controller.
 * Protected by strict authorization: only callers with Sovereign Custodian authority
 * or platform:dlq:manage can inspect poisoned execution units, discard them, or trigger re-enqueuing.
 */
@RestController
@RequestMapping({"/api/v1/system/dlq", "/api/system/dlq", "/api/v1/workflow/dlq", "/api/workflow/dlq"})
@PreAuthorize("hasAuthority('ROLE_SYSTEM_CUSTODIAN') or hasAuthority('platform:dlq:manage')")
public class WorkflowDlqController {

    private final WorkflowEngineService engineService;
    private final PersistencePort persistencePort;

    public WorkflowDlqController(WorkflowEngineService engineService, PersistencePort persistencePort) {
        this.engineService = engineService;
        this.persistencePort = persistencePort;
    }

    private String resolveTenantId(String queryTenantId, String headerTenantId) {
        if (queryTenantId != null && !queryTenantId.isBlank() && !"ALL".equalsIgnoreCase(queryTenantId) && !"SYSTEM".equalsIgnoreCase(queryTenantId)) {
            return queryTenantId;
        }
        if (headerTenantId != null && !headerTenantId.isBlank() && !"ALL".equalsIgnoreCase(headerTenantId) && !"SYSTEM".equalsIgnoreCase(headerTenantId)) {
            return headerTenantId;
        }
        String ctx = TenantContextHolder.getTenantId();
        if (ctx != null && !ctx.isBlank() && !"SYSTEM".equalsIgnoreCase(ctx)) {
            return ctx;
        }
        return null;
    }

    @GetMapping
    public ResponseEntity<List<TaskDlqRecord>> listDlqTasks(
        @RequestParam(value = "status", required = false) String status,
        @RequestParam(value = "tenantId", required = false) String queryTenantId,
        @RequestParam(value = "limit", defaultValue = "100") int limit,
        @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId
    ) {
        String tenantId = resolveTenantId(queryTenantId, headerTenantId);
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
