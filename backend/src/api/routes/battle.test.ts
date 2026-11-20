import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../db/queries', () => ({
  fetchRecentBattles: vi.fn(),
  fetchBattleById: vi.fn(),
  fetchBattleReplay: vi.fn(),
}));

import { fetchRecentBattles, fetchBattleById, fetchBattleReplay } from '../../db/queries';
import { createBattleRouter } from './battle';

const db = {} as any;

function buildApp() {
  const app = express();
  app.use('/battles', createBattleRouter(db));
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  });
  return app;
}

beforeEach(() => {
  vi.mocked(fetchRecentBattles).mockReset();
  vi.mocked(fetchBattleById).mockReset();
  vi.mocked(fetchBattleReplay).mockReset();
});

// ── GET /battles ──────────────────────────────────────────────────────────────

describe('GET /battles', () => {
  it('returns an empty list with default pagination when there are no battles', async () => {
    vi.mocked(fetchRecentBattles).mockResolvedValue([]);

    const res = await request(buildApp()).get('/battles');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ battles: [], limit: 20, offset: 0 });
    expect(fetchRecentBattles).toHaveBeenCalledWith(db, 20, 0);
  });

  it('returns recent battles with the default pagination applied', async () => {
    const battles = [{ battle_id: 1, attacker: 'GA', defender: 'GB', winner: 'GA' }];
    vi.mocked(fetchRecentBattles).mockResolvedValue(battles);

    const res = await request(buildApp()).get('/battles');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ battles, limit: 20, offset: 0 });
  });

  it('passes custom limit and offset query params to the query', async () => {
    vi.mocked(fetchRecentBattles).mockResolvedValue([]);

    const res = await request(buildApp()).get('/battles?limit=5&offset=10');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ battles: [], limit: 5, offset: 10 });
    expect(fetchRecentBattles).toHaveBeenCalledWith(db, 5, 10);
  });

  it('caps limit at 100', async () => {
    vi.mocked(fetchRecentBattles).mockResolvedValue([]);

    const res = await request(buildApp()).get('/battles?limit=500');

    expect(res.body.limit).toBe(100);
    expect(fetchRecentBattles).toHaveBeenCalledWith(db, 100, 0);
  });

  it('falls back to defaults for non-numeric pagination params', async () => {
    vi.mocked(fetchRecentBattles).mockResolvedValue([]);

    const res = await request(buildApp()).get('/battles?limit=abc&offset=xyz');

    expect(res.body).toEqual({ battles: [], limit: 20, offset: 0 });
    expect(fetchRecentBattles).toHaveBeenCalledWith(db, 20, 0);
  });

  it('forwards database errors to the error handler', async () => {
    vi.mocked(fetchRecentBattles).mockRejectedValue(
      Object.assign(new Error('db down'), { statusCode: 503 })
    );

    const res = await request(buildApp()).get('/battles');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'db down' });
  });
});

// ── GET /battles/:battleId ────────────────────────────────────────────────────

describe('GET /battles/:battleId', () => {
  it('returns 400 for a non-numeric battle ID without querying the database', async () => {
    const res = await request(buildApp()).get('/battles/abc');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid battle ID' });
    expect(fetchBattleById).not.toHaveBeenCalled();
  });

  it('returns 400 for a negative battle ID without querying the database', async () => {
    const res = await request(buildApp()).get('/battles/-1');

    expect(res.status).toBe(400);
    expect(fetchBattleById).not.toHaveBeenCalled();
  });

  it('returns 400 for a battle ID with trailing characters instead of silently truncating it', async () => {
    const res = await request(buildApp()).get('/battles/7x');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid battle ID' });
    expect(fetchBattleById).not.toHaveBeenCalled();
  });

  it('returns 400 for a battle ID beyond the safe integer range without querying the database', async () => {
    const res = await request(buildApp()).get('/battles/99999999999999999999');

    expect(res.status).toBe(400);
    expect(fetchBattleById).not.toHaveBeenCalled();
  });

  it('returns 404 when the battle does not exist', async () => {
    vi.mocked(fetchBattleById).mockResolvedValue(null);

    const res = await request(buildApp()).get('/battles/42');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Battle not found' });
    expect(fetchBattleById).toHaveBeenCalledWith(db, 42);
  });

  it('returns the battle for a known ID', async () => {
    const battle = { battle_id: 7, attacker: 'GA', defender: 'GB', winner: 'GB' };
    vi.mocked(fetchBattleById).mockResolvedValue(battle);

    const res = await request(buildApp()).get('/battles/7');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ battle });
    expect(fetchBattleById).toHaveBeenCalledWith(db, 7);
  });

  it('forwards database errors to the error handler', async () => {
    vi.mocked(fetchBattleById).mockRejectedValue(new Error('boom'));

    const res = await request(buildApp()).get('/battles/1');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'boom' });
  });
});

// ── GET /battles/:battleId/replay ─────────────────────────────────────────────

describe('GET /battles/:battleId/replay', () => {
  const battle = { battle_id: 5, attacker: 'GA', defender: 'GB', winner: 'GA', rounds: 2 };
  const rounds = [
    {
      round_number: 1,
      attacker_scouts: 3, attacker_fighters: 1, attacker_cruisers: 0, attacker_dreadnoughts: 0,
      defender_scouts: 2, defender_fighters: 0, defender_cruisers: 0, defender_dreadnoughts: 0,
    },
    {
      round_number: 2,
      attacker_scouts: 3, attacker_fighters: 1, attacker_cruisers: 0, attacker_dreadnoughts: 0,
      defender_scouts: 0, defender_fighters: 0, defender_cruisers: 0, defender_dreadnoughts: 0,
    },
  ];

  it('returns 400 for a non-numeric battle ID without querying the database', async () => {
    const res = await request(buildApp()).get('/battles/abc/replay');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid battle ID' });
    expect(fetchBattleReplay).not.toHaveBeenCalled();
  });

  it('returns 400 for a negative battle ID', async () => {
    const res = await request(buildApp()).get('/battles/-1/replay');

    expect(res.status).toBe(400);
    expect(fetchBattleReplay).not.toHaveBeenCalled();
  });

  it('returns 404 when the battle does not exist', async () => {
    vi.mocked(fetchBattleReplay).mockResolvedValue(null);

    const res = await request(buildApp()).get('/battles/99/replay');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Battle not found' });
    expect(fetchBattleReplay).toHaveBeenCalledWith(db, 99);
  });

  it('returns battle metadata and an ordered rounds array for a known battle', async () => {
    vi.mocked(fetchBattleReplay).mockResolvedValue({ battle, rounds });

    const res = await request(buildApp()).get('/battles/5/replay');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ battle, rounds });
    expect(fetchBattleReplay).toHaveBeenCalledWith(db, 5);
  });

  it('returns an empty rounds array when no per-round data has been indexed yet', async () => {
    vi.mocked(fetchBattleReplay).mockResolvedValue({ battle, rounds: [] });

    const res = await request(buildApp()).get('/battles/5/replay');

    expect(res.status).toBe(200);
    expect(res.body.rounds).toEqual([]);
    expect(res.body.battle).toEqual(battle);
  });

  it('forwards database errors to the error handler', async () => {
    vi.mocked(fetchBattleReplay).mockRejectedValue(new Error('db error'));

    const res = await request(buildApp()).get('/battles/5/replay');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'db error' });
  });
});
