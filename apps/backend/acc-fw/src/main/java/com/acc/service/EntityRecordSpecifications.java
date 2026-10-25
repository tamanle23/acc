package com.acc.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.domain.metadata.AttributeDefinition;
import com.acc.domain.metadata.EntityRecord;
import jakarta.persistence.criteria.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.jpa.domain.Specification;

import java.util.*;

/**
 * Enterprise JPA Specifications for querying {@link EntityRecord} instances.
 * <p>
 * Optimized for PostgreSQL JSONB:
 * <ul>
 *   <li>Exact-match equality (`eq`) filters are compiled into a composite JSON object
 *       and queried via the PostgreSQL JSONB containment operator ({@code @>}),
 *       leveraging the GIN index {@code idx_entities_attributes_gin (attributes jsonb_path_ops)}.</li>
 *   <li>Range (`gt`, `gte`, `lt`, `lte`), negation (`ne`), and pattern (`contains`, `in`)
 *       filters utilize {@code jsonb_extract_path_text}.</li>
 * </ul>
 */
public class EntityRecordSpecifications {

    private static final Logger log = LoggerFactory.getLogger(EntityRecordSpecifications.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private EntityRecordSpecifications() {}

    public static Specification<EntityRecord> withFilters(
            Long entityTypeId,
            String tenantId,
            Map<String, Map<String, String>> filterParams,
            Map<String, AttributeDefinition> activeAttributes
    ) {
        return (Root<EntityRecord> root, CriteriaQuery<?> query, CriteriaBuilder cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // 1. EntityTypeId match
            predicates.add(cb.equal(root.get("entityType").get("id"), entityTypeId));

            // 2. Soft-delete check
            predicates.add(cb.isNull(root.get("deletedDate")));

            // 3. Tenancy check
            if (tenantId != null && !tenantId.isBlank()) {
                predicates.add(cb.equal(root.get("tenantId"), tenantId));
            }

            // 4. Attribute filters
            if (filterParams != null && !filterParams.isEmpty() && activeAttributes != null) {
                // Collect exact-match equality filters to assemble into JSONB containment (@>)
                Map<String, Object> equalityContainmentMap = new LinkedHashMap<>();

                for (Map.Entry<String, Map<String, String>> entry : filterParams.entrySet()) {
                    String attrName = entry.getKey();
                    AttributeDefinition attr = activeAttributes.get(attrName);

                    // Whitelist to defined, non-archived attributes only
                    if (attr == null || Boolean.TRUE.equals(attr.getIsArchived())) {
                        continue;
                    }

                    Map<String, String> ops = entry.getValue();
                    if (ops == null) continue;

                    String dataType = attr.getDataType() != null ? attr.getDataType().trim().toLowerCase() : "string";

                    for (Map.Entry<String, String> opEntry : ops.entrySet()) {
                        String op = opEntry.getKey().trim().toLowerCase();
                        String val = opEntry.getValue();
                        if (val == null) continue;

                        if ("eq".equals(op)) {
                            // Convert value according to data type for proper JSONB serialization
                            Object parsedVal = parseValueForJson(val, dataType);
                            equalityContainmentMap.put(attrName, parsedVal);
                        } else {
                            // Non-equality operators handled via jsonb_extract_path_text
                            Expression<String> jsonTextVal = cb.function(
                                    "jsonb_extract_path_text",
                                    String.class,
                                    root.get("attributes"),
                                    cb.literal(attrName)
                            );

                            switch (op) {
                                case "ne" -> predicates.add(cb.notEqual(jsonTextVal, val));
                                case "contains" -> predicates.add(cb.like(cb.lower(jsonTextVal), "%" + val.toLowerCase() + "%"));
                                case "gt", "gte", "lt", "lte" -> {
                                    if ("number".equals(dataType) || "integer".equals(dataType)) {
                                        try {
                                            Double numVal = Double.parseDouble(val);
                                            Expression<Double> castDouble = jsonTextVal.as(Double.class);
                                            switch (op) {
                                                case "gt" -> predicates.add(cb.greaterThan(castDouble, numVal));
                                                case "gte" -> predicates.add(cb.greaterThanOrEqualTo(castDouble, numVal));
                                                case "lt" -> predicates.add(cb.lessThan(castDouble, numVal));
                                                case "lte" -> predicates.add(cb.lessThanOrEqualTo(castDouble, numVal));
                                            }
                                        } catch (NumberFormatException ignored) {}
                                    } else {
                                        switch (op) {
                                            case "gt" -> predicates.add(cb.greaterThan(jsonTextVal, val));
                                            case "gte" -> predicates.add(cb.greaterThanOrEqualTo(jsonTextVal, val));
                                            case "lt" -> predicates.add(cb.lessThan(jsonTextVal, val));
                                            case "lte" -> predicates.add(cb.lessThanOrEqualTo(jsonTextVal, val));
                                        }
                                    }
                                }
                                case "in" -> {
                                    String[] parts = val.split(",");
                                    CriteriaBuilder.In<String> inClause = cb.in(jsonTextVal);
                                    for (String p : parts) {
                                        inClause.value(p.trim());
                                    }
                                    predicates.add(inClause);
                                }
                                default -> predicates.add(cb.equal(jsonTextVal, val));
                            }
                        }
                    }
                }

                // If any equality filters exist, compile them into a JSONB containment predicate:
                // attributes @> cast(? as jsonb)
                if (!equalityContainmentMap.isEmpty()) {
                    try {
                        String jsonCriteria = OBJECT_MAPPER.writeValueAsString(equalityContainmentMap);
                        // PostgreSQL JSONB containment expression via jsonb_contains SQL function
                        // Note: In PostgreSQL/Hibernate, jsonb_contains(a, b) evaluates 'a @> b'
                        predicates.add(cb.isTrue(
                                cb.function(
                                        "jsonb_contains",
                                        Boolean.class,
                                        root.get("attributes"),
                                        cb.literal(jsonCriteria)
                                )
                        ));
                    } catch (JsonProcessingException e) {
                        log.warn("Failed to serialize equality filters to JSON for containment query: {}", equalityContainmentMap, e);
                        // Fallback to jsonb_extract_path_text for individual equality predicates
                        for (Map.Entry<String, Object> eqEntry : equalityContainmentMap.entrySet()) {
                            Expression<String> jsonTextVal = cb.function(
                                    "jsonb_extract_path_text",
                                    String.class,
                                    root.get("attributes"),
                                    cb.literal(eqEntry.getKey())
                            );
                            predicates.add(cb.equal(jsonTextVal, String.valueOf(eqEntry.getValue())));
                        }
                    }
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static Object parseValueForJson(String val, String dataType) {
        if ("boolean".equals(dataType)) {
            return Boolean.parseBoolean(val);
        } else if ("number".equals(dataType) || "integer".equals(dataType)) {
            try {
                if (val.contains(".")) {
                    return Double.parseDouble(val);
                } else {
                    return Long.parseLong(val);
                }
            } catch (NumberFormatException ignored) {
                return val;
            }
        }
        return val;
    }
}
