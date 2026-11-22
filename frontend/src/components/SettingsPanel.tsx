import React from 'react';
import { usePreferences } from '../hooks/usePreferences';
import { NetworkBadge } from './NetworkBadge';
import type { NetworkLabel } from '../lib/starboundClient';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },

  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '999px',
    padding: '0.5rem 1rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  toggle: {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text)',
    fontSize: '0.9rem',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },

  toggleActive: {
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },

  panel: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '0.5rem',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '1rem',
    minWidth: '200px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
  },

  panelTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.75rem',
  },

  section: {
    marginBottom: '1rem',
  },

  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '0.5rem',
  },

  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem',
    cursor: 'pointer',
    padding: '0.5rem',
    borderRadius: '4px',
    transition: 'background 0.2s',
  },

  checkbox: {
    width: '1rem',
    height: '1rem',
    cursor: 'pointer',
    accentColor: 'var(--accent)',
  },

  label: {
    cursor: 'pointer',
    fontSize: '0.9rem',
    color: 'var(--text)',
  },
};

export interface SettingsPanelProps {
  network: NetworkLabel;
}

export function SettingsPanel({ network }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { preferences, setPreferences } = usePreferences();
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        style={styles.badge}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open settings panel"
        title="Settings"
      >
        ⚙️ Settings
      </button>

      {isOpen && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Preferences</div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Theme</div>
            <label style={styles.option}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={preferences.theme === 'light'}
                onChange={(e) => setPreferences({ theme: e.target.checked ? 'light' : 'dark' })}
                aria-label="Light mode"
              />
              <span style={styles.label}>{preferences.theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
            </label>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Audio</div>
            <label style={styles.option}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={preferences.soundEffects}
                onChange={(e) => setPreferences({ soundEffects: e.target.checked })}
                aria-label="Sound effects"
              />
              <span style={styles.label}>Sound Effects</span>
            </label>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Notifications</div>
            <label style={styles.option}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={preferences.notifications}
                onChange={(e) => setPreferences({ notifications: e.target.checked })}
                aria-label="Notifications"
              />
              <span style={styles.label}>Notifications</span>
            </label>
          </div>

          <div style={{ ...styles.section, borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div style={styles.sectionTitle}>Network</div>
            <div style={{ marginTop: '0.5rem' }}>
              <NetworkBadge network={network} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
