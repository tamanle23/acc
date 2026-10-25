package com.acc.workflow.application;

import com.acc.workflow.core.model.WorkflowAuditRecord;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuditLedgerServiceTest {

    private final AuditLedgerService auditLedgerService = new AuditLedgerService();

    @Test
    @DisplayName("Should successfully verify a pristine SHA-256 hash-chained audit ledger")
    void shouldVerifyPristineHashChain() {
        String workflowId = "wf-exec-1001";
        long t0 = 1700000000000L;

        List<WorkflowAuditRecord> records = new ArrayList<>();

        // Event 1: Genesis
        String ev1 = "ev-1";
        Map<String, Object> payload1 = Map.of("orderId", "ORD-99", "amount", 500);
        String hash1 = auditLedgerService.computeHash(
            WorkflowAuditRecord.GENESIS_HASH, ev1, workflowId, "EXECUTION_STARTED", payload1, t0
        );
        records.add(new WorkflowAuditRecord(1L, ev1, workflowId, "tenant-acme", "SYSTEM", "EXECUTION_STARTED", payload1, WorkflowAuditRecord.GENESIS_HASH, hash1, t0));

        // Event 2: Task completed
        String ev2 = "ev-2";
        Map<String, Object> payload2 = Map.of("taskId", "task-1", "output", "Approved");
        long t1 = t0 + 1000L;
        String hash2 = auditLedgerService.computeHash(hash1, ev2, workflowId, "TASK_COMPLETED", payload2, t1);
        records.add(new WorkflowAuditRecord(2L, ev2, workflowId, "tenant-acme", "worker-1", "TASK_COMPLETED", payload2, hash1, hash2, t1));

        // Event 3: Hot migration
        String ev3 = "ev-3";
        Map<String, Object> payload3 = Map.of("sourceVersion", "v1", "targetVersion", "v2", "operator", "admin");
        long t2 = t1 + 1000L;
        String hash3 = auditLedgerService.computeHash(hash2, ev3, workflowId, "HOT_MIGRATION", payload3, t2);
        records.add(new WorkflowAuditRecord(3L, ev3, workflowId, "tenant-acme", "admin", "HOT_MIGRATION", payload3, hash2, hash3, t2));

        AuditLedgerService.AuditVerificationResult result = auditLedgerService.verifyChain(records);

        assertThat(result.verified()).isTrue();
        assertThat(result.totalEvents()).isEqualTo(3);
        assertThat(result.corruptedAtSequence()).isNull();
    }

    @Test
    @DisplayName("Should detect tamper when payload snapshot is altered in database")
    void shouldDetectTamperedPayload() {
        String workflowId = "wf-exec-1002";
        long t0 = 1700000000000L;

        List<WorkflowAuditRecord> records = new ArrayList<>();

        // Event 1
        String ev1 = "ev-1";
        Map<String, Object> payload1 = Map.of("amount", 100);
        String hash1 = auditLedgerService.computeHash(WorkflowAuditRecord.GENESIS_HASH, ev1, workflowId, "EXECUTION_STARTED", payload1, t0);
        records.add(new WorkflowAuditRecord(1L, ev1, workflowId, "tenant-acme", "SYSTEM", "EXECUTION_STARTED", payload1, WorkflowAuditRecord.GENESIS_HASH, hash1, t0));

        // Event 2 (Original)
        String ev2 = "ev-2";
        Map<String, Object> payload2 = Map.of("amount", 100);
        long t1 = t0 + 500L;
        String hash2 = auditLedgerService.computeHash(hash1, ev2, workflowId, "HUMAN_APPROVED", payload2, t1);

        // Tamper: Hacker changes payload from 100 to 100000 in DB directly without updating current_hash
        Map<String, Object> tamperedPayload = new HashMap<>(payload2);
        tamperedPayload.put("amount", 100000);
        records.add(new WorkflowAuditRecord(2L, ev2, workflowId, "tenant-acme", "SYSTEM", "HUMAN_APPROVED", tamperedPayload, hash1, hash2, t1));

        AuditLedgerService.AuditVerificationResult result = auditLedgerService.verifyChain(records);

        assertThat(result.verified()).isFalse();
        assertThat(result.corruptedAtSequence()).isEqualTo(2L);
        assertThat(result.details()).contains("Cryptographic mismatch at sequence 2");
    }

    @Test
    @DisplayName("Should detect broken hash link when intermediate record is deleted")
    void shouldDetectBrokenLinkOnDeletedRecord() {
        String workflowId = "wf-exec-1003";
        long t0 = 1700000000000L;

        String hash1 = auditLedgerService.computeHash(WorkflowAuditRecord.GENESIS_HASH, "ev-1", workflowId, "EXECUTION_STARTED", Map.of(), t0);
        String hash2 = auditLedgerService.computeHash(hash1, "ev-2", workflowId, "TASK_COMPLETED", Map.of(), t0 + 100);
        String hash3 = auditLedgerService.computeHash(hash2, "ev-3", workflowId, "TASK_COMPLETED", Map.of(), t0 + 200);

        // Deleted record 2: records list only contains 1 and 3
        List<WorkflowAuditRecord> records = List.of(
            new WorkflowAuditRecord(1L, "ev-1", workflowId, "system", "SYSTEM", "EXECUTION_STARTED", Map.of(), WorkflowAuditRecord.GENESIS_HASH, hash1, t0),
            new WorkflowAuditRecord(3L, "ev-3", workflowId, "system", "SYSTEM", "TASK_COMPLETED", Map.of(), hash2, hash3, t0 + 200)
        );

        AuditLedgerService.AuditVerificationResult result = auditLedgerService.verifyChain(records);

        assertThat(result.verified()).isFalse();
        assertThat(result.corruptedAtSequence()).isEqualTo(3L);
        assertThat(result.details()).contains("Broken link at sequence 3");
    }
}
