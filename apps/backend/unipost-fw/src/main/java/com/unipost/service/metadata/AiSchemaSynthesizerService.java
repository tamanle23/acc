package com.unipost.service.metadata;

import com.unipost.service.metadata.serialization.FieldLevelSecuritySerializer;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Deterministic JSON AST & Domain Heuristics Schema Synthesizer.
 * Generates structured AttributeDefinition blueprints, JSON Schema validation rules,
 * FLS PII classifications, and recommended FSM lifecycle state machines without external LLM calls.
 */
@Service
public class AiSchemaSynthesizerService {

    private static final Pattern ISO_DATE_PATTERN = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}([T\\s]\\d{2}:\\d{2}.*)?$");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern URL_PATTERN = Pattern.compile("^https?://.+", Pattern.CASE_INSENSITIVE);
    private static final Pattern UUID_PATTERN = Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    public record SynthesizeSchemaRequest(
        String prompt,
        Map<String, Object> sampleJson,
        String domainHint
    ) {}

    public record ProposedAttributeDto(
        String name,
        String systemName,
        String dataType,
        String uiComponent,
        boolean isRequired,
        boolean isUnique,
        boolean isIndexed,
        boolean isSensitive,
        int displayOrder,
        String description,
        Map<String, Object> validationRules
    ) {}

    public record SynthesizedSchemaBlueprint(
        String suggestedEntityName,
        String suggestedSystemName,
        String detectedDomain,
        List<ProposedAttributeDto> attributes,
        Map<String, Object> recommendedLifecycleConfig
    ) {}

    public SynthesizedSchemaBlueprint synthesize(SynthesizeSchemaRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("SynthesizeSchemaRequest cannot be null");
        }

        List<ProposedAttributeDto> attributes = new ArrayList<>();
        Set<String> seenSystemNames = new HashSet<>();
        String detectedDomain = detectDomain(request.prompt(), request.domainHint());

        // 1. If sampleJson is provided, infer attributes from JSON AST first
        if (request.sampleJson() != null && !request.sampleJson().isEmpty()) {
            int order = 1;
            for (Map.Entry<String, Object> entry : request.sampleJson().entrySet()) {
                String rawKey = entry.getKey();
                if (rawKey == null || rawKey.isBlank()) continue;
                String sysName = toSnakeCase(rawKey);
                if (seenSystemNames.add(sysName)) {
                    attributes.add(inferFromJsonEntry(rawKey, sysName, entry.getValue(), order++));
                }
            }
        }

        // 2. If prompt is provided, synthesize domain-specific and token-matched attributes
        if (request.prompt() != null && !request.prompt().isBlank()) {
            List<ProposedAttributeDto> domainAttrs = synthesizeFromPrompt(request.prompt(), detectedDomain, attributes.size() + 1);
            for (ProposedAttributeDto attr : domainAttrs) {
                if (seenSystemNames.add(attr.systemName())) {
                    attributes.add(attr);
                }
            }
        }

        // 3. Fallback default if both were empty
        if (attributes.isEmpty()) {
            attributes.add(new ProposedAttributeDto(
                "Title", "title", "TEXT", "input", true, false, true, false, 1,
                "Primary display title", Map.of("minLength", 2, "maxLength", 200)
            ));
            attributes.add(new ProposedAttributeDto(
                "Status", "status", "ENUM", "select", true, false, true, false, 2,
                "Current lifecycle state", Map.of("enum", List.of("DRAFT", "ACTIVE", "ARCHIVED"))
            ));
        }

        String entityName = inferEntityName(request.prompt(), detectedDomain);
        String systemName = toSnakeCase(entityName);
        Map<String, Object> lifecycle = buildRecommendedLifecycle(detectedDomain);

        return new SynthesizedSchemaBlueprint(
            entityName,
            systemName,
            detectedDomain,
            Collections.unmodifiableList(attributes),
            lifecycle
        );
    }

    private ProposedAttributeDto inferFromJsonEntry(String rawKey, String sysName, Object value, int order) {
        String label = toTitleCase(sysName);
        boolean isPii = FieldLevelSecuritySerializer.isPiiField(sysName);
        Map<String, Object> rules = new LinkedHashMap<>();
        if (isPii) {
            rules.put("pii", true);
        }

        if (value instanceof Boolean) {
            return new ProposedAttributeDto(
                label, sysName, "BOOLEAN", "switch", false, false, false, isPii, order,
                "Inferred boolean flag from sample JSON", rules
            );
        }

        if (value instanceof Number) {
            rules.put("minimum", 0);
            return new ProposedAttributeDto(
                label, sysName, "NUMBER", "number", true, false, sysName.endsWith("_id") || sysName.contains("amount") || sysName.contains("price"),
                isPii, order, "Inferred numeric field from sample JSON", rules
            );
        }

        if (value instanceof Map<?, ?> || value instanceof List<?>) {
            Map<String, Object> jsonSchema = inferJsonSchemaAst(value);
            rules.put("jsonSchema", jsonSchema);
            return new ProposedAttributeDto(
                label, sysName, "JSON", "json_editor", false, false, false, isPii, order,
                "Structured JSONB object/array with inferred JSON Schema", rules
            );
        }

        String strVal = value != null ? String.valueOf(value).trim() : "";
        if (ISO_DATE_PATTERN.matcher(strVal).matches() || sysName.endsWith("_date") || sysName.endsWith("_at")) {
            return new ProposedAttributeDto(
                label, sysName, "DATETIME", "date_picker", false, false, true, isPii, order,
                "ISO-8601 date/timestamp attribute", rules
            );
        }

        if (EMAIL_PATTERN.matcher(strVal).matches() || sysName.contains("email")) {
            rules.put("pattern", "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
            return new ProposedAttributeDto(
                label, sysName, "TEXT", "email", true, sysName.equals("email"), true, true, order,
                "Validated email address", rules
            );
        }

        if (URL_PATTERN.matcher(strVal).matches() || sysName.endsWith("_url") || sysName.contains("website")) {
            return new ProposedAttributeDto(
                label, sysName, "TEXT", "url", false, false, false, isPii, order,
                "URL endpoint or resource link", rules
            );
        }

        if (sysName.equals("status") || sysName.equals("state") || sysName.equals("priority") || sysName.equals("tier")) {
            List<String> options = strVal.isEmpty()
                ? List.of("DRAFT", "PENDING", "ACTIVE", "COMPLETED")
                : List.of(strVal.toUpperCase(), "PENDING", "ACTIVE", "ARCHIVED").stream().distinct().toList();
            rules.put("enum", options);
            return new ProposedAttributeDto(
                label, sysName, "ENUM", "select", true, false, true, isPii, order,
                "Enumerated classification state", rules
            );
        }

        boolean isUnique = UUID_PATTERN.matcher(strVal).matches() || sysName.endsWith("_code") || sysName.equals("sku");
        String uiComp = strVal.length() > 120 || sysName.contains("description") || sysName.contains("notes")
            ? "textarea"
            : "input";

        return new ProposedAttributeDto(
            label, sysName, "TEXT", uiComp, !strVal.isEmpty(), isUnique, isUnique || sysName.endsWith("_id"),
            isPii, order, "Inferred text attribute from sample payload", rules
        );
    }

    private Map<String, Object> inferJsonSchemaAst(Object value) {
        Map<String, Object> schema = new LinkedHashMap<>();
        if (value instanceof Map<?, ?> mapVal) {
            schema.put("type", "object");
            Map<String, Object> properties = new LinkedHashMap<>();
            List<String> required = new ArrayList<>();
            for (Map.Entry<?, ?> entry : mapVal.entrySet()) {
                String k = String.valueOf(entry.getKey());
                Object v = entry.getValue();
                properties.put(k, inferJsonSchemaAst(v));
                if (v != null) {
                    required.add(k);
                }
            }
            schema.put("properties", properties);
            if (!required.isEmpty()) {
                schema.put("required", required);
            }
        } else if (value instanceof List<?> listVal) {
            schema.put("type", "array");
            if (!listVal.isEmpty()) {
                schema.put("items", inferJsonSchemaAst(listVal.get(0)));
            } else {
                schema.put("items", Map.of("type", "string"));
            }
        } else if (value instanceof Boolean) {
            schema.put("type", "boolean");
        } else if (value instanceof Number) {
            schema.put("type", "number");
        } else {
            schema.put("type", "string");
        }
        return schema;
    }

    private String detectDomain(String prompt, String domainHint) {
        String combined = ((prompt != null ? prompt : "") + " " + (domainHint != null ? domainHint : "")).toLowerCase();
        if (combined.contains("order") || combined.contains("ecommerce") || combined.contains("cart") || combined.contains("fulfillment")) {
            return "ECOMMERCE_ORDER";
        }
        if (combined.contains("loan") || combined.contains("payment") || combined.contains("fintech") || combined.contains("credit") || combined.contains("billing")) {
            return "FINTECH_PAYMENT";
        }
        if (combined.contains("patient") || combined.contains("medical") || combined.contains("healthcare") || combined.contains("clinic")) {
            return "HEALTHCARE_PATIENT";
        }
        if (combined.contains("shipment") || combined.contains("logistics") || combined.contains("inventory") || combined.contains("warehouse") || combined.contains("fleet")) {
            return "SUPPLY_CHAIN_LOGISTICS";
        }
        if (combined.contains("vendor") || combined.contains("supplier") || combined.contains("compliance") || combined.contains("contract")) {
            return "VENDOR_GOVERNANCE";
        }
        if (combined.contains("employee") || combined.contains("payroll") || combined.contains("hr") || combined.contains("salary")) {
            return "HR_WORKFORCE";
        }
        return "ENTERPRISE_CORE";
    }

    private List<ProposedAttributeDto> synthesizeFromPrompt(String prompt, String domain, int startOrder) {
        List<ProposedAttributeDto> list = new ArrayList<>();
        int order = startOrder;
        String lower = prompt.toLowerCase();

        switch (domain) {
            case "VENDOR_GOVERNANCE" -> {
                list.add(new ProposedAttributeDto("Vendor Legal Name", "vendor_name", "TEXT", "input", true, true, true, false, order++, "Registered corporate name", Map.of("minLength", 2)));
                list.add(new ProposedAttributeDto("Tax Identification Number", "tax_id", "TEXT", "input", true, true, true, true, order++, "Corporate Tax ID / EIN (FLS Protected)", Map.of("pii", true)));
                list.add(new ProposedAttributeDto("Bank Account IBAN", "bank_account_number", "TEXT", "input", false, false, false, true, order++, "Settlement bank account (FLS Protected)", Map.of("pii", true)));
                list.add(new ProposedAttributeDto("Risk Tier", "risk_tier", "ENUM", "select", true, false, true, false, order++, "Compliance risk classification", Map.of("enum", List.of("LOW", "MEDIUM", "HIGH", "CRITICAL"))));
                list.add(new ProposedAttributeDto("SLA Configuration", "sla_config", "JSON", "json_editor", false, false, false, false, order++, "Service level agreement thresholds", Map.of("jsonSchema", Map.of("type", "object", "required", List.of("uptimePercent", "responseTimeMinutes"), "properties", Map.of("uptimePercent", Map.of("type", "number"), "responseTimeMinutes", Map.of("type", "number"))))));
            }
            case "ECOMMERCE_ORDER" -> {
                list.add(new ProposedAttributeDto("Order Number", "order_number", "TEXT", "input", true, true, true, false, order++, "Unique order reference code", Map.of("minLength", 4)));
                list.add(new ProposedAttributeDto("Customer Email", "customer_email", "TEXT", "email", true, false, true, true, order++, "Customer contact email (FLS Protected)", Map.of("pii", true, "pattern", "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")));
                list.add(new ProposedAttributeDto("Total Amount", "total_amount", "NUMBER", "number", true, false, true, false, order++, "Order total in tenant currency", Map.of("minimum", 0)));
                list.add(new ProposedAttributeDto("Order Status", "order_status", "ENUM", "select", true, false, true, false, order++, "Fulfillment lifecycle stage", Map.of("enum", List.of("PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"))));
                list.add(new ProposedAttributeDto("Line Items", "line_items", "JSON", "json_editor", true, false, false, false, order++, "Structured order line items array", Map.of("jsonSchema", Map.of("type", "array", "items", Map.of("type", "object", "required", List.of("sku", "qty", "unitPrice"), "properties", Map.of("sku", Map.of("type", "string"), "qty", Map.of("type", "number", "minimum", 1), "unitPrice", Map.of("type", "number", "minimum", 0)))))));
            }
            case "FINTECH_PAYMENT" -> {
                list.add(new ProposedAttributeDto("Applicant Full Name", "applicant_name", "TEXT", "input", true, false, true, false, order++, "Legal name of applicant", Map.of("minLength", 2)));
                list.add(new ProposedAttributeDto("Tax ID / SSN", "tax_id_ssn", "TEXT", "input", true, true, true, true, order++, "Government tax identifier (FLS Redacted)", Map.of("pii", true)));
                list.add(new ProposedAttributeDto("Principal Amount", "principal_amount", "NUMBER", "number", true, false, true, false, order++, "Requested principal amount", Map.of("minimum", 100)));
                list.add(new ProposedAttributeDto("Risk Score", "risk_score", "NUMBER", "number", false, false, true, false, order++, "Underwriting credit score", Map.of("minimum", 300, "maximum", 850)));
                list.add(new ProposedAttributeDto("Underwriting Status", "underwriting_status", "ENUM", "select", true, false, true, false, order++, "Approval decision status", Map.of("enum", List.of("SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"))));
                list.add(new ProposedAttributeDto("KYC Telemetry", "kyc_telemetry", "JSON", "json_editor", false, false, false, true, order++, "Identity verification metadata", Map.of("pii", true, "jsonSchema", Map.of("type", "object", "properties", Map.of("verified", Map.of("type", "boolean"), "provider", Map.of("type", "string"))))));
            }
            case "HEALTHCARE_PATIENT" -> {
                list.add(new ProposedAttributeDto("Medical Record Number", "mrn_code", "TEXT", "input", true, true, true, false, order++, "Unique patient MRN", Map.of("minLength", 4)));
                list.add(new ProposedAttributeDto("Patient SSN", "patient_ssn", "TEXT", "input", false, false, false, true, order++, "Protected health identifier (HIPAA / FLS)", Map.of("pii", true)));
                list.add(new ProposedAttributeDto("Intake Date", "intake_date", "DATETIME", "date_picker", true, false, true, false, order++, "Admission timestamp", Collections.emptyMap()));
                list.add(new ProposedAttributeDto("Triage Priority", "triage_priority", "ENUM", "select", true, false, true, false, order++, "Clinical urgency level", Map.of("enum", List.of("ROUTINE", "URGENT", "CRITICAL"))));
                list.add(new ProposedAttributeDto("Vitals Payload", "vitals_payload", "JSON", "json_editor", false, false, false, false, order++, "Structured clinical vitals", Map.of("jsonSchema", Map.of("type", "object", "properties", Map.of("heartRateBpm", Map.of("type", "number"), "systolicMmHg", Map.of("type", "number"))))));
            }
            case "SUPPLY_CHAIN_LOGISTICS" -> {
                list.add(new ProposedAttributeDto("Tracking Number", "tracking_number", "TEXT", "input", true, true, true, false, order++, "Global carrier tracking number", Map.of("minLength", 6)));
                list.add(new ProposedAttributeDto("Origin Warehouse", "origin_warehouse", "TEXT", "input", true, false, true, false, order++, "Dispatch facility code", Collections.emptyMap()));
                list.add(new ProposedAttributeDto("Shipment Status", "shipment_status", "ENUM", "select", true, false, true, false, order++, "Transit state", Map.of("enum", List.of("CREATED", "IN_TRANSIT", "CUSTOMS_HOLD", "DELIVERED"))));
                list.add(new ProposedAttributeDto("Geo Telemetry", "geo_telemetry", "JSON", "json_editor", false, false, false, false, order++, "Real-time GPS coordinates", Map.of("jsonSchema", Map.of("type", "object", "required", List.of("latitude", "longitude"), "properties", Map.of("latitude", Map.of("type", "number"), "longitude", Map.of("type", "number"))))));
            }
            default -> {
                list.add(new ProposedAttributeDto("Record Name", "record_name", "TEXT", "input", true, false, true, false, order++, "Primary identifier label", Map.of("minLength", 2)));
                list.add(new ProposedAttributeDto("Lifecycle Status", "lifecycle_status", "ENUM", "select", true, false, true, false, order++, "Current workflow status", Map.of("enum", List.of("DRAFT", "UNDER_REVIEW", "APPROVED", "PUBLISHED"))));
                list.add(new ProposedAttributeDto("Extended Metadata", "extended_metadata", "JSON", "json_editor", false, false, false, false, order++, "Custom extensible JSONB payload", Map.of("jsonSchema", Map.of("type", "object"))));
            }
        }

        // Additional explicit prompt keyword checks
        if ((lower.contains("salary") || lower.contains("compensation")) && list.stream().noneMatch(a -> a.systemName().contains("salary"))) {
            list.add(new ProposedAttributeDto("Annual Salary", "annual_salary", "NUMBER", "number", false, false, false, true, order++, "Confidential compensation amount (FLS Protected)", Map.of("pii", true, "minimum", 0)));
        }
        if ((lower.contains("card_number") || lower.contains("credit card")) && list.stream().noneMatch(a -> a.systemName().contains("card_number"))) {
            list.add(new ProposedAttributeDto("Card Number", "card_number", "TEXT", "input", false, false, false, true, order++, "Payment card number (FLS Protected)", Map.of("pii", true)));
        }

        return list;
    }

    private String inferEntityName(String prompt, String domain) {
        return switch (domain) {
            case "ECOMMERCE_ORDER" -> "Customer Order";
            case "FINTECH_PAYMENT" -> "Loan Application";
            case "HEALTHCARE_PATIENT" -> "Patient Intake";
            case "SUPPLY_CHAIN_LOGISTICS" -> "Logistics Shipment";
            case "HR_WORKFORCE" -> "Employee Profile";
            default -> "Enterprise Record";
        };
    }

    private Map<String, Object> buildRecommendedLifecycle(String domain) {
        Map<String, Object> lifecycle = new LinkedHashMap<>();
        lifecycle.put("initialState", "DRAFT");
        lifecycle.put("states", List.of("DRAFT", "UNDER_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"));
        lifecycle.put("transitions", List.of(
            Map.of("action", "SUBMIT", "fromState", "DRAFT", "toState", "UNDER_REVIEW"),
            Map.of("action", "APPROVE", "fromState", "UNDER_REVIEW", "toState", "APPROVED"),
            Map.of("action", "PUBLISH", "fromState", "APPROVED", "toState", "PUBLISHED")
        ));
        return lifecycle;
    }

    private static String toSnakeCase(String input) {
        if (input == null || input.isBlank()) return "field";
        return input
            .replaceAll("([a-z0-9])([A-Z])", "$1_$2")
            .replaceAll("[^a-zA-Z0-9]+", "_")
            .replaceAll("^_+|_+$", "")
            .toLowerCase();
    }

    private static String toTitleCase(String snake) {
        String[] parts = snake.split("_");
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p.isBlank()) continue;
            if (!sb.isEmpty()) sb.append(" ");
            sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1).toLowerCase());
        }
        return sb.toString();
    }
}
