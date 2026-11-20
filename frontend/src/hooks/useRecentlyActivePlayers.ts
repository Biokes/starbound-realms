import { useEffect, useState } from 'react';

export interface RecentlyActivePlayer {
  address: string;
  systemsOwned: number;
  /** ISO timestamp of the player's last indexed on-chain action. */
  lastActive: string;
}

/**
 * The raw shape `GET /player/recent` returns: `players` rows as-is
 * (snake_case columns, TIMESTAMPs serialized as ISO strings).
 */
interface RawPlayer {
  address: string;
  systems_owned: number;
  battles_won: number;
  battles_lost: number;
  first_seen: string;
  last_active: string;
}

function toRecentlyActivePlayer(raw: RawPlayer): RecentlyActivePlayer {
  return {
    address: raw.address,
    systemsOwned: raw.systems_owned,
    lastActive: raw.last_active,
  };
}

export interface UseRecentlyActivePlayersResult {
  players: RecentlyActivePlayer[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches the most recently active players from the backend's
 * `GET /player/recent` (newest first). Fetches once per mount.
 */
export function useRecentlyActivePlayers(backendUrl: string): UseRecentlyActivePlayersResult {
  const [players, setPlayers] = useState<RecentlyActivePlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${backendUrl}/player/recent`);
        if (!response.ok) {
          throw new Error(`failed to fetch recently active players: ${response.status}`);
        }
        const { players: raw } = (await response.json()) as { players: RawPlayer[] };
        if (!cancelled) setPlayers(raw.map(toRecentlyActivePlayer));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [backendUrl]);

  return { players, isLoading, error };
}
