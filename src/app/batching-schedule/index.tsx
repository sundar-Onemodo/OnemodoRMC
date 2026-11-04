import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { RootState } from "@/store/store";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import {
  CustomAlertModal,
  AlertType,
  AlertButton,
  formatSubmissionError,
} from "@/components/ui/custom-alert-modal";

// ==========================================
// INTERFACES
// ==========================================

export interface BatchScheduleItem {
  id: number;
  plant_id?: number;
  sales_order_id?: number | null;
  batch_id?: number | null;
  dispatch_id?: number | null;
  schedule_date?: string;
  pour_reference?: string;
  site_id?: number;
  mix_design_id?: number;
  qty_m3?: string | number;
  order_volume_m3?: string | number;
  remaining_volume_m3?: string | number;
  vehicle_id?: number | string | null;
  driver_id?: number | string | null;
  pump_type?: string;
  pump_vehicle_id?: number | null;
  batching_time?: string | null;
  dispatch_time?: string | null;
  eta_site?: string | null;
  unloading_start?: string | null;
  unloading_end?: string | null;
  status?: string;
  notes?: string | null;
  hydration_age_minutes?: number;
  hydration_status?: string;
  turnaround_minutes?: number;
  transit_duration_minutes?: number;
  discharge_duration_minutes?: number;
  pour_progress_percent?: number;
  site?: {
    id: number;
    name: string;
    is_in_use?: boolean;
  } | null;
  mix_design?: {
    id: number;
    design_name?: string;
    name?: string;
    code?: string | null;
  } | null;
  vehicle?: {
    id: number;
    registration_number?: string;
    fleet_number?: string;
  } | null;
  driver?: {
    id: number;
    name?: string;
    phone?: string;
  } | null;
}

// ==========================================
// HELPERS
// ==========================================

const formatDateFriendly = (dateStr?: string | null): string => {
  if (!dateStr) return "-";
  try {
    const cleanDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.split(" ")[0];
    const parts = cleanDate.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      if (month >= 1 && month <= 12) {
        return `${String(day).padStart(2, "0")} ${months[month - 1]} ${year}`;
      }
    }
    return cleanDate;
  } catch {
    return dateStr;
  }
};

const formatDateTimeFriendly = (
  timeStr?: string | null,
  fallbackDateStr?: string | null,
): { date: string; time: string } => {
  if (!timeStr) return { date: "-", time: "-" };
  try {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      const monthStr = months[d.getMonth()];
      const year = d.getFullYear();
      const datePart = `${String(day).padStart(2, "0")} ${monthStr} ${year}`;

      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minStr = minutes < 10 ? `0${minutes}` : String(minutes);
      const timePart = `${hours}:${minStr} ${ampm}`;

      return { date: datePart, time: timePart };
    }
    const fallbackDate = fallbackDateStr
      ? formatDateFriendly(fallbackDateStr)
      : "-";
    if (timeStr.includes(":") && timeStr.length >= 5) {
      return { date: fallbackDate, time: timeStr.slice(0, 5) };
    }
    return { date: fallbackDate, time: timeStr };
  } catch {
    return { date: "-", time: timeStr || "-" };
  }
};

const formatPumpType = (type?: string | null): string => {
  if (!type) return "Direct Pour";
  switch (type.toLowerCase()) {
    case "direct_pour":
      return "Direct Pour";
    case "boom_pump":
      return "Boom Pump";
    case "line_pump":
      return "Line Pump";
    case "static_pump":
      return "Static Pump";
    default:
      return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
};

const getStatusTheme = (status?: string | null) => {
  const s = (status || "").toLowerCase().trim();
  switch (s) {
    case "in_transit":
    case "in-transit":
      return {
        label: "In Transit",
        bg: "#EDE9FE",
        text: "#7C3AED",
        border: "#DDD6FE",
        dot: "#8B5CF6",
        accent: "#7C3AED",
        icon: "airplane-outline" as const,
      };
    case "scheduled":
      return {
        label: "Scheduled",
        bg: "#EFF6FF",
        text: "#2563EB",
        border: "#BFDBFE",
        dot: "#3B82F6",
        accent: "#2563EB",
        icon: "calendar-outline" as const,
      };
    case "batching":
    case "in_production":
      return {
        label: "Batching",
        bg: "#FEF3C7",
        text: "#D97706",
        border: "#FDE68A",
        dot: "#F59E0B",
        accent: "#D97706",
        icon: "sync-outline" as const,
      };
    case "unloading":
    case "on_site":
      return {
        label: "Unloading",
        bg: "#E0F2FE",
        text: "#0284C7",
        border: "#BAE6FD",
        dot: "#0EA5E9",
        accent: "#0284C7",
        icon: "download-outline" as const,
      };
    case "completed":
    case "delivered":
      return {
        label: "Completed",
        bg: "#ECFDF5",
        text: "#059669",
        border: "#A7F3D0",
        dot: "#10B981",
        accent: "#059669",
        icon: "checkmark-circle-outline" as const,
      };
    case "cancelled":
      return {
        label: "Cancelled",
        bg: "#FEF2F2",
        text: "#DC2626",
        border: "#FECACA",
        dot: "#EF4444",
        accent: "#DC2626",
        icon: "close-circle-outline" as const,
      };
    default:
      return {
        label: (status || "Unknown")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        bg: "#F1F5F9",
        text: "#475569",
        border: "#CBD5E1",
        dot: "#64748B",
        accent: "#64748B",
        icon: "help-circle-outline" as const,
      };
  }
};

export async function deleteBatchScheduleApi(
  schedulesId: number | string,
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
  if (plantId !== null && plantId !== undefined) {
    headers["X-Plant-Id"] = String(plantId);
  }

  const params: Record<string, any> = {
    schedules_id: schedulesId,
  };
  if (plantId !== null && plantId !== undefined) {
    params.plant_id = plantId;
  }

  console.log(`[BatchSchedule Delete] DELETE ${baseURL}/batch-schedules/${schedulesId}`, {
    params,
    headers,
  });

  return await axios.delete(`${baseURL}/batch-schedules/${schedulesId}`, {
    headers,
    params,
  });
}

// ==========================================
// MAIN SCREEN COMPONENT
// ==========================================

export default function BatchingScheduleScreen() {
  const router = useRouter();
  const { token, plant_id } = useSelector((state: RootState) => state.auth);

  const [schedules, setSchedules] = useState<BatchScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "vol_high" | "vol_low">("newest");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [cardMenuSchedule, setCardMenuSchedule] = useState<BatchScheduleItem | null>(null);

  // Delete Schedule State
  const [deletingScheduleId, setDeletingScheduleId] = useState<number | null>(null);
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

  // Handle Android hardware back press
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

  const isFetchingRef = useRef(false);

  // Fetch Batch Schedules from API
  const fetchSchedules = useCallback(
    async (isManualRefresh = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);

      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) {
        const cleanToken = token.trim();
        headers["Authorization"] = cleanToken.startsWith("Bearer ")
          ? cleanToken
          : `Bearer ${cleanToken}`;
      }
      if (plant_id !== null && plant_id !== undefined) {
        headers["X-Plant-Id"] = String(plant_id);
      }

      try {
        const response = await axios.get(`${baseURL}/batch-schedules`, {
          headers,
          params: { page: 1, per_page: 50 },
          timeout: 20000,
        });

        const resData = response.data;
        let list: BatchScheduleItem[] = [];

        if (Array.isArray(resData?.data?.data)) {
          list = resData.data.data;
        } else if (Array.isArray(resData?.data)) {
          list = resData.data;
        }

        // Sort descending by ID
        list.sort((a, b) => Number(b.id) - Number(a.id));
        setSchedules(list);
      } catch (err: any) {
        console.warn(
          "[BatchSchedule] Error loading schedules:",
          err?.message || err,
        );
        const errMsg =
          err?.response?.data?.message ||
          err?.message ||
          "Could not load batching schedules. Please check connection.";
        setErrorMessage(errMsg);
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, plant_id],
  );

  // Refresh when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchSchedules();
    }, [fetchSchedules]),
  );

  // Delete Action (Allowed for all statuses as requested)
  const confirmDeleteSchedule = useCallback(
    async (item: BatchScheduleItem) => {
      hideAlert();
      setDeletingScheduleId(item.id);
      try {
        const res = await deleteBatchScheduleApi(item.id, token, plant_id);
        const successMsg =
          res.data?.message || "Batch schedule deleted successfully.";
        setSchedules((prev) => prev.filter((s) => s.id !== item.id));
        setAlertConfig({
          visible: true,
          title: "Deleted",
          message: successMsg,
          type: "success",
          buttons: [{ text: "OK", onPress: hideAlert }],
        });
        fetchSchedules(false);
      } catch (err: any) {
        const errMsg = formatSubmissionError(
          err,
          "Failed to delete batch schedule.",
        );
        setAlertConfig({
          visible: true,
          title: "Delete Failed",
          message: errMsg,
          type: "error",
          buttons: [{ text: "OK", onPress: hideAlert }],
        });
      } finally {
        setDeletingScheduleId(null);
      }
    },
    [hideAlert, token, plant_id, fetchSchedules],
  );

  const handlePromptDeleteSchedule = useCallback(
    (item: BatchScheduleItem) => {
      const scheduleLabel =
        item.pour_reference ||
        (item.sales_order_id ? `SO #${item.sales_order_id}` : null) ||
        `Schedule #${item.id}`;

      setAlertConfig({
        visible: true,
        title: "Delete Batch Schedule",
        message: `Are you sure you want to delete batch schedule "${scheduleLabel}"? This action cannot be undone.`,
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
            onPress: () => confirmDeleteSchedule(item),
          },
        ],
      });
    },
    [hideAlert, confirmDeleteSchedule],
  );

  // Tab Status Counts
  const counts = useMemo(() => {
    let scheduled = 0;
    let inTransit = 0;
    let unloading = 0;
    let completed = 0;
    let cancelled = 0;

    schedules.forEach((item) => {
      const s = (item.status || "").toLowerCase().trim();
      if (s === "scheduled") scheduled++;
      else if (s === "in_transit" || s === "in-transit") inTransit++;
      else if (s === "unloading" || s === "on_site") unloading++;
      else if (s === "completed" || s === "delivered") completed++;
      else if (s === "cancelled" || s === "canceled") cancelled++;
    });

    return {
      all: schedules.length,
      scheduled,
      inTransit,
      unloading,
      completed,
      cancelled,
    };
  }, [schedules]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalSchedules = schedules.length;
    let totalTripVol = 0;
    let totalOrderVol = 0;
    let inTransitCount = 0;

    schedules.forEach((item) => {
      const trip = parseFloat(String(item.qty_m3 || 0));
      const order = parseFloat(String(item.order_volume_m3 || 0));
      if (!isNaN(trip)) totalTripVol += trip;
      if (!isNaN(order)) totalOrderVol += order;

      const s = (item.status || "").toLowerCase();
      if (s === "in_transit" || s === "in-transit") {
        inTransitCount += 1;
      }
    });

    return {
      totalSchedules,
      totalTripVol: totalTripVol.toFixed(1),
      totalOrderVol: totalOrderVol.toFixed(1),
      inTransitCount,
    };
  }, [schedules]);

  // Filter Tabs definition
  const filterTabs = useMemo(() => {
    const tabs: { label: string; value: string; count: number }[] = [
      { label: "All", value: "All", count: counts.all },
      { label: "Scheduled", value: "scheduled", count: counts.scheduled },
      { label: "In Transit", value: "in_transit", count: counts.inTransit },
      ...(counts.unloading > 0
        ? [{ label: "Unloading", value: "unloading", count: counts.unloading }]
        : []),
      { label: "Completed", value: "completed", count: counts.completed },
      ...(counts.cancelled > 0
        ? [{ label: "Cancelled", value: "cancelled", count: counts.cancelled }]
        : []),
    ];
    return tabs;
  }, [counts]);

  // Filtered and Sorted Schedules
  const filteredSchedules = useMemo(() => {
    let result = schedules.filter((item) => {
      // Tab filter
      if (activeTab !== "All") {
        const s = (item.status || "").toLowerCase().trim();
        if (activeTab === "in_transit" && (s === "in_transit" || s === "in-transit")) {
          // match
        } else if (activeTab === "completed" && (s === "completed" || s === "delivered")) {
          // match
        } else if (s !== activeTab) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const refMatch = (item.pour_reference || "").toLowerCase().includes(q);
        const siteMatch = (item.site?.name || "").toLowerCase().includes(q);
        const mixMatch = (
          item.mix_design?.design_name ||
          item.mix_design?.name ||
          ""
        )
          .toLowerCase()
          .includes(q);
        const pumpMatch = (item.pump_type || "").toLowerCase().includes(q);
        const statusMatch = (item.status || "").toLowerCase().includes(q);

        return refMatch || siteMatch || mixMatch || pumpMatch || statusMatch;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "newest") return Number(b.id) - Number(a.id);
      if (sortBy === "oldest") return Number(a.id) - Number(b.id);
      if (sortBy === "vol_high") {
        const valA = parseFloat(String(a.qty_m3 || 0));
        const valB = parseFloat(String(b.qty_m3 || 0));
        return valB - valA;
      }
      if (sortBy === "vol_low") {
        const valA = parseFloat(String(a.qty_m3 || 0));
        const valB = parseFloat(String(b.qty_m3 || 0));
        return valA - valB;
      }
      return 0;
    });

    return result;
  }, [schedules, activeTab, searchQuery, sortBy]);

  // Navigate to Create Screen
  const handleNavigateToCreate = () => {
    router.push("/batching-schedule/createBatchSchedule" as any);
  };

  // Edit Batch Schedule (strictly when status is scheduled)
  const handleEditSchedule = (item: BatchScheduleItem) => {
    router.push({
      pathname: "/batching-schedule/editBatchScreen",
      params: {
        id: String(item.id),
        schedule: String(item.id),
        sales_order_id: String(item.sales_order_id || ""),
        data: JSON.stringify(item),
      },
    });
  };

  // Render individual card
  const renderScheduleCard = ({ item }: { item: BatchScheduleItem }) => {
    const statusTheme = getStatusTheme(item.status);
    const siteName =
      item.site?.name ||
      (item.site_id ? `Site #${item.site_id}` : "Project Site");
    const mixName =
      item.mix_design?.design_name ||
      item.mix_design?.name ||
      (item.mix_design_id
        ? `Mix Design #${item.mix_design_id}`
        : "Standard Mix");

    const tripVol = parseFloat(String(item.qty_m3 || 0));
    const orderVol = parseFloat(String(item.order_volume_m3 || 0));
    const remainingVol = parseFloat(String(item.remaining_volume_m3 || 0));

    const isScheduled = (item.status || "").toLowerCase().trim() === "scheduled";

    return (
      <View style={styles.cardWrapper}>
        <View style={styles.cardContainer}>
          {/* Vertical Color Stripe */}
          <View
            style={[
              styles.cardColorStripe,
              { backgroundColor: statusTheme.accent || statusTheme.dot },
            ]}
          />

          {/* Card Body */}
          <View style={styles.cardBody}>
            {/* Top Row: Pour Ref Badge + Status Pill Badge */}
            <View style={styles.cardTopRow}>
              <View style={styles.headerBadgesLeft}>
                <View style={styles.pourRefBadge}>
                  <MaterialCommunityIcons
                    name="clipboard-text-outline"
                    size={13}
                    color="#1E40AF"
                  />
                  <Text style={styles.pourRefText}>
                    {item.pour_reference || `BS-${item.id}`}
                  </Text>
                </View>

                {item.sales_order_id ? (
                  <View style={styles.soRefBadge}>
                    <Ionicons name="receipt-outline" size={11} color="#64748B" />
                    <Text style={styles.soRefText}>SO #{item.sales_order_id}</Text>
                  </View>
                ) : null}
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusTheme.bg,
                    borderColor: statusTheme.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: statusTheme.dot },
                  ]}
                />
                <Text style={[styles.statusText, { color: statusTheme.text }]}>
                  {statusTheme.label}
                </Text>
              </View>
            </View>

            {/* Delivery Site & 3-Dots Action Button */}
            <View style={styles.siteRow}>
              <View style={styles.siteLeft}>
                <Ionicons name="location-sharp" size={15} color="#EF4444" />
                <Text style={styles.siteNameText} numberOfLines={1}>
                  {siteName}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.cardOptionsBtn}
                onPress={() => setCardMenuSchedule(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Concrete Mix Spec */}
            <View style={styles.mixSpecRow}>
              <MaterialCommunityIcons
                name="cube-outline"
                size={14}
                color="#2563EB"
              />
              <Text style={styles.mixSpecText} numberOfLines={1}>
                {mixName}
              </Text>
            </View>

            {/* 3-Column Volume Highlights */}
            <View style={styles.specBox}>
              <View style={styles.specCol}>
                <View style={styles.specHeaderRow}>
                  <MaterialCommunityIcons
                    name="truck-delivery-outline"
                    size={13}
                    color="#2563EB"
                  />
                  <Text style={styles.specLabel}>Trip Vol</Text>
                </View>
                <Text
                  style={[styles.specValueText, { color: "#2563EB" }]}
                  numberOfLines={1}
                >
                  {tripVol.toFixed(1)} m³
                </Text>
              </View>

              <View style={styles.specDivider} />

              <View style={styles.specCol}>
                <View style={styles.specHeaderRow}>
                  <MaterialCommunityIcons
                    name="layers-triple-outline"
                    size={13}
                    color="#64748B"
                  />
                  <Text style={styles.specLabel}>Order Total</Text>
                </View>
                <Text
                  style={[styles.specValueText, { color: "#0F172A" }]}
                  numberOfLines={1}
                >
                  {orderVol.toFixed(1)} m³
                </Text>
              </View>

              <View style={styles.specDivider} />

              <View style={styles.specCol}>
                <View style={styles.specHeaderRow}>
                  <Ionicons name="hourglass-outline" size={13} color="#D97706" />
                  <Text style={styles.specLabel}>Remaining</Text>
                </View>
                <Text
                  style={[styles.specValueText, { color: "#D97706" }]}
                  numberOfLines={1}
                >
                  {remainingVol.toFixed(1)} m³
                </Text>
              </View>
            </View>

            {/* Milestone Schedule Times (Batching & Dispatch) */}
            <View style={styles.timingsCard}>
              <View style={styles.timingsCol}>
                <View style={styles.timingsHeaderRow}>
                  <MaterialCommunityIcons
                    name="factory"
                    size={12}
                    color="#2563EB"
                  />
                  <Text style={styles.timingsLabel}>Batching Time</Text>
                </View>
                <Text style={styles.timingsDateText}>
                  {
                    formatDateTimeFriendly(item.batching_time, item.schedule_date)
                      .date
                  }
                </Text>
                <Text style={styles.timingsTimeText}>
                  {
                    formatDateTimeFriendly(item.batching_time, item.schedule_date)
                      .time
                  }
                </Text>
              </View>

              <View style={styles.timingsDivider} />

              <View style={styles.timingsCol}>
                <View style={styles.timingsHeaderRow}>
                  <MaterialIcons
                    name="local-shipping"
                    size={12}
                    color="#7C3AED"
                  />
                  <Text style={styles.timingsLabel}>Dispatch Time</Text>
                </View>
                <Text style={styles.timingsDateText}>
                  {
                    formatDateTimeFriendly(item.dispatch_time, item.schedule_date)
                      .date
                  }
                </Text>
                <Text style={styles.timingsTimeText}>
                  {
                    formatDateTimeFriendly(item.dispatch_time, item.schedule_date)
                      .time
                  }
                </Text>
              </View>
            </View>

            {/* Dates & Pump Info Row */}
            <View style={styles.datesBar}>
              <View style={styles.dateItem}>
                <Ionicons name="calendar-outline" size={13} color="#64748B" />
                <Text style={styles.dateLabel}>
                  {formatDateFriendly(item.schedule_date)}
                </Text>
              </View>

              <View style={styles.dateDivider} />

              <View style={styles.dateItem}>
                <MaterialCommunityIcons
                  name="pipe-leak"
                  size={13}
                  color="#2563EB"
                />
                <Text style={styles.dateLabel}>
                  {formatPumpType(item.pump_type)}
                </Text>
              </View>
            </View>

            {/* Card Footer: Notes on Left & Action Buttons on Right */}
            <View style={styles.cardFooter}>
              <View style={styles.footerLeft}>
                {item.notes ? (
                  <View style={styles.notesContainer}>
                    <Ionicons
                      name="information-circle-outline"
                      size={13}
                      color="#64748B"
                    />
                    <Text style={styles.notesText} numberOfLines={1}>
                      {item.notes}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.actionButtonsGroup}>
                {/* Edit Button (when scheduled) */}
                {isScheduled && (
                  <TouchableOpacity
                    style={styles.actionEditBtn}
                    onPress={() => handleEditSchedule(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={14} color="#2563EB" />
                    <Text style={styles.actionEditText}>Edit</Text>
                  </TouchableOpacity>
                )}

                {/* Delete button (Allowed for ALL statuses as requested) */}
                <TouchableOpacity
                  style={styles.actionDeleteBtn}
                  onPress={() => handlePromptDeleteSchedule(item)}
                  activeOpacity={0.75}
                  disabled={deletingScheduleId === item.id}
                >
                  {deletingScheduleId === item.id ? (
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

        {/* Header Top: Back Button, Titles, Bell & Customized Batch Schedule Illustration */}
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
              <Text style={styles.headerMainTitle}>Batch Schedules</Text>
              <Text style={styles.headerSubtitle}>
                Production & Plant Dispatch
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() =>
                Alert.alert(
                  "Notifications",
                  "You have no unread notifications for batching schedules.",
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

            {/* Customized Batch Schedule Illustration (Calendar Dispatch Sheet with Transit Mixer Truck & Clock Badge) */}
            <View style={styles.headerGraphicWrapper}>
              <View style={styles.headerCalendarCard}>
                <View style={styles.headerCalendarTop} />
                <View style={styles.headerCalendarGridRow}>
                  <View style={styles.headerCalendarGridDot} />
                  <View style={styles.headerCalendarGridDot} />
                  <View style={styles.headerCalendarGridDot} />
                </View>
                <View style={styles.headerCalendarGridRow}>
                  <View style={styles.headerCalendarGridDot} />
                  <View
                    style={[
                      styles.headerCalendarGridDot,
                      { backgroundColor: "#2563EB" },
                    ]}
                  />
                  <View style={styles.headerCalendarGridDot} />
                </View>
                <View style={styles.headerMixerIcon}>
                  <MaterialCommunityIcons
                    name="dump-truck"
                    size={12}
                    color="#2563EB"
                  />
                </View>
              </View>
              <View style={styles.headerScheduleBadge}>
                <MaterialCommunityIcons
                  name="clock-fast"
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
                name="calendar-clock-outline"
                size={20}
                color="#2563EB"
              />
            </View>
            <View style={styles.kpiTextGroup}>
              <Text style={styles.kpiValueText}>{stats.totalSchedules}</Text>
              <Text style={styles.kpiLabelText}>Total Schedules</Text>
            </View>
          </View>

          <View style={styles.kpiItem}>
            <View style={[styles.kpiIconBox, { backgroundColor: "#F5F3FF" }]}>
              <MaterialIcons
                name="local-shipping"
                size={19}
                color="#7C3AED"
              />
            </View>
            <View style={styles.kpiTextGroup}>
              <Text style={styles.kpiValueText}>{stats.inTransitCount}</Text>
              <Text style={styles.kpiLabelText}>In Transit</Text>
            </View>
          </View>

          <View style={styles.kpiItem}>
            <View style={[styles.kpiIconBox, { backgroundColor: "#ECFDF5" }]}>
              <MaterialCommunityIcons
                name="cube-outline"
                size={18}
                color="#059669"
              />
            </View>
            <View style={styles.kpiTextGroup}>
              <Text style={styles.kpiValueText} numberOfLines={1}>
                {stats.totalTripVol} m³
              </Text>
              <Text style={styles.kpiLabelText}>Trip Volume</Text>
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
            placeholder="Search pour ref, site, mix spec, pump..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
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
                key={tab.value}
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
            <TouchableOpacity onPress={() => fetchSchedules(true)}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading / List / Empty State */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>
              Loading Batch Schedules...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredSchedules}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderScheduleCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchSchedules(true)}
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
                      : "calendar-clock-outline"
                  }
                  size={56}
                  color={errorMessage ? "#EF4444" : "#CBD5E1"}
                />
                <Text style={styles.emptyTitle}>
                  {errorMessage
                    ? "Failed to Load Schedules"
                    : "No Batch Schedules Found"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {errorMessage
                    ? errorMessage
                    : searchQuery.trim()
                      ? `No schedules matching "${searchQuery}".`
                      : activeTab !== "All"
                        ? "No schedules found for this status."
                        : "No batch schedules registered for this plant yet."}
                </Text>
                {errorMessage ? (
                  <TouchableOpacity
                    style={styles.emptyRetryBtn}
                    onPress={() => fetchSchedules(true)}
                  >
                    <Text style={styles.emptyRetryBtnText}>Tap to Retry</Text>
                  </TouchableOpacity>
                ) : (
                  (searchQuery.length > 0 || activeTab !== "All") && (
                    <TouchableOpacity
                      style={styles.emptyResetBtn}
                      onPress={() => {
                        setSearchQuery("");
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

        {/* Floating Action Button (Create Batch Schedule) */}
        <TouchableOpacity
          style={styles.fabButton}
          onPress={handleNavigateToCreate}
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
                <Text style={styles.filterModalTitle}>Filter & Sort Schedules</Text>
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
                { key: "oldest", label: "Oldest First", icon: "hourglass-outline" },
                { key: "vol_high", label: "Trip Vol: High to Low", icon: "trending-up" },
                { key: "vol_low", label: "Trip Vol: Low to High", icon: "trending-down" },
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
                    <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
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
              <Text style={styles.resetFilterModalBtnText}>Reset to Default</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 3-DOTS ACTION SHEET MODAL */}
      <Modal
        visible={!!cardMenuSchedule}
        transparent
        animationType="fade"
        onRequestClose={() => setCardMenuSchedule(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCardMenuSchedule(null)}
        >
          <View
            style={styles.actionSheetCard}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.actionSheetHeader}>
              <View>
                <Text style={styles.actionSheetTitle}>
                  {cardMenuSchedule?.pour_reference ||
                    `BS #${cardMenuSchedule?.id}`}
                </Text>
                <Text style={styles.actionSheetSubtitle} numberOfLines={1}>
                  {cardMenuSchedule?.site?.name || "Delivery Site"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCardMenuSchedule(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Action Item: Edit (when scheduled) */}
            {cardMenuSchedule &&
              (cardMenuSchedule.status || "").toLowerCase().trim() ===
                "scheduled" && (
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => {
                    const target = cardMenuSchedule;
                    setCardMenuSchedule(null);
                    if (target) handleEditSchedule(target);
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.actionSheetIconBox,
                      { backgroundColor: "#EFF6FF" },
                    ]}
                  >
                    <Ionicons name="create-outline" size={18} color="#2563EB" />
                  </View>
                  <View style={styles.actionSheetItemContent}>
                    <Text style={styles.actionSheetItemTitle}>Edit Schedule</Text>
                    <Text style={styles.actionSheetItemSub}>
                      Update quantities, driver, vehicle & timings
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

            {/* Action Item: Delete (Allowed for all statuses) */}
            {cardMenuSchedule && (
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => {
                  const target = cardMenuSchedule;
                  setCardMenuSchedule(null);
                  if (target) handlePromptDeleteSchedule(target);
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
                    Delete Batch Schedule
                  </Text>
                  <Text style={styles.actionSheetItemSub}>
                    Permanently delete this dispatch schedule
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

  // Customized Batch Schedule Illustration (Calendar Dispatch Sheet with Transit Mixer Truck & Clock Badge)
  headerGraphicWrapper: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  headerCalendarCard: {
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
  headerCalendarTop: {
    width: "100%",
    height: 5,
    backgroundColor: "#7C3AED",
    borderRadius: 2.5,
    marginBottom: 4,
  },
  headerCalendarGridRow: {
    flexDirection: "row",
    gap: 3,
    marginBottom: 3,
  },
  headerCalendarGridDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
  },
  headerMixerIcon: {
    position: "absolute",
    bottom: 3,
    right: 3,
  },
  headerScheduleBadge: {
    position: "absolute",
    bottom: -2,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#8B5CF6",
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

  // Main Content & List
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
  pourRefBadge: {
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
  pourRefText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E40AF",
  },
  soRefBadge: {
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
  soRefText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
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

  // Site Row
  siteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  siteLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
  },
  siteNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
  },
  cardOptionsBtn: {
    padding: 4,
    marginLeft: 6,
  },

  // Concrete Mix Row
  mixSpecRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  mixSpecText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
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
  specValueText: {
    fontSize: 13,
    fontWeight: "800",
  },

  // Timings Section
  timingsCard: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 8,
    marginBottom: 10,
  },
  timingsCol: {
    flex: 1,
    alignItems: "center",
  },
  timingsDivider: {
    width: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 2,
  },
  timingsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  timingsLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
  },
  timingsDateText: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
  },
  timingsTimeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 1,
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
    fontWeight: "500",
  },

  // Card Footer Actions
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
  },
  footerLeft: {
    flex: 1,
    marginRight: 8,
  },
  notesContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  notesText: {
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
    flex: 1,
  },
  actionButtonsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
