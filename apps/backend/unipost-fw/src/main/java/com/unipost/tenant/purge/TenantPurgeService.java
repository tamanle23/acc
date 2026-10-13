package com.unipost.tenant.purge;

import com.hazelcast.core.HazelcastInstance;
import com.hazelcast.map.IMap;
import com.unipost.boot.config.HazelcastConfiguration;
import com.unipost.domain.metadata.AttributeDefinition;
import com.unipost.domain.metadata.EntityRecord;
import com.unipost.domain.metadata.EntityRelationship;
import com.unipost.domain.metadata.EntityType;
import com.unipost.domain.metadata.RelationshipType;
import com.unipost.repository.jpa.AttributeDefinitionRepository;
import com.unipost.repository.jpa.EntityRecordRepository;
import com.unipost.repository.jpa.EntityRelationshipRepository;
import com.unipost.repository.jpa.EntityTypeRepository;
import com.unipost.repository.jpa.RelationshipTypeRepository;
import com.unipost.service.SchemaValidationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Service executing the GDPR Article 17 Right-to-be-Forgotten cryptographic hard-purge pipeline.
 * Runs in 5 distinct stages using 5,000-row micro-transactions to prevent lock escalation,
 * table locks, and memory exhaustion.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TenantPurgeService {

    private final EntityRelationshipRepository entityRelationshipRepository;
    private final EntityRecordRepository entityRecordRepository;
    private final AttributeDefinitionRepository attributeDefinitionRepository;
    private final RelationshipTypeRepository relationshipTypeRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final SchemaValidationService schemaValidationService;
    private final HazelcastInstance hazelcastInstance;
    private final PlatformTransactionManager transactionManager;
    private final TenantPurgeLockRegistry lockRegistry;

    private static final int PURGE_BATCH_SIZE = 5000;
    static final String SIGNATURE_ALGORITHM = "HmacSHA256";

    /** Sovereign authority signing key; supplied via env. A random per-process key is used when unset. */
    @Value("${unipost.compliance.erasure-signing-key:}")
    private String signingKey;

    private volatile byte[] ephemeralKey;

    /**
     * Executes the 5-stage purge pipeline for the given tenantId:
     * 1 ingress lockdown, 2 relationship + record purge (digested), 3 metadata purge,
     * 4 cache shredding, 5 signed Certificate of Erasure.
     */
    public CertificateOfErasure executeTenantPurge(String tenantId, String executedBy) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("tenantId cannot be null or empty for purge execution");
        }
        String targetTenant = tenantId.trim().toLowerCase();
        if ("system".equalsIgnoreCase(targetTenant)) {
            throw new IllegalArgumentException("SYSTEM tenant cannot be purged");
        }

        // STAGE 1: Ingress lockdown (HTTP 423 for mutations via TenantPurgeLockdownFilter)
        if (!lockRegistry.lock(targetTenant)) {
            throw new IllegalStateException("Purge already in progress for tenant '" + targetTenant + "'");
        }

        try {
            log.warn("=== INITIATING GDPR ARTICLE 17 HARD-PURGE FOR TENANT '{}' (Operator: {}) ===", targetTenant, executedBy);

            TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
            txTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

            MessageDigest idDigest = newSha256();

            // STAGE 2: Dependency graph first (edges), then JSONB records, digesting destroyed IDs
            long deletedEdges = purgeRelationshipsInBatches(targetTenant, txTemplate, idDigest);
            long deletedRecords = purgeRecordsInBatches(targetTenant, txTemplate, idDigest);

            // STAGE 3: Tenant custom metadata overlays. STRICT INVARIANT: SYSTEM rows are preserved.
            long[] metadataCounts = purgeMetadata(targetTenant, txTemplate);
            long deletedAttributes = metadataCounts[0];
            long deletedRelationshipTypes = metadataCounts[1];
            long deletedEntityTypes = metadataCounts[2];

            // STAGE 4: Distributed cache & L1 shredding
            evictDistributedCaches(targetTenant);

            // STAGE 5: Signed, tamper-evident Certificate of Erasure
            String certId = "cert_del_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            String tenantHash = computeSha256("tenant:" + targetTenant);
            String purgedAt = Instant.now().toString();
            String operator = (executedBy != null && !executedBy.isBlank()) ? executedBy : "SYSTEM_COMPLIANCE_OPERATOR";
            String recordsDigest = "sha256:" + toHex(idDigest.digest());

            String payload = String.join("|", certId, tenantHash, purgedAt,
                    String.valueOf(deletedRecords), String.valueOf(deletedEdges),
                    String.valueOf(deletedAttributes), String.valueOf(deletedEntityTypes),
                    String.valueOf(deletedRelationshipTypes), operator, recordsDigest);

            CertificateOfErasure certificate = new CertificateOfErasure(
                    certId,
                    tenantHash,
                    purgedAt,
                    deletedRecords,
                    deletedEdges,
                    deletedAttributes,
                    deletedEntityTypes,
                    deletedRelationshipTypes,
                    "PERMANENTLY_EXPUNGED",
                    operator,
                    recordsDigest,
                    SIGNATURE_ALGORITHM,
                    sign(payload)
            );

            log.warn("=== COMPLETED GDPR ARTICLE 17 HARD-PURGE FOR TENANT '{}' (Cert: {}, Records: {}, Edges: {}) ===",
                    targetTenant, certId, deletedRecords, deletedEdges);

            return certificate;
        } finally {
            lockRegistry.unlock(targetTenant);
        }
    }

    /** Verifies a certificate's signature against the canonical payload. */
    public boolean verifyCertificate(CertificateOfErasure cert) {
        if (cert == null || cert.signature() == null) {
            return false;
        }
        String payload = String.join("|", cert.certificateId(), cert.tenantIdHash(), cert.purgedAt(),
                String.valueOf(cert.recordsDeleted()), String.valueOf(cert.relationshipsDeleted()),
                String.valueOf(cert.attributesDeleted()), String.valueOf(cert.entityTypesDeleted()),
                String.valueOf(cert.relationshipTypesDeleted()), cert.executedBy(), cert.deletedRecordsDigest());
        return MessageDigest.isEqual(
                sign(payload).getBytes(StandardCharsets.UTF_8),
                cert.signature().getBytes(StandardCharsets.UTF_8));
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance(SIGNATURE_ALGORITHM);
            mac.init(new SecretKeySpec(resolveKey(), SIGNATURE_ALGORITHM));
            return toHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Unable to sign Certificate of Erasure", e);
        }
    }

    private byte[] resolveKey() {
        if (signingKey != null && !signingKey.isBlank()) {
            return signingKey.getBytes(StandardCharsets.UTF_8);
        }
        byte[] key = ephemeralKey;
        if (key == null) {
            synchronized (this) {
                if (ephemeralKey == null) {
                    byte[] generated = new byte[32];
                    new SecureRandom().nextBytes(generated);
                    ephemeralKey = generated;
                    log.warn("unipost.compliance.erasure-signing-key not set; using ephemeral per-process signing key");
                }
                key = ephemeralKey;
            }
        }
        return key;
    }

    private static MessageDigest newSha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private long purgeRelationshipsInBatches(String tenantId, TransactionTemplate txTemplate, MessageDigest idDigest) {
        long totalDeleted = 0;
        while (true) {
            final int batchSize = PURGE_BATCH_SIZE;
            Integer deletedThisBatch = txTemplate.execute(status -> {
                Page<EntityRelationship> batch = entityRelationshipRepository.findByTenantIdAndDeletedDateIsNull(
                        tenantId, PageRequest.of(0, batchSize));
                if (batch.isEmpty()) {
                    return 0;
                }
                List<EntityRelationship> content = batch.getContent();
                content.forEach(e -> idDigest.update(("edge:" + e.getId() + ";").getBytes(StandardCharsets.UTF_8)));
                entityRelationshipRepository.deleteAll(content);
                return content.size();
            });

            if (deletedThisBatch == null || deletedThisBatch == 0) {
                break;
            }
            totalDeleted += deletedThisBatch;
            log.info("Stage 1: Purged batch of {} relationships for tenant '{}' (Total so far: {})", 
                    deletedThisBatch, tenantId, totalDeleted);
        }
        return totalDeleted;
    }

    private long purgeRecordsInBatches(String tenantId, TransactionTemplate txTemplate, MessageDigest idDigest) {
        long totalDeleted = 0;
        while (true) {
            final int batchSize = PURGE_BATCH_SIZE;
            Integer deletedThisBatch = txTemplate.execute(status -> {
                Page<EntityRecord> batch = entityRecordRepository.findByTenantIdAndDeletedDateIsNull(
                        tenantId, PageRequest.of(0, batchSize));
                if (batch.isEmpty()) {
                    return 0;
                }
                List<EntityRecord> content = batch.getContent();
                content.forEach(e -> idDigest.update(("record:" + e.getId() + ";").getBytes(StandardCharsets.UTF_8)));
                entityRecordRepository.deleteAll(content);
                return content.size();
            });

            if (deletedThisBatch == null || deletedThisBatch == 0) {
                break;
            }
            totalDeleted += deletedThisBatch;
            log.info("Stage 2: Purged batch of {} entity records for tenant '{}' (Total so far: {})", 
                    deletedThisBatch, tenantId, totalDeleted);
        }
        return totalDeleted;
    }

    private long[] purgeMetadata(String tenantId, TransactionTemplate txTemplate) {
        return txTemplate.execute(status -> {
            // Delete custom attributes belonging to tenant (ignoring SYSTEM)
            List<AttributeDefinition> attrs = attributeDefinitionRepository.findByTenantIdAndDeletedDateIsNull(tenantId);
            long attrCount = attrs.size();
            attributeDefinitionRepository.deleteAll(attrs);

            // Delete custom relationship types
            List<RelationshipType> relTypes = relationshipTypeRepository.findByTenantIdAndDeletedDateIsNull(tenantId);
            long relTypeCount = relTypes.size();
            relationshipTypeRepository.deleteAll(relTypes);

            // Delete custom entity types
            List<EntityType> entityTypes = entityTypeRepository.findByTenantIdAndDeletedDateIsNull(tenantId);
            long entityTypeCount = entityTypes.size();
            entityTypeRepository.deleteAll(entityTypes);

            log.info("Stage 3: Purged tenant metadata for '{}': {} attributes, {} relTypes, {} entityTypes",
                    tenantId, attrCount, relTypeCount, entityTypeCount);

            return new long[]{attrCount, relTypeCount, entityTypeCount};
        });
    }

    private void evictDistributedCaches(String tenantId) {
        try {
            // 1. Evict L1 memory cache for tenant
            schemaValidationService.invalidateL1Cache(null, tenantId);

            // 2. Evict L2 Hazelcast cluster cache for tenant
            if (hazelcastInstance != null) {
                IMap<String, String> map = hazelcastInstance.getMap(HazelcastConfiguration.METADATA_SCHEMAS_MAP);
                if (map != null) {
                    String prefix = "schema:" + tenantId + ":";
                    Set<String> keys = map.keySet();
                    if (keys != null) {
                        for (String key : keys) {
                            if (key != null && key.startsWith(prefix)) {
                                map.remove(key);
                            }
                        }
                    }
                }
            }
            log.info("Stage 4: Evicted distributed L1 and L2 caches for tenant '{}'", tenantId);
        } catch (Exception e) {
            log.warn("Failed to evict distributed caches during tenant purge for '{}': {}", tenantId, e.getMessage());
        }
    }

    private static String computeSha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder("sha256:");
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return "sha256:unknown";
        }
    }
}
