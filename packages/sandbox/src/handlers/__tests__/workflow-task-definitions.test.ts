import { describe, it, expect, beforeEach } from 'vitest';
import { workflowTaskDefinitionsSandboxRepo } from '../workflow-handler';

describe('WorkflowTaskDefinitionsSandboxRepository Suite', () => {
  beforeEach(() => {
    workflowTaskDefinitionsSandboxRepo.reset();
  });

  it('lists pre-seeded canonical domain task definitions', () => {
    const list = workflowTaskDefinitionsSandboxRepo.listLatest('tenant-acme');
    expect(list.length).toBeGreaterThanOrEqual(6);
    const names = list.map((t) => t.name);
    expect(names).toContain('validateOrder');
    expect(names).toContain('checkInventory');
    expect(names).toContain('chargePayment');
    expect(names).toContain('expressCourier');
    expect(names).toContain('groundPostal');
    expect(names).toContain('cancelCourierBooking');

    const validateOrder = list.find((t) => t.name === 'validateOrder');
    expect(validateOrder?.status).toBe('ACTIVE');
    expect(validateOrder?.version).toBe(1);
    expect(validateOrder?.inputSchema).toHaveProperty('properties');
  });

  it('hard forks into a new DRAFT version when mutating an active task definition', () => {
    const draft = workflowTaskDefinitionsSandboxRepo.createOrForkDraft(
      {
        name: 'validateOrder',
        description: 'Updated KYC and AML checks for 2026 regulations',
        retryCount: 5,
      },
      'tenant-acme'
    );

    expect(draft.name).toBe('validateOrder');
    expect(draft.version).toBe(2);
    expect(draft.status).toBe('DRAFT');
    expect(draft.retryCount).toBe(5);

    // Verify v1 is still ACTIVE and unmutated
    const v1 = workflowTaskDefinitionsSandboxRepo.resolve('validateOrder', 1, 'tenant-acme');
    expect(v1?.status).toBe('ACTIVE');
    expect(v1?.retryCount).toBe(3);

    // Verify all versions ledger
    const versions = workflowTaskDefinitionsSandboxRepo.listVersions('validateOrder', 'tenant-acme');
    expect(versions.length).toBe(2);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
  });

  it('promotes DRAFT to ACTIVE and deprecates older active version', () => {
    // 1. Fork v2
    workflowTaskDefinitionsSandboxRepo.createOrForkDraft({ name: 'validateOrder' }, 'tenant-acme');

    // 2. Publish v2
    const published = workflowTaskDefinitionsSandboxRepo.publishVersion('validateOrder', 2, 'tenant-acme');
    expect(published?.status).toBe('ACTIVE');
    expect(published?.version).toBe(2);

    // 3. Verify v1 is now DEPRECATED
    const v1 = workflowTaskDefinitionsSandboxRepo.resolve('validateOrder', 1, 'tenant-acme');
    expect(v1?.status).toBe('DEPRECATED');

    // 4. Resolve without version should yield latest ACTIVE (v2)
    const latestActive = workflowTaskDefinitionsSandboxRepo.resolve('validateOrder', undefined, 'tenant-acme');
    expect(latestActive?.version).toBe(2);
    expect(latestActive?.status).toBe('ACTIVE');
  });

  it('allows deleting DRAFT versions but preserves history', () => {
    workflowTaskDefinitionsSandboxRepo.createOrForkDraft({ name: 'validateOrder' }, 'tenant-acme');
    const deleted = workflowTaskDefinitionsSandboxRepo.deleteDraftVersion('validateOrder', 2, 'tenant-acme');
    expect(deleted).toBe(true);

    const versions = workflowTaskDefinitionsSandboxRepo.listVersions('validateOrder', 'tenant-acme');
    expect(versions.length).toBe(1);
    expect(versions[0].version).toBe(1);

    // Deleting active v1 should fail
    const activeDelete = workflowTaskDefinitionsSandboxRepo.deleteDraftVersion('validateOrder', 1, 'tenant-acme');
    expect(activeDelete).toBe(false);
  });
});
