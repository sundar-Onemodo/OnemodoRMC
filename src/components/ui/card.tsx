import React from 'react';
import { StyleSheet, View, ViewProps, useColorScheme, Pressable } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

interface CardProps extends ViewProps {
  onPress?: () => void;
  variant?: 'lowest' | 'low' | 'default';
}

export function Card({ children, style, onPress, variant = 'lowest', ...props }: CardProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const cardStyle = [
    styles.card,
    {
      backgroundColor:
        variant === 'lowest'
          ? colors.surfaceContainerLowest
          : variant === 'low'
          ? colors.surfaceContainerLow
          : colors.surface,
      borderColor: colors.outlineVariant + '1A', // transparent outline border
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed && styles.pressed,
        ]}
        {...props}>
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: Spacing.cardPadding,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3, // for android
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
    shadowOpacity: 0.01,
    elevation: 1,
  },
});
