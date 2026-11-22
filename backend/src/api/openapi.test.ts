import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Router } from 'express';
import type { Pool } from 'pg';
import { createGalaxyRouter } from './routes/galaxy';
import { createPlayerRouter } from './routes/player';
import { createBattleRouter } from './routes/battle';
import { createFleetRouter } from './routes/fleet';
import { createLeaderboardRouter } from './routes/leaderboard';
import { createTradeRouter } from './routes/trade';
import { createEventsRouter } from './routes/events';

/**
 * Keeps docs/openapi.yaml in step with the routes the API serves (#314).
 *
 * Routers are built with a stub pool. Route factories only attach handlers,
 * so no query runs. Mount prefixes mirror `app.use(...)` in src/index.ts.
 */

const db = {} as Pool;

const ROUTER_MOUNTS: Array<[string, Router]> = [
  ['/galaxy', createGalaxyRouter(db)],
  ['/player', createPlayerRouter(db)],
  ['/battles', createBattleRouter(db)],
  ['/fleet', createFleetRouter(db)],
  ['/leaderboard', createLeaderboardRouter(db)],
  ['/trades', createTradeRouter(db)],
  ['/events', createEventsRouter(db)],
];

/** Routes registered directly on `app` in src/index.ts. */
const APP_LEVEL_OPERATIONS = [
  'GET /health',
  'GET /health/liveness',
  'GET /health/readiness',
  'GET /metrics',
];

type RouteLayer = { route?: { path: string; methods: Record<string, boolean> } };

const OPENAPI_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function toOpenApiPath(expressPath: string): string {
  return expressPath.replace(/:([A-Za-z]+)/g, '{$1}');
}

function routerOperations(prefix: string, router: Router): string[] {
  const stack = (router as unknown as { stack: RouteLayer[] }).stack;
  return stack.flatMap((layer) => {
    if (!layer.route) return [];
    const path = toOpenApiPath(prefix + (layer.route.path === '/' ? '' : layer.route.path));
    return Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${path}`);
  });
}

/** Operations the running API serves, as "METHOD /path" strings. */
function actualOperations(): string[] {
  const mounted = ROUTER_MOUNTS.flatMap(([prefix, router]) => routerOperations(prefix, router));
  return [...APP_LEVEL_OPERATIONS, ...mounted].sort();
}

/**
 * Operations documented in docs/openapi.yaml, as "METHOD /path" strings.
 * Reads the `paths:` block line by line: path keys sit at two spaces and
 * method keys at four. Any top-level key ends the block.
 */
function documentedOperations(yaml: string): string[] {
  const operations: string[] = [];
  let currentPath: string | null = null;

  for (const line of yaml.split('\n')) {
    if (/^\S/.test(line)) {
      currentPath = null;
      continue;
    }
    const pathMatch = /^ {2}(\/\S*):\s*$/.exec(line);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }
    const methodMatch = /^ {4}([a-z]+):/.exec(line);
    if (currentPath && methodMatch && OPENAPI_METHODS.includes(methodMatch[1])) {
      operations.push(`${methodMatch[1].toUpperCase()} ${currentPath}`);
    }
  }

  return operations.sort();
}

const SPEC_PATH = join(__dirname, '..', '..', '..', 'docs', 'openapi.yaml');

describe('docs/openapi.yaml', () => {
  const documented = documentedOperations(readFileSync(SPEC_PATH, 'utf8'));
  const actual = actualOperations();

  it('documents every route the API serves', () => {
    const undocumented = actual.filter((op) => !documented.includes(op));
    expect(undocumented).toEqual([]);
  });

  it('does not document a route the API no longer serves', () => {
    const stale = documented.filter((op) => !actual.includes(op));
    expect(stale).toEqual([]);
  });
});
