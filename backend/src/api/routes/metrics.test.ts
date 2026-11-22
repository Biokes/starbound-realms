import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import {
  createMetricsHandler,
  recordHttpRequest,
  recordHttpDuration,
  updateIndexerLag,
  resetMetrics,
} from './metrics';

describe('/metrics', () => {
  let app: express.Express;
  let mockPool: Pool;

  beforeEach(() => {
    resetMetrics();
    mockPool = {} as Pool;
    app = express();
    app.get('/metrics', createMetricsHandler(mockPool));
  });

  afterEach(() => {
    resetMetrics();
  });

  it('returns Prometheus-format text', async () => {
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.text).toContain('# HELP http_requests_total');
    expect(res.text).toContain('# TYPE http_requests_total counter');
  });

  it('exposes http_requests_total counter', async () => {
    recordHttpRequest();
    recordHttpRequest();
    recordHttpRequest();

    const res = await request(app).get('/metrics');

    expect(res.text).toContain('http_requests_total 3');
  });

  it('exposes http_request_duration_ms percentiles', async () => {
    recordHttpDuration(10);
    recordHttpDuration(20);
    recordHttpDuration(30);
    recordHttpDuration(40);
    recordHttpDuration(50);
    recordHttpDuration(100);
    recordHttpDuration(150);
    recordHttpDuration(200);
    recordHttpDuration(300);
    recordHttpDuration(500);

    const res = await request(app).get('/metrics');

    expect(res.text).toContain('# HELP http_request_duration_ms_p50');
    expect(res.text).toContain('# TYPE http_request_duration_ms_p50 gauge');
    expect(res.text).toMatch(/http_request_duration_ms_p50 \d+/);

    expect(res.text).toContain('# HELP http_request_duration_ms_p90');
    expect(res.text).toContain('# TYPE http_request_duration_ms_p90 gauge');
    expect(res.text).toMatch(/http_request_duration_ms_p90 \d+/);

    expect(res.text).toContain('# HELP http_request_duration_ms_p99');
    expect(res.text).toContain('# TYPE http_request_duration_ms_p99 gauge');
    expect(res.text).toMatch(/http_request_duration_ms_p99 \d+/);
  });

  it('returns 0 for percentiles when no durations recorded', async () => {
    const res = await request(app).get('/metrics');

    expect(res.text).toContain('http_request_duration_ms_p50 0');
    expect(res.text).toContain('http_request_duration_ms_p90 0');
    expect(res.text).toContain('http_request_duration_ms_p99 0');
  });

  it('exposes indexer_ledger_lag when available', async () => {
    updateIndexerLag(42);

    const res = await request(app).get('/metrics');

    expect(res.text).toContain('# HELP indexer_ledger_lag');
    expect(res.text).toContain('# TYPE indexer_ledger_lag gauge');
    expect(res.text).toContain('indexer_ledger_lag 42');
  });

  it('indicates when indexer_ledger_lag is not available', async () => {
    const res = await request(app).get('/metrics');

    expect(res.text).toContain('# indexer_ledger_lag not available');
    expect(res.text).not.toContain('indexer_ledger_lag -');
  });

  it('calculates percentiles correctly', async () => {
    // Add 100 values from 1 to 100
    for (let i = 1; i <= 100; i++) {
      recordHttpDuration(i);
    }

    const res = await request(app).get('/metrics');

    // p50 should be around 50
    expect(res.text).toMatch(/http_request_duration_ms_p50 5\d/);
    // p90 should be around 90
    expect(res.text).toMatch(/http_request_duration_ms_p90 9\d/);
    // p99 should be around 99
    expect(res.text).toMatch(/http_request_duration_ms_p99 9[89]/);
  });

  it('limits stored durations to prevent memory growth', () => {
    // Record 1500 durations
    for (let i = 0; i < 1500; i++) {
      recordHttpDuration(i);
    }

    // The implementation should keep only the last 1000
    // We can't directly verify this without exposing internals,
    // but we can ensure it doesn't crash and still works
    return request(app)
      .get('/metrics')
      .then((res) => {
        expect(res.status).toBe(200);
        expect(res.text).toContain('http_request_duration_ms_p50');
      });
  });
});
