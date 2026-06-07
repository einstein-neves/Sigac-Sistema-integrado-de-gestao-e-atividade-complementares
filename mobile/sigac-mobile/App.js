import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { useTheme } from './src/hooks/useTheme';
import RootNavigator from './src/navigation/RootNavigator';

function ThemedApp() {
  const { colors, mode } = useTheme();
  const baseTheme = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseTheme,
    dark: mode === 'dark',
    colors: {
      ...baseTheme.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <AuthProvider>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
