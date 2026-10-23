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
    background: '#F1F5F9', // Premium Slate 100 Background
    backgroundElement: '#E2E8F0', // Slate 200
    backgroundSelected: '#CBD5E1', 

    // System brand values
    primary: '#1D4ED8', // Rich Executive Royal Blue
    primaryContainer: '#2563EB', // Vibrant Blue
    onPrimary: '#ffffff',
    onPrimaryContainer: '#DBEAFE',
    secondary: '#0284C7', // Ocean / Cobalt Accent
    secondaryContainer: '#E0F2FE',
    onSecondary: '#ffffff',
    onSecondaryContainer: '#0369A1',
    tertiary: '#F59E0B', // Amber Gold (Cash)
    tertiaryContainer: '#FEF3C7',
    onTertiary: '#ffffff',
    onTertiaryContainer: '#78350F',
    surface: '#ffffff',
    surfaceContainer: '#ffffff',
    surfaceContainerLow: '#F8FAFC',
    surfaceContainerHigh: '#E2E8F0',
    surfaceContainerLowest: '#ffffff',
    headerBgColor: '#0F172A', // Deep Midnight Navy Header
    onSurface: '#0f172a',
    onSurfaceVariant: '#475569',
    outline: '#94a3b8',
    outlineVariant: '#E2E8F0',
    error: '#ef4444',
    errorContainer: '#fee2e2',
    onError: '#ffffff',
  },
  dark: {
    // Basic standard theme values
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    background: '#090D16', // Deep Obsidian Slate
    backgroundElement: '#111827',
    backgroundSelected: '#1E293B',

    // System brand values
    primary: '#3B82F6', // Electric Vibrant Blue
    primaryContainer: '#1D4ED8',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#DBEAFE',
    secondary: '#38BDF8', // Cyan Light Accent
    secondaryContainer: '#0C4A6E',
    onSecondary: '#ffffff',
    onSecondaryContainer: '#BAE6FD',
    tertiary: '#FBBF24',
    tertiaryContainer: '#78350F',
    onTertiary: '#ffffff',
    onTertiaryContainer: '#FDE68A',
    surface: '#111827',
    surfaceContainer: '#1E293B',
    surfaceContainerLow: '#0F172A',
    surfaceContainerHigh: '#334155',
    surfaceContainerLowest: '#090D16',
    headerBgColor: '#070A12', // Ultra Deep Midnight
    onSurface: '#f8fafc',
    onSurfaceVariant: '#94a3b8',
    outline: '#475569',
    outlineVariant: '#334155',
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

