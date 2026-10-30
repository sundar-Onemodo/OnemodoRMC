import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { AppHeader } from "@/components/ui/app-header";
import { RootState } from "@/store/store";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import axios from "axios";
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
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

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
}

const formatDateFriendly = (dateStr?: string | null): string => {
  if (!dateStr) return "-";
  try {
    const cleanDate = dateStr.split("T")[0];
    const parts = cleanDate.split("-");
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
        return `${day} ${months[month - 1]} ${year}`;
      }
    }
    return cleanDate;
  } catch {
    return dateStr;
  }
};

const formatTimeFriendly = (timeStr?: string | null): string => {
  if (!timeStr) return "-";
  try {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minStr = minutes < 10 ? `0${minutes}` : String(minutes);
      return `${hours}:${minStr} ${ampm}`;
    }
    if (timeStr.includes(":") && timeStr.length >= 5) {
      return timeStr.slice(0, 5);
    }
    return timeStr;
  } catch {
    return timeStr;
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
      const monthStr = months[d.getMonth()];
      const year = d.getFullYear();
      const datePart = `${day} ${monthStr} ${year}`;

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
        icon: "local-shipping",
      };
    case "scheduled":
      return {
        label: "Scheduled",
        bg: "#EFF6FF",
        text: "#2563EB",
        border: "#BFDBFE",
        dot: "#3B82F6",
        icon: "event-note",
      };
    case "batching":
    case "in_production":
      return {
        label: "Batching",
        bg: "#FEF3C7",
        text: "#D97706",
        border: "#FDE68A",
        dot: "#F59E0B",
        icon: "precision-manufacturing",
      };
    case "unloading":
    case "on_site":
      return {
        label: "Unloading",
        bg: "#E0F2FE",
        text: "#0284C7",
        border: "#BAE6FD",
        dot: "#0EA5E9",
        icon: "file-download",
      };
    case "completed":
    case "delivered":
      return {
        label: "Completed",
        bg: "#ECFDF5",
        text: "#059669",
        border: "#A7F3D0",
        dot: "#10B981",
        icon: "check-circle",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        bg: "#FEF2F2",
        text: "#DC2626",
        border: "#FECACA",
        dot: "#EF4444",
        icon: "cancel",
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
        icon: "info-outline",
      };
  }
};

export function normalizeStatusForApi(rawStatus: string): string {
  if (!rawStatus) return "scheduled";
  const s = rawStatus.toLowerCase().trim();
  if (s === "in transit" || s === "in_transit" || s === "intransit") {
    return "in_transit";
  }
  if (s === "completed" || s === "delivered") return "completed";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "scheduled") return "scheduled";
  return s.replace(/\s+/g, "_");
}

export const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled", dot: "#2563EB" },
  { value: "in_transit", label: "In Transit", dot: "#7C3AED" },
  { value: "completed", label: "Completed", dot: "#10B981" },
  { value: "cancelled", label: "Cancelled", dot: "#EF4444" },
];


export default function BatchingScheduleScreen() {
  const router = useRouter();
  const { token, plant_id, plant_name } = useSelector(
    (state: RootState) => state.auth,
  );

  const [schedules, setSchedules] = useState<BatchScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");

  const isFetchingRef = useRef(false);

  // Back Navigation strictly to /more (no .back or goBack)
  const handleBack = useCallback(() => {
    router.replace("/more" as any);
  }, [router]);

  // Handle Android hardware back press
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
        headers["Authorization"] = cleanToken.startsWith("Bearer")
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

        console.log("[BatchSchedule] Fetch response status:", response.status);
        const resData = response.data;
        let list: BatchScheduleItem[] = [];

        if (Array.isArray(resData?.data?.data)) {
          list = resData.data.data;
        } else if (Array.isArray(resData?.data)) {
          list = resData.data;
        }

        // Sort descending by ID so newly created schedules appear at the top!
        list.sort((a, b) => Number(b.id) - Number(a.id));
        console.log(
          "[BatchSchedule List API] Loaded",
          list.length,
          "schedules:",
          list.map((s) => ({
            schedule_id: s.id,
            pour_ref: s.pour_reference,
            sales_order_id: s.sales_order_id,
            site: s.site?.name,
          })),
        );

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

  // Filtered Schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter((item) => {
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
  }, [schedules, searchQuery]);

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

  // Navigate to Create Screen
  const handleNavigateToCreate = () => {
    router.push("/batching-schedule/createBatchSchedule" as any);
  };

  // Edit Batch Schedule (strictly when status is scheduled)
  const handleEditSchedule = (item: BatchScheduleItem) => {
    console.log("==========================================");
    console.log("[BatchSchedule List] EDIT CLICKED for Schedule #" + item.id);
    console.log("  -> sales_order_id:", item.sales_order_id);
    console.log("  -> site_id:", item.site_id, item.site?.name);
    console.log(
      "  -> mix_design_id:",
      item.mix_design_id,
      item.mix_design?.design_name || item.mix_design?.name,
    );
    console.log("  -> order_volume_m3:", item.order_volume_m3);
    console.log("  -> qty_m3:", item.qty_m3);
    console.log("  -> Full item clicked:", JSON.stringify(item));
    console.log("==========================================");
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

    return (
      <View style={styles.card}>
        {/* Card Header: Pour Ref + Small Edit (when scheduled) & Interactive Status Badge */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeftWrap}>
            <View style={styles.pourRefBadge}>
              <MaterialCommunityIcons
                name="clipboard-text-outline"
                size={14}
                color="#2563EB"
                style={{ marginRight: 5 }}
              />
              <Text style={styles.pourRefText}>
                {item.pour_reference || `BS-${item.id}`}
              </Text>
            </View>

            {(item.status || "").toLowerCase().trim() === "scheduled" && (
              <TouchableOpacity
                style={styles.smallEditBtn}
                onPress={() => handleEditSchedule(item)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="edit" size={13} color="#2563EB" />
                <Text style={styles.smallEditText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Top Status Badge */}
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
              style={[styles.statusDot, { backgroundColor: statusTheme.dot }]}
            />
            <Text style={[styles.statusText, { color: statusTheme.text }]}>
              {statusTheme.label}
            </Text>
          </View>
        </View>

        {/* Date & Pump Type Row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color="#64748B" />
            <Text style={styles.metaText}>
              {formatDateFriendly(item.schedule_date)}
            </Text>
          </View>

          <View style={styles.metaDivider} />

          <View style={styles.metaItem}>
            <MaterialCommunityIcons
              name="pipe-leak"
              size={14}
              color="#64748B"
            />
            <Text style={styles.metaText}>
              {formatPumpType(item.pump_type)}
            </Text>
          </View>
        </View>

        {/* Site Location */}
        <View style={styles.infoRow}>
          <View style={[styles.infoIconBg, { backgroundColor: "#FEF2F2" }]}>
            <Ionicons name="location" size={15} color="#DC2626" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>DELIVERY SITE</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {siteName}
            </Text>
          </View>
        </View>

        {/* Mix Design */}
        <View style={styles.infoRow}>
          <View style={[styles.infoIconBg, { backgroundColor: "#EFF6FF" }]}>
            <MaterialCommunityIcons
              name="cube-outline"
              size={15}
              color="#2563EB"
            />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>CONCRETE MIX SPEC</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {mixName}
            </Text>
          </View>
        </View>

        {/* Volume Metric Highlights (3-column box) */}
        <View style={styles.volumeBoxRow}>
          <View style={[styles.volumeBox, { backgroundColor: "#EFF6FF" }]}>
            <Text style={styles.volumeBoxLabel}>TRIP VOLUME</Text>
            <Text style={[styles.volumeBoxValue, { color: "#2563EB" }]}>
              {tripVol.toFixed(1)} <Text style={styles.volumeUnit}>m³</Text>
            </Text>
          </View>

          <View style={[styles.volumeBox, { backgroundColor: "#F8FAFC" }]}>
            <Text style={styles.volumeBoxLabel}>ORDER TOTAL</Text>
            <Text style={[styles.volumeBoxValue, { color: "#0F172A" }]}>
              {orderVol.toFixed(1)} <Text style={styles.volumeUnit}>m³</Text>
            </Text>
          </View>

          <View style={[styles.volumeBox, { backgroundColor: "#FFF7ED" }]}>
            <Text style={styles.volumeBoxLabel}>REMAINING</Text>
            <Text style={[styles.volumeBoxValue, { color: "#D97706" }]}>
              {remainingVol.toFixed(1)}{" "}
              <Text style={styles.volumeUnit}>m³</Text>
            </Text>
          </View>
        </View>

        {/* Milestone Schedule Times (Date & Time for Batching, Dispatch, ETA Site, Unload Start) */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineSectionTitle}>
            SCHEDULE TIMINGS (DATE & TIME)
          </Text>
          <View style={styles.timelineGrid}>
            {/* 1. Batching Time */}
            <View style={styles.timelineSlot}>
              <View style={styles.timelineSlotHeader}>
                <MaterialCommunityIcons
                  name="factory"
                  size={13}
                  color="#2563EB"
                />
                <Text style={styles.timelineSlotLabel}>Batching</Text>
              </View>
              <Text style={styles.timelineSlotDate}>
                {
                  formatDateTimeFriendly(item.batching_time, item.schedule_date)
                    .date
                }
              </Text>
              <Text style={styles.timelineSlotTime}>
                {
                  formatDateTimeFriendly(item.batching_time, item.schedule_date)
                    .time
                }
              </Text>
            </View>

            {/* 2. Dispatch Time */}
            <View style={styles.timelineSlot}>
              <View style={styles.timelineSlotHeader}>
                <MaterialIcons
                  name="local-shipping"
                  size={13}
                  color="#7C3AED"
                />
                <Text style={styles.timelineSlotLabel}>Dispatch</Text>
              </View>
              <Text style={styles.timelineSlotDate}>
                {
                  formatDateTimeFriendly(item.dispatch_time, item.schedule_date)
                    .date
                }
              </Text>
              <Text style={styles.timelineSlotTime}>
                {
                  formatDateTimeFriendly(item.dispatch_time, item.schedule_date)
                    .time
                }
              </Text>
            </View>

            {/* 3. ETA Site */}
            <View style={styles.timelineSlot}>
              <View style={styles.timelineSlotHeader}>
                <Ionicons name="location-outline" size={13} color="#059669" />
                <Text style={styles.timelineSlotLabel}>ETA Site</Text>
              </View>
              <Text style={styles.timelineSlotDate}>
                {formatDateTimeFriendly(item.eta_site, item.schedule_date).date}
              </Text>
              <Text style={styles.timelineSlotTime}>
                {formatDateTimeFriendly(item.eta_site, item.schedule_date).time}
              </Text>
            </View>

            {/* 4. Unloading Start */}
            <View style={styles.timelineSlot}>
              <View style={styles.timelineSlotHeader}>
                <MaterialCommunityIcons
                  name="download-outline"
                  size={13}
                  color="#D97706"
                />
                <Text style={styles.timelineSlotLabel}>Unload Start</Text>
              </View>
              <Text style={styles.timelineSlotDate}>
                {
                  formatDateTimeFriendly(
                    item.unloading_start,
                    item.schedule_date,
                  ).date
                }
              </Text>
              <Text style={styles.timelineSlotTime}>
                {
                  formatDateTimeFriendly(
                    item.unloading_start,
                    item.schedule_date,
                  ).time
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Notes Preview if available */}
        {item.notes ? (
          <View style={styles.notesContainer}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color="#64748B"
            />
            <Text style={styles.notesText} numberOfLines={2}>
              {item.notes}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2A4A" />

      {/* HEADER: matching statusbar color #0B2A4A */}
      <AppHeader
        title="Batching & Scheduling"
        backgroundColor="#0B2A4A"
        onBackPress={handleBack}
        showNotification={false}
      />

      {loading && !refreshing ? (
        <View style={styles.centeredLoader}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.centeredLoaderText}>
            Loading production batch schedules...
          </Text>
        </View>
      ) : (
        <>
          {/* TOP KPI & SEARCH SECTION */}
          <View style={styles.topSection}>
            {/* KPI Summary Cards */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>TOTAL SCHEDULES</Text>
                <Text style={styles.kpiValue}>{stats.totalSchedules}</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>TRIP VOLUME</Text>
                <Text style={[styles.kpiValue, { color: "#60A5FA" }]}>
                  {stats.totalTripVol} m³
                </Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>IN TRANSIT</Text>
                <Text style={[styles.kpiValue, { color: "#A78BFA" }]}>
                  {stats.inTransitCount}
                </Text>
              </View>
            </View>

            {/* SEARCH BAR */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search pour ref, site, mix spec, pump..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          </View>



          {/* ERROR MESSAGE */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => fetchSchedules(true)}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* LIST OF BATCH SCHEDULES */}
          <FlatList
            data={filteredSchedules}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderScheduleCard}
            contentContainerStyle={[styles.listContent, { paddingBottom: 95 }]}
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
                  name="calendar-clock-outline"
                  size={54}
                  color="#CBD5E1"
                />
                <Text style={styles.emptyTitle}>No Batch Schedules Found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? "Try resetting your search keyword."
                    : "No batch schedules registered for this plant yet. Tap below to create one."}
                </Text>
                <TouchableOpacity
                  style={styles.emptyCreateBtn}
                  onPress={handleNavigateToCreate}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyCreateBtnText}>
                    Create Batch Schedule
                  </Text>
                </TouchableOpacity>
              </View>
            }
          />

          {/* FLOATING ACTION BUTTON: CREATE BATCH SCHEDULE */}
          <TouchableOpacity
            style={styles.fabButton}
            onPress={handleNavigateToCreate}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
            <Text style={styles.fabText}>New Schedule</Text>
          </TouchableOpacity>
        </>
      )}

      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B2A4A",
  },
  topSection: {
    backgroundColor: "#0B2A4A",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  kpiRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  kpiDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "500",
  },
  filterSection: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    padding: 14,
    backgroundColor: "#F8FAFC",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  pourRefBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  pourRefText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1D4ED8",
    letterSpacing: 0.2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
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
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 10,
    gap: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#CBD5E1",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  infoIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 1,
  },
  volumeBoxRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  volumeBox: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  volumeBoxLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.4,
  },
  volumeBoxValue: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  volumeUnit: {
    fontSize: 10,
    fontWeight: "600",
  },
  progressContainer: {
    marginBottom: 10,
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 3,
  },
  timelineCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 6,
  },
  timelineSectionTitle: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  timelineGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  timelineSlot: {
    width: "48.5%",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  timelineSlotHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },
  timelineSlotLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  timelineSlotDate: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 1,
  },
  timelineSlotTime: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
  notesContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 4,
  },
  notesText: {
    fontSize: 11,
    color: "#475569",
    flex: 1,
    fontStyle: "italic",
  },
  hydrationAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 6,
  },
  hydrationAlertText: {
    fontSize: 11,
    color: "#B45309",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  emptyCreateBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "500",
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#DC2626",
    borderRadius: 4,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  fabButton: {
    position: "absolute",
    bottom: 24,
    right: 18,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    gap: 6,
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Centered Full-Screen Loader
  centeredLoader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 24,
  },
  centeredLoaderText: {
    marginTop: 14,
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },

  // Header & Small Edit Button
  headerLeftWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  smallEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  smallEditText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  statusBadgeInteractive: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },

  // Simple Status Dropdown Styles
  statusModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  simpleDropdownCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxWidth: 320,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  simpleDropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  simpleDropdownTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  simpleDropdownSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
  },
  simpleDropdownCloseBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  simpleDropdownLoading: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  simpleDropdownLoadingText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  simpleDropdownList: {
    paddingTop: 2,
    gap: 4,
  },
  simpleDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  simpleDropdownItemActive: {
    backgroundColor: "#EFF6FF",
  },
  simpleDropdownItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  simpleDropdownDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  simpleDropdownLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  simpleDropdownLabelActive: {
    fontWeight: "800",
    color: "#2563EB",
  },
});
