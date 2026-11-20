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
  offer_id: bigint;
  maker: string;
  offer_resource: string[];
  offer_amount: bigint;
  want_resource: string[];
  want_amount: bigint;
  status: string[];
  created_at: bigint;
  expires_at: bigint;
}

/** SDK client for escrowed offers in the resources contract. */
export class TradeClient {
  constructor(private readonly client: StarboundClient) {}

  /** Lists non-expired open offers using offset pagination. */
  async listOffers(limit = 20, offset = 0): Promise<TradeOffer[]> {
    const raw = (await this.client.simulateReadCall(
      this.client.contractIds.resources,
      'get_open_trade_offers',
      [nativeToScVal(offset, { type: 'u32' }), nativeToScVal(limit, { type: 'u32' })]
    )) as RawTradeOffer[];
    return raw.map(toTradeOffer);
  }

  /** Creates an escrowed offer and returns its on-chain ID. */
  async createOffer(
    maker: string,
    offerResource: ResourceType,
    offerAmount: bigint,
    wantResource: ResourceType,
    wantAmount: bigint,
    expiresAt: number,
    sign: TransactionSigner
  ): Promise<number> {
    const result = await this.submit(maker, 'create_trade_offer', [
      nativeToScVal(maker, { type: 'address' }),
      resourceTypeToScVal(offerResource),
      nativeToScVal(offerAmount, { type: 'i128' }),
      resourceTypeToScVal(wantResource),
      nativeToScVal(wantAmount, { type: 'i128' }),
      nativeToScVal(BigInt(expiresAt), { type: 'u64' }),
    ], sign);
    return Number(scValToNative(result.returnValue!));
  }

  /** Accepts an offer, atomically transferring both resources on-chain. */
  async acceptOffer(offerId: number, taker: string, sign: TransactionSigner): Promise<void> {
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
    offerAmount: raw.offer_amount,
    wantResource: parseResource(raw.want_resource),
    wantAmount: raw.want_amount,
    status: parseStatus(raw.status),
    createdAt: Number(raw.created_at),
    expiresAt: Number(raw.expires_at),
  };
}

function parseResource(value: string[]): ResourceType {
  if (value.length !== 1) throw new Error('Invalid trade resource returned by contract');
  const resource = value[0];
  if (resource !== 'Iron' && resource !== 'Energy' && resource !== 'Plasma') {
    throw new Error(`Unknown trade resource returned by contract: ${resource}`);
  }
  return resource;
}

function parseStatus(value: string[]): TradeOffer['status'] {
  if (value.length !== 1) throw new Error('Invalid trade status returned by contract');
  const status = value[0];
  if (status === 'Open') return 'open';
  if (status === 'Accepted') return 'accepted';
  if (status === 'Cancelled') return 'cancelled';
  throw new Error(`Unknown trade status returned by contract: ${status}`);
}
