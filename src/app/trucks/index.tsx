import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { RootState } from "@/store/store";
import { MaterialIcons } from "@expo/vector-icons";
import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

import { AppHeader } from "@/components/ui/app-header";
import { Card } from "@/components/ui/card";
import { SearchBar } from "@/components/ui/search-bar";
import { Colors, Spacing } from "@/constants/theme";

interface stockList {
  product_id: number;
  product_name: string;
  product_code: string;
  current_stock: {
    qty: number;
    unit: string;
  };
  stock_alert: {
    qty: number;
    unit: string;
  };
  stock_status: {
    in_stock: boolean;
    below_alert: boolean;
  };
}

export default function StockDetails() {
  const { token, plant_id } = useSelector((state: RootState) => state.auth);
   const { startDate, endDate } = useSelector((state: RootState) => state.dateFilter);
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [stockData, setStockData] = useState<stockList[]>([]);
  const [isloading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "low" | "instock">("all");

  useEffect(() => {
    if (token) {
      fetchStockDetailsAPI();
    }
  }, [token, plant_id, startDate, endDate]);

  const fetchStockDetailsAPI = async (isSilent = false) => {
    if (!token) return;

    try {
      if (!isSilent) setIsLoading(true);
      const trimToken = token.includes('|') ? token.split("|")[1] : token;

      const res = await axios.get(`${baseURL}/stock-details?plant_id=${plant_id}&from_date=${startDate}&to_date=${endDate}`, {
        headers: {
          Authorization: `Bearer ${trimToken}`,
          "Content-Type": "application/json"
        }
      });
      setStockData(res.data.data || []);
    } catch (err) {
      console.log("Error fetching stock:", err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStockDetailsAPI(true);
    setRefreshing(false);
  };

  // Memoized stats calculation
  const { totalItems, lowStockCount, outOfStockCount } = useMemo(() => {
    let lowCount = 0;
    let outCount = 0;

    stockData.forEach(item => {
      if (item.stock_status.below_alert) {
        lowCount++;
      }
      if (item.current_stock.qty === 0 || !item.stock_status.in_stock) {
        outCount++;
      }
    });

    return {
      totalItems: stockData.length,
      lowStockCount: lowCount,
      outOfStockCount: outCount,
    };
  }, [stockData]);

  // Memoized filter logic
  const filteredData = useMemo(() => {
    return stockData.filter(item => {
      // 1. Filter by Search Query
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = query === '' || 
        item.product_name.toLowerCase().includes(query) ||
        item.product_code.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      // 2. Filter by Category Tab
      if (filterTab === 'low') {
        return item.stock_status.below_alert;
      }
      if (filterTab === 'instock') {
        return item.stock_status.in_stock;
      }
      return true;
    });
  }, [stockData, searchQuery, filterTab]);

  const filterTabs = [
    { id: 'all', label: 'All', count: stockData.length },
    { id: 'low', label: 'Low Stock', count: lowStockCount },
    { id: 'instock', label: 'In Stock', count: stockData.filter(item => item.stock_status.in_stock).length },
  ];

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Bento Grid Stats Overview */}
      <View style={styles.statsContainer}>
        <Card variant="lowest" style={[styles.statCard, { flex: 1 }]}>
          <View style={[styles.statIconContainer, { backgroundColor: colors.primary + '12' }]}>
            <MaterialIcons name="inventory" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>{totalItems}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Items</Text>
        </Card>

        <Card variant="lowest" style={[styles.statCard, { flex: 1 }]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#F59E0B12' }]}>
            <MaterialIcons name="warning" size={20} color="#F59E0B" />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>{lowStockCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Low Stock</Text>
        </Card>

        <Card variant="lowest" style={[styles.statCard, { flex: 1 }]}>
          <View style={[styles.statIconContainer, { backgroundColor: colors.error + '12' }]}>
            <MaterialIcons name="remove-shopping-cart" size={20} color={colors.error} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>{outOfStockCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Out of Stock</Text>
        </Card>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search product name or code..."
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {filterTabs.map(tab => {
          const isActive = filterTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setFilterTab(tab.id as any)}
              style={({ pressed }) => [
                styles.filterTab,
                isActive
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.surfaceContainerLow },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={[
                  styles.filterTabLabel,
                  isActive ? { color: colors.onPrimary } : { color: colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
              <View
                style={[
                  styles.filterTabBadge,
                  isActive
                    ? { backgroundColor: colors.onPrimary + '30' }
                    : { backgroundColor: colors.surfaceContainerHigh },
                ]}
              >
                <Text
                  style={[
                    styles.filterTabBadgeText,
                    isActive ? { color: colors.onPrimary } : { color: colors.text },
                  ]}
                >
                  {tab.count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStockList = ({ item }: { item: stockList }) => {
    const isOutOfStock = item.current_stock.qty === 0 || !item.stock_status.in_stock;
    const isBelowAlert = item.stock_status.below_alert;

    // Determine status badge colors
    let statusLabel = "In Stock";
    let badgeBg: string = colors.secondaryContainer;
    let badgeText: string = colors.onSecondaryContainer;
    let statusIcon = "check-circle";

    if (isOutOfStock) {
      statusLabel = "Out of Stock";
      badgeBg = colors.errorContainer;
      badgeText = colors.error;
      statusIcon = "error";
    } else if (isBelowAlert) {
      statusLabel = "Low Stock";
      badgeBg = "#F59E0B20";
      badgeText = "#D97706";
      statusIcon = "warning";
    }

    return (
      <Card variant="lowest" style={styles.stockCard}>
        {/* Header: Product name & code */}
        <View style={styles.cardHeader}>
          <View style={styles.productInfo}>
            <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
              {item.product_name}
            </Text>
            <View style={[styles.codeBadge, { backgroundColor: colors.surfaceContainerLow }]}>
              <Text style={[styles.productCode, { color: colors.textSecondary }]}>
                {item.product_code}
              </Text>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.cardDivider, { borderTopColor: colors.outlineVariant + '22' }]} />

        {/* Stats Row */}
        <View style={styles.cardBody}>
          <View style={styles.quantitySection}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Current Stock</Text>
            <View style={styles.qtyContainer}>
              <Text style={[styles.qtyValue, { color: isOutOfStock ? colors.error : colors.primary }]}>
                {item.current_stock.qty}
              </Text>
              <Text style={[styles.qtyUnit, { color: colors.textSecondary }]}>
                {' '}{item.current_stock.unit}
              </Text>
            </View>
          </View>

          <View style={styles.statusSection}>
            <Text style={[styles.label, { color: colors.textSecondary, textAlign: 'right' }]}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
              <MaterialIcons name={statusIcon as any} size={14} color={badgeText} style={{ marginRight: 4 }} />
              <Text style={[styles.statusBadgeText, { color: badgeText }]}>
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Below alert banner */}
        {isBelowAlert && (
          <View style={[styles.alertBanner, { backgroundColor: '#F59E0B10', borderColor: '#F59E0B30' }]}>
            <MaterialIcons name="warning" size={16} color="#D97706" style={{ marginRight: 6 }} />
            <Text style={styles.alertBannerText}>
              Below alert limit: {item.stock_alert.qty} {item.stock_alert.unit}
            </Text>
          </View>
        )}
      </Card>
    );
  };

  const renderEmptyState = () => {
    if (isloading) return null;

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconBg, { backgroundColor: colors.surfaceContainer }]}>
          <MaterialIcons name="inventory" size={48} color={colors.outline} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Stock Items Found</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          {searchQuery
            ? `We couldn't find any products matching "${searchQuery}"`
            : "No items match your active status filter."}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <AppHeader title="Stock Details" showMenu={true} />
      
      {isloading && stockData.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading stock details...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item: stockList) => item.product_id.toString()}
          renderItem={renderStockList}
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'System',
  },
  listContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackGap,
    paddingBottom: 100, // Account for bottom navigation
  },
  headerContainer: {
    marginBottom: Spacing.sectionGap,
    gap: Spacing.three,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  statCard: {
    padding: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'System',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'System',
    textAlign: 'center',
  },
  searchWrapper: {
    marginTop: Spacing.one,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.one * 2,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
    gap: Spacing.one,
  },
  filterTabLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'System',
  },
  filterTabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stockCard: {
    marginBottom: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productInfo: {
    flex: 1,
    gap: Spacing.one,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
    lineHeight: 22,
  },
  codeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  productCode: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'System',
  },
  cardDivider: {
    borderTopWidth: 1,
    marginVertical: Spacing.two,
  },
  cardDividerColor: {
    borderTopColor: '#c3c6d733',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantitySection: {
    flex: 1,
  },
  statusSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 11,
    fontFamily: 'System',
    marginBottom: 4,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  qtyValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'System',
  },
  qtyUnit: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'System',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: Spacing.two,
  },
  alertBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
    fontFamily: 'System',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'System',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export interface TruckItem {
  id: string;
  number: string;
  trips: number;
  load: number;
  sales: number;
}

export const DUMMY_TRUCKS: TruckItem[] = [
  { id: '1', number: 'Loading...', trips: 0, load: 0, sales: 0 }
];