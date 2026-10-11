import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { springApiClient } from '../api-client';
import { useSpringAuthStore } from '../store';
import { useMetadataUiStore } from '@/features/metadata/store/use-metadata-ui-store';

describe('springApiClient Context Header Injection', () => {
  beforeEach(() => {
    localStorage.clear();
    useSpringAuthStore.setState({ accessToken: null, refreshToken: null });
    useMetadataUiStore.setState({
      activeTenantId: 'tenant-acme',
      activeWorkspaceId: 'ws-prod',
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('injects active tenant and workspace headers from useMetadataUiStore when not assumed', async () => {
    let capturedConfig: any = null;
    const originalAdapter = springApiClient.defaults.adapter;
    springApiClient.defaults.adapter = async (config) => {
      capturedConfig = config;
      return {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    try {
      await springApiClient.get('/test-endpoint-unmocked');
    } finally {
      springApiClient.defaults.adapter = originalAdapter;
    }

    expect(capturedConfig.headers['X-Tenant-Id']).toBe('tenant-acme');
    expect(capturedConfig.headers['X-Workspace-Id']).toBe('ws-prod');
  });

  it('prioritizes assumed tenant from localStorage over activeTenantId in store', async () => {
    localStorage.setItem('unipost_assumed_tenant', 'tenant-assumed-xyz');

    let capturedConfig: any = null;
    const originalAdapter = springApiClient.defaults.adapter;
    springApiClient.defaults.adapter = async (config) => {
      capturedConfig = config;
      return {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    try {
      await springApiClient.get('/test-endpoint-unmocked');
    } finally {
      springApiClient.defaults.adapter = originalAdapter;
    }

    expect(capturedConfig.headers['X-Tenant-Id']).toBe('tenant-assumed-xyz');
    expect(capturedConfig.headers['X-Assumed-Tenant']).toBe('tenant-assumed-xyz');
  });
});
