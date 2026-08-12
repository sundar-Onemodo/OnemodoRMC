import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DUMMY_TRUCKS } from './index';

import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { ListItem } from '@/components/ui/list-item';
import { Colors, Spacing } from '@/constants/theme';

interface TripItem {
  id: string;
  date: string;
  load: number;
  amount: number;
  destination: string;
}

export default function TruckDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // Find the selected truck
  const truck = DUMMY_TRUCKS.find((t) => t.id === id) || DUMMY_TRUCKS[0];

  // Generated dummy trips history for this truck
  const tripHistory: TripItem[] = [
    { id: '1', date: 'Oct 24, 2026', load: 24.8, amount: 2150, destination: 'Warehouse A -> Port Terminal' },
    { id: '2', date: 'Oct 22, 2026', load: 22.5, amount: 1850, destination: 'Hub South -> Assembly Plant' },
    { id: '3', date: 'Oct 20, 2026', load: 26.0, amount: 2400, destination: 'Port Terminal -> Dist. Center 4' },
    { id: '4', date: 'Oct 17, 2026', load: 23.4, amount: 1950, destination: 'Warehouse B -> Hub South' },
    { id: '5', date: 'Oct 15, 2026', load: 25.1, amount: 2200, destination: 'Dist. Center 4 -> Warehouse A' },
    { id: '6', date: 'Oct 12, 2026', load: 20.8, amount: 1700, destination: 'Assembly Plant -> Warehouse B' },
  ];

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Summary Card */}
      <Card style={styles.summaryCard} variant="lowest">
        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>FLEET PERFORMANCE SUMMARY</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{truck.trips}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Trips</Text>
          </View>
          <View style={[styles.statCol, { borderLeftWidth: 1, borderRightWidth: 1, borderLeftColor: colors.outlineVariant + '33', borderRightColor: colors.outlineVariant + '33' }]}>
            <Text style={[styles.statValue, { color: colors.secondary }]}>{truck.load} t</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Load</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>${truck.sales.toLocaleString()}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Earnings</Text>
          </View>
        </View>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Trip History</Text>
    </View>
  );

  const renderTripItem = ({ item }: { item: TripItem }) => {
    return (
      <ListItem
        title={item.destination}
        subtitle={item.date}
        leftIcon="local-shipping"
        leftIconBg={colors.surfaceContainer}
        rightText={`$${item.amount}`}
        rightSubtitle={`${item.load} Tons`}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <AppHeader
        title={truck.number}
        onBackPress={() => router.back()}
      />
      <FlatList
        data={tripHistory}
        renderItem={renderTripItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackGap,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: Spacing.two,
  },
  summaryCard: {
    marginTop: Spacing.stackGap,
    marginBottom: Spacing.sectionGap,
    gap: Spacing.three,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    fontFamily: 'System',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.one,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'System',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'System',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
    marginBottom: Spacing.two,
  },
});
