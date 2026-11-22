import { useTranslation } from 'react-i18next';

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    background: 'var(--bg-card)',
    border: '2px solid var(--red)',
    borderRadius: '8px',
    padding: '2rem',
    maxWidth: '500px',
    width: '90%',
  },
  title: {
    color: 'var(--red)',
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  warningIcon: {
    fontSize: '1.75rem',
  },
  message: {
    color: 'var(--fg)',
    lineHeight: 1.6,
    marginBottom: '1.5rem',
  },
  actions: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'flex-end',
  },
  button: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  cancelButton: {
    background: 'var(--bg-subtle)',
    color: 'var(--fg)',
  },
  confirmButton: {
    background: 'var(--red)',
    color: '#fff',
  },
};

export interface MainnetConfirmationDialogProps {
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog shown before executing state-mutating transactions on mainnet.
 * Requires explicit user confirmation to proceed.
 */
export function MainnetConfirmationDialog({ action, onConfirm, onCancel }: MainnetConfirmationDialogProps) {
  const { t } = useTranslation();

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>
          <span style={styles.warningIcon}>⚠️</span>
          {t('mainnet_confirmation.title', 'Mainnet Transaction')}
        </h2>
        <div style={styles.message}>
          <p style={{ marginBottom: '1rem' }}>
            {t(
              'mainnet_confirmation.message',
              'You are about to execute a transaction on the Stellar mainnet using real assets.'
            )}
          </p>
          <p style={{ marginBottom: '1rem', fontWeight: 600 }}>
            {t('mainnet_confirmation.action', 'Action: {{action}}', { action })}
          </p>
          <p style={{ color: 'var(--red)', fontWeight: 600 }}>
            {t('mainnet_confirmation.warning', 'This action cannot be undone. Do you want to proceed?')}
          </p>
        </div>
        <div style={styles.actions}>
          <button
            style={{ ...styles.button, ...styles.cancelButton }}
            onClick={onCancel}
            onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {t('mainnet_confirmation.cancel', 'Cancel')}
          </button>
          <button
            style={{ ...styles.button, ...styles.confirmButton }}
            onClick={onConfirm}
            onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {t('mainnet_confirmation.confirm', 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
