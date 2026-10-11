import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useSettingsStore } from './src/store/useSettingsStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import './src/i18n';
import { initMobileSandbox } from './src/sandbox/mobile-sandbox';

// Attach unified sandbox in development
initMobileSandbox();

export default function App() {
  const themePreference = useSettingsStore((state) => state.theme);
  
  // Since we are scaffolding, we mock system theme to 'dark' for now.
  // In a real app, use useColorScheme() from react-native.
  const isDarkMode = themePreference === 'system' ? true : themePreference === 'dark';

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={isDarkMode ? DarkTheme : DefaultTheme}>
        <RootNavigator />
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
