package com.unipost.service.metadata.serialization;

import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.*;

/**
 * Server-side dynamic field-level security and PII masking.
 * Redacts or masks sensitive attributes based on requesting user's tenant roles.
 */
@Slf4j
public class FieldLevelSecuritySerializer {

    private static final Set<String> PII_FIELD_NAMES = Set.of(
            "ssn", "tax_id", "taxid", "card_number", "credit_card",
            "password", "secret", "salary", "bank_account", "bank_account_number"
    );

    /**
     * Inspects current security context and applies role-based data masking.
     * Admin: unmasked
     * Operator: partial mask (e.g. ****-1234)
     * Viewer / Other: [CONFIDENTIAL] or omitted
     */
    public static Map<String, Object> redactAttributesForCurrentContext(Map<String, Object> attributes) {
        if (attributes == null || attributes.isEmpty()) {
            return attributes;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            // Default to viewer masking
            return applyMasking(attributes, MaskLevel.VIEWER);
        }

        Collection<? extends GrantedAuthority> authorities = auth.getAuthorities();
        boolean isAdmin = authorities.stream().anyMatch(a -> {
            String role = a.getAuthority().toUpperCase();
            return role.contains("ADMIN") || role.contains("SYSTEM_CUSTODIAN");
        });

        if (isAdmin) {
            return attributes; // Full unmasked access
        }

        boolean isOperator = authorities.stream().anyMatch(a -> {
            String role = a.getAuthority().toUpperCase();
            return role.contains("OPERATOR") || role.contains("WRITE");
        });

        if (isOperator) {
            return applyMasking(attributes, MaskLevel.OPERATOR);
        }

        return applyMasking(attributes, MaskLevel.VIEWER);
    }

    public enum MaskLevel {
        ADMIN,
        OPERATOR,
        VIEWER
    }

    public static Map<String, Object> applyMasking(Map<String, Object> attributes, MaskLevel level) {
        if (attributes == null || attributes.isEmpty() || level == MaskLevel.ADMIN) {
            return attributes;
        }

        Map<String, Object> result = new HashMap<>();
        for (Map.Entry<String, Object> entry : attributes.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();

            if (isPiiField(key)) {
                if (level == MaskLevel.OPERATOR) {
                    result.put(key, maskOperatorValue(value));
                } else {
                    result.put(key, "[CONFIDENTIAL]");
                }
            } else {
                result.put(key, value);
            }
        }
        return result;
    }

    public static boolean isPiiField(String fieldName) {
        if (fieldName == null) return false;
        String lower = fieldName.toLowerCase().replace("-", "_").trim();
        if (PII_FIELD_NAMES.contains(lower)) {
            return true;
        }
        for (String pii : PII_FIELD_NAMES) {
            if (lower.contains(pii)) {
                return true;
            }
        }
        return false;
    }

    public static Object maskOperatorValue(Object value) {
        if (value == null) return null;
        String str = String.valueOf(value).trim();
        if (str.length() <= 4) {
            return "****";
        }
        String last4 = str.substring(str.length() - 4);
        return "****-" + last4;
    }
}
