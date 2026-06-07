import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themePalettes } from '../styles/theme';

const THEME_KEY = 'sigac_mobile_theme_mode';

export const ThemeContext = createContext({
  mode: 'light',
  colors: themePalettes.light,
  setMode: () => {},
  toggleMode: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === 'dark' || saved === 'light') setModeState(saved);
      })
      .catch(() => {});
  }, []);

  const setMode = useCallback((nextMode) => {
    const normalized = nextMode === 'dark' ? 'dark' : 'light';
    setModeState(normalized);
    AsyncStorage.setItem(THEME_KEY, normalized).catch(() => {});
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    mode,
    colors: themePalettes[mode] || themePalettes.light,
    setMode,
    toggleMode,
  }), [mode, setMode, toggleMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
