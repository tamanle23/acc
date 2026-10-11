package com.unipost.tenant.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.unipost.domain.metadata.AttributeDefinition;
import com.unipost.domain.metadata.EntityType;
import com.unipost.domain.metadata.RelationshipType;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.repository.jpa.AttributeDefinitionRepository;
import com.unipost.repository.jpa.EntityTypeRepository;
import com.unipost.repository.jpa.RelationshipTypeRepository;
import com.unipost.service.SchemaValidationService;
import com.unipost.service.exception.MetadataConflictException;
import com.unipost.service.exception.MetadataNotFoundException;
import com.unipost.tenant.blueprint.BlueprintCatalogService;
import com.unipost.tenant.dto.TenantProvisioningRequest;
import com.unipost.tenant.dto.TenantProvisioningResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantProvisioningServiceTest {

  @Mock
  private com.unipost.repository.jpa.EntityTypeRepository entityTypeRepository;

  @Mock
  private com.unipost.repository.jpa.AttributeDefinitionRepository attributeDefinitionRepository;

  @Mock
  private com.unipost.repository.jpa.RelationshipTypeRepository relationshipTypeRepository;

  @Mock
  private com.unipost.repository.jpa.WorkspaceRepository workspaceRepository;

  @Mock
  private SchemaValidationService schemaValidationService;

  @Mock
  private JsonSchema mockJsonSchema;

  private BlueprintCatalogService blueprintCatalogService;
  private TenantProvisioningService tenantProvisioningService;

  private final AtomicLong idGenerator = new AtomicLong(100L);

  @BeforeEach
  void setUp() {
    blueprintCatalogService = new BlueprintCatalogService(new ObjectMapper());
    blueprintCatalogService.loadBlueprints();

    tenantProvisioningService = new TenantProvisioningService(
        blueprintCatalogService,
        entityTypeRepository,
        attributeDefinitionRepository,
        relationshipTypeRepository,
        workspaceRepository,
        schemaValidationService);
  }

  @AfterEach
  void tearDown() {
    TenantContextHolder.clear();
  }

  @Test
  @DisplayName("Should provision logistics fleet blueprint successfully and pre-warm cache")
  void provisionLogisticsFleetSuccessfully() {
    TenantProvisioningRequest request = new TenantProvisioningRequest(
        "tenant-fleet-alpha",
        "Fleet Alpha Logistics",
        "bp_logistics_v1");

    when(entityTypeRepository.existsBySystemNameAndDeletedDateIsNull(anyString())).thenReturn(false);
    when(entityTypeRepository.save(any(EntityType.class))).thenAnswer(invocation -> {
      EntityType et = invocation.getArgument(0);
      et.setId(idGenerator.incrementAndGet());
      return et;
    });

    when(attributeDefinitionRepository.save(any(AttributeDefinition.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(relationshipTypeRepository.save(any(RelationshipType.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(schemaValidationService.getOrCompileJsonSchema(anyString(), anyLong(), anyLong())).thenReturn(mockJsonSchema);
    when(workspaceRepository.findByTenantIdAndIsDefaultTrueAndDeletedDateIsNull(anyString())).thenReturn(java.util.Optional.empty());
    when(workspaceRepository.save(any(com.unipost.domain.workspace.Workspace.class))).thenAnswer(inv -> {
      com.unipost.domain.workspace.Workspace ws = inv.getArgument(0);
      ws.setId(999L);
      ws.setUid("ws-auto-provisioned-uid");
      return ws;
    });

    TenantProvisioningResult result = tenantProvisioningService.provisionTenant(request);

    assertNotNull(result);
    assertEquals("tenant-fleet-alpha", result.tenantId());
    assertEquals("bp_logistics_v1", result.blueprintId());
    assertEquals(2, result.createdEntityTypesCount());
    assertEquals(7, result.createdAttributesCount());
    assertEquals(1, result.createdRelationshipsCount());
    assertEquals("ws-auto-provisioned-uid", result.defaultWorkspaceUid());
    assertEquals("Fleet Alpha Logistics Primary", result.defaultWorkspaceName());
    assertTrue(result.createdEntityTypeNames().contains("Fleet Vehicle"));
    assertTrue(result.createdEntityTypeNames().contains("Dispatch Order"));

    // Verify default immutable workspace was saved
    ArgumentCaptor<com.unipost.domain.workspace.Workspace> wsCaptor = ArgumentCaptor.forClass(com.unipost.domain.workspace.Workspace.class);
    verify(workspaceRepository).save(wsCaptor.capture());
    com.unipost.domain.workspace.Workspace savedWs = wsCaptor.getValue();
    assertEquals("tenant-fleet-alpha", savedWs.getTenantId());
    assertEquals("MAIN", savedWs.getCode());
    assertEquals("Fleet Alpha Logistics Primary", savedWs.getName());
    assertTrue(savedWs.getIsDefault());
    assertTrue(savedWs.getIsImmutable());

    // Verify entity types were saved with tenant_id = 'tenant-fleet-alpha'
    ArgumentCaptor<EntityType> entityTypeCaptor = ArgumentCaptor.forClass(EntityType.class);
    verify(entityTypeRepository, times(2)).save(entityTypeCaptor.capture());
    List<EntityType> savedEntityTypes = entityTypeCaptor.getAllValues();
    for (EntityType et : savedEntityTypes) {
      assertEquals("tenant-fleet-alpha", et.getTenantId());
      assertEquals(1L, et.getSchemaVersion());
    }

    // Verify relationships wired to the new entity types
    ArgumentCaptor<RelationshipType> relCaptor = ArgumentCaptor.forClass(RelationshipType.class);
    verify(relationshipTypeRepository, times(1)).save(relCaptor.capture());
    RelationshipType savedRel = relCaptor.getValue();
    assertEquals("tenant-fleet-alpha", savedRel.getTenantId());
    assertEquals("rel_vehicle_assigned_order", savedRel.getSystemName());
    assertEquals("ent_dispatch_order", savedRel.getSourceEntityType().getSystemName());
    assertEquals("ent_vehicle", savedRel.getTargetEntityType().getSystemName());

    // Verify schema validation service was invoked to pre-warm both entity types
    verify(schemaValidationService, times(2)).getOrCompileJsonSchema(eq("tenant-fleet-alpha"), anyLong(), eq(1L));
  }

  @Test
  @DisplayName("Should provision blank workspace blueprint successfully with zero entities and default workspace")
  void provisionBlankWorkspaceSuccessfully() {
    TenantProvisioningRequest request = new TenantProvisioningRequest(
        "tenant-clean-slate",
        "Clean Workspace Co",
        "bp_blank_v1");

    when(workspaceRepository.findByTenantIdAndIsDefaultTrueAndDeletedDateIsNull(anyString())).thenReturn(java.util.Optional.empty());
    when(workspaceRepository.save(any(com.unipost.domain.workspace.Workspace.class))).thenAnswer(inv -> {
      com.unipost.domain.workspace.Workspace ws = inv.getArgument(0);
      ws.setId(888L);
      ws.setUid("ws-blank-uid");
      return ws;
    });

    TenantProvisioningResult result = tenantProvisioningService.provisionTenant(request);

    assertNotNull(result);
    assertEquals("tenant-clean-slate", result.tenantId());
    assertEquals("bp_blank_v1", result.blueprintId());
    assertEquals(0, result.createdEntityTypesCount());
    assertEquals(0, result.createdAttributesCount());
    assertEquals(0, result.createdRelationshipsCount());
    assertEquals("ws-blank-uid", result.defaultWorkspaceUid());
    assertEquals("Clean Workspace Co Primary", result.defaultWorkspaceName());
    assertTrue(result.createdEntityTypeNames().isEmpty());

    verify(workspaceRepository, times(1)).save(any(com.unipost.domain.workspace.Workspace.class));
    verify(entityTypeRepository, never()).save(any());
    verify(attributeDefinitionRepository, never()).save(any());
    verify(relationshipTypeRepository, never()).save(any());
    verify(schemaValidationService, never()).getOrCompileJsonSchema(anyString(), anyLong(), anyLong());
  }

  @Test
  @DisplayName("Should throw MetadataNotFoundException when blueprint is unknown")
  void throwExceptionForUnknownBlueprint() {
    TenantProvisioningRequest request = new TenantProvisioningRequest(
        "tenant-invalid",
        "Invalid Blueprint",
        "bp_unknown_xyz");

    assertThrows(MetadataNotFoundException.class, () -> tenantProvisioningService.provisionTenant(request));
  }

  @Test
  @DisplayName("Should throw MetadataConflictException when entity model already exists in tenant")
  void throwExceptionForDuplicateEntityInTenant() {
    TenantProvisioningRequest request = new TenantProvisioningRequest(
        "tenant-conflict",
        "Conflict Tenant",
        "bp_logistics_v1");

    when(entityTypeRepository.existsBySystemNameAndDeletedDateIsNull("ent_vehicle")).thenReturn(true);

    assertThrows(MetadataConflictException.class, () -> tenantProvisioningService.provisionTenant(request));
    verify(entityTypeRepository, never()).save(any());
  }

  @Test
  @DisplayName("Should provision CMS publishing blueprint successfully with 3 entities, 15 attributes, 2 relationships")
  void provisionCmsBlueprintSuccessfully() {
    TenantProvisioningRequest request = new TenantProvisioningRequest(
        "tenant-cms-news",
        "Global Tech Daily",
        "bp_cms_publishing_v1");

    when(entityTypeRepository.existsBySystemNameAndDeletedDateIsNull(anyString())).thenReturn(false);
    when(entityTypeRepository.save(any(EntityType.class))).thenAnswer(invocation -> {
      EntityType et = invocation.getArgument(0);
      et.setId(idGenerator.incrementAndGet());
      return et;
    });

    when(attributeDefinitionRepository.save(any(AttributeDefinition.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(relationshipTypeRepository.save(any(RelationshipType.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(schemaValidationService.getOrCompileJsonSchema(anyString(), anyLong(), anyLong())).thenReturn(mockJsonSchema);
    when(workspaceRepository.findByTenantIdAndIsDefaultTrueAndDeletedDateIsNull(anyString())).thenReturn(java.util.Optional.empty());
    when(workspaceRepository.save(any(com.unipost.domain.workspace.Workspace.class))).thenAnswer(inv -> {
      com.unipost.domain.workspace.Workspace ws = inv.getArgument(0);
      ws.setId(777L);
      ws.setUid("ws-cms-uid");
      return ws;
    });

    TenantProvisioningResult result = tenantProvisioningService.provisionTenant(request);

    assertNotNull(result);
    assertEquals("tenant-cms-news", result.tenantId());
    assertEquals("bp_cms_publishing_v1", result.blueprintId());
    assertEquals(3, result.createdEntityTypesCount());
    assertEquals(15, result.createdAttributesCount());
    assertEquals(2, result.createdRelationshipsCount());
    assertEquals("ws-cms-uid", result.defaultWorkspaceUid());
    assertEquals("Global Tech Daily Primary", result.defaultWorkspaceName());
    assertTrue(result.createdEntityTypeNames().contains("Article & Editorial Post"));
    assertTrue(result.createdEntityTypeNames().contains("Content Category"));
    assertTrue(result.createdEntityTypeNames().contains("Media Asset"));

    verify(schemaValidationService, times(3)).getOrCompileJsonSchema(eq("tenant-cms-news"), anyLong(), eq(1L));
  }
}
