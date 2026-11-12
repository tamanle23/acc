package com.acc.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.acc.domain.metadata.AttributeDefinition;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Component
public class SchemaCompiler {

    private final ObjectMapper objectMapper;

    public SchemaCompiler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String compile(Long entityTypeId, Long schemaVersion, List<AttributeDefinition> attributes) {
        ObjectNode root = compileNode(entityTypeId, schemaVersion, attributes);
        try {
            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize compiled JSON schema for entityTypeId: " + entityTypeId, e);
        }
    }

    public ObjectNode compileNode(Long entityTypeId, Long schemaVersion, List<AttributeDefinition> attributes) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("$schema", "http://json-schema.org/draft-07/schema#");
        root.put("type", "object");
        root.put("additionalProperties", false);

        ObjectNode properties = objectMapper.createObjectNode();

        if (attributes != null) {
            for (AttributeDefinition attr : attributes) {
                // Exclude archived attributes from properties
                if (Boolean.TRUE.equals(attr.getIsArchived())) {
                    continue;
                }

                ObjectNode prop = objectMapper.createObjectNode();
                String uiComponent = attr.getUiComponent() != null ? attr.getUiComponent().trim().toLowerCase() : "";
                String dataType = attr.getDataType() != null ? attr.getDataType().trim().toLowerCase() : "";
                Map<String, Object> options = attr.getOptions() != null ? attr.getOptions() : Map.of();

                // 1. Map type and format/constraints
                switch (uiComponent) {
                    case "switch" -> prop.put("type", "boolean");
                    case "number" -> {
                        prop.put("type", "integer".equals(dataType) ? "integer" : "number");
                        applyNumberConstraints(prop, options);
                    }
                    case "select" -> {
                        prop.put("type", "string");
                        applyEnumChoices(prop, options);
                    }
                    case "multiselect" -> {
                        prop.put("type", "array");
                        prop.put("uniqueItems", true);
                        ObjectNode items = objectMapper.createObjectNode();
                        items.put("type", "string");
                        applyEnumChoices(items, options);
                        prop.set("items", items);
                    }
                    case "datepicker" -> {
                        prop.put("type", "string");
                        String format = (String) options.getOrDefault("format", "date-time");
                        prop.put("format", "date".equalsIgnoreCase(format) ? "date" : "date-time");
                    }
                    case "json_editor" -> {
                        prop.put("type", "object");
                    }
                    case "relation_picker" -> {
                        if ("integer".equals(dataType) || "number".equals(dataType)) {
                            prop.put("type", "integer");
                        } else {
                            prop.put("type", "string");
                        }
                    }
                    case "textarea", "text" -> {
                        prop.put("type", "string");
                        applyStringConstraints(prop, options);
                    }
                    default -> {
                        // Fallback based on dataType
                        switch (dataType) {
                            case "boolean" -> prop.put("type", "boolean");
                            case "number", "integer" -> {
                                prop.put("type", "integer".equals(dataType) ? "integer" : "number");
                                applyNumberConstraints(prop, options);
                            }
                            case "array" -> {
                                prop.put("type", "array");
                                prop.put("uniqueItems", true);
                            }
                            case "json" -> prop.put("type", "object");
                            default -> {
                                prop.put("type", "string");
                                applyStringConstraints(prop, options);
                            }
                        }
                    }
                }

                // 2. Default value
                if (attr.getDefaultValue() != null && !attr.getDefaultValue().isBlank()) {
                    applyDefaultValue(prop, attr.getDefaultValue(), prop.path("type").asText());
                }

                properties.set(attr.getSystemName(), prop);
            }
        }

        root.set("properties", properties);

        // Required fields (excluding archived)
        if (attributes != null) {
            List<String> requiredFields = attributes.stream()
                    .filter(attr -> Boolean.TRUE.equals(attr.getIsRequired()) && !Boolean.TRUE.equals(attr.getIsArchived()))
                    .map(AttributeDefinition::getSystemName)
                    .collect(Collectors.toList());

            if (!requiredFields.isEmpty()) {
                root.set("required", objectMapper.valueToTree(requiredFields));
            }
        }

        return root;
    }

    private void applyStringConstraints(ObjectNode prop, Map<String, Object> options) {
        if (options.containsKey("pattern") && options.get("pattern") != null) {
            prop.put("pattern", options.get("pattern").toString());
        }
        if (options.containsKey("minLength") && options.get("minLength") instanceof Number min) {
            prop.put("minLength", min.intValue());
        }
        if (options.containsKey("maxLength") && options.get("maxLength") instanceof Number max) {
            prop.put("maxLength", max.intValue());
        }
    }

    private void applyNumberConstraints(ObjectNode prop, Map<String, Object> options) {
        if (options.containsKey("minimum") && options.get("minimum") instanceof Number min) {
            prop.put("minimum", min.doubleValue());
        }
        if (options.containsKey("maximum") && options.get("maximum") instanceof Number max) {
            prop.put("maximum", max.doubleValue());
        }
    }

    @SuppressWarnings("unchecked")
    private void applyEnumChoices(ObjectNode node, Map<String, Object> options) {
        Object choicesObj = options.get("choices");
        if (choicesObj instanceof List<?> list) {
            ArrayNode enumArray = objectMapper.createArrayNode();
            for (Object item : list) {
                if (item != null) {
                    enumArray.add(item.toString());
                }
            }
            if (!enumArray.isEmpty()) {
                node.set("enum", enumArray);
            }
        }
    }

    private void applyDefaultValue(ObjectNode prop, String defaultValueStr, String type) {
        try {
            switch (type) {
                case "boolean" -> prop.put("default", Boolean.parseBoolean(defaultValueStr));
                case "integer" -> prop.put("default", Long.parseLong(defaultValueStr.trim()));
                case "number" -> prop.put("default", Double.parseDouble(defaultValueStr.trim()));
                default -> prop.put("default", defaultValueStr);
            }
        } catch (Exception e) {
            prop.put("default", defaultValueStr);
        }
    }
}
