package com.acc.presentation.dto.metadata;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MetadataDtoValidationTest {

    private static Validator validator;

    @BeforeAll
    static void initValidator() {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @Test
    void testCreateEntityTypeRequest_Valid() {
        CreateEntityTypeRequest valid = new CreateEntityTypeRequest("order_item", "Order Item", "Description");
        Set<ConstraintViolation<CreateEntityTypeRequest>> violations = validator.validate(valid);
        assertTrue(violations.isEmpty());
    }

    @Test
    void testCreateEntityTypeRequest_InvalidSystemName() {
        CreateEntityTypeRequest invalid = new CreateEntityTypeRequest("123_invalid", "Invalid", "Description");
        Set<ConstraintViolation<CreateEntityTypeRequest>> violations = validator.validate(invalid);
        assertFalse(violations.isEmpty());

        CreateEntityTypeRequest uppercase = new CreateEntityTypeRequest("OrderItem", "Invalid", "Description");
        violations = validator.validate(uppercase);
        assertFalse(violations.isEmpty());
    }

    @Test
    void testCreateAttributeRequest_Valid() {
        CreateAttributeRequest valid = new CreateAttributeRequest("first_name", "First Name", "string", "text", true, false, null, null);
        Set<ConstraintViolation<CreateAttributeRequest>> violations = validator.validate(valid);
        assertTrue(violations.isEmpty());
    }

    @Test
    void testCreateAttributeRequest_MissingRequiredFields() {
        CreateAttributeRequest invalid = new CreateAttributeRequest("", "", "", "", null, null, null, null);
        Set<ConstraintViolation<CreateAttributeRequest>> violations = validator.validate(invalid);
        assertFalse(violations.isEmpty());
    }
}
