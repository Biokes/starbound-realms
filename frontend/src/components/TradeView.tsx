import React, { useCallback, useEffect, useState } from 'react';
import { TradeClient, TradeOffer, TradeResourceType } from '@starbound-realms/sdk';
import { getStarboundClient } from '../lib/starboundClient';
import { truncateAddress } from '../lib/format';
import { LoadingIndicator } from './LoadingIndicator';

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  section: { marginTop: '2rem' },
  title: { fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)' },
  offerList: { listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  offerItem: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  offerText: { fontSize: '0.9rem', color: 'var(--text)' },
  offerMeta: { fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' },
  acceptBtn: {
    background: 'var(--accent)',
    color: '#080b14',
    border: 'none',
    borderRadius: '6px',
    padding: '0.45rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
  },
  disabledBtn: { opacity: 0.5, cursor: 'not-allowed' },
  form: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '1.25rem',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
  },
  formRow: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  label: { fontSize: '0.8rem', color: 'var(--text-muted)' },
  input: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '0.5rem 0.75rem',
    color: 'var(--text)',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  select: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '0.5rem 0.75rem',
    color: 'var(--text)',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box' as const,
    cursor: 'pointer',
  },
  submitRow: { gridColumn: '1 / -1' },
  submitBtn: {
    background: 'var(--accent)',
    color: '#080b14',
    border: 'none',
    borderRadius: '6px',
    padding: '0.6rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
  },
  error: { color: 'var(--red)', fontSize: '0.85rem', gridColumn: '1 / -1' },
  textMuted: { color: 'var(--text-muted)', fontSize: '0.9rem' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TradeViewProps {
  walletAddress: string;
  backendUrl: string;
}

const RESOURCE_OPTIONS: TradeResourceType[] = ['Iron', 'Energy', 'Plasma'];

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Full trading UI: lists open offers from `GET /trades`, lets a player create
 * a new offer, and lets a player accept any open offer they did not make.
 * Closes issues #204.
 */
export function TradeView({ walletAddress, backendUrl }: TradeViewProps) {
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Create-offer form state
  const [offerResource, setOfferResource] = useState<TradeResourceType>('Iron');
  const [offerAmount, setOfferAmount] = useState('');
  const [wantResource, setWantResource] = useState<TradeResourceType>('Energy');
  const [wantAmount, setWantAmount] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const makeClient = useCallback(
    () => new TradeClient(getStarboundClient(), backendUrl),
    [backendUrl]
  );

  const loadOffers = useCallback(async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const loaded = await makeClient().listOffers();
      setOffers(loaded);
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [makeClient]);

  useEffect(() => { loadOffers(); }, [loadOffers]);

  const handleAccept = useCallback(
    async (offerId: number) => {
      setAcceptingId(offerId);
      setAcceptError(null);
      try {
        await makeClient().acceptOffer(offerId, walletAddress);
        await loadOffers();
      } catch (err) {
        setAcceptError(err instanceof Error ? err.message : String(err));
      } finally {
        setAcceptingId(null);
      }
    },
    [makeClient, walletAddress, loadOffers]
  );

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setCreateError(null);
      const parsedOffer = BigInt(offerAmount || '0');
      const parsedWant = BigInt(wantAmount || '0');
      if (parsedOffer <= 0n || parsedWant <= 0n) {
        setCreateError('Amounts must be greater than zero.');
        return;
      }
      setCreating(true);
      try {
        await makeClient().createOffer(walletAddress, offerResource, parsedOffer, wantResource, parsedWant);
        setOfferAmount('');
        setWantAmount('');
        await loadOffers();
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : String(err));
      } finally {
        setCreating(false);
      }
    },
    [makeClient, walletAddress, offerResource, offerAmount, wantResource, wantAmount, loadOffers]
  );

  return (
    <div style={styles.section}>
      {/* Open offers */}
      <h3 style={styles.title}>Open Trade Offers</h3>
      {isLoading && <LoadingIndicator label="Loading offers…" />}
      {listError && <p style={styles.textMuted}>{listError}</p>}
      {!isLoading && !listError && (
        <ul style={styles.offerList} aria-label="Open trade offers">
          {offers.length === 0 && (
            <li>
              <p style={styles.textMuted}>No open offers. Create one below.</p>
            </li>
          )}
          {offers.map((offer) => (
            <OfferRow
              key={offer.offerId}
              offer={offer}
              isMine={offer.maker === walletAddress}
              isAccepting={acceptingId === offer.offerId}
              onAccept={handleAccept}
            />
          ))}
        </ul>
      )}
      {acceptError && <p style={styles.error}>{acceptError}</p>}

      {/* Create offer form */}
      <h3 style={styles.title}>Create a New Offer</h3>
      <form style={styles.form} onSubmit={handleCreate} aria-label="Create trade offer">
        <div style={styles.formRow}>
          <label style={styles.label} htmlFor="offer-resource">You offer</label>
          <select
            id="offer-resource"
            style={styles.select}
            value={offerResource}
            onChange={(e) => setOfferResource(e.target.value as TradeResourceType)}
          >
            {RESOURCE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={styles.formRow}>
          <label style={styles.label} htmlFor="offer-amount">Amount</label>
          <input
            id="offer-amount"
            style={styles.input}
            type="number"
            min="1"
            value={offerAmount}
            onChange={(e) => setOfferAmount(e.target.value)}
            placeholder="e.g. 100"
            required
          />
        </div>
        <div style={styles.formRow}>
          <label style={styles.label} htmlFor="want-resource">You want</label>
          <select
            id="want-resource"
            style={styles.select}
            value={wantResource}
            onChange={(e) => setWantResource(e.target.value as TradeResourceType)}
          >
            {RESOURCE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={styles.formRow}>
          <label style={styles.label} htmlFor="want-amount">Amount</label>
          <input
            id="want-amount"
            style={styles.input}
            type="number"
            min="1"
            value={wantAmount}
            onChange={(e) => setWantAmount(e.target.value)}
            placeholder="e.g. 50"
            required
          />
        </div>
        {createError && <p style={styles.error}>{createError}</p>}
        <div style={styles.submitRow}>
          <button type="submit" style={styles.submitBtn} disabled={creating}>
            {creating ? 'Creating…' : 'Post Offer'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── OfferRow ──────────────────────────────────────────────────────────────────

interface OfferRowProps {
  offer: TradeOffer;
  isMine: boolean;
  isAccepting: boolean;
  onAccept: (id: number) => void;
}

function OfferRow({ offer, isMine, isAccepting, onAccept }: OfferRowProps) {
  const disabled = isMine || isAccepting;
  return (
    <li style={styles.offerItem}>
      <div>
        <div style={styles.offerText}>
          <strong>{offer.offerAmount.toString()} {offer.offerResource}</strong>
          {' → '}
          <strong>{offer.wantAmount.toString()} {offer.wantResource}</strong>
        </div>
        <div style={styles.offerMeta}>
          By {truncateAddress(offer.maker)} · #{offer.offerId}
        </div>
      </div>
      <button
        type="button"
        style={{ ...styles.acceptBtn, ...(disabled ? styles.disabledBtn : {}) }}
        disabled={disabled}
        onClick={() => onAccept(offer.offerId)}
        aria-label={isMine ? 'Your own offer' : `Accept offer #${offer.offerId}`}
      >
        {isAccepting ? 'Accepting…' : isMine ? 'Your offer' : 'Accept'}
      </button>
    </li>
  );
}
