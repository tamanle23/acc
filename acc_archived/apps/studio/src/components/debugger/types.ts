/**
 * Shared types and JSON Pointer utilities for the Visual VideoIR JSON Editor & Debugger.
 */

export type JsonPath = (string | number)[];

export interface VisualJsonNodeInfo {
  key: string;
  path: JsonPath;
  value: unknown;
  depth: number;
}

export type DebuggerViewMode = 'split' | 'tree' | 'code' | 'diagnostics';

/**
 * Gets the value from an object or array at a given path.
 */
export function getJsonValueAtPath(root: unknown, path: JsonPath): unknown {
  if (path.length === 0) return root;
  let current: any = root;
  for (const segment of path) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

/**
 * Immutably updates a value at a given path in a JSON-compatible data structure.
 * Returns a new root object/array with the updated value.
 */
export function setJsonValueAtPath<T = unknown>(root: T, path: JsonPath, newValue: unknown): T {
  if (path.length === 0) {
    return newValue as T;
  }

  // Deep clone root immutably along the path
  const clone = Array.isArray(root) ? [...root] : { ...(root as any) };
  let current: any = clone;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const nextKey = path[i + 1];

    if (current[key] === null || typeof current[key] !== 'object') {
      current[key] = typeof nextKey === 'number' ? [] : {};
    } else {
      current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...current[key] };
    }
    current = current[key];
  }

  const lastKey = path[path.length - 1];
  current[lastKey] = newValue;
  return clone as T;
}

/**
 * Immutably deletes a property or array item at a given path.
 */
export function deleteJsonValueAtPath<T = unknown>(root: T, path: JsonPath): T {
  if (path.length === 0) return root;

  const clone = Array.isArray(root) ? [...root] : { ...(root as any) };
  let current: any = clone;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (current[key] === null || typeof current[key] !== 'object') {
      return root; // Path does not exist
    }
    current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...current[key] };
    current = current[key];
  }

  const lastKey = path[path.length - 1];
  if (Array.isArray(current)) {
    const idx = Number(lastKey);
    if (!Number.isNaN(idx) && idx >= 0 && idx < current.length) {
      current.splice(idx, 1);
    }
  } else if (current && typeof current === 'object') {
    delete current[lastKey];
  }

  return clone as T;
}

/**
 * Immutably inserts an item into an array at a given path.
 */
export function insertJsonArrayItem<T = unknown>(root: T, path: JsonPath, item: unknown, atIndex?: number): T {
  const targetArray = getJsonValueAtPath(root, path);
  if (!Array.isArray(targetArray)) {
    return root;
  }

  const newArray = [...targetArray];
  if (typeof atIndex === 'number' && atIndex >= 0 && atIndex <= newArray.length) {
    newArray.splice(atIndex, 0, item);
  } else {
    newArray.push(item);
  }

  return setJsonValueAtPath(root, path, newArray);
}

/**
 * Converts a path array into a readable JSON pointer string (e.g. "tracks[0].sequences[1].id")
 */
export function formatJsonPath(path: JsonPath): string {
  if (path.length === 0) return '$ (root)';
  return path.reduce<string>((acc, segment, idx) => {
    if (typeof segment === 'number') {
      return `${acc}[${segment}]`;
    }
    return idx === 0 ? String(segment) : `${acc}.${segment}`;
  }, '');
}
