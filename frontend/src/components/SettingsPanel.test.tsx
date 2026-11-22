import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPanel } from './SettingsPanel';

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
});

describe('SettingsPanel', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  it('renders settings button', () => {
    render(<SettingsPanel network="Testnet" />);
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  it('shows panel when settings button is clicked', async () => {
    render(<SettingsPanel network="Testnet" />);
    const settingsBtn = screen.getByRole('button', { name: /settings/i });

    fireEvent.click(settingsBtn);

    await waitFor(() => {
      expect(screen.getByText(/preferences/i)).toBeInTheDocument();
    });
  });

  it('closes panel when clicking outside', async () => {
    render(
      <div>
        <SettingsPanel network="Testnet" />
        <div data-testid="outside">Outside</div>
      </div>
    );

    const settingsBtn = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsBtn);

    await waitFor(() => {
      expect(screen.getByText(/preferences/i)).toBeInTheDocument();
    });

    const outside = screen.getByTestId('outside');
    fireEvent.mouseDown(outside);

    await waitFor(() => {
      expect(screen.queryByText(/preferences/i)).not.toBeInTheDocument();
    });
  });

  it('toggles theme preference', async () => {
    render(<SettingsPanel network="Testnet" />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/light mode/i)).toBeInTheDocument();
    });

    const themeCheckbox = screen.getByLabelText(/light mode/i);
    fireEvent.click(themeCheckbox);

    await waitFor(() => {
      expect((themeCheckbox as HTMLInputElement).checked).toBe(true);
    });
  });

  it('toggles sound effects preference', async () => {
    render(<SettingsPanel network="Testnet" />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/sound effects/i)).toBeInTheDocument();
    });

    const soundCheckbox = screen.getByLabelText(/sound effects/i);
    expect((soundCheckbox as HTMLInputElement).checked).toBe(true);

    fireEvent.click(soundCheckbox);

    await waitFor(() => {
      expect((soundCheckbox as HTMLInputElement).checked).toBe(false);
    });
  });

  it('toggles notifications preference', async () => {
    render(<SettingsPanel network="Testnet" />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/notifications/i)).toBeInTheDocument();
    });

    const notifCheckbox = screen.getByLabelText(/notifications/i);
    expect((notifCheckbox as HTMLInputElement).checked).toBe(true);

    fireEvent.click(notifCheckbox);

    await waitFor(() => {
      expect((notifCheckbox as HTMLInputElement).checked).toBe(false);
    });
  });

  it('shows network badge', async () => {
    render(<SettingsPanel network="Mainnet" />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    await waitFor(() => {
      expect(screen.getByText(/mainnet/i)).toBeInTheDocument();
    });
  });

  it('persists preferences to localStorage', async () => {
    render(<SettingsPanel network="Testnet" />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/sound effects/i)).toBeInTheDocument();
    });

    const soundCheckbox = screen.getByLabelText(/sound effects/i);
    fireEvent.click(soundCheckbox);

    await waitFor(() => {
      const stored = JSON.parse(mockLocalStorage.getItem('starbound-preferences') || '{}');
      expect(stored.soundEffects).toBe(false);
    });
  });
});
