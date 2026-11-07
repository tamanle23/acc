package com.acc.aio.controller.workflow;

import com.acc.workflow.application.AuditLedgerService;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.model.WorkflowAuditRecord;
import com.acc.workflow.ports.PersistencePort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST Controller for cryptographic workflow audit chain verification and inspection.
 * Protected by canonical NIST RBAC Level 2 workflow:execution:read authority.
 */
@RestController
@RequestMapping("/api/v1/workflow/audit")
@PreAuthorize("hasAuthority('workflow:execution:read')")
public class AuditLedgerController {

    private final AuditLedgerService auditLedgerService;
    private final PersistencePort persistencePort;
    private final WorkflowEngineService engineService;

    public AuditLedgerController(
        AuditLedgerService auditLedgerService,
        PersistencePort persistencePort,
        WorkflowEngineService engineService
    ) {
        this.auditLedgerService = auditLedgerService;
        this.persistencePort = persistencePort;
        this.engineService = engineService;
    }

    @GetMapping("/{workflowId}")
    public ResponseEntity<List<WorkflowAuditRecord>> getAuditRecords(@PathVariable("workflowId") String workflowId) {
        if (persistencePort.getWorkflowSnapshot(workflowId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(persistencePort.listAuditRecords(workflowId));
    }

    @GetMapping("/{workflowId}/verify")
    public ResponseEntity<AuditLedgerService.AuditVerificationResult> verifyAuditChain(@PathVariable("workflowId") String workflowId) {
        if (persistencePort.getWorkflowSnapshot(workflowId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        List<WorkflowAuditRecord> records = persistencePort.listAuditRecords(workflowId);
        AuditLedgerService.AuditVerificationResult result = auditLedgerService.verifyChain(records);
        if (!result.verified()) {
            // Immediately freeze and hold workflow execution
            engineService.quarantineTamperedWorkflow(workflowId, result.details());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(result);
        }
        return ResponseEntity.ok(result);
    }
}
