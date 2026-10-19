package com.unipost.service;

import com.unipost.domain.metadata.*;
import com.unipost.presentation.dto.metadata.ChildPaginationMetadata;
import com.unipost.presentation.dto.metadata.ChildPaginationParam;
import com.unipost.presentation.dto.metadata.CompositeRecordResponse;
import com.unipost.repository.jpa.EntityRecordRepository;
import com.unipost.repository.jpa.EntityRelationshipRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Resilient batch resolver for composite entity graphs using in-memory assembly.
 * Serves as fail-safe fallback when dynamic SQL pushdown encounters statement timeouts or planner issues.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataLoaderBatchResolver {

    private final EntityRecordRepository entityRecordRepository;
    private final EntityRelationshipRepository entityRelationshipRepository;

    public List<CompositeRecordResponse> resolveBatch(
            CompositeSpec spec,
            List<EntityRecord> rootRecords,
            Map<String, ChildPaginationParam> childParams) {

        if (spec == null || rootRecords == null || rootRecords.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> rootIds = rootRecords.stream().map(EntityRecord::getId).toList();
        String tenantId = rootRecords.get(0).getTenantId();

        // 1. Pre-fetch child records for each child node definition
        Map<String, Map<Long, List<EntityRecord>>> childRecordsByNodeAndRootId = new HashMap<>();

        if (spec.children() != null) {
            for (CompositeNode child : spec.children()) {
                String nodeAlias = child.effectiveAlias();
                Map<Long, List<EntityRecord>> byRootId = fetchChildRecordsForNode(child, rootIds, tenantId);
                childRecordsByNodeAndRootId.put(nodeAlias, byRootId);
            }
        }

        // 2. Assemble each root record into CompositeRecordResponse
        List<CompositeRecordResponse> results = new ArrayList<>();
        for (EntityRecord root : rootRecords) {
            Map<String, Object> projectedAttributes = new LinkedHashMap<>();
            Map<String, ChildPaginationMetadata> paginationMeta = new LinkedHashMap<>();

            // Project root fields
            Map<String, Object> rootAttrs = root.getAttributes() != null ? root.getAttributes() : Collections.emptyMap();
            if (spec.fields() != null) {
                for (CompositeField f : spec.fields()) {
                    projectedAttributes.put(f.effectiveAlias(), rootAttrs.get(f.sourceAttribute()));
                }
            }

            // Project children
            if (spec.children() != null) {
                for (CompositeNode child : spec.children()) {
                    String nodeAlias = child.effectiveAlias();
                    ChildPaginationParam param = (childParams != null && childParams.containsKey(nodeAlias))
                            ? childParams.get(nodeAlias)
                            : ChildPaginationParam.ofDefault();

                    List<EntityRecord> allMatching = childRecordsByNodeAndRootId
                            .getOrDefault(nodeAlias, Collections.emptyMap())
                            .getOrDefault(root.getId(), Collections.emptyList());

                    int total = allMatching.size();
                    int offset = Math.min(param.offset(), total);
                    int limit = param.limit();
                    int toIndex = Math.min(offset + limit, total);
                    List<EntityRecord> sliced = allMatching.subList(offset, toIndex);

                    boolean isOneToOne = "ONE_TO_ONE".equalsIgnoreCase(child.cardinality());

                    if (isOneToOne) {
                        if (!sliced.isEmpty()) {
                            projectedAttributes.put(nodeAlias, projectChildFields(child, sliced.get(0)));
                        } else {
                            projectedAttributes.put(nodeAlias, null);
                        }
                    } else {
                        List<Map<String, Object>> childList = sliced.stream()
                                .map(r -> projectChildFields(child, r))
                                .collect(Collectors.toList());
                        projectedAttributes.put(nodeAlias, childList);
                    }

                    boolean hasMore = total > (offset + limit);
                    paginationMeta.put(nodeAlias, new ChildPaginationMetadata(total, limit, offset, hasMore));
                }
            }

            results.add(new CompositeRecordResponse(
                    root.getId(),
                    root.getTenantId(),
                    root.getEntityType() != null ? root.getEntityType().getId() : spec.rootEntityTypeId(),
                    true,
                    root.getSchemaVersion() != null ? root.getSchemaVersion() : 1L,
                    projectedAttributes,
                    paginationMeta,
                    "dataloader-fallback",
                    root.getCreatedDate(),
                    root.getLastUpdatedDate()
            ));
        }

        return results;
    }

    private Map<Long, List<EntityRecord>> fetchChildRecordsForNode(
            CompositeNode child,
            List<Long> rootIds,
            String tenantId) {

        Map<Long, List<EntityRecord>> map = new HashMap<>();
        for (Long rId : rootIds) {
            map.put(rId, new ArrayList<>());
        }

        if (child.effectiveJoinPattern() == CompositeJoinPattern.PATTERN_B_FOREIGN_KEY) {
            Long childTypeId = child.targetEntityTypeId();
            String fkAttr = child.foreignKeyAttribute() != null ? child.foreignKeyAttribute().trim() : "root_id";

            List<EntityRecord> candidates = entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(childTypeId);
            for (EntityRecord c : candidates) {
                if (Objects.equals(c.getTenantId(), tenantId) && c.getAttributes() != null) {
                    Object fkVal = c.getAttributes().get(fkAttr);
                    if (fkVal != null) {
                        try {
                            Long parsedId = fkVal instanceof Number n ? n.longValue() : Long.parseLong(fkVal.toString());
                            if (map.containsKey(parsedId)) {
                                map.get(parsedId).add(c);
                            }
                        } catch (Exception ignored) {}
                    }
                }
            }
        } else {
            // Pattern C: Join via UNIPOST_ENTITY_RELATIONSHIPS
            for (Long rId : rootIds) {
                org.springframework.data.domain.Pageable p = org.springframework.data.domain.PageRequest.of(0, 1000);
                org.springframework.data.domain.Page<EntityRelationship> relPage =
                        entityRelationshipRepository.findBySourceEntityIdAndDeletedDateIsNull(rId, p);

                for (EntityRelationship rel : relPage.getContent()) {
                    if (child.relationshipTypeId() == null || Objects.equals(rel.getRelationshipType().getId(), child.relationshipTypeId())) {
                        EntityRecord target = rel.getTargetEntity();
                        if (target != null && target.getDeletedDate() == null && Objects.equals(target.getTenantId(), tenantId)) {
                            map.get(rId).add(target);
                        }
                    }
                }
            }
        }

        return map;
    }

    private Map<String, Object> projectChildFields(CompositeNode child, EntityRecord record) {
        Map<String, Object> projected = new LinkedHashMap<>();
        projected.put("id", record.getId());
        projected.put("tenantId", record.getTenantId());
        projected.put("entityTypeId", record.getEntityType() != null ? record.getEntityType().getId() : child.targetEntityTypeId());

        Map<String, Object> attrs = record.getAttributes() != null ? record.getAttributes() : Collections.emptyMap();
        if (child.fields() != null) {
            for (CompositeField f : child.fields()) {
                projected.put(f.effectiveAlias(), attrs.get(f.sourceAttribute()));
            }
        } else {
            projected.putAll(attrs);
        }
        return projected;
    }
}
