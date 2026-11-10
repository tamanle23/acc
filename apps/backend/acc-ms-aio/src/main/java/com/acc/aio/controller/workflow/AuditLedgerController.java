package com.acc.aio.controller.workflow;

import com.acc.workflow.application.AuditLedgerService;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.model.WorkflowAuditRecord;
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
    private final WorkflowEngineService engineService;

    public AuditLedgerController(
        AuditLedgerService auditLedgerService,
        WorkflowEngineService engineService
    ) {
        this.auditLedgerService = auditLedgerService;
        this.engineService = engineService;
    }

    @GetMapping("/{workflowId}")
    public ResponseEntity<List<WorkflowAuditRecord>> getAuditRecords(@PathVariable("workflowId") String workflowId) {
        List<WorkflowAuditRecord> records = auditLedgerService.getAuditRecords(workflowId);
        if (records.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(records);
    }

    @GetMapping("/{workflowId}/verify")
    public ResponseEntity<AuditLedgerService.AuditVerificationResult> verifyAuditChain(@PathVariable("workflowId") String workflowId) {
        AuditLedgerService.AuditVerificationResult result = auditLedgerService.verifyAuditChainForWorkflow(workflowId);
        if (!result.verified()) {
            if ("Workflow not found: " + workflowId).equals(result.details())) {
                return ResponseEntity.notFound().build();
            }
            // Immediately freeze and hold workflow execution
            engineService.quarantineTamperedWorkflow(workflowId, result.details());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(result);
        }
        return ResponseEntity.ok(result);
    }
}
