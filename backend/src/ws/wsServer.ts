/**
 * WebSocket push server (#220).
 *
 * Protocol design (#219):
 *   - Single broadcast channel: all connected clients receive every indexed event.
 *   - Message shape: { type: string; topic: string[]; ledgerSequence: number; payload: unknown }
 *   - Supplements polling — the frontend can use push messages to trigger an
 *     immediate refetch instead of waiting for the next polling interval.
 *   - Clients that miss a message (reconnect, closed tab) fall back to the
 *     next polling cycle; no message replay is provided.
 *
 * The server attaches to the existing Node http.Server so it shares the same
 * port as the REST API, keeping infrastructure simple.
 *
 * To avoid adding a hard dependency on the `ws` package at this stage, the
 * implementation is written against a minimal `WebSocketLike` interface that
 * can be satisfied by `ws`, by a test double, or swapped for a native
 * implementation later.
 */

import { ContractEvent } from '../indexer/processor';

// ── Minimal interface contract ────────────────────────────────────────────────

/** Subset of the ws `WebSocket` interface that this module actually uses. */
export interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

/** OPEN state constant (matches ws.WebSocket.OPEN === 1). */
export const WS_OPEN = 1;

/** Subset of the ws `WebSocketServer` interface that this module uses. */
export interface WebSocketServerLike {
  clients: Set<WebSocketLike>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  close(cb?: () => void): void;
}

// ── Message protocol (#219) ───────────────────────────────────────────────────

export interface WsMessage {
  /** Mirror of ContractEvent.topic[0] — lets clients filter client-side. */
  type: string;
  /** Full topic array from the contract event. */
  topic: string[];
  /** The ledger this event was indexed from. */
  ledgerSequence: number;
  /** The decoded event value. */
  payload: unknown;
}

/** Serialises a ContractEvent into the wire protocol. */
export function buildWsMessage(event: ContractEvent): WsMessage {
  return {
    type: event.topic[0] ?? 'unknown',
    topic: event.topic,
    ledgerSequence: event.ledgerSequence,
    payload: event.value,
  };
}

// ── Server ────────────────────────────────────────────────────────────────────

/**
 * Wraps a WebSocketServerLike instance and exposes a single `broadcast` method
 * that the processor calls after persisting each event (#220).
 *
 * Usage:
 *   const wss = createWebSocketServer(new WebSocketServer({ server: httpServer }));
 *   // Pass wss.broadcast as the EventBroadcaster to processEvent / persistContractEvents.
 */
export class WsServer {
  private readonly wss: WebSocketServerLike;

  constructor(wss: WebSocketServerLike) {
    this.wss = wss;

    wss.on('connection', (ws: unknown) => {
      const socket = ws as WebSocketLike;
      socket.on('error', () => {
        // Swallow individual client errors so one bad socket doesn't crash the process.
      });
    });
  }

  /**
   * Serialises the event and sends it to every currently-open client.
   * Satisfies the `EventBroadcaster` signature from processor.ts.
   */
  broadcast = (event: ContractEvent): void => {
    const message = JSON.stringify(buildWsMessage(event));
    for (const client of this.wss.clients) {
      if (client.readyState === WS_OPEN) {
        client.send(message);
      }
    }
  };

  /** Closes the underlying WebSocket server (used in tests / graceful shutdown). */
  close(cb?: () => void): void {
    this.wss.close(cb);
  }
}
