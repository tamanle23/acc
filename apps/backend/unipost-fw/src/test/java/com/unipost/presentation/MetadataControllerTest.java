package com.unipost.presentation;

import com.unipost.core.context.Context;
import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.Page;
import com.unipost.core.io.PageRequest;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.ResponseEntityBuilder;
import com.unipost.presentation.dto.metadata.*;
import com.unipost.service.MetadataService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MetadataControllerTest {

    @Mock
    private MetadataService metadataService;

    @Mock
    private Context contextHelper;

    private ResponseEntityBuilder responseBuilder;
    private MetadataController metadataController;

    @BeforeEach
    void setUp() {
        responseBuilder = new ResponseEntityBuilder();
        ReflectionTestUtils.setField(responseBuilder, "contextHelper", contextHelper);
        metadataController = new MetadataController(metadataService, responseBuilder);
    }

    @Test
    void testGetEntityTypes_PopulatesDefaultPageRequest() {
        Page<EntityTypeResponse> mockPage = new Page<>();
        when(metadataService.getEntityTypes(any(PageRequest.class))).thenReturn(mockPage);

        ResponseEntity<ResponseWrapper<ContextHeader, Page<EntityTypeResponse>>> response = metadataController.getEntityTypes(null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(mockPage, response.getBody().getBody());

        ArgumentCaptor<PageRequest> captor = ArgumentCaptor.forClass(PageRequest.class);
        verify(metadataService).getEntityTypes(captor.capture());

        PageRequest captured = captor.getValue();
        assertNotNull(captured);
        assertEquals(1, captured.getNumber());
        assertEquals(10, captured.getSize());
    }

    @Test
    void testGetAttributeDefinitions() {
        Long typeId = 1L;
        PageRequest request = new PageRequest();
        request.setNumber(2);
        request.setSize(20);

        Page<AttributeDefinitionResponse> mockPage = new Page<>();
        when(metadataService.getAttributeDefinitions(eq(typeId), any(PageRequest.class))).thenReturn(mockPage);

        ResponseEntity<ResponseWrapper<ContextHeader, Page<AttributeDefinitionResponse>>> response = metadataController.getAttributeDefinitions(typeId, request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(mockPage, response.getBody().getBody());

        ArgumentCaptor<PageRequest> captor = ArgumentCaptor.forClass(PageRequest.class);
        verify(metadataService).getAttributeDefinitions(eq(typeId), captor.capture());

        PageRequest captured = captor.getValue();
        assertEquals(2, captured.getNumber());
        assertEquals(20, captured.getSize());
    }

    @Test
    void testCreateEntityRecord() {
        Long typeId = 1L;
        CreateRecordRequest inputRecord = new CreateRecordRequest(Map.of("name", "John"), "tenant-1");
        EntityRecordResponse returnedRecord = new EntityRecordResponse(100L, "uid-100", 1L, "tenant-1", 1L, Map.of("name", "John"), 0L, LocalDateTime.now(), LocalDateTime.now());

        when(metadataService.createEntityRecord(typeId, inputRecord)).thenReturn(returnedRecord);

        ResponseEntity<ResponseWrapper<ContextHeader, EntityRecordResponse>> response = metadataController.createEntityRecord(typeId, inputRecord);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(returnedRecord, response.getBody().getBody());
        verify(metadataService).createEntityRecord(typeId, inputRecord);
    }

    @Test
    void testGetEntityType() {
        EntityTypeResponse mockResponse = new EntityTypeResponse(1L, "cust-uid", "Cust", "cust", "Desc", 1L, 0L, LocalDateTime.now(), LocalDateTime.now());
        when(metadataService.getEntityType(1L)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, EntityTypeResponse>> response = metadataController.getEntityType(1L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockResponse, response.getBody().getBody());
        verify(metadataService).getEntityType(1L);
    }

    @Test
    void testGetCompiledSchema() {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        com.fasterxml.jackson.databind.JsonNode node = mapper.createObjectNode().put("type", "object");
        CompiledSchemaResponse mockResponse = new CompiledSchemaResponse(1L, 2L, node);

        when(metadataService.getCompiledSchema(1L)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, CompiledSchemaResponse>> response = metadataController.getCompiledSchema(1L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockResponse, response.getBody().getBody());
        verify(metadataService).getCompiledSchema(1L);
    }

    @Test
    void testUpdateEntityType() {
        UpdateEntityTypeRequest request = new UpdateEntityTypeRequest("New Name", "New Desc", 0L);
        EntityTypeResponse mockResponse = new EntityTypeResponse(1L, "cust-uid", "New Name", "cust", "New Desc", 1L, 0L, LocalDateTime.now(), LocalDateTime.now());
        when(metadataService.updateEntityType(1L, request)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, EntityTypeResponse>> response = metadataController.updateEntityType(1L, request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockResponse, response.getBody().getBody());
        verify(metadataService).updateEntityType(1L, request);
    }

    @Test
    void testDeleteEntityType() {
        ResponseEntity<ResponseWrapper<ContextHeader, Void>> response = metadataController.deleteEntityType(1L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(metadataService).deleteEntityType(1L);
    }

    @Test
    void testGetAttributeDefinition() {
        AttributeDefinitionResponse mockResponse = new AttributeDefinitionResponse(10L, "attr-10", 1L, "Email", "email", "string", "text", true, false, 0, null, null, 0L, LocalDateTime.now(), LocalDateTime.now());
        when(metadataService.getAttributeDefinition(1L, 10L)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, AttributeDefinitionResponse>> response = metadataController.getAttributeDefinition(1L, 10L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockResponse, response.getBody().getBody());
        verify(metadataService).getAttributeDefinition(1L, 10L);
    }

    @Test
    void testUpdateAttributeDefinition() {
        UpdateAttributeRequest request = new UpdateAttributeRequest("Email 2", "textarea", true, false, null, null, null, 0L);
        AttributeDefinitionResponse mockResponse = new AttributeDefinitionResponse(10L, "attr-10", 1L, "Email 2", "email", "string", "textarea", true, false, 0, null, null, 0L, LocalDateTime.now(), LocalDateTime.now());
        when(metadataService.updateAttributeDefinition(1L, 10L, request)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, AttributeDefinitionResponse>> response = metadataController.updateAttributeDefinition(1L, 10L, request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockResponse, response.getBody().getBody());
        verify(metadataService).updateAttributeDefinition(1L, 10L, request);
    }

    @Test
    void testDeleteAttributeDefinition() {
        ResponseEntity<ResponseWrapper<ContextHeader, Void>> response = metadataController.deleteAttributeDefinition(1L, 10L, true);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(metadataService).deleteAttributeDefinition(1L, 10L, true);
    }

    @Test
    void testArchiveAttribute() {
        AttributeDefinitionResponse mockResponse = new AttributeDefinitionResponse(10L, "attr-10", 1L, "Email", "email", "string", "text", true, true, 0, null, null, 0L, LocalDateTime.now(), LocalDateTime.now());
        when(metadataService.archiveAttributeDefinition(1L, 10L)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, AttributeDefinitionResponse>> response = metadataController.archiveAttribute(1L, 10L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockResponse, response.getBody().getBody());
        verify(metadataService).archiveAttributeDefinition(1L, 10L);
    }

    @Test
    void testUnarchiveAttribute() {
        AttributeDefinitionResponse mockResponse = new AttributeDefinitionResponse(10L, "attr-10", 1L, "Email", "email", "string", "text", true, false, 0, null, null, 0L, LocalDateTime.now(), LocalDateTime.now());
        when(metadataService.unarchiveAttributeDefinition(1L, 10L)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, AttributeDefinitionResponse>> response = metadataController.unarchiveAttribute(1L, 10L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockResponse, response.getBody().getBody());
        verify(metadataService).unarchiveAttributeDefinition(1L, 10L);
    }

    @Test
    void testReorderAttributes() {
        ReorderAttributesRequest request = new ReorderAttributesRequest(java.util.List.of(20L, 10L));
        ResponseEntity<ResponseWrapper<ContextHeader, Void>> response = metadataController.reorderAttributes(1L, request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(metadataService).reorderAttributes(1L, request);
    }

    @Test
    void testGetEntityRecord() {
        EntityRecordResponse mockResponse = new EntityRecordResponse(100L, "rec-1", 1L, "tenant-1", 1L, Map.of(), 0L, LocalDateTime.now(), LocalDateTime.now());
        when(metadataService.getEntityRecord(1L, 100L)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, EntityRecordResponse>> response = metadataController.getEntityRecord(1L, 100L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockResponse, response.getBody().getBody());
        verify(metadataService).getEntityRecord(1L, 100L);
    }

    @Test
    void testUpdateEntityRecord() {
        UpdateRecordRequest request = new UpdateRecordRequest(Map.of("name", "New"), 0L, null);
        EntityRecordResponse mockResponse = new EntityRecordResponse(100L, "rec-1", 1L, "tenant-1", 1L, Map.of("name", "New"), 0L, LocalDateTime.now(), LocalDateTime.now());
        when(metadataService.updateEntityRecord(1L, 100L, request)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, EntityRecordResponse>> response = metadataController.updateEntityRecord(1L, 100L, request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockResponse, response.getBody().getBody());
        verify(metadataService).updateEntityRecord(1L, 100L, request);
    }

    @Test
    void testPatchEntityRecord() {
        PatchRecordRequest request = new PatchRecordRequest(Map.of("name", "Patched"), 0L, null);
        EntityRecordResponse mockResponse = new EntityRecordResponse(100L, "rec-1", 1L, "tenant-1", 1L, Map.of("name", "Patched"), 0L, LocalDateTime.now(), LocalDateTime.now());
        when(metadataService.patchEntityRecord(1L, 100L, request)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, EntityRecordResponse>> response = metadataController.patchEntityRecord(1L, 100L, request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockResponse, response.getBody().getBody());
        verify(metadataService).patchEntityRecord(1L, 100L, request);
    }

    @Test
    void testDeleteEntityRecord() {
        ResponseEntity<ResponseWrapper<ContextHeader, Void>> response = metadataController.deleteEntityRecord(1L, 100L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(metadataService).deleteEntityRecord(1L, 100L);
    }

    @Test
    void testTransitionRecordState() {
        Long typeId = 1L;
        Long recordId = 100L;
        String action = "SUBMIT";
        Map<String, Object> extra = Map.of("comment", "Ready for review");
        EntityRecordResponse mockResponse = new EntityRecordResponse(recordId, "rec-uid", typeId, "tenant-alpha", 1L, Map.of("status", "SUBMITTED"), 0L, null, null);

        when(metadataService.transitionRecordState(typeId, recordId, action, extra)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, EntityRecordResponse>> response =
                metadataController.transitionRecordState(typeId, recordId, action, extra);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(mockResponse, response.getBody().getBody());
        verify(metadataService).transitionRecordState(typeId, recordId, action, extra);
    }

    @Test
    void testGetEntityRecords_WithFiltersAndSort() {
        Long typeId = 1L;
        PageRequest pageRequest = new PageRequest();
        pageRequest.setNumber(1);
        pageRequest.setSize(10);

        Page<EntityRecordResponse> mockPage = new Page<>();
        when(metadataService.getEntityRecords(eq(typeId), any(PageRequest.class), anyMap(), eq("createdDate"), eq("desc"), eq("t-1")))
                .thenReturn(mockPage);

        Map<String, String> allParams = new HashMap<>();
        allParams.put("filter[status][eq]", "ACTIVE");
        allParams.put("filter[name]", "Widget");
        allParams.put("tenantId", "t-1");
        allParams.put("sort", "createdDate,desc");

        ResponseEntity<ResponseWrapper<ContextHeader, Page<EntityRecordResponse>>> response = metadataController.getEntityRecords(
                typeId,
                pageRequest,
                "createdDate,desc",
                "t-1",
                allParams
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(mockPage, response.getBody().getBody());

        ArgumentCaptor<Map<String, Map<String, String>>> filterCaptor = ArgumentCaptor.forClass(Map.class);
        verify(metadataService).getEntityRecords(
                eq(typeId),
                any(PageRequest.class),
                filterCaptor.capture(),
                eq("createdDate"),
                eq("desc"),
                eq("t-1")
        );

        Map<String, Map<String, String>> capturedFilters = filterCaptor.getValue();
        assertEquals("ACTIVE", capturedFilters.get("status").get("eq"));
        assertEquals("Widget", capturedFilters.get("name").get("eq"));
    }

    // ==========================================
    // Phase 5 Relationship Controller Tests
    // ==========================================

    @Test
    void testGetRelationshipTypes() {
        Page<RelationshipTypeResponse> mockPage = new Page<>();
        when(metadataService.getRelationshipTypes(any(PageRequest.class))).thenReturn(mockPage);

        ResponseEntity<ResponseWrapper<ContextHeader, Page<RelationshipTypeResponse>>> response = metadataController.getRelationshipTypes(null);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockPage, response.getBody().getBody());
        verify(metadataService).getRelationshipTypes(any(PageRequest.class));
    }

    @Test
    void testCreateRelationshipType() {
        CreateRelationshipTypeRequest request = new CreateRelationshipTypeRequest("authored_by", "Author relation", 1L, 2L, "MANY_TO_ONE");
        RelationshipTypeResponse mockResponse = new RelationshipTypeResponse(10L, "uid-10", "authored_by", "Author relation", 1L, 2L, "MANY_TO_ONE", 0L, null, null);
        when(metadataService.createRelationshipType(request)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, RelationshipTypeResponse>> response = metadataController.createRelationshipType(request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockResponse, response.getBody().getBody());
        verify(metadataService).createRelationshipType(request);
    }

    @Test
    void testCreateEntityRelationship() {
        Long recordId = 100L;
        CreateEntityRelationshipRequest request = new CreateEntityRelationshipRequest(200L, 10L, Map.of("key", "val"));
        EntityRelationshipResponse mockResponse = new EntityRelationshipResponse(50L, "uid-50", 100L, 200L, 10L, "authored_by", Map.of("key", "val"), 0L, null, null);
        when(metadataService.createEntityRelationship(recordId, request)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, EntityRelationshipResponse>> response = metadataController.createEntityRelationship(recordId, request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockResponse, response.getBody().getBody());
        verify(metadataService).createEntityRelationship(recordId, request);
    }

    @Test
    void testValidateEntityRecord() {
        Long entityTypeId = 1L;
        CreateRecordRequest request = new CreateRecordRequest(Map.of("tier", "Enterprise"), "apac-prod");
        ValidateRecordResponse mockResponse = ValidateRecordResponse.success(entityTypeId, 2L);
        when(metadataService.validateEntityRecordDryRun(entityTypeId, request)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, ValidateRecordResponse>> response = metadataController.validateEntityRecord(entityTypeId, request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(mockResponse, response.getBody().getBody());
        assertTrue(response.getBody().getBody().valid());
        verify(metadataService).validateEntityRecordDryRun(entityTypeId, request);
    }

    @Test
    void testGetSchemaDriftAnalysis() {
        Long entityTypeId = 1L;
        SchemaDriftAnalysisResponse mockResponse = new SchemaDriftAnalysisResponse(entityTypeId, 2L, 100L, 15L, 85L);
        when(metadataService.analyzeSchemaDrift(entityTypeId)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, SchemaDriftAnalysisResponse>> response = metadataController.getSchemaDriftAnalysis(entityTypeId);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(15L, response.getBody().getBody().outdatedRecords());
        assertEquals(85L, response.getBody().getBody().compliantRecords());
        verify(metadataService).analyzeSchemaDrift(entityTypeId);
    }

    @Test
    void testExecuteSchemaBackfill() {
        Long entityTypeId = 1L;
        SchemaBackfillExecutionResponse mockResponse = new SchemaBackfillExecutionResponse(entityTypeId, 2L, 15, 15, 0, List.of());
        when(metadataService.executeSchemaBackfill(entityTypeId, 100)).thenReturn(mockResponse);

        ResponseEntity<ResponseWrapper<ContextHeader, SchemaBackfillExecutionResponse>> response = metadataController.executeSchemaBackfill(entityTypeId, 100);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(15, response.getBody().getBody().migratedRecords());
        verify(metadataService).executeSchemaBackfill(entityTypeId, 100);
    }

    @Test
    void testDeleteEntityRelationship() {
        ResponseEntity<ResponseWrapper<ContextHeader, Void>> response = metadataController.deleteEntityRelationship(100L, 50L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(metadataService).deleteEntityRelationship(100L, 50L);
    }
}
