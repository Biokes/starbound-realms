import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { fetchPlayerByAddress, fetchFleetSnapshot } from '../../db/queries';
import { parseStellarAddress, validateParam } from '../validators';

export function createFleetRouter(db: Pool): Router {
  const router = Router();

  router.param('address', validateParam(parseStellarAddress));
  router.get('/:address', fetchPlayerFleet(db));

  return router;
}

/** Returns a player's current fleet snapshot */
function fetchPlayerFleet(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = parseStellarAddress(req.params.address);

      const player = await fetchPlayerByAddress(db, address);

      if (!player) {
        res.status(404).json({ error: 'Player not found' });
        return;
      }

      const snapshot = await fetchFleetSnapshot(db, address);

      res.json({
        address,
        fleet: {
          scouts:       snapshot?.scouts       ?? 0,
          fighters:     snapshot?.fighters     ?? 0,
          cruisers:     snapshot?.cruisers     ?? 0,
          dreadnoughts: snapshot?.dreadnoughts ?? 0,
          location:     snapshot?.location     ?? null,
          lastMoved:    snapshot?.last_moved   ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
