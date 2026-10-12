import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { SkipToMain } from '../skip-to-main';
import { Main } from '../layout/main';
import { PasswordInput } from '../password-input';
import { ConfirmDialog } from '../confirm-dialog';
import { DataTablePagination } from '../data-table/pagination';

describe('Component Accessibility Test Suite (axe-core)', () => {
  it('SkipToMain component should have zero a11y violations', async () => {
    const { container } = render(<SkipToMain />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Main layout component should have zero a11y violations', async () => {
    const { container } = render(
      <Main id="content" tabIndex={-1}>
        <h1>Main Content Title</h1>
        <p>This is accessible main body content.</p>
      </Main>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('PasswordInput component should have zero a11y violations', async () => {
    const { container } = render(
      <div>
        <label htmlFor="password-field">Password</label>
        <PasswordInput id="password-field" placeholder="Enter password" />
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('ConfirmDialog open state should have zero a11y violations', async () => {
    const { container } = render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Confirm Deletion"
        desc="Are you sure you want to delete this resource?"
        handleConfirm={() => {}}
        confirmText="Delete"
        cancelBtnText="Cancel"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('DataTablePagination should have zero a11y violations and correct ARIA attributes', async () => {
    const mockTable = {
      getState: () => ({ pagination: { pageIndex: 0, pageSize: 10 } }),
      getPageCount: () => 5,
      getCanPreviousPage: () => false,
      getCanNextPage: () => true,
      setPageSize: () => {},
      setPageIndex: () => {},
      previousPage: () => {},
      nextPage: () => {},
    } as any;

    const { container, getByLabelText } = render(
      <DataTablePagination table={mockTable} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    const activePageBtn = getByLabelText('Page 1');
    expect(activePageBtn.getAttribute('aria-current')).toBe('page');

    expect(getByLabelText('Go to first page')).toBeDefined();
    expect(getByLabelText('Go to previous page')).toBeDefined();
    expect(getByLabelText('Go to next page')).toBeDefined();
    expect(getByLabelText('Go to last page')).toBeDefined();
  });
});
