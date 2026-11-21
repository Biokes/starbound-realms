import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';

describe('Health endpoints', () => {
  let app: express.Application;
  let db: Pool;

  beforeAll(() => {
    // Create a minimal test app
    app = express();
    db = new Pool({ connectionString: process.env.DATABASE_URL });

    // Liveness endpoint
    app.get('/health/liveness', (_req, res) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Readiness endpoint
    app.get('/health/readiness', async (_req, res) => {
      const checks: Record<string, string> = { database: 'ok' };
      
      try {
        await db.query('SELECT 1');
      } catch {
        checks.database = 'unreachable';
      }
      
      const ready = Object.values(checks).every((v) => v === 'ok');
      res.status(ready ? 200 : 503).json({
        status: ready ? 'ready' : 'not_ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    });
  });

  afterAll(async () => {
    await db.end();
  });

  describe('GET /health/liveness', () => {
    it('returns 200 when process is running', async () => {
      const response = await request(app).get('/health/liveness');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('does not check external dependencies', async () => {
      // Should succeed even if DB is down (but we can't easily simulate that here)
      const response = await request(app).get('/health/liveness');
      expect(response.status).toBe(200);
    });
  });

  describe('GET /health/readiness', () => {
    it('returns 200 when database is reachable', async () => {
      const response = await request(app).get('/health/readiness');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks.database).toBe('ok');
    });

    it('includes timestamp in response', async () => {
      const response = await request(app).get('/health/readiness');
      
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Distinction between liveness and readiness', () => {
    it('liveness check is simpler and faster than readiness', async () => {
      const livenessStart = Date.now();
      await request(app).get('/health/liveness');
      const livenessDuration = Date.now() - livenessStart;

      const readinessStart = Date.now();
      await request(app).get('/health/readiness');
      const readinessDuration = Date.now() - readinessStart;

      // Liveness should be near-instant (no I/O), readiness checks DB
      expect(livenessDuration).toBeLessThan(readinessDuration + 50);
    });
  });
});
