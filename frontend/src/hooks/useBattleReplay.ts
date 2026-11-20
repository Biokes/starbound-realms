import { useCallback, useEffect, useRef, useState } from 'react';

export interface ReplayFleetSnapshot {
  scouts: number;
  fighters: number;
  cruisers: number;
  dreadnoughts: number;
}

export interface ReplayRound {
  roundNumber: number;
  attacker: ReplayFleetSnapshot;
  defender: ReplayFleetSnapshot;
}

export interface ReplayBattle {
  battleId: number;
  attacker: string;
  defender: string;
  systemId: number;
  winner: string;
  rounds: number;
  ledgerSequence: number;
}

export interface BattleReplay {
  battle: ReplayBattle;
  rounds: ReplayRound[];
}

/** Raw shape from the backend (snake_case Postgres rows). */
interface RawReplayRound {
  round_number: number;
  attacker_scouts: number;
  attacker_fighters: number;
  attacker_cruisers: number;
  attacker_dreadnoughts: number;
  defender_scouts: number;
  defender_fighters: number;
  defender_cruisers: number;
  defender_dreadnoughts: number;
}

interface RawReplayBattle {
  battle_id: string;
  attacker: string;
  defender: string;
  system_id: number;
  winner: string;
  rounds: number;
  ledger_sequence: string;
}

function toReplayRound(raw: RawReplayRound): ReplayRound {
  return {
    roundNumber: raw.round_number,
    attacker: {
      scouts: raw.attacker_scouts,
      fighters: raw.attacker_fighters,
      cruisers: raw.attacker_cruisers,
      dreadnoughts: raw.attacker_dreadnoughts,
    },
    defender: {
      scouts: raw.defender_scouts,
      fighters: raw.defender_fighters,
      cruisers: raw.defender_cruisers,
      dreadnoughts: raw.defender_dreadnoughts,
    },
  };
}

function toReplayBattle(raw: RawReplayBattle): ReplayBattle {
  return {
    battleId: Number(raw.battle_id),
    attacker: raw.attacker,
    defender: raw.defender,
    systemId: raw.system_id,
    winner: raw.winner,
    rounds: raw.rounds,
    ledgerSequence: Number(raw.ledger_sequence),
  };
}

export interface UseBattleReplayResult {
  replay: BattleReplay | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches replay data for a single battle from `GET /battles/:battleId/replay`.
 * Pass `null` as `battleId` to skip the fetch (e.g. when no battle is selected).
 */
export function useBattleReplay(backendUrl: string, battleId: number | null): UseBattleReplayResult {
  const [replay, setReplay] = useState<BattleReplay | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const load = useCallback(async () => {
    if (battleId === null) {
      setReplay(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${backendUrl}/battles/${battleId}/replay`);
      if (!response.ok) {
        throw new Error(`failed to fetch replay: ${response.status}`);
      }
      const data = (await response.json()) as { battle: RawReplayBattle; rounds: RawReplayRound[] };
      if (isMounted.current) {
        setReplay({
          battle: toReplayBattle(data.battle),
          rounds: data.rounds.map(toReplayRound),
        });
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : String(err));
        setReplay(null);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [backendUrl, battleId]);

  useEffect(() => {
    isMounted.current = true;
    load();
    return () => {
      isMounted.current = false;
    };
  }, [load]);

  return { replay, isLoading, error };
}
