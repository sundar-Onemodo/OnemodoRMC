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

import { DUMMY_CUSTOMERS } from './index';

import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { ListItem } from '@/components/ui/list-item';
import { Colors, Spacing } from '@/constants/theme';

interface TransactionItem {
  id: string;
  date: string;
  type: 'Cash' | 'Credit';
  amount: number;
  reference: string;
}

export default function CustomerDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // Look up selected customer
  const customer = DUMMY_CUSTOMERS.find((c) => c.id === id) || DUMMY_CUSTOMERS[0];
  const paidAmount = customer.totalPurchase - customer.pendingAmount;

  // Generated transaction history list
  const transactions: TransactionItem[] = [
    { id: '1', date: 'Oct 23, 2026', type: 'Credit', amount: 4500, reference: 'Invoice #INV-2089' },
    { id: '2', date: 'Oct 19, 2026', type: 'Cash', amount: 1200, reference: 'Receipt #RCP-1042' },
    { id: '3', date: 'Oct 15, 2026', type: 'Credit', amount: 8000, reference: 'Invoice #INV-2041' },
    { id: '4', date: 'Oct 10, 2026', type: 'Cash', amount: 15000, reference: 'Receipt #RCP-1011' },
    { id: '5', date: 'Oct 05, 2026', type: 'Credit', amount: 23000, reference: 'Invoice #INV-1994' },
    { id: '6', date: 'Sep 28, 2026', type: 'Cash', amount: 840, reference: 'Receipt #RCP-0987' },
  ];

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Summary Card */}
      <Card style={styles.summaryCard} variant="lowest">
        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>FINANCIAL SUMMARY</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              ${customer.totalPurchase.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Purchase</Text>
          </View>
          <View style={[styles.statCol, { borderLeftWidth: 1, borderRightWidth: 1, borderLeftColor: colors.outlineVariant + '33', borderRightColor: colors.outlineVariant + '33' }]}>
            <Text style={[styles.statValue, { color: colors.secondary }]}>
              ${paidAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Paid</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.error }]}>
              ${customer.pendingAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pending</Text>
          </View>
        </View>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
    </View>
  );

  const renderTransactionItem = ({ item }: { item: TransactionItem }) => {
    const isCredit = item.type === 'Credit';
    const typeColor = isCredit ? colors.tertiary : colors.secondary;
    const typeBg = isCredit ? colors.tertiary + '15' : colors.secondary + '15';
    const icon = isCredit ? 'credit-card' : 'payments';

    return (
      <ListItem
        title={item.reference}
        subtitle={item.date}
        leftIcon={icon}
        leftIconBg={typeBg}
        leftIconColor={typeColor}
        rightText={`$${item.amount.toLocaleString()}`}
        rightSubtitle={item.type}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.headerBgColor }]} edges={['top']}>
      <AppHeader
        title={customer.name}
        onBackPress={() => router.back()}
      />
      <FlatList
        style={[styles.contentContainer, { backgroundColor: colors.background }]}
        data={transactions}
        renderItem={renderTransactionItem}
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
  contentContainer: {
    flex: 1,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: 'hidden',
  },
  listContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: 24, // Added breathing room under rounded corners
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
    fontSize: 20,
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
