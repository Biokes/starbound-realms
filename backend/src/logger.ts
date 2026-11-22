import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type LogLevel = 'info' | 'warn' | 'error';

interface CorrelationContext {
  correlationId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

/** Returns the current request's correlation ID, if any. */
export function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}

/** Logs a structured JSON line, automatically including the correlation ID when present. */
export function log(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
  const correlationId = getCorrelationId();
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(correlationId ? { correlationId } : {}),
    ...fields,
  };
  process.stdout.write(`${JSON.stringify(logEntry)}\n`);
}

type MetricsRecorder = {
  recordHttpRequest: () => void;
  recordHttpDuration: (durationMs: number) => void;
};

/** Request logger middleware that generates a correlation ID and attaches it to all logs within the request lifecycle. */
export function requestLogger(metricsRecorder?: MetricsRecorder): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.header('x-correlation-id') || randomUUID();
    res.setHeader('x-correlation-id', correlationId);
    
    const started = Date.now();
    
    asyncLocalStorage.run({ correlationId }, () => {
      log('info', 'http request started', {
        method: req.method,
        path: req.originalUrl,
      });
      
      if (metricsRecorder) {
        metricsRecorder.recordHttpRequest();
      }
      
      res.on('finish', () => {
        const durationMs = Date.now() - started;
        
        log('info', 'http request completed', {
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs,
        });
        
        if (metricsRecorder) {
          metricsRecorder.recordHttpDuration(durationMs);
        }
      });
      
      next();
    });
  };
}
