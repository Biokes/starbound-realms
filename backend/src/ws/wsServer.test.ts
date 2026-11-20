import { describe, it, expect, vi } from 'vitest';
import { WsServer, WS_OPEN, buildWsMessage, WebSocketLike, WebSocketServerLike } from './wsServer';
import { ContractEvent } from '../indexer/processor';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClient(readyState: number): WebSocketLike {
  return {
    readyState,
    send: vi.fn(),
    on: vi.fn(),
  };
}

function makeWss(clients: WebSocketLike[] = []): WebSocketServerLike {
  return {
    clients: new Set(clients),
    on: vi.fn(),
    close: vi.fn(),
  };
}

// ── buildWsMessage ────────────────────────────────────────────────────────────

describe('buildWsMessage', () => {
  it('maps a ContractEvent to the wire protocol shape', () => {
    const event: ContractEvent = {
      contractId: 'C1',
      topic: ['claimed', 'GPLAYER'],
      value: 7,
      ledgerSequence: 100,
    };

    const msg = buildWsMessage(event);

    expect(msg).toEqual({
      type: 'claimed',
      topic: ['claimed', 'GPLAYER'],
      ledgerSequence: 100,
      payload: 7,
    });
  });

  it('uses "unknown" as the type when topic is empty', () => {
    const event: ContractEvent = {
      contractId: 'C1',
      topic: [],
      value: null,
      ledgerSequence: 1,
    };

    expect(buildWsMessage(event).type).toBe('unknown');
  });
});

// ── WsServer.broadcast ────────────────────────────────────────────────────────

describe('WsServer.broadcast', () => {
  it('sends a JSON message to every open client', () => {
    const open = makeClient(WS_OPEN);
    const wss = makeWss([open]);
    const server = new WsServer(wss);

    const event: ContractEvent = {
      contractId: 'C1',
      topic: ['claimed', 'GPLAYER'],
      value: 3,
      ledgerSequence: 50,
    };
    server.broadcast(event);

    expect(open.send).toHaveBeenCalledOnce();
    const sent = JSON.parse(vi.mocked(open.send).mock.calls[0][0] as string);
    expect(sent).toMatchObject({ type: 'claimed', ledgerSequence: 50 });
  });

  it('skips clients that are not in the OPEN state', () => {
    const closed = makeClient(3); // 3 = CLOSED
    const wss = makeWss([closed]);
    const server = new WsServer(wss);

    server.broadcast({
      contractId: 'C1',
      topic: ['claimed', 'GPLAYER'],
      value: 1,
      ledgerSequence: 1,
    });

    expect(closed.send).not.toHaveBeenCalled();
  });

  it('sends to open clients and skips non-open ones in the same set', () => {
    const open = makeClient(WS_OPEN);
    const closing = makeClient(2); // 2 = CLOSING
    const wss = makeWss([open, closing]);
    const server = new WsServer(wss);

    server.broadcast({
      contractId: 'C1',
      topic: ['transfer', '1'],
      value: ['GOLD', 'GNEW'],
      ledgerSequence: 200,
    });

    expect(open.send).toHaveBeenCalledOnce();
    expect(closing.send).not.toHaveBeenCalled();
  });

  it('sends nothing when there are no connected clients', () => {
    const wss = makeWss([]);
    const server = new WsServer(wss);

    // Should not throw
    expect(() =>
      server.broadcast({ contractId: 'C1', topic: ['claimed', 'G'], value: 1, ledgerSequence: 1 })
    ).not.toThrow();
  });
});

// ── WsServer.close ────────────────────────────────────────────────────────────

describe('WsServer.close', () => {
  it('delegates to the underlying WebSocketServer', () => {
    const wss = makeWss();
    const server = new WsServer(wss);
    const cb = vi.fn();

    server.close(cb);

    expect(wss.close).toHaveBeenCalledWith(cb);
  });
});
