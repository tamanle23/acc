package com.acc.service;

import java.util.List;

public interface AuditMerkleService {

    record AuditVerificationResult(
            String tenantId,
            long verifiedCount,
            boolean intact,
            Long tamperedId,
            String latestHash,
            String message
    ) {}

    /**
     * Calculates the SHA-256 hash of a single audit log entry anchored to the previous hash.
     */
    String calculateHash(String prevHash, String tenantId, Long recordId, Long version, String operation, Object delta, String createdAt);

    /**
     * Stamped hash generation before persisting an audit row.
     */
    String stampAuditRow(String tenantId, Long recordId, Long version, String operation, Object delta, String createdAt);

    /**
     * Verifies cryptographic chain continuity for a tenant over an ID window or checkpoint.
     */
    AuditVerificationResult verifyTenantChain(String tenantId, Long fromId, Long toId);
}
