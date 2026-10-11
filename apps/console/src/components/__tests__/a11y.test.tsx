import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { SkipToMain } from '../skip-to-main';
import { Main } from '../layout/main';
import { PasswordInput } from '../password-input';
import { ConfirmDialog } from '../confirm-dialog';

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
});
