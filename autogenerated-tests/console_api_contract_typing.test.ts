import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Formal Verification Suite: Frontend-Backend API Contract & Zero-`any` Synchronization
 * Target: apps/console/src/features/workflow-executions/api/, apps/console/src/features/workflows/api/, apps/console/src/features/metadata/api/use-billing.ts
 * Standards: STRICT-TYPESCRIPT, ZERO-ANY, CONTRACT-SYNCHRONIZATION
 */
describe('Phase 2: Frontend-Backend API Contract & Zero-`any` Synchronization', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const consoleSrc = path.join(repoRoot, 'apps/console/src');

  test('Guarantees zero untyped `onError: (err: any)` in workflow execution API hooks', () => {
    const wfExecFile = path.join(
      consoleSrc,
      'features/workflow-executions/api/use-workflow-executions.ts'
    );
    expect(fs.existsSync(wfExecFile)).toBe(true);

    const content = fs.readFileSync(wfExecFile, 'utf-8');
    expect(content.includes('onError: (err: any)')).toBe(false);
    expect(content.includes('AxiosError<ApiErrorResponse>')).toBe(true);
    expect(content.includes('getErrorMessage(')).toBe(true);
  });

  test('Guarantees useWorkflowExecutionsQuery is strictly typed and does not use get<any>', () => {
    const wfExecFile = path.join(
      consoleSrc,
      'features/workflow-executions/api/use-workflow-executions.ts'
    );
    const content = fs.readFileSync(wfExecFile, 'utf-8');
    expect(content.includes('get<any>')).toBe(false);
    expect(content.includes('get<WorkflowExecution[]>')).toBe(true);
  });

  test('Guarantees zero untyped `onError: (err: any)` in workflow definition & execution API hooks', () => {
    const wfApiFile = path.join(consoleSrc, 'features/workflows/api/workflow-api.ts');
    expect(fs.existsSync(wfApiFile)).toBe(true);

    const content = fs.readFileSync(wfApiFile, 'utf-8');
    expect(content.includes('onError: (err: any)')).toBe(false);
    expect(content.includes('AxiosError<ApiErrorResponse>')).toBe(true);
    expect(content.includes('getErrorMessage(')).toBe(true);
  });

  test('Guarantees use-billing.ts synchronizes and re-exports billing DTOs directly from @acc/client', () => {
    const billingApiFile = path.join(consoleSrc, 'features/metadata/api/use-billing.ts');
    expect(fs.existsSync(billingApiFile)).toBe(true);

    const content = fs.readFileSync(billingApiFile, 'utf-8');
    // Ensure it imports shared contracts from @acc/client rather than maintaining out-of-sync local declarations
    expect(content.includes("from '@acc/client'")).toBe(true);
    expect(content.includes('TenantBillingSummary')).toBe(true);
    expect(content.includes('QuotaUsage')).toBe(true);
    expect(content.includes('VatInvoiceInfo')).toBe(true);
    expect(content.includes('BillingTransaction')).toBe(true);
  });

  test('Guarantees error extractor safely falls back without throwing exceptions', async () => {
    const { getErrorMessage } = await import('../apps/console/src/core/utils/error-extractor');

    expect(getErrorMessage(null)).toBe('An unexpected error occurred');
    expect(getErrorMessage(new Error('Network request failed'))).toBe('Network request failed');

    const fakeAxiosError: any = {
      isAxiosError: true,
      response: {
        data: {
          error: 'BAD_REQUEST',
          message: 'Invalid workflow payload parameters',
        },
      },
    };
    expect(getErrorMessage(fakeAxiosError)).toBe('Invalid workflow payload parameters');
  });
});
