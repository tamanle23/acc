import type { StudioState, UserPreset } from '@/types/studio';
import { validateStudioConfig } from './config-engine';

export const ACTIVE_SESSION_KEY = 'kinetix_active_session';
export const USER_PRESETS_KEY = 'kinetix_user_presets';

// Fallback headless memory store for tests and SSR
const memoryStorage: Record<string, string> = {};

function getStorageItem(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStorage[key] ?? null;
    }
  }
  return memoryStorage[key] ?? null;
}

function setStorageItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      memoryStorage[key] = value;
      return;
    }
  }
  memoryStorage[key] = value;
}

function removeStorageItem(key: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
      return;
    } catch {
      delete memoryStorage[key];
      return;
    }
  }
  delete memoryStorage[key];
}

/**
 * Saves current working studio state to localStorage session storage.
 */
export function saveActiveSession(state: StudioState): void {
  try {
    const serialized = JSON.stringify(state);
    setStorageItem(ACTIVE_SESSION_KEY, serialized);
  } catch (err) {
    console.warn('Failed to save active session', err);
  }
}

/**
 * Loads the last saved working session from localStorage.
 */
export function loadActiveSession(): Partial<StudioState> | null {
  try {
    const raw = getStorageItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const validated = validateStudioConfig(parsed);
    return validated.config ?? null;
  } catch {
    return null;
  }
}

/**
 * Clears the active session from localStorage.
 */
export function clearActiveSession(): void {
  removeStorageItem(ACTIVE_SESSION_KEY);
}

/**
 * Loads all saved user presets from localStorage.
 */
export function loadUserPresets(): UserPreset[] {
  try {
    const raw = getStorageItem(USER_PRESETS_KEY);
    if (!raw) return [];
    const presets = JSON.parse(raw);
    return Array.isArray(presets) ? presets : [];
  } catch {
    return [];
  }
}

/**
 * Saves a new named user preset to localStorage.
 */
export function saveUserPreset(
  title: string,
  category: string = 'Custom',
  state: StudioState
): UserPreset {
  const presets = loadUserPresets();
  const newPreset: UserPreset = {
    id: `user_preset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim() || 'Untitled Production',
    category: category || 'Custom',
    badge: 'USER',
    createdAt: Date.now(),
    statePatch: { ...state },
  };

  presets.unshift(newPreset);
  setStorageItem(USER_PRESETS_KEY, JSON.stringify(presets));
  return newPreset;
}

/**
 * Deletes a user preset by ID.
 */
export function deleteUserPreset(id: string): void {
  const presets = loadUserPresets().filter((p) => p.id !== id);
  setStorageItem(USER_PRESETS_KEY, JSON.stringify(presets));
}

/**
 * Exports all user presets to a JSON string.
 */
export function exportPresetsToJson(): string {
  const presets = loadUserPresets();
  return JSON.stringify(presets, null, 2);
}

/**
 * Imports user presets from a JSON string, merging them with existing presets.
 * Returns the count of successfully imported presets.
 */
export function importPresetsFromJson(jsonString: string): number {
  try {
    const imported = JSON.parse(jsonString);
    if (!Array.isArray(imported)) return 0;

    const existing = loadUserPresets();
    const existingIds = new Set(existing.map((p) => p.id));
    let count = 0;

    for (const item of imported) {
      if (item && typeof item === 'object' && item.title && item.statePatch) {
        const id = item.id && !existingIds.has(item.id) ? item.id : `user_preset_${Date.now()}_${count}`;
        existing.unshift({
          id,
          title: String(item.title),
          category: String(item.category || 'Custom'),
          badge: 'USER',
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
          statePatch: item.statePatch,
        });
        existingIds.add(id);
        count++;
      }
    }

    setStorageItem(USER_PRESETS_KEY, JSON.stringify(existing));
    return count;
  } catch {
    return 0;
  }
}
