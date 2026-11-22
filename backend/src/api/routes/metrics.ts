import type { RequestHandler } from 'express';
import type { Pool } from 'pg';

interface Metrics {
  httpRequestsTotal: number;
  httpRequestDurationMs: number[];
  indexerLedgerLag: number | null;
}

const metrics: Metrics = {
  httpRequestsTotal: 0,
  httpRequestDurationMs: [],
  indexerLedgerLag: null,
};

/** Increments the HTTP request counter. */
export function recordHttpRequest(): void {
  metrics.httpRequestsTotal++;
}

/** Records an HTTP request duration in milliseconds. */
export function recordHttpDuration(durationMs: number): void {
  metrics.httpRequestDurationMs.push(durationMs);
  // Keep only the last 1000 durations to avoid unbounded memory growth
  if (metrics.httpRequestDurationMs.length > 1000) {
    metrics.httpRequestDurationMs.shift();
  }
}

/** Updates the indexer ledger lag metric. */
export function updateIndexerLag(lag: number): void {
  metrics.indexerLedgerLag = lag;
}

/** Resets all metrics (primarily for testing). */
export function resetMetrics(): void {
  metrics.httpRequestsTotal = 0;
  metrics.httpRequestDurationMs = [];
  metrics.indexerLedgerLag = null;
}

/** Calculates the 50th, 90th, and 99th percentile from a sorted array of durations. */
function calculatePercentiles(durations: number[]): { p50: number; p90: number; p99: number } {
  if (durations.length === 0) {
    return { p50: 0, p90: 0, p99: 0 };
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const p50Index = Math.floor(sorted.length * 0.5);
  const p90Index = Math.floor(sorted.length * 0.9);
  const p99Index = Math.floor(sorted.length * 0.99);

  return {
    p50: sorted[p50Index],
    p90: sorted[p90Index],
    p99: sorted[p99Index],
  };
}

/** GET /metrics — returns Prometheus-format metrics. */
export function createMetricsHandler(_db: Pool): RequestHandler {
  return (_req, res) => {
    const percentiles = calculatePercentiles(metrics.httpRequestDurationMs);
    
    const output = [
      '# HELP http_requests_total Total number of HTTP requests',
      '# TYPE http_requests_total counter',
      `http_requests_total ${metrics.httpRequestsTotal}`,
      '',
      '# HELP http_request_duration_ms_p50 50th percentile request duration in milliseconds',
      '# TYPE http_request_duration_ms_p50 gauge',
      `http_request_duration_ms_p50 ${percentiles.p50}`,
      '',
      '# HELP http_request_duration_ms_p90 90th percentile request duration in milliseconds',
      '# TYPE http_request_duration_ms_p90 gauge',
      `http_request_duration_ms_p90 ${percentiles.p90}`,
      '',
      '# HELP http_request_duration_ms_p99 99th percentile request duration in milliseconds',
      '# TYPE http_request_duration_ms_p99 gauge',
      `http_request_duration_ms_p99 ${percentiles.p99}`,
      '',
      '# HELP indexer_ledger_lag Ledger lag for the indexer (null when not available)',
      '# TYPE indexer_ledger_lag gauge',
      metrics.indexerLedgerLag !== null ? `indexer_ledger_lag ${metrics.indexerLedgerLag}` : '# indexer_ledger_lag not available',
    ].join('\n');

    res.setHeader('content-type', 'text/plain; version=0.0.4');
    res.send(output + '\n');
  };
}
