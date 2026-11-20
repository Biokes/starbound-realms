/**
 * Full-stack integration test (#309): mock Soroban RPC -> real indexer ->
 * real processor -> real Postgres -> real API routes.
 *
 * Nothing in the chain under test is mocked. The only test doubles are at the
 * edges: a tiny HTTP server that speaks Soroban's JSON-RPC `getEvents`, and the
 * Postgres container from the repo's docker-compose.yml.
 *
 * Database selection, in order:
 *   1. INTEGRATION_DATABASE_URL — an existing Postgres to use (e.g. a CI service
 *      container). A throwaway database is created on it and dropped afterwards.
 *   2. Otherwise, if Docker is available, `docker compose up postgres` is run
 *      under a separate project name on INTEGRATION_POSTGRES_PORT (default
 *      55432) and torn down with its volume afterwards.
 *   3. Otherwise the suite is skipped with a message.
 *
 * Set SKIP_INTEGRATION_TESTS=1 to skip it explicitly.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { join } from 'path';
import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import { runner } from 'node-pg-migrate';
import { Address, Keypair, StrKey, nativeToScVal } from '@stellar/stellar-sdk';
import { startIndexer } from '../indexer/indexer';
import { EventListenerHandle } from '../indexer/eventListener';
import { createGalaxyRouter } from '../api/routes/galaxy';
import { createPlayerRouter } from '../api/routes/player';
import { createLeaderboardRouter } from '../api/routes/leaderboard';
import { errorHandler } from '../api/middleware/errorHandler';

// ── Environment detection ─────────────────────────────────────────────────────

const REPO_ROOT = join(__dirname, '..', '..', '..');
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');
const COMPOSE_FILE = join(REPO_ROOT, 'docker-compose.yml');
const COMPOSE_PROJECT = 'starbound-integration-test';
const COMPOSE_PORT = process.env.INTEGRATION_POSTGRES_PORT ?? '55432';

function dockerIsAvailable(): boolean {
  const result = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' });
  if (result.status !== 0) return false;
  return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

const explicitDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;
const skipReason = process.env.SKIP_INTEGRATION_TESTS
  ? 'SKIP_INTEGRATION_TESTS is set'
  : !explicitDatabaseUrl && !dockerIsAvailable()
    ? 'Docker is not available and INTEGRATION_DATABASE_URL is not set'
    : null;

if (skipReason) {
  console.warn(`[fullStack.integration] skipped: ${skipReason}`);
}

// ── Postgres lifecycle ────────────────────────────────────────────────────────

function compose(args: string[]): void {
  execFileSync('docker', ['compose', '-f', COMPOSE_FILE, '-p', COMPOSE_PROJECT, ...args], {
    env: { ...process.env, POSTGRES_PORT: COMPOSE_PORT },
    stdio: 'pipe',
  });
}

/** Starts (or reuses) a Postgres server and returns a URL with admin rights. */
function startPostgres(): string {
  if (explicitDatabaseUrl) return explicitDatabaseUrl;
  // --wait blocks until the compose healthcheck (pg_isready) passes.
  compose(['up', '-d', '--wait', 'postgres']);
  return `postgres://postgres:postgres@127.0.0.1:${COMPOSE_PORT}/starbound`;
}

function stopPostgres(): void {
  if (explicitDatabaseUrl) return;
  compose(['down', '-v']);
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

// ── Mock Soroban RPC ──────────────────────────────────────────────────────────

interface JsonRpcCall {
  id: number;
  method: string;
  params: { startLedger?: number; filters?: unknown[] };
}

type RawEvent = ReturnType<typeof claimedEvent>;

interface MockRpc {
  url: string;
  requests: JsonRpcCall[];
  close: () => Promise<void>;
}

/**
 * Minimal JSON-RPC server that answers `getEvents` the way Soroban RPC does:
 * events at or after `startLedger`, XDR-encoded as base64.
 */
async function startMockRpc(events: RawEvent[], latestLedger: number): Promise<MockRpc> {
  const requests: JsonRpcCall[] = [];
  const server: Server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const call = JSON.parse(body) as JsonRpcCall;
      requests.push(call);
      res.setHeader('Content-Type', 'application/json');

      if (call.method !== 'getEvents') {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: call.id, error: { code: -32601, message: 'not mocked' } }));
        return;
      }

      // The SDK omits startLedger when it is 0 (a fresh database's cursor);
      // real RPC then serves from the oldest retained ledger.
      const startLedger: number = call.params.startLedger ?? 1;
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: call.id,
          result: {
            events: events.filter((e) => e.ledger >= startLedger),
            latestLedger,
            oldestLedger: 1,
            latestLedgerCloseTime: '1763640000',
            oldestLedgerCloseTime: '1763600000',
            cursor: `${latestLedger}-0`,
          },
        })
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** Encodes a galaxy-map `claimed` event exactly as the contract publishes it. */
function claimedEvent(contractId: string, player: string, systemId: number, ledger: number) {
  return {
    type: 'contract',
    ledger,
    ledgerClosedAt: '2026-11-20T12:00:00Z',
    contractId,
    id: `${ledger}-0000000001-0000000001`,
    operationIndex: 0,
    transactionIndex: 0,
    txHash: '0'.repeat(64),
    inSuccessfulContractCall: true,
    // (symbol_short!("claimed"), player), system_id
    topic: [
      nativeToScVal('claimed', { type: 'symbol' }).toXDR('base64'),
      new Address(player).toScVal().toXDR('base64'),
    ],
    value: nativeToScVal(systemId, { type: 'u32' }).toXDR('base64'),
  };
}

// ── API under test ────────────────────────────────────────────────────────────

/** The same router composition as src/index.ts, minus listen/env side effects. */
function buildApi(db: Pool) {
  const app = express();
  app.use(express.json());
  app.use('/galaxy', createGalaxyRouter(db));
  app.use('/player', createPlayerRouter(db));
  app.use('/leaderboard', createLeaderboardRouter(db));
  app.use(errorHandler);
  return app;
}

async function waitFor<T>(probe: () => Promise<T | undefined>, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`condition not met within ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

// ── Test ──────────────────────────────────────────────────────────────────────

describe.skipIf(skipReason !== null)('full stack: mock RPC -> indexer -> processor -> Postgres -> API (#309)', () => {
  const GALAXY_CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 7));
  const PLAYER = Keypair.random().publicKey();
  const SYSTEM_ID = 7;
  const EVENT_LEDGER = 1_200;
  const LATEST_LEDGER = 1_234;
  const testDatabase = `starbound_it_${process.pid}_${Date.now()}`;

  let adminUrl: string;
  let adminPool: Pool;
  let db: Pool;
  let rpc: MockRpc;
  let indexer: EventListenerHandle | undefined;

  beforeAll(async () => {
    adminUrl = startPostgres();
    adminPool = new Pool({ connectionString: adminUrl });
    await adminPool.query(`CREATE DATABASE ${testDatabase}`);

    const databaseUrl = withDatabase(adminUrl, testDatabase);
    await runner({
      databaseUrl,
      dir: MIGRATIONS_DIR,
      direction: 'up',
      migrationsTable: 'pgmigrations',
      count: Infinity,
      log: () => {},
    });
    db = new Pool({ connectionString: databaseUrl });

    // Star systems are created at galaxy initialization, not by the indexer,
    // so the row the `claimed` event updates has to exist up front.
    await db.query(
      `INSERT INTO star_systems (system_id, coord_x, coord_y, resource_type, resource_yield, defense_rating)
       VALUES ($1, 3, 0, 'Iron', 10, 5)`,
      [SYSTEM_ID]
    );

    rpc = await startMockRpc([claimedEvent(GALAXY_CONTRACT, PLAYER, SYSTEM_ID, EVENT_LEDGER)], LATEST_LEDGER);
  }, 180_000);

  afterAll(async () => {
    indexer?.stop();
    await rpc?.close();
    await db?.end();
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS ${testDatabase} WITH (FORCE)`).catch(() => {});
      await adminPool.end();
    }
    stopPostgres();
  }, 60_000);

  it('a claimed event fed through the real indexer is served by the API', async () => {
    const api = buildApi(db);
    const indexerErrors: unknown[] = [];

    // Before indexing, the API knows nothing about the player.
    expect((await request(api).get(`/player/${PLAYER}`)).status).toBe(404);

    indexer = await startIndexer({
      db,
      rpcUrl: rpc.url,
      allowHttp: true,
      contractIds: [GALAXY_CONTRACT],
      // Comfortably longer than one mock round-trip so poll cycles never
      // overlap (startEventListener does not guard against that itself).
      pollIntervalMs: 250,
      onError: (err) => indexerErrors.push(err),
    });

    const player = await waitFor(async () => {
      const res = await request(api).get(`/player/${PLAYER}`);
      return res.status === 200 ? res.body.player : undefined;
    });
    expect(player).toMatchObject({ address: PLAYER, systems_owned: 1 });

    const system = await request(api).get(`/galaxy/${SYSTEM_ID}`);
    expect(system.status).toBe(200);
    expect(system.body).toMatchObject({
      system: expect.objectContaining({ system_id: SYSTEM_ID, owner: PLAYER, last_claimed: String(EVENT_LEDGER) }),
    });

    const leaderboard = await request(api).get('/leaderboard');
    expect(leaderboard.body.players.map((p: { address: string }) => p.address)).toContain(PLAYER);

    // The indexer asked the RPC for this contract's events, starting from the
    // fresh database's cursor, and persisted where to resume.
    const firstCall = rpc.requests.find((r) => r.method === 'getEvents');
    expect(firstCall?.params.filters).toEqual([{ type: 'contract', contractIds: [GALAXY_CONTRACT] }]);

    const cursor = await waitFor(async () => {
      const { rows } = await db.query('SELECT last_ledger FROM indexer_state WHERE id = 1');
      return Number(rows[0]?.last_ledger) === LATEST_LEDGER + 1 ? rows[0].last_ledger : undefined;
    });
    expect(Number(cursor)).toBe(LATEST_LEDGER + 1);

    // Later polls resume past the event, so it is not applied twice.
    await waitFor(async () => (rpc.requests.length >= 3 ? true : undefined));
    expect(rpc.requests[rpc.requests.length - 1].params.startLedger).toBe(LATEST_LEDGER + 1);
    const again = await request(api).get(`/player/${PLAYER}`);
    expect(again.body.player.systems_owned).toBe(1);

    expect(indexerErrors).toEqual([]);
  }, 30_000);
});
