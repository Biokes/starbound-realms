import { rpc } from '@stellar/stellar-sdk';
import { Pool } from 'pg';
import { runIndexerPollCycle, startEventListener, EventListenerHandle } from './eventListener';
import { fetchIndexerCursor, saveIndexerCursor } from '../db/queries';
import { EventBroadcaster } from './processor';

/** A poll cycle that returns the ledger the next cycle should resume from. */
export type PollCycle = (startLedger: number) => Promise<number>;

/**
 * Wraps a poll cycle so the resume ledger is persisted after each successful
 * run, letting a restart continue from the last processed ledger instead of
 * replaying from scratch.
 */
export function createPersistingPollCycle(
  runPollCycle: PollCycle,
  saveCursor: (ledger: number) => Promise<void>
): PollCycle {
  return async (startLedger: number) => {
    const nextLedger = await runPollCycle(startLedger);
    await saveCursor(nextLedger);
    return nextLedger;
  };
}

export interface StartIndexerOptions {
  db: Pool;
  rpcUrl: string;
  contractIds: string[];
  pollIntervalMs: number;
  onError?: (err: unknown) => void;
  /**
   * Permits a plain-http RPC URL. Only for local nodes and test doubles —
   * the stellar-sdk refuses non-https endpoints by default.
   */
  allowHttp?: boolean;
  /**
   * Optional WebSocket broadcaster (#220). When provided, the indexer will
   * call it after each event is persisted so connected clients receive a push.
   */
  broadcast?: EventBroadcaster;
}

/**
 * Reads the persisted ledger cursor and starts the event listener loop, with
 * each cycle's cursor written back so it survives a restart.
 */
export async function startIndexer(options: StartIndexerOptions): Promise<EventListenerHandle> {
  const server = new rpc.Server(options.rpcUrl, { allowHttp: options.allowHttp ?? false });
  const startLedger = await fetchIndexerCursor(options.db);

  return startEventListener({
    runPollCycle: createPersistingPollCycle(
      (ledger) => runIndexerPollCycle(server, options.db, options.contractIds, ledger, options.broadcast),
      (ledger) => saveIndexerCursor(options.db, ledger)
    ),
    startLedger,
    pollIntervalMs: options.pollIntervalMs,
    onError: options.onError,
  });
}
