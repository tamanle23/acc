package com.unipost.presentation;

import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.ResponseEntityBuilder;
import com.unipost.tenant.blueprint.BlueprintCatalogService;
import com.unipost.tenant.blueprint.BlueprintSummaryDto;
import com.unipost.tenant.dto.TenantProvisioningRequest;
import com.unipost.tenant.dto.TenantProvisioningResult;
import com.unipost.tenant.service.TenantProvisioningService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/metadata")
@RequiredArgsConstructor
public class TenantProvisioningController {

    private final BlueprintCatalogService blueprintCatalogService;
    private final TenantProvisioningService tenantProvisioningService;
    private final ResponseEntityBuilder responseBuilder;

    /**
     * Retrieves catalog of all available domain blueprints.
     */
    @GetMapping("/blueprints")
    // @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, List<BlueprintSummaryDto>>> getBlueprints() {
        List<BlueprintSummaryDto> blueprints = blueprintCatalogService.getAvailableBlueprints();
        return responseBuilder.success(blueprints);
    }

    /**
     * Retrieves the complete manifest details of a specific blueprint template.
     */
    @GetMapping("/blueprints/{blueprintId}")
    // @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, com.unipost.tenant.blueprint.BlueprintManifest>> getBlueprintDetails(
            @PathVariable String blueprintId) {
        com.unipost.tenant.blueprint.BlueprintManifest manifest = blueprintCatalogService.getBlueprint(blueprintId)
                .orElseThrow(() -> new com.unipost.service.exception.MetadataNotFoundException(
                        "Blueprint template not found with id: " + blueprintId));
        return responseBuilder.success(manifest);
    }

    /**
     * Provisions a new or existing tenant with a selected blueprint model catalog.
     * Deep-clones EntityTypes, Attributes, Relationships, and pre-warms compiled JSON Schemas into cache fabric.
     */
    @PostMapping("/tenants/provision")
    // @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, TenantProvisioningResult>> provisionTenant(
            @Valid @RequestBody TenantProvisioningRequest request) {
        TenantProvisioningResult result = tenantProvisioningService.provisionTenant(request);
        return responseBuilder.success(result);
    }
}

