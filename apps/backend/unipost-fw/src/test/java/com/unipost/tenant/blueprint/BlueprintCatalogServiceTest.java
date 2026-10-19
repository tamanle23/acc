package com.unipost.tenant.blueprint;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class BlueprintCatalogServiceTest {

    private BlueprintCatalogService catalogService;

    @BeforeEach
    void setUp() {
        ObjectMapper objectMapper = new ObjectMapper();
        catalogService = new BlueprintCatalogService(objectMapper);
        catalogService.loadBlueprints();
    }

    @Test
    void testGetAvailableBlueprints_ReturnsLoadedBlueprintsAndSummaryDtos() {
        List<BlueprintSummaryDto> list = catalogService.getAvailableBlueprints();
        assertNotNull(list);
        assertFalse(list.isEmpty());

        for (BlueprintSummaryDto dto : list) {
            assertNotNull(dto.id());
            assertNotNull(dto.name());
        }
    }

    @Test
    void testGetBlueprint_ValidAndInvalid() {
        // Blank or null
        assertTrue(catalogService.getBlueprint(null).isEmpty());
        assertTrue(catalogService.getBlueprint("").isEmpty());
        assertTrue(catalogService.getBlueprint("non_existent_id").isEmpty());

        // Valid
        Optional<BlueprintManifest> bp = catalogService.getBlueprint("bp_crm_billing_v1");
        assertTrue(bp.isPresent());
        assertEquals("B2B CRM & Invoicing", bp.get().name());
    }
}
