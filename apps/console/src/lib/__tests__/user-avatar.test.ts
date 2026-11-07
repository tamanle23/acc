import { describe, expect, it } from 'vitest';
import { getUserInitials } from '../user-avatar';

describe('getUserInitials', () => {
  it('extracts two-letter initials from full names', () => {
    expect(getUserInitials('Jane Doe')).toBe('JD');
    expect(getUserInitials('John Michael Smith')).toBe('JS');
    expect(getUserInitials('Sovereign Root Custodian')).toBe('SC');
  });

  it('extracts two-letter initials from single-word or hyphenated names', () => {
    expect(getUserInitials('satnaing')).toBe('SA');
    expect(getUserInitials('admin')).toBe('AD');
    expect(getUserInitials('operations_lead')).toBe('OL');
    expect(getUserInitials('tenant-owner')).toBe('TO');
  });

  it('extracts initials from email addresses', () => {
    expect(getUserInitials('admin@acc.io')).toBe('AD');
    expect(getUserInitials('john.doe@company.com')).toBe('JD');
  });

  it('handles null, undefined, and empty strings with fallback', () => {
    expect(getUserInitials(null)).toBe('U');
    expect(getUserInitials(undefined)).toBe('U');
    expect(getUserInitials('')).toBe('U');
    expect(getUserInitials('   ', 'X')).toBe('X');
  });
});
