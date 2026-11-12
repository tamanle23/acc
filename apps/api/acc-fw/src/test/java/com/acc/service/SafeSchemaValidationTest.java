package com.acc.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.acc.domain.metadata.AttributeDefinition;
import com.acc.domain.metadata.EntityType;
import com.acc.repository.jpa.AttributeDefinitionRepository;
import com.acc.repository.jpa.EntityTypeRepository;
import com.acc.service.exception.MetadataConflictException;
import com.acc.service.exception.ValidationTimeoutException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SafeSchemaValidationTest {

    @Mock
    private EntityTypeRepository entityTypeRepository;
    @Mock
    private AttributeDefinitionRepository attributeDefinitionRepository;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    private SchemaValidationService schemaValidationService;
    private MetadataService metadataService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        schemaValidationService = new SchemaValidationService(
                null,
                objectMapper,
                attributeDefinitionRepository,
                entityTypeRepository,
                new SchemaCompiler(objectMapper)
        );

        metadataService = new MetadataService(
                entityTypeRepository,
                attributeDefinitionRepository,
                null,
                null,
                null,
                schemaValidationService,
                eventPublisher,
                null,
                objectMapper
        );
    }

    @Test
    @DisplayName("Catastrophic nested quantifier regex patterns must be rejected during attribute definition")
    void testDangerousRegexDetection() {
        assertTrue(MetadataService.isDangerousRegex("(a+)+"));
        assertTrue(MetadataService.isDangerousRegex("(x*)*"));
        assertTrue(MetadataService.isDangerousRegex("([a-zA-Z]+)*"));
        assertTrue(MetadataService.isDangerousRegex("(foo|bar+)+"));

        // Safe patterns
        assertFalse(MetadataService.isDangerousRegex("^[a-zA-Z0-9_-]+$"));
        assertFalse(MetadataService.isDangerousRegex("^\\d{4}-\\d{2}-\\d{2}$"));
        assertFalse(MetadataService.isDangerousRegex("^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$"));
    }

    @Test
    @DisplayName("EntityType quota check rejects when exceeding 50 models per workspace")
    void testEntityTypeQuotaHardCap() {
        when(entityTypeRepository.countByDeletedDateIsNull()).thenReturn(50L);

        com.acc.presentation.dto.metadata.CreateEntityTypeRequest request =
                new com.acc.presentation.dto.metadata.CreateEntityTypeRequest(
                        "blog_post", "Blog Post", "Post description"
                );

        MetadataConflictException ex = assertThrows(MetadataConflictException.class,
                () -> metadataService.createEntityType(request));

        assertTrue(ex.getMessage().contains("quota exceeded: Maximum of 50 EntityTypes"));
    }

    @Test
    @DisplayName("Attribute quota check rejects when exceeding 100 attributes per EntityType")
    void testAttributeQuotaHardCap() {
        EntityType entityType = new EntityType();
        entityType.setId(10L);
        entityType.setSystemName("product");

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(entityType));

        // Mock 100 existing attributes
        List<AttributeDefinition> attrs = new java.util.ArrayList<>();
        for (int i = 0; i < 100; i++) {
            AttributeDefinition ad = new AttributeDefinition();
            ad.setId((long) i);
            ad.setSystemName("field_" + i);
            attrs.add(ad);
        }
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(10L))
                .thenReturn(attrs);

        com.acc.presentation.dto.metadata.CreateAttributeRequest request =
                new com.acc.presentation.dto.metadata.CreateAttributeRequest(
                        "extra_field", "Extra Field", "string", "text", false, false, null, null
                );

        MetadataConflictException ex = assertThrows(MetadataConflictException.class,
                () -> metadataService.createAttributeDefinition(10L, request));

        assertTrue(ex.getMessage().contains("quota exceeded: Maximum of 100 attributes"));
    }

    @Test
    @DisplayName("Payload size limit check rejects payloads exceeding 1MB")
    void testPayloadSizeLimitHardCap() {
        EntityType entityType = new EntityType();
        entityType.setId(10L);
        entityType.setSystemName("large_payload_entity");

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(entityType));

        // Generate ~1.2MB string value
        StringBuilder largeSb = new StringBuilder();
        for (int i = 0; i < 120000; i++) {
            largeSb.append("0123456789");
        }

        com.acc.presentation.dto.metadata.CreateRecordRequest request =
                new com.acc.presentation.dto.metadata.CreateRecordRequest(
                        Map.of("huge_field", largeSb.toString()),
                        "tenant-test"
                );

        MetadataConflictException ex = assertThrows(MetadataConflictException.class,
                () -> metadataService.createEntityRecord(10L, request));

        assertTrue(ex.getMessage().contains("Payload size limit exceeded"));
    }
}
