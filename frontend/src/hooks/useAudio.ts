import { useCallback, useRef } from 'react';
import { usePreferences } from './usePreferences';

export type SoundEffect = 'victory' | 'defeat';

export function useAudio() {
  const { preferences } = usePreferences();
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current && typeof window !== 'undefined' && window.AudioContext) {
      audioContextRef.current = new window.AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const playBeep = useCallback(
    (frequency: number, duration: number, type: OscillatorType = 'sine') => {
      if (!preferences.soundEffects) return;

      const ctx = getAudioContext();
      if (!ctx) return;

      try {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
      } catch (err) {
        console.error('Failed to play sound:', err);
      }
    },
    [preferences.soundEffects, getAudioContext]
  );

  const playSoundEffect = useCallback(
    (effect: SoundEffect) => {
      if (effect === 'victory') {
        playBeep(523.25, 0.2, 'sine');
        setTimeout(() => playBeep(659.25, 0.2, 'sine'), 150);
        setTimeout(() => playBeep(783.99, 0.3, 'sine'), 300);
      } else if (effect === 'defeat') {
        playBeep(392, 0.3, 'sine');
        setTimeout(() => playBeep(329.63, 0.3, 'sine'), 200);
        setTimeout(() => playBeep(293.66, 0.5, 'sine'), 400);
      }
    },
    [playBeep]
  );

  return { playSoundEffect };
}
