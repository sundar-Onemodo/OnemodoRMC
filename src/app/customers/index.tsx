import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { AppHeader } from "@/components/ui/app-header";
import { Colors } from "@/constants/theme";
import { RootState } from "@/store/store";
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import axios from "axios";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

export interface MaterialConsumption {
  material_name: string;
  traget_qty?: { qty: number; unit: string };
  actual_qty?: { qty: number; unit: string };
  deviation_qty?: { qty: number; unit: string };
}

export interface CustomerDetailItem {
  customer_id?: number | string;
  customer_name: string;
  site_location?: string;
  mix_design?: {
    design_name?: string;
    name?: string;
  };
  grade?: string;
  total_dispatch_count?: {
    qty: number;
    unit: string;
  };
  material_consumption?: MaterialConsumption[];
}

export type CustomerFilterType = "all" | "dispatched" | "deviated";

export default function CustomerListScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];

  const { token, plant_name: plantName, plant_id } = useSelector(
    (state: RootState) => state.auth,
  );
  const { startDate, endDate } = useSelector(
    (state: RootState) => state.dateFilter,
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [customerData, setCustomerData] = useState<CustomerDetailItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterType, setFilterType] = useState<CustomerFilterType>("all");
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#063b89");
      }
    }, []),
  );

  useEffect(() => {
    if (token) {
      fetchCustomerDetailsAPI();
    }
  }, [token, plant_id, startDate, endDate]);

  const fetchCustomerDetailsAPI = async (isSilent = false) => {
    if (!token) return;

    try {
      const trimToken = token.includes("|") ? token.split("|")[1] : token;
      if (!isSilent) setIsLoading(true);

      const res = await axios.get(
        `${baseURL}/customer-details?plant_id=${plant_id}&from_date=${startDate}&to_date=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${trimToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      setCustomerData(res.data?.data || []);
    } catch (error: any) {
      console.log("Error fetching customer details:", error?.response?.data || error?.message);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCustomerDetailsAPI(true);
    setRefreshing(false);
  };

  const toggleCustomerExpand = (rowKey: string) => {
    setExpandedRowKey((prevKey) => (prevKey === rowKey ? null : rowKey));
  };

  const formatQty = (value: any) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "0";
    const fixedNum = parseFloat(num.toFixed(2));
    return fixedNum.toLocaleString("en-IN");
  };

  const getDeviationColor = (deviation: number) => {
    if (deviation > 0) return "#059669"; // green
    if (deviation < 0) return "#DC2626"; // red
    return "#D97706"; // amber
  };

  // KPI Computations
  const { totalCustomers, totalTrips, totalMaterialsTracked } = useMemo(() => {
    let trips = 0;
    let materials = 0;

    customerData.forEach((c) => {
      trips += Number(c.total_dispatch_count?.qty || 0);
      materials += c.material_consumption?.length || 0;
    });

    return {
      totalCustomers: customerData.length,
      totalTrips: trips,
      totalMaterialsTracked: materials,
    };
  }, [customerData]);

  // Filtered dataset
  const filteredCustomerData = useMemo(() => {
    return customerData.filter((item) => {
      // 1. Search Query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        const name = (item.customer_name || "").toLowerCase();
        const loc = (item.site_location || "").toLowerCase();
        const design = (
          item.mix_design?.design_name ||
          item.mix_design?.name ||
          ""
        ).toLowerCase();
        const grade = (item.grade || "").toLowerCase();

        const matches =
          name.includes(query) ||
          loc.includes(query) ||
          design.includes(query) ||
          grade.includes(query);

        if (!matches) return false;
      }

      // 2. Filter Type
      if (filterType === "dispatched") {
        return Number(item.total_dispatch_count?.qty || 0) > 0;
      }
      if (filterType === "deviated") {
        return (item.material_consumption || []).some(
          (m) => Math.abs(Number(m.deviation_qty?.qty || 0)) > 0,
        );
      }

      return true;
    });
  }, [customerData, searchQuery, filterType]);

  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* Plant Executive Banner */}
      <View style={styles.plantBanner}>
        <View style={styles.plantBannerLeft}>
          <View style={styles.plantAvatar}>
            <Text style={styles.plantAvatarText}>
              {plantName?.charAt(0).toUpperCase() || "P"}
            </Text>
          </View>
          <View style={styles.plantTexts}>
            <View style={styles.plantBadgeRow}>
              <Text style={styles.plantCategoryLabel}>OPERATIONAL PLANT</Text>
              <View style={styles.plantTypePill}>
                <Text style={styles.plantTypePillText}>RMC</Text>
              </View>
            </View>
            <Text style={styles.plantTitle} numberOfLines={1}>
              {plantName || "Main Plant"}
            </Text>
          </View>
        </View>

        <View style={styles.plantStatsBadge}>
          <Text style={styles.plantStatsNum}>{totalCustomers}</Text>
          <Text style={styles.plantStatsLabel}>Clients</Text>
        </View>
      </View>

      {/* KPI 3-Column Highlights */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiBox}>
          <View style={[styles.kpiIconWrap, { backgroundColor: "#EFF6FF" }]}>
            <Ionicons name="people" size={16} color="#2563EB" />
          </View>
          <View>
            <Text style={styles.kpiValueText}>{totalCustomers}</Text>
            <Text style={styles.kpiLabelText}>Total Clients</Text>
          </View>
        </View>

        <View style={styles.kpiDivider} />

        <View style={styles.kpiBox}>
          <View style={[styles.kpiIconWrap, { backgroundColor: "#ECFDF5" }]}>
            <Ionicons name="bus" size={16} color="#059669" />
          </View>
          <View>
            <Text style={styles.kpiValueText}>{totalTrips}</Text>
            <Text style={styles.kpiLabelText}>Dispatches</Text>
          </View>
        </View>

        <View style={styles.kpiDivider} />

        <View style={styles.kpiBox}>
          <View style={[styles.kpiIconWrap, { backgroundColor: "#FFFBEB" }]}>
            <Ionicons name="flask" size={16} color="#D97706" />
          </View>
          <View>
            <Text style={styles.kpiValueText}>{totalMaterialsTracked}</Text>
            <Text style={styles.kpiLabelText}>Materials</Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer, delivery site, mix design..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabsRow}>
        <TouchableOpacity
          style={[
            styles.filterPill,
            filterType === "all" && styles.filterPillActive,
          ]}
          onPress={() => setFilterType("all")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.filterPillText,
              filterType === "all" && styles.filterPillTextActive,
            ]}
          >
            All Clients ({totalCustomers})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterPill,
            filterType === "dispatched" && styles.filterPillActive,
          ]}
          onPress={() => setFilterType("dispatched")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.filterPillText,
              filterType === "dispatched" && styles.filterPillTextActive,
            ]}
          >
            With Dispatches
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterPill,
            filterType === "deviated" && styles.filterPillActive,
          ]}
          onPress={() => setFilterType("deviated")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.filterPillText,
              filterType === "deviated" && styles.filterPillTextActive,
            ]}
          >
            Material Deviations
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCustomerCard = ({
    item,
    index,
  }: {
    item: CustomerDetailItem;
    index: number;
  }) => {
    const rowKey = `${item.customer_id || "cust"}-${index}`;
    const isExpand = expandedRowKey === rowKey;

    const tripsCount = Number(item.total_dispatch_count?.qty || 0);
    const tripsUnit = item.total_dispatch_count?.unit || "Trips";
    const mixName =
      item.mix_design?.design_name ||
      item.mix_design?.name ||
      "Standard Mix";
    const gradeName = item.grade || "N/A";
    const materialsCount = item.material_consumption?.length || 0;

    // Pick avatar color based on name initial
    const initialChar = (item.customer_name?.charAt(0) || "C").toUpperCase();
    const avatarPalette = [
      { bg: "#EFF6FF", color: "#2563EB" },
      { bg: "#F0FDF4", color: "#16A34A" },
      { bg: "#FAF5FF", color: "#9333EA" },
      { bg: "#FFF7ED", color: "#EA580C" },
      { bg: "#F0FDFA", color: "#0D9488" },
    ];
    const colorIndex =
      (initialChar.charCodeAt(0) || 0) % avatarPalette.length;
    const { bg: avatarBg, color: avatarColor } = avatarPalette[colorIndex];

    return (
      <View
        style={[
          styles.customerCard,
          isExpand && styles.customerCardActive,
        ]}
      >
        <TouchableOpacity
          style={styles.cardHeaderTouchable}
          onPress={() => toggleCustomerExpand(rowKey)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.customerAvatar, { backgroundColor: avatarBg }]}>
              <Text style={[styles.customerAvatarText, { color: avatarColor }]}>
                {initialChar}
              </Text>
            </View>

            <View style={styles.customerMeta}>
              <Text style={styles.customerTitle} numberOfLines={1}>
                {item.customer_name}
              </Text>

              <View style={styles.siteLocationRow}>
                <Ionicons name="location-sharp" size={13} color="#EF4444" />
                <Text style={styles.siteLocationText} numberOfLines={1}>
                  {item.site_location || "Main Delivery Site"}
                </Text>
              </View>
            </View>

            <View style={styles.expandHeaderRight}>
              <View style={styles.tripBadge}>
                <Ionicons name="bus-outline" size={12} color="#059669" />
                <Text style={styles.tripBadgeText}>
                  {tripsCount} {tripsUnit}
                </Text>
              </View>

              <Ionicons
                name={isExpand ? "chevron-up-circle" : "chevron-down-circle"}
                size={22}
                color={isExpand ? "#063b89" : "#94A3B8"}
              />
            </View>
          </View>

          {/* Quick Specifications Pills (Always Visible) */}
          <View style={styles.specsOverviewRow}>
            <View style={styles.specBadge}>
              <Feather name="layers" size={12} color="#063b89" />
              <Text style={styles.specBadgeText}>{mixName}</Text>
            </View>

            {gradeName !== "N/A" && (
              <View style={styles.gradeBadge}>
                <Text style={styles.gradeBadgeText}>{gradeName}</Text>
              </View>
            )}

            <View style={styles.materialsCountPill}>
              <Ionicons name="flask-outline" size={12} color="#64748B" />
              <Text style={styles.materialsCountText}>
                {materialsCount} {materialsCount === 1 ? "Material" : "Materials"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Expanded Content Area */}
        {isExpand && (
          <View style={styles.expandedContent}>
            {/* 3-Column Specifications Grid */}
            <View style={styles.expandedSpecsGrid}>
              <View style={styles.specMetricCard}>
                <Text style={styles.specMetricLabel}>GRADE</Text>
                <Text style={styles.specMetricValue}>{gradeName}</Text>
              </View>

              <View style={styles.specMetricCard}>
                <Text style={styles.specMetricLabel}>DESIGN NAME</Text>
                <Text style={styles.specMetricValue} numberOfLines={1}>
                  {mixName}
                </Text>
              </View>

              <View style={styles.specMetricCard}>
                <Text style={styles.specMetricLabel}>DISPATCHES</Text>
                <Text style={styles.specMetricValue}>
                  {tripsCount} {tripsUnit}
                </Text>
              </View>
            </View>

            {/* Material Consumption Breakdown Card */}
            <View style={styles.materialSection}>
              <View style={styles.materialHeader}>
                <Ionicons
                  name="clipboard-outline"
                  size={15}
                  color="#063b89"
                />
                <Text style={styles.materialHeaderTitle}>
                  Material Consumption Breakdown
                </Text>
                <View style={styles.materialCountBadge}>
                  <Text style={styles.materialCountBadgeText}>
                    {materialsCount}
                  </Text>
                </View>
              </View>

              <View style={styles.materialList}>
                {item.material_consumption &&
                item.material_consumption.length > 0 ? (
                  item.material_consumption.map((mat, idx) => {
                    const targetQty = mat.traget_qty?.qty || 0;
                    const actualQty = mat.actual_qty?.qty || 0;
                    const deviation = mat.deviation_qty?.qty || 0;
                    const unit = mat.actual_qty?.unit || "KGS";
                    const deviationColor = getDeviationColor(deviation);

                    const deviationPercent =
                      targetQty !== 0
                        ? ((deviation / targetQty) * 100).toFixed(1)
                        : "0";
                    const absPercent = Math.abs(
                      parseFloat(deviationPercent),
                    );

                    const ratio =
                      targetQty > 0 ? actualQty / targetQty : 0;
                    const progressPercent = Math.min(ratio * 100, 100);

                    return (
                      <View
                        key={`mat-${idx}`}
                        style={[
                          styles.materialItem,
                          idx ===
                            (item.material_consumption?.length || 0) - 1 && {
                            borderBottomWidth: 0,
                            paddingBottom: 0,
                          },
                        ]}
                      >
                        {/* Material Name & Deviation Pill */}
                        <View style={styles.materialItemHeader}>
                          <Text style={styles.materialNameText}>
                            {mat.material_name}
                          </Text>

                          <View
                            style={[
                              styles.deviationPill,
                              {
                                backgroundColor: `${deviationColor}15`,
                                borderColor: `${deviationColor}33`,
                              },
                            ]}
                          >
                            <Ionicons
                              name={
                                deviation > 0
                                  ? "trending-up"
                                  : deviation < 0
                                    ? "trending-down"
                                    : "checkmark-circle"
                              }
                              size={12}
                              color={deviationColor}
                            />
                            <Text
                              style={[
                                styles.deviationPillText,
                                { color: deviationColor },
                              ]}
                            >
                              {absPercent}%{" "}
                              {deviation > 0
                                ? "Over"
                                : deviation < 0
                                  ? "Under"
                                  : "Exact"}
                            </Text>
                          </View>
                        </View>

                        {/* Quantitative Breakdown: Target / Actual / Dev */}
                        <View style={styles.quantitiesGrid}>
                          <View style={styles.qtyBox}>
                            <Text style={styles.qtyBoxLabel}>Target</Text>
                            <Text style={styles.qtyBoxValue}>
                              {formatQty(targetQty)} {unit}
                            </Text>
                          </View>

                          <View style={styles.qtyBox}>
                            <Text style={styles.qtyBoxLabel}>Actual</Text>
                            <Text
                              style={[
                                styles.qtyBoxValue,
                                { color: "#063b89" },
                              ]}
                            >
                              {formatQty(actualQty)} {unit}
                            </Text>
                          </View>

                          <View style={styles.qtyBox}>
                            <Text style={styles.qtyBoxLabel}>Variance</Text>
                            <Text
                              style={[
                                styles.qtyBoxValue,
                                { color: deviationColor },
                              ]}
                            >
                              {deviation > 0 ? "+" : ""}
                              {formatQty(deviation)} {unit}
                            </Text>
                          </View>
                        </View>

                        {/* Visual Progress Bar */}
                        <View style={styles.progressBarTrack}>
                          <View
                            style={[
                              styles.progressBarThumb,
                              {
                                width: `${progressPercent}%`,
                                backgroundColor: deviationColor,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.noMaterialsWrap}>
                    <Ionicons
                      name="cube-outline"
                      size={24}
                      color="#94A3B8"
                    />
                    <Text style={styles.noMaterialsText}>
                      No material consumption data logged for this client
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBg}>
          <Ionicons name="people-outline" size={44} color="#94A3B8" />
        </View>
        <Text style={styles.emptyTitle}>No Client Records Found</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery
            ? `No clients found matching "${searchQuery}". Please check your spelling or search by site location.`
            : "No client records found for the selected date range."}
        </Text>
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => setSearchQuery("")}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.resetButtonText}>Clear Search</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <AppHeader title="Customers" showMenu={true} />

      <View style={styles.contentBody}>
        {isLoading && customerData.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#063b89" />
            <Text style={styles.loadingText}>Syncing client records...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredCustomerData}
            keyExtractor={(item, index) =>
              `${item.customer_id || "cust"}-${index}`
            }
            renderItem={renderCustomerCard}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#063b89"]}
                tintColor="#063b89"
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#063b89",
  },
  contentBody: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  headerSection: {
    marginBottom: 16,
    gap: 12,
  },

  // Plant Overview Banner
  plantBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  plantBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  plantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  plantAvatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#063b89",
  },
  plantTexts: {
    flex: 1,
    gap: 2,
  },
  plantBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  plantCategoryLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  plantTypePill: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  plantTypePillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2563EB",
  },
  plantTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  plantStatsBadge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  plantStatsNum: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  plantStatsLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
  },

  // KPI 3-Column Box
  kpiRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  kpiBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValueText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  kpiLabelText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
  },
  kpiDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#F1F5F9",
    marginHorizontal: 4,
  },

  // Search Container
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    paddingVertical: 0,
  },

  // Filter Tabs
  filterTabsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  filterPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterPillActive: {
    backgroundColor: "#063b89",
    borderColor: "#063b89",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // Customer Card
  customerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  customerCardActive: {
    borderColor: "#BFDBFE",
    backgroundColor: "#FFFFFF",
  },
  cardHeaderTouchable: {
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  customerAvatarText: {
    fontSize: 18,
    fontWeight: "800",
  },
  customerMeta: {
    flex: 1,
    gap: 3,
  },
  customerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 20,
  },
  siteLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  siteLocationText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    flex: 1,
  },
  expandHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tripBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tripBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },

  // Specs Overview Row
  specsOverviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    paddingTop: 2,
  },
  specBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  specBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },
  gradeBadge: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gradeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  materialsCountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
  },
  materialsCountText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
  },

  // Expanded Content
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    padding: 14,
    backgroundColor: "#FAFCFF",
    gap: 12,
  },
  expandedSpecsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  specMetricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  specMetricLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  specMetricValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },

  // Material Section
  materialSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  materialHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 8,
  },
  materialHeaderTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  materialCountBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  materialCountBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2563EB",
  },
  materialList: {
    padding: 12,
    gap: 14,
  },
  materialItem: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 8,
  },
  materialItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  materialNameText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  deviationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  deviationPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  quantitiesGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  qtyBox: {
    gap: 2,
  },
  qtyBoxLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#64748B",
  },
  qtyBoxValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "#F1F5F9",
    overflow: "hidden",
  },
  progressBarThumb: {
    height: "100%",
    borderRadius: 3,
  },
  noMaterialsWrap: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  noMaterialsText: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
  },

  // Loading & Empty State
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIconBg: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#063b89",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
