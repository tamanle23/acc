import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Settings } from './index';

// ResizeObserver is required by @radix-ui/react-scroll-area but not available in JSDOM
beforeAll(() => {
  (globalThis as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock SidebarNav to avoid transitive Radix ScrollArea dependencies in JSDOM
vi.mock('./components/sidebar-nav', () => ({
  SidebarNav: ({ items }: { items: Array<{ href: string; title: string }> }) => (
    <nav data-testid="sidebar-nav">
      {items.map((item) => (
        <a key={item.href} href={item.href} data-testid={`nav-${item.href}`}>
          {item.title}
        </a>
      ))}
    </nav>
  ),
}));

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <div data-testid="outlet">Settings Content</div>,
  useLocation: () => ({ pathname: '/settings' }),
  useNavigate: () => vi.fn(),
  Link: ({ to, children, className }: any) => (
    <a href={to} className={className} data-testid={`nav-${to}`}>
      {children}
    </a>
  ),
}));

// Mock layout components
vi.mock('@/components/layout/header', () => ({
  Header: ({ children }: any) => <header>{children}</header>,
}));
vi.mock('@/components/layout/main', () => ({
  Main: ({ children }: any) => <main>{children}</main>,
}));
vi.mock('@/components/search', () => ({
  Search: () => <div>Search</div>,
}));
vi.mock('@/components/language-switch', () => ({
  LanguageSwitch: () => <div>Lang</div>,
}));
vi.mock('@/components/theme-switch', () => ({
  ThemeSwitch: () => <div>Theme</div>,
}));
vi.mock('@/components/config-drawer', () => ({
  ConfigDrawer: () => <div>Config</div>,
}));
vi.mock('@/components/profile-dropdown', () => ({
  ProfileDropdown: () => <div>Profile</div>,
}));

describe('Settings Navigation', () => {
  it('renders all settings sidebar navigation tabs including Workspaces and Billing', () => {
    render(<Settings />);

    const nav = screen.getByTestId('sidebar-nav');
    expect(nav).toBeDefined();

    // Profile nav link
    const profileLink = screen.getByTestId('nav-/settings');
    expect(profileLink.textContent).toBe('Profile');

    // Workspaces nav link
    const workspacesLink = screen.getByTestId('nav-/settings/workspaces');
    expect(workspacesLink.textContent).toBe('Workspaces');
    expect(workspacesLink.getAttribute('href')).toBe('/settings/workspaces');

    // Billing & Subscriptions nav link
    const billingLink = screen.getByTestId('nav-/settings/billing');
    expect(billingLink.textContent).toBe('Billing & Subscriptions');
    expect(billingLink.getAttribute('href')).toBe('/settings/billing');

    // Other nav links present
    expect(screen.getByTestId('nav-/settings/appearance').textContent).toBe('Appearance');
    expect(screen.getByTestId('nav-/settings/notifications').textContent).toBe('Notifications');
    expect(screen.getByTestId('nav-/settings/data-privacy').textContent).toBe('Data & Privacy');
  });
});
