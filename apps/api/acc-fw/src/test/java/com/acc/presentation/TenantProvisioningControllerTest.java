package com.acc.presentation;

import com.acc.core.context.Context;
import com.acc.core.io.ContextHeader;
import com.acc.core.io.ResponseWrapper;
import com.acc.fw.ResponseEntityBuilder;
import com.acc.service.exception.MetadataNotFoundException;
import com.acc.tenant.blueprint.BlueprintCatalogService;
import com.acc.tenant.blueprint.BlueprintManifest;
import com.acc.tenant.blueprint.BlueprintSummaryDto;
import com.acc.tenant.dto.TenantProvisioningRequest;
import com.acc.tenant.dto.TenantProvisioningResult;
import com.acc.tenant.service.TenantProvisioningService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantProvisioningControllerTest {

    @Mock
    private BlueprintCatalogService blueprintCatalogService;

    @Mock
    private TenantProvisioningService tenantProvisioningService;

    @Mock
    private Context contextHelper;

    private ResponseEntityBuilder responseBuilder;
    private TenantProvisioningController controller;

    @BeforeEach
    void setUp() {
        responseBuilder = new ResponseEntityBuilder();
        ReflectionTestUtils.setField(responseBuilder, "contextHelper", contextHelper);
        controller = new TenantProvisioningController(blueprintCatalogService, tenantProvisioningService, responseBuilder);
    }

    @Test
    void testGetBlueprints() {
        BlueprintSummaryDto summary = new BlueprintSummaryDto(
                "ecommerce-standard", "E-commerce Standard", "STORE", "Full ecommerce catalog",
                "shopping-cart", 5, 2
        );
        when(blueprintCatalogService.getAvailableBlueprints()).thenReturn(List.of(summary));

        ResponseEntity<ResponseWrapper<ContextHeader, List<BlueprintSummaryDto>>> response =
                controller.getBlueprints();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getBody()).hasSize(1);
        assertThat(response.getBody().getBody().get(0).id()).isEqualTo("ecommerce-standard");
    }

    @Test
    void testGetBlueprintDetails_Success() {
        BlueprintManifest manifest = new BlueprintManifest(
                "ecommerce-standard", "E-commerce Standard", "STORE", "Description", "shopping-cart",
                Collections.emptyList(), Collections.emptyList()
        );
        when(blueprintCatalogService.getBlueprint("ecommerce-standard")).thenReturn(Optional.of(manifest));

        ResponseEntity<ResponseWrapper<ContextHeader, BlueprintManifest>> response =
                controller.getBlueprintDetails("ecommerce-standard");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getBody().id()).isEqualTo("ecommerce-standard");
    }

    @Test
    void testGetBlueprintDetails_NotFound_ThrowsException() {
        when(blueprintCatalogService.getBlueprint("unknown-bp")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.getBlueprintDetails("unknown-bp"))
                .isInstanceOf(MetadataNotFoundException.class)
                .hasMessageContaining("Blueprint template not found");
    }

    @Test
    void testProvisionTenant() {
        TenantProvisioningRequest request = new TenantProvisioningRequest("tenant-acme", "Acme", "ecommerce-standard");
        TenantProvisioningResult result = new TenantProvisioningResult(
                "tenant-acme", "Acme", "ecommerce-standard", "E-commerce Standard",
                5, 12, 2, List.of("product", "order"), "ws_acme", "Acme Studio", 150L
        );
        when(tenantProvisioningService.provisionTenant(request)).thenReturn(result);

        ResponseEntity<ResponseWrapper<ContextHeader, TenantProvisioningResult>> response =
                controller.provisionTenant(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getBody().tenantId()).isEqualTo("tenant-acme");
        assertThat(response.getBody().getBody().createdEntityTypesCount()).isEqualTo(5);
    }
}
