import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { fetchAllStarSystems, fetchStarSystemById } from '../../db/queries';
import { MAX_INTEGER_ID, parseIntegerId, validateParam } from '../validators';

export function createGalaxyRouter(db: Pool): Router {
  const router = Router();

  router.get('/', fetchGalaxyGrid(db));
  router.param('systemId', validateParam(parseSystemId));
  router.get('/:systemId', fetchSingleSystem(db));

  return router;
}

/** Returns the full galaxy grid */
function fetchGalaxyGrid(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parsePageParameter(req.query.limit, 100, 500);
      const offset = parsePageParameter(req.query.offset, 0, Number.MAX_SAFE_INTEGER);
      const systems = await fetchAllStarSystems(db, limit, offset);
      res.json({
        systems,
        pagination: {
          limit,
          offset,
          count: systems.length,
          hasMore: systems.length === limit,
          nextOffset: systems.length === limit ? offset + limit : null,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

/** Parses bounded pagination values and rejects malformed query parameters. */
function parsePageParameter(raw: unknown, fallback: number, max: number): number {
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw Object.assign(new Error('Invalid pagination parameter'), { statusCode: 400 });
  }
  return value;
}

/** Returns a single star system by ID */
function fetchSingleSystem(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const systemId = parseSystemId(req.params.systemId);
      const system = await fetchStarSystemById(db, systemId);

      if (!system) {
        res.status(404).json({ error: 'System not found' });
        return;
      }

      res.json({ system });
    } catch (err) {
      next(err);
    }
  };
}

/** Parses and validates a system ID from a route param */
function parseSystemId(raw: string): number {
  return parseIntegerId(raw, 'system ID', MAX_INTEGER_ID);
}
