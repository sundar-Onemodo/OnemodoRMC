// import { MaterialIcons } from '@expo/vector-icons';
// import { useRouter } from 'expo-router';
// import React, { useState } from 'react';
// import {
//   FlatList,
//   StyleSheet,
//   Text,
//   View,
//   Pressable,
//   useColorScheme,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { RootState } from "@/store/store";
import { Feather, FontAwesome5, Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { SearchBar } from '@/components/ui/search-bar';
import { Colors, Spacing } from '@/constants/theme';

export default function CustomerListScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { token, plant_name: palntName,plant_id } = useSelector((state: RootState) => state.auth);
   const { startDate, endDate } = useSelector((state: RootState) => state.dateFilter);

  const [isLoading, setIsLoading] = useState(false);
  const [customerData, setCustomerData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);

  const toggleCustomerExpand = (rowKey: string) => {
    setExpandedRowKey((prevKey) => (prevKey === rowKey ? null : rowKey));
  };

  useEffect(() => {
    if (token) {
      fetchCustomerDetailsAPI();
    }
  }, [token, plant_id, startDate, endDate]);

  const fetchCustomerDetailsAPI = async () => {
    if (!token) return;

    try {
      const trimToken = token.includes('|') ? token.split('|')[1] : token;
      setIsLoading(true);

      const res = await axios.get(`${baseURL}/customer-details?plant_id=${plant_id}&from_date=${startDate}&to_date=${endDate}`, {
        headers: {
          Authorization: `Bearer ${trimToken}`,
          'Content-Type': 'application/json',
        },
      });
      console.log(res.data.data);
      setCustomerData(res.data.data || []);
      setIsLoading(false);
    } catch (error: any) {
      setIsLoading(false);
      console.log(error.response?.data);
    } finally {
      setIsLoading(false);
    }
  };

  const formatQty = (value: any) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "0";
    const fixedNum = parseFloat(num.toFixed(2));
    return fixedNum.toLocaleString("en-IN");
  };

  const getDeviationColor = (deviation: number) => {
    if (deviation > 0) return colors.secondary; // green
    if (deviation < 0) return colors.error;     // red
    return colors.tertiary;                     // orange/amber
  };

  // Filter customerData based on search query
  const filteredCustomerData = customerData.filter((item) => {
    if (!searchQuery) return true;
    const name = item.customer_name?.toLowerCase() || "";
    const loc = item.site_location?.toLowerCase() || "";
    const design = item.mix_design?.design_name?.toLowerCase() || "";
    const grade = item.grade?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    return (
      name.includes(query) ||
      loc.includes(query) ||
      design.includes(query) ||
      grade.includes(query)
    );
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <AppHeader title="Customers" showMenu={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Plant Overview Banner */}
        <Card style={styles.plantCard} variant="low">
          <View style={styles.plantInfoRow}>
            <View style={[styles.plantAvatar, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.plantAvatarText, { color: colors.primary }]}>
                {palntName?.charAt(0).toUpperCase() || 'P'}
              </Text>
            </View>
            <View style={styles.plantTextDetails}>
              <Text style={[styles.plantLabel, { color: colors.textSecondary }]}>Ready Mix Concrete</Text>
              <Text style={[styles.plantName, { color: colors.text }]} numberOfLines={1}>
                {palntName || "Main Plant"}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.tertiary + '15' }]}>
              <Text style={[styles.badgeText, { color: colors.tertiary }]}>RMC</Text>
            </View>
          </View>
        </Card>

        {/* Search Bar section */}
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search customers, site location, design..."
          />
        </View>

        {/* Customer list container */}
        <View style={styles.listContainer}>
          {isLoading ? (
            <View style={styles.stateWrapper}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                Syncing customer records...
              </Text>
            </View>
          ) : filteredCustomerData.length === 0 ? (
            <View style={styles.stateWrapper}>
              <Ionicons
                name="documents-outline"
                size={48}
                color={colors.outlineVariant}
              />
              <Text style={[styles.stateText, { color: colors.outline }]}>
                {customerData.length === 0 ? "No customer details found" : "No matches found for search query"}
              </Text>
            </View>
          ) : (
            filteredCustomerData.map((item, index) => {
              const rowKey = `${item.customer_id || 'cust'}-${index}`;
              const isExpand = expandedRowKey === rowKey;

              return (
                <Card
                  key={rowKey}
                  style={[styles.customerCard, isExpand && { borderColor: colors.primary + '4D' }]}
                  variant="lowest"
                  onPress={() => toggleCustomerExpand(rowKey)}
                >
                  {/* Card Main Info */}
                  <View style={styles.cardHeader}>
                    <View style={[styles.customerAvatar, { backgroundColor: colors.primary + '10' }]}>
                      <Text style={[styles.customerAvatarText, { color: colors.primary }]}>
                        {item.customer_name?.charAt(0).toUpperCase() || 'C'}
                      </Text>
                    </View>
                    <View style={styles.customerMeta}>
                      <Text style={[styles.customerTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.customer_name}
                      </Text>
                      <View style={styles.metaBadgeRow}>
                        <View style={styles.metaItem}>
                          <Ionicons name="location" size={12} color={colors.error} />
                          <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.site_location || "Main Site"}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.expandIconWrapper}>
                      <Ionicons
                        name={isExpand ? "chevron-up-circle" : "chevron-down-circle"}
                        size={22}
                        color={isExpand ? colors.primary : colors.outline}
                      />
                    </View>
                  </View>

                  {/* Badges Overview Row (Always Visible) */}
                  <View style={styles.badgesOverviewRow}>
                    <View style={[styles.badge, { backgroundColor: colors.surfaceContainerHigh }]}>
                      <Feather name="layers" size={12} color={colors.primary} />
                      <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                        {item.mix_design?.design_name || "N/A"}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: colors.secondary + '15' }]}>
                      <Feather name="truck" size={12} color={colors.secondary} />
                      <Text style={[styles.badgeText, { color: colors.secondary }]}>
                        {item.total_dispatch_count?.qty ?? 0} {item.total_dispatch_count?.unit || "trips"}
                      </Text>
                    </View>
                  </View>

                  {/* Expanded Content */}
                  {isExpand && (
                    <View style={[styles.expandedArea, { borderTopColor: colors.outlineVariant + '33' }]}>
                      {/* Sub-grid stats */}
                      <View style={styles.expandedStatsGrid}>
                        <View style={[styles.statsCard, { backgroundColor: colors.surfaceContainerLow }]}>
                          <Text style={[styles.statsLabel, { color: colors.outline }]}>GRADE</Text>
                          <Text style={[styles.statsValue, { color: colors.text }]}>
                            {item.grade || "N/A"}
                          </Text>
                        </View>
                        <View style={[styles.statsCard, { backgroundColor: colors.surfaceContainerLow }]}>
                          <Text style={[styles.statsLabel, { color: colors.outline }]}>DESIGN NAME</Text>
                          <Text style={[styles.statsValue, { color: colors.text }]} numberOfLines={1}>
                            {item.mix_design?.design_name || "N/A"}
                          </Text>
                        </View>
                        <View style={[styles.statsCard, { backgroundColor: colors.surfaceContainerLow }]}>
                          <Text style={[styles.statsLabel, { color: colors.outline }]}>DISPATCHES</Text>
                          <Text style={[styles.statsValue, { color: colors.text }]}>
                            {item.total_dispatch_count?.qty || 0} {item.total_dispatch_count?.unit || "trips"}
                          </Text>
                        </View>
                      </View>

                      {/* Material Consumption section */}
                      <View style={[styles.materialSection, { borderColor: colors.outlineVariant + '33' }]}>
                        <View style={[styles.materialHeader, { backgroundColor: colors.surfaceContainerHigh }]}>
                          <FontAwesome5 name="clipboard-list" size={14} color={colors.tertiary} />
                          <Text style={[styles.materialTitle, { color: colors.text }]}>
                            Material Consumption Breakdown
                          </Text>
                        </View>

                        <View style={styles.materialList}>
                          {item.material_consumption && item.material_consumption.length > 0 ? (
                            item.material_consumption.map((material: any, idx: number) => {
                              const targetQty = material.traget_qty?.qty || 0;
                              const actualQty = material.actual_qty?.qty || 0;
                              const deviation = material.deviation_qty?.qty || 0;
                              const unit = material.actual_qty?.unit || "KGS";
                              const deviationColor = getDeviationColor(deviation);

                              const deviationPercent = targetQty !== 0
                                ? ((deviation / targetQty) * 100).toFixed(1)
                                : "0";
                              const absPercent = Math.abs(parseFloat(deviationPercent));

                              const ratio = targetQty > 0 ? actualQty / targetQty : 0;
                              const progressPercent = Math.min(ratio * 100, 100);

                              return (
                                <View key={idx} style={[styles.materialRow, { borderBottomColor: colors.outlineVariant + '15' }]}>
                                  <View style={styles.materialRowHeader}>
                                    <Text style={[styles.materialName, { color: colors.text }]}>
                                      {material.material_name}
                                    </Text>
                                    <View style={[styles.deviationBadge, { backgroundColor: `${deviationColor}15` }]}>
                                      <Ionicons
                                        name={deviation > 0 ? "trending-up" : deviation < 0 ? "trending-down" : "checkmark-circle"}
                                        size={12}
                                        color={deviationColor}
                                      />
                                      <Text style={[styles.deviationBadgeText, { color: deviationColor }]}>
                                        {absPercent}% {deviation > 0 ? "Over" : deviation < 0 ? "Under" : "Target"}
                                      </Text>
                                    </View>
                                  </View>

                                  <View style={styles.materialQuantities}>
                                    <Text style={[styles.qtyLabel, { color: colors.textSecondary }]}>
                                      Target: <Text style={[styles.qtyValue, { color: colors.text }]}>{formatQty(targetQty)} {unit}</Text>
                                    </Text>
                                    <Text style={[styles.qtyLabel, { color: colors.textSecondary }]}>
                                      Actual: <Text style={[styles.qtyValue, { color: colors.primary }]}>{formatQty(actualQty)} {unit}</Text>
                                    </Text>
                                    <Text style={[styles.qtyLabel, { color: colors.textSecondary }]}>
                                      Dev: <Text style={[styles.qtyValue, { color: deviationColor }]}>{deviation > 0 ? "+" : ""}{formatQty(deviation)} {unit}</Text>
                                    </Text>
                                  </View>

                                  {/* Progress bar represent actual vs target */}
                                  <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceContainerLow }]}>
                                    <View
                                      style={[
                                        styles.progressBarFill,
                                        {
                                          width: `${progressPercent}%`,
                                          backgroundColor: deviationColor,
                                        }
                                      ]}
                                    />
                                  </View>
                                </View>
                              );
                            })
                          ) : (
                            <View style={styles.noMaterialsContainer}>
                              <Text style={[styles.noMaterialsText, { color: colors.outline }]}>
                                No material consumption data available
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackGap,
    paddingBottom: 100, // Adjusted to prevent overlap with floating bottom tab
  },
  plantCard: {
    marginBottom: Spacing.stackGap,
    borderRadius: 16,
    padding: Spacing.cardPadding - 4,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  plantInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  plantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  plantAvatarText: {
    fontSize: 20,
    fontWeight: "700",
  },
  plantTextDetails: {
    flex: 1,
    marginLeft: 12,
  },
  plantLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  plantName: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 1,
  },
  searchContainer: {
    marginBottom: Spacing.stackGap,
    borderWidth: 1,
    borderColor: '#E6E8E8',
    borderRadius: 10,
  },
  listContainer: {
    gap: Spacing.stackGap,
  },
  customerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.cardPadding - 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  customerAvatarText: {
    fontSize: 16,
    fontWeight: "700",
  },
  customerMeta: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  customerTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  metaBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  expandIconWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  badgesOverviewRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  expandedArea: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  expandedStatsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  statsCard: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statsLabel: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statsValue: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  materialSection: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  materialHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
  },
  materialTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  materialList: {
    padding: 10,
    gap: 12,
  },
  materialRow: {
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  materialRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  materialName: {
    fontSize: 12,
    fontWeight: "700",
  },
  deviationBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  deviationBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  materialQuantities: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  qtyLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  qtyValue: {
    fontWeight: "700",
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    width: "100%",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  noMaterialsContainer: {
    padding: 12,
    alignItems: "center",
  },
  noMaterialsText: {
    fontSize: 12,
    textAlign: "center",
  },
  stateWrapper: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stateText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
});

export interface CustomerItem {
  id: string;
  name: string;
  totalPurchase: number;
  pendingAmount: number;
}

export const DUMMY_CUSTOMERS: CustomerItem[] = [
  { id: '1', name: 'Loading...', totalPurchase: 0, pendingAmount: 0 }
];