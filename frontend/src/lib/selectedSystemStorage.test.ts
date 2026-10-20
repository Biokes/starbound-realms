import { describe, it, expect } from 'vitest';
import {
  SELECTED_SYSTEM_STORAGE_KEY,
  readStoredSystemId,
  storeSystemId,
  clearStoredSystemId,
} from './selectedSystemStorage';

/** Minimal in-memory stand-in for `localStorage`. */
function createMemoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    data: map,
  };
}

/** A storage whose every access throws, like a locked-down private-mode browser. */
const throwingStorage = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
  removeItem: () => {
    throw new Error('denied');
  },
};

describe('readStoredSystemId', () => {
  it('returns null when nothing has been stored', () => {
    expect(readStoredSystemId(createMemoryStorage())).toBeNull();
  });

  it('returns the stored system id as a number', () => {
    const storage = createMemoryStorage({ [SELECTED_SYSTEM_STORAGE_KEY]: '42' });

    expect(readStoredSystemId(storage)).toBe(42);
  });

  it('returns null for a value that is not an integer id', () => {
    const storage = createMemoryStorage({ [SELECTED_SYSTEM_STORAGE_KEY]: 'not-a-number' });

    expect(readStoredSystemId(storage)).toBeNull();
  });

  it('returns null instead of throwing when storage is unavailable', () => {
    expect(readStoredSystemId(throwingStorage)).toBeNull();
  });
});

describe('storeSystemId', () => {
  it('persists the system id under the selection key', () => {
    const storage = createMemoryStorage();

    storeSystemId(7, storage);

    expect(storage.data.get(SELECTED_SYSTEM_STORAGE_KEY)).toBe('7');
  });

  it('does not throw when storage is unavailable', () => {
    expect(() => storeSystemId(7, throwingStorage)).not.toThrow();
  });
});

describe('clearStoredSystemId', () => {
  it('removes the persisted system id', () => {
    const storage = createMemoryStorage({ [SELECTED_SYSTEM_STORAGE_KEY]: '7' });

    clearStoredSystemId(storage);

    expect(storage.data.has(SELECTED_SYSTEM_STORAGE_KEY)).toBe(false);
  });

  it('does not throw when storage is unavailable', () => {
    expect(() => clearStoredSystemId(throwingStorage)).not.toThrow();
  });
});
