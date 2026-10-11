import { vi } from 'vitest';

const memoryStorage = new Map<string, string>();

export const mockAsyncStorage = {
  getItem: vi.fn(async (key: string) => memoryStorage.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => {
    memoryStorage.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => {
    memoryStorage.delete(key);
  }),
  clear: vi.fn(async () => {
    memoryStorage.clear();
  }),
  getAllKeys: vi.fn(async () => Array.from(memoryStorage.keys())),
};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: mockAsyncStorage,
}));
