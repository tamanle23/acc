package com.acc.tenant.purge;

/**
 * Immutable audit receipt generated upon completion of a GDPR Article 17 hard-purge.
 * Contains no PII: only a tenant hash, deletion counts, a SHA-256 digest over the destroyed
 * record identifiers, and an HMAC-SHA256 signature making the receipt tamper-evident.
 */
public record CertificateOfErasure(
        String certificateId,
        String tenantIdHash,
        String purgedAt,
        long recordsDeleted,
        long relationshipsDeleted,
        long attributesDeleted,
        long entityTypesDeleted,
        long relationshipTypesDeleted,
        String status,
        String executedBy,
        String deletedRecordsDigest,
        String signatureAlgorithm,
        String signature
) {}
