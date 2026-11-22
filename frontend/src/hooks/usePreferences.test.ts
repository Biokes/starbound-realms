import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreferences } from './usePreferences';

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

describe('usePreferences', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  it('returns default preferences', () => {
    const { result } = renderHook(() => usePreferences());

    expect(result.current.preferences.theme).toBe('dark');
    expect(result.current.preferences.soundEffects).toBe(true);
    expect(result.current.preferences.notifications).toBe(true);
  });

  it('updates theme preference', () => {
    const { result } = renderHook(() => usePreferences());

    act(() => {
      result.current.setPreferences({ theme: 'light' });
    });

    expect(result.current.preferences.theme).toBe('light');
  });

  it('updates sound effects preference', () => {
    const { result } = renderHook(() => usePreferences());

    act(() => {
      result.current.setPreferences({ soundEffects: false });
    });

    expect(result.current.preferences.soundEffects).toBe(false);
  });

  it('updates notifications preference', () => {
    const { result } = renderHook(() => usePreferences());

    act(() => {
      result.current.setPreferences({ notifications: false });
    });

    expect(result.current.preferences.notifications).toBe(false);
  });

  it('persists preferences to localStorage', () => {
    const { result } = renderHook(() => usePreferences());

    act(() => {
      result.current.setPreferences({ theme: 'light', soundEffects: false });
    });

    const stored = JSON.parse(mockLocalStorage.getItem('starbound-preferences') || '{}');
    expect(stored.theme).toBe('light');
    expect(stored.soundEffects).toBe(false);
  });

  it('restores preferences from localStorage', () => {
    mockLocalStorage.setItem(
      'starbound-preferences',
      JSON.stringify({ theme: 'light', soundEffects: false, notifications: true })
    );

    const { result } = renderHook(() => usePreferences());

    expect(result.current.preferences.theme).toBe('light');
    expect(result.current.preferences.soundEffects).toBe(false);
    expect(result.current.preferences.notifications).toBe(true);
  });

  it('applies theme to document', () => {
    const { result } = renderHook(() => usePreferences());

    act(() => {
      result.current.setPreferences({ theme: 'light' });
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
