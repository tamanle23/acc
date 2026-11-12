package com.acc.workflow.core.schema;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class WorkflowSchemaValidatorTest {

    private WorkflowSchemaValidator validator;

    @BeforeEach
    void setUp() {
        validator = new WorkflowSchemaValidator();
    }

    @Test
    @DisplayName("Should pass valid payload matching Draft 7 schema")
    void testValidPayload() {
        Map<String, Object> schema = Map.of(
            "type", "object",
            "required", List.of("orderId", "amount"),
            "properties", Map.of(
                "orderId", Map.of("type", "string"),
                "amount", Map.of("type", "number"),
                "dryRun", Map.of("type", "boolean")
            ),
            "additionalProperties", false
        );

        Map<String, Object> payload = Map.of(
            "orderId", "ORD-1234",
            "amount", 99.95,
            "dryRun", false
        );

        List<WorkflowSchemaValidator.ValidationError> errors = validator.validate(payload, schema);
        assertTrue(errors.isEmpty(), "Should have no errors: " + errors);
        assertTrue(validator.isValid(payload, schema));
    }

    @Test
    @DisplayName("Should fail when required field is missing")
    void testMissingRequiredField() {
        Map<String, Object> schema = Map.of(
            "type", "object",
            "required", List.of("orderId", "amount"),
            "properties", Map.of(
                "orderId", Map.of("type", "string"),
                "amount", Map.of("type", "number")
            ),
            "additionalProperties", false
        );

        Map<String, Object> payload = Map.of(
            "orderId", "ORD-1234"
        );

        List<WorkflowSchemaValidator.ValidationError> errors = validator.validate(payload, schema);
        assertEquals(1, errors.size());
        assertEquals("amount", errors.get(0).field());
        assertEquals("REQUIRED", errors.get(0).rule());
        assertFalse(validator.isValid(payload, schema));
    }

    @Test
    @DisplayName("Should fail on type mismatch")
    void testTypeMismatch() {
        Map<String, Object> schema = Map.of(
            "type", "object",
            "required", List.of("amount"),
            "properties", Map.of(
                "amount", Map.of("type", "number")
            ),
            "additionalProperties", false
        );

        Map<String, Object> payload = Map.of(
            "amount", "NOT_A_NUMBER"
        );

        List<WorkflowSchemaValidator.ValidationError> errors = validator.validate(payload, schema);
        assertEquals(1, errors.size());
        assertEquals("amount", errors.get(0).field());
        assertEquals("TYPE_MISMATCH", errors.get(0).rule());
    }

    @Test
    @DisplayName("Should fail on additional undeclared properties when additionalProperties is false")
    void testAdditionalPropertiesFalse() {
        Map<String, Object> schema = Map.of(
            "type", "object",
            "properties", Map.of(
                "orderId", Map.of("type", "string")
            ),
            "additionalProperties", false
        );

        Map<String, Object> payload = Map.of(
            "orderId", "ORD-1234",
            "unauthorizedHack", "DROP TABLE users;"
        );

        List<WorkflowSchemaValidator.ValidationError> errors = validator.validate(payload, schema);
        assertEquals(1, errors.size());
        assertEquals("unauthorizedHack", errors.get(0).field());
        assertEquals("ADDITIONAL_PROPERTIES", errors.get(0).rule());
    }

    @Test
    @DisplayName("Should ignore internal engine flags prefixed with __")
    void testInternalEngineFlagsIgnored() {
        Map<String, Object> schema = Map.of(
            "type", "object",
            "properties", Map.of(
                "orderId", Map.of("type", "string")
            ),
            "additionalProperties", false
        );

        Map<String, Object> payload = Map.of(
            "orderId", "ORD-1234",
            "__breakpoints", List.of("task1"),
            "__stepOverNode", "task2"
        );

        List<WorkflowSchemaValidator.ValidationError> errors = validator.validate(payload, schema);
        assertTrue(errors.isEmpty(), "Should ignore __ prefixed keys: " + errors);
    }

    @Test
    @DisplayName("Should validate nested object properties recursively")
    void testNestedObjectValidation() {
        Map<String, Object> schema = Map.of(
            "type", "object",
            "properties", Map.of(
                "customer", Map.of(
                    "type", "object",
                    "required", List.of("email"),
                    "properties", Map.of(
                        "email", Map.of("type", "string")
                    ),
                    "additionalProperties", false
                )
            ),
            "additionalProperties", false
        );

        Map<String, Object> payload = Map.of(
            "customer", Map.of(
                "name", "Alice" // Missing email, has unexpected name
            )
        );

        List<WorkflowSchemaValidator.ValidationError> errors = validator.validate(payload, schema);
        assertEquals(2, errors.size());
        assertTrue(errors.stream().anyMatch(e -> "customer.email".equals(e.field()) && "REQUIRED".equals(e.rule())));
        assertTrue(errors.stream().anyMatch(e -> "customer.name".equals(e.field()) && "ADDITIONAL_PROPERTIES".equals(e.rule())));
    }
}
