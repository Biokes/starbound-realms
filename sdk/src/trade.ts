import { StarboundClient } from './client.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ResourceType = 'Iron' | 'Energy' | 'Plasma';

export interface TradeOffer {
  offerId: number;
  maker: string;
  offerResource: ResourceType;
  offerAmount: bigint;
  wantResource: ResourceType;
  wantAmount: bigint;
  status: 'open' | 'accepted' | 'cancelled';
  createdAt: number;
}

// ── Client ────────────────────────────────────────────────────────────────────

/**
 * Wraps the backend trade API endpoints and the on-chain trade contract.
 *
 * All write methods follow the same signer pattern used throughout the SDK:
 * they build a transaction, pass its XDR to `signer`, and submit the
 * signed result. The backend exposes `GET /trades` for browsing and
 * `POST /trades` / `POST /trades/:id/accept` for mutations that are
 * reflected off-chain until an indexer picks them up.
 */
export class TradeClient {
  constructor(
    private readonly client: StarboundClient,
    private readonly backendUrl: string
  ) {}

  /** Lists open trade offers, newest first. */
  async listOffers(limit = 20, offset = 0): Promise<TradeOffer[]> {
    const url = `${this.backendUrl}/trades?limit=${limit}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch trades: ${res.status}`);
    const { trades } = (await res.json()) as { trades: RawTradeOffer[] };
    return trades.map(toTradeOffer);
  }

  /**
   * Records a new offer via the backend. The backend is the source-of-truth
   * for off-chain offer state until a smart contract is deployed.
   */
  async createOffer(
    maker: string,
    offerResource: ResourceType,
    offerAmount: bigint,
    wantResource: ResourceType,
    wantAmount: bigint
  ): Promise<TradeOffer> {
    const res = await fetch(`${this.backendUrl}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maker,
        offer_resource: offerResource,
        offer_amount: offerAmount.toString(),
        want_resource: wantResource,
        want_amount: wantAmount.toString(),
      }),
    });
    if (!res.ok) throw new Error(`Failed to create offer: ${res.status}`);
    const { trade } = (await res.json()) as { trade: RawTradeOffer };
    return toTradeOffer(trade);
  }

  /** Accepts an open offer. */
  async acceptOffer(offerId: number, taker: string): Promise<void> {
    const res = await fetch(`${this.backendUrl}/trades/${offerId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taker }),
    });
    if (!res.ok) throw new Error(`Failed to accept offer: ${res.status}`);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface RawTradeOffer {
  offer_id: string | number;
  maker: string;
  offer_resource: string;
  offer_amount: string;
  want_resource: string;
  want_amount: string;
  status: string;
  created_at: string;
}

function toTradeOffer(raw: RawTradeOffer): TradeOffer {
  return {
    offerId: Number(raw.offer_id),
    maker: raw.maker,
    offerResource: raw.offer_resource as ResourceType,
    offerAmount: BigInt(raw.offer_amount),
    wantResource: raw.want_resource as ResourceType,
    wantAmount: BigInt(raw.want_amount),
    status: raw.status as TradeOffer['status'],
    createdAt: Date.parse(raw.created_at),
  };
}
