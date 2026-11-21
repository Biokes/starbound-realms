import React from 'react';
import { useTranslation } from 'react-i18next';
import { GalaxySystem, getOwnedSystems } from '../hooks/useGalaxyData';

export interface OwnedSystemsListProps {
  systems: GalaxySystem[];
  walletAddress: string | null;
  selectedSystemId?: number | null;
  onSelectSystem?: (systemId: number) => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--bg-card, #0f1729)',
    border: '1px solid var(--border, #1e2a44)',
    borderRadius: '8px',
    padding: '0.85rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    minWidth: '200px',
    maxWidth: '240px',
    maxHeight: '600px',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid var(--border, #1e2a44)',
  },
  title: {
    fontSize: '0.85rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted, #94a3b8)',
    margin: 0,
  },
  countBadge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    background: 'rgba(99, 179, 237, 0.1)',
    color: 'var(--accent, #63b3ed)',
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
    border: '1px solid var(--border, #1e2a44)',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    overflowY: 'auto',
  },
  itemButton: {
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    border: '1px solid var(--border, #1e2a44)',
    borderRadius: '6px',
    padding: '0.5rem 0.65rem',
    color: 'var(--text, #e2e8f0)',
    cursor: 'pointer',
    transition: 'all 0.15s ease-in-out',
    fontFamily: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  selectedItem: {
    borderColor: 'var(--accent, #63b3ed)',
    background: 'rgba(99, 179, 237, 0.1)',
    boxShadow: '0 0 10px rgba(99, 179, 237, 0.2)',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  systemName: {
    fontSize: '0.85rem',
    fontWeight: 700,
  },
  resourceTag: {
    fontSize: '0.72rem',
    color: 'var(--accent, #63b3ed)',
    fontWeight: 600,
  },
  itemCoords: {
    fontSize: '0.75rem',
    color: 'var(--text-muted, #94a3b8)',
  },
  emptyText: {
    fontSize: '0.8rem',
    color: 'var(--text-muted, #94a3b8)',
    margin: 0,
    padding: '0.5rem 0',
    fontStyle: 'italic',
  },
};

export function OwnedSystemsList({
  systems,
  walletAddress,
  selectedSystemId,
  onSelectSystem,
}: OwnedSystemsListProps) {
  const { t } = useTranslation();
  const ownedSystems = getOwnedSystems(systems, walletAddress);

  return (
    <aside
      style={styles.container}
      data-testid="owned-systems-sidebar"
      aria-label={t('sidebar.title')}
    >
      <div style={styles.header}>
        <h3 style={styles.title}>{t('sidebar.title')}</h3>
        {walletAddress && (
          <span style={styles.countBadge} data-testid="owned-systems-count">
            {ownedSystems.length}
          </span>
        )}
      </div>

      {!walletAddress ? (
        <p style={styles.emptyText} data-testid="owned-systems-empty">
          {t('sidebar.notConnected')}
        </p>
      ) : ownedSystems.length === 0 ? (
        <p style={styles.emptyText} data-testid="owned-systems-empty">
          {t('sidebar.empty')}
        </p>
      ) : (
        <ul style={styles.list} role="list" aria-label={t('sidebar.title')}>
          {ownedSystems.map((system) => {
            const isSelected = system.systemId === selectedSystemId;
            return (
              <li key={system.systemId}>
                <button
                  type="button"
                  data-testid={`owned-system-item-${system.systemId}`}
                  style={{
                    ...styles.itemButton,
                    ...(isSelected ? styles.selectedItem : {}),
                  }}
                  aria-current={isSelected ? 'true' : undefined}
                  aria-label={t('sidebar.jumpToSystem', { systemId: system.systemId })}
                  onClick={() => onSelectSystem?.(system.systemId)}
                >
                  <div style={styles.itemHeader}>
                    <span style={styles.systemName}>System {system.systemId}</span>
                    <span style={styles.resourceTag}>{system.resourceType}</span>
                  </div>
                  <div style={styles.itemCoords}>
                    ({system.coordX}, {system.coordY}) · Yield: {system.resourceYield}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
