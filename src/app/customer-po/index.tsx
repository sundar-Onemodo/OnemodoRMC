import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { AppHeader } from "@/components/ui/app-header";
import { Colors } from "@/constants/theme";
import { fetchDropdowns, StatusDropdownOption } from "@/store/dropdownSlice";
import { AppDispatch, RootState } from "@/store/store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
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

export interface CustomerPOLineItem {
  id: number;
  mix_design_id: number;
  quantity: string | number;
  rate: string | number;
  tax_id: number | null;
  concrete_pump?: string | null;
  pump_rate?: string | number | null;
  untaxed_amount?: string | number | null;
  tax_amount?: string | number | null;
  amount_total?: string | number | null;
  mix_design?: {
    id: number;
    design_name?: string | null;
    name?: string | null;
  };
}

export interface CustomerPOItem {
  id: number;
  reference: string;
  customer_po_reference?: string | null;
  patron_id: number;
  site_id: number;
  order_date: string;
  status: number; // 0 = Draft, 1 = Confirmed, 2 = Completed
  is_tax_inclusive: boolean;
  amount_untaxed: number | string;
  amount_tax: number | string;
  amount_total: number | string;
  notes?: string | null;
  patron?: {
    id: number;
    legal_name: string;
  };
  site?: {
    id: number;
    name: string;
  };
  items?: CustomerPOLineItem[];
}

export const formatCurrency = (
  val: string | number | null | undefined,
): string => {
  if (val === null || val === undefined || val === "") return "₹0";
  const num =
    typeof val === "number"
      ? val
      : parseFloat(String(val).replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return "₹0";
  return "₹" + Math.round(num).toLocaleString("en-IN");
};

export const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
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
    const day = String(d.getDate()).padStart(2, "0");
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
};

export const getPOStatusMeta = (
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
        icon: "file-document-edit-outline",
      };
    case 1:
      return {
        label: found?.label || "Confirmed",
        color: "#2563EB",
        bgColor: "#EFF6FF",
        icon: "check-circle-outline",
      };
    case 2:
      return {
        label: found?.label || "Completed",
        color: "#059669",
        bgColor: "#ECFDF5",
        icon: "checkbox-marked-circle-outline",
      };
    default:
      return {
        label: found?.label || "Unknown",
        color: "#64748B",
        bgColor: "#F1F5F9",
        icon: "help-circle-outline",
      };
  }
};

export default function CustomerPOScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];

  const dispatch = useDispatch<AppDispatch>();
  const { customerPoStatuses, isLoaded: dropdownsLoaded } = useSelector(
    (state: RootState) => state.dropdowns,
  );

  const { token, plant_id, plant_name, user } = useSelector(
    (state: RootState) => state.auth,
  );

  const [poList, setPoList] = useState<CustomerPOItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"All" | number>("All");

  // Status Confirmation State
  const [selectedPoForStatus, setSelectedPoForStatus] =
    useState<CustomerPOItem | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] =
    useState<boolean>(false);
  const [targetStatus, setTargetStatus] = useState<number>(1);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [updatingPoId, setUpdatingPoId] = useState<number | null>(null);

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

  // Fetch Customer POs from API
  const fetchCustomerPOs = useCallback(
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

      const targetPlantId =
        plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;

      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      const cleanToken = token.trim();
      headers["Authorization"] = cleanToken.startsWith("Bearer ")
        ? cleanToken
        : `Bearer ${cleanToken}`;

      if (targetPlantId !== null && targetPlantId !== undefined) {
        headers["X-Plant-Id"] = String(targetPlantId);
      }

      const params: Record<string, any> = { page: 1, per_page: 50 };
      if (targetPlantId !== null && targetPlantId !== undefined) {
        params.plant_id = String(targetPlantId);
      }

      try {
        console.log(`[CustomerPO] Fetching from ${baseURL}/customer-pos`, {
          plantId: targetPlantId,
        });

        const res = await axios.get(`${baseURL}/customer-pos`, {
          headers,
          params,
          timeout: 45000,
        });

        if (res.data?.success && res.data?.data) {
          const apiData = res.data.data;
          const items: CustomerPOItem[] = Array.isArray(apiData.data)
            ? apiData.data
            : Array.isArray(apiData)
              ? apiData
              : [];
          console.log("[CustomerPO] Successfully loaded items:", items.length);
          setPoList(items);
        } else if (Array.isArray(res.data)) {
          setPoList(res.data);
        } else {
          setPoList([]);
        }
      } catch (err: any) {
        console.warn("[CustomerPO] Error loading list:", {
          message: err?.message,
          code: err?.code,
          status: err?.response?.status,
        });

        const isTimeout =
          err?.code === "ECONNABORTED" ||
          err?.message?.toLowerCase().includes("timeout") ||
          err?.message === "Network Error";

        const msg = isTimeout
          ? "Network timeout: The server took too long to respond. Tap retry."
          : err?.response?.data?.message ||
            err?.message ||
            "Failed to load customer POs.";
        setErrorMessage(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, plant_id, user],
  );

  // Update PO Status (Draft -> Confirmed, etc.)
  const handleUpdateStatus = useCallback(
    async (po: CustomerPOItem, newStatus: number) => {
      if (!token) {
        Alert.alert("Authentication Required", "Please log in again.");
        return;
      }
      try {
        setIsUpdatingStatus(true);
        setUpdatingPoId(po.id);

        const cleanToken = token.trim();
        const headers: Record<string, string> = {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: cleanToken.startsWith("Bearer ")
            ? cleanToken
            : `Bearer ${cleanToken}`,
        };
        const effectivePlantId =
          plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;
        if (effectivePlantId !== null && effectivePlantId !== undefined) {
          headers["X-Plant-Id"] = String(effectivePlantId);
        }

        const adminPoId = (po as any).admin_po_id || po.id;

        // Fetch complete Customer PO details before updating
        let fullPoData: any = null;
        try {
          console.log(
            `[CustomerPO] Fetching full PO details before status update for admin_po_id=${adminPoId}...`,
          );
          const detailRes = await axios.get(
            `${baseURL}/customer-pos/${adminPoId}`,
            {
              headers,
              params: {
                admin_po_id: adminPoId,
                // ...(effectivePlantId !== null && effectivePlantId !== undefined
                //   ? { plant_id: effectivePlantId }
                //   : {}),
              },
              timeout: 25000,
            },
          );
          fullPoData = detailRes.data?.data || detailRes.data;
          console.log(
            `[CustomerPO] Successfully fetched PO details:`,
            JSON.stringify(fullPoData, null, 2),
          );
        } catch (fetchErr: any) {
          console.warn(
            `[CustomerPO] Failed to fetch full details for admin_po_id=${adminPoId}:`,
            fetchErr?.response?.data || fetchErr?.message,
          );
        }

        const source = fullPoData || po;
        const patronId =
          source.patron_id ||
          source.patron?.id ||
          (po as any).patron_id ||
          po.patron?.id;
        const siteId =
          source.site_id ||
          source.site?.id ||
          (po as any).site_id ||
          po.site?.id;

        // Format order_date as YYYY-MM-DD
        let orderDate = "";
        const rawDate = source.order_date || po.order_date;
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            orderDate = `${y}-${m}-${day}`;
          } else {
            orderDate = String(rawDate).slice(0, 10);
          }
        }

        const rawItems =
          source.items ||
          (source as any).customer_po_items ||
          (source as any).line_items ||
          po.items ||
          [];
        const formattedItems = (rawItems || []).map((it: any) => ({
          mix_design_id: Number(it.mix_design_id || it.mix_design?.id || 0),
          quantity: parseFloat(String(it.quantity)) || 0,
          rate: parseFloat(String(it.rate)) || 0,
          tax_id: it.tax_id ? Number(it.tax_id) : it.tax?.id ? Number(it.tax.id) : null,
          concrete_pump: it.concrete_pump ? String(it.concrete_pump) : null,
          pump_rate: parseFloat(String(it.pump_rate)) || 0,
        }));

        const isTaxInclusive = Boolean(
          source.is_tax_inclusive !== undefined
            ? source.is_tax_inclusive
            : po.is_tax_inclusive,
        );
        const customerPoReference =
          (source.customer_po_reference ?? po.customer_po_reference)
            ?.toString()
            .trim() || null;
        const notes = (source.notes ?? po.notes)?.toString().trim() || null;

        const payload = {
          patron_id: Number(patronId),
          site_id: Number(siteId),
          order_date: orderDate,
          is_tax_inclusive: isTaxInclusive,
          customer_po_reference: customerPoReference,
          notes: notes,
          status: Number(newStatus),
          items: formattedItems,
        };

        const queryParams = {
          admin_po_id: adminPoId,
        };

        console.log(
          "==================== CHANGING CUSTOMER PO STATUS ====================",
        );
        console.log(`[CustomerPO] Method: PUT`);
        console.log(
          `[CustomerPO] Endpoint: ${baseURL}/customer-pos/${adminPoId}`,
        );
        console.log(
          `[CustomerPO] Path & Query Params:`,
          JSON.stringify(queryParams, null, 2),
        );
        console.log(`[CustomerPO] Headers:`, JSON.stringify(headers, null, 2));
        console.log(
          `[CustomerPO] Passing Entire Data (Payload):`,
          JSON.stringify(payload, null, 2),
        );
        console.log(
          "=====================================================================",
        );

        const res = await axios.put(
          `${baseURL}/customer-pos/${adminPoId}`,
          payload,
          {
            headers,
            params: queryParams,
            timeout: 30000,
          },
        );

        console.log(`[CustomerPO] PUT status response status:`, res.status);
        console.log(
          `[CustomerPO] PUT status response body:`,
          JSON.stringify(res.data, null, 2),
        );

        if (res.data?.success) {
          // Optimistically update item status
          setPoList((prev) =>
            prev.map((item) =>
              item.id === po.id || (item as any).admin_po_id === adminPoId
                ? { ...item, status: newStatus }
                : item,
            ),
          );
          setConfirmModalVisible(false);
          setSelectedPoForStatus(null);
          Alert.alert(
            "Status Updated",
            `Customer PO ${po.reference} status successfully changed to ${newStatus === 1 ? "Confirmed" : "Draft"}.`,
          );
          fetchCustomerPOs(true);
        } else {
          Alert.alert(
            "Update Failed",
            res.data?.message || "Failed to update status.",
          );
        }
      } catch (err: any) {
        console.warn(
          "[CustomerPO] PUT status error:",
          err?.response?.data || err?.message,
        );
        const errMsg =
          err?.response?.data?.message ||
          (err?.response?.data?.errors
            ? Object.values(err.response.data.errors).flat().join("\n")
            : null) ||
          err?.message ||
          "Failed to update customer purchase order status.";
        Alert.alert("Error", errMsg);
      } finally {
        setIsUpdatingStatus(false);
        setUpdatingPoId(null);
      }
    },
    [token, plant_id, user, fetchCustomerPOs],
  );

  useEffect(() => {
    fetchCustomerPOs(false);
    if (!dropdownsLoaded) {
      dispatch(fetchDropdowns());
    }
  }, [fetchCustomerPOs, dropdownsLoaded, dispatch]);

  const onRefresh = async () => {
    if (refreshing) return;
    await fetchCustomerPOs(true);
  };

  // Status Tab Counts
  const counts = useMemo(() => {
    let draft = 0;
    let confirmed = 0;
    let completed = 0;

    poList.forEach((po) => {
      const s = Number(po.status);
      if (s === 0) draft++;
      else if (s === 1) confirmed++;
      else if (s === 2) completed++;
    });

    return {
      all: poList.length,
      draft,
      confirmed,
      completed,
    };
  }, [poList]);

  // Filtered List
  const filteredList = useMemo(() => {
    return poList.filter((item) => {
      // Tab filter
      if (activeTab !== "All" && Number(item.status) !== activeTab) {
        return false;
      }
      // Search query
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const refMatch = item.reference?.toLowerCase().includes(q);
        const poRefMatch = item.customer_po_reference
          ?.toLowerCase()
          .includes(q);
        const patronMatch = item.patron?.legal_name?.toLowerCase().includes(q);
        const siteMatch = item.site?.name?.toLowerCase().includes(q);
        return Boolean(refMatch || poRefMatch || patronMatch || siteMatch);
      }
      return true;
    });
  }, [poList, activeTab, search]);

  // Render Card Item
  const renderItem = ({ item }: { item: CustomerPOItem }) => {
    const statusMeta = getPOStatusMeta(item.status, customerPoStatuses);
    const totalVolume = (item.items || []).reduce((acc, curr) => {
      return acc + (parseFloat(String(curr.quantity)) || 0);
    }, 0);

    const firstPump = item.items?.find((i) => i.concrete_pump)?.concrete_pump;

    return (
      <View style={styles.cardContainer}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.referenceGroup}>
            <View style={styles.refRow}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={18}
                color="#2563EB"
              />
              <Text style={styles.referenceText}>{item.reference}</Text>
            </View>

            {item.customer_po_reference ? (
              <View style={styles.poRefBadge}>
                <Text style={styles.poRefBadgeText}>
                  Ref: {item.customer_po_reference}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusMeta.bgColor },
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

        {/* Divider */}
        <View style={styles.cardDivider} />

        {/* Customer & Site Details */}
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color="#64748B" />
            <Text style={styles.infoLabel}>Customer:</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {item.patron?.legal_name || "Unknown Customer"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#DC2626" />
            <Text style={styles.infoLabel}>Site:</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {item.site?.name || "Unassigned Site"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#64748B" />
            <Text style={styles.infoLabel}>Order Date:</Text>
            <Text style={styles.infoValueDate}>
              {formatDate(item.order_date)}
            </Text>
          </View>

          {/* Spec & Pump preview */}
          <View style={styles.specChipsRow}>
            {totalVolume > 0 && (
              <View style={styles.specChip}>
                <MaterialCommunityIcons
                  name="cube-outline"
                  size={13}
                  color="#2563EB"
                />
                <Text style={styles.specChipText}>{totalVolume} m³</Text>
              </View>
            )}

            {firstPump ? (
              <View style={styles.specChip}>
                <MaterialCommunityIcons
                  name="pipe-leak"
                  size={13}
                  color="#7C3AED"
                />
                <Text style={[styles.specChipText, { color: "#7C3AED" }]}>
                  {firstPump}
                </Text>
              </View>
            ) : null}

            {/* Tax Inclusive / Exclusive Badge */}
            <View
              style={[
                styles.taxBadge,
                item.is_tax_inclusive
                  ? styles.taxInclBadge
                  : styles.taxExclBadge,
              ]}
            >
              <Text
                style={[
                  styles.taxBadgeText,
                  item.is_tax_inclusive
                    ? styles.taxInclBadgeText
                    : styles.taxExclBadgeText,
                ]}
              >
                {item.is_tax_inclusive ? "Tax Inclusive" : "Tax Exclusive"}
              </Text>
            </View>
          </View>
        </View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.amountWrap}>
            <Text style={styles.amountLabel}>Total Value</Text>
            <Text style={styles.amountValue}>
              {formatCurrency(item.amount_total)}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            {Number(item.status) === 0 && (
              <TouchableOpacity
                style={styles.confirmQuickBtn}
                onPress={() => {
                  setSelectedPoForStatus(item);
                  setTargetStatus(1);
                  setConfirmModalVisible(true);
                }}
                activeOpacity={0.8}
                disabled={isUpdatingStatus && updatingPoId === item.id}
              >
                {isUpdatingStatus && updatingPoId === item.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={15}
                      color="#FFFFFF"
                    />
                    <Text style={styles.confirmQuickBtnText}>Confirm</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Action Button: Edit */}
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() =>
                router.push({
                  pathname: "/customer-po/editCustomerPO" as any,
                  params: {
                    admin_po_id: String(item.id),
                  },
                })
              }
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={16} color="#2563EB" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const tabs: { label: string; value: "All" | number; count: number }[] =
    useMemo(() => {
      const list: { label: string; value: "All" | number; count: number }[] = [
        { label: "All", value: "All", count: counts.all },
      ];
      if (customerPoStatuses && customerPoStatuses.length > 0) {
        customerPoStatuses.forEach((st) => {
          let count = 0;
          if (st.value === 0) count = counts.draft;
          else if (st.value === 1) count = counts.confirmed;
          else if (st.value === 2) count = counts.completed;
          else {
            count = poList.filter(
              (po) => Number(po.status) === Number(st.value),
            ).length;
          }
          list.push({ label: st.label, value: Number(st.value), count });
        });
      } else {
        list.push(
          { label: "Draft", value: 0, count: counts.draft },
          { label: "Confirmed", value: 1, count: counts.confirmed },
          { label: "Completed", value: 2, count: counts.completed },
        );
      }
      return list;
    }, [customerPoStatuses, counts, poList]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.headerBgColor }]}
      edges={["top"]}
    >
      <AppHeader
        title="Customer PO"
        onBackPress={handleBack}
        showNotification={false}
        rightElement={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => router.push("/customer-po/createCustomerPO" as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      <View style={styles.mainContainer}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search reference, customer, or site..."
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

        {/* Filter Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScrollContent}
          >
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.value;
              return (
                <TouchableOpacity
                  key={tab.label}
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
                      styles.tabCountBadge,
                      isSelected && styles.tabCountBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabCountText,
                        isSelected && styles.tabCountTextActive,
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

        {/* Error Banner */}
        {errorMessage && (
          <View style={styles.errorNotice}>
            <Ionicons name="warning-outline" size={16} color="#DC2626" />
            <Text style={styles.errorNoticeText}>{errorMessage}</Text>
            <TouchableOpacity onPress={() => fetchCustomerPOs(false)}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Center Loader or FlatList */}
        {loading && !refreshing ? (
          <View style={styles.centerLoadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.centerLoadingText}>
              Loading Customer Purchase Orders...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredList}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
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
                    ? "Failed to Load Customer POs"
                    : "No Customer POs Found"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {errorMessage
                    ? errorMessage
                    : search.trim()
                      ? `No orders matching "${search}".`
                      : activeTab !== "All"
                        ? "No customer POs found for this status."
                        : "No customer purchase orders recorded yet."}
                </Text>
                {errorMessage ? (
                  <TouchableOpacity
                    style={[
                      styles.emptyResetBtn,
                      { backgroundColor: "#2563EB" },
                    ]}
                    onPress={() => fetchCustomerPOs(false)}
                  >
                    <Text
                      style={[styles.emptyResetBtnText, { color: "#FFFFFF" }]}
                    >
                      Tap to Retry
                    </Text>
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

        {/* FAB: Create Customer PO */}
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => router.push("/customer-po/createCustomerPO" as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* CONFIRMATION DIALOG MODAL */}
        <Modal
          visible={confirmModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!isUpdatingStatus) setConfirmModalVisible(false);
          }}
        >
          <View style={styles.modalOverlayCenter}>
            <View style={styles.confirmDialogBox}>
              <View style={styles.confirmDialogIconWrap}>
                <MaterialCommunityIcons
                  name="shield-check"
                  size={32}
                  color="#2563EB"
                />
              </View>

              <Text style={styles.confirmDialogTitle}>Confirm Customer PO</Text>

              <Text style={styles.confirmDialogDesc}>
                {`Are you sure you want to mark ${selectedPoForStatus?.reference || "this PO"} as Confirmed? This will confirm the purchase order.`}
              </Text>

              <View style={styles.confirmSummaryCard}>
                <View style={styles.confirmSummaryRow}>
                  <Text style={styles.confirmSummaryLabel}>Customer:</Text>
                  <Text style={styles.confirmSummaryVal} numberOfLines={1}>
                    {selectedPoForStatus?.patron?.legal_name || "N/A"}
                  </Text>
                </View>
                <View style={styles.confirmSummaryRow}>
                  <Text style={styles.confirmSummaryLabel}>Total Value:</Text>
                  <Text
                    style={[
                      styles.confirmSummaryVal,
                      { color: "#2563EB", fontWeight: "800" },
                    ]}
                  >
                    {formatCurrency(selectedPoForStatus?.amount_total)}
                  </Text>
                </View>
              </View>

              <View style={styles.confirmDialogButtons}>
                <TouchableOpacity
                  style={styles.confirmCancelBtn}
                  onPress={() => setConfirmModalVisible(false)}
                  disabled={isUpdatingStatus}
                  activeOpacity={0.75}
                >
                  <Text style={styles.confirmCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmSubmitBtn}
                  onPress={() => {
                    if (selectedPoForStatus) {
                      handleUpdateStatus(selectedPoForStatus, targetStatus);
                    }
                  }}
                  disabled={isUpdatingStatus}
                  activeOpacity={0.8}
                >
                  {isUpdatingStatus ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmSubmitBtnText}>
                      Yes, Confirm
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  searchContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
  },
  tabsContainer: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: "#2563EB",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
  },
  tabCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  tabCountBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  tabCountTextActive: {
    color: "#FFFFFF",
  },
  errorNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#FCA5A5",
    gap: 8,
  },
  errorNoticeText: {
    flex: 1,
    fontSize: 13,
    color: "#DC2626",
  },
  retryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  centerLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  centerLoadingText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
    gap: 12,
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  referenceGroup: {
    flex: 1,
    marginRight: 8,
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  referenceText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  poRefBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  poRefBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 10,
  },
  cardBody: {
    gap: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: "#64748B",
    width: 80,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  infoValueDate: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  specChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  specChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  specChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },
  taxBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  taxInclBadge: {
    backgroundColor: "#ECFDF5",
  },
  taxInclBadgeText: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "700",
  },
  taxExclBadge: {
    backgroundColor: "#F1F5F9",
  },
  taxExclBadgeText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
  },
  taxBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  amountWrap: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
    textTransform: "uppercase",
  },
  amountValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 1,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  emptyResetBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  emptyResetBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
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
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  interactiveStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confirmQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmQuickBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  confirmDialogBox: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmDialogIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  confirmDialogTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  confirmDialogDesc: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 16,
  },
  confirmSummaryCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
    marginBottom: 18,
  },
  confirmSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confirmSummaryLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  confirmSummaryVal: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    maxWidth: "70%",
    textAlign: "right",
  },
  confirmDialogButtons: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmCancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  confirmSubmitBtn: {
    flex: 1.3,
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmSubmitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
