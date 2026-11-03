import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { useColorScheme, View } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";
import { Drawer } from "@/components/ui/drawer";
import { AuthProvider, useAuth } from "@/context/auth-context";
import LoginScreen from "./login";

import { persistor, RootState, store } from "@/store/store";
import { Provider, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

function TabLayoutInner() {
  const { isAuthenticated, login } = useAuth();
  const reduxToken = useSelector((state: RootState) => state.auth?.token);
  const isUserAuthenticated = Boolean(reduxToken || isAuthenticated);
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        <StatusBar style="light" backgroundColor="#063b89" />
        <AnimatedSplashOverlay />
        {isUserAuthenticated ? (
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
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthProvider>
          <TabLayoutInner />
        </AuthProvider>
      </PersistGate>
    </Provider>
  );
}
