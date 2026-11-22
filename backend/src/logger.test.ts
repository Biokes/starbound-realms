import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { log, getCorrelationId, correlationMiddleware } from './logger';

const originalConsoleLog = console.log;
const logSpy = vi.fn();

beforeEach(() => {
  logSpy.mockReset();
  console.log = logSpy;
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe('logger', () => {
  it('logs structured JSON with level and message', () => {
    log('info', 'test message');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('test message');
    expect(parsed.timestamp).toBeDefined();
  });

  it('includes extra fields in the log output', () => {
    log('warn', 'slow query', { duration: 500, table: 'fleets' });
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('warn');
    expect(parsed.message).toBe('slow query');
    expect(parsed.duration).toBe(500);
    expect(parsed.table).toBe('fleets');
  });

  it('logs at error level', () => {
    log('error', 'something broke', { code: 'E_X' });
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('error');
    expect(parsed.code).toBe('E_X');
  });

  it('returns undefined correlation ID outside a request context', () => {
    expect(getCorrelationId()).toBeUndefined();
  });
});
