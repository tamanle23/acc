package com.unipost.service.metadata;

import com.unipost.service.metadata.AiSchemaSynthesizerService.ProposedAttributeDto;
import com.unipost.service.metadata.AiSchemaSynthesizerService.SynthesizeSchemaRequest;
import com.unipost.service.metadata.AiSchemaSynthesizerService.SynthesizedSchemaBlueprint;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AiSchemaSynthesizerServiceTest {

    private AiSchemaSynthesizerService synthesizerService;

    @BeforeEach
    void setUp() {
        synthesizerService = new AiSchemaSynthesizerService();
    }

    @Test
    void testSynthesizeFromSampleJson_DetectsNestedJsonbAndSensitivePii() {
        Map<String, Object> sampleJson = Map.of(
                "vendorName", "Global Logistics Inc",
                "tax_id", "99-1234567",
                "contractValue", 250000.50,
                "isActive", true,
                "onboardedAt", "2026-10-20T10:00:00Z",
                "slaConfig", Map.of(
                        "maxLatencyMs", 450,
                        "tier", "PLATINUM"
                )
        );

        SynthesizedSchemaBlueprint response = synthesizerService.synthesize(new SynthesizeSchemaRequest(
                "Vendor Onboarding Contract",
                sampleJson,
                null
        ));

        assertNotNull(response.suggestedEntityName());
        assertFalse(response.attributes().isEmpty());

        ProposedAttributeDto taxIdAttr = response.attributes().stream()
                .filter(a -> "tax_id".equals(a.systemName()))
                .findFirst()
                .orElseThrow();
        assertTrue(taxIdAttr.isSensitive());
        assertEquals("TEXT", taxIdAttr.dataType());

        ProposedAttributeDto slaAttr = response.attributes().stream()
                .filter(a -> "sla_config".equals(a.systemName()) || "slaConfig".equals(a.systemName()))
                .findFirst()
                .orElseThrow();
        assertEquals("JSON", slaAttr.dataType());
        assertNotNull(slaAttr.validationRules().get("jsonSchema"));
    }

    @Test
    void testSynthesizeFromNaturalLanguagePrompt_AppliesDomainTemplate() {
        SynthesizedSchemaBlueprint response = synthesizerService.synthesize(new SynthesizeSchemaRequest(
                "Create a Vendor Risk & Compliance Assessment entity with banking and SLA metadata",
                null,
                "vendor"
        ));

        assertTrue(response.attributes().size() >= 5);
        assertTrue(response.attributes().stream().anyMatch(ProposedAttributeDto::isSensitive));
        assertTrue(response.attributes().stream().anyMatch(a -> "JSON".equalsIgnoreCase(a.dataType())));
    }
}
