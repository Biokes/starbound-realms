import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { fetchOpenTradeOffers } from '../../db/queries';

export function createTradeRouter(db: Pool): Router {
  const router = Router();
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ offers: await fetchOpenTradeOffers(db) });
    } catch (err) {
      next(err);
    }
  });
  return router;
}
