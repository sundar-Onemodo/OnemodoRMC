import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { AppHeader } from "@/components/ui/app-header";
import { Colors } from "@/constants/theme";
import { RootState } from "@/store/store";
import {
  Feather,
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import axios from "axios";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

export interface StockItem {
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

export type StatusFilterType = "all" | "low" | "instock" | "out";
export type CategoryFilterType = "all" | "cement" | "aggregate" | "sand" | "admixture" | "flyash";

// Classify product type for visual cues & icons
function getProductCategory(productName: string) {
  const name = (productName || "").toLowerCase();
  if (
    name.includes("cement") ||
    name.includes("opc") ||
    name.includes("ppc") ||
    name.includes("psc") ||
    name.includes("slag")
  ) {
    return {
      type: "cement",
      label: "Cement",
      icon: "warehouse",
      iconFamily: "FontAwesome5",
      color: "#2563EB",
      bg: "#EFF6FF",
    };
  }
  if (
    name.includes("aggregate") ||
    name.includes("10mm") ||
    name.includes("20mm") ||
    name.includes("40mm") ||
    name.includes("jelly") ||
    name.includes("gravel")
  ) {
    return {
      type: "aggregate",
      label: "Aggregates",
      icon: "cubes",
      iconFamily: "FontAwesome5",
      color: "#D97706",
      bg: "#FFFBEB",
    };
  }
  if (
    name.includes("sand") ||
    name.includes("m-sand") ||
    name.includes("msand") ||
    name.includes("fine")
  ) {
    return {
      type: "sand",
      label: "Fine Sand",
      icon: "hourglass-half",
      iconFamily: "FontAwesome5",
      color: "#059669",
      bg: "#ECFDF5",
    };
  }
  if (
    name.includes("admixture") ||
    name.includes("chemical") ||
    name.includes("plasticizer") ||
    name.includes("retarder") ||
    name.includes("accelerator")
  ) {
    return {
      type: "admixture",
      label: "Admixture",
      icon: "flask",
      iconFamily: "FontAwesome5",
      color: "#8B5CF6",
      bg: "#FAF5FF",
    };
  }
  if (
    name.includes("flyash") ||
    name.includes("fly ash") ||
    name.includes("silica") ||
    name.includes("ggbs") ||
    name.includes("ash")
  ) {
    return {
      type: "flyash",
      label: "Fly Ash / Slag",
      icon: "layer-group",
      iconFamily: "FontAwesome5",
      color: "#475569",
      bg: "#F1F5F9",
    };
  }
  return {
    type: "other",
    label: "Raw Material",
    icon: "box",
    iconFamily: "FontAwesome5",
    color: "#063b89",
    bg: "#EFF6FF",
  };
}

export default function StockDetailsScreen() {
  const { token, plant_id: plantId, plant_name: plantName } = useSelector(
    (state: RootState) => state.auth,
  );
  const { startDate, endDate } = useSelector(
    (state: RootState) => state.dateFilter,
  );
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];

  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("all");
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilterType>("all");

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
      fetchStockDetailsAPI();
    }
  }, [token, plantId, startDate, endDate]);

  const fetchStockDetailsAPI = async (isSilent = false) => {
    if (!token) return;

    try {
      if (!isSilent) setIsLoading(true);
      const trimToken = token.includes("|") ? token.split("|")[1] : token;
      const targetPlantId = plantId || 1;

      const res = await axios.get(
        `${baseURL}/stock-details?plant_id=${targetPlantId}&from_date=${startDate}&to_date=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${trimToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      setStockData(res.data?.data || []);
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

  // KPI Calculations
  const { totalItems, lowStockCount, outOfStockCount, healthyCount, healthPercentage } =
    useMemo(() => {
      let low = 0;
      let out = 0;
      let healthy = 0;

      stockData.forEach((item) => {
        const isOut =
          item.current_stock.qty === 0 || !item.stock_status.in_stock;
        if (isOut) {
          out++;
        } else if (item.stock_status.below_alert) {
          low++;
        } else {
          healthy++;
        }
      });

      const total = stockData.length;
      const pct = total > 0 ? Math.round((healthy / total) * 100) : 100;

      return {
        totalItems: total,
        lowStockCount: low,
        outOfStockCount: out,
        healthyCount: healthy,
        healthPercentage: pct,
      };
    }, [stockData]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return stockData.filter((item) => {
      // 1. Search Query
      const query = searchQuery.trim().toLowerCase();
      if (query !== "") {
        const matchesName = (item.product_name || "")
          .toLowerCase()
          .includes(query);
        const matchesCode = (item.product_code || "")
          .toLowerCase()
          .includes(query);
        if (!matchesName && !matchesCode) return false;
      }

      // 2. Status Filter
      const isOut =
        item.current_stock.qty === 0 || !item.stock_status.in_stock;
      if (statusFilter === "low" && (!item.stock_status.below_alert || isOut)) {
        return false;
      }
      if (
        statusFilter === "instock" &&
        (!item.stock_status.in_stock || item.stock_status.below_alert)
      ) {
        return false;
      }
      if (statusFilter === "out" && !isOut) {
        return false;
      }

      // 3. Category Filter
      if (categoryFilter !== "all") {
        const cat = getProductCategory(item.product_name);
        if (cat.type !== categoryFilter) return false;
      }

      return true;
    });
  }, [stockData, searchQuery, statusFilter, categoryFilter]);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* 1. Executive Inventory Health Hero Card */}
      <View style={styles.heroHealthCard}>
        {/* Top Header of Hero */}
        <View style={styles.heroTopRow}>
          <View style={styles.heroTitleWrap}>
            <View style={styles.siloIconBadge}>
              <MaterialCommunityIcons
                name="silo"
                size={20}
                color="#FFFFFF"
              />
            </View>
            <View>
              <Text style={styles.heroTitleText}>Silo & Raw Materials</Text>
              <Text style={styles.heroSubtitleText}>
                {plantName || "Ready Mix Concrete Facility"}
              </Text>
            </View>
          </View>

          <View style={styles.healthScoreBadge}>
            <Ionicons name="shield-checkmark" size={13} color="#10B981" />
            <Text style={styles.healthScoreText}>{healthPercentage}% In Stock</Text>
          </View>
        </View>

        {/* 3 Interactive KPI Columns */}
        <View style={styles.heroKpiRow}>
          {/* Total SKUs */}
          <TouchableOpacity
            style={[
              styles.heroKpiCol,
              statusFilter === "all" && styles.heroKpiColActive,
            ]}
            onPress={() => setStatusFilter("all")}
            activeOpacity={0.8}
          >
            <Text style={styles.heroKpiNumber}>{totalItems}</Text>
            <Text style={styles.heroKpiLabel}>Total SKUs</Text>
          </TouchableOpacity>

          <View style={styles.heroKpiDivider} />

          {/* Low Stock */}
          <TouchableOpacity
            style={[
              styles.heroKpiCol,
              statusFilter === "low" && styles.heroKpiColActiveLow,
            ]}
            onPress={() =>
              setStatusFilter((prev) => (prev === "low" ? "all" : "low"))
            }
            activeOpacity={0.8}
          >
            <View style={styles.kpiValueWithDot}>
              {lowStockCount > 0 && <View style={styles.amberWarningDot} />}
              <Text
                style={[
                  styles.heroKpiNumber,
                  lowStockCount > 0 && { color: "#FBBF24" },
                ]}
              >
                {lowStockCount}
              </Text>
            </View>
            <Text style={styles.heroKpiLabel}>Low Alert</Text>
          </TouchableOpacity>

          <View style={styles.heroKpiDivider} />

          {/* Out of Stock */}
          <TouchableOpacity
            style={[
              styles.heroKpiCol,
              statusFilter === "out" && styles.heroKpiColActiveOut,
            ]}
            onPress={() =>
              setStatusFilter((prev) => (prev === "out" ? "all" : "out"))
            }
            activeOpacity={0.8}
          >
            <View style={styles.kpiValueWithDot}>
              {outOfStockCount > 0 && <View style={styles.redAlertDot} />}
              <Text
                style={[
                  styles.heroKpiNumber,
                  outOfStockCount > 0 && { color: "#F87171" },
                ]}
              >
                {outOfStockCount}
              </Text>
            </View>
            <Text style={styles.heroKpiLabel}>Out of Stock</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Modern Search Bar */}
      <View style={styles.searchBarBox}>
        <Ionicons name="search" size={18} color="#64748B" />
        <TextInput
          style={styles.searchTextInput}
          placeholder="Search materials by name or code..."
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

      {/* 3. Status Segmented Tabs */}
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            statusFilter === "all" && styles.segmentBtnActive,
          ]}
          onPress={() => setStatusFilter("all")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.segmentBtnText,
              statusFilter === "all" && styles.segmentBtnTextActive,
            ]}
          >
            All ({totalItems})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            statusFilter === "instock" && styles.segmentBtnActive,
          ]}
          onPress={() => setStatusFilter("instock")}
          activeOpacity={0.7}
        >
          <View style={[styles.dotPill, { backgroundColor: "#10B981" }]} />
          <Text
            style={[
              styles.segmentBtnText,
              statusFilter === "instock" && styles.segmentBtnTextActive,
            ]}
          >
            Healthy ({healthyCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            statusFilter === "low" && styles.segmentBtnActive,
          ]}
          onPress={() => setStatusFilter("low")}
          activeOpacity={0.7}
        >
          <View style={[styles.dotPill, { backgroundColor: "#F59E0B" }]} />
          <Text
            style={[
              styles.segmentBtnText,
              statusFilter === "low" && styles.segmentBtnTextActive,
            ]}
          >
            Low ({lowStockCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            statusFilter === "out" && styles.segmentBtnActive,
          ]}
          onPress={() => setStatusFilter("out")}
          activeOpacity={0.7}
        >
          <View style={[styles.dotPill, { backgroundColor: "#EF4444" }]} />
          <Text
            style={[
              styles.segmentBtnText,
              statusFilter === "out" && styles.segmentBtnTextActive,
            ]}
          >
            Out of Stock ({outOfStockCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. Horizontal Category Quick Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {[
          { id: "all", label: "All Types" },
          { id: "cement", label: "Cement" },
          { id: "aggregate", label: "Aggregates" },
          { id: "sand", label: "Sand" },
          { id: "admixture", label: "Admixtures" },
          { id: "flyash", label: "Fly Ash" },
        ].map((cat) => {
          const isCatActive = categoryFilter === cat.id;
          return (
            <TouchableOpacity
              key={`cat-${cat.id}`}
              style={[
                styles.categoryChip,
                isCatActive && styles.categoryChipActive,
              ]}
              onPress={() => setCategoryFilter(cat.id as any)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  isCatActive && styles.categoryChipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderStockCard = ({ item }: { item: StockItem }) => {
    const isOutOfStock =
      item.current_stock.qty === 0 || !item.stock_status.in_stock;
    const isBelowAlert = item.stock_status.below_alert && !isOutOfStock;

    const cat = getProductCategory(item.product_name);
    const currQty = Number(item.current_stock?.qty || 0);
    const alertQty = Number(item.stock_alert?.qty || 0);
    const unit = item.current_stock?.unit || "MT";

    // Proportional Gauge Calculation
    const maxRef = Math.max(alertQty * 2, currQty, 1);
    const fillPercent = Math.min(Math.max(0, (currQty / maxRef) * 100), 100);
    const thresholdPercent = Math.min(
      Math.max(0, (alertQty / maxRef) * 100),
      100,
    );
    const netVariance = currQty - alertQty;

    // Status Styling
    let statusLabel = "IN STOCK";
    let statusBg = "#ECFDF5";
    let statusBorder = "#A7F3D0";
    let statusTextColor = "#059669";
    let statusIcon: any = "checkmark-circle";

    if (isOutOfStock) {
      statusLabel = "OUT OF STOCK";
      statusBg = "#FEF2F2";
      statusBorder = "#FECACA";
      statusTextColor = "#DC2626";
      statusIcon = "close-circle";
    } else if (isBelowAlert) {
      statusLabel = "LOW ALERT";
      statusBg = "#FFFBEB";
      statusBorder = "#FDE68A";
      statusTextColor = "#D97706";
      statusIcon = "warning";
    }

    return (
      <View style={styles.stockItemCard}>
        {/* Top Header: Category Icon + Product Name & Code + Status Badge */}
        <View style={styles.cardHeaderRow}>
          <View style={[styles.categoryIconWrap, { backgroundColor: cat.bg }]}>
            <FontAwesome5
              name={cat.icon as any}
              size={18}
              color={cat.color}
            />
          </View>

          <View style={styles.productTitleArea}>
            <Text style={styles.productTitleText} numberOfLines={2}>
              {item.product_name}
            </Text>
            <View style={styles.productCodeBadge}>
              <Text style={styles.productCodeText}>
                {item.product_code || "SKU"}
              </Text>
              <Text style={styles.categoryTagDot}>•</Text>
              <Text style={styles.categoryTagLabel}>{cat.label}</Text>
            </View>
          </View>

          <View
            style={[
              styles.statusBadgePill,
              { backgroundColor: statusBg, borderColor: statusBorder },
            ]}
          >
            <Ionicons name={statusIcon} size={12} color={statusTextColor} />
            <Text
              style={[styles.statusBadgePillText, { color: statusTextColor }]}
            >
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* Centerpiece: Quantity & Comparison Box */}
        <View style={styles.quantityComparisonBox}>
          {/* Main Available Quantity */}
          <View style={styles.mainQuantityCol}>
            <Text style={styles.comparisonHeaderLabel}>AVAILABLE STOCK</Text>
            <View style={styles.bigQtyRow}>
              <Text
                style={[
                  styles.bigQtyText,
                  isOutOfStock && { color: "#DC2626" },
                  isBelowAlert && { color: "#D97706" },
                ]}
              >
                {currQty.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}
              </Text>
              <View style={styles.unitPill}>
                <Text style={styles.unitPillText}>{unit}</Text>
              </View>
            </View>
          </View>

          <View style={styles.quantityBoxDivider} />

          {/* Alert Threshold & Buffer Metrics */}
          <View style={styles.comparisonRightCol}>
            <View style={styles.miniMetricRow}>
              <Text style={styles.miniMetricLabel}>Alert Limit:</Text>
              <Text style={styles.miniMetricValue}>
                {alertQty.toLocaleString("en-IN", { maximumFractionDigits: 2 })}{" "}
                {unit}
              </Text>
            </View>

            <View style={styles.miniMetricRow}>
              <Text style={styles.miniMetricLabel}>Net Buffer:</Text>
              <Text
                style={[
                  styles.miniMetricValue,
                  netVariance >= 0
                    ? { color: "#059669" }
                    : { color: "#DC2626" },
                ]}
              >
                {netVariance >= 0
                  ? `+${netVariance.toFixed(1)} ${unit}`
                  : `${netVariance.toFixed(1)} ${unit}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Proportional Silo Capacity Gauge Bar */}
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeTrack}>
            <View
              style={[
                styles.gaugeFill,
                {
                  width: `${fillPercent}%`,
                  backgroundColor: isOutOfStock
                    ? "#EF4444"
                    : isBelowAlert
                      ? "#F59E0B"
                      : "#10B981",
                },
              ]}
            />
            {alertQty > 0 && (
              <View
                style={[
                  styles.gaugeMarker,
                  { left: `${thresholdPercent}%` },
                ]}
              />
            )}
          </View>

          <View style={styles.gaugeLabelsRow}>
            <Text style={styles.gaugeFootnoteText}>0 {unit}</Text>
            <View style={styles.gaugeThresholdRow}>
              <View style={styles.gaugeLegendMarker} />
              <Text style={styles.gaugeThresholdText}>
                Safety Point: {alertQty} {unit}
              </Text>
            </View>
          </View>
        </View>

        {/* Warning strip if low alert */}
        {isBelowAlert && (
          <View style={styles.alertWarningStrip}>
            <Ionicons name="warning-outline" size={15} color="#D97706" />
            <Text style={styles.alertWarningStripText}>
              Current inventory has dropped below the {alertQty} {unit} minimum
              threshold. Procurement recommended.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBox}>
          <MaterialCommunityIcons
            name="package-variant-closed"
            size={48}
            color="#94A3B8"
          />
        </View>
        <Text style={styles.emptyTitle}>No Matching Stock Found</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery
            ? `No raw materials match "${searchQuery}". Please verify product name or code.`
            : "No items match your selected status and category filters."}
        </Text>
        {(searchQuery.length > 0 ||
          statusFilter !== "all" ||
          categoryFilter !== "all") && (
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setCategoryFilter("all");
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.resetBtnText}>Clear All Filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <AppHeader
        title="Stock & Inventory"
        showMenu={true}
      />

      <View style={styles.mainContainer}>
        {isLoading && stockData.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#063b89" />
            <Text style={styles.loadingText}>Syncing inventory data...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.product_id.toString()}
            renderItem={renderStockCard}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
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
  mainContainer: {
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
  headerContainer: {
    marginBottom: 16,
    gap: 12,
  },

  // 1. Executive Hero Card
  heroHealthCard: {
    backgroundColor: "#0A2540",
    borderRadius: 20,
    padding: 16,
    gap: 16,
    shadowColor: "#0A2540",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  siloIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroSubtitleText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "500",
    marginTop: 1,
  },
  healthScoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  healthScoreText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#34D399",
  },
  heroKpiRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  heroKpiCol: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroKpiColActive: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  heroKpiColActiveLow: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
  },
  heroKpiColActiveOut: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  kpiValueWithDot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  amberWarningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F59E0B",
  },
  redAlertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
  },
  heroKpiNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroKpiLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  heroKpiDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },

  // 4. Search Bar
  searchBarBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    paddingVertical: 0,
  },

  // 5. Segmented Tabs
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 5,
  },
  segmentBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  segmentBtnTextActive: {
    color: "#0F172A",
    fontWeight: "700",
  },
  dotPill: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // 6. Category Quick Filter Scroll
  categoryScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryChipActive: {
    backgroundColor: "#063b89",
    borderColor: "#063b89",
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // Stock Card
  stockItemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  productTitleArea: {
    flex: 1,
    gap: 3,
  },
  productTitleText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 20,
  },
  productCodeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  productCodeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  categoryTagDot: {
    fontSize: 10,
    color: "#94A3B8",
  },
  categoryTagLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  statusBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgePillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // Quantity & Comparison Box
  quantityComparisonBox: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    alignItems: "center",
  },
  mainQuantityCol: {
    flex: 1.2,
    gap: 2,
  },
  comparisonHeaderLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  bigQtyRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  bigQtyText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  unitPill: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  unitPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },
  quantityBoxDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 10,
  },
  comparisonRightCol: {
    flex: 1,
    gap: 4,
  },
  miniMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  miniMetricLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
  },
  miniMetricValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
  },

  // Proportional Silo Capacity Gauge
  gaugeContainer: {
    gap: 4,
  },
  gaugeTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
    position: "relative",
  },
  gaugeFill: {
    height: "100%",
    borderRadius: 4,
  },
  gaugeMarker: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2.5,
    backgroundColor: "#D97706",
  },
  gaugeLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gaugeFootnoteText: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
  },
  gaugeThresholdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  gaugeLegendMarker: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#D97706",
  },
  gaugeThresholdText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
  },

  // Warning Banner
  alertWarningStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  alertWarningStripText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#B45309",
    lineHeight: 16,
  },

  // Loading & Empty States
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
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#063b89",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
