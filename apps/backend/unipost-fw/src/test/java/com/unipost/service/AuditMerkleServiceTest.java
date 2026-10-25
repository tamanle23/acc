package com.unipost.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.unipost.domain.metadata.RecordAuditLog;
import com.unipost.repository.jpa.RecordAuditLogRepository;
import com.unipost.service.AuditMerkleService.AuditVerificationResult;
import com.unipost.service.impl.AuditMerkleServiceImpl;

class AuditMerkleServiceTest {

  private RecordAuditLogRepository auditLogRepository;
  private ObjectMapper objectMapper;
  private AuditMerkleServiceImpl auditMerkleService;

  @BeforeEach
  void setUp() {
    auditLogRepository = mock(RecordAuditLogRepository.class);
    objectMapper = new ObjectMapper();
    auditMerkleService = new AuditMerkleServiceImpl(auditLogRepository, objectMapper);
  }

  @Test
  @DisplayName("calculateHash generates deterministic SHA-256 forward-hash string")
  void calculateHash_deterministic() {
    String hash1 = auditMerkleService.calculateHash(
        AuditMerkleServiceImpl.GENESIS_HASH,
        "tenant-acme",
        100L,
        1L,
        "CREATE",
        Map.of("name", "Test"),
        "2026-10-25T12:00:00"
    );

    String hash2 = auditMerkleService.calculateHash(
        AuditMerkleServiceImpl.GENESIS_HASH,
        "tenant-acme",
        100L,
        1L,
        "CREATE",
        Map.of("name", "Test"),
        "2026-10-25T12:00:00"
    );

    assertThat(hash1).isNotNull().hasSize(64);
    assertThat(hash1).isEqualTo(hash2);
  }

  @Test
  @DisplayName("verifyTenantChain returns intact when sequence is unperturbed")
  void verifyTenantChain_intact() {
    String genesis = AuditMerkleServiceImpl.GENESIS_HASH;
    String createdAt1 = "2026-10-25T12:00:00";
    LocalDateTime dt1 = LocalDateTime.parse(createdAt1);
    String hash1 = auditMerkleService.calculateHash(genesis, "tenant-acme", 1L, 1L, "CREATE", Map.of("v", 1), dt1.toString());

    RecordAuditLog log1 = RecordAuditLog.builder()
        .id(1L)
        .tenantId("tenant-acme")
        .recordId(1L)
        .version(1L)
        .operation("CREATE")
        .delta(Map.of("v", 1))
        .prevHash(genesis)
        .currentHash(hash1)
        .createdAt(dt1)
        .build();

    LocalDateTime dt2 = LocalDateTime.parse("2026-10-25T12:05:00");
    String hash2 = auditMerkleService.calculateHash(hash1, "tenant-acme", 1L, 2L, "UPDATE", Map.of("v", 2), dt2.toString());

    RecordAuditLog log2 = RecordAuditLog.builder()
        .id(2L)
        .tenantId("tenant-acme")
        .recordId(1L)
        .version(2L)
        .operation("UPDATE")
        .delta(Map.of("v", 2))
        .prevHash(hash1)
        .currentHash(hash2)
        .createdAt(dt2)
        .build();

    when(auditLogRepository.findByTenantIdAndIdBetweenOrderByIdAsc(eq("tenant-acme"), eq(1L), any(Long.class)))
        .thenReturn(List.of(log1, log2));

    AuditVerificationResult result = auditMerkleService.verifyTenantChain("tenant-acme", 1L, 2L);

    assertThat(result.intact()).isTrue();
    assertThat(result.verifiedCount()).isEqualTo(2);
    assertThat(result.latestHash()).isEqualTo(hash2);
    assertThat(result.tamperedId()).isNull();
  }

  @Test
  @DisplayName("verifyTenantChain detects broken chain if prev_hash does not match preceding current_hash")
  void verifyTenantChain_brokenChain() {
    String genesis = AuditMerkleServiceImpl.GENESIS_HASH;
    String createdAt1 = "2026-10-25T12:00:00";
    LocalDateTime dt1 = LocalDateTime.parse(createdAt1);
    String hash1 = auditMerkleService.calculateHash(genesis, "tenant-acme", 1L, 1L, "CREATE", Map.of("v", 1), dt1.toString());

    RecordAuditLog log1 = RecordAuditLog.builder()
        .id(1L)
        .tenantId("tenant-acme")
        .recordId(1L)
        .version(1L)
        .operation("CREATE")
        .delta(Map.of("v", 1))
        .prevHash(genesis)
        .currentHash(hash1)
        .createdAt(dt1)
        .build();

    // Fabricate log2 with invalid prev_hash
    RecordAuditLog log2 = RecordAuditLog.builder()
        .id(2L)
        .tenantId("tenant-acme")
        .recordId(1L)
        .version(2L)
        .operation("UPDATE")
        .delta(Map.of("v", 2))
        .prevHash("tampered_prev_hash_1234567890abcdef")
        .currentHash("tampered_current_hash")
        .createdAt(LocalDateTime.parse("2026-10-25T12:05:00"))
        .build();

    when(auditLogRepository.findByTenantIdAndIdBetweenOrderByIdAsc(eq("tenant-acme"), eq(1L), any(Long.class)))
        .thenReturn(List.of(log1, log2));

    AuditVerificationResult result = auditMerkleService.verifyTenantChain("tenant-acme", 1L, 2L);

    assertThat(result.intact()).isFalse();
    assertThat(result.tamperedId()).isEqualTo(2L);
    assertThat(result.message()).contains("Chain continuity broken");
  }
}
