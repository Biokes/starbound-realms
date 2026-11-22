import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { log, requestLogger, getCorrelationId } from './logger';

describe('logger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  describe('log', () => {
    it('writes structured JSON to stdout', () => {
      log('info', 'test message', { foo: 'bar' });

      expect(stdoutSpy).toHaveBeenCalledOnce();
      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed).toMatchObject({
        level: 'info',
        message: 'test message',
        foo: 'bar',
      });
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('includes correlation ID when available', () => {
      const app = express();
      app.use(requestLogger());
      app.get('/test', (_req, res) => {
        log('info', 'inside request');
        res.json({ ok: true });
      });

      return request(app)
        .get('/test')
        .then(() => {
          const logs = stdoutSpy.mock.calls.map((call) => JSON.parse(call[0] as string));
          const insideRequestLog = logs.find((log) => log.message === 'inside request');

          expect(insideRequestLog).toBeDefined();
          expect(insideRequestLog.correlationId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          );
        });
    });

    it('omits correlation ID outside request context', () => {
      log('info', 'no context');

      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.correlationId).toBeUndefined();
    });
  });

  describe('requestLogger', () => {
    it('generates a correlation ID and includes it in all logs', async () => {
      const app = express();
      app.use(requestLogger());
      app.get('/test', (_req, res) => {
        log('info', 'during request');
        res.json({ ok: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-correlation-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );

      const logs = stdoutSpy.mock.calls.map((call) => JSON.parse(call[0] as string));
      const correlationIds = logs.map((log) => log.correlationId).filter(Boolean);

      expect(correlationIds.length).toBeGreaterThan(0);
      expect(new Set(correlationIds).size).toBe(1);
      expect(correlationIds[0]).toBe(response.headers['x-correlation-id']);
    });

    it('reuses correlation ID from x-correlation-id header', async () => {
      const app = express();
      app.use(requestLogger());
      app.get('/test', (_req, res) => {
        log('info', 'with custom id');
        res.json({ ok: true });
      });

      const customId = 'custom-correlation-id-12345';
      const response = await request(app).get('/test').set('x-correlation-id', customId);

      expect(response.headers['x-correlation-id']).toBe(customId);

      const logs = stdoutSpy.mock.calls.map((call) => JSON.parse(call[0] as string));
      const correlationIds = logs.map((log) => log.correlationId).filter(Boolean);

      expect(correlationIds.every((id) => id === customId)).toBe(true);
    });

    it('logs request start and completion separately', async () => {
      const app = express();
      app.use(requestLogger());
      app.get('/test', (_req, res) => res.json({ ok: true }));

      await request(app).get('/test');

      const logs = stdoutSpy.mock.calls.map((call) => JSON.parse(call[0] as string));

      const startLog = logs.find((log) => log.message === 'http request started');
      const completionLog = logs.find((log) => log.message === 'http request completed');

      expect(startLog).toBeDefined();
      expect(startLog).toMatchObject({
        level: 'info',
        method: 'GET',
        path: '/test',
      });

      expect(completionLog).toBeDefined();
      expect(completionLog).toMatchObject({
        level: 'info',
        method: 'GET',
        path: '/test',
        status: 200,
      });
      expect(completionLog.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCorrelationId', () => {
    it('returns undefined outside request context', () => {
      expect(getCorrelationId()).toBeUndefined();
    });

    it('returns the correlation ID inside request context', async () => {
      const app = express();
      app.use(requestLogger());
      app.get('/test', (_req, res) => {
        const id = getCorrelationId();
        res.json({ correlationId: id });
      });

      const response = await request(app).get('/test');

      expect(response.body.correlationId).toBeDefined();
      expect(response.body.correlationId).toBe(response.headers['x-correlation-id']);
    });
  });
});
