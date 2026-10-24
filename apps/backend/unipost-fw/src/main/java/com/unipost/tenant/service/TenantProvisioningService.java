package com.unipost.tenant.service;

import com.unipost.domain.metadata.AttributeDefinition;
import com.unipost.domain.metadata.EntityType;
import com.unipost.domain.metadata.RelationshipType;
import com.unipost.domain.workspace.Workspace;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.repository.jpa.AttributeDefinitionRepository;
import com.unipost.repository.jpa.EntityTypeRepository;
import com.unipost.repository.jpa.RelationshipTypeRepository;
import com.unipost.repository.jpa.WorkspaceRepository;
import com.unipost.service.SchemaValidationService;
import com.unipost.service.exception.MetadataConflictException;
import com.unipost.service.exception.MetadataNotFoundException;
import com.unipost.tenant.blueprint.BlueprintCatalogService;
import com.unipost.tenant.blueprint.BlueprintManifest;
import com.unipost.tenant.dto.TenantProvisioningRequest;
import com.unipost.tenant.dto.TenantProvisioningResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class TenantProvisioningService {

    private final BlueprintCatalogService blueprintCatalogService;
    private final EntityTypeRepository entityTypeRepository;
    private final AttributeDefinitionRepository attributeDefinitionRepository;
    private final RelationshipTypeRepository relationshipTypeRepository;
    private final WorkspaceRepository workspaceRepository;
    private final com.unipost.repository.jpa.TenantRepository tenantRepository;
    private final SchemaValidationService schemaValidationService;

    @Transactional
    public TenantProvisioningResult provisionTenant(TenantProvisioningRequest request) {
        long startTime = System.currentTimeMillis();
        String targetTenantId = request.tenantId().trim().toLowerCase();

        // 1. Resolve requested blueprint manifest
        BlueprintManifest manifest = blueprintCatalogService.getBlueprint(request.blueprintId())
                .orElseThrow(() -> new MetadataNotFoundException("Blueprint template not found with id: " + request.blueprintId()));

        log.info("Starting atomic provisioning for tenant '{}' ('{}') with blueprint '{}'", 
                targetTenantId, request.tenantName(), manifest.id());

        // Temporarily set TenantContextHolder to ensure any audited queries stamp the new tenant
        String previousTenant = TenantContextHolder.getTenantId();
        TenantContextHolder.setTenantId(targetTenantId);

        try {
            Map<String, EntityType> createdEntitiesBySystemName = new HashMap<>();
            List<String> createdEntityNames = new ArrayList<>();
            int totalAttributesCreated = 0;
            int totalRelationshipsCreated = 0;

            // 2. Deep-clone Entity Types and their Attributes
            if (manifest.entityTypes() != null) {
                for (BlueprintManifest.BlueprintEntityType bType : manifest.entityTypes()) {
                    // Check duplicate within tenant
                    if (entityTypeRepository.existsBySystemNameAndDeletedDateIsNull(bType.systemName())) {
                        throw new MetadataConflictException("EntityType with systemName '" + bType.systemName() 
                                + "' already exists for tenant: " + targetTenantId);
                    }

                    EntityType entityType = new EntityType();
                    entityType.setTenantId(targetTenantId);
                    entityType.setName(bType.name());
                    entityType.setSystemName(bType.systemName());
                    entityType.setDescription(bType.description());
                    entityType.setSchemaVersion(1L);

                    EntityType savedEntity = entityTypeRepository.save(entityType);
                    createdEntitiesBySystemName.put(savedEntity.getSystemName(), savedEntity);
                    createdEntityNames.add(savedEntity.getName());

                    // Clone attributes
                    if (bType.attributes() != null) {
                        for (BlueprintManifest.BlueprintAttribute bAttr : bType.attributes()) {
                            AttributeDefinition attr = new AttributeDefinition();
                            attr.setTenantId(targetTenantId);
                            attr.setEntityType(savedEntity);
                            attr.setName(bAttr.name());
                            attr.setSystemName(bAttr.systemName());
                            attr.setDataType(bAttr.dataType());
                            attr.setUiComponent(bAttr.uiComponent());
                            attr.setIsRequired(Boolean.TRUE.equals(bAttr.isRequired()));
                            attr.setDisplayOrder(bAttr.displayOrder() != null ? bAttr.displayOrder() : 0);
                            attr.setDefaultValue(bAttr.defaultValue());
                            attr.setOptions(bAttr.options());

                            attributeDefinitionRepository.save(attr);
                            totalAttributesCreated++;
                        }
                    }

                    // 3. Pre-warm Distributed Hazelcast Cache & L1 cache
                    try {
                        schemaValidationService.getOrCompileJsonSchema(targetTenantId, savedEntity.getId(), 1L);
                        log.debug("Pre-warmed schema cache for tenant '{}' entity '{}'", targetTenantId, savedEntity.getSystemName());
                    } catch (Exception e) {
                        log.warn("Failed to pre-warm cache for entityTypeId {}: {}", savedEntity.getId(), e.getMessage());
                    }
                }
            }

            // 4. Deep-clone Relationship Types (Pattern C Edges)
            if (manifest.relationshipTypes() != null) {
                for (BlueprintManifest.BlueprintRelationship bRel : manifest.relationshipTypes()) {
                    EntityType source = createdEntitiesBySystemName.get(bRel.sourceEntityType());
                    EntityType target = createdEntitiesBySystemName.get(bRel.targetEntityType());

                    RelationshipType relType = new RelationshipType();
                    relType.setTenantId(targetTenantId);
                    relType.setSystemName(bRel.systemName());
                    relType.setDescription(bRel.description());
                    relType.setSourceEntityType(source);
                    relType.setTargetEntityType(target);
                    relType.setCardinality(bRel.cardinality() != null ? bRel.cardinality() : "MANY_TO_MANY");

                    relationshipTypeRepository.save(relType);
                    totalRelationshipsCreated++;
                }
            }

            // 5. Ensure Master Tenant exists in UNIPOST_TENANTS
            com.unipost.domain.tenant.Tenant masterTenant = tenantRepository.findByCodeAndDeletedDateIsNull(targetTenantId)
                    .orElseGet(() -> {
                        com.unipost.domain.tenant.Tenant t = new com.unipost.domain.tenant.Tenant();
                        t.setCode(targetTenantId);
                        t.setName(request.tenantName());
                        t.setStatus("ACTIVE");
                        t.setPlanTier("BASIC");
                        return tenantRepository.save(t);
                    });

            // 6. Auto-provision Tenant Primary Default Workspace (Immutable)
            Workspace defaultWorkspace = workspaceRepository.findByTenantIdAndIsDefaultTrueAndDeletedDateIsNull(targetTenantId)
                    .orElseGet(() -> {
                        Workspace ws = new Workspace();
                        ws.setTenantId(targetTenantId);
                        ws.setTenant(masterTenant);
                        ws.setCode("MAIN");
                        ws.setName(request.tenantName() + " Primary");
                        ws.setDescription("System auto-provisioned default primary workspace for " + request.tenantName());
                        ws.setPlanTier("STANDARD");
                        ws.setIsDefault(true);
                        ws.setIsImmutable(true);
                        return workspaceRepository.save(ws);
                    });
            if (defaultWorkspace.getTenant() == null) {
                defaultWorkspace.setTenant(masterTenant);
                workspaceRepository.save(defaultWorkspace);
            }
            log.info("Provisioned default immutable workspace '{}' (uid: '{}') for tenant '{}'",
                    defaultWorkspace.getName(), defaultWorkspace.getUid(), targetTenantId);

            long elapsed = System.currentTimeMillis() - startTime;
            log.info("Tenant '{}' successfully provisioned with {} entities, {} attributes, {} edges in {}ms",
                    targetTenantId, createdEntitiesBySystemName.size(), totalAttributesCreated, totalRelationshipsCreated, elapsed);

            return new TenantProvisioningResult(
                    targetTenantId,
                    request.tenantName(),
                    manifest.id(),
                    manifest.name(),
                    createdEntitiesBySystemName.size(),
                    totalAttributesCreated,
                    totalRelationshipsCreated,
                    createdEntityNames,
                    defaultWorkspace.getUid(),
                    defaultWorkspace.getName(),
                    elapsed
            );
        } finally {
            if (previousTenant != null) {
                TenantContextHolder.setTenantId(previousTenant);
            } else {
                TenantContextHolder.clear();
            }
        }
    }
}
