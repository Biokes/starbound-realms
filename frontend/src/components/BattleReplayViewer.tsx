import React, { useState } from 'react';
import { BattleReplay, ReplayFleetSnapshot } from '../hooks/useBattleReplay';
import { truncateAddress } from '../lib/format';
import { LoadingIndicator } from './LoadingIndicator';

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8,11,20,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  panel: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.5rem',
    maxWidth: '560px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text)',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '1.2rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  roundLabel: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    textAlign: 'center' as const,
  },
  fleets: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  side: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '0.75rem',
    fontSize: '0.85rem',
  },
  sideLabel: {
    fontWeight: 700,
    marginBottom: '0.5rem',
    color: 'var(--accent)',
    fontSize: '0.8rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  unit: {
    display: 'flex',
    justifyContent: 'space-between',
    color: 'var(--text)',
    marginBottom: '0.2rem',
  },
  controls: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btn: {
    background: 'var(--accent)',
    color: '#080b14',
    border: 'none',
    borderRadius: '6px',
    padding: '0.4rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
  noRounds: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    textAlign: 'center' as const,
  },
  meta: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    textAlign: 'center' as const,
  },
  winner: {
    color: 'var(--green)',
    fontWeight: 700,
  },
};

function FleetUnits({ snapshot }: { snapshot: ReplayFleetSnapshot }) {
  return (
    <div>
      <div style={styles.unit}><span>Scouts</span><span>{snapshot.scouts}</span></div>
      <div style={styles.unit}><span>Fighters</span><span>{snapshot.fighters}</span></div>
      <div style={styles.unit}><span>Cruisers</span><span>{snapshot.cruisers}</span></div>
      <div style={styles.unit}><span>Dreadnoughts</span><span>{snapshot.dreadnoughts}</span></div>
    </div>
  );
}

export interface BattleReplayViewerProps {
  replay: BattleReplay | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

/**
 * Step-through battle replay viewer. Shows each indexed round's fleet snapshots
 * for attacker and defender, with Prev / Next controls.
 * When no per-round data has been indexed yet (rounds array is empty) it shows
 * the final outcome only.
 */
export function BattleReplayViewer({ replay, isLoading, error, onClose }: BattleReplayViewerProps) {
  const [roundIndex, setRoundIndex] = useState(0);

  if (isLoading) {
    return (
      <div style={styles.overlay} role="dialog" aria-label="Battle replay">
        <div style={styles.panel}>
          <LoadingIndicator label="Loading replay…" />
        </div>
      </div>
    );
  }

  if (error || !replay) {
    return (
      <div style={styles.overlay} role="dialog" aria-label="Battle replay">
        <div style={styles.panel}>
          <div style={styles.header}>
            <span style={styles.title}>Battle Replay</span>
            <button style={styles.closeBtn} onClick={onClose} aria-label="Close replay">✕</button>
          </div>
          <p style={styles.noRounds}>{error ?? 'Replay unavailable.'}</p>
        </div>
      </div>
    );
  }

  const { battle, rounds } = replay;
  const currentRound = rounds[roundIndex] ?? null;
  const totalRounds = rounds.length;

  const canPrev = roundIndex > 0;
  const canNext = roundIndex < totalRounds - 1;

  return (
    <div style={styles.overlay} role="dialog" aria-label="Battle replay">
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.title}>
            Battle #{battle.battleId} — System {battle.systemId}
          </span>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close replay">✕</button>
        </div>

        <p style={styles.meta}>
          {truncateAddress(battle.attacker)} vs {truncateAddress(battle.defender)} ·{' '}
          <span style={styles.winner}>{truncateAddress(battle.winner)} won</span> in{' '}
          {battle.rounds} round(s)
        </p>

        {totalRounds === 0 ? (
          <p style={styles.noRounds}>
            Per-round data not yet indexed. Final result: {battle.rounds} round(s).
          </p>
        ) : (
          <>
            <p style={styles.roundLabel} aria-live="polite">
              Round {currentRound!.roundNumber} of {totalRounds}
            </p>

            <div style={styles.fleets}>
              <div style={styles.side}>
                <div style={styles.sideLabel}>Attacker</div>
                <FleetUnits snapshot={currentRound!.attacker} />
              </div>
              <div style={styles.side}>
                <div style={styles.sideLabel}>Defender</div>
                <FleetUnits snapshot={currentRound!.defender} />
              </div>
            </div>

            <div style={styles.controls}>
              <button
                style={{ ...styles.btn, ...(canPrev ? {} : styles.btnDisabled) }}
                onClick={() => setRoundIndex((i) => i - 1)}
                disabled={!canPrev}
                aria-label="Previous round"
              >
                ← Prev
              </button>
              <button
                style={{ ...styles.btn, ...(canNext ? {} : styles.btnDisabled) }}
                onClick={() => setRoundIndex((i) => i + 1)}
                disabled={!canNext}
                aria-label="Next round"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
