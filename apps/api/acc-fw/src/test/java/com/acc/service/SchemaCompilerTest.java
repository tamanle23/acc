package com.acc.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.domain.metadata.AttributeDefinition;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SchemaCompilerTest {

    private SchemaCompiler schemaCompiler;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        schemaCompiler = new SchemaCompiler(objectMapper);
    }

    @Test
    void testCompileAllComponentTypes() {
        AttributeDefinition textAttr = new AttributeDefinition();
        textAttr.setSystemName("title");
        textAttr.setUiComponent("text");
        textAttr.setDataType("string");
        textAttr.setIsRequired(true);
        textAttr.setOptions(Map.of("minLength", 3, "maxLength", 50, "pattern", "^[A-Za-z0-9 ]+$"));

        AttributeDefinition numAttr = new AttributeDefinition();
        numAttr.setSystemName("amount");
        numAttr.setUiComponent("number");
        numAttr.setDataType("number");
        numAttr.setOptions(Map.of("minimum", 0.0, "maximum", 1000.0));

        AttributeDefinition switchAttr = new AttributeDefinition();
        switchAttr.setSystemName("enabled");
        switchAttr.setUiComponent("switch");
        switchAttr.setDataType("boolean");
        switchAttr.setDefaultValue("true");

        AttributeDefinition selectAttr = new AttributeDefinition();
        selectAttr.setSystemName("status");
        selectAttr.setUiComponent("select");
        selectAttr.setDataType("string");
        selectAttr.setOptions(Map.of("choices", List.of("PENDING", "ACTIVE", "ARCHIVED")));

        AttributeDefinition multiAttr = new AttributeDefinition();
        multiAttr.setSystemName("tags");
        multiAttr.setUiComponent("multiselect");
        multiAttr.setDataType("array");
        multiAttr.setOptions(Map.of("choices", List.of("urgent", "work", "home")));

        AttributeDefinition dateAttr = new AttributeDefinition();
        dateAttr.setSystemName("dueDate");
        dateAttr.setUiComponent("datepicker");
        dateAttr.setDataType("date");
        dateAttr.setOptions(Map.of("format", "date"));

        AttributeDefinition jsonAttr = new AttributeDefinition();
        jsonAttr.setSystemName("config");
        jsonAttr.setUiComponent("json_editor");
        jsonAttr.setDataType("json");

        AttributeDefinition relAttr = new AttributeDefinition();
        relAttr.setSystemName("departmentId");
        relAttr.setUiComponent("relation_picker");
        relAttr.setDataType("integer");

        AttributeDefinition archivedAttr = new AttributeDefinition();
        archivedAttr.setSystemName("legacyField");
        archivedAttr.setUiComponent("text");
        archivedAttr.setDataType("string");
        archivedAttr.setIsArchived(true);
        archivedAttr.setIsRequired(true);

        List<AttributeDefinition> attrs = List.of(
                textAttr, numAttr, switchAttr, selectAttr, multiAttr, dateAttr, jsonAttr, relAttr, archivedAttr
        );

        JsonNode schemaNode = schemaCompiler.compileNode(1L, 2L, attrs);

        assertNotNull(schemaNode);
        assertEquals("http://json-schema.org/draft-07/schema#", schemaNode.get("$schema").asText());
        assertEquals("object", schemaNode.get("type").asText());
        assertFalse(schemaNode.get("additionalProperties").asBoolean());

        JsonNode properties = schemaNode.get("properties");
        assertNotNull(properties);

        // Check text
        JsonNode title = properties.get("title");
        assertEquals("string", title.get("type").asText());
        assertEquals(3, title.get("minLength").asInt());
        assertEquals(50, title.get("maxLength").asInt());
        assertEquals("^[A-Za-z0-9 ]+$", title.get("pattern").asText());

        // Check number
        JsonNode amount = properties.get("amount");
        assertEquals("number", amount.get("type").asText());
        assertEquals(0.0, amount.get("minimum").asDouble());
        assertEquals(1000.0, amount.get("maximum").asDouble());

        // Check switch with default
        JsonNode enabled = properties.get("enabled");
        assertEquals("boolean", enabled.get("type").asText());
        assertTrue(enabled.get("default").asBoolean());

        // Check select enum
        JsonNode status = properties.get("status");
        assertEquals("string", status.get("type").asText());
        assertTrue(status.has("enum"));
        assertEquals(3, status.get("enum").size());

        // Check multiselect
        JsonNode tags = properties.get("tags");
        assertEquals("array", tags.get("type").asText());
        assertTrue(tags.get("uniqueItems").asBoolean());
        assertEquals("string", tags.get("items").get("type").asText());
        assertEquals(3, tags.get("items").get("enum").size());

        // Check datepicker
        JsonNode dueDate = properties.get("dueDate");
        assertEquals("string", dueDate.get("type").asText());
        assertEquals("date", dueDate.get("format").asText());

        // Check json editor
        JsonNode config = properties.get("config");
        assertEquals("object", config.get("type").asText());

        // Check relation picker
        JsonNode departmentId = properties.get("departmentId");
        assertEquals("integer", departmentId.get("type").asText());

        // Check archived field is excluded
        assertNull(properties.get("legacyField"));

        // Check required fields
        JsonNode required = schemaNode.get("required");
        assertNotNull(required);
        assertEquals(1, required.size());
        assertEquals("title", required.get(0).asText());
    }

    @Test
    void testCompile_ReturnsSerializedString() {
        AttributeDefinition attr = new AttributeDefinition();
        attr.setSystemName("name");
        attr.setUiComponent("text");
        attr.setDataType("string");

        String json = schemaCompiler.compile(1L, 1L, List.of(attr));
        assertNotNull(json);
        assertTrue(json.contains("\"type\":\"object\""));
        assertTrue(json.contains("\"name\""));
    }

    @Test
    void testCompileNode_DataTypeFallbacksAndRelationPickerString() {
        AttributeDefinition relString = new AttributeDefinition();
        relString.setSystemName("parentCode");
        relString.setUiComponent("relation_picker");
        relString.setDataType("string");

        AttributeDefinition dateDefault = new AttributeDefinition();
        dateDefault.setSystemName("created");
        dateDefault.setUiComponent("datepicker");

        AttributeDefinition boolFallback = new AttributeDefinition();
        boolFallback.setSystemName("flag");
        boolFallback.setDataType("boolean");

        AttributeDefinition intFallback = new AttributeDefinition();
        intFallback.setSystemName("count");
        intFallback.setDataType("integer");
        intFallback.setDefaultValue("10");

        AttributeDefinition numFallback = new AttributeDefinition();
        numFallback.setSystemName("ratio");
        numFallback.setDataType("number");
        numFallback.setDefaultValue("1.5");

        AttributeDefinition arrFallback = new AttributeDefinition();
        arrFallback.setSystemName("list");
        arrFallback.setDataType("array");

        AttributeDefinition jsonFallback = new AttributeDefinition();
        jsonFallback.setSystemName("rawJson");
        jsonFallback.setDataType("json");

        AttributeDefinition dateFallback = new AttributeDefinition();
        dateFallback.setSystemName("eventDate");
        dateFallback.setDataType("date");

        AttributeDefinition defaultFallback = new AttributeDefinition();
        defaultFallback.setSystemName("desc");
        defaultFallback.setDataType("unknown_type");
        defaultFallback.setDefaultValue("default desc");

        AttributeDefinition badDefault = new AttributeDefinition();
        badDefault.setSystemName("badNum");
        badDefault.setDataType("integer");
        badDefault.setDefaultValue("not-a-number");

        List<AttributeDefinition> attrs = List.of(
                relString, dateDefault, boolFallback, intFallback, numFallback,
                arrFallback, jsonFallback, dateFallback, defaultFallback, badDefault
        );

        JsonNode root = schemaCompiler.compileNode(1L, 1L, attrs);
        JsonNode props = root.get("properties");

        assertEquals("string", props.get("parentCode").get("type").asText());
        assertEquals("date-time", props.get("created").get("format").asText());
        assertEquals("boolean", props.get("flag").get("type").asText());
        assertEquals("integer", props.get("count").get("type").asText());
        assertEquals(10, props.get("count").get("default").asInt());
        assertEquals("number", props.get("ratio").get("type").asText());
        assertEquals(1.5, props.get("ratio").get("default").asDouble());
        assertEquals("array", props.get("list").get("type").asText());
        assertEquals("object", props.get("rawJson").get("type").asText());
        assertEquals("string", props.get("eventDate").get("type").asText());
        assertEquals("string", props.get("desc").get("type").asText());
        assertEquals("default desc", props.get("desc").get("default").asText());
        assertEquals("not-a-number", props.get("badNum").get("default").asText());
    }
}
