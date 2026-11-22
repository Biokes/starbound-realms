import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { addressLimiter } from './rateLimit';

describe('addressLimiter (#236)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.get('/player/:address', addressLimiter, (req, res) => {
      res.json({ address: req.params.address });
    });
  });

  it('allows requests below the address limit', async () => {
    const addr = `GTEST${Date.now()}`;
    const res1 = await request(app).get(`/player/${addr}`);
    const res2 = await request(app).get(`/player/${addr}`);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it('enforces limit per address across different IPs', async () => {
    const addr = `GTEST${Date.now()}`;
    // Make many requests from different IPs but same address
    const requests = [];
    for (let i = 0; i < 55; i++) {
      requests.push(
        request(app).get(`/player/${addr}`).set('X-Forwarded-For', `1.2.3.${i}`)
      );
    }
    const results = await Promise.all(requests);

    // With default limit of 50, the 51st request should be rate limited
    const successCount = results.filter(r => r.status === 200).length;
    const rateLimitedCount = results.filter(r => r.status === 429).length;

    expect(successCount).toBe(50);
    expect(rateLimitedCount).toBe(5);
  });

  it('allows different addresses to make requests independently', async () => {
    const addr1 = `GTEST1${Date.now()}`;
    const addr2 = `GTEST2${Date.now()}`;
    
    // Max out one address
    const requests1 = [];
    for (let i = 0; i < 50; i++) {
      requests1.push(request(app).get(`/player/${addr1}`));
    }
    await Promise.all(requests1);

    // Different address should still work
    const res = await request(app).get(`/player/${addr2}`);

    expect(res.status).toBe(200);
    expect(res.body.address).toBe(addr2);
  });

  it('includes rate limit headers in response', async () => {
    const addr = `GTEST${Date.now()}`;
    const res = await request(app).get(`/player/${addr}`);

    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect(res.headers).toHaveProperty('ratelimit-remaining');
  });
});
