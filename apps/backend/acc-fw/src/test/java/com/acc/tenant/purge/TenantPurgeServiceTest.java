package com.acc.tenant.purge;

import com.acc.domain.metadata.AttributeDefinition;
import com.acc.domain.metadata.EntityRecord;
import com.acc.domain.metadata.EntityRelationship;
import com.acc.domain.metadata.EntityType;
import com.acc.domain.metadata.RelationshipType;
import com.acc.repository.jpa.AttributeDefinitionRepository;
import com.acc.repository.jpa.EntityRecordRepository;
import com.acc.repository.jpa.EntityRelationshipRepository;
import com.acc.repository.jpa.EntityTypeRepository;
import com.acc.repository.jpa.RelationshipTypeRepository;
import com.acc.service.SchemaValidationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantPurgeServiceTest {

    @Mock
    private EntityRelationshipRepository entityRelationshipRepository;
    @Mock
    private EntityRecordRepository entityRecordRepository;
    @Mock
    private AttributeDefinitionRepository attributeDefinitionRepository;
    @Mock
    private RelationshipTypeRepository relationshipTypeRepository;
    @Mock
    private EntityTypeRepository entityTypeRepository;
    @Mock
    private SchemaValidationService schemaValidationService;
    @Mock
    private PlatformTransactionManager transactionManager;
    @Mock
    private TransactionStatus transactionStatus;

    private final TenantPurgeLockRegistry lockRegistry = new TenantPurgeLockRegistry();

    private TenantPurgeService purgeService;

    @BeforeEach
    void setUp() {
        lenient().when(transactionManager.getTransaction(any())).thenReturn(transactionStatus);

        purgeService = new TenantPurgeService(
                entityRelationshipRepository,
                entityRecordRepository,
                attributeDefinitionRepository,
                relationshipTypeRepository,
                entityTypeRepository,
                schemaValidationService,
                null, // hazelcastInstance
                transactionManager,
                lockRegistry
        );
    }

    @Test
    @DisplayName("Hard-purge executes all 5 stages and returns valid CertificateOfErasure")
    void testExecuteTenantPurgeSuccess() {
        String tenantId = "tenant-to-purge";

        // Mock Stage 1: Relationships (1 batch of 1 edge, then empty)
        EntityRelationship edge = new EntityRelationship();
        edge.setId(10L);
        edge.setTenantId(tenantId);

        when(entityRelationshipRepository.findByTenantIdAndDeletedDateIsNull(eq(tenantId), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(edge)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        // Mock Stage 2: Records (1 batch of 2 records, then empty)
        EntityRecord r1 = new EntityRecord();
        r1.setId(101L);
        EntityRecord r2 = new EntityRecord();
        r2.setId(102L);

        when(entityRecordRepository.findByTenantIdAndDeletedDateIsNull(eq(tenantId), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(r1, r2)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        // Mock Stage 3: Metadata
        AttributeDefinition attr = new AttributeDefinition();
        attr.setId(1L);
        when(attributeDefinitionRepository.findByTenantIdAndDeletedDateIsNull(tenantId))
                .thenReturn(List.of(attr));

        RelationshipType relType = new RelationshipType();
        relType.setId(2L);
        when(relationshipTypeRepository.findByTenantIdAndDeletedDateIsNull(tenantId))
                .thenReturn(List.of(relType));

        EntityType entityType = new EntityType();
        entityType.setId(3L);
        when(entityTypeRepository.findByTenantIdAndDeletedDateIsNull(tenantId))
                .thenReturn(List.of(entityType));

        CertificateOfErasure cert = purgeService.executeTenantPurge(tenantId, "test-operator");

        assertNotNull(cert);
        assertTrue(cert.certificateId().startsWith("cert_del_"));
        assertTrue(cert.tenantIdHash().startsWith("sha256:"));
        assertEquals("PERMANENTLY_EXPUNGED", cert.status());
        assertEquals("test-operator", cert.executedBy());
        assertEquals(2L, cert.recordsDeleted());
        assertEquals(1L, cert.relationshipsDeleted());
        assertEquals(1L, cert.attributesDeleted());
        assertEquals(1L, cert.entityTypesDeleted());
        assertEquals(1L, cert.relationshipTypesDeleted());

        // Verify delete calls
        verify(entityRelationshipRepository, times(1)).deleteAll(anyList());
        verify(entityRecordRepository, times(1)).deleteAll(anyList());
        verify(attributeDefinitionRepository, times(1)).deleteAll(anyList());
        verify(relationshipTypeRepository, times(1)).deleteAll(anyList());
        verify(entityTypeRepository, times(1)).deleteAll(anyList());
        verify(schemaValidationService, times(1)).invalidateL1Cache(null, tenantId);
    }

    @Test
    @DisplayName("SYSTEM tenant cannot be purged and throws IllegalArgumentException")
    void testSystemTenantPurgeRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> purgeService.executeTenantPurge("SYSTEM", "test-operator"));
        assertTrue(ex.getMessage().contains("SYSTEM tenant cannot be purged"));
    }

    @Test
    @DisplayName("Certificate carries deleted-ID digest and a verifiable HMAC signature; tampering is detected")
    void testCertificateSignatureAndDigest() {
        String tenantId = "tenant-sig";
        EntityRecord r1 = new EntityRecord();
        r1.setId(7L);
        when(entityRecordRepository.findByTenantIdAndDeletedDateIsNull(eq(tenantId), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(r1)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));
        when(entityRelationshipRepository.findByTenantIdAndDeletedDateIsNull(eq(tenantId), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        CertificateOfErasure cert = purgeService.executeTenantPurge(tenantId, "op");

        assertTrue(cert.deletedRecordsDigest().startsWith("sha256:"));
        assertEquals("HmacSHA256", cert.signatureAlgorithm());
        assertTrue(purgeService.verifyCertificate(cert));

        CertificateOfErasure tampered = new CertificateOfErasure(cert.certificateId(), cert.tenantIdHash(),
                cert.purgedAt(), 0L, cert.relationshipsDeleted(), cert.attributesDeleted(),
                cert.entityTypesDeleted(), cert.relationshipTypesDeleted(), cert.status(), cert.executedBy(),
                cert.deletedRecordsDigest(), cert.signatureAlgorithm(), cert.signature());
        assertFalse(purgeService.verifyCertificate(tampered));
    }

    @Test
    @DisplayName("Tenant is locked during purge and unlocked afterwards; concurrent purge is rejected")
    void testLockdownLifecycle() {
        String tenantId = "tenant-lock";
        when(entityRelationshipRepository.findByTenantIdAndDeletedDateIsNull(eq(tenantId), any(PageRequest.class)))
                .thenAnswer(inv -> {
                    assertTrue(lockRegistry.isPurging(tenantId));
                    assertThrows(IllegalStateException.class, () -> purgeService.executeTenantPurge(tenantId, "op2"));
                    return new PageImpl<>(Collections.emptyList());
                });
        when(entityRecordRepository.findByTenantIdAndDeletedDateIsNull(eq(tenantId), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        purgeService.executeTenantPurge(tenantId, "op");

        assertFalse(lockRegistry.isPurging(tenantId));
    }
}