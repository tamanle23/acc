import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';

expect.extend(matchers);

declare module 'vitest' {
  export interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
  export interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}

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
import { ThemeSwitch } from '../theme-switch';
import { LanguageSwitch } from '../language-switch';
import { ThemeProvider } from '@/context/theme-provider';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en', changeLanguage: vi.fn() },
    t: (str: string) => str,
  }),
}));

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

  it('ThemeSwitch component should have zero a11y violations and dynamic aria-label', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { container, getByRole } = render(
      <ThemeProvider defaultTheme="light">
        <ThemeSwitch />
      </ThemeProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    const trigger = getByRole('button', { name: /Select theme \(current: Light\)/i });
    expect(trigger).toBeDefined();
  });

  it('LanguageSwitch component should have zero a11y violations and dynamic aria-label', async () => {
    const { container, getByRole } = render(<LanguageSwitch />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    const trigger = getByRole('button', { name: /Select language \(current: English\)/i });
    expect(trigger).toBeDefined();
  });
});
