import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React from 'react';
import { useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { Drawer } from '@/components/ui/drawer';
import { AuthProvider, useAuth } from '@/context/auth-context';
import LoginScreen from './login';

import { persistor, store } from '@/store/store';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

function TabLayoutInner() {
  const { isAuthenticated, login } = useAuth();
  const colorScheme = useColorScheme();
  
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        <StatusBar style="light" />
        <AnimatedSplashOverlay />
        {isAuthenticated ? (
          <>
            <AppTabs />
            <Drawer />
          </>
        ) : (
          <LoginScreen onLogin={login} />
        )}
      </View>
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <Provider store={store} >
      <PersistGate loading={null} persistor={persistor}>
    <AuthProvider>
      <TabLayoutInner />
    </AuthProvider>
    </PersistGate>
    </Provider>
  );
}
