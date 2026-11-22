import { useState, useEffect } from 'react';

const PREFERENCES_KEY = 'starbound-preferences';

export interface Preferences {
  theme: 'dark' | 'light';
  soundEffects: boolean;
  notifications: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  soundEffects: true,
  notifications: true,
};

function getStoredPreferences(): Preferences {
  if (typeof localStorage === 'undefined') return DEFAULT_PREFERENCES;
  const stored = localStorage.getItem(PREFERENCES_KEY);
  if (!stored) return DEFAULT_PREFERENCES;
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function usePreferences() {
  const [preferences, setPreferencesState] = useState<Preferences>(getStoredPreferences);

  useEffect(() => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    if (preferences.theme) {
      document.documentElement.setAttribute('data-theme', preferences.theme);
    }
  }, [preferences]);

  const setPreferences = (update: Partial<Preferences>) => {
    setPreferencesState((prev) => ({ ...prev, ...update }));
  };

  return { preferences, setPreferences };
}
