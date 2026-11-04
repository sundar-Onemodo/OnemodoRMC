import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import {
  AlertButton,
  AlertType,
  CustomAlertModal,
  formatSubmissionError,
} from "@/components/ui/custom-alert-modal";
import { Colors } from "@/constants/theme";
import { fetchDropdowns, StatusDropdownOption } from "@/store/dropdownSlice";
import { AppDispatch, RootState } from "@/store/store";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Modal,
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
        accent: "#F59E0B",
        icon: "hourglass-outline" as const,
      };
    case 1:
      return {
        label: found?.label || "Scheduled",
        color: "#2563EB",
        bgColor: "#EFF6FF",
        borderColor: "#BFDBFE",
        accent: "#2563EB",
        icon: "calendar-outline" as const,
      };
    case 2:
      return {
        label: found?.label || "In Progress",
        color: "#0284C7",
        bgColor: "#E0F2FE",
        borderColor: "#BAE6FD",
        accent: "#0284C7",
        icon: "time-outline" as const,
      };
    case 3:
      return {
        label: found?.label || "Completed",
        color: "#059669",
        bgColor: "#ECFDF5",
        borderColor: "#A7F3D0",
        accent: "#059669",
        icon: "checkmark-circle" as const,
      };
    case 4:
      return {
        label: found?.label || "Cancelled",
        color: "#DC2626",
        bgColor: "#FEE2E2",
        borderColor: "#FECACA",
        accent: "#DC2626",
        icon: "close-circle" as const,
      };
    default:
      return {
        label: found?.label || `Status ${s}`,
        color: "#64748B",
        bgColor: "#F1F5F9",
        borderColor: "#E2E8F0",
        accent: "#64748B",
        icon: "help-circle-outline" as const,
      };
  }
};

export const formatVolume = (val?: number | string | null): string => {
  if (val === null || val === undefined || val === "") return "0";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) return "0";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export const formatRate = (val?: number | string | null): string => {
  if (val === null || val === undefined || val === "") return "₹0";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) return "₹0";
  return "₹" + Math.round(num).toLocaleString("en-IN");
};

export const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return "-";
  try {
    const clean = dateStr.includes("T")
      ? dateStr.split("T")[0]
      : dateStr.split(" ")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      if (month >= 1 && month <= 12) {
        return `${String(day).padStart(2, "0")} ${months[month - 1]} ${year}`;
      }
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

export async function deleteSalesOrderApi(
  orderId: number | string,
  token?: string | null,
  plantId?: number | null,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) {
    const cleanToken = token.trim();
    headers.Authorization = cleanToken.startsWith("Bearer ")
      ? cleanToken
      : `Bearer ${cleanToken}`;
  }
  if (plantId) headers["X-Plant-Id"] = String(plantId);

  const params: Record<string, any> = {
    admin_order_id: orderId,
  };
  if (plantId) params.plant_id = plantId;

  console.log(`[SalesOrder Delete] DELETE ${baseURL}/orders/${orderId}`, {
    params,
    headers,
  });

  return await axios.delete(`${baseURL}/orders/${orderId}`, {
    headers,
    params,
  });
}

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
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "vol_high" | "vol_low"
  >("newest");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [cardMenuOrder, setCardMenuOrder] = useState<SalesOrderItem | null>(
    null,
  );

  // Delete Sales Order State
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: AlertType;
    buttons?: AlertButton[];
  }>({
    visible: false,
    title: "",
    message: "",
    type: "info",
  });

  const hideAlert = useCallback(() => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleBack = useCallback(() => {
    router.replace("/more" as any);
  }, []);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#063b89");
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
      const com = o.progress?.committed_m3 ?? 0;
      const rem = Math.max(0, ord - com);

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

  // Filtered and Sorted List
  const filteredOrders = useMemo(() => {
    let result = orders.filter((o) => {
      if (activeTab !== "All" && Number(o.status) !== Number(activeTab)) {
        return false;
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
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
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "newest") return Number(b.id) - Number(a.id);
      if (sortBy === "oldest") return Number(a.id) - Number(b.id);
      if (sortBy === "vol_high") {
        const valA = Number(a.progress?.ordered_m3 ?? a.total_qty ?? 0);
        const valB = Number(b.progress?.ordered_m3 ?? b.total_qty ?? 0);
        return valB - valA;
      }
      if (sortBy === "vol_low") {
        const valA = Number(a.progress?.ordered_m3 ?? a.total_qty ?? 0);
        const valB = Number(b.progress?.ordered_m3 ?? b.total_qty ?? 0);
        return valA - valB;
      }
      return 0;
    });

    return result;
  }, [orders, activeTab, search, sortBy]);

  // Filter Tabs definition
  const filterTabs: { label: string; value: "All" | number; count: number }[] =
    useMemo(() => {
      return [
        { label: "All", value: "All", count: counts.all },
        { label: "Scheduled", value: 1, count: counts["1"] || 0 },
        { label: "In Progress", value: 2, count: counts["2"] || 0 },
        { label: "Completed", value: 3, count: counts["3"] || 0 },
        { label: "Cancelled", value: 4, count: counts["4"] || 0 },
        ...(counts["0"]
          ? [{ label: "Draft", value: 0, count: counts["0"] }]
          : []),
      ];
    }, [counts]);

  // Check if an order is editable:
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
      const ord = parseFloat(String(orderedM3 ?? 0));
      const rem = parseFloat(String(remainingM3 ?? 0));
      return !isNaN(ord) && !isNaN(rem) && Math.abs(ord - rem) < 0.001;
    }
    return false;
  };

  const confirmDeleteOrder = useCallback(
    async (item: SalesOrderItem) => {
      hideAlert();
      setDeletingOrderId(item.id);
      try {
        const targetPlantId =
          plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;
        const res = await deleteSalesOrderApi(item.id, token, targetPlantId);
        const successMsg =
          res.data?.message || "Sales Order deleted successfully.";
        setOrders((prev) => prev.filter((o) => o.id !== item.id));
        setAlertConfig({
          visible: true,
          title: "Deleted",
          message: successMsg,
          type: "success",
          buttons: [{ text: "OK", onPress: hideAlert }],
        });
        fetchOrders(false);
      } catch (err: any) {
        const errMsg = formatSubmissionError(
          err,
          "Failed to delete sales order.",
        );
        setAlertConfig({
          visible: true,
          title: "Delete Failed",
          message: errMsg,
          type: "error",
          buttons: [{ text: "OK", onPress: hideAlert }],
        });
      } finally {
        setDeletingOrderId(null);
      }
    },
    [hideAlert, token, plant_id, user, fetchOrders],
  );

  const handlePromptDeleteOrder = useCallback(
    (item: SalesOrderItem) => {
      const displayFullNumber =
        item.full_number ||
        (item.prefix && item.order_no
          ? `${item.prefix}${item.order_no}`
          : item.order_no || `SO #${item.id}`);

      setAlertConfig({
        visible: true,
        title: "Delete Sales Order",
        message: `Are you sure you want to delete sales order "${displayFullNumber}"? This action cannot be undone.`,
        type: "warning",
        buttons: [
          {
            text: "Cancel",
            style: "cancel",
            onPress: hideAlert,
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => confirmDeleteOrder(item),
          },
        ],
      });
    },
    [hideAlert, confirmDeleteOrder],
  );

  const handleEditPress = (order: SalesOrderItem) => {
    const orderedM3 =
      order.progress?.ordered_m3 ?? Number(order.total_qty ?? 0);
    const committedM3 =
      order.progress?.committed_m3 ?? 0;
    const deliveredM3 =
      order.progress?.delivered_m3 ?? Number(order.produced_qty ?? 0);
    const remainingM3 = Math.max(0, orderedM3 - committedM3);

    if (!canEditOrder(order.status, orderedM3, remainingM3)) {
      Alert.alert(
        "Cannot Edit Order",
        "This in-progress order has already committed/delivered concrete and cannot be edited.",
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

  const handleViewProgress = (order: SalesOrderItem) => {
    router.push({
      pathname: "/quotation/orderProgressScreen" as any,
      params: {
        order_id: String(order.id),
        orderData: JSON.stringify(order),
      },
    });
  };

  // Render Single Order Card with Upgraded Modern Design
  const renderOrderItem = ({ item }: { item: SalesOrderItem }) => {
    const statusMeta = getSalesOrderStatusMeta(item.status, salesOrderStatuses);

    const orderedM3 = item.progress?.ordered_m3 ?? Number(item.total_qty ?? 0);
    const committedM3 = item.progress?.committed_m3 ?? 0;
    const deliveredM3 =
      item.progress?.delivered_m3 ?? Number(item.produced_qty ?? 0);
    const remainingM3 = Math.max(0, orderedM3 - committedM3);

    const progressBasis = Math.max(committedM3, deliveredM3);
    const progressPercent =
      orderedM3 > 0
        ? Math.min(
            100,
            Math.max(0, Math.round((progressBasis / orderedM3) * 100)),
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
    const isScheduled =
      Number(item.status) === 1 ||
      (statusMeta.label || "").toLowerCase().includes("schedule");
    const canDeleteOrder = isScheduled;

    return (
      <View style={styles.cardWrapper}>
        <View style={styles.cardContainer}>
          {/* Vertical Color Stripe */}
          <View
            style={[
              styles.cardColorStripe,
              { backgroundColor: statusMeta.accent || statusMeta.color },
            ]}
          />

          {/* Card Main Body */}
          <View style={styles.cardBody}>
            {/* Top Row: Order Number Badge + PO badge & Status Pill */}
            <View style={styles.cardTopRow}>
              <View style={styles.headerBadgesLeft}>
                <View style={styles.orderNoBadge}>
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={13}
                    color="#1E40AF"
                  />
                  <Text style={styles.orderNoText}>{displayFullNumber}</Text>
                </View>

                {poRef && (
                  <View style={styles.poRefBadge}>
                    <Ionicons
                      name="receipt-outline"
                      size={11}
                      color="#64748B"
                    />
                    <Text style={styles.poRefText} numberOfLines={1}>
                      {poRef}
                    </Text>
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusMeta.bgColor,
                    borderColor:
                      statusMeta.borderColor || statusMeta.color + "30",
                  },
                ]}
              >
                <Ionicons
                  name={statusMeta.icon}
                  size={12}
                  color={statusMeta.color}
                />
                <Text style={[styles.statusText, { color: statusMeta.color }]}>
                  {statusMeta.label}
                </Text>
              </View>
            </View>

            {/* Customer & 3-Dots Action Button */}
            <View style={styles.customerRow}>
              <Text style={styles.customerNameText} numberOfLines={1}>
                {customerName}
              </Text>
              <TouchableOpacity
                style={styles.cardOptionsBtn}
                onPress={() => setCardMenuOrder(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Site Location with Red Pin */}
            <View style={styles.siteRow}>
              <Ionicons name="location-sharp" size={14} color="#EF4444" />
              <Text style={styles.siteNameText} numberOfLines={1}>
                {siteName}
              </Text>
            </View>

            {/* 3-Column Spec Box */}
            <View style={styles.specBox}>
              {/* Col 1: MIX DESIGN */}
              <View style={styles.specCol}>
                <View style={styles.specHeaderRow}>
                  <MaterialCommunityIcons
                    name="layers-triple-outline"
                    size={13}
                    color="#64748B"
                  />
                  <Text style={styles.specLabel}>Mix Design</Text>
                </View>
                <Text style={styles.specMixValue} numberOfLines={1}>
                  {mixName}
                </Text>
                {item.rate ? (
                  <Text style={styles.specSubRate}>
                    {formatRate(item.rate)}/m³
                  </Text>
                ) : null}
              </View>

              <View style={styles.specDivider} />

              {/* Col 2: ORDERED */}
              <View style={styles.specCol}>
                <View style={styles.specHeaderRow}>
                  <MaterialCommunityIcons
                    name="cube-outline"
                    size={13}
                    color="#2563EB"
                  />
                  <Text style={styles.specLabel}>Ordered</Text>
                </View>
                <Text style={styles.specVolumeValue} numberOfLines={1}>
                  {formatVolume(orderedM3)} m³
                </Text>
              </View>

              <View style={styles.specDivider} />

              {/* Col 3: REMAINING (calculated as ordered_m3 - committed_m3) */}
              <View style={styles.specCol}>
                <View style={styles.specHeaderRow}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={13}
                    color={remainingM3 > 0 ? "#D97706" : "#059669"}
                  />
                  <Text style={styles.specLabel}>Remaining</Text>
                </View>
                <Text
                  style={[
                    styles.specRemainingValue,
                    { color: remainingM3 > 0 ? "#D97706" : "#059669" },
                  ]}
                  numberOfLines={1}
                >
                  {formatVolume(remainingM3)} m³
                </Text>
                {deliveredM3 > 0 ? (
                  <Text style={styles.specSubRate}>
                    Delv: {formatVolume(deliveredM3)} m³
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Fulfillment Progress Bar */}
            <View style={styles.progressCardSection}>
              <View style={styles.progressHeaderRow}>
                <View style={styles.progressTitleRow}>
                  <MaterialCommunityIcons
                    name="truck-delivery-outline"
                    size={14}
                    color="#2563EB"
                  />
                  <Text style={styles.progressTitleText}>
                    Fulfillment Progress
                  </Text>
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

              <View style={styles.remainingNoticeRow}>
                <Text style={styles.remainingLabel}>
                  Committed:{" "}
                  <Text style={{ fontWeight: "700", color: "#2563EB" }}>
                    {formatVolume(committedM3)} m³
                  </Text>
                  {"  •  "}
                  Delivered:{" "}
                  <Text style={{ fontWeight: "700", color: "#059669" }}>
                    {formatVolume(deliveredM3)} m³
                  </Text>
                  {"  •  "}
                  Remaining:{" "}
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

            {/* Dates & Meta Row */}
            <View style={styles.datesBar}>
              <View style={styles.dateItem}>
                <Ionicons name="calendar-outline" size={13} color="#64748B" />
                <Text style={styles.dateLabel}>
                  Start:{" "}
                  <Text style={styles.dateVal}>
                    {formatDate(item.scheduled_start || item.created_at)}
                  </Text>
                </Text>
              </View>

              {item.concrete_pump ? (
                <>
                  <View style={styles.dateDivider} />
                  <View style={styles.dateItem}>
                    <MaterialCommunityIcons
                      name="pump"
                      size={13}
                      color="#2563EB"
                    />
                    <Text style={styles.dateLabel}>
                      {String(item.concrete_pump).replace(/_/g, " ")}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>

            {/* Card Footer Actions */}
            <View style={styles.cardFooter}>
              <View style={styles.actionButtonsGroup}>
                {/* Edit Button */}
                {showEditBtn && (
                  <TouchableOpacity
                    style={styles.actionEditBtn}
                    onPress={() => handleEditPress(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={14} color="#0D9488" />
                    <Text style={styles.actionEditText}>Edit</Text>
                  </TouchableOpacity>
                )}

                {/* Delete Button (Allowed for Scheduled status) */}
                {canDeleteOrder && (
                  <TouchableOpacity
                    style={styles.actionDeleteBtn}
                    onPress={() => handlePromptDeleteOrder(item)}
                    activeOpacity={0.75}
                    disabled={deletingOrderId === item.id}
                  >
                    {deletingOrderId === item.id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <>
                        <Ionicons
                          name="trash-outline"
                          size={14}
                          color="#DC2626"
                        />
                        <Text style={styles.actionDeleteText}>Delete</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#063b89"
        translucent={false}
      />

      {/* HEADER SECTION WITH LINEAR GRADIENT */}
      <LinearGradient
        colors={["#063b89", "#0B4DA8", "#1E62D0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerBgCircle1} />
        <View style={styles.headerBgCircle2} />

        {/* Header Top: Back Button, Titles, Bell & Customized Sales Order Illustration */}
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTitles}>
              <Text style={styles.headerMainTitle}>Sales Orders</Text>
              <Text style={styles.headerSubtitle}>
                Order Fulfillment & Dispatch
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() =>
                Alert.alert(
                  "Notifications",
                  "You have no unread notifications for sales orders.",
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#FFFFFF"
              />
              <View style={styles.bellDot} />
            </TouchableOpacity>

            {/* Customized Sales Order Illustration (Manifest Sheet with Delivery Package & Checkmark Badge) */}
            <View style={styles.headerGraphicWrapper}>
              <View style={styles.headerManifestCard}>
                <View style={styles.headerManifestTop} />
                <View style={styles.headerManifestLine1} />
                <View style={styles.headerManifestLine2} />
                <View style={styles.headerManifestLine3} />
                <View style={styles.headerManifestBoxIcon}>
                  <MaterialCommunityIcons
                    name="package-variant-closed"
                    size={12}
                    color="#2563EB"
                  />
                </View>
              </View>
              <View style={styles.headerOrderBadge}>
                <MaterialIcons
                  name="local-shipping"
                  size={11}
                  color="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </View>

        {/* Integrated KPI Summary Strip */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiItem}>
            <View style={[styles.kpiIconBox, { backgroundColor: "#EFF6FF" }]}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={20}
                color="#2563EB"
              />
            </View>
            <View style={styles.kpiTextGroup}>
              <Text style={styles.kpiValueText}>{stats.totalOrders}</Text>
              <Text style={styles.kpiLabelText}>Total Orders</Text>
            </View>
          </View>

          <View style={styles.kpiItem}>
            <View style={[styles.kpiIconBox, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name="calendar" size={18} color="#2563EB" />
            </View>
            <View style={styles.kpiTextGroup}>
              <Text style={styles.kpiValueText}>{counts["1"] || 0}</Text>
              <Text style={styles.kpiLabelText}>Scheduled</Text>
            </View>
          </View>

          <View style={styles.kpiItem}>
            <View style={[styles.kpiIconBox, { backgroundColor: "#F3E8FF" }]}>
              <MaterialCommunityIcons
                name="cube-send"
                size={18}
                color="#9333EA"
              />
            </View>
            <View style={styles.kpiTextGroup}>
              <Text style={styles.kpiValueText} numberOfLines={1}>
                {formatVolume(stats.totalOrdered)} m³
              </Text>
              <Text style={styles.kpiLabelText}>Ordered Vol</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* SEARCH AND FILTER BAR */}
      <View style={styles.searchFilterRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search order #, customer, site, mix..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterActionBtn,
            sortBy !== "newest" && styles.filterActionBtnActive,
          ]}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons
            name="funnel"
            size={16}
            color={sortBy !== "newest" ? "#2563EB" : "#3B82F6"}
          />
          <Text
            style={[
              styles.filterActionBtnText,
              sortBy !== "newest" && styles.filterActionBtnTextActive,
            ]}
          >
            Filter
          </Text>
        </TouchableOpacity>
      </View>

      {/* STATUS FILTER TABS */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContentContainer}
        >
          {filterTabs.map((tab) => {
            const isSelected = activeTab === tab.value;
            return (
              <TouchableOpacity
                key={String(tab.value)}
                style={[
                  styles.statusTabChip,
                  isSelected && styles.statusTabChipActive,
                ]}
                onPress={() => setActiveTab(tab.value)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.statusTabText,
                    isSelected && styles.statusTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.statusTabCount,
                    isSelected && styles.statusTabCountActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusTabCountText,
                      isSelected && styles.statusTabCountTextActive,
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

      {/* MAIN CONTENT AREA */}
      <View style={styles.contentContainer}>
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

        {/* Loading / List / Empty State */}
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
                        setSortBy("newest");
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

      {/* FILTER & SORT MODAL */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View
            style={styles.filterModalCard}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.filterModalHeader}>
              <View style={styles.filterModalTitleRow}>
                <Ionicons name="options-outline" size={20} color="#063b89" />
                <Text style={styles.filterModalTitle}>
                  Filter & Sort Orders
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionTitle}>SORT BY</Text>
            <View style={styles.sortOptionsList}>
              {[
                { key: "newest", label: "Newest First", icon: "time-outline" },
                {
                  key: "oldest",
                  label: "Oldest First",
                  icon: "hourglass-outline",
                },
                {
                  key: "vol_high",
                  label: "Ordered Vol: High to Low",
                  icon: "trending-up",
                },
                {
                  key: "vol_low",
                  label: "Ordered Vol: Low to High",
                  icon: "trending-down",
                },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.sortOptionItem,
                    sortBy === opt.key && styles.sortOptionItemActive,
                  ]}
                  onPress={() => {
                    setSortBy(opt.key as any);
                    setFilterModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.sortOptionLeft}>
                    <Ionicons
                      name={opt.icon as any}
                      size={18}
                      color={sortBy === opt.key ? "#2563EB" : "#64748B"}
                    />
                    <Text
                      style={[
                        styles.sortOptionText,
                        sortBy === opt.key && styles.sortOptionTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </View>
                  {sortBy === opt.key && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color="#2563EB"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.resetFilterModalBtn}
              onPress={() => {
                setSortBy("newest");
                setActiveTab("All");
                setFilterModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.resetFilterModalBtnText}>
                Reset to Default
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 3-DOTS ACTION SHEET MODAL */}
      <Modal
        visible={!!cardMenuOrder}
        transparent
        animationType="fade"
        onRequestClose={() => setCardMenuOrder(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCardMenuOrder(null)}
        >
          <View
            style={styles.actionSheetCard}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.actionSheetHeader}>
              <View>
                <Text style={styles.actionSheetTitle}>
                  {cardMenuOrder?.full_number || `SO #${cardMenuOrder?.id}`}
                </Text>
                <Text style={styles.actionSheetSubtitle} numberOfLines={1}>
                  {cardMenuOrder?.customer?.legal_name ||
                    cardMenuOrder?.customer?.name ||
                    "Customer Details"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCardMenuOrder(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Action Item: View Progress */}
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                const target = cardMenuOrder;
                setCardMenuOrder(null);
                if (target) handleViewProgress(target);
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionSheetIconBox,
                  { backgroundColor: "#EFF6FF" },
                ]}
              >
                <Ionicons name="analytics-outline" size={18} color="#2563EB" />
              </View>
              <View style={styles.actionSheetItemContent}>
                <Text style={styles.actionSheetItemTitle}>
                  View Fulfillment Progress
                </Text>
                <Text style={styles.actionSheetItemSub}>
                  Batches, transit, dispatched vs delivered
                </Text>
              </View>
            </TouchableOpacity>

            {/* Action Item: Edit */}
            {cardMenuOrder &&
              canEditOrder(
                cardMenuOrder.status,
                cardMenuOrder.progress?.ordered_m3 ?? cardMenuOrder.total_qty,
                Math.max(
                  0,
                  Number(
                    cardMenuOrder.progress?.ordered_m3 ??
                      cardMenuOrder.total_qty ??
                      0,
                  ) - Number(cardMenuOrder.progress?.committed_m3 ?? 0),
                ),
              ) && (
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => {
                    const target = cardMenuOrder;
                    setCardMenuOrder(null);
                    if (target) handleEditPress(target);
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.actionSheetIconBox,
                      { backgroundColor: "#CCFBF1" },
                    ]}
                  >
                    <Ionicons name="create-outline" size={18} color="#0D9488" />
                  </View>
                  <View style={styles.actionSheetItemContent}>
                    <Text style={styles.actionSheetItemTitle}>
                      Edit Sales Order
                    </Text>
                    <Text style={styles.actionSheetItemSub}>
                      Update quantities, schedules, and specifications
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

            {/* Action Item: Delete */}
            {cardMenuOrder &&
              (Number(cardMenuOrder.status) === 1 ||
                (cardMenuOrder.order_no &&
                  getSalesOrderStatusMeta(
                    cardMenuOrder.status,
                    salesOrderStatuses,
                  )
                    .label.toLowerCase()
                    .includes("schedule"))) && (
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => {
                    const target = cardMenuOrder;
                    setCardMenuOrder(null);
                    if (target) handlePromptDeleteOrder(target);
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.actionSheetIconBox,
                      { backgroundColor: "#FEE2E2" },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </View>
                  <View style={styles.actionSheetItemContent}>
                    <Text
                      style={[
                        styles.actionSheetItemTitle,
                        { color: "#DC2626" },
                      ]}
                    >
                      Delete Sales Order
                    </Text>
                    <Text style={styles.actionSheetItemSub}>
                      Permitted for scheduled orders
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Animated Custom Alert Modal */}
      <CustomAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
}

// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#063b89",
  },

  // Gradient Header
  headerGradient: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 14 : 10,
    paddingBottom: 16,
    position: "relative",
    overflow: "hidden",
  },
  headerBgCircle1: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    top: -60,
    right: -40,
  },
  headerBgCircle2: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    bottom: -30,
    left: -20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitles: {
    flex: 1,
  },
  headerMainTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.75)",
    fontWeight: "500",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bellDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#EF4444",
    borderWidth: 1,
    borderColor: "#063b89",
  },

  // Customized Sales Order Illustration (Manifest Sheet with Delivery Package & Checkmark Badge)
  headerGraphicWrapper: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  headerManifestCard: {
    width: 36,
    height: 42,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 7,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  headerManifestTop: {
    width: 14,
    height: 3,
    backgroundColor: "#2563EB",
    borderRadius: 2,
    marginBottom: 4,
  },
  headerManifestLine1: {
    width: "80%",
    height: 2,
    backgroundColor: "#94A3B8",
    borderRadius: 1,
    marginBottom: 3,
  },
  headerManifestLine2: {
    width: "60%",
    height: 2,
    backgroundColor: "#CBD5E1",
    borderRadius: 1,
    marginBottom: 4,
  },
  headerManifestLine3: {
    width: "45%",
    height: 2,
    backgroundColor: "#E2E8F0",
    borderRadius: 1,
  },
  headerManifestBoxIcon: {
    position: "absolute",
    bottom: 3,
    right: 3,
  },
  headerOrderBadge: {
    position: "absolute",
    bottom: -2,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#063b89",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },

  // KPI Summary Strip
  kpiContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  kpiItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  kpiTextGroup: {
    justifyContent: "center",
  },
  kpiValueText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  kpiLabelText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 1,
  },

  // Search & Filter Row
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 10,
    backgroundColor: "#F8FAFC",
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    marginLeft: 8,
    paddingVertical: 0,
  },
  filterActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterActionBtnActive: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  filterActionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3B82F6",
  },
  filterActionBtnTextActive: {
    color: "#2563EB",
  },

  // Status Filter Tabs
  tabsWrapper: {
    backgroundColor: "#F8FAFC",
    paddingBottom: 10,
  },
  tabsContentContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  statusTabChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusTabChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  statusTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  statusTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  statusTabCount: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  statusTabCountActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  statusTabCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  statusTabCountTextActive: {
    color: "#FFFFFF",
  },

  // Main Container & List
  contentContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 90,
  },

  // Card Design
  cardWrapper: {
    marginBottom: 12,
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardColorStripe: {
    width: 5,
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },

  // Card Top Row
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerBadgesLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    flexWrap: "wrap",
  },
  orderNoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  orderNoText: {
    fontSize: 12,
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
    paddingHorizontal: 7,
    paddingVertical: 3,
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
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Customer & Site
  customerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  customerNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
  },
  cardOptionsBtn: {
    padding: 4,
    marginLeft: 6,
  },
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  siteNameText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
    flex: 1,
  },

  // 3-Column Spec Box
  specBox: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EDF2F7",
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 10,
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
    gap: 3,
    marginBottom: 3,
  },
  specLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.3,
  },
  specMixValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  specSubRate: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 1,
  },
  specVolumeValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },
  specDeliveredValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#059669",
  },
  specRemainingValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#D97706",
  },

  // Fulfillment Progress Section
  progressCardSection: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  progressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  progressTitleText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: "800",
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: "#E2E8F0",
    borderRadius: 2.5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2.5,
  },
  remainingNoticeRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  remainingLabel: {
    fontSize: 10,
    color: "#64748B",
  },

  // Dates & Meta Row
  datesBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    marginBottom: 10,
  },
  dateItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#CBD5E1",
  },
  dateLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  dateVal: {
    fontWeight: "600",
    color: "#1E293B",
  },

  // Card Footer Actions
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingTop: 6,
  },
  actionButtonsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionViewBtn: {
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
  actionViewText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  actionEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#99F6E4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionEditText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0D9488",
  },
  actionDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionDeleteText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
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

  // Floating Action Button
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 99,
  },

  // Modals & Action Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 37, 64, 0.45)",
    justifyContent: "flex-end",
  },
  filterModalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  filterModalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  sortOptionsList: {
    gap: 8,
    marginBottom: 16,
  },
  sortOptionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sortOptionItemActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  sortOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sortOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  sortOptionTextActive: {
    color: "#2563EB",
    fontWeight: "700",
  },
  resetFilterModalBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  resetFilterModalBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },

  // 3-Dots Action Sheet
  actionSheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  actionSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  actionSheetSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    maxWidth: 260,
  },
  actionSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  actionSheetIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  actionSheetItemContent: {
    flex: 1,
  },
  actionSheetItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  actionSheetItemSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
});
