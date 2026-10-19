package com.unipost.service.metadata.serialization;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class FieldLevelSecuritySerializerTest {

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void testRedactAttributes_AdminRole_ReturnsUnmaskedAttributes() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin", "pass", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")))
        );

        Map<String, Object> input = Map.of(
                "companyName", "Acme Corp",
                "ssn", "123-45-6789",
                "salary", 150000,
                "credit_card", "4111222233334444"
        );

        Map<String, Object> output = FieldLevelSecuritySerializer.redactAttributesForCurrentContext(input);

        assertEquals("Acme Corp", output.get("companyName"));
        assertEquals("123-45-6789", output.get("ssn"));
        assertEquals(150000, output.get("salary"));
        assertEquals("4111222233334444", output.get("credit_card"));
    }

    @Test
    void testRedactAttributes_OperatorRole_ReturnsPartiallyMaskedPii() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("operator", "pass", List.of(new SimpleGrantedAuthority("ROLE_OPERATOR")))
        );

        Map<String, Object> input = Map.of(
                "companyName", "Acme Corp",
                "ssn", "123-45-6789",
                "shortSecret", "123",
                "credit_card", "4111222233334444"
        );

        Map<String, Object> output = FieldLevelSecuritySerializer.redactAttributesForCurrentContext(input);

        assertEquals("Acme Corp", output.get("companyName"));
        assertEquals("****-6789", output.get("ssn"));
        assertEquals("****-4444", output.get("credit_card"));
        assertEquals("****", output.get("shortSecret"));
    }

    @Test
    void testRedactAttributes_ViewerRole_ReturnsConfidentialMaskedPii() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("viewer", "pass", List.of(new SimpleGrantedAuthority("ROLE_VIEWER")))
        );

        Map<String, Object> input = Map.of(
                "companyName", "Acme Corp",
                "ssn", "123-45-6789",
                "credit_card", "4111222233334444"
        );

        Map<String, Object> output = FieldLevelSecuritySerializer.redactAttributesForCurrentContext(input);

        assertEquals("Acme Corp", output.get("companyName"));
        assertEquals("[CONFIDENTIAL]", output.get("ssn"));
        assertEquals("[CONFIDENTIAL]", output.get("credit_card"));
    }

    @Test
    void testRedactAttributes_Unauthenticated_DefaultsToViewerMasking() {
        SecurityContextHolder.clearContext();

        Map<String, Object> input = Map.of(
                "userName", "anonymousUser",
                "tax_id", "99-8877665"
        );

        Map<String, Object> output = FieldLevelSecuritySerializer.redactAttributesForCurrentContext(input);

        assertEquals("anonymousUser", output.get("userName"));
        assertEquals("[CONFIDENTIAL]", output.get("tax_id"));
    }

    @Test
    void testRedactAttributes_NullOrEmpty_ReturnsAsIs() {
        assertNull(FieldLevelSecuritySerializer.redactAttributesForCurrentContext(null));
        assertTrue(FieldLevelSecuritySerializer.redactAttributesForCurrentContext(Map.of()).isEmpty());
    }

    @Test
    void testIsPiiField_VariousFormatsDetected() {
        assertTrue(FieldLevelSecuritySerializer.isPiiField("ssn"));
        assertTrue(FieldLevelSecuritySerializer.isPiiField("SSN"));
        assertTrue(FieldLevelSecuritySerializer.isPiiField("tax-id"));
        assertTrue(FieldLevelSecuritySerializer.isPiiField("credit_card"));
        assertTrue(FieldLevelSecuritySerializer.isPiiField("employee_salary"));
        assertTrue(FieldLevelSecuritySerializer.isPiiField("bank_account_number"));

        assertFalse(FieldLevelSecuritySerializer.isPiiField(null));
        assertFalse(FieldLevelSecuritySerializer.isPiiField("name"));
        assertFalse(FieldLevelSecuritySerializer.isPiiField("description"));
        assertFalse(FieldLevelSecuritySerializer.isPiiField("status"));
    }

    @Test
    void testMaskOperatorValue_EdgeCases() {
        assertNull(FieldLevelSecuritySerializer.maskOperatorValue(null));
        assertEquals("****", FieldLevelSecuritySerializer.maskOperatorValue(""));
        assertEquals("****", FieldLevelSecuritySerializer.maskOperatorValue("abc"));
        assertEquals("****", FieldLevelSecuritySerializer.maskOperatorValue("1234"));
        assertEquals("****-5678", FieldLevelSecuritySerializer.maskOperatorValue("12345678"));
    }
}
