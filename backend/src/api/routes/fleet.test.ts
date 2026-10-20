import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../db/queries', () => ({
  fetchPlayerByAddress: vi.fn(),
  fetchFleetSnapshot: vi.fn(),
}));

import { fetchPlayerByAddress, fetchFleetSnapshot } from '../../db/queries';
import { createFleetRouter } from './fleet';

const db = {} as any;

/** A syntactically valid 56-char Stellar address starting with G */
const VALID_ADDRESS = 'G' + 'A'.repeat(55);

function buildApp() {
  const app = express();
  app.use('/fleet', createFleetRouter(db));
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  });
  return app;
}

beforeEach(() => {
  vi.mocked(fetchPlayerByAddress).mockReset();
  vi.mocked(fetchFleetSnapshot).mockReset();
});

// ── GET /fleet/:address ───────────────────────────────────────────────────────

describe('GET /fleet/:address', () => {
  it('returns 400 for a malformed address without querying the database', async () => {
    const res = await request(buildApp()).get('/fleet/not-a-valid-address');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid Stellar address' });
    expect(fetchPlayerByAddress).not.toHaveBeenCalled();
    expect(fetchFleetSnapshot).not.toHaveBeenCalled();
  });

  it('returns 404 for a well-formed but unknown address', async () => {
    vi.mocked(fetchPlayerByAddress).mockResolvedValue(null);

    const res = await request(buildApp()).get(`/fleet/${VALID_ADDRESS}`);

    expect(res.status).toBe(404);
    expect(fetchFleetSnapshot).not.toHaveBeenCalled();
  });

  it('returns zeroed counts when the player has no recorded fleet', async () => {
    vi.mocked(fetchPlayerByAddress).mockResolvedValue({ address: VALID_ADDRESS });
    vi.mocked(fetchFleetSnapshot).mockResolvedValue(null);

    const res = await request(buildApp()).get(`/fleet/${VALID_ADDRESS}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      address: VALID_ADDRESS,
      fleet: {
        scouts: 0,
        fighters: 0,
        cruisers: 0,
        dreadnoughts: 0,
        location: null,
        lastMoved: null,
      },
    });
  });
});
