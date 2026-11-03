import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { Colors } from "@/constants/theme";
import { fetchDropdowns, StatusDropdownOption } from "@/store/dropdownSlice";
import { AppDispatch, RootState } from "@/store/store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  CustomAlertModal,
  AlertType,
  AlertButton,
  formatSubmissionError,
} from "@/components/ui/custom-alert-modal";

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
  quotation_id?: number | null;
  sales_executive_id?: number | null;
  sales_executive?: any;
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
  sales_orders?: any[];
}

export async function deleteCustomerPOApi(
  poId: number | string,
  token?: string | null,
  plantId?: number | null,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const params: Record<string, any> = {
    admin_delete_po_id: poId,
  };
  if (plantId) params.plant_id = plantId;

  console.log(`[CustomerPO Delete] DELETE ${baseURL}/customer-pos/${poId}`, {
    params,
    headers,
  });

  return await axios.delete(`${baseURL}/customer-pos/${poId}`, {
    headers,
    params,
  });
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

export const formatVolume = (
  val: number | string | null | undefined,
): string => {
  if (val === null || val === undefined || val === "") return "0";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) return "0";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
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
        borderColor: "#FDE68A",
        accent: "#F59E0B",
        icon: "pencil" as const,
      };
    case 1:
      return {
        label: found?.label || "Confirmed",
        color: "#2563EB",
        bgColor: "#EFF6FF",
        borderColor: "#BFDBFE",
        accent: "#2563EB",
        icon: "checkmark-circle" as const,
      };
    case 2:
      return {
        label: found?.label || "Completed",
        color: "#059669",
        bgColor: "#ECFDF5",
        borderColor: "#A7F3D0",
        accent: "#16A34A",
        icon: "shield-checkmark" as const,
      };
    default:
      return {
        label: found?.label || "Unknown",
        color: "#64748B",
        bgColor: "#F1F5F9",
        borderColor: "#E2E8F0",
        accent: "#64748B",
        icon: "help-circle-outline" as const,
      };
  }
};

export interface GenerateSOLineItem {
  item_id: number;
  mix_design_id?: number | null;
  mix_design_name: string;
  po_qty: number;
  converted_qty: number;
  remaining_qty: number;
  so_qty: string;
  concrete_pump: number | string | null;
}

export const formatPumpType = (type?: any): string => {
  if (!type) return "";
  if (typeof type === "object") {
    return String(type.label || type.name || type.value || type.id || "");
  }
  const str = String(type);
  return str
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

export default function CustomerPOScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];

  const dispatch = useDispatch<AppDispatch>();
  const {
    customerPoStatuses,
    pumps,
    isLoaded: dropdownsLoaded,
  } = useSelector((state: RootState) => state.dropdowns);

  const { token, plant_id, plant_name, user } = useSelector(
    (state: RootState) => state.auth,
  );

  const [poList, setPoList] = useState<CustomerPOItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"All" | number>("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "value_high" | "value_low">("newest");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [cardMenuPO, setCardMenuPO] = useState<CustomerPOItem | null>(null);

  // Status Confirmation State
  const [selectedPoForStatus, setSelectedPoForStatus] =
    useState<CustomerPOItem | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] =
    useState<boolean>(false);
  const [targetStatus, setTargetStatus] = useState<number>(1);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [updatingPoId, setUpdatingPoId] = useState<number | null>(null);

  // Delete PO State
  const [deletingPoId, setDeletingPoId] = useState<number | null>(null);
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

  // Generate Sales Order Modal States
  const [generateModalVisible, setGenerateModalVisible] =
    useState<boolean>(false);
  const [selectedPoForGen, setSelectedPoForGen] =
    useState<CustomerPOItem | null>(null);
  const [genModalLoading, setGenModalLoading] = useState<boolean>(false);
  const [genModalPoData, setGenModalPoData] = useState<any | null>(null);
  const [genModalItems, setGenModalItems] = useState<GenerateSOLineItem[]>([]);
  const [isGeneratingSO, setIsGeneratingSO] = useState<boolean>(false);
  const [pumpPickerVisible, setPumpPickerVisible] = useState<boolean>(false);
  const [activePumpRowIndex, setActivePumpRowIndex] = useState<number | null>(
    null,
  );

  const pumpOptionsList = useMemo(() => {
    const list: { label: string; value: number | null }[] = [
      { label: "None / Direct Pour", value: null },
    ];
    if (Array.isArray(pumps) && pumps.length > 0) {
      pumps.forEach((p: any) => {
        if (!p) return;
        const id = p.id ?? p.value;
        const label = p.label || p.registration || `Pump #${id}`;
        if (id !== undefined && id !== null) {
          list.push({
            label: String(label),
            value: Number(id),
          });
        }
      });
    }
    return list;
  }, [pumps]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/more" as any);
    }
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

  const fetchCustomerPOs = useCallback(
    async (isPullRefresh: boolean = false) => {
      if (!token) {
        setLoading(false);
        return;
      }
      if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);

      try {
        const targetPlantId =
          plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;
        const headers: Record<string, string> = {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: token.startsWith("Bearer ")
            ? token
            : `Bearer ${token}`,
        };
        if (targetPlantId) headers["X-Plant-Id"] = String(targetPlantId);

        const params: Record<string, any> = {};
        if (targetPlantId) params.plant_id = String(targetPlantId);

        const res = await axios.get(`${baseURL}/customer-pos`, {
          headers,
          params,
          timeout: 25000,
        });

        let dataArray: CustomerPOItem[] = [];
        if (res.data?.success && res.data?.data) {
          dataArray = Array.isArray(res.data.data.data)
            ? res.data.data.data
            : Array.isArray(res.data.data)
              ? res.data.data
              : [];
        } else if (Array.isArray(res.data)) {
          dataArray = res.data;
        }

        setPoList(dataArray);
      } catch (err: any) {
        console.warn("Fetch POs note:", err?.message || err);
        const errMsg =
          err?.response?.data?.message ||
          err?.message ||
          "Could not load customer purchase orders.";
        setErrorMessage(errMsg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, plant_id, user],
  );

  const confirmDeletePO = useCallback(
    async (item: CustomerPOItem) => {
      hideAlert();
      setDeletingPoId(item.id);
      try {
        const targetPlantId =
          plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;
        const res = await deleteCustomerPOApi(item.id, token, targetPlantId);
        const successMsg =
          res.data?.message || "Customer PO deleted successfully.";
        setPoList((prev) => prev.filter((p) => p.id !== item.id));
        setAlertConfig({
          visible: true,
          title: "Deleted",
          message: successMsg,
          type: "success",
          buttons: [{ text: "OK", onPress: hideAlert }],
        });
        fetchCustomerPOs(false);
      } catch (err: any) {
        const errMsg = formatSubmissionError(
          err,
          "Failed to delete Customer PO.",
        );
        setAlertConfig({
          visible: true,
          title: "Delete Failed",
          message: errMsg,
          type: "error",
          buttons: [{ text: "OK", onPress: hideAlert }],
        });
      } finally {
        setDeletingPoId(null);
      }
    },
    [hideAlert, token, plant_id, user, fetchCustomerPOs],
  );

  const handlePromptDeletePO = useCallback(
    (item: CustomerPOItem) => {
      setAlertConfig({
        visible: true,
        title: "Delete Customer PO",
        message: `Are you sure you want to delete Customer PO "${item.reference || `#${item.id}`}"? This action cannot be undone.`,
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
            onPress: () => confirmDeletePO(item),
          },
        ],
      });
    },
    [hideAlert, confirmDeletePO],
  );

  const handleOpenGenerateSO = (po: CustomerPOItem) => {
    setSelectedPoForGen(po);
    setGenModalPoData(po);
    setGenModalLoading(false);

    const rawItems = Array.isArray(po?.items) ? po.items : [];
    const salesOrders = Array.isArray((po as any)?.sales_orders)
      ? (po as any).sales_orders
      : [];

    const mappedItems: GenerateSOLineItem[] = rawItems.map(
      (it: any, idx: number) => {
        const mixName =
          it.mix_design?.design_name ||
          it.mix_design?.name ||
          it.mix_design?.design_code ||
          it.mix_design_name ||
          `Mix #${it.mix_design_id || idx + 1}`;

        const poQty = parseFloat(String(it.quantity || 0)) || 0;
        const mixId = it.mix_design_id ?? it.mix_design?.id;

        let conv = 0;
        const matchingSOs = salesOrders.filter((so: any) => {
          if (so.customer_po_item_id && it.id) {
            return Number(so.customer_po_item_id) === Number(it.id);
          }
          if (mixId && so.mix_design_id) {
            return Number(so.mix_design_id) === Number(mixId);
          }
          return false;
        });

        matchingSOs.forEach((so: any) => {
          conv += parseFloat(String(so.total_qty || so.quantity || 0)) || 0;
        });

        const rem = Math.max(0, parseFloat((poQty - conv).toFixed(2)));

        return {
          item_id: it.id || idx + 1,
          mix_design_id: mixId || null,
          mix_design_name: mixName,
          po_qty: poQty,
          converted_qty: parseFloat(conv.toFixed(2)),
          remaining_qty: rem,
          so_qty: rem > 0 ? String(rem) : "0",
          concrete_pump: it.concrete_pump ? Number(it.concrete_pump) : null,
        };
      },
    );

    setGenModalItems(mappedItems);
    setGenerateModalVisible(true);
  };

  const handleSOQtyChange = (index: number, val: string) => {
    setGenModalItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], so_qty: val };
      return copy;
    });
  };

  const handleSOPumpSelect = (pumpValue: number | null) => {
    if (activePumpRowIndex === null) return;
    setGenModalItems((prev) => {
      const copy = [...prev];
      copy[activePumpRowIndex] = {
        ...copy[activePumpRowIndex],
        concrete_pump: pumpValue,
      };
      return copy;
    });
    setPumpPickerVisible(false);
    setActivePumpRowIndex(null);
  };

  const handleSubmitGenerateSO = async () => {
    if (!selectedPoForGen) return;

    const itemsToSubmit = genModalItems
      .filter((row) => parseFloat(row.so_qty) > 0)
      .map((row) => ({
        customer_po_item_id: row.item_id,
        mix_design_id: row.mix_design_id,
        quantity: parseFloat(row.so_qty),
        concrete_pump: row.concrete_pump ?? null,
      }));

    if (itemsToSubmit.length === 0) {
      Alert.alert(
        "Validation Error",
        "Please specify a SO quantity greater than 0 for at least one mix design.",
      );
      return;
    }

    const payload = {
      customer_po_id: selectedPoForGen.id,
      items: itemsToSubmit,
    };

    setIsGeneratingSO(true);
    try {
      const targetPlantId =
        plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = token.startsWith("Bearer ")
          ? token
          : `Bearer ${token}`;
      }
      if (targetPlantId) headers["X-Plant-Id"] = String(targetPlantId);

      const res = await axios.post(
        `${baseURL}/customer-pos/${selectedPoForGen.id}/generate-sales-order`,
        payload,
        {
          headers,
          params: { customer_po: selectedPoForGen.id },
          timeout: 25000,
        },
      );

      setGenerateModalVisible(false);
      Alert.alert(
        "Success",
        res.data?.message ||
          "Sales Order(s) generated successfully from this Customer PO.",
        [
          {
            text: "View Sales Orders",
            onPress: () => router.push("/sales-order" as any),
          },
          { text: "OK", style: "cancel" },
        ],
      );
      fetchCustomerPOs(false);
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to generate sales order.";
      Alert.alert("Error", errMsg);
    } finally {
      setIsGeneratingSO(false);
    }
  };

  const handleUpdateStatus = async (
    poItem: CustomerPOItem,
    newStatus: number,
  ) => {
    setIsUpdatingStatus(true);
    setUpdatingPoId(poItem.id);

    try {
      const targetPlantId =
        plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = token.startsWith("Bearer ")
          ? token
          : `Bearer ${token}`;
      }
      if (targetPlantId) headers["X-Plant-Id"] = String(targetPlantId);

      const payload = {
        status: newStatus,
      };

      const res = await axios.put(
        `${baseURL}/customer-pos/${poItem.id}`,
        payload,
        {
          headers,
          params: { customer_po: poItem.id },
          timeout: 20000,
        },
      );

      setPoList((prev) =>
        prev.map((item) =>
          item.id === poItem.id ? { ...item, status: newStatus } : item,
        ),
      );

      setConfirmModalVisible(false);
      Alert.alert(
        "Status Updated",
        res.data?.message || "Customer PO status updated successfully.",
      );
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to update customer purchase order status.";
      Alert.alert("Error", errMsg);
    } finally {
      setIsUpdatingStatus(false);
      setUpdatingPoId(null);
    }
  };

  useEffect(() => {
    fetchCustomerPOs(false);
    if (!dropdownsLoaded || !pumps || pumps.length === 0) {
      dispatch(fetchDropdowns());
    }
  }, [fetchCustomerPOs, dropdownsLoaded, pumps, dispatch]);

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

  // Overall Summary Stats for KPI Strip
  const stats = useMemo(() => {
    let totalVolume = 0;
    let totalValue = 0;

    poList.forEach((po) => {
      if (Array.isArray(po.items)) {
        po.items.forEach((it: any) => {
          totalVolume += parseFloat(String(it.quantity)) || 0;
        });
      }
      totalValue += parseFloat(String(po.amount_total)) || 0;
    });

    return {
      totalCount: poList.length,
      totalVolume,
      totalValue,
    };
  }, [poList]);

  // Filtered List
  const filteredList = useMemo(() => {
    const list = poList.filter((item) => {
      if (activeTab !== "All" && Number(item.status) !== activeTab) {
        return false;
      }
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

    return list.sort((a, b) => {
      if (sortBy === "value_high") {
        return (
          (parseFloat(String(b.amount_total || 0)) || 0) -
          (parseFloat(String(a.amount_total || 0)) || 0)
        );
      }
      if (sortBy === "value_low") {
        return (
          (parseFloat(String(a.amount_total || 0)) || 0) -
          (parseFloat(String(b.amount_total || 0)) || 0)
        );
      }
      if (sortBy === "oldest") {
        return Number(a.id) - Number(b.id);
      }
      return Number(b.id) - Number(a.id);
    });
  }, [poList, activeTab, search, sortBy]);

  // Render Card Item
  const renderItem = ({ item }: { item: CustomerPOItem }) => {
    const statusMeta = getPOStatusMeta(item.status, customerPoStatuses);
    const itemsList = item.items || [];
    const totalVolume = itemsList.reduce((acc, curr) => {
      return acc + (parseFloat(String(curr.quantity)) || 0);
    }, 0);

    const mixDesignNames = itemsList
      .map(
        (it) =>
          it.mix_design?.design_name ||
          it.mix_design?.name ||
          (it as any).mix_design_name ||
          (it.mix_design_id ? `Mix #${it.mix_design_id}` : null),
      )
      .filter(Boolean);

    const primaryMix =
      mixDesignNames.length > 0 ? mixDesignNames.join(", ") : "Standard Mix";

    const soList =
      item.sales_orders ||
      (item as any)["sales-orders"] ||
      (item as any).salesOrders ||
      [];
    const hasNoSalesOrders = !Array.isArray(soList) || soList.length === 0;
    const isDraft =
      Number(item.status) === 0 ||
      (statusMeta.label || "").toLowerCase().includes("draft");
    const isConfirmed =
      Number(item.status) === 1 ||
      (statusMeta.label || "").toLowerCase().includes("confirmed");
    const canDeletePO = isDraft || (isConfirmed && hasNoSalesOrders);

    return (
      <View style={styles.cardContainer}>
        {/* Status vertical accent stripe */}
        <View
          style={[styles.cardLeftStripe, { backgroundColor: statusMeta.accent }]}
        />

        <View style={styles.cardContent}>
          {/* Top Row: Ref Badge & Status */}
          <View style={styles.cardHeader}>
            <View style={styles.referenceGroup}>
              <View style={styles.quoteNumberBadge}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={14}
                  color="#2563EB"
                />
                <Text style={styles.quoteNumberText}>{item.reference}</Text>
              </View>

              {item.customer_po_reference ? (
                <View style={styles.poRefBadge}>
                  <Text style={styles.poRefBadgeText}>
                    PO: {item.customer_po_reference}
                  </Text>
                </View>
              ) : null}
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusMeta.bgColor,
                  borderColor: statusMeta.borderColor || statusMeta.color + "30",
                },
              ]}
            >
              <Ionicons
                name={statusMeta.icon}
                size={13}
                color={statusMeta.color}
              />
              <Text style={[styles.statusText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>

          {/* Customer & 3-Dots */}
          <View style={styles.customerRow}>
            <Text style={styles.customerNameText} numberOfLines={1}>
              {item.patron?.legal_name || "Unknown Customer"}
            </Text>
            <TouchableOpacity
              style={styles.cardOptionsBtn}
              onPress={() => setCardMenuPO(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Site with Red Pin */}
          <View style={styles.siteRow}>
            <Ionicons name="location-sharp" size={14} color="#EF4444" />
            <Text style={styles.siteNameText} numberOfLines={1}>
              {item.site?.name || "Main Site"}
            </Text>
          </View>

          {/* 3-Column Spec Box */}
          <View style={styles.specBox}>
            <View style={styles.specCol}>
              <View style={styles.specHeaderRow}>
                <MaterialCommunityIcons
                  name="layers-triple-outline"
                  size={14}
                  color="#64748B"
                />
                <Text style={styles.specLabel}>Mix Design</Text>
              </View>
              <Text style={styles.specMixValue} numberOfLines={1}>
                {primaryMix}
              </Text>
            </View>

            <View style={styles.specCol}>
              <View style={styles.specHeaderRow}>
                <MaterialCommunityIcons
                  name="cube-outline"
                  size={14}
                  color="#2563EB"
                />
                <Text style={styles.specLabel}>Total Qty</Text>
              </View>
              <Text style={styles.specVolumeValue} numberOfLines={1}>
                {formatVolume(totalVolume)} m³
              </Text>
            </View>

            <View style={styles.specCol}>
              <View style={styles.specHeaderRow}>
                <Ionicons name="cash-outline" size={14} color="#16A34A" />
                <Text style={styles.specLabel}>Total Value</Text>
              </View>
              <Text style={styles.specTotalValue} numberOfLines={1}>
                {formatCurrency(item.amount_total)}
              </Text>
            </View>
          </View>

          {/* Dates Bar */}
          <View style={styles.datesBar}>
            <View style={styles.dateItem}>
              <Ionicons name="calendar-outline" size={13} color="#64748B" />
              <Text style={styles.dateLabel}>
                Order Date:{" "}
                <Text style={styles.dateVal}>{formatDate(item.order_date)}</Text>
              </Text>
            </View>

            <View style={styles.dateDivider} />

            <View style={styles.dateItem}>
              <Ionicons name="receipt-outline" size={13} color="#64748B" />
              <Text style={styles.dateLabel}>
                {item.is_tax_inclusive ? "Tax Inclusive" : "Tax Exclusive"}
              </Text>
            </View>
          </View>

          {/* Card Footer Actions */}
          <View style={styles.cardFooter}>
            <View style={styles.actionButtonsGroup}>
              {/* Confirm (Draft) */}
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
                        size={14}
                        color="#FFFFFF"
                      />
                      <Text style={styles.confirmQuickBtnText}>Confirm</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Generate SO (Confirmed) */}
              {(Number(item.status) === 1 ||
                (statusMeta.label || "").toLowerCase().includes("progress") ||
                (statusMeta.label || "").toLowerCase().includes("confirmed")) &&
                Number(item.status) !== 2 && (
                  <TouchableOpacity
                    style={styles.generateSOBtn}
                    onPress={() => handleOpenGenerateSO(item)}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons
                      name="file-document-plus-outline"
                      size={14}
                      color="#FFFFFF"
                    />
                    <Text style={styles.generateSOBtnText}>Generate SO</Text>
                  </TouchableOpacity>
                )}

              {/* Edit */}
              {Number(item.status) !== 2 && (
                <TouchableOpacity
                  style={styles.actionEditBtn}
                  onPress={() =>
                    router.push({
                      pathname: "/customer-po/editCustomerPO" as any,
                      params: {
                        admin_po_id: String(item.id),
                        quotation_id: item.quotation_id
                          ? String(item.quotation_id)
                          : "",
                      },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={14} color="#2563EB" />
                  <Text style={styles.actionEditText}>Edit</Text>
                </TouchableOpacity>
              )}

              {/* Delete */}
              {canDeletePO && (
                <TouchableOpacity
                  style={styles.actionDeleteBtn}
                  onPress={() => handlePromptDeletePO(item)}
                  activeOpacity={0.7}
                  disabled={deletingPoId === item.id}
                >
                  {deletingPoId === item.id ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      <Text style={styles.actionDeleteText}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
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

        {/* Header Top: Back Button, Titles, Bell & Customized Customer PO Illustration */}
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
              <Text style={styles.headerMainTitle}>Customer PO</Text>
              <Text style={styles.headerSubtitle}>Procurement Pipeline</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() =>
                Alert.alert(
                  "Notifications",
                  "You have no unread notifications for purchase orders.",
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

            {/* Customized Customer PO Illustration (Purchase Order Card with Shield Badge) */}
            <View style={styles.headerGraphicWrapper}>
              <View style={styles.headerPoCard}>
                <View style={styles.headerPoTopBar} />
                <View style={styles.headerPoLine1} />
                <View style={styles.headerPoLine2} />
                <View style={styles.headerPoLine3} />
              </View>
              <View style={styles.headerPoBadge}>
                <Ionicons name="shield-checkmark" size={11} color="#FFFFFF" />
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
              <Text style={styles.kpiValueText}>{stats.totalCount}</Text>
              <Text style={styles.kpiLabelText}>Total POs</Text>
            </View>
          </View>

          <View style={styles.kpiItem}>
            <View style={[styles.kpiIconBox, { backgroundColor: "#DCFCE7" }]}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
            </View>
            <View style={styles.kpiTextGroup}>
              <Text style={styles.kpiValueText}>{counts.confirmed}</Text>
              <Text style={styles.kpiLabelText}>Confirmed</Text>
            </View>
          </View>

          <View style={styles.kpiItem}>
            <View style={[styles.kpiIconBox, { backgroundColor: "#F3E8FF" }]}>
              <MaterialCommunityIcons
                name="chart-timeline-variant"
                size={18}
                color="#9333EA"
              />
            </View>
            <View style={styles.kpiTextGroup}>
              <Text style={styles.kpiValueText} numberOfLines={1}>
                {formatCurrency(stats.totalValue)}
              </Text>
              <Text style={styles.kpiLabelText}>PO Value</Text>
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
            placeholder="Search reference, customer, or site..."
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

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="funnel" size={14} color="#2563EB" />
          <Text style={styles.filterButtonText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {/* HORIZONTAL STATUS FILTER PILLS */}
      <View style={styles.statusTabsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusTabsScroll}
        >
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.value;
            return (
              <TouchableOpacity
                key={String(tab.label)}
                style={[
                  styles.statusPill,
                  isSelected && styles.statusPillActive,
                ]}
                onPress={() => setActiveTab(tab.value)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    isSelected && styles.statusPillTextActive,
                  ]}
                >
                  {tab.label} ({tab.count})
                </Text>
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
          style={{ flex: 1, backgroundColor: "#F4F7FC" }}
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
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      {/* 3-DOTS ACTION SHEET MODAL */}
      <Modal
        visible={Boolean(cardMenuPO)}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCardMenuPO(null)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setCardMenuPO(null)}
        >
          <View style={styles.actionSheetBox}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {cardMenuPO?.reference || "Purchase Order Actions"}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {cardMenuPO?.patron?.legal_name || "Select an action"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCardMenuPO(null)}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {cardMenuPO && (
              <View style={styles.sheetOptionsContainer}>
                {/* Generate Sales Order */}
                {(Number(cardMenuPO.status) === 1 ||
                  Number(cardMenuPO.status) === 0) &&
                  Number(cardMenuPO.status) !== 2 && (
                    <TouchableOpacity
                      style={styles.sheetOptionItem}
                      onPress={() => {
                        const p = cardMenuPO;
                        setCardMenuPO(null);
                        handleOpenGenerateSO(p);
                      }}
                    >
                      <View style={[styles.sheetIconBox, { backgroundColor: "#EFF6FF" }]}>
                        <MaterialCommunityIcons
                          name="file-document-plus-outline"
                          size={18}
                          color="#2563EB"
                        />
                      </View>
                      <Text style={styles.sheetOptionText}>Generate Sales Order</Text>
                    </TouchableOpacity>
                  )}

                {/* Edit */}
                {Number(cardMenuPO.status) !== 2 && (
                  <TouchableOpacity
                    style={styles.sheetOptionItem}
                    onPress={() => {
                      const p = cardMenuPO;
                      setCardMenuPO(null);
                      router.push({
                        pathname: "/customer-po/editCustomerPO" as any,
                        params: {
                          admin_po_id: String(p.id),
                          quotation_id: p.quotation_id ? String(p.quotation_id) : "",
                        },
                      });
                    }}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: "#EFF6FF" }]}>
                      <Ionicons name="create-outline" size={18} color="#2563EB" />
                    </View>
                    <Text style={styles.sheetOptionText}>Edit Customer PO</Text>
                  </TouchableOpacity>
                )}

                {/* Confirm Status */}
                {Number(cardMenuPO.status) === 0 && (
                  <TouchableOpacity
                    style={styles.sheetOptionItem}
                    onPress={() => {
                      const p = cardMenuPO;
                      setCardMenuPO(null);
                      setSelectedPoForStatus(p);
                      setTargetStatus(1);
                      setConfirmModalVisible(true);
                    }}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: "#DCFCE7" }]}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
                    </View>
                    <Text style={[styles.sheetOptionText, { color: "#16A34A" }]}>
                      Confirm Purchase Order
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Delete */}
                {(() => {
                  const soList =
                    cardMenuPO.sales_orders ||
                    (cardMenuPO as any)["sales-orders"] ||
                    [];
                  const hasNoSalesOrders =
                    !Array.isArray(soList) || soList.length === 0;
                  const isDraft = Number(cardMenuPO.status) === 0;
                  const isConfirmed = Number(cardMenuPO.status) === 1;
                  const canDelete = isDraft || (isConfirmed && hasNoSalesOrders);

                  if (!canDelete) return null;

                  return (
                    <TouchableOpacity
                      style={styles.sheetOptionItem}
                      onPress={() => {
                        const p = cardMenuPO;
                        setCardMenuPO(null);
                        handlePromptDeletePO(p);
                      }}
                    >
                      <View style={[styles.sheetIconBox, { backgroundColor: "#FEF2F2" }]}>
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </View>
                      <Text style={[styles.sheetOptionText, { color: "#DC2626" }]}>
                        Delete Customer PO
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FILTER & SORT MODAL */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterSheetContainer}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Sort & Filter Customer POs</Text>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }}>
              <Text style={styles.filterSectionHeader}>SORT BY</Text>
              {[
                { key: "newest" as const, label: "Newest First" },
                { key: "oldest" as const, label: "Oldest First" },
                { key: "value_high" as const, label: "Total Value: High to Low" },
                { key: "value_low" as const, label: "Total Value: Low to High" },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={styles.filterCheckRow}
                  onPress={() => setSortBy(opt.key)}
                >
                  <Text
                    style={[
                      styles.filterCheckLabel,
                      sortBy === opt.key && styles.filterCheckLabelActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {sortBy === opt.key && (
                    <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                  )}
                </TouchableOpacity>
              ))}

              <Text style={[styles.filterSectionHeader, { marginTop: 18 }]}>
                STATUS
              </Text>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={String(tab.label)}
                  style={styles.filterCheckRow}
                  onPress={() => setActiveTab(tab.value)}
                >
                  <Text
                    style={[
                      styles.filterCheckLabel,
                      activeTab === tab.value && styles.filterCheckLabelActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {activeTab === tab.value && (
                    <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.filterModalFooter}>
              <TouchableOpacity
                style={styles.filterResetBtn}
                onPress={() => {
                  setSortBy("newest");
                  setActiveTab("All");
                  setSearch("");
                  setFilterModalVisible(false);
                }}
              >
                <Text style={styles.filterResetBtnText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.filterApplyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* GENERATE SALES ORDERS MODAL */}
      <Modal
        visible={generateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isGeneratingSO) setGenerateModalVisible(false);
        }}
      >
        <View style={styles.genModalOverlay}>
          <View style={styles.genModalContainer}>
            <View style={styles.genModalHeader}>
              <Text style={styles.genModalTitle}>Generate Sales Orders</Text>
              <TouchableOpacity
                onPress={() => {
                  if (!isGeneratingSO) setGenerateModalVisible(false);
                }}
                disabled={isGeneratingSO}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {genModalLoading ? (
              <View style={styles.genModalLoaderWrap}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.genModalLoaderText}>
                  Loading purchase order details...
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.genModalBody}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.genInfoCard}>
                  <View style={styles.genInfoCol}>
                    <Text style={styles.genInfoLabel}>
                      Customer PO Reference
                    </Text>
                    <Text style={styles.genInfoVal} numberOfLines={1}>
                      {genModalPoData?.reference ||
                        selectedPoForGen?.reference ||
                        "N/A"}
                      {genModalPoData?.customer_po_reference
                        ? ` - ${genModalPoData.customer_po_reference}`
                        : ""}
                    </Text>
                  </View>

                  <View style={styles.genInfoCol}>
                    <Text style={styles.genInfoLabel}>Patron / Customer</Text>
                    <Text style={styles.genInfoVal} numberOfLines={1}>
                      {genModalPoData?.patron?.legal_name ||
                        selectedPoForGen?.patron?.legal_name ||
                        "N/A"}
                    </Text>
                  </View>

                  <View style={styles.genInfoCol}>
                    <Text style={styles.genInfoLabel}>Site</Text>
                    <Text style={styles.genInfoVal} numberOfLines={1}>
                      {genModalPoData?.site?.name ||
                        selectedPoForGen?.site?.name ||
                        "N/A"}
                    </Text>
                  </View>
                </View>

                <View style={styles.genSectionHeader}>
                  <Text style={styles.genSectionTitle}>
                    ORDERED MIX DESIGNS
                  </Text>
                </View>

                {genModalItems.length > 0 &&
                  genModalItems.every((it) => it.remaining_qty <= 0) && (
                    <View style={styles.allCompletedBanner}>
                      <Ionicons
                        name="checkmark-done-circle"
                        size={18}
                        color="#059669"
                      />
                      <Text style={styles.allCompletedBannerText}>
                        All mix designs for this Purchase Order have already been fully converted into Sales Orders.
                      </Text>
                    </View>
                  )}

                <View style={styles.genTableWrapper}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={true}
                  >
                    <View>
                      <View style={styles.genTableHeaderRow}>
                        <Text style={[styles.genTableHeaderText, { width: 140 }]}>
                          Mix Design
                        </Text>
                        <Text style={[styles.genTableHeaderText, { width: 85 }]}>
                          PO Qty
                        </Text>
                        <Text style={[styles.genTableHeaderText, { width: 85 }]}>
                          Converted
                        </Text>
                        <Text style={[styles.genTableHeaderText, { width: 95 }]}>
                          Remaining
                        </Text>
                        <Text style={[styles.genTableHeaderText, { width: 105 }]}>
                          SO Qty (m³)
                        </Text>
                        <Text style={[styles.genTableHeaderText, { width: 165 }]}>
                          Concrete Pump / Type
                        </Text>
                      </View>

                      {genModalItems.map((row, idx) => {
                        const isCompleted = row.remaining_qty <= 0;
                        const selectedPumpObj = pumpOptionsList.find(
                          (p) => p.value === row.concrete_pump,
                        );
                        const pumpDisplayText =
                          selectedPumpObj?.label ||
                          (row.concrete_pump
                            ? `Pump #${row.concrete_pump}`
                            : "Select Pump");

                        return (
                          <View
                            key={String(row.item_id || idx)}
                            style={[
                              styles.genTableRow,
                              isCompleted && styles.genTableRowDisabled,
                            ]}
                          >
                            <View style={{ width: 140, paddingRight: 8 }}>
                              <Text
                                style={[
                                  styles.genMixNameText,
                                  isCompleted && { color: "#64748B" },
                                ]}
                                numberOfLines={2}
                              >
                                {row.mix_design_name}
                              </Text>
                            </View>

                            <Text style={[styles.genCellText, { width: 85 }]}>
                              {row.po_qty} m³
                            </Text>

                            <Text style={[styles.genCellText, { width: 85 }]}>
                              {row.converted_qty} m³
                            </Text>

                            <View style={{ width: 95 }}>
                              {isCompleted ? (
                                <View style={styles.completedBadgeWrap}>
                                  <Ionicons
                                    name="checkmark-circle"
                                    size={13}
                                    color="#059669"
                                  />
                                  <Text style={styles.completedCellText}>
                                    0 m³ (Done)
                                  </Text>
                                </View>
                              ) : (
                                <Text
                                  style={[
                                    styles.genCellText,
                                    styles.genRemainingText,
                                  ]}
                                >
                                  {row.remaining_qty} m³
                                </Text>
                              )}
                            </View>

                            <View style={{ width: 105, paddingRight: 10 }}>
                              <TextInput
                                style={[
                                  styles.genSoQtyInput,
                                  isCompleted && styles.genSoQtyInputDisabled,
                                ]}
                                value={isCompleted ? "0" : row.so_qty}
                                onChangeText={(val) =>
                                  handleSOQtyChange(idx, val)
                                }
                                keyboardType="decimal-pad"
                                editable={!isCompleted}
                                placeholder="0.0"
                                placeholderTextColor="#94A3B8"
                                selectTextOnFocus={!isCompleted}
                              />
                            </View>

                            <View style={{ width: 165 }}>
                              <TouchableOpacity
                                style={[
                                  styles.genPumpSelectBtn,
                                  isCompleted && styles.genPumpSelectBtnDisabled,
                                ]}
                                onPress={() => {
                                  if (!isCompleted) {
                                    setActivePumpRowIndex(idx);
                                    setPumpPickerVisible(true);
                                  }
                                }}
                                disabled={isCompleted}
                                activeOpacity={0.75}
                              >
                                <Text
                                  style={[
                                    styles.genPumpSelectText,
                                    isCompleted
                                      ? styles.genPumpDisabledText
                                      : !row.concrete_pump &&
                                        styles.genPumpPlaceholder,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {isCompleted ? "Fulfilled" : pumpDisplayText}
                                </Text>
                                {!isCompleted && (
                                  <Ionicons
                                    name="chevron-down"
                                    size={15}
                                    color="#64748B"
                                  />
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.genModalActionsRow}>
                  <TouchableOpacity
                    style={styles.genCancelBtn}
                    onPress={() => setGenerateModalVisible(false)}
                    disabled={isGeneratingSO}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.genCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.genSubmitBtn,
                      isGeneratingSO && styles.genSubmitBtnDisabled,
                    ]}
                    onPress={handleSubmitGenerateSO}
                    disabled={isGeneratingSO}
                    activeOpacity={0.8}
                  >
                    {isGeneratingSO ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name="check"
                          size={18}
                          color="#FFFFFF"
                        />
                        <Text style={styles.genSubmitBtnText}>
                          Generate Sales Order
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* PUMP PICKER MODAL */}
      <Modal
        visible={pumpPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPumpPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pumpPickerOverlay}
          activeOpacity={1}
          onPress={() => setPumpPickerVisible(false)}
        >
          <View style={styles.pumpPickerCard}>
            <View style={styles.pumpPickerHeader}>
              <Text style={styles.pumpPickerTitle}>Select Concrete Pump</Text>
              <TouchableOpacity
                onPress={() => setPumpPickerVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pumpPickerList}>
              {pumpOptionsList.map((p) => {
                const isSelected =
                  activePumpRowIndex !== null &&
                  genModalItems[activePumpRowIndex]?.concrete_pump === p.value;
                return (
                  <TouchableOpacity
                    key={String(p.value)}
                    style={[
                      styles.pumpPickerItem,
                      isSelected && styles.pumpPickerItemSelected,
                    ]}
                    onPress={() => handleSOPumpSelect(p.value)}
                  >
                    <Text
                      style={[
                        styles.pumpPickerItemText,
                        isSelected && styles.pumpPickerItemTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#2563EB"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* CUSTOM ALERT MODAL */}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#063b89",
  },

  // Gradient Header
  headerGradient: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 12 : 8,
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
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    bottom: -20,
    left: -30,
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
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
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
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#BFDBFE",
    fontWeight: "500",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bellDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    position: "absolute",
    top: 7,
    right: 8,
    borderWidth: 1.5,
    borderColor: "#063b89",
  },

  // Customized Graphic for Customer PO: Purchase Order Sheet with Verified Shield Badge
  headerGraphicWrapper: {
    position: "relative",
    width: 46,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  headerPoCard: {
    width: 38,
    height: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    transform: [{ rotate: "4deg" }],
  },
  headerPoTopBar: {
    height: 4,
    backgroundColor: "#2563EB",
    borderRadius: 2,
    marginBottom: 5,
  },
  headerPoLine1: {
    height: 2.5,
    backgroundColor: "#CBD5E1",
    borderRadius: 1.5,
    marginBottom: 3,
    width: "85%",
  },
  headerPoLine2: {
    height: 2.5,
    backgroundColor: "#E2E8F0",
    borderRadius: 1.5,
    marginBottom: 3,
    width: "100%",
  },
  headerPoLine3: {
    height: 2.5,
    backgroundColor: "#93C5FD",
    borderRadius: 1.5,
    width: "60%",
  },
  headerPoBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },

  // KPI Strip Container
  kpiContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpiItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  kpiTextGroup: {
    flex: 1,
  },
  kpiValueText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  kpiLabelText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
  },

  // Search & Filter Row
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "#F4F7FC",
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    marginLeft: 8,
    paddingVertical: 0,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 44,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563EB",
  },

  // Status Tabs
  statusTabsRow: {
    backgroundColor: "#F4F7FC",
    paddingBottom: 10,
  },
  statusTabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusPillActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  statusPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // Error Notice
  errorNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#FCA5A5",
    gap: 8,
  },
  errorNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#991B1B",
  },
  retryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
    textDecorationLine: "underline",
  },

  // List Content
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 85,
  },

  // Card Design
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
  },
  cardLeftStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4.5,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  cardContent: {
    paddingLeft: 16,
    paddingRight: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  referenceGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    flex: 1,
  },
  quoteNumberBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 5,
  },
  quoteNumberText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.3,
  },
  poRefBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  poRefBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#475569",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Customer Row
  customerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  customerNameText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  cardOptionsBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },

  // Site Row
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 12,
  },
  siteNameText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    flex: 1,
  },

  // 3-Column Specs Grid
  specBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 10,
  },
  specCol: {
    flex: 1,
  },
  specHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },
  specLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
  },
  specMixValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  specVolumeValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  specTotalValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#16A34A",
  },

  // Dates Bar
  datesBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
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
    marginHorizontal: 10,
  },
  dateLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  dateVal: {
    fontWeight: "700",
    color: "#1E293B",
  },

  // Card Footer Actions
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  actionButtonsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confirmQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16A34A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    gap: 4,
  },
  confirmQuickBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  generateSOBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    gap: 4,
  },
  generateSOBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  actionEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    gap: 4,
  },
  actionEditText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  actionDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 4,
  },
  actionDeleteText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },

  // FAB
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
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  // Empty & Loading States
  centerLoadingContainer: {
    flex: 1,
    backgroundColor: "#F4F7FC",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
  },
  centerLoadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748B",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
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
  emptyResetBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyResetBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // Action Sheet & Filter Modal Overlay & Containers
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  actionSheetBox: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === "android" ? 24 : 34,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  sheetSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetOptionsContainer: {
    paddingTop: 10,
  },
  sheetOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
    gap: 12,
  },
  sheetIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },

  // Filter Sheet Container
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  filterSheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingTop: 16,
    paddingBottom: Platform.OS === "android" ? 20 : 30,
  },
  filterSectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8,
  },
  filterCheckRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  filterCheckLabel: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "500",
  },
  filterCheckLabelActive: {
    color: "#2563EB",
    fontWeight: "700",
  },
  filterModalFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  filterResetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  filterResetBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  filterApplyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  filterApplyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Confirmation Dialog
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  confirmDialogBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  confirmDialogIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  confirmDialogTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  confirmDialogDesc: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
  },
  confirmSummaryCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
    gap: 6,
  },
  confirmSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  confirmSummaryLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  confirmSummaryVal: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  confirmDialogButtons: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  confirmSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmSubmitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Generate SO Modal
  genModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
  genModalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingTop: 18,
    paddingBottom: Platform.OS === "android" ? 24 : 34,
  },
  genModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  genModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  genModalLoaderWrap: {
    paddingVertical: 60,
    alignItems: "center",
  },
  genModalLoaderText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748B",
  },
  genModalBody: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  genInfoCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    gap: 8,
  },
  genInfoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  genInfoLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  genInfoVal: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  genSectionHeader: {
    marginBottom: 10,
  },
  genSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.6,
  },
  allCompletedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  allCompletedBannerText: {
    fontSize: 12,
    color: "#047857",
    fontWeight: "600",
    flex: 1,
  },
  genTableWrapper: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    marginBottom: 16,
  },
  genTableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  genTableHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  genTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  genTableRowDisabled: {
    backgroundColor: "#F8FAFC",
  },
  genMixNameText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  genCellText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "500",
  },
  genRemainingText: {
    color: "#2563EB",
    fontWeight: "700",
  },
  completedBadgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  completedCellText: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "700",
  },
  genSoQtyInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700",
    textAlign: "center",
  },
  genSoQtyInputDisabled: {
    backgroundColor: "#F1F5F9",
    color: "#94A3B8",
  },
  genPumpSelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  genPumpSelectBtnDisabled: {
    backgroundColor: "#F1F5F9",
  },
  genPumpSelectText: {
    fontSize: 11,
    color: "#0F172A",
    fontWeight: "600",
    flex: 1,
  },
  genPumpPlaceholder: {
    color: "#94A3B8",
  },
  genPumpDisabledText: {
    color: "#94A3B8",
  },
  genModalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    paddingVertical: 10,
    marginBottom: 20,
  },
  genCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  genCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  genSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  genSubmitBtnDisabled: {
    opacity: 0.6,
  },
  genSubmitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Pump Picker Modal
  pumpPickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  pumpPickerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    width: "100%",
    maxWidth: 380,
    maxHeight: "70%",
  },
  pumpPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  pumpPickerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  pumpPickerList: {
    paddingTop: 10,
  },
  pumpPickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pumpPickerItemSelected: {
    backgroundColor: "#EFF6FF",
  },
  pumpPickerItemText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
  },
  pumpPickerItemTextActive: {
    color: "#2563EB",
    fontWeight: "700",
  },
});
