import { describe, it, expect, beforeEach } from 'vitest';
import { useMetadataUiStore } from '../store/use-metadata-ui-store';

describe('Phase 5 Dual-Mode Context Switching Store', () => {
  beforeEach(() => {
    useMetadataUiStore.setState({
      activeTenantId: 'tenant-acme',
      activeTenantName: 'Acme Corp',
      currentUserRole: 'TENANT_ADMIN',
      workspaceMode: 'architect',
      activeTab: 'schema',
      selectedEntityTypeId: '1',
    });
  });

  it('allows TENANT_ADMIN to switch to architect and operator modes freely', () => {
    const store = useMetadataUiStore.getState();
    expect(store.workspaceMode).toBe('architect');

    // Switch to operator mode
    store.setWorkspaceMode('operator');
    const operatorState = useMetadataUiStore.getState();
    expect(operatorState.workspaceMode).toBe('operator');

    // When switching to operator, schema tab must safely fallback to data tab
    expect(operatorState.activeTab).toBe('data');

    // Switch back to architect mode
    operatorState.setWorkspaceMode('architect');
    const architectState = useMetadataUiStore.getState();
    expect(architectState.workspaceMode).toBe('architect');
  });

  it('prevents non-admins from entering architect mode', () => {
    const store = useMetadataUiStore.getState();
    store.setCurrentUserRole('TENANT_OPERATOR');

    const operatorState = useMetadataUiStore.getState();
    expect(operatorState.currentUserRole).toBe('TENANT_OPERATOR');
    expect(operatorState.workspaceMode).toBe('operator');

    // Attempt unauthorized switch to architect
    operatorState.setWorkspaceMode('architect');
    const blockedState = useMetadataUiStore.getState();
    expect(blockedState.workspaceMode).toBe('operator');
  });

  it('toggles mode back and forth for TENANT_ADMIN', () => {
    const store = useMetadataUiStore.getState();
    expect(store.workspaceMode).toBe('architect');

    store.toggleWorkspaceMode();
    expect(useMetadataUiStore.getState().workspaceMode).toBe('operator');

    store.toggleWorkspaceMode();
    expect(useMetadataUiStore.getState().workspaceMode).toBe('architect');
  });
});
