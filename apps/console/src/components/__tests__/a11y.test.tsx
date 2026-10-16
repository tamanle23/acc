import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('@/components/command-menu', () => ({
  CommandMenu: () => null,
}));
import { SkipToMain } from '../skip-to-main';
import { Main } from '../layout/main';
import { PasswordInput } from '../password-input';
import { ConfirmDialog } from '../confirm-dialog';
import { DataTablePagination } from '../data-table/pagination';
import { Search } from '../search';
import { SearchProvider } from '@/context/search-provider';
import { SidebarProvider, SidebarTrigger } from '../ui/sidebar';

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

  it('Search trigger component should have zero a11y violations and accurate ARIA label', async () => {
    const { container, getByRole } = render(
      <SearchProvider>
        <Search placeholder="Search docs" />
      </SearchProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    const button = getByRole('button', { name: /Search docs \(Press Ctrl\+K or Cmd\+K\)/i });
    expect(button).toBeDefined();
  });

  it('SidebarTrigger component should have zero a11y violations and dynamic ARIA state', async () => {
    window.matchMedia = window.matchMedia || vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container, getByRole } = render(
      <SidebarProvider defaultOpen={true}>
        <SidebarTrigger />
      </SidebarProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    const triggerBtn = getByRole('button', { name: 'Collapse sidebar' });
    expect(triggerBtn.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(triggerBtn);

    const updatedBtn = getByRole('button', { name: 'Expand sidebar' });
    expect(updatedBtn.getAttribute('aria-expanded')).toBe('false');
  });
});
