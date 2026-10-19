import { describe, it, expect, beforeEach } from 'vitest';
import { useMetadataUiStore } from '../use-metadata-ui-store';
import type { EntityType, AttributeDefinition, EntityRecord, RelationshipType } from '../../api/types';

describe('useMetadataUiStore', () => {
  beforeEach(() => {
    // Reset to defaults
    const state = useMetadataUiStore.getState();
    state.setActiveTenant('tenant-acme', 'Acme International Corp');
    state.setActiveWorkspace('ws-acme-prod', 'Acme Prod');
    state.setCurrentUserRole('TENANT_ADMIN');
    state.setWorkspaceMode('architect');
    state.setSelectedEntityTypeId(null);
    state.setActiveTab('schema');
    state.setSearchQuery('');
    state.closeRelationshipTypeDialog();
    state.closeDeleteRelationshipTypeDialog();
    state.closeRecordRelationshipsInspector();
    state.closeEntityTypeDialog();
    state.closeDeleteEntityTypeDialog();
    state.closeAttributeDialog();
    state.closeDeleteAttributeDialog();
    state.closeRecordEditorDialog();
    state.closeDeleteRecordDialog();
    state.closeJsonSchemaPreview();
    state.closeBlueprintGallery();
  });

  describe('Multi-Tenancy & Workspace Context', () => {
    it('sets active tenant and updates tenant name and white-label theming', () => {
      useMetadataUiStore.getState().setActiveTenant('tenant-us-east-1', 'US East Cluster');
      expect(useMetadataUiStore.getState().activeTenantId).toBe('tenant-us-east-1');
      expect(useMetadataUiStore.getState().activeTenantName).toBe('US East Cluster');

      // Fallback name to tenantId if name not supplied
      useMetadataUiStore.getState().setActiveTenant('tenant-simple');
      expect(useMetadataUiStore.getState().activeTenantId).toBe('tenant-simple');
      expect(useMetadataUiStore.getState().activeTenantName).toBe('tenant-simple');
    });

    it('sets active workspace and updates workspace name', () => {
      useMetadataUiStore.getState().setActiveWorkspace('ws-staging', 'Staging QA');
      expect(useMetadataUiStore.getState().activeWorkspaceId).toBe('ws-staging');
      expect(useMetadataUiStore.getState().activeWorkspaceName).toBe('Staging QA');

      useMetadataUiStore.getState().setActiveWorkspace('ws-custom');
      expect(useMetadataUiStore.getState().activeWorkspaceId).toBe('ws-custom');
      expect(useMetadataUiStore.getState().activeWorkspaceName).toBe('ws-custom');
    });
  });

  describe('Workspace Mode & RBAC Guardrails', () => {
    it('allows TENANT_ADMIN to toggle between architect and operator modes', () => {
      expect(useMetadataUiStore.getState().workspaceMode).toBe('architect');
      useMetadataUiStore.getState().toggleWorkspaceMode();
      expect(useMetadataUiStore.getState().workspaceMode).toBe('operator');
      useMetadataUiStore.getState().toggleWorkspaceMode();
      expect(useMetadataUiStore.getState().workspaceMode).toBe('architect');
    });

    it('prohibits non-admin roles from switching to architect mode', () => {
      useMetadataUiStore.getState().setCurrentUserRole('TENANT_OPERATOR');
      expect(useMetadataUiStore.getState().workspaceMode).toBe('operator');

      // Attempt switch to architect
      useMetadataUiStore.getState().setWorkspaceMode('architect');
      expect(useMetadataUiStore.getState().workspaceMode).toBe('operator');

      useMetadataUiStore.getState().setCurrentUserRole('TENANT_VIEWER');
      useMetadataUiStore.getState().setWorkspaceMode('architect');
      expect(useMetadataUiStore.getState().workspaceMode).toBe('operator');
    });

    it('falls back to data tab when switching to operator mode while on schema tab', () => {
      useMetadataUiStore.getState().setActiveTab('schema');
      expect(useMetadataUiStore.getState().activeTab).toBe('schema');

      useMetadataUiStore.getState().setWorkspaceMode('operator');
      expect(useMetadataUiStore.getState().activeTab).toBe('data');
    });

    it('calculates canManageSchema and canMutateRecords permissions', () => {
      // 1. ADMIN in architect mode
      useMetadataUiStore.getState().setCurrentUserRole('TENANT_ADMIN');
      useMetadataUiStore.getState().setWorkspaceMode('architect');
      expect(useMetadataUiStore.getState().canManageSchema()).toBe(true);
      expect(useMetadataUiStore.getState().canMutateRecords()).toBe(true);

      // 2. ADMIN in operator mode
      useMetadataUiStore.getState().setWorkspaceMode('operator');
      expect(useMetadataUiStore.getState().canManageSchema()).toBe(false);
      expect(useMetadataUiStore.getState().canMutateRecords()).toBe(true);

      // 3. OPERATOR
      useMetadataUiStore.getState().setCurrentUserRole('TENANT_OPERATOR');
      expect(useMetadataUiStore.getState().canManageSchema()).toBe(false);
      expect(useMetadataUiStore.getState().canMutateRecords()).toBe(true);

      // 4. VIEWER
      useMetadataUiStore.getState().setCurrentUserRole('TENANT_VIEWER');
      expect(useMetadataUiStore.getState().canManageSchema()).toBe(false);
      expect(useMetadataUiStore.getState().canMutateRecords()).toBe(false);
    });
  });

  describe('Navigation & Model Selection', () => {
    it('sets selected entity type id, active tab, and search query', () => {
      useMetadataUiStore.getState().setSelectedEntityTypeId('ent-customer-101');
      expect(useMetadataUiStore.getState().selectedEntityTypeId).toBe('ent-customer-101');

      useMetadataUiStore.getState().setActiveTab('relationships');
      expect(useMetadataUiStore.getState().activeTab).toBe('relationships');

      useMetadataUiStore.getState().setSearchQuery('search keyword');
      expect(useMetadataUiStore.getState().searchQuery).toBe('search keyword');
    });

    it('preserves per-model data grid state', () => {
      const defaultState = useMetadataUiStore.getState().getGridState('model-1');
      expect(defaultState.page).toBe(1);
      expect(defaultState.pageSize).toBe(10);
      expect(defaultState.searchFilter).toBe('');
      expect(defaultState.sortDirection).toBe('asc');

      // Update grid state for model-1
      useMetadataUiStore.getState().setGridState('model-1', {
        page: 3,
        pageSize: 25,
        searchFilter: 'VIP',
        sortField: 'createdAt',
        sortDirection: 'desc',
        attributeFilters: [{ id: 'f1', field: 'status', operator: 'eq', value: 'ACTIVE' }],
      });

      const updatedState = useMetadataUiStore.getState().getGridState('model-1');
      expect(updatedState.page).toBe(3);
      expect(updatedState.pageSize).toBe(25);
      expect(updatedState.searchFilter).toBe('VIP');
      expect(updatedState.sortField).toBe('createdAt');
      expect(updatedState.sortDirection).toBe('desc');
      expect(updatedState.attributeFilters).toHaveLength(1);

      // Model-2 still has default initial state
      const model2State = useMetadataUiStore.getState().getGridState('model-2');
      expect(model2State.page).toBe(1);
    });
  });

  describe('Dialog Lifecycles', () => {
    it('manages RelationshipType create and edit dialogs', () => {
      const mockRel: RelationshipType = {
        id: 1,
        code: 'HAS_MANY',
        name: 'Has Many',
        sourceEntityTypeId: 1,
        targetEntityTypeId: 2,
        cardinality: 'ONE_TO_MANY',
      };

      useMetadataUiStore.getState().openCreateRelationshipTypeDialog();
      expect(useMetadataUiStore.getState().isRelationshipTypeDialogOpen).toBe(true);
      expect(useMetadataUiStore.getState().editingRelationshipType).toBeNull();

      useMetadataUiStore.getState().openEditRelationshipTypeDialog(mockRel);
      expect(useMetadataUiStore.getState().isRelationshipTypeDialogOpen).toBe(true);
      expect(useMetadataUiStore.getState().editingRelationshipType).toBe(mockRel);

      useMetadataUiStore.getState().closeRelationshipTypeDialog();
      expect(useMetadataUiStore.getState().isRelationshipTypeDialogOpen).toBe(false);
      expect(useMetadataUiStore.getState().editingRelationshipType).toBeNull();

      // Delete dialog
      useMetadataUiStore.getState().openDeleteRelationshipTypeDialog(mockRel);
      expect(useMetadataUiStore.getState().isRelationshipTypeDeleteDialogOpen).toBe(true);
      expect(useMetadataUiStore.getState().deletingRelationshipType).toBe(mockRel);

      useMetadataUiStore.getState().closeDeleteRelationshipTypeDialog();
      expect(useMetadataUiStore.getState().isRelationshipTypeDeleteDialogOpen).toBe(false);
      expect(useMetadataUiStore.getState().deletingRelationshipType).toBeNull();
    });

    it('manages EntityType create, edit, and delete dialogs', () => {
      const mockEntity: EntityType = {
        id: 1,
        code: 'ORDERS',
        name: 'Orders',
        schemaVersion: 1,
        createdDate: '2026-01-01',
      };

      useMetadataUiStore.getState().openCreateEntityTypeDialog();
      expect(useMetadataUiStore.getState().isEntityTypeDialogOpen).toBe(true);
      expect(useMetadataUiStore.getState().editingEntityType).toBeNull();

      useMetadataUiStore.getState().openEditEntityTypeDialog(mockEntity);
      expect(useMetadataUiStore.getState().isEntityTypeDialogOpen).toBe(true);
      expect(useMetadataUiStore.getState().editingEntityType).toBe(mockEntity);

      useMetadataUiStore.getState().closeEntityTypeDialog();
      expect(useMetadataUiStore.getState().isEntityTypeDialogOpen).toBe(false);

      useMetadataUiStore.getState().openDeleteEntityTypeDialog(mockEntity);
      expect(useMetadataUiStore.getState().isEntityTypeDeleteDialogOpen).toBe(true);
      expect(useMetadataUiStore.getState().deletingEntityType).toBe(mockEntity);

      useMetadataUiStore.getState().closeDeleteEntityTypeDialog();
      expect(useMetadataUiStore.getState().isEntityTypeDeleteDialogOpen).toBe(false);
    });

    it('manages AttributeDefinition dialogs', () => {
      const mockAttr: AttributeDefinition = {
        id: 10,
        entityTypeId: 1,
        code: 'customer_email',
        name: 'Customer Email',
        dataType: 'STRING',
        isRequired: true,
        displayOrder: 1,
      };

      useMetadataUiStore.getState().openCreateAttributeDialog();
      expect(useMetadataUiStore.getState().isAttributeDialogOpen).toBe(true);

      useMetadataUiStore.getState().openEditAttributeDialog(mockAttr);
      expect(useMetadataUiStore.getState().editingAttribute).toBe(mockAttr);

      useMetadataUiStore.getState().closeAttributeDialog();
      expect(useMetadataUiStore.getState().isAttributeDialogOpen).toBe(false);

      useMetadataUiStore.getState().openDeleteAttributeDialog(mockAttr);
      expect(useMetadataUiStore.getState().isAttributeDeleteDialogOpen).toBe(true);
      expect(useMetadataUiStore.getState().deletingAttribute).toBe(mockAttr);

      useMetadataUiStore.getState().closeDeleteAttributeDialog();
      expect(useMetadataUiStore.getState().isAttributeDeleteDialogOpen).toBe(false);
    });

    it('manages RecordEditor and RecordRelationshipsInspector dialogs', () => {
      const mockRecord: EntityRecord = {
        id: 501,
        entityTypeId: 1,
        version: 1,
        data: { name: 'Acme Corp' },
      };

      useMetadataUiStore.getState().openCreateRecordDialog();
      expect(useMetadataUiStore.getState().isRecordEditorDialogOpen).toBe(true);
      expect(useMetadataUiStore.getState().editingRecord).toBeNull();

      useMetadataUiStore.getState().openEditRecordDialog(mockRecord);
      expect(useMetadataUiStore.getState().editingRecord).toBe(mockRecord);

      useMetadataUiStore.getState().closeRecordEditorDialog();
      expect(useMetadataUiStore.getState().isRecordEditorDialogOpen).toBe(false);

      useMetadataUiStore.getState().openDeleteRecordDialog(mockRecord);
      expect(useMetadataUiStore.getState().isRecordDeleteDialogOpen).toBe(true);
      expect(useMetadataUiStore.getState().deletingRecord).toBe(mockRecord);

      useMetadataUiStore.getState().closeDeleteRecordDialog();
      expect(useMetadataUiStore.getState().isRecordDeleteDialogOpen).toBe(false);

      useMetadataUiStore.getState().openRecordRelationshipsInspector(mockRecord);
      expect(useMetadataUiStore.getState().inspectingRecordRelationships).toBe(mockRecord);

      useMetadataUiStore.getState().closeRecordRelationshipsInspector();
      expect(useMetadataUiStore.getState().inspectingRecordRelationships).toBeNull();
    });

    it('manages JsonSchemaPreview and BlueprintGallery dialogs', () => {
      useMetadataUiStore.getState().openJsonSchemaPreview();
      expect(useMetadataUiStore.getState().isJsonSchemaPreviewOpen).toBe(true);
      useMetadataUiStore.getState().closeJsonSchemaPreview();
      expect(useMetadataUiStore.getState().isJsonSchemaPreviewOpen).toBe(false);

      useMetadataUiStore.getState().openBlueprintGallery();
      expect(useMetadataUiStore.getState().isBlueprintGalleryOpen).toBe(true);
      useMetadataUiStore.getState().closeBlueprintGallery();
      expect(useMetadataUiStore.getState().isBlueprintGalleryOpen).toBe(false);
    });
  });
});
