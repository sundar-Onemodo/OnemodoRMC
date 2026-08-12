import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Card } from './card';

import { Colors, Spacing } from '@/constants/theme';

interface StatCardProps {
  iconName: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
}

export function StatCard({ iconName, label, value, trend, trendPositive = true }: StatCardProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <Card style={styles.container} variant="lowest">
      <View style={styles.header}>
        <View style={[styles.iconWrapper, { backgroundColor: colors.primary + '15' }]}>
          <MaterialIcons name={iconName} size={20} color={colors.primary} />
        </View>
        {trend && (
          <Text
            style={[
              styles.trendText,
              { color: trendPositive ? colors.secondary : colors.error },
            ]}>
            {trend}
          </Text>
        )}
      </View>
      <Text style={[styles.labelText, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.valueText, { color: colors.text }]}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 140,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  iconWrapper: {
    padding: Spacing.one * 1.5,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'System',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    fontFamily: 'System',
  },
  valueText: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'System',
  },
});
