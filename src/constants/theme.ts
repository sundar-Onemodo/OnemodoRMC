/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Basic standard theme values
    text: '#0f172a', // Slate 900
    textSecondary: '#475569', // Slate 600
    background: '#f8fafc', // Slate 50
    backgroundElement: '#f1f5f9', // Slate 100
    backgroundSelected: '#e2e8f0', // Slate 200

    // Stitch system values
    primary: '#3b82f6', // Premium Indigo/Blue
    primaryContainer: '#2563eb',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#1e3a8a',
    secondary: '#10b981', // Emerald green
    secondaryContainer: '#a7f3d0',
    onSecondary: '#ffffff',
    onSecondaryContainer: '#065f46',
    tertiary: '#f59e0b', // Amber
    tertiaryContainer: '#fde68a',
    onTertiary: '#ffffff',
    onTertiaryContainer: '#78350f',
    surface: '#ffffff',
    surfaceContainer: '#f1f5f9',
    surfaceContainerLow: '#f8fafc',
    surfaceContainerHigh: '#e2e8f0',
    surfaceContainerLowest: '#ffffff',
    headerBgColor: '#fafafa',
    onSurface: '#0f172a',
    onSurfaceVariant: '#475569',
    outline: '#94a3b8',
    outlineVariant: '#cbd5e1',
    error: '#ef4444',
    errorContainer: '#fee2e2',
    onError: '#ffffff',
  },
  dark: {
    // Basic standard theme values
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    background: '#090d16', // Deep space dark blue
    backgroundElement: '#111827',
    backgroundSelected: '#1e293b',

    // Stitch system values
    primary: '#60a5fa',
    primaryContainer: '#2563eb',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#dbeafe',
    secondary: '#34d399',
    secondaryContainer: '#065f46',
    onSecondary: '#ffffff',
    onSecondaryContainer: '#a7f3d0',
    tertiary: '#fbbf24',
    tertiaryContainer: '#78350f',
    onTertiary: '#ffffff',
    onTertiaryContainer: '#fde68a',
    surface: '#111827',
    surfaceContainer: '#1f2937',
    surfaceContainerLow: '#111827',
    surfaceContainerHigh: '#374151',
    surfaceContainerLowest: '#0e1420',
    headerBgColor: '#fafafa',
    onSurface: '#f8fafc',
    onSurfaceVariant: '#94a3b8',
    outline: '#475569',
    outlineVariant: '#374151',
    error: '#f87171',
    errorContainer: '#7f1d1d',
    onError: '#7f1d1d',
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

