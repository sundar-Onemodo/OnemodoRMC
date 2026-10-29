import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { AppHeader } from "@/components/ui/app-header";
import { Colors } from "@/constants/theme";
import { fetchDropdowns, StatusDropdownOption } from "@/store/dropdownSlice";
import { AppDispatch, RootState } from "@/store/store";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import axios from "axios";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

// ==========================================
// INTERFACES
// ==========================================

export interface SalesOrderProgress {
  ordered_m3?: number;
  batch_count?: number;
  completed_batches?: number;
  cancelled_batches?: number;
  committed_m3?: number;
  dispatched_m3?: number;
  delivered_m3?: number;
  remaining_delivery_m3?: number;
}

export interface SalesOrderItem {
  id: number;
  plant_id?: number;
  customer_po_id?: number | null;
  concrete_pump?: string | null;
  sales_executive_id?: number | null;
  pump_type?: string | null;
  customer_id?: number;
  site_id?: number;
  prefix?: string;
  order_no?: string;
  reference_type?: string | null;
  reference_id?: number | null;
  mix_design_id?: number;
  rate?: number;
  tax_id?: number | null;
  is_tax_inclusive?: boolean;
  total_qty?: string | number;
  produced_qty?: string | number;
  uom_id?: number | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  status: number;
  created_at?: string;
  updated_at?: string;
  pump_rate?: number;
  full_number?: string;
  customer?: {
    id: number;
    legal_name?: string;
    name?: string;
  } | null;
  site?: {
    id: number;
    name?: string;
  } | null;
  mix_design?: {
    id: number;
    design_name?: string;
    name?: string;
    code?: string | null;
  } | null;
  progress?: SalesOrderProgress | null;
  customer_p_o?: any;
}

// ==========================================
// STATUS HELPERS
// ==========================================

export const getSalesOrderStatusMeta = (
  status: number | string | null | undefined,
  statuses?: StatusDropdownOption[],
) => {
  const s = Number(status);
  const found = statuses?.find((x) => Number(x.value) === s);
  switch (s) {
    case 0:
      return {
        label: found?.label || "Draft",
        color: "#D97706",
        bgColor: "#FEF3C7",
        borderColor: "#FDE68A",
        icon: "hourglass-empty" as const,
      };
    case 1:
      return {
        label: found?.label || "Scheduled",
        color: "#2563EB",
        bgColor: "#EFF6FF",
        borderColor: "#BFDBFE",
        icon: "event-available" as const,
      };
    case 2:
      return {
        label: found?.label || "In Progress",
        color: "#0284C7",
        bgColor: "#E0F2FE",
        borderColor: "#BAE6FD",
        icon: "local-shipping" as const,
      };
    case 3:
      return {
        label: found?.label || "Completed",
        color: "#059669",
        bgColor: "#ECFDF5",
        borderColor: "#A7F3D0",
        icon: "check-circle" as const,
      };
    case 4:
      return {
        label: found?.label || "Cancelled",
        color: "#DC2626",
        bgColor: "#FEE2E2",
        borderColor: "#FECACA",
        icon: "cancel" as const,
      };
    default:
      return {
        label: found?.label || `Status ${s}`,
        color: "#64748B",
        bgColor: "#F1F5F9",
        borderColor: "#E2E8F0",
        icon: "help-outline" as const,
      };
  }
};

const formatVolume = (val?: number | string | null): string => {
  if (val === null || val === undefined || val === "") return "0";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) return "0";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const formatRate = (val?: number | string | null): string => {
  if (val === null || val === undefined || val === "") return "₹0";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) return "₹0";
  return "₹" + Math.round(num).toLocaleString("en-IN");
};

// ==========================================
// MAIN SCREEN COMPONENT
// ==========================================

export default function SalesOrderScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];
  const dispatch = useDispatch<AppDispatch>();

  const { salesOrderStatuses } = useSelector(
    (state: RootState) => state.dropdowns,
  );
  const { token, plant_id, user } = useSelector(
    (state: RootState) => state.auth,
  );

  const [orders, setOrders] = useState<SalesOrderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"All" | number>("All");

  const handleBack = useCallback(() => {
    router.replace("/more" as any);
  }, []);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#0F172A");
      }

      const onBackPress = () => {
        handleBack();
        return true;
      };
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, [handleBack]),
  );

  // Fetch dropdowns if not loaded
  useEffect(() => {
    if (token && (!salesOrderStatuses || salesOrderStatuses.length === 0)) {
      dispatch(fetchDropdowns({ token, plant_id }));
    }
  }, [token, plant_id, salesOrderStatuses, dispatch]);

  // Fetch orders from API
  const fetchOrders = useCallback(
    async (isRefresh = false) => {
      if (!token) {
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);

      const effectivePlantId =
        plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;

      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      const cleanToken = token.trim();
      headers["Authorization"] = cleanToken.startsWith("Bearer ")
        ? cleanToken
        : `Bearer ${cleanToken}`;

      if (effectivePlantId !== null && effectivePlantId !== undefined) {
        headers["X-Plant-Id"] = String(effectivePlantId);
      }

      try {
        const res = await axios.get(`${baseURL}/orders`, {
          headers,
          params: {
            page: 1,
            per_page: 50,
            ...(effectivePlantId ? { plant_id: effectivePlantId } : {}),
          },
          timeout: 25000,
        });

        if (res.data?.success && res.data?.data) {
          const apiData = res.data.data;
          const list: SalesOrderItem[] = Array.isArray(apiData.data)
            ? apiData.data
            : Array.isArray(apiData)
              ? apiData
              : [];
          setOrders(list);
        } else if (Array.isArray(res.data?.data)) {
          setOrders(res.data.data);
        } else if (Array.isArray(res.data)) {
          setOrders(res.data);
        } else {
          setOrders([]);
        }
      } catch (err: any) {
        console.warn(
          "[Orders API] Error fetching orders:",
          err?.message || err,
        );
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load sales orders. Please check your connection.";
        setErrorMessage(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, plant_id, user],
  );

  // Trigger load on focus
  useFocusEffect(
    useCallback(() => {
      fetchOrders(false);
    }, [fetchOrders]),
  );

  const onRefresh = useCallback(() => {
    fetchOrders(true);
  }, [fetchOrders]);

  // Status Filter Counts
  const counts = useMemo(() => {
    const res: Record<string, number> = {
      all: orders.length,
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
    };
    orders.forEach((o) => {
      const s = String(o.status);
      res[s] = (res[s] || 0) + 1;
    });
    return res;
  }, [orders]);

  // Overall statistics
  const stats = useMemo(() => {
    let totalOrdered = 0;
    let totalDelivered = 0;
    let totalRemaining = 0;

    orders.forEach((o) => {
      const ord = o.progress?.ordered_m3 ?? Number(o.total_qty ?? 0);
      const del = o.progress?.delivered_m3 ?? Number(o.produced_qty ?? 0);
      const rem = o.progress?.remaining_delivery_m3 ?? Math.max(0, ord - del);

      totalOrdered += isNaN(ord) ? 0 : ord;
      totalDelivered += isNaN(del) ? 0 : del;
      totalRemaining += isNaN(rem) ? 0 : rem;
    });

    return {
      totalOrders: orders.length,
      totalOrdered,
      totalDelivered,
      totalRemaining,
    };
  }, [orders]);

  // Filtered List based on Tab & Search
  const filteredOrders = useMemo(() => {
    let result = orders;

    if (activeTab !== "All") {
      result = result.filter((o) => Number(o.status) === Number(activeTab));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((o) => {
        const orderNo = String(o.order_no || "").toLowerCase();
        const fullNo = String(o.full_number || "").toLowerCase();
        const prefix = String(o.prefix || "").toLowerCase();
        const custName = String(
          o.customer?.legal_name || o.customer?.name || "",
        ).toLowerCase();
        const siteName = String(o.site?.name || "").toLowerCase();
        const mixName = String(
          o.mix_design?.name || o.mix_design?.design_name || "",
        ).toLowerCase();

        return (
          orderNo.includes(q) ||
          fullNo.includes(q) ||
          prefix.includes(q) ||
          custName.includes(q) ||
          siteName.includes(q) ||
          mixName.includes(q)
        );
      });
    }

    return result;
  }, [orders, activeTab, search]);

  // Filter Tabs definition
  const filterTabs: { label: string; value: "All" | number; count: number }[] =
    useMemo(() => {
      return [
        { label: "All", value: "All", count: counts.all },
        { label: "Schedule", value: 1, count: counts["1"] || 0 },
        { label: "Inprogress", value: 2, count: counts["2"] || 0 },
        { label: "Completed", value: 3, count: counts["3"] || 0 },
        { label: "Cancel", value: 4, count: counts["4"] || 0 },
      ];
    }, [counts]);

  // Check if an order is editable according to requirements:
  // "if the user change the status to inprogress in the listshowing on that notg to show edit button we the status is 1 or 0 means they can allow to edit"
  // "if the status change to cancel (4) show edit button on the list when user selected cancel then want to edit that time the status should need to show Schedule,Inprogress"
  const canEditOrder = (status: number) => {
    return status === 0 || status === 1 || status === 4;
  };

  const handleEditPress = (order: SalesOrderItem) => {
    router.push({
      pathname: "/sales-order/editSalesOrderScreen" as any,
      params: {
        admin_order_id: String(order.id),
        orderData: JSON.stringify(order),
      },
    });
  };

  // Render Single Order Card
  const renderOrderItem = ({ item }: { item: SalesOrderItem }) => {
    const statusMeta = getSalesOrderStatusMeta(item.status, salesOrderStatuses);

    const orderedM3 = item.progress?.ordered_m3 ?? Number(item.total_qty ?? 0);
    const deliveredM3 =
      item.progress?.delivered_m3 ?? Number(item.produced_qty ?? 0);
    const remainingM3 =
      item.progress?.remaining_delivery_m3 ??
      Math.max(0, orderedM3 - deliveredM3);

    const progressPercent =
      orderedM3 > 0
        ? Math.min(
            100,
            Math.max(0, Math.round((deliveredM3 / orderedM3) * 100)),
          )
        : 0;

    const displayFullNumber =
      item.full_number ||
      (item.prefix && item.order_no
        ? `${item.prefix}${item.order_no}`
        : item.order_no || `SO #${item.id}`);
    const customerName =
      item.customer?.legal_name ||
      item.customer?.name ||
      "Customer Not Specified";
    const siteName = item.site?.name || "Site Not Specified";
    const mixName =
      item.mix_design?.design_name ||
      item.mix_design?.name ||
      "Mix Not Specified";

    const showEditBtn = canEditOrder(item.status);

    return (
      <View
        style={[
          styles.orderCard,
          {
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant + "2E",
          },
        ]}
      >
        {/* Card Header: Full Number, Status */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.orderNoRow}>
              <View style={styles.orderIconWrap}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={16}
                  color="#2563EB"
                />
              </View>
              <Text style={[styles.orderNoText, { color: colors.text }]}>
                {displayFullNumber}
              </Text>
            </View>
          </View>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusMeta.bgColor,
                borderColor: statusMeta.borderColor,
              },
            ]}
          >
            <MaterialIcons
              name={statusMeta.icon}
              size={12}
              color={statusMeta.color}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.statusText, { color: statusMeta.color }]}>
              {statusMeta.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        {/* Customer & Site Details */}
        <View style={styles.detailsBlock}>
          {/* Customer */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <MaterialCommunityIcons name="domain" size={16} color="#64748B" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text
                style={[styles.infoValueBold, { color: colors.text }]}
                numberOfLines={1}
              >
                {customerName}
              </Text>
            </View>
          </View>

          {/* Site */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <MaterialIcons name="place" size={16} color="#0284C7" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Site</Text>
              <Text
                style={[styles.infoValue, { color: colors.text }]}
                numberOfLines={1}
              >
                {siteName}
              </Text>
            </View>
          </View>

          {/* Mix Design */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <MaterialCommunityIcons
                name="flask-outline"
                size={16}
                color="#7C3AED"
              />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Mix Design</Text>
              <Text
                style={[styles.infoValueBold, { color: "#7C3AED" }]}
                numberOfLines={1}
              >
                {mixName}
              </Text>
            </View>
            {item.rate ? (
              <View style={styles.ratePill}>
                <Text style={styles.ratePillText}>
                  {formatRate(item.rate)}/m³
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Progress Bar Section (Ordered vs Remaining Delivery) */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <View style={styles.progressHeaderLeft}>
              <MaterialCommunityIcons
                name="truck-delivery-outline"
                size={16}
                color="#2563EB"
              />
              <Text style={styles.progressTitle}>Fulfillment Progress</Text>
            </View>
            <Text style={styles.progressPercentText}>{progressPercent}%</Text>
          </View>

          {/* Progress Bar Track & Fill */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor:
                    progressPercent >= 100
                      ? "#059669"
                      : progressPercent > 0
                        ? "#2563EB"
                        : "#CBD5E1",
                },
              ]}
            />
          </View>

          {/* Metric Columns: Ordered, Remaining, Delivered */}
          <View style={styles.progressMetricsRow}>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Ordered</Text>
              <Text style={styles.metricValuePrimary}>
                {formatVolume(orderedM3)} m³
              </Text>
            </View>
            <View style={styles.metricColDivider} />
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Remaining</Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: remainingM3 > 0 ? "#D97706" : "#059669" },
                ]}
              >
                {formatVolume(remainingM3)} m³
              </Text>
            </View>
            <View style={styles.metricColDivider} />
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Delivered</Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: deliveredM3 > 0 ? "#059669" : "#64748B" },
                ]}
              >
                {formatVolume(deliveredM3)} m³
              </Text>
            </View>
          </View>
        </View>

        {/* Card Footer with Edit Action */}
        <View style={styles.cardFooter}>
          <View style={styles.metaRow}>
            {item.concrete_pump ? (
              <View style={styles.pumpBadge}>
                <MaterialCommunityIcons name="pump" size={12} color="#475569" />
                <Text style={styles.pumpBadgeText}>
                  {item.concrete_pump.replace(/_/g, " ")}
                </Text>
              </View>
            ) : null}
            {item.is_tax_inclusive !== undefined ? (
              <View style={styles.taxBadge}>
                <Text style={styles.taxBadgeText}>
                  {item.is_tax_inclusive ? "Tax Inclusive" : "Tax Exclusive"}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Edit Button: Visible ONLY if status is 0, 1, or 4 */}
          {showEditBtn && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditPress(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={15} color="#2563EB" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.headerBgColor }]}
      edges={["top"]}
    >
      <AppHeader
        title="Sales Orders"
        onBackPress={handleBack}
        showNotification={false}
      />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Summary Bar */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Orders</Text>
            <Text style={[styles.summaryValue, { color: "#2563EB" }]}>
              {stats.totalOrders}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Ordered Vol</Text>
            <Text style={[styles.summaryValue, { color: "#0284C7" }]}>
              {formatVolume(stats.totalOrdered)} m³
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Delivered Vol</Text>
            <Text style={[styles.summaryValue, { color: "#059669" }]}>
              {formatVolume(stats.totalDelivered)} m³
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant + "44",
              },
            ]}
          >
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search by order no, customer, site, mix..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Status Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContent}
          >
            {filterTabs.map((tab) => {
              const isSelected = activeTab === tab.value;
              return (
                <TouchableOpacity
                  key={String(tab.value)}
                  style={[
                    styles.tabButton,
                    isSelected && styles.tabButtonActive,
                  ]}
                  onPress={() => setActiveTab(tab.value)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.tabButtonText,
                      isSelected && styles.tabButtonTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  <View
                    style={[
                      styles.tabBadge,
                      isSelected && styles.tabBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabBadgeText,
                        isSelected && styles.tabBadgeTextActive,
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Error Notice Banner */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color="#DC2626" />
            <Text style={styles.errorText} numberOfLines={2}>
              {errorMessage}
            </Text>
            <TouchableOpacity onPress={() => fetchOrders(false)}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Orders List / Loader / Empty State */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading Sales Orders...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredOrders}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderOrderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#2563EB"]}
                tintColor="#2563EB"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name={
                    errorMessage
                      ? "cloud-alert"
                      : "clipboard-text-search-outline"
                  }
                  size={56}
                  color={errorMessage ? "#EF4444" : "#CBD5E1"}
                />
                <Text style={styles.emptyTitle}>
                  {errorMessage
                    ? "Failed to Load Orders"
                    : "No Sales Orders Found"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {errorMessage
                    ? errorMessage
                    : search.trim()
                      ? `No orders matching "${search}".`
                      : activeTab !== "All"
                        ? "No sales orders found for this status."
                        : "No confirmed sales orders registered yet."}
                </Text>
                {errorMessage ? (
                  <TouchableOpacity
                    style={styles.emptyRetryBtn}
                    onPress={() => fetchOrders(false)}
                  >
                    <Text style={styles.emptyRetryBtnText}>Tap to Retry</Text>
                  </TouchableOpacity>
                ) : (
                  (search.length > 0 || activeTab !== "All") && (
                    <TouchableOpacity
                      style={styles.emptyResetBtn}
                      onPress={() => {
                        setSearch("");
                        setActiveTab("All");
                      }}
                    >
                      <Text style={styles.emptyResetBtnText}>
                        Reset Filters
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            }
          />
        )}

        {/* Floating Action Button (Create Sales Order) */}
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() =>
            router.push("/sales-order/createSalesOrderScreen" as any)
          }
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  summaryBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "space-around",
  },
  summaryBox: {
    alignItems: "center",
    flex: 1,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E2E8F0",
  },
  searchContainer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  tabsContainer: {
    paddingBottom: 8,
  },
  tabsContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: "#2563EB",
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
  },
  tabBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    alignItems: "center",
  },
  tabBadgeActive: {
    backgroundColor: "#1D4ED8",
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },
  tabBadgeTextActive: {
    color: "#FFFFFF",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#B91C1C",
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
    paddingHorizontal: 4,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 88,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  orderCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  orderNoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  orderIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  orderNoText: {
    fontSize: 15,
    fontWeight: "800",
  },
  fullNumberChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  fullNumberText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },
  detailsBlock: {
    gap: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoIconWrap: {
    width: 22,
    alignItems: "center",
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#94A3B8",
  },
  infoValueBold: {
    fontSize: 13,
    fontWeight: "700",
  },
  infoValue: {
    fontSize: 12,
    fontWeight: "500",
  },
  ratePill: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7C3AED",
  },
  progressSection: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  metricCol: {
    flex: 1,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "500",
  },
  metricValuePrimary: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 1,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  metricColDivider: {
    width: 1,
    height: 18,
    backgroundColor: "#E2E8F0",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    gap: 6,
    flex: 1,
    flexWrap: "wrap",
  },
  pumpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pumpBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#475569",
    textTransform: "capitalize",
  },
  taxBadge: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  taxBadgeText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#64748B",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
  },
  emptyRetryBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  emptyRetryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyResetBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  emptyResetBtnText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
  fabButton: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});
