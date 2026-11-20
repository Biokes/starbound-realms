import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import {
  fetchPlayerByAddress,
  fetchBattlesByPlayer,
  fetchAllianceByPlayer,
  fetchRecentlyActivePlayers,
  fetchNotificationsByPlayer,
} from '../../db/queries';
import { parseStellarAddress, validateParam } from '../validators';

export function createPlayerRouter(db: Pool): Router {
  const router = Router();

  router.param('address', validateParam(parseStellarAddress));
  // Registered before `/:address` so "recent" is never parsed as an address.
  router.get('/recent', fetchRecentPlayers(db));
  router.get('/:address', fetchPlayerProfile(db));
  router.get('/:address/battles', fetchPlayerBattleHistory(db));
  router.get('/:address/alliance', fetchPlayerAlliance(db));
  router.get('/:address/notifications', fetchPlayerNotifications(db));

  return router;
}

/** Returns the most recently active players, newest first (#311) */
function fetchRecentPlayers(db: Pool) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const players = await fetchRecentlyActivePlayers(db);
      res.json({ players });
    } catch (err) {
      next(err);
    }
  };
}

/** Returns a player's profile — systems owned, battle stats */
function fetchPlayerProfile(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = parseStellarAddress(req.params.address);
      const player = await fetchPlayerByAddress(db, address);

      if (!player) {
        res.status(404).json({ error: 'Player not found' });
        return;
      }

      res.json({ player });
    } catch (err) {
      next(err);
    }
  };
}

/** Returns a player's full battle history */
function fetchPlayerBattleHistory(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = parseStellarAddress(req.params.address);
      const battles = await fetchBattlesByPlayer(db, address);
      res.json({ battles });
    } catch (err) {
      next(err);
    }
  };
}

/** Returns the alliance a player currently belongs to (#82) */
function fetchPlayerAlliance(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = parseStellarAddress(req.params.address);
      const alliance = await fetchAllianceByPlayer(db, address);

      if (!alliance) {
        res.status(404).json({ error: 'Player is not in an alliance' });
        return;
      }

      res.json({ alliance });
    } catch (err) {
      next(err);
    }
  };
}

/** Returns per-player notifications, newest first (#217) */
function fetchPlayerNotifications(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = parseStellarAddress(req.params.address);
      const notifications = await fetchNotificationsByPlayer(db, address);
      res.json({ notifications });
    } catch (err) {
      next(err);
    }
  };
}
