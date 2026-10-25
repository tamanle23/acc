package com.unipost.service.impl;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.unipost.domain.metadata.RecordAuditLog;
import com.unipost.repository.jpa.RecordAuditLogRepository;
import com.unipost.service.AuditMerkleService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditMerkleServiceImpl implements AuditMerkleService {

    public static final String GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    private final RecordAuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @Override
    public String calculateHash(String prevHash, String tenantId, Long recordId, Long version, String operation, Object delta, String createdAt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String deltaStr = delta != null ? objectMapper.writeValueAsString(delta) : "{}";
            String raw = String.join(":",
                    prevHash != null ? prevHash : GENESIS_HASH,
                    tenantId != null ? tenantId : "SYSTEM",
                    String.valueOf(recordId),
                    String.valueOf(version),
                    operation != null ? operation : "UNKNOWN",
                    deltaStr,
                    createdAt != null ? createdAt : ""
            );
            byte[] hashBytes = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException | com.fasterxml.jackson.core.JsonProcessingException e) {
            log.error("Failed to compute SHA-256 forward hash", e);
            throw new IllegalStateException("Cryptographic hash calculation failure", e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public String stampAuditRow(String tenantId, Long recordId, Long version, String operation, Object delta, String createdAt) {
        Optional<RecordAuditLog> lastLog = auditLogRepository.findTopByTenantIdOrderByIdDesc(tenantId);
        String prevHash = lastLog.map(RecordAuditLog::getCurrentHash).orElse(GENESIS_HASH);
        return calculateHash(prevHash, tenantId, recordId, version, operation, delta, createdAt);
    }

    @Override
    @Transactional(readOnly = true)
    public AuditVerificationResult verifyTenantChain(String tenantId, Long fromId, Long toId) {
        String effectiveTenant = (tenantId == null || tenantId.isBlank()) ? "SYSTEM" : tenantId;
        
        long start = fromId != null ? fromId : 1L;
        long end = toId != null ? toId : Long.MAX_VALUE;

        List<RecordAuditLog> logs = auditLogRepository.findByTenantIdAndIdBetweenOrderByIdAsc(effectiveTenant, start, end);
        if (logs.isEmpty()) {
            return new AuditVerificationResult(effectiveTenant, 0, true, null, GENESIS_HASH, "Empty audit chain (Zero mutations)");
        }

        String expectedPrevHash = logs.get(0).getPrevHash();
        if (expectedPrevHash == null && logs.get(0).getId() == 1L) {
            expectedPrevHash = GENESIS_HASH;
        }

        long count = 0;
        String latestHash = GENESIS_HASH;

        for (RecordAuditLog logEntry : logs) {
            count++;
            String actualPrev = logEntry.getPrevHash() != null ? logEntry.getPrevHash() : GENESIS_HASH;
            
            // Check prev_hash continuity
            if (expectedPrevHash != null && !expectedPrevHash.equals(actualPrev)) {
                log.warn("Cryptographic chain broken at record id {}: expected prevHash {}, found {}",
                        logEntry.getId(), expectedPrevHash, actualPrev);
                return new AuditVerificationResult(
                        effectiveTenant,
                        count,
                        false,
                        logEntry.getId(),
                        actualPrev,
                        "Chain continuity broken: previous hash mismatch at block #" + logEntry.getId()
                );
            }

            // Verify current hash math
            String recomputedHash = calculateHash(
                    actualPrev,
                    logEntry.getTenantId(),
                    logEntry.getRecordId(),
                    logEntry.getVersion(),
                    logEntry.getOperation(),
                    logEntry.getDelta(),
                    logEntry.getCreatedAt() != null ? logEntry.getCreatedAt().toString() : ""
            );

            if (logEntry.getCurrentHash() != null && !logEntry.getCurrentHash().equals(recomputedHash)) {
                log.warn("Audit record tampering detected at record id {}: stored hash {}, recomputed {}",
                        logEntry.getId(), logEntry.getCurrentHash(), recomputedHash);
                return new AuditVerificationResult(
                        effectiveTenant,
                        count,
                        false,
                        logEntry.getId(),
                        logEntry.getCurrentHash(),
                        "Mathematical tampering detected: record signature altered at block #" + logEntry.getId()
                );
            }

            expectedPrevHash = logEntry.getCurrentHash();
            latestHash = logEntry.getCurrentHash() != null ? logEntry.getCurrentHash() : recomputedHash;
        }

        return new AuditVerificationResult(
                effectiveTenant,
                count,
                true,
                null,
                latestHash,
                "Cryptographic forward-hash chain 100% intact across " + count + " verified blocks"
        );
    }
}
