package com.unipost.presentation;

import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.Page;
import com.unipost.core.io.PageRequest;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.ResponseEntityBuilder;
import com.unipost.presentation.dto.metadata.*;
import com.unipost.service.MetadataService;
import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/metadata")
@RequiredArgsConstructor
public class MetadataController {

    private final MetadataService metadataService;
    private final ResponseEntityBuilder responseBuilder;

    private PageRequest populateDefaults(PageRequest pageRequest) {
        if (pageRequest == null) pageRequest = new PageRequest();
        if (pageRequest.getNumber() == null) pageRequest.setNumber(1);
        if (pageRequest.getSize() <= 0) pageRequest.setSize(10);
        return pageRequest;
    }

    @GetMapping("/entity-types")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Page<EntityTypeResponse>>> getEntityTypes(@ModelAttribute PageRequest pageRequest) {
        Page<EntityTypeResponse> page = metadataService.getEntityTypes(populateDefaults(pageRequest));
        return responseBuilder.success(page);
    }

    @PostMapping("/entity-types")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, EntityTypeResponse>> createEntityType(@Valid @RequestBody CreateEntityTypeRequest request) {
        EntityTypeResponse created = metadataService.createEntityType(request);
        return responseBuilder.success(created);
    }

    @GetMapping("/entity-types/{id}")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, EntityTypeResponse>> getEntityType(@PathVariable Long id) {
        EntityTypeResponse entityType = metadataService.getEntityType(id);
        return responseBuilder.success(entityType);
    }

    @GetMapping("/entity-types/{id}/schema")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, CompiledSchemaResponse>> getCompiledSchema(@PathVariable Long id) {
        CompiledSchemaResponse schema = metadataService.getCompiledSchema(id);
        return responseBuilder.success(schema);
    }

    @PutMapping("/entity-types/{id}")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, EntityTypeResponse>> updateEntityType(
            @PathVariable Long id,
            @Valid @RequestBody UpdateEntityTypeRequest request) {
        EntityTypeResponse updated = metadataService.updateEntityType(id, request);
        return responseBuilder.success(updated);
    }

    @DeleteMapping("/entity-types/{id}")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Void>> deleteEntityType(@PathVariable Long id) {
        metadataService.deleteEntityType(id);
        return responseBuilder.success(null);
    }

    @GetMapping("/entity-types/{id}/attributes")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Page<AttributeDefinitionResponse>>> getAttributeDefinitions(
            @PathVariable Long id,
            @ModelAttribute PageRequest pageRequest) {
        Page<AttributeDefinitionResponse> page = metadataService.getAttributeDefinitions(id, populateDefaults(pageRequest));
        return responseBuilder.success(page);
    }

    @PostMapping("/entity-types/{id}/attributes")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, AttributeDefinitionResponse>> createAttributeDefinition(
            @PathVariable Long id,
            @Valid @RequestBody CreateAttributeRequest request) {
        AttributeDefinitionResponse created = metadataService.createAttributeDefinition(id, request);
        return responseBuilder.success(created);
    }

    @GetMapping("/entity-types/{id}/attributes/{attrId}")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, AttributeDefinitionResponse>> getAttributeDefinition(
            @PathVariable Long id,
            @PathVariable Long attrId) {
        AttributeDefinitionResponse attribute = metadataService.getAttributeDefinition(id, attrId);
        return responseBuilder.success(attribute);
    }

    @PutMapping("/entity-types/{id}/attributes/{attrId}")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, AttributeDefinitionResponse>> updateAttributeDefinition(
            @PathVariable Long id,
            @PathVariable Long attrId,
            @Valid @RequestBody UpdateAttributeRequest request) {
        AttributeDefinitionResponse updated = metadataService.updateAttributeDefinition(id, attrId, request);
        return responseBuilder.success(updated);
    }

    @DeleteMapping("/entity-types/{id}/attributes/{attrId}")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Void>> deleteAttributeDefinition(
            @PathVariable Long id,
            @PathVariable Long attrId,
            @RequestParam(defaultValue = "false") boolean force) {
        metadataService.deleteAttributeDefinition(id, attrId, force);
        return responseBuilder.success(null);
    }

    @PostMapping("/entity-types/{id}/attributes/{attrId}/archive")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, AttributeDefinitionResponse>> archiveAttribute(
            @PathVariable Long id,
            @PathVariable Long attrId) {
        AttributeDefinitionResponse updated = metadataService.archiveAttributeDefinition(id, attrId);
        return responseBuilder.success(updated);
    }

    @PostMapping("/entity-types/{id}/attributes/{attrId}/unarchive")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, AttributeDefinitionResponse>> unarchiveAttribute(
            @PathVariable Long id,
            @PathVariable Long attrId) {
        AttributeDefinitionResponse updated = metadataService.unarchiveAttributeDefinition(id, attrId);
        return responseBuilder.success(updated);
    }

    @PutMapping("/entity-types/{id}/attributes/order")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Void>> reorderAttributes(
            @PathVariable Long id,
            @Valid @RequestBody ReorderAttributesRequest request) {
        metadataService.reorderAttributes(id, request);
        return responseBuilder.success(null);
    }

    @GetMapping("/entity-types/{id}/records")
    @PreAuthorize("hasAuthority('METADATA_RECORD_READ') or hasAuthority('METADATA_RECORD_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Page<EntityRecordResponse>>> getEntityRecords(
            @PathVariable Long id,
            @ModelAttribute PageRequest pageRequest,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String tenantId,
            @RequestParam Map<String, String> allParams) {

        // Parse filter[attr][op]=val or filter[attr]=val
        java.util.Map<String, java.util.Map<String, String>> filterParams = new java.util.HashMap<>();
        for (java.util.Map.Entry<String, String> entry : allParams.entrySet()) {
            String key = entry.getKey();
            if (key.startsWith("filter[") && key.endsWith("]")) {
                String inner = key.substring(7, key.length() - 1);
                if (inner.contains("][")) {
                    String[] parts = inner.split("\\]\\[");
                    String attr = parts[0];
                    String op = parts[1];
                    filterParams.computeIfAbsent(attr, k -> new java.util.HashMap<>()).put(op, entry.getValue());
                } else {
                    filterParams.computeIfAbsent(inner, k -> new java.util.HashMap<>()).put("eq", entry.getValue());
                }
            }
        }

        String sortProperty = null;
        String sortDirection = "asc";
        if (sort != null && !sort.isBlank()) {
            if (sort.contains(",")) {
                String[] parts = sort.split(",");
                sortProperty = parts[0].trim();
                sortDirection = parts[1].trim();
            } else {
                sortProperty = sort.trim();
            }
        }

        Page<EntityRecordResponse> page = metadataService.getEntityRecords(
                id,
                populateDefaults(pageRequest),
                filterParams,
                sortProperty,
                sortDirection,
                tenantId
        );
        return responseBuilder.success(page);
    }

    @GetMapping("/entity-types/{id}/drift")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasAuthority('METADATA_RECORD_READ') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, SchemaDriftAnalysisResponse>> getSchemaDriftAnalysis(
            @PathVariable Long id) {
        SchemaDriftAnalysisResponse analysis = metadataService.analyzeSchemaDrift(id);
        return responseBuilder.success(analysis);
    }

    @PostMapping("/entity-types/{id}/backfill")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, SchemaBackfillExecutionResponse>> executeSchemaBackfill(
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "100") Integer batchSize) {
        SchemaBackfillExecutionResponse result = metadataService.executeSchemaBackfill(id, batchSize != null ? batchSize : 100);
        return responseBuilder.success(result);
    }

    @PostMapping("/entity-types/{id}/records/validate")
    @PreAuthorize("hasAuthority('METADATA_RECORD_READ') or hasAuthority('METADATA_RECORD_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, ValidateRecordResponse>> validateEntityRecord(
            @PathVariable Long id,
            @Valid @RequestBody CreateRecordRequest request) {
        ValidateRecordResponse result = metadataService.validateEntityRecordDryRun(id, request);
        return responseBuilder.success(result);
    }

    @PostMapping("/entity-types/{id}/records")
    @PreAuthorize("hasAuthority('METADATA_RECORD_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, EntityRecordResponse>> createEntityRecord(
            @PathVariable Long id,
            @Valid @RequestBody CreateRecordRequest request) {
        EntityRecordResponse created = metadataService.createEntityRecord(id, request);
        return responseBuilder.success(created);
    }

    @GetMapping("/entity-types/{id}/records/{recordId}")
    @PreAuthorize("hasAuthority('METADATA_RECORD_READ') or hasAuthority('METADATA_RECORD_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, EntityRecordResponse>> getEntityRecord(
            @PathVariable Long id,
            @PathVariable Long recordId) {
        EntityRecordResponse record = metadataService.getEntityRecord(id, recordId);
        return responseBuilder.success(record);
    }

    @PutMapping("/entity-types/{id}/records/{recordId}")
    @PreAuthorize("hasAuthority('METADATA_RECORD_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, EntityRecordResponse>> updateEntityRecord(
            @PathVariable Long id,
            @PathVariable Long recordId,
            @Valid @RequestBody UpdateRecordRequest request) {
        EntityRecordResponse updated = metadataService.updateEntityRecord(id, recordId, request);
        return responseBuilder.success(updated);
    }

    @PatchMapping("/entity-types/{id}/records/{recordId}")
    @PreAuthorize("hasAuthority('METADATA_RECORD_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, EntityRecordResponse>> patchEntityRecord(
            @PathVariable Long id,
            @PathVariable Long recordId,
            @Valid @RequestBody PatchRecordRequest request) {
        EntityRecordResponse updated = metadataService.patchEntityRecord(id, recordId, request);
        return responseBuilder.success(updated);
    }

    @DeleteMapping("/entity-types/{id}/records/{recordId}")
    @PreAuthorize("hasAuthority('METADATA_RECORD_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Void>> deleteEntityRecord(
            @PathVariable Long id,
            @PathVariable Long recordId) {
        metadataService.deleteEntityRecord(id, recordId);
        return responseBuilder.success(null);
    }

    @PostMapping("/entity-types/{id}/records/{recordId}/transition")
    @PreAuthorize("hasAuthority('METADATA_RECORD_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, EntityRecordResponse>> transitionRecordState(
            @PathVariable Long id,
            @PathVariable Long recordId,
            @RequestParam String action,
            @RequestBody(required = false) Map<String, Object> additionalAttributes) {
        EntityRecordResponse transitioned = metadataService.transitionRecordState(id, recordId, action, additionalAttributes);
        return responseBuilder.success(transitioned);
    }

    // ==========================================
    // Relationship Types Endpoints
    // ==========================================

    @GetMapping("/relationship-types")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Page<RelationshipTypeResponse>>> getRelationshipTypes(
            @ModelAttribute PageRequest pageRequest) {
        Page<RelationshipTypeResponse> page = metadataService.getRelationshipTypes(populateDefaults(pageRequest));
        return responseBuilder.success(page);
    }

    @GetMapping("/relationship-types/{id}")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, RelationshipTypeResponse>> getRelationshipType(
            @PathVariable Long id) {
        RelationshipTypeResponse type = metadataService.getRelationshipType(id);
        return responseBuilder.success(type);
    }

    @PostMapping("/relationship-types")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, RelationshipTypeResponse>> createRelationshipType(
            @Valid @RequestBody CreateRelationshipTypeRequest request) {
        RelationshipTypeResponse created = metadataService.createRelationshipType(request);
        return responseBuilder.success(created);
    }

    @PutMapping("/relationship-types/{id}")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, RelationshipTypeResponse>> updateRelationshipType(
            @PathVariable Long id,
            @Valid @RequestBody UpdateRelationshipTypeRequest request) {
        RelationshipTypeResponse updated = metadataService.updateRelationshipType(id, request);
        return responseBuilder.success(updated);
    }

    @DeleteMapping("/relationship-types/{id}")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Void>> deleteRelationshipType(
            @PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean force) {
        metadataService.deleteRelationshipType(id, force);
        return responseBuilder.success(null);
    }

    // ==========================================
    // Entity Relationships Endpoints
    // ==========================================

    @GetMapping("/records/{recordId}/relationships")
    @PreAuthorize("hasAuthority('METADATA_RECORD_READ') or hasAuthority('METADATA_RECORD_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Page<EntityRelationshipResponse>>> getRecordRelationships(
            @PathVariable Long recordId,
            @RequestParam(required = false) String direction,
            @ModelAttribute PageRequest pageRequest) {
        Page<EntityRelationshipResponse> page = metadataService.getRecordRelationships(recordId, direction, populateDefaults(pageRequest));
        return responseBuilder.success(page);
    }

    @PostMapping("/records/{recordId}/relationships")
    @PreAuthorize("hasAuthority('METADATA_RECORD_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, EntityRelationshipResponse>> createEntityRelationship(
            @PathVariable Long recordId,
            @Valid @RequestBody CreateEntityRelationshipRequest request) {
        EntityRelationshipResponse created = metadataService.createEntityRelationship(recordId, request);
        return responseBuilder.success(created);
    }

    @DeleteMapping("/records/{recordId}/relationships/{relationshipId}")
    @PreAuthorize("hasAuthority('METADATA_RECORD_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Void>> deleteEntityRelationship(
            @PathVariable Long recordId,
            @PathVariable Long relationshipId) {
        metadataService.deleteEntityRelationship(recordId, relationshipId);
        return responseBuilder.success(null);
    }
}
