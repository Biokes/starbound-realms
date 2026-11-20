import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlayerNotification {
  id: number;
  player: string;
  type: string;
  message: string;
  payload: Record<string, unknown> | null;
  read: boolean;
  createdAt: number;
}

/**
 * Raw shape returned by `GET /player/:address/notifications` — Postgres row
 * with BIGSERIAL id, TIMESTAMP as ISO string, JSONB as parsed object.
 */
interface RawNotification {
  id: number;
  player: string;
  type: string;
  message: string;
  payload: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

/** Maps the backend snake_case row to the frontend camelCase shape. */
function toPlayerNotification(raw: RawNotification): PlayerNotification {
  return {
    id: raw.id,
    player: raw.player,
    type: raw.type,
    message: raw.message,
    payload: raw.payload,
    read: raw.read,
    createdAt: Date.parse(raw.created_at),
  };
}

// ── Poll interval ─────────────────────────────────────────────────────────────

/** Default polling interval in milliseconds. */
export const NOTIFICATIONS_POLL_INTERVAL_MS = 15_000;

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseNotificationsResult {
  notifications: PlayerNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  /** Trigger an immediate re-fetch (e.g. after the user dismisses a toast). */
  refetch: () => Promise<void>;
}

/**
 * Polls `GET /player/:address/notifications` on a fixed interval and returns
 * the player's most recent notifications, newest first.
 *
 * Skips the request entirely while `address` is null (no wallet connected).
 *
 * This supplements the WebSocket push (#219/#220): when a push arrives the
 * caller can invoke `refetch()` to immediately sync the latest notifications
 * rather than waiting for the next polling tick.
 */
export function useNotificationsData(
  backendUrl: string,
  address: string | null,
  pollIntervalMs = NOTIFICATIONS_POLL_INTERVAL_MS
): UseNotificationsResult {
  const [notifications, setNotifications] = useState<PlayerNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const load = useCallback(async () => {
    if (!address) {
      setNotifications([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/player/${address}/notifications`);
      if (!response.ok) {
        throw new Error(`failed to fetch notifications: ${response.status}`);
      }
      const { notifications: raw } = (await response.json()) as {
        notifications: RawNotification[];
      };
      if (isMounted.current) {
        setNotifications(raw.map(toPlayerNotification));
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [backendUrl, address]);

  // Initial fetch and polling loop
  useEffect(() => {
    isMounted.current = true;
    load();

    if (!address) return;

    const timer = setInterval(load, pollIntervalMs);
    return () => {
      isMounted.current = false;
      clearInterval(timer);
    };
  }, [load, address, pollIntervalMs]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, isLoading, error, refetch: load };
}
