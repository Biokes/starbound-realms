import React, { useState } from 'react';
import { LoadingIndicator } from './LoadingIndicator';

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  inputRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  input: {
    flex: 1,
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--bg-input, rgba(0,0,0,0.2))',
    color: 'var(--text)',
    fontSize: '0.9rem',
  },
  button: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: 'none',
    background: 'var(--accent, #3b82f6)',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  dangerButton: {
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid #ef4444',
    background: 'transparent',
    color: '#ef4444',
    fontSize: '0.8rem',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  memberList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    maxHeight: '150px',
    overflowY: 'auto',
  },
  memberItem: {
    fontSize: '0.85rem',
    fontFamily: 'monospace',
    color: 'var(--text)',
    padding: '0.2rem 0',
  },
  statusText: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
};

export interface AllianceMembership {
  id: string;
  name: string;
  leader: string;
  members: string[];
}

export interface AlliancePanelProps {
  playerAddress: string;
  currentAlliance: AllianceMembership | null;
  isLoading?: boolean;
  onCreateAlliance: (name: string) => Promise<void>;
  onJoinAlliance: (allianceId: string) => Promise<void>;
  onLeaveAlliance?: () => Promise<void>;
}

export function AlliancePanel({
  playerAddress,
  currentAlliance,
  isLoading = false,
  onCreateAlliance,
  onJoinAlliance,
  onLeaveAlliance,
}: AlliancePanelProps) {
  const [createName, setCreateName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return <LoadingIndicator label="Loading alliance data…" />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onCreateAlliance(createName.trim());
      setCreateName('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create alliance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinId.trim()) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onJoinAlliance(joinId.trim());
      setJoinId('');
    } catch (err: any) {
      setError(err?.message || 'Failed to join alliance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (!onLeaveAlliance) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onLeaveAlliance();
    } catch (err: any) {
      setError(err?.message || 'Failed to leave alliance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.card} data-testid="alliance-panel">
      <h3 style={styles.title}>Alliances</h3>

      {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>{error}</p>}

      {currentAlliance ? (
        <div style={styles.section} data-testid="current-alliance-view">
          <div>
            <span style={styles.label}>Alliance Name: </span>
            <strong style={{ color: 'var(--text)' }}>{currentAlliance.name}</strong>
          </div>
          <div>
            <span style={styles.label}>Alliance ID: </span>
            <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
              {currentAlliance.id}
            </span>
          </div>
          <div>
            <span style={styles.label}>Leader: </span>
            <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>
              {currentAlliance.leader === playerAddress ? 'You (Leader)' : currentAlliance.leader}
            </span>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <span style={styles.label}>Members ({currentAlliance.members.length}):</span>
            <div style={styles.memberList}>
              {currentAlliance.members.map((member) => (
                <div key={member} style={styles.memberItem}>
                  {member} {member === playerAddress && '(You)'}
                </div>
              ))}
            </div>
          </div>

          {onLeaveAlliance && (
            <button
              onClick={handleLeave}
              disabled={isSubmitting}
              style={styles.dangerButton}
            >
              {isSubmitting ? 'Leaving…' : 'Leave Alliance'}
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Create Alliance Form */}
          <form onSubmit={handleCreate} style={styles.section} aria-label="Create Alliance">
            <label htmlFor="create-alliance-name" style={styles.label}>
              Create New Alliance
            </label>
            <div style={styles.inputRow}>
              <input
                id="create-alliance-name"
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Enter alliance name"
                disabled={isSubmitting}
                style={styles.input}
              />
              <button
                type="submit"
                disabled={isSubmitting || !createName.trim()}
                style={styles.button}
              >
                {isSubmitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>

          {/* Join Alliance Form */}
          <form onSubmit={handleJoin} style={styles.section} aria-label="Join Alliance">
            <label htmlFor="join-alliance-id" style={styles.label}>
              Join by ID
            </label>
            <div style={styles.inputRow}>
              <input
                id="join-alliance-id"
                type="text"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="Enter alliance ID"
                disabled={isSubmitting}
                style={styles.input}
              />
              <button
                type="submit"
                disabled={isSubmitting || !joinId.trim()}
                style={styles.button}
              >
                {isSubmitting ? 'Joining…' : 'Join'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
