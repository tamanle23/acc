/**
 * Computes 1-2 character uppercase initials from a user's display name, full name, username, or email.
 * Examples:
 * - "Jane Doe" => "JD"
 * - "admin@acc.io" => "AD"
 * - "satnaing" => "SA"
 * - "Sovereign Root Custodian" => "SC"
 */
export function getUserInitials(name?: string | null, fallback = 'U'): string {
  if (!name || !name.trim()) return fallback.toUpperCase();
  const trimmed = name.trim();

  // If email format, use the local-part before @
  const cleanName = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;

  const parts = cleanName.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return fallback.toUpperCase();
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
