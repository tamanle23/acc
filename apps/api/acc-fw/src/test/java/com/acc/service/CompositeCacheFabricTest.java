package com.acc.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hazelcast.core.HazelcastInstance;
import com.hazelcast.map.IMap;
import com.acc.boot.config.HazelcastConfiguration;
import com.acc.domain.metadata.AttributeDefinition;
import com.acc.domain.metadata.AttributeDefinitionUpdatedEvent;
import com.acc.domain.metadata.EntityType;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.presentation.dto.metadata.CreateAttributeRequest;
import com.acc.presentation.dto.metadata.UpdateAttributeRequest;
import com.acc.repository.jpa.AttributeDefinitionRepository;
import com.acc.repository.jpa.EntityRecordRepository;
import com.acc.repository.jpa.EntityTypeRepository;
import com.acc.service.exception.MetadataConflictException;
import com.acc.service.exception.SchemaValidationException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CompositeCacheFabricTest {

    @Mock
    private HazelcastInstance hazelcastInstance;

    @Mock
    private IMap<String, String> schemaMap;

    @Mock
    private AttributeDefinitionRepository attributeDefinitionRepository;

    @Mock
    private EntityTypeRepository entityTypeRepository;

    @Mock
    private EntityRecordRepository entityRecordRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @Spy
    private SchemaCompiler schemaCompiler = new SchemaCompiler(new ObjectMapper());

    @InjectMocks
    private SchemaValidationService schemaValidationService;

    private EntityType entityType;

    @BeforeEach
    void setUp() {
        lenient().when(hazelcastInstance.<String, String>getMap(HazelcastConfiguration.METADATA_SCHEMAS_MAP))
                .thenReturn(schemaMap);

        entityType = new EntityType();
        entityType.setId(100L);
        entityType.setName("Customer");
        entityType.setSchemaVersion(2L);
        entityType.setTenantId("tenant-alpha");

        lenient().when(entityTypeRepository.findByIdAndDeletedDateIsNull(100L)).thenReturn(Optional.of(entityType));
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    @DisplayName("Should compose base SYSTEM attributes and tenant-specific overlay attributes into single schema")
    void testEffectiveSchemaComposition() {
        TenantContextHolder.setTenantId("tenant-alpha");

        // Base SYSTEM attribute
        AttributeDefinition sysAttr = new AttributeDefinition();
        sysAttr.setId(1L);
        sysAttr.setSystemName("code");
        sysAttr.setName("Customer Code");
        sysAttr.setDataType("string");
        sysAttr.setUiComponent("text");
        sysAttr.setIsRequired(true);
        sysAttr.setTenantId("SYSTEM");
        sysAttr.setEntityType(entityType);
        sysAttr.setDisplayOrder(1);

        // Tenant custom attribute
        AttributeDefinition tenantAttr = new AttributeDefinition();
        tenantAttr.setId(2L);
        tenantAttr.setSystemName("loyaltyTier");
        tenantAttr.setName("Loyalty Tier");
        tenantAttr.setDataType("string");
        tenantAttr.setUiComponent("text");
        tenantAttr.setIsRequired(false);
        tenantAttr.setTenantId("tenant-alpha");
        tenantAttr.setEntityType(entityType);
        tenantAttr.setDisplayOrder(2);

        List<AttributeDefinition> allAttrs = new ArrayList<>();
        allAttrs.add(sysAttr);
        allAttrs.add(tenantAttr);

        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(100L))
                .thenReturn(allAttrs);

        // Valid payload containing both attributes
        Map<String, Object> payload = new HashMap<>();
        payload.put("code", "CUST-001");
        payload.put("loyaltyTier", "GOLD");

        assertDoesNotThrow(() -> schemaValidationService.validatePayload(100L, payload));

        // Missing required SYSTEM attribute should fail
        Map<String, Object> invalidPayload = new HashMap<>();
        invalidPayload.put("loyaltyTier", "GOLD");

        assertThrows(SchemaValidationException.class, () -> schemaValidationService.validatePayload(100L, invalidPayload));

        // Verify cache key format contains tenant-alpha and dual versions v2_s1
        verify(schemaMap).putIfAbsent(eq("schema:tenant-alpha:100:v2_s1"), anyString(), eq(1L), eq(TimeUnit.HOURS));
    }

    @Test
    @DisplayName("Cache invalidation for Tenant Alpha should NOT evict Tenant Beta's cache")
    void testTenantCacheIsolationOnInvalidation() {
        MetadataCacheListener listener = new MetadataCacheListener(hazelcastInstance, schemaValidationService);

        String alphaKey = "schema:tenant-alpha:100:v2_s1";
        String betaKey = "schema:tenant-beta:100:v1_s1";
        when(schemaMap.keySet()).thenReturn(Set.of(alphaKey, betaKey));

        // Invalidate Tenant Alpha
        AttributeDefinitionUpdatedEvent alphaEvent = new AttributeDefinitionUpdatedEvent(this, 100L, "tenant-alpha");
        listener.handleAttributeDefinitionUpdate(alphaEvent);

        // Verify Hazelcast removal targeted only tenant-alpha
        verify(schemaMap).remove(alphaKey);
        verify(schemaMap, never()).remove(betaKey);
        verify(schemaMap, never()).clear();
    }

    @Test
    @DisplayName("Tenant custom attributes must NOT collide with base SYSTEM attributes")
    void testSystemAttributeCollisionCheck() {
        TenantContextHolder.setTenantId("tenant-alpha");

        AttributeDefinition existingSysAttr = new AttributeDefinition();
        existingSysAttr.setId(10L);
        existingSysAttr.setSystemName("taxId");
        existingSysAttr.setTenantId("SYSTEM");

        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(100L))
                .thenReturn(List.of(existingSysAttr));

        MetadataService metadataService = new MetadataService(
                entityTypeRepository,
                attributeDefinitionRepository,
                entityRecordRepository,
                null,
                null,
                schemaValidationService,
                eventPublisher,
                null,
                new com.fasterxml.jackson.databind.ObjectMapper()
        );

        CreateAttributeRequest newAttrRequest = new CreateAttributeRequest(
                "taxId",
                "Tax ID",
                "string",
                "text",
                false,
                false,
                null,
                null
        );

        MetadataConflictException ex = assertThrows(MetadataConflictException.class,
                () -> metadataService.createAttributeDefinition(100L, newAttrRequest));

        assertTrue(ex.getMessage().contains("already exists for EntityType 100"));
    }

    @Test
    @DisplayName("SYSTEM attributes must be strictly immutable against update, delete, and archive operations")
    void testSystemAttributeImmutability() {
        TenantContextHolder.setTenantId("tenant-alpha");

        AttributeDefinition sysAttr = new AttributeDefinition();
        sysAttr.setId(99L);
        sysAttr.setSystemName("systemCode");
        sysAttr.setTenantId("SYSTEM");

        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(100L, 99L))
                .thenReturn(Optional.of(sysAttr));

        MetadataService metadataService = new MetadataService(
                entityTypeRepository,
                attributeDefinitionRepository,
                entityRecordRepository,
                null,
                null,
                schemaValidationService,
                eventPublisher,
                null,
                new com.fasterxml.jackson.databind.ObjectMapper()
        );

        // Attempt update
        UpdateAttributeRequest updateDto = new UpdateAttributeRequest(
                "Hacked Name",
                "text",
                false,
                false,
                1,
                null,
                null,
                null
        );
        MetadataConflictException updateEx = assertThrows(MetadataConflictException.class,
                () -> metadataService.updateAttributeDefinition(100L, 99L, updateDto));
        assertTrue(updateEx.getMessage().contains("immutable"));

        // Attempt delete
        MetadataConflictException deleteEx = assertThrows(MetadataConflictException.class,
                () -> metadataService.deleteAttributeDefinition(100L, 99L, false));
        assertTrue(deleteEx.getMessage().contains("immutable"));

        // Attempt archive
        MetadataConflictException archiveEx = assertThrows(MetadataConflictException.class,
                () -> metadataService.archiveAttributeDefinition(100L, 99L));
        assertTrue(archiveEx.getMessage().contains("immutable"));
    }
}
