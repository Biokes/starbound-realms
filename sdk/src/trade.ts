import { Contract, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';
import { StarboundClient, TransactionSigner } from './client.js';

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
  expiresAt: number;
}

interface RawTradeOffer {
  offer_id: bigint | number | string;
  maker: string;
  offer_resource: string[] | string;
  offer_amount: bigint | number | string;
  want_resource: string[] | string;
  want_amount: bigint | number | string;
  status: string[] | string;
  created_at: bigint | number | string;
  expires_at?: bigint | number | string;
}

/** SDK client for escrowed offers in the resources contract and backend trade API. */
export class TradeClient {
  constructor(
    private readonly client: StarboundClient,
    private readonly backendUrl?: string
  ) {}

  /** Lists non-expired open offers using offset pagination. */
  async listOffers(limit = 20, offset = 0): Promise<TradeOffer[]> {
    if (this.backendUrl) {
      const url = `${this.backendUrl}/trades?limit=${limit}&offset=${offset}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch trades: ${res.status}`);
      const data = (await res.json()) as { trades?: RawTradeOffer[]; offers?: RawTradeOffer[] };
      const trades = data.trades || data.offers || [];
      return trades.map(toTradeOffer);
    }
    const raw = (await this.client.simulateReadCall(
      this.client.contractIds.resources,
      'get_open_trade_offers',
      [nativeToScVal(offset, { type: 'u32' }), nativeToScVal(limit, { type: 'u32' })]
    )) as RawTradeOffer[];
    return raw.map(toTradeOffer);
  }

  /** Creates an escrowed offer and returns its on-chain ID or offer object. */
  async createOffer(
    maker: string,
    offerResource: ResourceType,
    offerAmount: bigint,
    wantResource: ResourceType,
    wantAmount: bigint,
    expiresAt?: number,
    sign?: TransactionSigner
  ): Promise<TradeOffer | number> {
    if (this.backendUrl || !sign) {
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
    const result = await this.submit(maker, 'create_trade_offer', [
      nativeToScVal(maker, { type: 'address' }),
      resourceTypeToScVal(offerResource),
      nativeToScVal(offerAmount, { type: 'i128' }),
      resourceTypeToScVal(wantResource),
      nativeToScVal(wantAmount, { type: 'i128' }),
      nativeToScVal(BigInt(expiresAt ?? 0), { type: 'u64' }),
    ], sign);
    return Number(scValToNative(result.returnValue!));
  }

  /** Accepts an offer, atomically transferring both resources on-chain or via backend. */
  async acceptOffer(offerId: number, taker: string, sign?: TransactionSigner): Promise<void> {
    if (this.backendUrl || !sign) {
      const res = await fetch(`${this.backendUrl}/trades/${offerId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taker }),
      });
      if (!res.ok) throw new Error(`Failed to accept offer: ${res.status}`);
      return;
    }
    await this.submit(taker, 'accept_trade_offer', [
      nativeToScVal(taker, { type: 'address' }),
      nativeToScVal(BigInt(offerId), { type: 'u64' }),
    ], sign);
  }

  /** Cancels an open offer and returns its escrow to the maker. */
  async cancelOffer(offerId: number, maker: string, sign: TransactionSigner): Promise<void> {
    await this.submit(maker, 'cancel_trade_offer', [
      nativeToScVal(maker, { type: 'address' }),
      nativeToScVal(BigInt(offerId), { type: 'u64' }),
    ], sign);
  }

  private submit(sourceAddress: string, method: string, args: xdr.ScVal[], sign: TransactionSigner) {
    return this.client.submitTransaction({
      sourceAddress,
      operation: new Contract(this.client.contractIds.resources).call(method, ...args),
      sign,
    });
  }
}

function resourceTypeToScVal(resource: ResourceType): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(resource)]);
}

function toTradeOffer(raw: RawTradeOffer): TradeOffer {
  return {
    offerId: Number(raw.offer_id),
    maker: raw.maker,
    offerResource: parseResource(raw.offer_resource),
    offerAmount: BigInt(raw.offer_amount),
    wantResource: parseResource(raw.want_resource),
    wantAmount: BigInt(raw.want_amount),
    status: parseStatus(raw.status),
    createdAt: typeof raw.created_at === 'string' ? Date.parse(raw.created_at) : Number(raw.created_at),
    expiresAt: raw.expires_at ? Number(raw.expires_at) : 0,
  };
}

function parseResource(value: string[] | string): ResourceType {
  const resource = Array.isArray(value) ? value[0] : value;
  if (resource !== 'Iron' && resource !== 'Energy' && resource !== 'Plasma') {
    throw new Error(`Unknown trade resource returned: ${resource}`);
  }
  return resource;
}

function parseStatus(value: string[] | string): TradeOffer['status'] {
  const status = Array.isArray(value) ? value[0] : value;
  const lower = status?.toLowerCase();
  if (lower === 'open') return 'open';
  if (lower === 'accepted') return 'accepted';
  if (lower === 'cancelled') return 'cancelled';
  throw new Error(`Unknown trade status returned: ${status}`);
}
