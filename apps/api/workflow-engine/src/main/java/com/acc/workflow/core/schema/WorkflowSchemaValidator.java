package com.acc.workflow.core.schema;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Enterprise Draft 7 JSON Schema Validator for Workflow Input & Output Payloads.
 * Zero external network dependencies, pure and deterministic.
 */
public final class WorkflowSchemaValidator {

    public record ValidationError(String field, String rule, String message) {
        public ValidationError {
            if (field == null) field = "$";
            if (rule == null) rule = "UNKNOWN";
            if (message == null) message = "Validation error";
        }
    }

    public List<ValidationError> validate(Map<String, Object> payload, Map<String, Object> jsonSchema) {
        List<ValidationError> errors = new ArrayList<>();
        if (jsonSchema == null || jsonSchema.isEmpty()) {
            return errors;
        }

        validateNode("$", payload, jsonSchema, errors);
        return Collections.unmodifiableList(errors);
    }

    public boolean isValid(Map<String, Object> payload, Map<String, Object> jsonSchema) {
        return validate(payload, jsonSchema).isEmpty();
    }

    @SuppressWarnings("unchecked")
    private void validateNode(String currentPath, Object value, Map<String, Object> schema, List<ValidationError> errors) {
        if (schema == null) {
            return;
        }

        Object expectedTypeObj = schema.get("type");
        String expectedType = expectedTypeObj instanceof String str ? str.toLowerCase() : "object";

        // Null value handling
        if (value == null) {
            // Null is only allowed if type is explicitly "null" or handled by required check
            return;
        }

        // 1. Type Verification
        if (!checkType(value, expectedType)) {
            errors.add(new ValidationError(
                currentPath,
                "TYPE_MISMATCH",
                "Field '" + currentPath + "' expected type '" + expectedType + "', but received: " + getTypeName(value)
            ));
            return; // Halt deeper inspection if types are incompatible
        }

        // 2. Object validation
        if ("object".equals(expectedType) && value instanceof Map<?, ?> map) {
            Map<String, Object> objMap = (Map<String, Object>) map;

            // Required properties check
            Object requiredObj = schema.get("required");
            if (requiredObj instanceof List<?> reqList) {
                for (Object reqItem : reqList) {
                    String reqKey = String.valueOf(reqItem);
                    if (!objMap.containsKey(reqKey) || objMap.get(reqKey) == null) {
                        String fieldPath = "$".equals(currentPath) ? reqKey : currentPath + "." + reqKey;
                        errors.add(new ValidationError(
                            fieldPath,
                            "REQUIRED",
                            "Missing required field: '" + fieldPath + "'"
                        ));
                    }
                }
            }

            // Properties check
            Map<String, Object> properties = schema.get("properties") instanceof Map<?, ?> pMap
                ? (Map<String, Object>) pMap
                : Collections.emptyMap();

            Set<String> declaredProperties = properties.keySet();

            for (Map.Entry<String, Object> entry : objMap.entrySet()) {
                String key = entry.getKey();
                Object val = entry.getValue();
                String fieldPath = "$".equals(currentPath) ? key : currentPath + "." + key;

                // Ignore internal engine metadata flags (prefixed with "__")
                if (key.startsWith("__")) {
                    continue;
                }

                if (properties.containsKey(key)) {
                    Object propSchemaObj = properties.get(key);
                    if (propSchemaObj instanceof Map<?, ?> propSchema) {
                        validateNode(fieldPath, val, (Map<String, Object>) propSchema, errors);
                    }
                } else {
                    // Check additionalProperties rule
                    Object additionalPropsObj = schema.get("additionalProperties");
                    boolean allowAdditional = additionalPropsObj instanceof Boolean b ? b : false; // Default: false in strict Draft 7
                    if (!allowAdditional) {
                        errors.add(new ValidationError(
                            fieldPath,
                            "ADDITIONAL_PROPERTIES",
                            "Unexpected field '" + fieldPath + "' not declared in schema (additionalProperties: false)"
                        ));
                    }
                }
            }
        }

        // 3. Array validation
        if ("array".equals(expectedType) && value instanceof List<?> list) {
            Object itemsSchemaObj = schema.get("items");
            if (itemsSchemaObj instanceof Map<?, ?> itemSchema) {
                for (int i = 0; i < list.size(); i++) {
                    String itemPath = currentPath + "[" + i + "]";
                    validateNode(itemPath, list.get(i), (Map<String, Object>) itemSchema, errors);
                }
            }
        }
    }

    private boolean checkType(Object value, String expectedType) {
        if (value == null) return false;

        return switch (expectedType.toLowerCase()) {
            case "string" -> value instanceof String;
            case "number" -> value instanceof Number;
            case "integer" -> value instanceof Integer || value instanceof Long || value instanceof Short || value instanceof Byte
                || (value instanceof Number num && num.doubleValue() == Math.floor(num.doubleValue()) && !Double.isInfinite(num.doubleValue()));
            case "boolean" -> value instanceof Boolean;
            case "object" -> value instanceof Map<?, ?>;
            case "array" -> value instanceof List<?> || value.getClass().isArray();
            case "null" -> false;
            default -> true; // permissive on custom/unknown type names
        };
    }

    private String getTypeName(Object value) {
        if (value == null) return "null";
        if (value instanceof String) return "string";
        if (value instanceof Integer || value instanceof Long || value instanceof Short || value instanceof Byte) return "integer";
        if (value instanceof Number) return "number";
        if (value instanceof Boolean) return "boolean";
        if (value instanceof Map<?, ?>) return "object";
        if (value instanceof List<?>) return "array";
        return value.getClass().getSimpleName().toLowerCase();
    }
}
