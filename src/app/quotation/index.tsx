import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import {
  AlertButton,
  AlertType,
  CustomAlertModal,
  formatSubmissionError,
} from "@/components/ui/custom-alert-modal";
import { RootState } from "@/store/store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
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

export interface QuotationPatron {
  id: number;
  legal_name: string;
}

export interface QuotationSite {
  id: number;
  name: string;
}

export interface QuotationMixDesign {
  id: number;
  plant_id?: number;
  design_name?: string | null;
  design_code?: string | null;
  design_type?: string | null;
  name?: string | null;
  code?: string | null;
}

export interface QuotationLineItem {
  id: number;
  quotation_id: number;
  mix_design_id?: number | null;
  concrete_pump?: string | null;
  pump_rate?: string | null;
  quantity?: string | number | null;
  uom_id?: number | null;
  rate?: string | number | null;
  tak_id?: number | null;
  tax_amount?: string | null;
  untaxed_amount?: string | null;
  amount_total?: string | null;
  mix_design?: QuotationMixDesign | null;
}

export interface QuotationItem {
  id: number | string;
  plant_id?: number;
  sales_executive_id?: number | null;
  sales_executive?: any;
  pump_type?: string | null;
  pump_rate?: string;
  is_tax_inclusive?: boolean;
  prefix?: string | null;
  reference: string;
  patron_id?: number;
  site_id?: number;
  quote_date?: string;
  validity_date?: string;
  amount_untaxed?: string;
  tax_id?: number | null;
  tax_amount?: string;
  adjustment?: string;
  amount_tax?: string;
  amount_total: string;
  status: number;
  is_customer_po?: number;
  created_at?: string;
  created_by?: number | null;
  updated_at?: string;
  updated_by?: number | null;
  deleted_at?: string | null;
  deleted_by?: number | null;
  notes?: string | null;
  patron?: QuotationPatron;
  site?: QuotationSite;
  client?: string;
  mix_design?: string;
  volume?: string | number;
  quantity?: string | number;
  rate?: string;
  items?: QuotationLineItem[];
}

export interface ListQuotationScreenProps {
  onBack?: () => void;
  onSuccess?: (quotation: any) => void;
}

export const formatCurrency = (
  val: string | number | null | undefined,
): string => {
  if (val === null || val === undefined || val === "") return "₹0";
  const str = String(val).replace(/[^0-9\.]/g, "");
  const num = parseFloat(str);
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
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
};

export const normalizeQuotationStatus = (status: any): number => {
  if (status === null || status === undefined) return 0;
  if (typeof status === "object") {
    if (status.value !== undefined)
      return normalizeQuotationStatus(status.value);
    if (status.id !== undefined) return normalizeQuotationStatus(status.id);
    if (status.name !== undefined) return normalizeQuotationStatus(status.name);
    if (status.status !== undefined)
      return normalizeQuotationStatus(status.status);
  }
  if (typeof status === "number") return status;
  const str = String(status).trim().toLowerCase();
  if (str === "approved" || str === "2") return 2;
  if (str === "sent" || str === "1") return 1;
  if (str === "rejected" || str === "3") return 3;
  if (str === "draft" || str === "0") return 0;
  const num = Number(str);
  return isNaN(num) ? -1 : num;
};

export const getStatusMeta = (status: number | string | null | undefined) => {
  const s = normalizeQuotationStatus(status);
  switch (s) {
    case 0:
      return {
        key: "draft",
        code: 0,
        label: "Draft",
        color: "#475569",
        bg: "#F1F5F9",
        border: "#E2E8F0",
        accent: "#94A3B8",
        dot: "#94A3B8",
        icon: "pencil" as const,
      };
    case 1:
      return {
        key: "sent",
        code: 1,
        label: "Sent",
        color: "#2563EB",
        bg: "#EFF6FF",
        border: "#BFDBFE",
        accent: "#2563EB",
        dot: "#2563EB",
        icon: "paper-plane" as const,
      };
    case 2:
      return {
        key: "approved",
        code: 2,
        label: "Approved",
        color: "#16A34A",
        bg: "#DCFCE7",
        border: "#86EFAC",
        accent: "#16A34A",
        dot: "#16A34A",
        icon: "checkmark-circle" as const,
      };
    case 3:
      return {
        key: "rejected",
        code: 3,
        label: "Rejected",
        color: "#DC2626",
        bg: "#FEE2E2",
        border: "#FECDD3",
        accent: "#DC2626",
        dot: "#DC2626",
        icon: "close-circle" as const,
      };
    default:
      return {
        key: "unknown",
        code: -1,
        label: `Status ${status}`,
        color: "#64748B",
        bg: "#F8FAFC",
        border: "#CBD5E1",
        accent: "#64748B",
        dot: "#64748B",
        icon: "help-circle-outline" as const,
      };
  }
};

function buildQuotationHeaders(
  token: string | null,
  plantId: number | null,
  includeContentType: boolean = true,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    const cleanToken = token.trim();
    headers["Authorization"] = cleanToken.startsWith("Bearer")
      ? cleanToken
      : `Bearer ${cleanToken}`;
  }
  if (plantId !== null && plantId !== undefined) {
    headers["X-Plant-Id"] = String(plantId);
  }
  return headers;
}

async function fetchQuotationsApi(
  token: string | null,
  plantId: number | null,
) {
  const headers = buildQuotationHeaders(token, plantId, true);
  const params: Record<string, any> = {};
  if (plantId !== null && plantId !== undefined) {
    params.plant_id = String(plantId);
  }

  console.log(`[Quotation] Fetching from ${baseURL}/quotations`, {
    plantId,
    hasToken: Boolean(token),
  });

  return axios.get(`${baseURL}/quotations`, {
    params,
    headers,
  });
}

async function fetchQuotationDetailApi(
  token: string | null,
  plantId: number | null,
  quotationId: number | string,
) {
  const headers = buildQuotationHeaders(token, plantId, false);
  const params: Record<string, any> = {
    quotation: String(quotationId),
  };
  if (plantId !== null && plantId !== undefined) {
    params.plant_id = String(plantId);
  }

  console.log(`[Quotation Detail] GET ${baseURL}/quotations/${quotationId}`, {
    plantId,
    quotationId,
  });

  try {
    return await axios.get(`${baseURL}/quotations/${quotationId}`, {
      params,
      headers,
    });
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.response?.status === 405) {
      console.log("[Quotation Detail] Fallback GET /quotations?quotation=:id");
      return await axios.get(`${baseURL}/quotations`, {
        params,
        headers,
      });
    }
    throw err;
  }
}

async function reviewQuotationApi(
  token: string | null,
  plantId: number | null,
  quotationId: number | string,
  decision: "approved" | "rejected",
  comment: string,
) {
  const headers = buildQuotationHeaders(token, plantId, true);
  const body = {
    decision,
    comment,
  };
  const params = {
    quotation: quotationId,
  };

  console.log(
    `[Quotation Review] POST ${baseURL}/quotations/${quotationId}/review`,
    {
      body,
      headers,
      params,
    },
  );

  return axios.post(`${baseURL}/quotations/${quotationId}/review`, body, {
    headers,
    params,
  });
}

async function convertQuotationToCustomerPOApi(
  token: string | null,
  plantId: number | null,
  quotationId: number | string,
) {
  const headers = buildQuotationHeaders(token, plantId, true);
  const params: Record<string, any> = {
    quotation: String(quotationId),
  };
  if (plantId !== null && plantId !== undefined) {
    params.plant_id = String(plantId);
  }
  const body: Record<string, any> = {
    quotation: String(quotationId),
  };
  if (plantId !== null && plantId !== undefined) {
    body.plant_id = String(plantId);
  }

  console.log(
    `[Quotation Convert PO] POST ${baseURL}/quotations/${quotationId}/convert-customer-po`,
    { params, headers, body },
  );

  return axios.post(
    `${baseURL}/quotations/${quotationId}/convert-customer-po`,
    body,
    {
      params,
      headers,
    },
  );
}

export function deleteQuotationAPI(
  quotationId: number | string,
  token?: string | null,
  plantId?: number | null,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const params: Record<string, any> = {
    quotation_id: quotationId,
  };
  if (plantId) {
    params.plant_id = plantId;
  }

  console.log(
    `[Quotation Delete] DELETE ${baseURL}/quotations/${quotationId}`,
    {
      params,
      headers,
    },
  );

  return axios.delete(`${baseURL}/quotations/${quotationId}`, {
    params,
    headers,
  });
}

interface QuotationCardProps {
  item: QuotationItem;
  onOpenView: (item: QuotationItem) => void;
  onOpenEdit: (item: QuotationItem) => void;
  onConvertToCustomerPO: (item: QuotationItem) => void;
  isConverting?: boolean;
  onDeleteQuotation?: (item: QuotationItem) => void;
  isDeleting?: boolean;
  onOptionsPress: (item: QuotationItem) => void;
}

const QuotationCard = React.memo(function QuotationCard({
  item,
  onOpenView,
  onOpenEdit,
  onConvertToCustomerPO,
  isConverting = false,
  onDeleteQuotation,
  isDeleting = false,
  onOptionsPress,
}: QuotationCardProps) {
  const statusCode = normalizeQuotationStatus(item.status);
  const isApproved = statusCode === 2;
  const isSent = statusCode === 1;
  const canEdit = statusCode === 0;
  const canDelete = statusCode === 0 || statusCode === 1;
  const isPOConverted =
    Number(item.is_customer_po) === 1 ||
    String(item.is_customer_po) === "1" ||
    Boolean((item as any).is_customer_po_converted);

  const statusMeta = useMemo(() => getStatusMeta(item.status), [item.status]);
  const customer =
    item.patron?.legal_name || item.client || "Customer Not Specified";
  const site = item.site?.name || "Main Project Site";

  const { mix, volume } = useMemo(() => {
    let m = "Standard Mix";
    let v = "0";

    if (Array.isArray(item.items) && item.items.length > 0) {
      const mixNames = item.items
        .map(
          (it) =>
            it.mix_design?.design_name ||
            it.mix_design?.name ||
            it.mix_design?.design_type ||
            it.mix_design?.design_code,
        )
        .filter(Boolean);
      if (mixNames.length === 1) {
        m = mixNames[0]!;
      } else if (mixNames.length > 1) {
        m = mixNames.join(", ");
      } else if (item.mix_design) {
        m = item.mix_design;
      }

      const totalQty = item.items.reduce((sum, it) => {
        const q = parseFloat(String(it.quantity || "0"));
        return sum + (isNaN(q) ? 0 : q);
      }, 0);
      v =
        totalQty > 0
          ? String(parseFloat(totalQty.toFixed(2)))
          : String(item.volume || item.quantity || "0");
    } else {
      m = item.mix_design || "Standard Mix";
      const q = parseFloat(String(item.volume || item.quantity || "0"));
      v = isNaN(q) ? "0" : String(parseFloat(q.toFixed(2)));
    }
    return { mix: m, volume: v };
  }, [item.items, item.mix_design, item.volume, item.quantity]);

  const formattedTotal = useMemo(
    () => formatCurrency(item.amount_total),
    [item.amount_total],
  );
  const formattedQuoteDate = useMemo(
    () => formatDate(item.quote_date),
    [item.quote_date],
  );
  const formattedValidityDate = useMemo(
    () => formatDate(item.validity_date),
    [item.validity_date],
  );

  return (
    <View style={styles.quoteCard}>
      {/* Status left accent stripe */}
      <View
        style={[styles.cardLeftStripe, { backgroundColor: statusMeta.accent }]}
      />

      <View style={styles.cardContent}>
        {/* Top Row: Ref Badge & Status Badge */}
        <View style={styles.cardHeader}>
          <View style={styles.quoteNumberBadge}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={14}
              color="#2563EB"
            />
            <Text style={styles.quoteNumberText}>{item.reference}</Text>
          </View>

          <View style={styles.badgesRightRow}>
            {isPOConverted && (
              <View style={styles.poBadge}>
                <Ionicons name="shield-checkmark" size={11} color="#047857" />
                <Text style={styles.poBadgeText}>PO Converted</Text>
              </View>
            )}

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusMeta.bg,
                  borderColor: statusMeta.border,
                },
              ]}
            >
              <Ionicons
                name={statusMeta.icon as any}
                size={13}
                color={statusMeta.color}
              />
              <Text
                style={[styles.statusText, { color: statusMeta.color }]}
                numberOfLines={1}
              >
                {statusMeta.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer Name & 3-Dots Action Button */}
        <View style={styles.customerRow}>
          <Text style={styles.projectNameText} numberOfLines={1}>
            {customer}
          </Text>
          <TouchableOpacity
            style={styles.cardOptionsBtn}
            onPress={() => onOptionsPress(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Site Location with Red Pin */}
        <View style={styles.contactRow}>
          <Ionicons name="location-sharp" size={14} color="#EF4444" />
          <Text style={styles.contactPersonText} numberOfLines={1}>
            {site}
          </Text>
          {item.pump_type ? (
            <View style={styles.pumpBadge}>
              <Ionicons name="flash-outline" size={10} color="#64748B" />
              <Text style={styles.pumpBadgeText}>{item.pump_type}</Text>
            </View>
          ) : null}
        </View>

        {/* 3-Column Concrete Specs Box */}
        <View style={styles.specBox}>
          {/* Column 1: Mix Design */}
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
              {mix}
            </Text>
          </View>

          {/* Column 2: Volume */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <MaterialCommunityIcons
                name="cube-outline"
                size={14}
                color="#2563EB"
              />
              <Text style={styles.specLabel}>Volume</Text>
            </View>
            <Text style={styles.specVolumeValue} numberOfLines={1}>
              {String(volume).includes("m³") ? volume : `${volume} m³`}
            </Text>
          </View>

          {/* Column 3: Total Value */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <Ionicons name="cash-outline" size={14} color="#16A34A" />
              <Text style={styles.specLabel}>Total Value</Text>
            </View>
            <Text style={styles.specTotalValue} numberOfLines={1}>
              {formattedTotal}
            </Text>
          </View>
        </View>

        {/* Multi-item chip indicators if > 1 item */}
        {Array.isArray(item.items) && item.items.length > 1 && (
          <View style={styles.multiItemsPreviewRow}>
            {item.items.map((lineItem, idx) => (
              <View key={lineItem.id || idx} style={styles.multiItemChip}>
                <Ionicons name="cube-outline" size={11} color="#2563EB" />
                <Text style={styles.multiItemChipText} numberOfLines={1}>
                  {lineItem.mix_design?.design_name ||
                    lineItem.mix_design?.name ||
                    "Mix"}
                  : {parseFloat(String(lineItem.quantity || "0"))} m³
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Dates Bar: Quote Date & Validity */}
        <View style={styles.datesBar}>
          <View style={styles.dateItem}>
            <Ionicons name="calendar-outline" size={13} color="#64748B" />
            <Text style={styles.dateLabel}>
              Quote: <Text style={styles.dateVal}>{formattedQuoteDate}</Text>
            </Text>
          </View>

          <View style={styles.dateDivider} />

          <View style={styles.dateItem}>
            <Ionicons name="time-outline" size={13} color="#64748B" />
            <Text style={styles.dateLabel}>
              Valid Till:{" "}
              <Text style={styles.dateVal}>{formattedValidityDate}</Text>
            </Text>
          </View>
        </View>

        {/* Bottom Actions Row */}
        <View style={styles.cardFooter}>
          <View style={styles.actionButtonsGroup}>
            {/* View Button */}
            <TouchableOpacity
              style={styles.actionViewBtn}
              activeOpacity={0.7}
              onPress={() => onOpenView(item)}
            >
              <Ionicons name="eye-outline" size={14} color="#2563EB" />
              <Text style={styles.actionViewText}>View</Text>
            </TouchableOpacity>

            {/* Edit Button */}
            <TouchableOpacity
              style={styles.actionEditBtn}
              onPress={() => onOpenEdit(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={14} color="#2563EB" />
              <Text style={styles.actionEditText}>Edit</Text>
            </TouchableOpacity>

            {/* Delete Button */}
            {canDelete && onDeleteQuotation && (
              <TouchableOpacity
                style={styles.actionDeleteBtn}
                onPress={() => onDeleteQuotation(item)}
                activeOpacity={0.7}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={14} color="#DC2626" />
                    <Text style={styles.actionDeleteText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Convert to PO button if Approved */}
            {isApproved && !isPOConverted && (
              <TouchableOpacity
                style={styles.actionConvertBtn}
                onPress={() => onConvertToCustomerPO(item)}
                activeOpacity={0.7}
                disabled={isConverting}
              >
                {isConverting ? (
                  <ActivityIndicator size="small" color="#047857" />
                ) : (
                  <>
                    <Ionicons
                      name="swap-horizontal"
                      size={14}
                      color="#047857"
                    />
                    <Text style={styles.actionConvertText}>Convert</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
});

export default function QuotationScreen({
  onBack,
  onSuccess,
}: ListQuotationScreenProps) {
  const { token, plant_id, plant_name, user } = useSelector(
    (state: RootState) => state.auth,
  );

  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"All" | 0 | 1 | 2 | 3>("All");
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "amount_high" | "amount_low"
  >("newest");

  // View & Review & Convert PO States
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [viewingQuotation, setViewingQuotation] =
    useState<QuotationItem | null>(null);
  const [viewLoading, setViewLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<
    "approve" | "reject" | "convert" | "send" | null
  >(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  // Reject Dialog States
  const [rejectModalVisible, setRejectModalVisible] = useState<boolean>(false);
  const [rejectTargetItem, setRejectTargetItem] =
    useState<QuotationItem | null>(null);
  const [rejectComment, setRejectComment] = useState<string>("Rejected");

  // Filter Sheet / Modal State
  const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);

  // Card 3-Dots Action Sheet State
  const [cardMenuQuotation, setCardMenuQuotation] =
    useState<QuotationItem | null>(null);

  // Delete Quotation State
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
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

  const isMountedRef = useRef<boolean>(false);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/more" as any);
    }
  }, [onBack]);

  const loadQuotations = useCallback(
    async (isPullRefresh: boolean = false, isBackground: boolean = false) => {
      if (!token) {
        setLoading(false);
        return;
      }

      const targetPlantId =
        plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;
      const cacheKey = `@rmc_quotations_cache_${targetPlantId || "all"}`;

      if (isPullRefresh) {
        setRefreshing(true);
      } else if (!isBackground) {
        // Step 1: Read local cache for immediate 0ms load
        try {
          const cachedJson = await AsyncStorage.getItem(cacheKey);
          if (cachedJson) {
            const cachedItems: QuotationItem[] = JSON.parse(cachedJson);
            if (Array.isArray(cachedItems) && cachedItems.length > 0) {
              setQuotations(cachedItems);
              setLoading(false);
            }
          }
        } catch (cacheErr) {
          console.warn("[Quotation] Cache read error:", cacheErr);
        }

        // Only show full loader if there is no cached data to display yet
        setQuotations((current) => {
          if (current.length === 0) {
            setLoading(true);
          }
          return current;
        });
      }

      setErrorMessage(null);

      // Step 2: Fetch fresh data without timeout
      try {
        const res = await fetchQuotationsApi(token, targetPlantId);

        let items: QuotationItem[] = [];
        if (res.data?.success && res.data?.data) {
          const apiData = res.data.data;
          items = Array.isArray(apiData.data)
            ? apiData.data
            : Array.isArray(apiData)
              ? apiData
              : [];
        } else if (Array.isArray(res.data)) {
          items = res.data;
        }

        console.log("[Quotation] Successfully loaded items:", items.length);
        setQuotations(items);

        // Update cache for next instant load
        if (items.length > 0) {
          AsyncStorage.setItem(cacheKey, JSON.stringify(items)).catch(() => {});
        }
      } catch (err: any) {
        console.warn("[Quotation] Fetch error:", {
          message: err?.message,
          code: err?.code,
          status: err?.response?.status,
        });

        setQuotations((current) => {
          if (current.length === 0) {
            const serverError =
              err?.response?.data?.message ||
              (err?.response?.data?.errors?.plant_id
                ? "Plant ID is required."
                : null) ||
              err?.response?.data?.error ||
              err?.message ||
              "Could not load quotations.";

            setErrorMessage(serverError);
          }
          return current;
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, plant_id, user],
  );

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

      if (isMountedRef.current) {
        loadQuotations(false, true);
      } else {
        isMountedRef.current = true;
        loadQuotations(false, false);
      }

      return () => subscription.remove();
    }, [handleBack, loadQuotations]),
  );

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    await loadQuotations(true);
  }, [refreshing, loadQuotations]);

  const filteredQuotations = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    const result = quotations.filter((item) => {
      if (
        activeTab !== "All" &&
        normalizeQuotationStatus(item.status) !== activeTab
      ) {
        return false;
      }
      if (trimmed) {
        const refMatch = item.reference?.toLowerCase().includes(trimmed);
        const patronMatch = (item.patron?.legal_name || item.client || "")
          .toLowerCase()
          .includes(trimmed);
        const siteMatch = item.site?.name?.toLowerCase().includes(trimmed);
        const designMatch =
          item.mix_design?.toLowerCase().includes(trimmed) ||
          item.items?.some((it) =>
            (it.mix_design?.design_name || it.mix_design?.name || "")
              .toLowerCase()
              .includes(trimmed),
          );
        const totalMatch = item.amount_total?.includes(trimmed);
        return Boolean(
          refMatch || patronMatch || siteMatch || designMatch || totalMatch,
        );
      }
      return true;
    });

    return result.sort((a, b) => {
      if (sortBy === "amount_high") {
        const valA = parseFloat(String(a.amount_total || "0")) || 0;
        const valB = parseFloat(String(b.amount_total || "0")) || 0;
        return valB - valA;
      }
      if (sortBy === "amount_low") {
        const valA = parseFloat(String(a.amount_total || "0")) || 0;
        const valB = parseFloat(String(b.amount_total || "0")) || 0;
        return valA - valB;
      }
      if (sortBy === "oldest") {
        return Number(a.id || 0) - Number(b.id || 0);
      }
      // default: newest first
      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [quotations, activeTab, search, sortBy]);

  const { tabCounts, totalPipelineValue } = useMemo(() => {
    let draft = 0;
    let sent = 0;
    let approved = 0;
    let rejected = 0;
    let pipelineSum = 0;

    for (let i = 0; i < quotations.length; i++) {
      const q = quotations[i];
      const s = normalizeQuotationStatus(q.status);
      if (s === 0) draft++;
      else if (s === 1) sent++;
      else if (s === 2) approved++;
      else if (s === 3) rejected++;

      const val = parseFloat(String(q.amount_total || 0));
      if (!isNaN(val)) pipelineSum += val;
    }

    return {
      tabCounts: {
        all: quotations.length,
        draft,
        sent,
        approved,
        rejected,
      },
      totalPipelineValue: pipelineSum,
    };
  }, [quotations]);

  const updateQuotationInState = useCallback(
    (quotationId: number | string, updates: Partial<QuotationItem>) => {
      setQuotations((prev) => {
        const next = prev.map((q) =>
          String(q.id) === String(quotationId) ? { ...q, ...updates } : q,
        );
        const targetPlantId =
          plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;
        const cacheKey = `@rmc_quotations_cache_${targetPlantId || "all"}`;
        AsyncStorage.setItem(cacheKey, JSON.stringify(next)).catch(() => {});
        return next;
      });

      setViewingQuotation((prev) => {
        if (prev && String(prev.id) === String(quotationId)) {
          return { ...prev, ...updates };
        }
        return prev;
      });
    },
    [plant_id, user],
  );

  const handleOpenView = useCallback(
    async (item: QuotationItem) => {
      setViewingQuotation(item);
      setViewModalVisible(true);
      setViewLoading(true);

      const targetPlantId =
        plant_id ??
        item.plant_id ??
        user?.default_plant_id ??
        (user as any)?.plant_id ??
        null;

      try {
        const res = await fetchQuotationDetailApi(
          token,
          targetPlantId,
          item.id,
        );
        const rawApiData = res?.data?.data || res?.data;
        let detailData = rawApiData;
        if (rawApiData && Array.isArray(rawApiData.data)) {
          detailData =
            rawApiData.data.find(
              (q: any) => String(q.id) === String(item.id),
            ) || rawApiData.data[0];
        } else if (Array.isArray(rawApiData)) {
          detailData =
            rawApiData.find((q: any) => String(q.id) === String(item.id)) ||
            rawApiData[0];
        }

        if (detailData) {
          setViewingQuotation(detailData);
          updateQuotationInState(item.id, detailData);
        }
      } catch (err: any) {
        console.warn(
          "[Quotation Detail] Error fetching full details:",
          err?.message,
        );
      } finally {
        setViewLoading(false);
      }
    },
    [token, plant_id, user, updateQuotationInState],
  );

  const handleOpenEdit = useCallback(
    (item: QuotationItem) => {
      const status = normalizeQuotationStatus(item.status);
      if (status === 2) {
        Alert.alert(
          "Quotation Approved",
          "This quotation has already been approved and cannot be edited.",
        );
        return;
      }
      if (status === 1) {
        Alert.alert(
          "Quotation Sent",
          "This quotation has already been sent and cannot be edited.",
        );
        return;
      }

      const execId =
        item.sales_executive_id !== undefined &&
        item.sales_executive_id !== null
          ? String(item.sales_executive_id)
          : (item as any).sales_executive?.id !== undefined &&
              (item as any).sales_executive?.id !== null
            ? String((item as any).sales_executive.id)
            : (item as any).sales_executive &&
                typeof (item as any).sales_executive === "number"
              ? String((item as any).sales_executive)
              : "";

      router.push({
        pathname: "/quotation/editQuotationScreen",
        params: {
          quotation_id: String(item.id),
          id: String(item.id),
          sales_executive_id: execId,
          plant_id: String(
            item.plant_id || plant_id || user?.default_plant_id || "6",
          ),
          quotationData: JSON.stringify(item),
        },
      });
    },
    [plant_id, user],
  );

  const handleSubmitQuotationStatus = useCallback(
    (item: QuotationItem) => {
      Alert.alert(
        "Send Quotation",
        `Are you sure you want to submit/send Quotation "${item.reference}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Send",
            style: "default",
            onPress: async () => {
              const targetPlantId =
                plant_id ??
                item.plant_id ??
                user?.default_plant_id ??
                (user as any)?.plant_id ??
                null;

              setActionLoading("send");
              try {
                const cleanToken = token ? token.trim() : "";
                const headers: Record<string, string> = {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                };
                if (cleanToken) {
                  headers["Authorization"] = cleanToken.startsWith("Bearer ")
                    ? cleanToken
                    : `Bearer ${cleanToken}`;
                }
                if (targetPlantId !== null && targetPlantId !== undefined) {
                  headers["X-Plant-Id"] = String(targetPlantId);
                }

                console.log(
                  `[Quotation] POST ${baseURL}/quotations/${item.id}/submit`,
                  { quotation: item.id },
                );

                const res = await axios.post(
                  `${baseURL}/quotations/${item.id}/submit`,
                  {},
                  {
                    headers,
                    params: { quotation: item.id },
                    timeout: 25000,
                  },
                );

                console.log("[Quotation] Submit response:", res.data);
                updateQuotationInState(item.id, { status: 1 });
                Alert.alert(
                  "Quotation Sent",
                  res.data?.message ||
                    `Quotation ${item.reference} has been submitted successfully and is now awaiting approval.`,
                );
              } catch (err: any) {
                console.error("[Quotation] Submit error:", err);
                const errMsg =
                  err?.response?.data?.message ||
                  err?.response?.data?.error ||
                  err?.message ||
                  "Failed to send quotation.";
                Alert.alert("Send Failed", errMsg);
              } finally {
                setActionLoading(null);
              }
            },
          },
        ],
      );
    },
    [token, plant_id, user, updateQuotationInState],
  );

  const handleApproveQuotation = useCallback(
    (item: QuotationItem) => {
      Alert.alert(
        "Approve Quotation",
        `Are you sure you want to approve Quotation "${item.reference}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Approve",
            style: "default",
            onPress: async () => {
              const targetPlantId =
                plant_id ??
                item.plant_id ??
                user?.default_plant_id ??
                (user as any)?.plant_id ??
                null;

              setActionLoading("approve");
              try {
                const res = await reviewQuotationApi(
                  token,
                  targetPlantId,
                  item.id,
                  "approved",
                  "Rates approved",
                );
                console.log("[Quotation] Approve response:", res.data);
                updateQuotationInState(item.id, { status: 2 });
                Alert.alert(
                  "Quotation Approved",
                  res.data?.message ||
                    `Quotation ${item.reference} has been approved successfully. You can now convert it to a Customer PO.`,
                );
              } catch (err: any) {
                console.error(
                  "[Quotation] Approve error:",
                  err?.response?.data || err?.message || err,
                );
                const errMsg =
                  err?.response?.data?.message ||
                  err?.response?.data?.error ||
                  err?.message ||
                  "Failed to approve quotation.";
                Alert.alert("Approval Failed", errMsg);
              } finally {
                setActionLoading(null);
              }
            },
          },
        ],
      );
    },
    [token, plant_id, user, updateQuotationInState],
  );

  const handleOpenRejectModal = useCallback((item: QuotationItem) => {
    setRejectTargetItem(item);
    setRejectComment("Rejected");
    setRejectModalVisible(true);
  }, []);

  const executeRejectQuotation = useCallback(async () => {
    if (!rejectTargetItem) return;

    const targetPlantId =
      plant_id ??
      rejectTargetItem.plant_id ??
      user?.default_plant_id ??
      (user as any)?.plant_id ??
      null;

    setActionLoading("reject");
    try {
      const finalComment = rejectComment.trim() || "Rejected";
      const res = await reviewQuotationApi(
        token,
        targetPlantId,
        rejectTargetItem.id,
        "rejected",
        finalComment,
      );
      console.log("[Quotation] Reject response:", res.data);
      updateQuotationInState(rejectTargetItem.id, { status: 3 });
      setRejectModalVisible(false);
      Alert.alert(
        "Quotation Rejected",
        res.data?.message ||
          `Quotation ${rejectTargetItem.reference} has been marked as Rejected.`,
      );
    } catch (err: any) {
      console.error(
        "[Quotation] Reject error:",
        err?.response?.data || err?.message || err,
      );
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to reject quotation.";
      Alert.alert("Rejection Failed", errMsg);
    } finally {
      setActionLoading(null);
    }
  }, [
    rejectTargetItem,
    rejectComment,
    token,
    plant_id,
    user,
    updateQuotationInState,
  ]);

  const handleConvertToCustomerPO = useCallback(
    (item: QuotationItem) => {
      Alert.alert(
        "Convert to Customer PO",
        `Are you sure you want to convert Quotation "${item.reference}" into a Customer PO?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Convert",
            style: "default",
            onPress: async () => {
              const targetPlantId =
                plant_id ??
                item.plant_id ??
                user?.default_plant_id ??
                (user as any)?.plant_id ??
                null;

              setConvertingId(String(item.id));
              setActionLoading("convert");
              try {
                const res = await convertQuotationToCustomerPOApi(
                  token,
                  targetPlantId,
                  item.id,
                );
                console.log(
                  "[Quotation] Convert to Customer PO response:",
                  res.data,
                );
                updateQuotationInState(item.id, { is_customer_po: 1 });
                setViewingQuotation((prev) =>
                  prev && prev.id === item.id
                    ? { ...prev, is_customer_po: 1 }
                    : prev,
                );
                loadQuotations(false, true);
                Alert.alert(
                  "Success",
                  res.data?.message ||
                    `Quotation ${item.reference} has been converted to Customer PO successfully.`,
                  [
                    {
                      text: "View Customer POs",
                      onPress: () => router.push("/customer-po" as any),
                    },
                    { text: "OK", style: "cancel" },
                  ],
                );
              } catch (err: any) {
                console.error("[Quotation] Convert PO error:", err);
                const errMsg =
                  err?.response?.data?.message ||
                  err?.response?.data?.error ||
                  err?.message ||
                  "Failed to convert quotation to Customer PO.";
                Alert.alert("Conversion Failed", errMsg);
              } finally {
                setConvertingId(null);
                setActionLoading(null);
              }
            },
          },
        ],
      );
    },
    [token, plant_id, user, updateQuotationInState, loadQuotations],
  );

  const confirmDeleteQuotation = useCallback(
    async (item: QuotationItem) => {
      hideAlert();
      setDeletingId(item.id);
      try {
        const targetPlantId =
          plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;
        const res = await deleteQuotationAPI(item.id, token, targetPlantId);
        const successMsg = res.data?.message || "Quotation deleted.";
        setQuotations((prev) => prev.filter((q) => q.id !== item.id));
        setAlertConfig({
          visible: true,
          title: "Deleted",
          message: successMsg,
          type: "success",
          buttons: [
            {
              text: "OK",
              onPress: hideAlert,
            },
          ],
        });
        loadQuotations(false, true);
      } catch (err: any) {
        const errMsg = formatSubmissionError(
          err,
          "Failed to delete quotation.",
        );
        setAlertConfig({
          visible: true,
          title: "Delete Failed",
          message: errMsg,
          type: "error",
          buttons: [
            {
              text: "OK",
              onPress: hideAlert,
            },
          ],
        });
      } finally {
        setDeletingId(null);
      }
    },
    [hideAlert, token, plant_id, user, loadQuotations],
  );

  const handlePromptDelete = useCallback(
    (item: QuotationItem) => {
      setAlertConfig({
        visible: true,
        title: "Delete Quotation",
        message: `Are you sure you want to delete quotation "${item.reference || `#${item.id}`}"? This action cannot be undone.`,
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
            onPress: () => confirmDeleteQuotation(item),
          },
        ],
      });
    },
    [hideAlert, confirmDeleteQuotation],
  );

  const handleOptionsPress = useCallback((item: QuotationItem) => {
    setCardMenuQuotation(item);
  }, []);

  const renderQuotationCard = useCallback(
    ({ item }: { item: QuotationItem }) => {
      return (
        <QuotationCard
          item={item}
          onOpenView={handleOpenView}
          onOpenEdit={handleOpenEdit}
          onConvertToCustomerPO={handleConvertToCustomerPO}
          isConverting={convertingId === String(item.id)}
          onDeleteQuotation={handlePromptDelete}
          isDeleting={deletingId === item.id}
          onOptionsPress={handleOptionsPress}
        />
      );
    },
    [
      handleOpenView,
      handleOpenEdit,
      handleConvertToCustomerPO,
      convertingId,
      handlePromptDelete,
      deletingId,
      handleOptionsPress,
    ],
  );

  const keyExtractor = useCallback(
    (item: QuotationItem, index: number) =>
      String(item.id || item.reference || index),
    [],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#063b89"
        translucent={false}
      />

      {/* HEADER SECTION WITH LINEAR GRADIENT & MODERN GRAPHICS */}
      <LinearGradient
        colors={["#063b89", "#0B4DA8", "#1E62D0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        {/* Subtle decorative circles */}
        <View style={styles.headerBgCircle1} />
        <View style={styles.headerBgCircle2} />

        {/* Header Top Bar: Back Button, Titles, Bell & Document Illustration */}
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
              <Text style={styles.headerMainTitle}>Quotation</Text>
              <Text style={styles.headerSubtitle}>Commercial Pipeline</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {/* Notification Bell */}
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() =>
                Alert.alert(
                  "Notifications",
                  "You have no unread notifications for quotations.",
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

            {/* Stylized Document Illustration with Currency and Arrow Badge */}
            <View style={styles.headerGraphicWrapper}>
              <View style={styles.headerDocCard}>
                <View style={styles.headerDocTopBar} />
                <View style={styles.headerDocRupeeRow}>
                  <Text style={styles.headerDocRupeeText}>₹</Text>
                  <View style={styles.headerDocRupeeLine} />
                </View>
                <View style={styles.headerDocBodyLine1} />
                <View style={styles.headerDocBodyLine2} />
              </View>
              <View style={styles.headerDocGrowthBadge}>
                <Ionicons name="arrow-up" size={11} color="#FFFFFF" />
              </View>
            </View>
          </View>
        </View>

        {/* KPI Summary Cards Container (Total Quotes, Approved, Pipeline Value) */}
        <View style={styles.kpiContainer}>
          {/* Card 1: Total Quotes */}
          <View style={styles.kpiItem}>
            <View style={[styles.kpiIconBox, { backgroundColor: "#EFF6FF" }]}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={20}
                color="#2563EB"
              />
            </View>
            <View style={styles.kpiTextGroup}>
              <Text style={styles.kpiValueText}>{quotations.length}</Text>
              <Text style={styles.kpiLabelText}>Total Quotes</Text>
            </View>
          </View>

          {/* Card 2: Approved */}
          <View style={styles.kpiItem}>
            <View style={[styles.kpiIconBox, { backgroundColor: "#DCFCE7" }]}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
            </View>
            <View style={styles.kpiTextGroup}>
              <Text style={styles.kpiValueText}>{tabCounts.approved}</Text>
              <Text style={styles.kpiLabelText}>Approved</Text>
            </View>
          </View>

          {/* Card 3: Pipeline Value */}
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
                {formatCurrency(totalPipelineValue)}
              </Text>
              <Text style={styles.kpiLabelText}>Pipeline Value</Text>
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
            placeholder="Search by customer, site..."
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
          {[
            { key: "All" as const, label: `All (${tabCounts.all})` },
            { key: 0 as const, label: `Draft (${tabCounts.draft})` },
            { key: 1 as const, label: `Sent (${tabCounts.sent})` },
            { key: 2 as const, label: `Approved (${tabCounts.approved})` },
            { key: 3 as const, label: `Rejected (${tabCounts.rejected})` },
          ].map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={String(tab.key)}
                style={[
                  styles.statusPill,
                  isSelected && styles.statusPillActive,
                ]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    isSelected && styles.statusPillTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ERROR NOTICE BANNER */}
      {errorMessage && (
        <View style={styles.errorNotice}>
          <Ionicons name="warning-outline" size={16} color="#DC2626" />
          <Text style={styles.errorNoticeText}>{errorMessage}</Text>
          <TouchableOpacity onPress={() => loadQuotations(false, false)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MAIN LIST OF QUOTATIONS */}
      {loading && !refreshing && quotations.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>
            Fetching quotations from plant...
          </Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: "#F4F7FC" }}
          data={filteredQuotations}
          keyExtractor={keyExtractor}
          renderItem={renderQuotationCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
          updateCellsBatchingPeriod={50}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#2563EB"]}
              tintColor="#2563EB"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name={
                  errorMessage ? "cloud-alert" : "clipboard-text-search-outline"
                }
                size={54}
                color={errorMessage ? "#EF4444" : "#CBD5E1"}
              />
              <Text style={styles.emptyTitle}>
                {errorMessage
                  ? "Failed to Load Quotations"
                  : "No Quotations Found"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {errorMessage
                  ? errorMessage
                  : search.trim()
                    ? `No quotations matching "${search}".`
                    : activeTab !== "All"
                      ? "No quotations found for this status."
                      : "No commercial quotations available yet."}
              </Text>
              {errorMessage ? (
                <TouchableOpacity
                  style={[styles.emptyResetBtn, { backgroundColor: "#2563EB" }]}
                  onPress={() => loadQuotations(false, false)}
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
                    <Text style={styles.emptyResetBtnText}>Reset Filters</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          }
        />
      )}

      {/* FLOATING ACTION BUTTON: ADD QUOTATION */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() =>
          router.push({
            pathname: "/quotation/createQuotationScreen" as any,
            params: {
              fromLead: "false",
              timestamp: String(Date.now()),
              returnTo: "/quotation",
            },
          })
        }
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      {/* CARD 3-DOTS ACTION SHEET MODAL */}
      <Modal
        visible={Boolean(cardMenuQuotation)}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCardMenuQuotation(null)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setCardMenuQuotation(null)}
        >
          <View style={styles.actionSheetBox}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {cardMenuQuotation?.reference || "Quotation Actions"}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {cardMenuQuotation?.patron?.legal_name ||
                    cardMenuQuotation?.client ||
                    "Select an action"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCardMenuQuotation(null)}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {cardMenuQuotation && (
              <View style={styles.sheetOptionsContainer}>
                {/* View Details */}
                <TouchableOpacity
                  style={styles.sheetOptionItem}
                  onPress={() => {
                    const q = cardMenuQuotation;
                    setCardMenuQuotation(null);
                    handleOpenView(q);
                  }}
                >
                  <View
                    style={[
                      styles.sheetIconBox,
                      { backgroundColor: "#EFF6FF" },
                    ]}
                  >
                    <Ionicons name="eye-outline" size={18} color="#2563EB" />
                  </View>
                  <Text style={styles.sheetOptionText}>View Quotation</Text>
                </TouchableOpacity>

                {/* Edit Quotation */}
                {normalizeQuotationStatus(cardMenuQuotation.status) === 0 && (
                  <TouchableOpacity
                    style={styles.sheetOptionItem}
                    onPress={() => {
                      const q = cardMenuQuotation;
                      setCardMenuQuotation(null);
                      handleOpenEdit(q);
                    }}
                  >
                    <View
                      style={[
                        styles.sheetIconBox,
                        { backgroundColor: "#EFF6FF" },
                      ]}
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color="#2563EB"
                      />
                    </View>
                    <Text style={styles.sheetOptionText}>Edit Quotation</Text>
                  </TouchableOpacity>
                )}

                {/* Send Quotation (Draft) */}
                {normalizeQuotationStatus(cardMenuQuotation.status) === 0 && (
                  <TouchableOpacity
                    style={styles.sheetOptionItem}
                    onPress={() => {
                      const q = cardMenuQuotation;
                      setCardMenuQuotation(null);
                      handleSubmitQuotationStatus(q);
                    }}
                  >
                    <View
                      style={[
                        styles.sheetIconBox,
                        { backgroundColor: "#EFF6FF" },
                      ]}
                    >
                      <Ionicons name="paper-plane" size={18} color="#2563EB" />
                    </View>
                    <Text style={styles.sheetOptionText}>
                      Send / Submit Quotation
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Approve (Sent) */}
                {normalizeQuotationStatus(cardMenuQuotation.status) === 1 && (
                  <TouchableOpacity
                    style={styles.sheetOptionItem}
                    onPress={() => {
                      const q = cardMenuQuotation;
                      setCardMenuQuotation(null);
                      handleApproveQuotation(q);
                    }}
                  >
                    <View
                      style={[
                        styles.sheetIconBox,
                        { backgroundColor: "#DCFCE7" },
                      ]}
                    >
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={18}
                        color="#16A34A"
                      />
                    </View>
                    <Text style={styles.sheetOptionText}>
                      Approve Quotation
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Reject (Sent) */}
                {normalizeQuotationStatus(cardMenuQuotation.status) === 1 && (
                  <TouchableOpacity
                    style={styles.sheetOptionItem}
                    onPress={() => {
                      const q = cardMenuQuotation;
                      setCardMenuQuotation(null);
                      handleOpenRejectModal(q);
                    }}
                  >
                    <View
                      style={[
                        styles.sheetIconBox,
                        { backgroundColor: "#FEE2E2" },
                      ]}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={18}
                        color="#DC2626"
                      />
                    </View>
                    <Text
                      style={[styles.sheetOptionText, { color: "#DC2626" }]}
                    >
                      Reject Quotation
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Convert to Customer PO (Approved) */}
                {normalizeQuotationStatus(cardMenuQuotation.status) === 2 &&
                  !(
                    Number(cardMenuQuotation.is_customer_po) === 1 ||
                    String(cardMenuQuotation.is_customer_po) === "1" ||
                    Boolean((cardMenuQuotation as any).is_customer_po_converted)
                  ) && (
                    <TouchableOpacity
                      style={styles.sheetOptionItem}
                      onPress={() => {
                        const q = cardMenuQuotation;
                        setCardMenuQuotation(null);
                        handleConvertToCustomerPO(q);
                      }}
                    >
                      <View
                        style={[
                          styles.sheetIconBox,
                          { backgroundColor: "#DCFCE7" },
                        ]}
                      >
                        <Ionicons
                          name="swap-horizontal"
                          size={18}
                          color="#047857"
                        />
                      </View>
                      <Text
                        style={[styles.sheetOptionText, { color: "#047857" }]}
                      >
                        Convert to Customer PO
                      </Text>
                    </TouchableOpacity>
                  )}

                {/* Delete Quotation (Draft or Sent) */}
                {(normalizeQuotationStatus(cardMenuQuotation.status) === 0 ||
                  normalizeQuotationStatus(cardMenuQuotation.status) === 1) && (
                  <TouchableOpacity
                    style={styles.sheetOptionItem}
                    onPress={() => {
                      const q = cardMenuQuotation;
                      setCardMenuQuotation(null);
                      handlePromptDelete(q);
                    }}
                  >
                    <View
                      style={[
                        styles.sheetIconBox,
                        { backgroundColor: "#FEF2F2" },
                      ]}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#DC2626"
                      />
                    </View>
                    <Text
                      style={[styles.sheetOptionText, { color: "#DC2626" }]}
                    >
                      Delete Quotation
                    </Text>
                  </TouchableOpacity>
                )}
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
              <Text style={styles.sheetTitle}>Sort & Filter</Text>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }}>
              {/* Sort By Section */}
              <Text style={styles.filterSectionHeader}>SORT BY</Text>
              {[
                { key: "newest" as const, label: "Newest First" },
                { key: "oldest" as const, label: "Oldest First" },
                { key: "amount_high" as const, label: "Value: High to Low" },
                { key: "amount_low" as const, label: "Value: Low to High" },
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
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#2563EB"
                    />
                  )}
                </TouchableOpacity>
              ))}

              {/* Status Filter Section */}
              <Text style={[styles.filterSectionHeader, { marginTop: 18 }]}>
                STATUS
              </Text>
              {[
                { key: "All" as const, label: "All Quotations" },
                { key: 0 as const, label: "Draft" },
                { key: 1 as const, label: "Sent" },
                { key: 2 as const, label: "Approved" },
                { key: 3 as const, label: "Rejected" },
              ].map((tab) => (
                <TouchableOpacity
                  key={String(tab.key)}
                  style={styles.filterCheckRow}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text
                    style={[
                      styles.filterCheckLabel,
                      activeTab === tab.key && styles.filterCheckLabelActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {activeTab === tab.key && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#2563EB"
                    />
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

      {/* VIEW DETAILS MODAL */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.viewModalContainer}>
            {/* Header */}
            <View style={styles.viewModalHeader}>
              <View style={styles.viewModalHeaderInfo}>
                <Text style={styles.viewModalTitle}>Quotation Details</Text>
                {viewingQuotation && (
                  <View style={styles.viewModalHeaderBadges}>
                    <View style={styles.quoteNumberBadge}>
                      <MaterialCommunityIcons
                        name="file-document-outline"
                        size={13}
                        color="#2563EB"
                      />
                      <Text style={styles.quoteNumberText}>
                        {viewingQuotation.reference}
                      </Text>
                    </View>

                    {(Number(viewingQuotation.is_customer_po) === 1 ||
                      String(viewingQuotation.is_customer_po) === "1" ||
                      Boolean(
                        (viewingQuotation as any).is_customer_po_converted,
                      )) && (
                      <View style={styles.poBadge}>
                        <Ionicons
                          name="shield-checkmark"
                          size={11}
                          color="#047857"
                        />
                        <Text style={styles.poBadgeText}>
                          Customer PO Converted
                        </Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: getStatusMeta(
                            viewingQuotation.status,
                          ).bg,
                          borderColor: getStatusMeta(viewingQuotation.status)
                            .border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          getStatusMeta(viewingQuotation.status).icon as any
                        }
                        size={13}
                        color={getStatusMeta(viewingQuotation.status).color}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          {
                            color: getStatusMeta(viewingQuotation.status).color,
                          },
                        ]}
                      >
                        {getStatusMeta(viewingQuotation.status).label}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.viewModalCloseBtn}
                onPress={() => setViewModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Content Loader */}
            {viewLoading && (
              <View style={styles.modalLoadingBar}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.modalLoadingText}>
                  Refreshing details...
                </Text>
              </View>
            )}

            {viewingQuotation ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.viewModalScrollContent}
              >
                {/* Customer & Site */}
                <View style={styles.viewSectionCard}>
                  <Text style={styles.viewSectionTitle}>
                    Project & Customer
                  </Text>

                  <View style={styles.viewDetailRow}>
                    <View style={styles.viewDetailLabelGroup}>
                      <Ionicons
                        name="business-outline"
                        size={14}
                        color="#64748B"
                      />
                      <Text style={styles.viewDetailLabel}>Customer</Text>
                    </View>
                    <Text style={styles.viewDetailValue}>
                      {viewingQuotation.patron?.legal_name ||
                        viewingQuotation.client ||
                        "Customer Not Specified"}
                    </Text>
                  </View>

                  <View style={styles.viewDetailRow}>
                    <View style={styles.viewDetailLabelGroup}>
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color="#64748B"
                      />
                      <Text style={styles.viewDetailLabel}>Delivery Site</Text>
                    </View>
                    <Text style={styles.viewDetailValue}>
                      {viewingQuotation.site?.name || "Main Site"}
                    </Text>
                  </View>

                  {(viewingQuotation.sales_executive?.label ||
                    viewingQuotation.sales_executive?.name ||
                    (viewingQuotation as any)?.sales_executive_name) && (
                    <View style={styles.viewDetailRow}>
                      <View style={styles.viewDetailLabelGroup}>
                        <Ionicons
                          name="person-outline"
                          size={14}
                          color="#64748B"
                        />
                        <Text style={styles.viewDetailLabel}>
                          Sales Executive
                        </Text>
                      </View>
                      <Text style={styles.viewDetailValue}>
                        {viewingQuotation.sales_executive?.label ||
                          viewingQuotation.sales_executive?.name ||
                          (viewingQuotation as any)?.sales_executive_name}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Dates & Commercial Terms */}
                <View style={styles.viewSectionCard}>
                  <Text style={styles.viewSectionTitle}>Quotation Terms</Text>

                  <View style={styles.viewDetailRow}>
                    <View style={styles.viewDetailLabelGroup}>
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color="#64748B"
                      />
                      <Text style={styles.viewDetailLabel}>Quote Date</Text>
                    </View>
                    <Text style={styles.viewDetailValue}>
                      {formatDate(viewingQuotation.quote_date)}
                    </Text>
                  </View>

                  <View style={styles.viewDetailRow}>
                    <View style={styles.viewDetailLabelGroup}>
                      <Ionicons name="time-outline" size={14} color="#64748B" />
                      <Text style={styles.viewDetailLabel}>Valid Until</Text>
                    </View>
                    <Text style={styles.viewDetailValue}>
                      {formatDate(viewingQuotation.validity_date)}
                    </Text>
                  </View>

                  <View style={styles.viewDetailRow}>
                    <View style={styles.viewDetailLabelGroup}>
                      <Ionicons
                        name="receipt-outline"
                        size={14}
                        color="#64748B"
                      />
                      <Text style={styles.viewDetailLabel}>Tax Policy</Text>
                    </View>
                    <Text style={styles.viewDetailValue}>
                      {viewingQuotation.is_tax_inclusive
                        ? "Inclusive of Taxes"
                        : "Exclusive of Taxes"}
                    </Text>
                  </View>

                  {viewingQuotation.pump_type ? (
                    <View style={styles.viewDetailRow}>
                      <View style={styles.viewDetailLabelGroup}>
                        <Ionicons
                          name="flash-outline"
                          size={14}
                          color="#64748B"
                        />
                        <Text style={styles.viewDetailLabel}>
                          Pump Requirement
                        </Text>
                      </View>
                      <Text style={styles.viewDetailValue}>
                        {viewingQuotation.pump_type}
                        {viewingQuotation.pump_rate
                          ? ` (${formatCurrency(viewingQuotation.pump_rate)})`
                          : ""}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Mix Designs / Line Items */}
                <View style={styles.viewSectionCard}>
                  <Text style={styles.viewSectionTitle}>
                    Line Items & Mix Design
                  </Text>

                  {Array.isArray(viewingQuotation.items) &&
                  viewingQuotation.items.length > 0 ? (
                    viewingQuotation.items.map((lineItem, idx) => {
                      const mixName =
                        lineItem.mix_design?.design_name ||
                        lineItem.mix_design?.name ||
                        lineItem.mix_design?.design_code ||
                        `Mix Design #${idx + 1}`;
                      const qty = parseFloat(String(lineItem.quantity || "0"));
                      const rate = parseFloat(String(lineItem.rate || "0"));
                      const lineTotal =
                        lineItem.amount_total || (qty * rate).toFixed(2);

                      return (
                        <View
                          key={lineItem.id || idx}
                          style={styles.viewLineItemCard}
                        >
                          <View style={styles.viewLineItemHeader}>
                            <Text
                              style={styles.viewLineItemName}
                              numberOfLines={2}
                            >
                              {mixName}
                            </Text>
                            <Text style={styles.viewLineItemTotal}>
                              {formatCurrency(lineTotal)}
                            </Text>
                          </View>

                          <View style={styles.viewLineItemGrid}>
                            <View style={styles.viewLineItemPill}>
                              <Text style={styles.viewLineItemPillText}>
                                Qty: {qty} m³
                              </Text>
                            </View>
                            <View style={styles.viewLineItemPill}>
                              <Text style={styles.viewLineItemPillText}>
                                Rate: {formatCurrency(rate)}
                              </Text>
                            </View>
                            {lineItem.concrete_pump ? (
                              <View style={styles.viewLineItemPill}>
                                <Text style={styles.viewLineItemPillText}>
                                  Pump: {lineItem.concrete_pump}
                                </Text>
                              </View>
                            ) : null}
                            {lineItem.tax_amount ? (
                              <View style={styles.viewLineItemPill}>
                                <Text style={styles.viewLineItemPillText}>
                                  Tax: {formatCurrency(lineItem.tax_amount)}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.viewLineItemCard}>
                      <View style={styles.viewLineItemHeader}>
                        <Text style={styles.viewLineItemName}>
                          {viewingQuotation.mix_design || "Standard Mix Design"}
                        </Text>
                        <Text style={styles.viewLineItemTotal}>
                          {formatCurrency(viewingQuotation.amount_total)}
                        </Text>
                      </View>
                      <View style={styles.viewLineItemGrid}>
                        <View style={styles.viewLineItemPill}>
                          <Text style={styles.viewLineItemPillText}>
                            Qty:{" "}
                            {viewingQuotation.volume ||
                              viewingQuotation.quantity ||
                              0}{" "}
                            m³
                          </Text>
                        </View>
                        {viewingQuotation.rate ? (
                          <View style={styles.viewLineItemPill}>
                            <Text style={styles.viewLineItemPillText}>
                              Rate: {formatCurrency(viewingQuotation.rate)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  )}
                </View>

                {/* Pricing Summary */}
                <View style={styles.viewTotalsCard}>
                  <Text style={styles.viewSectionTitle}>
                    Financial Breakdown
                  </Text>

                  {viewingQuotation.amount_untaxed ? (
                    <View style={styles.viewDetailRow}>
                      <Text style={styles.viewDetailLabel}>Untaxed Amount</Text>
                      <Text style={styles.viewDetailValue}>
                        {formatCurrency(viewingQuotation.amount_untaxed)}
                      </Text>
                    </View>
                  ) : null}

                  {viewingQuotation.amount_tax ||
                  viewingQuotation.tax_amount ? (
                    <View style={styles.viewDetailRow}>
                      <Text style={styles.viewDetailLabel}>Tax / GST</Text>
                      <Text style={styles.viewDetailValue}>
                        {formatCurrency(
                          viewingQuotation.amount_tax ||
                            viewingQuotation.tax_amount,
                        )}
                      </Text>
                    </View>
                  ) : null}

                  {viewingQuotation.adjustment &&
                  parseFloat(viewingQuotation.adjustment) !== 0 ? (
                    <View style={styles.viewDetailRow}>
                      <Text style={styles.viewDetailLabel}>Adjustment</Text>
                      <Text style={styles.viewDetailValue}>
                        {formatCurrency(viewingQuotation.adjustment)}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.viewTotalFinalRow}>
                    <Text style={styles.viewTotalFinalLabel}>Total Value</Text>
                    <Text style={styles.viewTotalFinalValue}>
                      {formatCurrency(viewingQuotation.amount_total)}
                    </Text>
                  </View>
                </View>

                {/* Notes */}
                {viewingQuotation.notes ? (
                  <View style={styles.viewSectionCard}>
                    <Text style={styles.viewSectionTitle}>Notes & Remarks</Text>
                    <Text style={styles.viewNotesText}>
                      {viewingQuotation.notes}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            ) : null}

            {/* Modal Footer Actions */}
            {viewingQuotation &&
              (() => {
                const currentStatus = normalizeQuotationStatus(
                  viewingQuotation.status,
                );
                return (
                  <View style={styles.viewModalFooter}>
                    {currentStatus === 0 ? (
                      <TouchableOpacity
                        style={styles.modalBtnSend}
                        onPress={() =>
                          handleSubmitQuotationStatus(viewingQuotation)
                        }
                        activeOpacity={0.8}
                        disabled={Boolean(actionLoading)}
                      >
                        {actionLoading === "send" ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons
                              name="paper-plane"
                              size={18}
                              color="#FFFFFF"
                            />
                            <Text style={styles.modalBtnSendText}>
                              Send Quotation
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : currentStatus === 1 ? (
                      <>
                        <TouchableOpacity
                          style={styles.modalBtnReject}
                          onPress={() =>
                            handleOpenRejectModal(viewingQuotation)
                          }
                          activeOpacity={0.8}
                          disabled={Boolean(actionLoading)}
                        >
                          {actionLoading === "reject" ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <>
                              <Ionicons
                                name="close-circle-outline"
                                size={18}
                                color="#DC2626"
                              />
                              <Text style={styles.modalBtnRejectText}>
                                Reject
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.modalBtnApprove}
                          onPress={() =>
                            handleApproveQuotation(viewingQuotation)
                          }
                          activeOpacity={0.8}
                          disabled={Boolean(actionLoading)}
                        >
                          {actionLoading === "approve" ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons
                                name="checkmark-circle-outline"
                                size={18}
                                color="#FFFFFF"
                              />
                              <Text style={styles.modalBtnApproveText}>
                                Approve
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : currentStatus === 2 ? (
                      !(
                        Number(viewingQuotation.is_customer_po) === 1 ||
                        String(viewingQuotation.is_customer_po) === "1" ||
                        Boolean(
                          (viewingQuotation as any).is_customer_po_converted,
                        )
                      ) ? (
                        <TouchableOpacity
                          style={styles.modalBtnConvert}
                          onPress={() =>
                            handleConvertToCustomerPO(viewingQuotation)
                          }
                          activeOpacity={0.8}
                          disabled={Boolean(actionLoading)}
                        >
                          {actionLoading === "convert" ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <MaterialCommunityIcons
                                name="swap-horizontal"
                                size={20}
                                color="#FFFFFF"
                              />
                              <Text style={styles.modalBtnConvertText}>
                                Convert to Customer PO
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.modalPoConvertedBadge}>
                          <Ionicons
                            name="shield-checkmark"
                            size={18}
                            color="#047857"
                          />
                          <Text style={styles.modalPoConvertedText}>
                            Customer PO Converted
                          </Text>
                        </View>
                      )
                    ) : null}
                  </View>
                );
              })()}
          </View>
        </View>
      </Modal>

      {/* REJECT COMMENT MODAL */}
      <Modal
        visible={rejectModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.rejectDialogOverlay}>
          <View style={styles.rejectDialogBox}>
            <Text style={styles.rejectDialogTitle}>Reject Quotation</Text>
            <Text style={styles.rejectDialogSubtitle}>
              {rejectTargetItem
                ? `Specify reason for rejecting quotation ${rejectTargetItem.reference}:`
                : "Enter rejection comment:"}
            </Text>

            <TextInput
              style={styles.rejectInput}
              value={rejectComment}
              onChangeText={setRejectComment}
              placeholder="Rejected"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
            />

            <View style={styles.rejectDialogBtnRow}>
              <TouchableOpacity
                style={styles.rejectDialogCancelBtn}
                onPress={() => setRejectModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.rejectDialogCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rejectDialogConfirmBtn}
                onPress={executeRejectQuotation}
                activeOpacity={0.7}
                disabled={actionLoading === "reject"}
              >
                {actionLoading === "reject" ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.rejectDialogConfirmText}>Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ANIMATED CUSTOM ALERT MODAL */}
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

  // Stylized 3D Document Illustration with Growth Arrow Badge
  headerGraphicWrapper: {
    position: "relative",
    width: 46,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  headerDocCard: {
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
  headerDocTopBar: {
    height: 4,
    backgroundColor: "#2563EB",
    borderRadius: 2,
    marginBottom: 4,
  },
  headerDocRupeeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 3,
  },
  headerDocRupeeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  headerDocRupeeLine: {
    flex: 1,
    height: 3,
    backgroundColor: "#93C5FD",
    borderRadius: 1.5,
  },
  headerDocBodyLine1: {
    height: 2.5,
    backgroundColor: "#E2E8F0",
    borderRadius: 1.5,
    marginBottom: 2.5,
  },
  headerDocBodyLine2: {
    height: 2.5,
    width: "70%",
    backgroundColor: "#CBD5E1",
    borderRadius: 1.5,
  },
  headerDocGrowthBadge: {
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

  // Search and Filter Bar Row
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

  // Horizontal Status Tabs Row
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

  // Quotation Card Design (matching exact uploaded UI)
  quoteCard: {
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
  badgesRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  poBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  poBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
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

  // Customer & 3-Dots
  customerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  projectNameText: {
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

  // Location / Site Row
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 12,
  },
  contactPersonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    flex: 1,
  },
  pumpBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  pumpBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
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

  // Multi Items Chips
  multiItemsPreviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  multiItemChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    gap: 4,
  },
  multiItemChipText: {
    fontSize: 10,
    color: "#1E40AF",
    fontWeight: "600",
  },

  // Dates Row
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

  // Card Footer Buttons
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
  actionViewBtn: {
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
  actionViewText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
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
  actionConvertBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 4,
  },
  actionConvertText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
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
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  // Empty & Loading States
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F4F7FC",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
  },
  loadingText: {
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

  // View Modal Container & Styles
  viewModalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    minHeight: "50%",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  viewModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  viewModalHeaderInfo: {
    flex: 1,
    marginRight: 12,
  },
  viewModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  viewModalHeaderBadges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  viewModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalLoadingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 6,
    gap: 8,
  },
  modalLoadingText: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "600",
  },
  viewModalScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  viewSectionCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  viewSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.6,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  viewDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  viewDetailLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  viewDetailLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  viewDetailValue: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  viewLineItemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  viewLineItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 8,
  },
  viewLineItemName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  viewLineItemTotal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#059669",
  },
  viewLineItemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  viewLineItemPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  viewLineItemPillText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  viewTotalsCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 12,
  },
  viewTotalFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#DBEAFE",
  },
  viewTotalFinalLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E3A8A",
  },
  viewTotalFinalValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#15803D",
  },
  viewNotesText: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },
  viewModalFooter: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    gap: 10,
  },
  modalBtnSend: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  modalBtnSendText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  modalBtnApprove: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16A34A",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalBtnApproveText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalBtnReject: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  modalBtnRejectText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "700",
  },
  modalBtnConvert: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#047857",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    shadowColor: "#047857",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  modalBtnConvertText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalPoConvertedBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  modalPoConvertedText: {
    color: "#047857",
    fontSize: 14,
    fontWeight: "700",
  },

  // Reject Dialog Box
  rejectDialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  rejectDialogBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  rejectDialogTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  rejectDialogSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 14,
    lineHeight: 18,
  },
  rejectInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
    marginBottom: 16,
    minHeight: 60,
    textAlignVertical: "top",
  },
  rejectDialogBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  rejectDialogCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  rejectDialogCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  rejectDialogConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#DC2626",
  },
  rejectDialogConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
