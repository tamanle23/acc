package com.unipost.fw.tenancy;

import com.unipost.domain.metadata.AttributeDefinition;
import com.unipost.domain.metadata.EntityType;
import com.unipost.presentation.dto.metadata.AttributeDefinitionResponse;
import com.unipost.presentation.dto.metadata.UpdateAttributeRequest;
import com.unipost.repository.jpa.*;
import com.unipost.service.MetadataService;
import com.unipost.service.PageBuilder;
import com.unipost.service.SchemaValidationService;
import com.unipost.service.exception.MetadataConflictException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Validates SYSTEM Sovereign Custodian capabilities:
 * 1. Dual-Context principal behavior & Session Aspect SQL bindings.
 * 2. Caller-aware guards: SYSTEM can mutate canonical schemas, whereas standard tenants are blocked.
 */
@ExtendWith(MockitoExtension.class)
class SovereignCustodyAndRlsTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private EntityTypeRepository entityTypeRepository;

    @Mock
    private AttributeDefinitionRepository attributeDefinitionRepository;

    @Mock
    private EntityRecordRepository entityRecordRepository;

    @Mock
    private RelationshipTypeRepository relationshipTypeRepository;

    @Mock
    private EntityRelationshipRepository entityRelationshipRepository;

    @Mock
    private SchemaValidationService schemaValidationService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private PageBuilder pageBuilder;

    private ObjectMapper objectMapper;
    private TenantSessionAspect tenantSessionAspect;
    private MetadataService metadataService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        tenantSessionAspect = new TenantSessionAspect(jdbcTemplate);
        metadataService = new MetadataService(
                entityTypeRepository,
                attributeDefinitionRepository,
                entityRecordRepository,
                relationshipTypeRepository,
                entityRelationshipRepository,
                schemaValidationService,
                eventPublisher,
                pageBuilder,
                objectMapper
        );
        TenantContextHolder.clear();
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void testSystemActorBypassesSessionCustodianFlag() {
        // SYSTEM operating directly
        TenantContextHolder.setTenantId("SYSTEM");
        assertTrue(TenantContextHolder.isSovereignActor());
        assertFalse(TenantContextHolder.isImpersonating());

        tenantSessionAspect.setPostgresTenantSession();

        verify(jdbcTemplate).execute("SET LOCAL app.current_tenant_id = 'SYSTEM'");
        verify(jdbcTemplate).execute("SET LOCAL app.is_system_custodian = 'true'");
    }

    @Test
    void testSystemActorCanUpdateCanonicalSchema() {
        EntityType entityType = new EntityType();
        entityType.setId(10L);
        entityType.setSystemName("product");
        entityType.setTenantId("SYSTEM");
        entityType.setSchemaVersion(1L);

        AttributeDefinition canonicalAttr = new AttributeDefinition();
        canonicalAttr.setId(100L);
        canonicalAttr.setEntityType(entityType);
        canonicalAttr.setSystemName("canonical_code");
        canonicalAttr.setName("Canonical Code");
        canonicalAttr.setDataType("string");
        canonicalAttr.setUiComponent("text");
        canonicalAttr.setTenantId("SYSTEM");
        canonicalAttr.setVersion(1L);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(entityType));
        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 100L))
                .thenReturn(Optional.of(canonicalAttr));
        when(attributeDefinitionRepository.save(any(AttributeDefinition.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        UpdateAttributeRequest req = new UpdateAttributeRequest(
                "Updated Canonical Name",
                "text",
                false,
                false,
                1,
                null,
                null,
                1L
        );

        // When caller is SYSTEM
        TenantContextHolder.setTenantId("SYSTEM");
        AttributeDefinitionResponse updated = metadataService.updateAttributeDefinition(10L, 100L, req);

        assertNotNull(updated);
        assertEquals("Updated Canonical Name", updated.name());
        verify(attributeDefinitionRepository).save(canonicalAttr);
    }

    @Test
    void testStandardTenantBlockedFromMutatingCanonicalSchema() {
        EntityType entityType = new EntityType();
        entityType.setId(10L);
        entityType.setSystemName("product");
        entityType.setTenantId("SYSTEM");

        AttributeDefinition canonicalAttr = new AttributeDefinition();
        canonicalAttr.setId(100L);
        canonicalAttr.setEntityType(entityType);
        canonicalAttr.setSystemName("canonical_code");
        canonicalAttr.setName("Canonical Code");
        canonicalAttr.setDataType("string");
        canonicalAttr.setUiComponent("text");
        canonicalAttr.setTenantId("SYSTEM");

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(entityType));
        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 100L))
                .thenReturn(Optional.of(canonicalAttr));

        UpdateAttributeRequest req = new UpdateAttributeRequest(
                "Attempted Modification",
                "text",
                false,
                false,
                1,
                null,
                null,
                1L
        );

        // When caller is a standard commercial tenant
        TenantContextHolder.setTenantId("tenant-acme");

        assertThrows(MetadataConflictException.class, () -> {
            metadataService.updateAttributeDefinition(10L, 100L, req);
        });

        verify(attributeDefinitionRepository, never()).save(any());
    }

    @Test
    void testSystemActorCanDeleteCanonicalSchema() {
        EntityType entityType = new EntityType();
        entityType.setId(10L);
        entityType.setSystemName("product");
        entityType.setTenantId("SYSTEM");
        entityType.setSchemaVersion(1L);

        AttributeDefinition canonicalAttr = new AttributeDefinition();
        canonicalAttr.setId(100L);
        canonicalAttr.setEntityType(entityType);
        canonicalAttr.setSystemName("canonical_code");
        canonicalAttr.setTenantId("SYSTEM");

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(entityType));
        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 100L))
                .thenReturn(Optional.of(canonicalAttr));

        // When caller is SYSTEM
        TenantContextHolder.setTenantId("SYSTEM");
        metadataService.deleteAttributeDefinition(10L, 100L, true);

        assertNotNull(canonicalAttr.getDeletedDate());
        verify(attributeDefinitionRepository).save(canonicalAttr);
    }
}
