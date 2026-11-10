package com.acc.aio.controller.workflow;

import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.application.AuditLedgerService;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.decider.PureDecider;
import com.acc.workflow.core.model.WorkflowAuditRecord;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowExecutionStatus;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import com.acc.workflow.ports.PersistencePort;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuditLedgerControllerTest {

    private PersistencePort persistencePort;
    private PureDecider pureDecider;
    private WorkflowEngineService engineService;
    private AuditLedgerService auditLedgerService;
    private AuditLedgerController auditLedgerController;

    private static final String TENANT_ID = "tenant-audit-test";
    private static final String WORKSPACE_ID = "workspace-default";

    @BeforeEach
    void setUp() {
        TenantContextHolder.setTenantId(TENANT_ID);
        persistencePort = new InMemoryPersistenceAdapter();
        pureDecider = new PureDecider();
        engineService = new WorkflowEngineService(persistencePort, pureDecider);
        auditLedgerService = new AuditLedgerService(new com.fasterxml.jackson.databind.ObjectMapper(), persistencePort);
        auditLedgerController = new AuditLedgerController(auditLedgerService, engineService);
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    @DisplayName("Security: AuditLedgerController must be secured with workflow:execution:read authority")
    void testSecurityAnnotationAndMapping() {
        PreAuthorize preAuth = AuditLedgerController.class.getAnnotation(PreAuthorize.class);
        assertThat(preAuth).isNotNull();
        assertThat(preAuth.value()).isEqualTo("hasAuthority('workflow:execution:read')");

        RequestMapping mapping = AuditLedgerController.class.getAnnotation(RequestMapping.class);
        assertThat(mapping).isNotNull();
        assertThat(mapping.value()).contains("/api/v1/workflow/audit");
    }

    @Test
    @DisplayName("Verify returns 404 when workflow does not exist")
    void testWorkflowNotFound() {
        ResponseEntity<AuditLedgerService.AuditVerificationResult> resp =
            auditLedgerController.verifyAuditChain("non-existent-wf");
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);

        ResponseEntity<List<WorkflowAuditRecord>> listResp =
            auditLedgerController.getAuditRecords("non-existent-wf");
        assertThat(listResp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("Verify returns 200 OK when audit chain is cryptographically intact")
    void testVerifyValidAuditChain() {
        String wfId = "wf-audit-valid";
        WorkflowDefinition def = WorkflowDefinition.builder("sample-pipeline").build();
        long now = 1000L;

        persistencePort.saveWorkflowExecution(
            wfId, TENANT_ID, WORKSPACE_ID, "sample-pipeline", 1,
            WorkflowStatus.RUNNING, def, Map.of("key", "val"), Collections.emptyMap(), null, now
        );

        // Append 2 valid audit records
        long t1 = 1000L;
        String hash1 = auditLedgerService.computeHash(
            WorkflowAuditRecord.GENESIS_HASH, "evt-1", wfId, "START", Map.of("step", 1), t1
        );
        persistencePort.appendAuditRecord(new WorkflowAuditRecord(
            1L, "evt-1", wfId, TENANT_ID, "SYSTEM", "START", Map.of("step", 1),
            WorkflowAuditRecord.GENESIS_HASH, hash1, t1
        ));

        long t2 = 2000L;
        String hash2 = auditLedgerService.computeHash(
            hash1, "evt-2", wfId, "TASK_COMPLETE", Map.of("step", 2), t2
        );
        persistencePort.appendAuditRecord(new WorkflowAuditRecord(
            2L, "evt-2", wfId, TENANT_ID, "SYSTEM", "TASK_COMPLETE", Map.of("step", 2),
            hash1, hash2, t2
        ));

        ResponseEntity<AuditLedgerService.AuditVerificationResult> resp =
            auditLedgerController.verifyAuditChain(wfId);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().verified()).isTrue();
        assertThat(resp.getBody().totalEvents()).isEqualTo(2);

        // Verify records list
        ResponseEntity<List<WorkflowAuditRecord>> listResp = auditLedgerController.getAuditRecords(wfId);
        assertThat(listResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(listResp.getBody()).hasSize(2);
    }

    @Test
    @DisplayName("Verify detects tampering, transitions workflow to TAMPERED, halts execution and returns 409 CONFLICT")
    void testVerifyTamperedAuditChain() {
        String wfId = "wf-audit-tampered";
        WorkflowDefinition def = WorkflowDefinition.builder("tampered-pipeline").build();
        long now = 1000L;

        persistencePort.saveWorkflowExecution(
            wfId, TENANT_ID, WORKSPACE_ID, "tampered-pipeline", 1,
            WorkflowStatus.RUNNING, def, Map.of("key", "val"), Collections.emptyMap(), null, now
        );

        // Append 1st valid record
        long t1 = 1000L;
        String hash1 = auditLedgerService.computeHash(
            WorkflowAuditRecord.GENESIS_HASH, "evt-1", wfId, "START", Map.of("step", 1), t1
        );
        persistencePort.appendAuditRecord(new WorkflowAuditRecord(
            1L, "evt-1", wfId, TENANT_ID, "SYSTEM", "START", Map.of("step", 1),
            WorkflowAuditRecord.GENESIS_HASH, hash1, t1
        ));

        // Append 2nd TAMPERED record (hash does not match payload)
        long t2 = 2000L;
        persistencePort.appendAuditRecord(new WorkflowAuditRecord(
            2L, "evt-2", wfId, TENANT_ID, "SYSTEM", "TAMPERED_ACTION", Map.of("tampered", true),
            hash1, "bogus-sha256-hash", t2
        ));

        // Also add an active queue task to test quarantine cleanup
        persistencePort.enqueueTask("task-active-1", wfId, TENANT_ID, WORKSPACE_ID, "SIMPLE", "default", 1, 0L);

        ResponseEntity<AuditLedgerService.AuditVerificationResult> resp =
            auditLedgerController.verifyAuditChain(wfId);

        // 1. Must return 409 CONFLICT
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().verified()).isFalse();
        assertThat(resp.getBody().corruptedAtSequence()).isEqualTo(2L);
        assertThat(resp.getBody().details()).contains("Cryptographic mismatch");

        // 2. Workflow must be in TAMPERED status
        WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(wfId).orElseThrow();
        assertThat(snapshot.status()).isEqualTo(WorkflowStatus.TAMPERED);
        assertThat(snapshot.executionStatus()).isEqualTo(WorkflowExecutionStatus.TAMPERED);
        assertThat(snapshot.status().isTerminal()).isTrue();
        assertThat(snapshot.executionStatus().isTerminal()).isTrue();
        assertThat(snapshot.failureReason()).contains("Cryptographic mismatch");

        // 3. Active queue tasks must be evicted/removed from queue
        List<?> polled = persistencePort.pollTasks(TENANT_ID, "SIMPLE", "default", 10, "worker-1", 10000L, now);
        assertThat(polled).isEmpty();
    }
}
