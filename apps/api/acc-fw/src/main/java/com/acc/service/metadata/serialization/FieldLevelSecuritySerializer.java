package com.acc.service.metadata.serialization;

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
        return redactAttributesForCurrentContext(attributes, Collections.emptySet());
    }

    public static Map<String, Object> redactAttributesForCurrentContext(
            Map<String, Object> attributes,
            Set<String> schemaSensitiveFields
    ) {
        if (attributes == null || attributes.isEmpty()) {
            return attributes;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            // Default to viewer masking
            return applyMasking(attributes, MaskLevel.VIEWER, schemaSensitiveFields);
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
            return applyMasking(attributes, MaskLevel.OPERATOR, schemaSensitiveFields);
        }

        return applyMasking(attributes, MaskLevel.VIEWER, schemaSensitiveFields);
    }

    public enum MaskLevel {
        ADMIN,
        OPERATOR,
        VIEWER
    }

    public static Map<String, Object> applyMasking(Map<String, Object> attributes, MaskLevel level) {
        return applyMasking(attributes, level, Collections.emptySet());
    }

    public static Map<String, Object> applyMasking(
            Map<String, Object> attributes,
            MaskLevel level,
            Set<String> schemaSensitiveFields
    ) {
        if (attributes == null || attributes.isEmpty() || level == MaskLevel.ADMIN) {
            return attributes;
        }

        Set<String> explicitSensitive = schemaSensitiveFields != null ? schemaSensitiveFields : Collections.emptySet();
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : attributes.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();

            if (isPiiField(key) || explicitSensitive.contains(key)) {
                result.put(key, maskValueForLevel(value, level));
            } else {
                result.put(key, maskNestedObject(value, level, explicitSensitive));
            }
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private static Object maskNestedObject(Object value, MaskLevel level, Set<String> explicitSensitive) {
        if (value instanceof Map<?, ?> mapVal) {
            Map<String, Object> nestedMap = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : mapVal.entrySet()) {
                String k = String.valueOf(entry.getKey());
                Object v = entry.getValue();
                if (isPiiField(k) || explicitSensitive.contains(k)) {
                    nestedMap.put(k, maskValueForLevel(v, level));
                } else {
                    nestedMap.put(k, maskNestedObject(v, level, explicitSensitive));
                }
            }
            return nestedMap;
        } else if (value instanceof List<?> listVal) {
            List<Object> nestedList = new ArrayList<>(listVal.size());
            for (Object item : listVal) {
                nestedList.add(maskNestedObject(item, level, explicitSensitive));
            }
            return nestedList;
        }
        return value;
    }

    private static Object maskValueForLevel(Object value, MaskLevel level) {
        if (value == null) return null;
        if (level == MaskLevel.OPERATOR) {
            return maskOperatorValue(value);
        }
        return "[CONFIDENTIAL]";
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
