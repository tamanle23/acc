import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeatureGate } from './feature-gate';
import * as billingApi from '../../api/use-billing';

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('FeatureGate Component', () => {
  it('renders children directly when tenant holds the entitled feature token', () => {
    vi.spyOn(billingApi, 'useTenantBilling').mockReturnValue({
      data: {
        tenantId: 'test-tenant',
        planTier: 'PRO',
        billingCadence: 'MONTHLY',
        status: 'ACTIVE',
        amountPaid: 199000,
        expiresAt: null,
        entitledFeatures: ['FEATURE_SCHEMA_STUDIO', 'FEATURE_PATTERN_C_GRAPH'],
      },
      isLoading: false,
    } as any);

    renderWithQueryClient(
      <FeatureGate
        featureKey="FEATURE_SCHEMA_STUDIO"
        featureTitle="Schema Architect Studio"
      >
        <div data-testid="protected-content">Unlocked Schema Studio Content</div>
      </FeatureGate>
    );

    expect(screen.getByTestId('protected-content')).toBeDefined();
    expect(screen.queryByText(/Yêu cầu gói PRO/i)).toBeNull();
  });

  it('renders Liquid Glass frosted teaser scrim when tenant is unentitled', () => {
    vi.spyOn(billingApi, 'useTenantBilling').mockReturnValue({
      data: {
        tenantId: 'test-tenant',
        planTier: 'BASIC',
        billingCadence: 'MONTHLY',
        status: 'ACTIVE',
        amountPaid: 0,
        expiresAt: null,
        entitledFeatures: ['FEATURE_METADATA_READ'],
      },
      isLoading: false,
    } as any);

    renderWithQueryClient(
      <FeatureGate
        featureKey="FEATURE_PATTERN_C_GRAPH"
        featureTitle="Pattern C Connected Graph Edges"
        requiredTier="PRO"
      >
        <div data-testid="protected-content">Graph Content</div>
      </FeatureGate>
    );

    expect(screen.getByText(/Pattern C Connected Graph Edges/i)).toBeDefined();
    expect(screen.getByText(/Yêu cầu gói PRO/i)).toBeDefined();
    expect(screen.getByText(/Nâng cấp ngay qua VietQR/i)).toBeDefined();
  });
});
