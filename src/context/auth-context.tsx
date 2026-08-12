import React, { createContext, ReactNode, useContext, useState } from 'react';
import { useDispatch } from 'react-redux';
import { resetRmcAuth } from '@/store/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const dispatch = useDispatch();

  const login = () => {
    setIsAuthenticated(true);
  };

  const logout = () => {
    // Clear storage and reset Redux auth state
    AsyncStorage.removeItem('user_rmc').catch((e) => {
      console.error('Failed to remove user_rmc from AsyncStorage:', e);
    });
    dispatch(resetRmcAuth());
    setIsAuthenticated(false);
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
