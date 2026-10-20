/** localStorage key holding the id of the star system the player last selected (#133). */
export const SELECTED_SYSTEM_STORAGE_KEY = 'starbound-selected-system';

type SelectionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Returns the persisted system id, or null when none is stored, the stored
 * value is not an integer, or storage is unavailable (private-mode browsers
 * can throw on access).
 */
export function readStoredSystemId(storage: SelectionStorage = window.localStorage): number | null {
  try {
    const raw = storage.getItem(SELECTED_SYSTEM_STORAGE_KEY);
    if (raw === null) return null;
    const systemId = Number.parseInt(raw, 10);
    return Number.isInteger(systemId) ? systemId : null;
  } catch {
    return null;
  }
}

/** Persists the selected system id. Silently does nothing if storage is unavailable. */
export function storeSystemId(systemId: number, storage: SelectionStorage = window.localStorage): void {
  try {
    storage.setItem(SELECTED_SYSTEM_STORAGE_KEY, String(systemId));
  } catch {
    // Storage is a convenience only; the selection still works without it.
  }
}

/** Forgets the persisted selection. Silently does nothing if storage is unavailable. */
export function clearStoredSystemId(storage: SelectionStorage = window.localStorage): void {
  try {
    storage.removeItem(SELECTED_SYSTEM_STORAGE_KEY);
  } catch {
    // Nothing to clear when storage cannot be reached.
  }
}
