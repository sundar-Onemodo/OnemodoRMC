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
  Alert,
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
        StatusBar.setBackgroundColor("#0B2A4A");
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
  // "when status is in schedule , inprogress, cancel they edit but if inprogress the ordered & remaining value are equal they can edit but if not equal can't show edit button"
  const canEditOrder = (
    status: number | string | null | undefined,
    orderedM3?: number | string | null,
    remainingM3?: number | string | null,
  ) => {
    const s = Number(status);
    if (s === 0 || s === 1 || s === 4) {
      return true;
    }
    if (s === 2) {
      // In Progress: can edit ONLY if ordered & remaining values are equal (no deliveries made yet)
      const ord = parseFloat(String(orderedM3 ?? 0));
      const rem = parseFloat(String(remainingM3 ?? 0));
      return !isNaN(ord) && !isNaN(rem) && Math.abs(ord - rem) < 0.001;
    }
    return false;
  };

  const handleEditPress = (order: SalesOrderItem) => {
    const orderedM3 =
      order.progress?.ordered_m3 ?? Number(order.total_qty ?? 0);
    const deliveredM3 =
      order.progress?.delivered_m3 ?? Number(order.produced_qty ?? 0);
    const remainingM3 =
      order.progress?.remaining_delivery_m3 ??
      Math.max(0, orderedM3 - deliveredM3);

    if (!canEditOrder(order.status, orderedM3, remainingM3)) {
      Alert.alert(
        "Cannot Edit Order",
        "This in-progress order has already delivered concrete and cannot be edited.",
      );
      return;
    }

    router.push({
      pathname: "/sales-order/editSalesOrderScreen" as any,
      params: {
        admin_order_id: String(order.id),
        orderData: JSON.stringify(order),
      },
    });
  };

  // Render Single Order Card with Upgraded Modern Design
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

    const poRef =
      item.customer_p_o?.reference ||
      (item as any).customer_po_reference ||
      (item.customer_po_id ? `PO #${item.customer_po_id}` : null);

    const customerName =
      item.customer?.legal_name ||
      item.customer?.name ||
      "Customer Not Specified";
    const siteName = item.site?.name || "Site Not Specified";
    const mixName =
      item.mix_design?.design_name ||
      item.mix_design?.name ||
      "Mix Not Specified";

    const showEditBtn = canEditOrder(item.status, orderedM3, remainingM3);

    return (
      <View style={styles.orderCard}>
        {/* Card Header: Order Number Badge & Status Pill */}
        <View style={styles.cardHeader}>
          <View style={styles.headerBadgesLeft}>
            <View style={styles.orderNoBadge}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={14}
                color="#2563EB"
              />
              <Text style={styles.orderNoText}>{displayFullNumber}</Text>
            </View>

            {poRef && (
              <View style={styles.poRefBadge}>
                <Ionicons name="receipt-outline" size={11} color="#64748B" />
                <Text style={styles.poRefText} numberOfLines={1}>
                  {poRef}
                </Text>
              </View>
            )}
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
            <View
              style={[styles.statusDot, { backgroundColor: statusMeta.color }]}
            />
            <Text style={[styles.statusText, { color: statusMeta.color }]}>
              {statusMeta.label}
            </Text>
          </View>
        </View>

        {/* Customer & Site Location Block */}
        <View style={styles.projectSection}>
          <Text style={styles.customerNameText} numberOfLines={2}>
            {customerName}
          </Text>
          <View style={styles.siteRow}>
            <Ionicons name="location" size={13} color="#DC2626" />
            <Text style={styles.siteNameText} numberOfLines={1}>
              {siteName}
            </Text>
          </View>
        </View>

        {/* Modern 3-Column Spec Box: Mix Design, Ordered Qty, Delivered Qty */}
        <View style={styles.specBox}>
          {/* Col 1: MIX DESIGN */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <MaterialCommunityIcons
                name="layers-triple-outline"
                size={13}
                color="#2563EB"
              />
              <Text style={styles.specLabel}>MIX DESIGN</Text>
            </View>
            <Text style={styles.specValue} numberOfLines={1}>
              {mixName}
            </Text>
            {item.rate ? (
              <Text style={styles.specSubRate}>{formatRate(item.rate)}/m³</Text>
            ) : null}
          </View>

          <View style={styles.specDivider} />

          {/* Col 2: ORDERED QTY */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <MaterialCommunityIcons
                name="cube-outline"
                size={13}
                color="#2563EB"
              />
              <Text style={styles.specLabel}>ORDERED</Text>
            </View>
            <Text
              style={[
                styles.specValue,
                { color: "#2563EB", fontWeight: "800" },
              ]}
            >
              {formatVolume(orderedM3)} m³
            </Text>
          </View>

          <View style={styles.specDivider} />

          {/* Col 3: DELIVERED */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <MaterialCommunityIcons
                name="truck-check-outline"
                size={13}
                color="#059669"
              />
              <Text style={styles.specLabel}>DELIVERED</Text>
            </View>
            <Text
              style={[
                styles.specValue,
                { color: "#059669", fontWeight: "800" },
              ]}
            >
              {formatVolume(deliveredM3)} m³
            </Text>
          </View>
        </View>

        {/* Fulfillment Progress Bar Section */}
        <View style={styles.progressCardSection}>
          <View style={styles.progressHeaderRow}>
            <View style={styles.progressTitleRow}>
              <MaterialCommunityIcons
                name="truck-delivery-outline"
                size={15}
                color="#2563EB"
              />
              <Text style={styles.progressTitleText}>Fulfillment Progress</Text>
            </View>
            <Text
              style={[
                styles.progressPercentText,
                {
                  color:
                    progressPercent >= 100
                      ? "#059669"
                      : progressPercent > 0
                        ? "#2563EB"
                        : "#64748B",
                },
              ]}
            >
              {progressPercent}%
            </Text>
          </View>

          {/* Modern Slim Track */}
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

          {/* Real-time Remaining Notice */}
          <View style={styles.remainingNoticeRow}>
            <Text style={styles.remainingLabel}>
              Remaining to pour:{" "}
              <Text
                style={{
                  fontWeight: "700",
                  color: remainingM3 > 0 ? "#D97706" : "#059669",
                }}
              >
                {formatVolume(remainingM3)} m³
              </Text>
            </Text>
          </View>
        </View>

        {/* Card Footer: Metadata chips & Edit Action */}
        <View style={styles.cardFooter}>
          <View style={styles.metaRow}>
            {item.concrete_pump ? (
              <View style={styles.metaChip}>
                <MaterialCommunityIcons name="pump" size={12} color="#2563EB" />
                <Text style={styles.metaChipText}>
                  {String(item.concrete_pump).replace(/_/g, " ")}
                </Text>
              </View>
            ) : null}
            {item.is_tax_inclusive !== undefined ? (
              <View style={styles.metaChip}>
                <Ionicons name="shield-outline" size={11} color="#64748B" />
                <Text style={styles.metaChipText}>
                  {item.is_tax_inclusive ? "Tax Inclusive" : "Tax Exclusive"}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Edit Button */}
          {showEditBtn && (
            <TouchableOpacity
              style={styles.actionEditBtn}
              onPress={() => handleEditPress(item)}
              activeOpacity={0.75}
            >
              <Ionicons name="create-outline" size={14} color="#2563EB" />
              <Text style={styles.actionEditText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0B2A4A"
        translucent={false}
      />

      {/* UNIFIED NAVY HEADER (MATCHES QUOTATION & BATCH SCHEDULE) */}
      <View style={styles.header}>
        {/* Header Top Bar */}
        <View style={styles.headerTop}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.headerTitleRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Sales Order</Text>
            </View>
            <View style={styles.plantBadgeRow}>
              <Ionicons name="cube-outline" size={12} color="#94A3B8" />
              <Text style={styles.plantBadgeText}>Fulfillment Pipeline</Text>
            </View>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => fetchOrders(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="reload-outline"
                size={18}
                color="#FFFFFF"
                style={refreshing ? { transform: [{ rotate: "45deg" }] } : undefined}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() =>
                router.push("/sales-order/createSalesOrderScreen" as any)
              }
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Integrated KPI Summary Strip */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL ORDERS</Text>
            <Text style={styles.kpiValue}>{stats.totalOrders}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>ORDERED VOL</Text>
            <Text style={[styles.kpiValue, { color: "#60A5FA" }]}>
              {formatVolume(stats.totalOrdered)} m³
            </Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>DELIVERED</Text>
            <Text style={[styles.kpiValue, { color: "#34D399" }]}>
              {formatVolume(stats.totalDelivered)} m³
            </Text>
          </View>
        </View>

        {/* Integrated Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order no, customer, site, mix..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* FILTER TABS */}
      <View style={styles.tabsSection}>
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
                  styles.tabChip,
                  isSelected && styles.tabChipActive,
                ]}
                onPress={() => setActiveTab(tab.value)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    isSelected && styles.tabChipTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabChipBadge,
                    isSelected && styles.tabChipBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabChipBadgeText,
                      isSelected && styles.tabChipBadgeTextActive,
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

      <View style={styles.container}>
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
    backgroundColor: "#0B2A4A",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // Dark Navy Header (Matches Quotation & Batch Schedule)
  header: {
    backgroundColor: "#0B2A4A",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 14 : 10,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  plantBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    marginLeft: 44,
  },
  plantBadgeText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },

  // Integrated KPI Strip
  kpiContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  kpiCard: {
    flex: 1,
    alignItems: "center",
  },
  kpiDivider: {
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginVertical: 2,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 2,
  },

  // Search Bar
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    marginLeft: 8,
    paddingVertical: 0,
  },

  // Filter Tabs
  tabsSection: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 10,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  tabChipActive: {
    backgroundColor: "#2563EB",
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  tabChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  tabChipBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabChipBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  tabChipBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },
  tabChipBadgeTextActive: {
    color: "#FFFFFF",
  },

  // Card UI
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
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
    marginBottom: 12,
  },
  headerBadgesLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    flexWrap: "wrap",
  },
  orderNoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderNoText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E40AF",
  },
  poRefBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  poRefText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Project Section
  projectSection: {
    marginBottom: 12,
  },
  customerNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  siteNameText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },

  // Modern 3-Col Spec Box
  specBox: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EDF2F7",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  specCol: {
    flex: 1,
    alignItems: "center",
  },
  specDivider: {
    width: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 2,
  },
  specHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },
  specLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  specValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  specSubRate: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
  },

  // Fulfillment Progress Section
  progressCardSection: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressTitleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: "800",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  remainingNoticeRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  remainingLabel: {
    fontSize: 11,
    color: "#64748B",
  },

  // Card Footer
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    flex: 1,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#475569",
    textTransform: "capitalize",
  },
  actionEditBtn: {
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
  actionEditText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },

  // Error Banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#B91C1C",
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
    textDecorationLine: "underline",
  },

  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 12,
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyRetryBtn: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyRetryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  emptyResetBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyResetBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },

  // List Layout
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  fabButton: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 99,
  },
});