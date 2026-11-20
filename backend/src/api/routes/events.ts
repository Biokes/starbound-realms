import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { fetchRecentGalaxyEvents } from '../../db/queries';

export function createEventsRouter(db: Pool): Router {
  const router = Router();
  router.get('/', listEvents(db));
  return router;
}

/** GET /events — paginated list of recent galaxy events, newest ledger first */
function listEvents(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) ?? '20', 10) || 20, 100);
      const offset = parseInt((req.query.offset as string) ?? '0', 10) || 0;
      const events = await fetchRecentGalaxyEvents(db, limit, offset);
      res.json({ events, limit, offset });
    } catch (err) {
      next(err);
    }
  };
}
