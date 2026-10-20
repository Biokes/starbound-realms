import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { createGalaxyRouter } from './api/routes/galaxy';
import { createPlayerRouter } from './api/routes/player';
import { createBattleRouter } from './api/routes/battle';
import { createFleetRouter } from './api/routes/fleet';
import { createLeaderboardRouter } from './api/routes/leaderboard';
import { standardLimiter, strictLimiter } from './api/middleware/rateLimit';
import { errorHandler } from './api/middleware/errorHandler';
import { startIndexer } from './indexer/indexer';
import { log, requestLogger } from './logger';

// ── Environment Validation ────────────────────────────────────────────────────

function validateEnv(): void {
  const required = ['DATABASE_URL'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    log('error', 'Missing required environment variables', { variables: missing });
    process.exit(1);
  }

  // Validate DATABASE_URL format
  const dbUrl = process.env.DATABASE_URL!;
  if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
    log('error', 'DATABASE_URL must start with postgres:// or postgresql://');
    process.exit(1);
  }
}

validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database ──────────────────────────────────────────────────────────────────

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Middleware ────────────────────────────────────────────────────────────────

const corsOrigins = readCorsOrigins(process.env);

if (corsOrigins) {
  app.use(cors({ origin: corsOrigins }));
} else {
  // Without CORS_ORIGIN no Access-Control-Allow-Origin header is ever sent, so
  // browsers reject every cross-origin request (same-origin traffic is unaffected).
  log('warn', 'CORS disabled: CORS_ORIGIN not configured');
}

app.use(express.json());
app.use(requestLogger());
app.use(standardLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => void handleHealthCheck(req, res, db));
app.use('/galaxy', createGalaxyRouter(db));
app.use('/player', createPlayerRouter(db));
app.use('/battles', createBattleRouter(db));
app.use('/fleet', createFleetRouter(db));
app.use('/leaderboard', strictLimiter, createLeaderboardRouter(db));

// ── Error handler (must be last) ──────────────────────────────────────────────

app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  log('info', 'Starbound Realms API running', { port: PORT });
});

startIndexerIfConfigured();

export default app;

// ── Indexer ───────────────────────────────────────────────────────────────────

/**
 * Reads the CORS_ORIGIN env var — a comma-separated list of frontend origins
 * (e.g. `http://localhost:5173,https://play.example.com`) — into an allow-list.
 * Returns null when unset or empty, which disables CORS entirely.
 */
function readCorsOrigins(env: Record<string, string | undefined>): string[] | null {
  const raw = env.CORS_ORIGIN;
  if (!raw) {
    return null;
  }
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : null;
}

/** Reads the CONTRACT_* env vars, dropping any that aren't set. */
function readIndexerContractIds(): string[] {
  return [
    process.env.CONTRACT_GALAXY_MAP,
    process.env.CONTRACT_RESOURCES,
    process.env.CONTRACT_FLEET,
    process.env.CONTRACT_BATTLE,
  ].filter((id): id is string => Boolean(id));
}

/** Starts the event listener when an RPC URL and at least one contract are configured. */
function startIndexerIfConfigured() {
  const rpcUrl = process.env.SOROBAN_RPC_URL;
  const contractIds = readIndexerContractIds();

  if (!rpcUrl || contractIds.length === 0) {
    log('warn', 'Indexer disabled: SOROBAN_RPC_URL or CONTRACT_* not configured');
    return;
  }

  startIndexer({
    db,
    rpcUrl,
    contractIds,
    pollIntervalMs: Number(process.env.INDEXER_POLL_INTERVAL_MS ?? 5000),
    onError: (err) => log('error', 'Indexer poll cycle failed', { error: String(err) }),
  }).catch((err) => log('error', 'Failed to start indexer', { error: String(err) }));
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleHealthCheck(_req: express.Request, res: express.Response, pool: Pool) {
  const checks: Record<string, string> = { database: 'ok', rpc: 'ok' };
  try { await pool.query('SELECT 1'); } catch { checks.database = 'unreachable'; }
  const rpcUrl = process.env.SOROBAN_RPC_URL;
  if (!rpcUrl) checks.rpc = 'not_configured';
  else {
    try {
      const rpc = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestLedger', params: {} }),
        signal: AbortSignal.timeout(3000),
      });
      if (!rpc.ok) checks.rpc = 'unreachable';
    } catch { checks.rpc = 'unreachable'; }
  }
  const healthy = Object.values(checks).every((value) => value === 'ok');
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() });
}
