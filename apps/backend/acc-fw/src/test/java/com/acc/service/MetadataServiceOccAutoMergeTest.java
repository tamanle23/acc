package com.acc.service;

import com.acc.domain.metadata.EntityRecord;
import com.acc.domain.metadata.EntityType;
import com.acc.presentation.dto.metadata.EntityRecordResponse;
import com.acc.presentation.dto.metadata.PatchRecordRequest;
import com.acc.presentation.dto.metadata.UpdateRecordRequest;
import com.acc.repository.jpa.AttributeDefinitionRepository;
import com.acc.repository.jpa.EntityRecordRepository;
import com.acc.repository.jpa.EntityTypeRepository;
import com.acc.service.exception.MetadataConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MetadataServiceOccAutoMergeTest {

    @Mock
    private EntityTypeRepository entityTypeRepository;
    @Mock
    private AttributeDefinitionRepository attributeDefinitionRepository;
    @Mock
    private EntityRecordRepository entityRecordRepository;
    @Mock
    private SchemaValidationService schemaValidationService;
    @Mock
    private ApplicationEventPublisher eventPublisher;
    @Mock
    private PageBuilder pageBuilder;

    private MetadataService metadataService;

    private EntityType entityType;
    private EntityRecord existingRecord;

    @BeforeEach
    void setUp() {
        metadataService = new MetadataService(
                entityTypeRepository,
                attributeDefinitionRepository,
                entityRecordRepository,
                null,
                null,
                schemaValidationService,
                eventPublisher,
                pageBuilder,
                new com.fasterxml.jackson.databind.ObjectMapper()
        );

        entityType = new EntityType();
        entityType.setId(1L);
        entityType.setSystemName("article");
        entityType.setSchemaVersion(1L);

        existingRecord = new EntityRecord();
        existingRecord.setId(100L);
        existingRecord.setEntityType(entityType);
        existingRecord.setVersion(2L); // Persisted version is 2
        existingRecord.setTenantId("tenant-alpha");
        existingRecord.setAttributes(new HashMap<>(Map.of(
                "title", "Server Title (Version 2)",
                "category", "tech",
                "content", "Original Content"
        )));
    }

    @Test
    void testAutoMergeAttributes_MergesDisjointEditsSuccessfully() {
        Map<String, Object> base = Map.of(
                "title", "Original Title",
                "category", "general",
                "content", "Original Content"
        );
        Map<String, Object> currentDb = Map.of(
                "title", "Server Title (Version 2)", // Server edited title
                "category", "general",
                "content", "Original Content"
        );
        Map<String, Object> incoming = Map.of(
                "title", "Original Title",
                "category", "tech",               // Client edited category
                "content", "Client Added Content" // Client edited content
        );

        Map<String, Object> merged = metadataService.autoMergeAttributes(base, currentDb, incoming);

        // Server's title was preserved
        assertEquals("Server Title (Version 2)", merged.get("title"));
        // Client's category and content were merged
        assertEquals("tech", merged.get("category"));
        assertEquals("Client Added Content", merged.get("content"));
    }

    @Test
    void testAutoMergeAttributes_ThrowsConflictOnSameFieldCollision() {
        Map<String, Object> base = Map.of("title", "Base Title");
        Map<String, Object> currentDb = Map.of("title", "Server Updated Title");
        Map<String, Object> incoming = Map.of("title", "Client Updated Title");

        assertThrows(MetadataConflictException.class, () -> {
            metadataService.autoMergeAttributes(base, currentDb, incoming);
        });
    }

    @Test
    void testUpdateEntityRecord_AutoMergesWhenVersionMismatchHasBaseAttributes() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(entityType));
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(1L, 100L)).thenReturn(Optional.of(existingRecord));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(1L)).thenReturn(Collections.emptyList());
        when(entityRecordRepository.save(any(EntityRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        // Client read record at version 1
        Map<String, Object> baseAttributes = Map.of(
                "title", "Original Title",
                "category", "general"
        );
        // Client edited category to 'tech', leaving title as 'Original Title'
        Map<String, Object> clientEdits = Map.of(
                "title", "Original Title",
                "category", "tech"
        );

        UpdateRecordRequest request = new UpdateRecordRequest(clientEdits, 1L, baseAttributes);

        EntityRecordResponse response = metadataService.updateEntityRecord(1L, 100L, request);

        assertNotNull(response);
        // Server title was kept, client category was applied
        assertEquals("Server Title (Version 2)", response.attributes().get("title"));
        assertEquals("tech", response.attributes().get("category"));
    }

    @Test
    void testUpdateEntityRecord_ThrowsConflictWhenVersionMismatchWithoutBaseAttributes() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(entityType));
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(1L, 100L)).thenReturn(Optional.of(existingRecord));

        // Client has outdated version 1L and passes no baseAttributes
        UpdateRecordRequest request = new UpdateRecordRequest(Map.of("title", "New"), 1L, null);

        assertThrows(MetadataConflictException.class, () -> {
            metadataService.updateEntityRecord(1L, 100L, request);
        });
    }
}
