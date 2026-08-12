import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, Pressable, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  leftIcon?: React.ComponentProps<typeof MaterialIcons>['name'];
  leftIconColor?: string;
  leftIconBg?: string;
  rightText?: string;
  rightSubtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
}

export function ListItem({
  title,
  subtitle,
  leftIcon,
  leftIconColor,
  leftIconBg,
  rightText,
  rightSubtitle,
  onPress,
  showChevron = false,
}: ListItemProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const containerStyle = [
    styles.container,
    { borderBottomColor: colors.outlineVariant + '22' },
  ];

  const renderContent = () => (
    <>
      <View style={styles.leftSection}>
        {leftIcon && (
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: leftIconBg || colors.surfaceContainerHigh,
              },
            ]}>
            <MaterialIcons
              name={leftIcon}
              size={22}
              color={leftIconColor || colors.onSurfaceVariant}
            />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rightSection}>
        <View style={styles.rightTextContainer}>
          {rightText && (
            <Text style={[styles.rightText, { color: colors.text }]}>
              {rightText}
            </Text>
          )}
          {rightSubtitle && (
            <Text style={[styles.rightSubtitle, { color: colors.textSecondary }]}>
              {rightSubtitle}
            </Text>
          )}
        </View>
        {showChevron && (
          <MaterialIcons
            name="chevron-right"
            size={20}
            color={colors.outline}
            style={styles.chevron}
          />
        )}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...containerStyle,
          pressed && styles.pressed,
        ]}>
        {renderContent()}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{renderContent()}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.two,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'System',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  rightTextContainer: {
    alignItems: 'flex-end',
  },
  rightText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'System',
  },
  rightSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'System',
  },
  chevron: {
    marginLeft: Spacing.one,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.8,
  },
});
