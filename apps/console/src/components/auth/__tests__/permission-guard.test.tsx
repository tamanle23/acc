import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionGuard } from '../permission-guard';
import { AuthorizedButton } from '../authorized-button';
import { AuthorizedDropdownMenuItem } from '../authorized-dropdown-item';
import { useSpringAuthStore } from '@/features/spring-auth';
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

describe('PermissionGuard & Authorized Primitives', () => {
  beforeEach(() => {
    useSpringAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isSandbox: false,
    });
    useSandboxStore.setState({
      enabled: true,
      activePersonaId: 'user', // standard member: has entity:record:create/read, lacks workflow:definition:manage
    });
  });

  describe('PermissionGuard', () => {
    it('renders enabled child when user has permission', () => {
      render(
        <PermissionGuard permission="entity:record:create">
          <button data-testid="allowed-btn">Create Record</button>
        </PermissionGuard>
      );

      const btn = screen.getByTestId('allowed-btn');
      expect(btn.hasAttribute('disabled')).toBe(false);
      expect(btn.textContent).toContain('Create Record');
    });

    it('renders disabled child wrapped with aria-disabled and tooltip container when user lacks permission in disable mode', () => {
      render(
        <PermissionGuard permission="workflow:definition:manage" behavior="disable">
          <button data-testid="guarded-btn">Create Workflow</button>
        </PermissionGuard>
      );

      const btn = screen.getByTestId('guarded-btn');
      expect(btn.hasAttribute('disabled')).toBe(true);
      expect(btn.getAttribute('aria-disabled')).toBe('true');
    });

    it('hides child completely when behavior is hide and user lacks permission', () => {
      render(
        <PermissionGuard
          permission="workflow:definition:manage"
          behavior="hide"
          fallback={<span data-testid="unauth-fallback">No Access</span>}
        >
          <button data-testid="guarded-btn">Create Workflow</button>
        </PermissionGuard>
      );

      expect(screen.queryByTestId('guarded-btn')).toBeNull();
      expect(screen.getByTestId('unauth-fallback').textContent).toBe('No Access');
    });
  });

  describe('AuthorizedButton', () => {
    it('renders enabled button when permitted', () => {
      render(
        <AuthorizedButton permission="entity:record:create" data-testid="auth-btn">
          Submit
        </AuthorizedButton>
      );

      const btn = screen.getByTestId('auth-btn');
      expect(btn.hasAttribute('disabled')).toBe(false);
    });

    it('renders disabled button with aria-disabled and tooltip container when unauthorized', () => {
      render(
        <AuthorizedButton permission="workflow:definition:manage" data-testid="auth-btn">
          Create Workflow
        </AuthorizedButton>
      );

      const btn = screen.getByTestId('auth-btn');
      expect(btn.hasAttribute('disabled')).toBe(true);
      expect(btn.getAttribute('aria-disabled')).toBe('true');
    });

    it('hides button when behavior is hide and unauthorized', () => {
      render(
        <AuthorizedButton
          permission="workflow:definition:manage"
          behavior="hide"
          data-testid="auth-btn"
        >
          Create Workflow
        </AuthorizedButton>
      );

      expect(screen.queryByTestId('auth-btn')).toBeNull();
    });
  });

  describe('AuthorizedDropdownMenuItem', () => {
    it('renders disabled item when unauthorized', () => {
      render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <AuthorizedDropdownMenuItem
              permission="workflow:definition:manage"
              data-testid="menu-item"
            >
              Manage Workflow
            </AuthorizedDropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('menu-item');
      expect(item.getAttribute('aria-disabled')).toBe('true');
      expect(item.hasAttribute('data-disabled')).toBe(true);
    });
  });
});
