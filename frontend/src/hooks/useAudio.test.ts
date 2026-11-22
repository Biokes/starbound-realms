import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudio } from './useAudio';

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

describe('useAudio', () => {
  let oscillatorMock: any;
  let gainNodeMock: any;
  let audioContextMock: any;

  beforeEach(() => {
    mockLocalStorage.clear();

    gainNodeMock = {
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    };

    oscillatorMock = {
      connect: vi.fn(),
      frequency: { value: 0 },
      type: '',
      start: vi.fn(),
      stop: vi.fn(),
    };

    audioContextMock = {
      createOscillator: vi.fn(() => oscillatorMock),
      createGain: vi.fn(() => gainNodeMock),
      destination: {},
      currentTime: 0,
    };

    global.AudioContext = vi.fn(() => audioContextMock) as any;
  });

  afterEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  it('plays victory sound when sound effects are enabled', () => {
    mockLocalStorage.setItem('starbound-preferences', JSON.stringify({ soundEffects: true }));

    const { result } = renderHook(() => useAudio());

    act(() => {
      result.current.playSoundEffect('victory');
    });

    expect(oscillatorMock.connect).toHaveBeenCalled();
    expect(oscillatorMock.start).toHaveBeenCalled();
  });

  it('plays defeat sound when sound effects are enabled', () => {
    mockLocalStorage.setItem('starbound-preferences', JSON.stringify({ soundEffects: true }));

    const { result } = renderHook(() => useAudio());

    act(() => {
      result.current.playSoundEffect('defeat');
    });

    expect(oscillatorMock.connect).toHaveBeenCalled();
    expect(oscillatorMock.start).toHaveBeenCalled();
  });

  it('does not play sound when sound effects are disabled', () => {
    mockLocalStorage.setItem('starbound-preferences', JSON.stringify({ soundEffects: false }));

    const { result } = renderHook(() => useAudio());

    act(() => {
      result.current.playSoundEffect('victory');
    });

    expect(oscillatorMock.connect).not.toHaveBeenCalled();
  });

  it('handles audio context errors gracefully', () => {
    mockLocalStorage.setItem('starbound-preferences', JSON.stringify({ soundEffects: true }));

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    audioContextMock.createOscillator.mockImplementation(() => {
      throw new Error('Audio context error');
    });

    const { result } = renderHook(() => useAudio());

    act(() => {
      result.current.playSoundEffect('victory');
    });

    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
