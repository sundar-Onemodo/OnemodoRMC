import React from 'react';
import { StyleSheet, Text, Pressable, PressableProps, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'error';
  size?: 'sm' | 'md';
}

export function Button({ title, variant = 'primary', size = 'md', style, ...props }: ButtonProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const buttonStyle = [
    styles.button,
    size === 'sm' ? styles.smButton : styles.mdButton,
    variant === 'primary'
      ? { backgroundColor: colors.primaryContainer }
      : variant === 'error'
      ? { backgroundColor: colors.error }
      : { backgroundColor: colors.surfaceContainerHigh },
  ];

  const textStyle = [
    styles.text,
    size === 'sm' ? styles.smText : styles.mdText,
    variant === 'primary' || variant === 'error'
      ? { color: colors.onPrimary }
      : { color: colors.text },
  ];

  return (
    <Pressable
      style={(state) => [
        ...buttonStyle,
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}>
      <Text style={textStyle}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  mdButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two * 1.5,
  },
  smButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one * 1.5,
  },
  text: {
    fontWeight: '600',
    fontFamily: 'System',
    textAlign: 'center',
  },
  mdText: {
    fontSize: 14,
  },
  smText: {
    fontSize: 12,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
});
