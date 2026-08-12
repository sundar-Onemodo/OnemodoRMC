/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Basic standard theme values
    text: '#191c1e',
    textSecondary: '#434655',
    background: '#f8f9fb',
    backgroundElement: '#edeef0',
    backgroundSelected: '#dbe1ff',
    
    // Stitch system values
    primary: '#004ac6',
    primaryContainer: '#2563eb',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#eeefff',
    secondary: '#006c49',
    secondaryContainer: '#6cf8bb',
    onSecondary: '#ffffff',
    onSecondaryContainer: '#00714d',
    tertiary: '#943700',
    tertiaryContainer: '#bc4800',
    onTertiary: '#ffffff',
    onTertiaryContainer: '#ffede6',
    surface: '#ffffff',
    surfaceContainer: '#edeef0',
    surfaceContainerLow: '#f3f4f6',
    surfaceContainerHigh: '#e7e8ea',
    surfaceContainerLowest: '#ffffff',
    onSurface: '#191c1e',
    onSurfaceVariant: '#434655',
    outline: '#737686',
    outlineVariant: '#c3c6d7',
    error: '#ba1a1a',
    errorContainer: '#ffdad6',
    onError: '#ffffff',
  },
  dark: {
    // Basic standard theme values
    text: '#f0f1f3',
    textSecondary: '#c3c6d7',
    background: '#0F172A',
    backgroundElement: '#1E293B',
    backgroundSelected: '#003ea8',

    // Stitch system values (adjusted for Dark Mode contrast)
    primary: '#b4c5ff',
    primaryContainer: '#003ea8',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#b4c5ff',
    secondary: '#4edea3',
    secondaryContainer: '#005236',
    onSecondary: '#ffffff',
    onSecondaryContainer: '#6cf8bb',
    tertiary: '#ffb596',
    tertiaryContainer: '#7d2d00',
    onTertiary: '#ffffff',
    onTertiaryContainer: '#ffdbcd',
    surface: '#1E293B',
    surfaceContainer: '#334155',
    surfaceContainerLow: '#1e293b',
    surfaceContainerHigh: '#475569',
    surfaceContainerLowest: '#0f172a',
    onSurface: '#f0f1f3',
    onSurfaceVariant: '#c3c6d7',
    outline: '#737686',
    outlineVariant: '#475569',
    error: '#ffdad6',
    errorContainer: '#93000a',
    onError: '#93000a',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  
  // Stitch specific pixel equivalents
  containerMargin: 16,
  gutter: 16,
  cardPadding: 20,
  stackGap: 12,
  sectionGap: 24,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

