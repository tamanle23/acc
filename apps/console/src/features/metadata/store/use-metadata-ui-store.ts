import { create } from 'zustand';
import type {
  AttributeDefinition,
  EntityRecord,
  EntityType,
  RelationshipType,
} from '../api/types';

export interface AttributeFilterClause {
  id: string;
  field: string;
  operator: 'eq' | 'ne' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
  value: string;
}

export interface GridState {
  searchFilter: string;
  attributeFilters?: AttributeFilterClause[];
  page: number;
  pageSize: number;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
}

export type WorkspaceMode = 'architect' | 'operator';
export type TenantRole = 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_VIEWER';

interface MetadataUiState {
  // Multi-Tenancy Context & RBAC
  activeTenantId: string;
  activeTenantName: string;
  activeWorkspaceId: string;
  activeWorkspaceName: string;
  currentUserRole: TenantRole;
  workspaceMode: WorkspaceMode;

  // Mode Actions & Permission Selectors
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  toggleWorkspaceMode: () => void;
  setCurrentUserRole: (role: TenantRole) => void;
  setActiveTenant: (tenantId: string, tenantName?: string) => void;
  setActiveWorkspace: (workspaceId: string, workspaceName?: string) => void;
  canManageSchema: () => boolean;
  canMutateRecords: () => boolean;

  // Navigation & selection
  selectedEntityTypeId: string | null;
  setSelectedEntityTypeId: (id: string | null) => void;
  activeTab: 'schema' | 'data' | 'relationships';
  setActiveTab: (tab: 'schema' | 'data' | 'relationships') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Per-model data grid state preservation
  gridStateByModel: Record<string, GridState>;
  setGridState: (modelId: string | number, state: Partial<GridState>) => void;
  getGridState: (modelId: string | number) => GridState;

  // Relationship Types Dialogs
  isRelationshipTypeDialogOpen: boolean;
  editingRelationshipType: RelationshipType | null;
  openCreateRelationshipTypeDialog: () => void;
  openEditRelationshipTypeDialog: (relType: RelationshipType) => void;
  closeRelationshipTypeDialog: () => void;

  isRelationshipTypeDeleteDialogOpen: boolean;
  deletingRelationshipType: RelationshipType | null;
  openDeleteRelationshipTypeDialog: (relType: RelationshipType) => void;
  closeDeleteRelationshipTypeDialog: () => void;

  // Record Relationships Inspector Dialog
  inspectingRecordRelationships: EntityRecord | null;
  openRecordRelationshipsInspector: (record: EntityRecord) => void;
  closeRecordRelationshipsInspector: () => void;

  // Entity Type Dialogs
  isEntityTypeDialogOpen: boolean;
  editingEntityType: EntityType | null;
  openCreateEntityTypeDialog: () => void;
  openEditEntityTypeDialog: (entityType: EntityType) => void;
  closeEntityTypeDialog: () => void;

  isEntityTypeDeleteDialogOpen: boolean;
  deletingEntityType: EntityType | null;
  openDeleteEntityTypeDialog: (entityType: EntityType) => void;
  closeDeleteEntityTypeDialog: () => void;

  // Attribute Definition Dialogs
  isAttributeDialogOpen: boolean;
  editingAttribute: AttributeDefinition | null;
  openCreateAttributeDialog: () => void;
  openEditAttributeDialog: (attribute: AttributeDefinition) => void;
  closeAttributeDialog: () => void;

  isAttributeDeleteDialogOpen: boolean;
  deletingAttribute: AttributeDefinition | null;
  openDeleteAttributeDialog: (attribute: AttributeDefinition) => void;
  closeDeleteAttributeDialog: () => void;

  // Record Editor Dialogs
  isRecordEditorDialogOpen: boolean;
  editingRecord: EntityRecord | null;
  openCreateRecordDialog: () => void;
  openEditRecordDialog: (record: EntityRecord) => void;
  closeRecordEditorDialog: () => void;

  isRecordDeleteDialogOpen: boolean;
  deletingRecord: EntityRecord | null;
  openDeleteRecordDialog: (record: EntityRecord) => void;
  closeDeleteRecordDialog: () => void;

  // Schema JSON Preview
  isJsonSchemaPreviewOpen: boolean;
  openJsonSchemaPreview: () => void;
  closeJsonSchemaPreview: () => void;

  // Blueprint Gallery Dialog
  isBlueprintGalleryOpen: boolean;
  openBlueprintGallery: () => void;
  closeBlueprintGallery: () => void;
}


const initialAssumedTenant = typeof window !== 'undefined' ? localStorage.getItem('unipost_assumed_tenant') : null;
const initialAssumedTenantName = typeof window !== 'undefined' ? localStorage.getItem('unipost_assumed_tenant_name') : null;
const hasAssumedTenant = Boolean(initialAssumedTenant && initialAssumedTenant !== 'SYSTEM');

export const useMetadataUiStore = create<MetadataUiState>((set, get) => ({
  // Multi-Tenancy & Workspace Mode
  activeTenantId: hasAssumedTenant ? (initialAssumedTenant as string) : 'default-tenant',
  activeTenantName: hasAssumedTenant ? (initialAssumedTenantName || initialAssumedTenant as string) : 'Default Organization',
  activeWorkspaceId: hasAssumedTenant ? `ws-${initialAssumedTenant}` : 'ws-main',
  activeWorkspaceName: hasAssumedTenant ? `${initialAssumedTenantName || initialAssumedTenant} Workspace` : 'Production Workspace',
  currentUserRole: 'TENANT_ADMIN',
  workspaceMode: 'architect',

  setWorkspaceMode: (mode: WorkspaceMode) => {
    const { currentUserRole, activeTab } = get();
    // Non-admins can NEVER switch to architect mode
    if (currentUserRole !== 'TENANT_ADMIN' && mode === 'architect') {
      return;
    }
    // If switching to operator mode while on schema tab, fallback safely to data tab
    const nextTab = (mode === 'operator' && activeTab === 'schema') ? 'data' : activeTab;
    set({ workspaceMode: mode, activeTab: nextTab });
  },

  toggleWorkspaceMode: () => {
    const { workspaceMode, setWorkspaceMode } = get();
    setWorkspaceMode(workspaceMode === 'architect' ? 'operator' : 'architect');
  },

  setCurrentUserRole: (role: TenantRole) => {
    const { activeTab } = get();
    const isNowAdmin = role === 'TENANT_ADMIN';
    const nextMode = isNowAdmin ? get().workspaceMode : 'operator';
    const nextTab = (!isNowAdmin && activeTab === 'schema') ? 'data' : activeTab;
    set({ currentUserRole: role, workspaceMode: nextMode, activeTab: nextTab });
  },

  setActiveTenant: (tenantId: string, tenantName?: string) => {
    set({
      activeTenantId: tenantId,
      activeTenantName: tenantName || tenantId,
    });
  },

  setActiveWorkspace: (workspaceId: string, workspaceName?: string) => {
    set({
      activeWorkspaceId: workspaceId,
      activeWorkspaceName: workspaceName || workspaceId,
    });
  },

  canManageSchema: () => {
    const { currentUserRole, workspaceMode } = get();
    return currentUserRole === 'TENANT_ADMIN' && workspaceMode === 'architect';
  },

  canMutateRecords: () => {
    const { currentUserRole } = get();
    return currentUserRole !== 'TENANT_VIEWER';
  },

  selectedEntityTypeId: '1',
  setSelectedEntityTypeId: (id) => set({ selectedEntityTypeId: id }),
  activeTab: 'schema',
  setActiveTab: (tab) => set({ activeTab: tab }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Per-model data grid state preservation
  gridStateByModel: {},
  setGridState: (modelId, partial) =>
    set((state) => {
      const key = String(modelId);
      const current = state.gridStateByModel[key] || {
        searchFilter: '',
        attributeFilters: [],
        page: 1,
        pageSize: 10,
        sortField: null,
        sortDirection: 'asc',
      };
      return {
        gridStateByModel: {
          ...state.gridStateByModel,
          [key]: { ...current, ...partial },
        },
      };
    }),
  getGridState: (modelId: string | number): GridState => {
    const key = String(modelId);
    return (
      get().gridStateByModel[key] || {
        searchFilter: '',
        attributeFilters: [],
        page: 1,
        pageSize: 10,
        sortField: null,
        sortDirection: 'asc',
      }
    );
  },

  // Relationship Types
  isRelationshipTypeDialogOpen: false,
  editingRelationshipType: null,
  openCreateRelationshipTypeDialog: () =>
    set({ isRelationshipTypeDialogOpen: true, editingRelationshipType: null }),
  openEditRelationshipTypeDialog: (relType) =>
    set({ isRelationshipTypeDialogOpen: true, editingRelationshipType: relType }),
  closeRelationshipTypeDialog: () =>
    set({ isRelationshipTypeDialogOpen: false, editingRelationshipType: null }),

  isRelationshipTypeDeleteDialogOpen: false,
  deletingRelationshipType: null,
  openDeleteRelationshipTypeDialog: (relType) =>
    set({ isRelationshipTypeDeleteDialogOpen: true, deletingRelationshipType: relType }),
  closeDeleteRelationshipTypeDialog: () =>
    set({ isRelationshipTypeDeleteDialogOpen: false, deletingRelationshipType: null }),

  // Record Relationships Inspector
  inspectingRecordRelationships: null,
  openRecordRelationshipsInspector: (record) =>
    set({ inspectingRecordRelationships: record }),
  closeRecordRelationshipsInspector: () =>
    set({ inspectingRecordRelationships: null }),

  // Entity Type
  isEntityTypeDialogOpen: false,
  editingEntityType: null,
  openCreateEntityTypeDialog: () =>
    set({ isEntityTypeDialogOpen: true, editingEntityType: null }),
  openEditEntityTypeDialog: (entityType) =>
    set({ isEntityTypeDialogOpen: true, editingEntityType: entityType }),
  closeEntityTypeDialog: () =>
    set({ isEntityTypeDialogOpen: false, editingEntityType: null }),

  isEntityTypeDeleteDialogOpen: false,
  deletingEntityType: null,
  openDeleteEntityTypeDialog: (entityType) =>
    set({ isEntityTypeDeleteDialogOpen: true, deletingEntityType: entityType }),
  closeDeleteEntityTypeDialog: () =>
    set({ isEntityTypeDeleteDialogOpen: false, deletingEntityType: null }),

  // Attribute
  isAttributeDialogOpen: false,
  editingAttribute: null,
  openCreateAttributeDialog: () =>
    set({ isAttributeDialogOpen: true, editingAttribute: null }),
  openEditAttributeDialog: (attribute) =>
    set({ isAttributeDialogOpen: true, editingAttribute: attribute }),
  closeAttributeDialog: () =>
    set({ isAttributeDialogOpen: false, editingAttribute: null }),

  isAttributeDeleteDialogOpen: false,
  deletingAttribute: null,
  openDeleteAttributeDialog: (attribute) =>
    set({ isAttributeDeleteDialogOpen: true, deletingAttribute: attribute }),
  closeDeleteAttributeDialog: () =>
    set({ isAttributeDeleteDialogOpen: false, deletingAttribute: null }),

  // Record
  isRecordEditorDialogOpen: false,
  editingRecord: null,
  openCreateRecordDialog: () =>
    set({ isRecordEditorDialogOpen: true, editingRecord: null }),
  openEditRecordDialog: (record) =>
    set({ isRecordEditorDialogOpen: true, editingRecord: record }),
  closeRecordEditorDialog: () =>
    set({ isRecordEditorDialogOpen: false, editingRecord: null }),

  isRecordDeleteDialogOpen: false,
  deletingRecord: null,
  openDeleteRecordDialog: (record) =>
    set({ isRecordDeleteDialogOpen: true, deletingRecord: record }),
  closeDeleteRecordDialog: () =>
    set({ isRecordDeleteDialogOpen: false, deletingRecord: null }),

  // JSON Schema Preview
  isJsonSchemaPreviewOpen: false,
  openJsonSchemaPreview: () => set({ isJsonSchemaPreviewOpen: true }),
  closeJsonSchemaPreview: () => set({ isJsonSchemaPreviewOpen: false }),

  // Blueprint Gallery Dialog
  isBlueprintGalleryOpen: false,
  openBlueprintGallery: () => set({ isBlueprintGalleryOpen: true }),
  closeBlueprintGallery: () => set({ isBlueprintGalleryOpen: false }),
}));

