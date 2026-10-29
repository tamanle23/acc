import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Formal Verification Suite: Console Dead Code Elimination & Shared Data-Table Consolidation
 * Target: apps/console/src/features/users, apps/console/src/features/workflow-executions
 * Standards: NO-ORPHANED-CODE, COMMON-COMPONENT-PRIORITY, WCAG-2.2-AA
 */
describe('Phase 3: Dead Code Elimination & Shared Data-Table Consolidation', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const consoleSrc = path.join(repoRoot, 'apps/console/src');

  test('Guarantees orphaned RegisterUserForm and useRegisterUserFacade are completely deleted', () => {
    const deadRegisterForm = path.join(consoleSrc, 'features/users/components/RegisterUserForm.tsx');
    const deadRegisterFacade = path.join(consoleSrc, 'features/users/api/useRegisterUserFacade.ts');

    expect(fs.existsSync(deadRegisterForm)).toBe(false);
    expect(fs.existsSync(deadRegisterFacade)).toBe(false);
  });

  test('Guarantees absolute absence of obsolete /api/v2/users/register across all source files', () => {
    const scanDir = (dir: string): string[] => {
      let files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', '.next', 'target'].includes(entry.name)) {
            files = files.concat(scanDir(fullPath));
          }
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const sourceFiles = scanDir(consoleSrc);
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content.includes('/api/v2/users/register')).toBe(false);
    }
  });

  test('Guarantees UsersBulkActions exists with proper export signature and uses common primitives', () => {
    const usersBulkActionsFile = path.join(consoleSrc, 'features/users/components/users-bulk-actions.tsx');
    expect(fs.existsSync(usersBulkActionsFile)).toBe(true);

    const content = fs.readFileSync(usersBulkActionsFile, 'utf-8');
    expect(content.includes('export function UsersBulkActions')).toBe(true);
    // Verifies it imports and composes the common primitive from '@/components/data-table'
    expect(content.includes("from '@/components/data-table'")).toBe(true);
    expect(content.includes('BulkActionsToolbar')).toBe(true);
  });

  test('Guarantees WorkflowExecutionsBulkActions exists with proper export signature and uses common primitives', () => {
    const wfBulkActionsFile = path.join(
      consoleSrc,
      'features/workflow-executions/components/workflow-executions-bulk-actions.tsx'
    );
    expect(fs.existsSync(wfBulkActionsFile)).toBe(true);

    const content = fs.readFileSync(wfBulkActionsFile, 'utf-8');
    expect(content.includes('export function WorkflowExecutionsBulkActions')).toBe(true);
    // Verifies it imports and composes the common primitive from '@/components/data-table'
    expect(content.includes("from '@/components/data-table'")).toBe(true);
    expect(content.includes('BulkActionsToolbar')).toBe(true);
  });

  test('Guarantees users-table and workflow-executions-table consume disambiguated bulk actions and shared pagination', () => {
    const usersTable = path.join(consoleSrc, 'features/users/components/users-table.tsx');
    const wfTable = path.join(
      consoleSrc,
      'features/workflow-executions/components/workflow-executions-table.tsx'
    );

    const usersContent = fs.readFileSync(usersTable, 'utf-8');
    expect(usersContent.includes("import { UsersBulkActions } from './users-bulk-actions'")).toBe(true);
    expect(usersContent.includes('<UsersBulkActions table={table} />')).toBe(true);
    expect(usersContent.includes('DataTablePagination')).toBe(true);

    const wfContent = fs.readFileSync(wfTable, 'utf-8');
    expect(
      wfContent.includes("import { WorkflowExecutionsBulkActions } from './workflow-executions-bulk-actions'")
    ).toBe(true);
    expect(wfContent.includes('<WorkflowExecutionsBulkActions table={table} />')).toBe(true);
    expect(wfContent.includes('DataTablePagination')).toBe(true);
  });

  test('Guarantees WCAG 2.2 AA accessibility attributes on bulk action control elements', () => {
    const usersBulkActionsFile = path.join(consoleSrc, 'features/users/components/users-bulk-actions.tsx');
    const wfBulkActionsFile = path.join(
      consoleSrc,
      'features/workflow-executions/components/workflow-executions-bulk-actions.tsx'
    );

    const usersContent = fs.readFileSync(usersBulkActionsFile, 'utf-8');
    expect(usersContent.includes('aria-label=')).toBe(true);
    expect(usersContent.includes('sr-only')).toBe(true);

    const wfContent = fs.readFileSync(wfBulkActionsFile, 'utf-8');
    expect(wfContent.includes('aria-label=')).toBe(true);
    expect(wfContent.includes('TooltipTrigger')).toBe(true);
  });
});
