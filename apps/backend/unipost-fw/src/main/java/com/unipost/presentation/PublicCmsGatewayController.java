package com.unipost.presentation;

import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.Page;
import com.unipost.core.io.PageRequest;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.domain.metadata.EntityType;
import com.unipost.fw.ResponseEntityBuilder;
import com.unipost.presentation.dto.metadata.EntityRecordResponse;
import com.unipost.repository.jpa.EntityTypeRepository;
import com.unipost.service.MetadataService;
import com.unipost.service.exception.MetadataNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Public Gateway Controller for headless CMS ingestion (tekgo-ui, mobile-ui public view).
 * <p>
 * Accessible publicly under {@code /api/v1/public/tenants/{tenantId}/cms}.
 * Invariants:
 * <ul>
 *   <li>Only published records are returned ({@code status = 'PUBLISHED'}).</li>
 *   <li>Tenant isolation is enforced via RLS / tenant filtering.</li>
 *   <li>Drafts or non-existent records return 404 Not Found.</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/public/tenants/{tenantId}/cms")
@RequiredArgsConstructor
public class PublicCmsGatewayController {

    private final MetadataService metadataService;
    private final EntityTypeRepository entityTypeRepository;
    private final ResponseEntityBuilder responseBuilder;

    private static final String STATUS_PUBLISHED = "PUBLISHED";

    private PageRequest populateDefaults(PageRequest pageRequest) {
        if (pageRequest == null) pageRequest = new PageRequest();
        if (pageRequest.getNumber() == null) pageRequest.setNumber(1);
        if (pageRequest.getSize() <= 0) pageRequest.setSize(10);
        return pageRequest;
    }

    /**
     * Lists published CMS records for a specific entity type under a tenant.
     *
     * @param tenantId the tenant ID
     * @param entityType system name of the entity type (e.g. "article") or numeric ID
     * @param pageRequest pagination details
     * @param sort sorting parameter
     * @param allParams filter query parameters
     * @return paginated list of published records
     */
    @GetMapping("/records")
    public ResponseEntity<ResponseWrapper<ContextHeader, Page<EntityRecordResponse>>> getPublishedRecords(
            @PathVariable String tenantId,
            @RequestParam String entityType,
            @ModelAttribute PageRequest pageRequest,
            @RequestParam(required = false) String sort,
            @RequestParam Map<String, String> allParams) {

        EntityType type = resolveEntityType(tenantId, entityType);

        // Build filter parameters and strictly enforce status = PUBLISHED
        Map<String, Map<String, String>> filterParams = new HashMap<>();

        for (Map.Entry<String, String> entry : allParams.entrySet()) {
            String key = entry.getKey();
            if (key.startsWith("filter[") && key.endsWith("]")) {
                String inner = key.substring(7, key.length() - 1);
                if (inner.contains("][")) {
                    String[] parts = inner.split("\\]\\[");
                    String attr = parts[0];
                    String op = parts[1];
                    // Do not allow client to override status filter to non-published
                    if (!"status".equalsIgnoreCase(attr)) {
                        filterParams.computeIfAbsent(attr, k -> new HashMap<>()).put(op, entry.getValue());
                    }
                } else {
                    if (!"status".equalsIgnoreCase(inner)) {
                        filterParams.computeIfAbsent(inner, k -> new HashMap<>()).put("eq", entry.getValue());
                    }
                }
            }
        }

        // Strictly enforce published status
        filterParams.computeIfAbsent("status", k -> new HashMap<>()).put("eq", STATUS_PUBLISHED);

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
                type.getId(),
                populateDefaults(pageRequest),
                filterParams,
                sortProperty,
                sortDirection,
                tenantId
        );

        return responseBuilder.success(page);
    }

    /**
     * Retrieves a single published CMS record by record ID.
     * If the record does not exist or is in DRAFT/non-published state, returns 404 Not Found.
     *
     * @param tenantId the tenant ID
     * @param recordId the record ID
     * @param entityType system name of the entity type (e.g. "article") or numeric ID
     * @return published record response
     */
    @GetMapping("/records/{recordId}")
    public ResponseEntity<ResponseWrapper<ContextHeader, EntityRecordResponse>> getPublishedRecord(
            @PathVariable String tenantId,
            @PathVariable Long recordId,
            @RequestParam String entityType) {

        EntityType type = resolveEntityType(tenantId, entityType);
        EntityRecordResponse record = metadataService.getEntityRecord(type.getId(), recordId);

        // Verify tenant isolation
        if (record.tenantId() != null && !record.tenantId().equals(tenantId)) {
            throw new MetadataNotFoundException("Published record not found: " + recordId);
        }

        // Verify publication status
        Object status = record.attributes() != null ? record.attributes().get("status") : null;
        if (status == null || !STATUS_PUBLISHED.equalsIgnoreCase(String.valueOf(status))) {
            throw new MetadataNotFoundException("Published record not found or not published: " + recordId);
        }

        return responseBuilder.success(record);
    }

    private EntityType resolveEntityType(String tenantId, String entityTypeParam) {
        if (entityTypeParam == null || entityTypeParam.isBlank()) {
            throw new MetadataNotFoundException("Entity type parameter is required");
        }

        // Try numeric ID first
        try {
            Long typeId = Long.parseLong(entityTypeParam);
            return entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)
                    .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + typeId));
        } catch (NumberFormatException ignored) {
            // Not a numeric ID, search by systemName and tenant or global
            return entityTypeRepository.findByTenantIdAndSystemNameAndDeletedDateIsNull(tenantId, entityTypeParam)
                    .or(() -> entityTypeRepository.findBySystemNameAndDeletedDateIsNull(entityTypeParam))
                    .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with systemName: " + entityTypeParam));
        }
    }
}
