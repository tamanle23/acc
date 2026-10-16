package com.unipost.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.unipost.domain.metadata.CompositeField;
import com.unipost.domain.metadata.CompositeNode;
import com.unipost.domain.metadata.CompositeSpec;
import com.unipost.service.exception.SchemaValidationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class CompositeSpecCompiler {

    public static final int MAX_DEPTH_CEILING = 4;

    private final ObjectMapper objectMapper;

    /**
     * Validates and compiles a CompositeSpec into a draft-07 JSON Schema ObjectNode.
     */
    public ObjectNode compileNode(CompositeSpec spec) {
        if (spec == null) {
            throw new IllegalArgumentException("CompositeSpec cannot be null");
        }

        // 1. Validate tree depth and cycle detection
        validateHierarchy(spec);

        // 2. Build root JSON schema
        ObjectNode root = objectMapper.createObjectNode();
        root.put("$schema", "http://json-schema.org/draft-07/schema#");
        root.put("type", "object");
        root.put("additionalProperties", false);

        ObjectNode properties = objectMapper.createObjectNode();
        ArrayNode requiredList = objectMapper.createArrayNode();

        // Standard envelope attributes
        ObjectNode idProp = objectMapper.createObjectNode();
        idProp.put("type", "string");
        properties.set("id", idProp);

        ObjectNode tenantIdProp = objectMapper.createObjectNode();
        tenantIdProp.put("type", "string");
        properties.set("tenantId", tenantIdProp);

        ObjectNode entityTypeIdProp = objectMapper.createObjectNode();
        entityTypeIdProp.put("type", "integer");
        properties.set("entityTypeId", entityTypeIdProp);

        ObjectNode isCompositeProp = objectMapper.createObjectNode();
        isCompositeProp.put("type", "boolean");
        properties.set("is_composite", isCompositeProp);

        // Project root fields
        if (spec.fields() != null) {
            for (CompositeField field : spec.fields()) {
                String alias = field.effectiveAlias();
                ObjectNode fieldNode = mapFieldType(field);
                properties.set(alias, fieldNode);
                if (Boolean.TRUE.equals(field.required())) {
                    requiredList.add(alias);
                }
            }
        }

        // Project child nodes recursively
        if (spec.children() != null) {
            for (CompositeNode child : spec.children()) {
                buildChildSchema(child, properties);
            }
        }

        root.set("properties", properties);
        if (!requiredList.isEmpty()) {
            root.set("required", requiredList);
        }

        return root;
    }

    private void buildChildSchema(CompositeNode node, ObjectNode parentProperties) {
        String nodeAlias = node.effectiveAlias();
        ObjectNode childNodeSchema = objectMapper.createObjectNode();
        childNodeSchema.put("type", "object");
        childNodeSchema.put("additionalProperties", false);

        ObjectNode childProps = objectMapper.createObjectNode();
        ArrayNode childRequired = objectMapper.createArrayNode();

        // Project node fields
        if (node.fields() != null) {
            for (CompositeField field : node.fields()) {
                String alias = field.effectiveAlias();
                ObjectNode fieldNode = mapFieldType(field);
                childProps.set(alias, fieldNode);
                if (Boolean.TRUE.equals(field.required())) {
                    childRequired.add(alias);
                }
            }
        }

        // Project nested children recursively
        if (node.children() != null) {
            for (CompositeNode grandchild : node.children()) {
                buildChildSchema(grandchild, childProps);
            }
        }

        childNodeSchema.set("properties", childProps);
        if (!childRequired.isEmpty()) {
            childNodeSchema.set("required", childRequired);
        }

        boolean isArrayCardinality = "ONE_TO_MANY".equalsIgnoreCase(node.cardinality()) 
                || "MANY_TO_MANY".equalsIgnoreCase(node.cardinality());

        if (isArrayCardinality) {
            ObjectNode arraySchema = objectMapper.createObjectNode();
            arraySchema.put("type", "array");
            arraySchema.set("items", childNodeSchema);
            parentProperties.set(nodeAlias, arraySchema);
        } else {
            parentProperties.set(nodeAlias, childNodeSchema);
        }
    }

    private ObjectNode mapFieldType(CompositeField field) {
        ObjectNode prop = objectMapper.createObjectNode();
        String dt = field.dataType() != null ? field.dataType().trim().toLowerCase() : "string";
        switch (dt) {
            case "integer", "int" -> prop.put("type", "integer");
            case "number", "decimal", "float", "double" -> prop.put("type", "number");
            case "boolean", "bool" -> prop.put("type", "boolean");
            case "array" -> {
                prop.put("type", "array");
                ObjectNode itemNode = objectMapper.createObjectNode();
                itemNode.put("type", "string");
                prop.set("items", itemNode);
            }
            case "object", "json" -> {
                prop.put("type", "object");
            }
            default -> prop.put("type", "string");
        }
        if (field.defaultValue() != null) {
            prop.set("default", objectMapper.valueToTree(field.defaultValue()));
        }
        return prop;
    }

    /**
     * Validates that hierarchy does not exceed MAX_DEPTH_CEILING and contains no cyclic references.
     */
    public void validateHierarchy(CompositeSpec spec) {
        List<String> path = new ArrayList<>();
        String rootIdentifier = spec.rootEntitySystemName() != null 
                ? spec.rootEntitySystemName() 
                : "entity_" + spec.rootEntityTypeId();
        path.add(rootIdentifier);

        if (spec.children() != null) {
            for (CompositeNode child : spec.children()) {
                traverseNode(child, path, 2);
            }
        }
    }

    private void traverseNode(CompositeNode node, List<String> currentPath, int currentDepth) {
        if (currentDepth > MAX_DEPTH_CEILING) {
            throw new SchemaValidationException("Composite spec exceeds maximum hierarchy depth ceiling of " 
                    + MAX_DEPTH_CEILING + " levels. Path: " + String.join(" -> ", currentPath) 
                    + " -> " + node.effectiveAlias());
        }

        String nodeIdentifier = node.targetEntitySystemName() != null 
                ? node.targetEntitySystemName() 
                : "entity_" + node.targetEntityTypeId();

        if (currentPath.contains(nodeIdentifier)) {
            throw new SchemaValidationException("Cycle detected in composite tree path: " 
                    + String.join(" -> ", currentPath) + " -> " + nodeIdentifier);
        }

        List<String> nextPath = new ArrayList<>(currentPath);
        nextPath.add(nodeIdentifier);

        if (node.children() != null) {
            for (CompositeNode child : node.children()) {
                traverseNode(child, nextPath, currentDepth + 1);
            }
        }
    }

    /**
     * Generates an optimized PostgreSQL pushdown query projection preview.
     */
    public String generatePushdownSql(CompositeSpec spec) {
        if (spec == null) return "-- Empty Composite Specification";

        StringBuilder sql = new StringBuilder();
        String rootSysName = spec.rootEntitySystemName() != null ? spec.rootEntitySystemName() : "root_entity";
        String rootTableAlias = "t_root";

        sql.append("-- ====================================================================\n");
        sql.append("-- Pushdown SQL Query Projection for Composite Entity: ").append(spec.effectiveRootAlias()).append("\n");
        sql.append("-- Root Entity Type: ").append(rootSysName).append(" (ID: ").append(spec.rootEntityTypeId()).append(")\n");
        sql.append("-- ====================================================================\n");
        sql.append("SELECT\n");
        sql.append("  ").append(rootTableAlias).append(".id AS root_id,\n");
        sql.append("  ").append(rootTableAlias).append(".tenant_id,\n");
        sql.append("  jsonb_build_object(\n");
        sql.append("    'id', ").append(rootTableAlias).append(".id,\n");
        sql.append("    'tenantId', ").append(rootTableAlias).append(".tenant_id,\n");
        sql.append("    'is_composite', TRUE,\n");

        // Projected root fields
        if (spec.fields() != null) {
            for (CompositeField field : spec.fields()) {
                sql.append("    '").append(field.effectiveAlias()).append("', ")
                   .append(rootTableAlias).append(".attributes->>'").append(field.sourceAttribute()).append("',\n");
            }
        }

        // Child node aggregations
        if (spec.children() != null && !spec.children().isEmpty()) {
            int childIdx = 1;
            for (CompositeNode child : spec.children()) {
                String childAlias = child.effectiveAlias();
                String childTableAlias = "t_child_" + childIdx;
                sql.append("    '").append(childAlias).append("', ")
                   .append(childTableAlias).append(".aggregated_data,\n");
                childIdx++;
            }
        }

        // Trim trailing comma if needed
        int lastComma = sql.lastIndexOf(",\n");
        if (lastComma > 0) {
            sql.replace(lastComma, lastComma + 2, "\n");
        }

        sql.append("  ) AS composite_record\n");
        sql.append("FROM UNIPOST_ENTITIES ").append(rootTableAlias).append("\n");

        // Joins for children
        if (spec.children() != null && !spec.children().isEmpty()) {
            int childIdx = 1;
            for (CompositeNode child : spec.children()) {
                String childTableAlias = "t_child_" + childIdx;
                sql.append("LEFT JOIN LATERAL (\n");
                sql.append("  SELECT jsonb_agg(jsonb_build_object(\n");
                sql.append("    'id', c.id,\n");
                if (child.fields() != null) {
                    for (CompositeField f : child.fields()) {
                        sql.append("    '").append(f.effectiveAlias()).append("', c.attributes->>'")
                           .append(f.sourceAttribute()).append("',\n");
                    }
                }
                int childComma = sql.lastIndexOf(",\n");
                if (childComma > 0) {
                    sql.replace(childComma, childComma + 2, "\n");
                }
                sql.append("  )) AS aggregated_data\n");
                sql.append("  FROM UNIPOST_ENTITIES c\n");
                if (child.effectiveJoinPattern() == com.unipost.domain.metadata.CompositeJoinPattern.PATTERN_B_FOREIGN_KEY) {
                    String fk = child.foreignKeyAttribute() != null ? child.foreignKeyAttribute() : "root_id";
                    sql.append("  WHERE c.entity_type_id = ").append(child.targetEntityTypeId() != null ? child.targetEntityTypeId() : 0).append("\n");
                    sql.append("    AND c.attributes->>'").append(fk).append("' = ").append(rootTableAlias).append(".id::text\n");
                } else {
                    sql.append("  INNER JOIN UNIPOST_ENTITY_RELATIONSHIPS r ON r.target_entity_id = c.id\n");
                    sql.append("  WHERE r.source_entity_id = ").append(rootTableAlias).append(".id\n");
                    if (child.relationshipTypeId() != null) {
                        sql.append("    AND r.relationship_type_id = ").append(child.relationshipTypeId()).append("\n");
                    }
                }
                sql.append(") ").append(childTableAlias).append(" ON TRUE\n");
                childIdx++;
            }
        }

        sql.append("WHERE ").append(rootTableAlias).append(".entity_type_id = ").append(spec.rootEntityTypeId() != null ? spec.rootEntityTypeId() : 0).append("\n");
        sql.append("  AND ").append(rootTableAlias).append(".tenant_id = current_setting('app.current_tenant', true);\n");

        return sql.toString();
    }
}
