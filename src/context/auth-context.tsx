import React, { createContext, ReactNode, useContext, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { resetRmcAuth } from '@/store/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootState } from '@/store/store';

interface AuthContextType {
  isAuthenticated: boolean;
  isDrawerOpen: boolean;
  login: () => void;
  logout: () => void;
  toggleDrawer: () => void;
  closeDrawer: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const reduxToken = useSelector((state: RootState) => state.auth?.token);
  const [localAuth, setLocalAuth] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const dispatch = useDispatch();

  const isAuthenticated = Boolean(reduxToken || localAuth);

  const login = () => {
    setLocalAuth(true);
  };

  const logout = () => {
    // Clear storage and reset Redux auth state
    AsyncStorage.removeItem('user_rmc').catch((e) => {
      console.error('Failed to remove user_rmc from AsyncStorage:', e);
    });
    dispatch(resetRmcAuth());
    setLocalAuth(false);
    setIsDrawerOpen(false);
  };

  const toggleDrawer = () => {
    setIsDrawerOpen((prev) => !prev);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isDrawerOpen,
        login,
        logout,
        toggleDrawer,
        closeDrawer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
