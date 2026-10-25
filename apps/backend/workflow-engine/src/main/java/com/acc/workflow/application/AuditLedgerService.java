package com.acc.workflow.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.workflow.core.model.WorkflowAuditRecord;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Service responsible for computing cryptographic SHA-256 hashes and verifying
 * the tamper-evident chain of workflow audit records.
 */
public class AuditLedgerService {

    private final ObjectMapper objectMapper;

    public AuditLedgerService() {
        this(new ObjectMapper());
    }

    public AuditLedgerService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String computeHash(
        String prevHash,
        String eventId,
        String workflowId,
        String action,
        Map<String, Object> payloadSnapshot,
        long createdAtMs
    ) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String payloadJson = payloadSnapshot != null ? objectMapper.writeValueAsString(payloadSnapshot) : "{}";
            String rawString = String.join(":",
                prevHash != null ? prevHash : WorkflowAuditRecord.GENESIS_HASH,
                eventId,
                workflowId,
                action,
                payloadJson,
                String.valueOf(createdAtMs)
            );

            byte[] hashBytes = digest.digest(rawString.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException | JsonProcessingException e) {
            throw new RuntimeException("Failed to compute SHA-256 hash for audit record", e);
        }
    }

    public AuditVerificationResult verifyChain(List<WorkflowAuditRecord> records) {
        if (records == null || records.isEmpty()) {
            return new AuditVerificationResult(true, 0, null, "No audit records found for workflow");
        }

        String expectedPrevHash = WorkflowAuditRecord.GENESIS_HASH;

        for (int i = 0; i < records.size(); i++) {
            WorkflowAuditRecord record = records.get(i);

            // 1. Verify prevHash links to previous record's currentHash
            if (!expectedPrevHash.equalsIgnoreCase(record.prevHash())) {
                return new AuditVerificationResult(
                    false,
                    records.size(),
                    record.sequenceNum(),
                    "Broken link at sequence " + record.sequenceNum() + ": expected prevHash " + expectedPrevHash + " but found " + record.prevHash()
                );
            }

            // 2. Recompute currentHash
            String recomputedHash = computeHash(
                record.prevHash(),
                record.eventId(),
                record.workflowId(),
                record.action(),
                record.payloadSnapshot(),
                record.createdAtMs()
            );

            if (!recomputedHash.equalsIgnoreCase(record.currentHash())) {
                return new AuditVerificationResult(
                    false,
                    records.size(),
                    record.sequenceNum(),
                    "Cryptographic mismatch at sequence " + record.sequenceNum() + ": payload or metadata was tampered"
                );
            }

            expectedPrevHash = record.currentHash();
        }

        return new AuditVerificationResult(true, records.size(), null, "Chain cryptographically intact (" + records.size() + " events verified)");
    }

    public record AuditVerificationResult(
        boolean verified,
        int totalEvents,
        Long corruptedAtSequence,
        String details
    ) {}
}
