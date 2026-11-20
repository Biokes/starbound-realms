import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import {
  fetchOpenTradeOffers,
  fetchTradeOfferById,
  insertTradeOffer,
  acceptTradeOffer,
} from '../../db/queries';
import { parseStellarAddress, parseIntegerId } from '../validators';

export function createTradeRouter(db: Pool): Router {
  const router = Router();

  router.get('/', listOffers(db));
  router.post('/', createOffer(db));
  router.post('/:offerId/accept', acceptOffer(db));

  return router;
}

/** GET /trades — paginated list of open offers */
function listOffers(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, offset } = parsePagination(req.query);
      const trades = await fetchOpenTradeOffers(db, limit, offset);
      res.json({ trades, limit, offset });
    } catch (err) {
      next(err);
    }
  };
}

/** POST /trades — create a new offer */
function createOffer(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { maker, offer_resource, offer_amount, want_resource, want_amount } = req.body ?? {};
      const makerAddr = parseStellarAddress(String(maker ?? ''));
      const offerRes = parseResourceType(offer_resource);
      const wantRes = parseResourceType(want_resource);
      const offerAmt = parseBigIntAmount(offer_amount, 'offer_amount');
      const wantAmt = parseBigIntAmount(want_amount, 'want_amount');

      const trade = await insertTradeOffer(db, makerAddr, offerRes, offerAmt, wantRes, wantAmt);
      res.status(201).json({ trade });
    } catch (err) {
      next(err);
    }
  };
}

/** POST /trades/:offerId/accept — accept an open offer */
function acceptOffer(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const offerId = parseIntegerId(req.params.offerId, 'offer ID');
      const { taker } = req.body ?? {};
      const takerAddr = parseStellarAddress(String(taker ?? ''));

      const existing = await fetchTradeOfferById(db, offerId);
      if (!existing) {
        res.status(404).json({ error: 'Offer not found' });
        return;
      }
      if (existing.status !== 'open') {
        res.status(409).json({ error: 'Offer is no longer open' });
        return;
      }
      if (existing.maker === takerAddr) {
        res.status(400).json({ error: 'Cannot accept your own offer' });
        return;
      }

      const trade = await acceptTradeOffer(db, offerId, takerAddr);
      res.json({ trade });
    } catch (err) {
      next(err);
    }
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePagination(query: Record<string, any>): { limit: number; offset: number } {
  const limit = Math.min(parseInt(query.limit ?? '20', 10) || 20, 100);
  const offset = parseInt(query.offset ?? '0', 10) || 0;
  return { limit, offset };
}

const VALID_RESOURCES = new Set(['Iron', 'Energy', 'Plasma']);

function parseResourceType(value: unknown): string {
  if (!VALID_RESOURCES.has(String(value ?? ''))) {
    const err = new Error('Invalid resource type — must be Iron, Energy, or Plasma');
    (err as any).statusCode = 400;
    throw err;
  }
  return String(value);
}

function parseBigIntAmount(value: unknown, field: string): bigint {
  try {
    const n = BigInt(String(value ?? ''));
    if (n <= 0n) throw new Error();
    return n;
  } catch {
    const err = new Error(`Invalid ${field} — must be a positive integer`);
    (err as any).statusCode = 400;
    throw err;
  }
}
