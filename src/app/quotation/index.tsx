import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { RootState } from "@/store/store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { router, useFocusEffect } from "expo-router";
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

export const normalizeQuotationStatus = (
  status: any,
): number => {
  if (status === null || status === undefined) return 0;
  if (typeof status === "object") {
    if (status.value !== undefined) return normalizeQuotationStatus(status.value);
    if (status.id !== undefined) return normalizeQuotationStatus(status.id);
    if (status.name !== undefined) return normalizeQuotationStatus(status.name);
    if (status.status !== undefined) return normalizeQuotationStatus(status.status);
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
        border: "#CBD5E1",
        dot: "#94A3B8",
        icon: "pencil-outline" as const,
      };
    case 1:
      return {
        key: "sent",
        code: 1,
        label: "Sent",
        color: "#1D4ED8",
        bg: "#EFF6FF",
        border: "#BFDBFE",
        dot: "#2563EB",
        icon: "time-outline" as const,
      };
    case 2:
      return {
        key: "approved",
        code: 2,
        label: "Approved",
        color: "#15803D",
        bg: "#DCFCE7",
        border: "#86EFAC",
        dot: "#16A34A",
        icon: "checkmark-circle-outline" as const,
      };
    case 3:
      return {
        key: "rejected",
        code: 3,
        label: "Rejected",
        color: "#BE123C",
        bg: "#FFE4E6",
        border: "#FECDD3",
        dot: "#DC2626",
        icon: "close-circle-outline" as const,
      };
    default:
      return {
        key: "unknown",
        code: -1,
        label: `Status ${status}`,
        color: "#64748B",
        bg: "#F8FAFC",
        border: "#CBD5E1",
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

interface QuotationCardProps {
  item: QuotationItem;
  onOpenView: (item: QuotationItem) => void;
  onOpenEdit: (item: QuotationItem) => void;
  onConvertToCustomerPO: (item: QuotationItem) => void;
  isConverting?: boolean;
}

const QuotationCard = React.memo(function QuotationCard({
  item,
  onOpenView,
  onOpenEdit,
  onConvertToCustomerPO,
  isConverting = false,
}: QuotationCardProps) {
  const statusCode = normalizeQuotationStatus(item.status);
  const isApproved = statusCode === 2;
  const isSent = statusCode === 1;
  const canEdit = statusCode === 0;
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
      <View style={styles.cardHeader}>
        <View style={styles.quoteNumberBadge}>
          <MaterialCommunityIcons
            name={"file-document-outline"}
            size={14}
            color={"#2563EB"}
          />
          <Text style={styles.quoteNumberText}>{item.reference}</Text>
        </View>

        <View style={styles.badgesRightRow}>
          {item.is_customer_po === 1 && (
            <View style={styles.poBadge}>
              <Ionicons
                name={"shield-checkmark"}
                size={11}
                color={"#047857"}
              />
              <Text style={styles.poBadgeText}>Customer PO Converted</Text>
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
            <View
              style={[styles.statusDot, { backgroundColor: statusMeta.dot }]}
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

      <View style={styles.projectSection}>
        <View style={styles.projectTitleRow}>
          <Text style={styles.projectNameText} numberOfLines={2}>
            {customer}
          </Text>
          {item.pump_type ? (
            <View style={styles.pumpBadge}>
              <Ionicons name={"flash-outline"} size={11} color={"#64748B"} />
              <Text style={styles.pumpBadgeText}>{item.pump_type}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.contactRow}>
          <Ionicons name={"location"} size={14} color={"#DC2626"} />
          <Text style={styles.contactPersonText} numberOfLines={1}>
            {site}
          </Text>
        </View>
      </View>

      <View style={styles.specBox}>
        <View style={styles.specCol}>
          <View style={styles.specHeaderRow}>
            <MaterialCommunityIcons
              name={"layers-triple-outline"}
              size={13}
              color={"#64748B"}
            />
            <Text style={styles.specLabel}>MIX DESIGN</Text>
          </View>
          <Text style={styles.specValue} numberOfLines={1}>
            {mix}
          </Text>
        </View>

        <View style={styles.specDivider} />

        <View style={styles.specCol}>
          <View style={styles.specHeaderRow}>
            <MaterialCommunityIcons
              name={"cube-outline"}
              size={13}
              color={"#2563EB"}
            />
            <Text style={styles.specLabel}>VOLUME</Text>
          </View>
          <Text style={[styles.specValue, { color: "#2563EB" }]}>
            {String(volume).includes("m³") ? volume : `${volume} m³`}
          </Text>
        </View>

        <View style={styles.specDivider} />

        <View style={styles.specCol}>
          <View style={styles.specHeaderRow}>
            <Ionicons name={"cash-outline"} size={13} color={"#059669"} />
            <Text style={styles.specLabel}>TOTAL VALUE</Text>
          </View>
          <Text
            style={[
              styles.specValue,
              { color: "#059669", fontWeight: "800" },
            ]}
          >
            {formattedTotal}
          </Text>
        </View>
      </View>

      {Array.isArray(item.items) && item.items.length > 1 && (
        <View style={styles.multiItemsPreviewRow}>
          {item.items.map((lineItem, idx) => (
            <View key={lineItem.id || idx} style={styles.multiItemChip}>
              <Ionicons name={"cube-outline"} size={11} color={"#2563EB"} />
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

      <View style={styles.datesBar}>
        <View style={styles.dateItem}>
          <Ionicons name={"calendar-outline"} size={13} color={"#64748B"} />
          <Text style={styles.dateLabel}>
            Quote: <Text style={styles.dateVal}>{formattedQuoteDate}</Text>
          </Text>
        </View>

        <View style={styles.dateItem}>
          <Ionicons name={"time-outline"} size={13} color={"#64748B"} />
          <Text style={styles.dateLabel}>
            Valid Till: <Text style={styles.dateVal}>{formattedValidityDate}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          {item.notes ? (
            <Text style={styles.notesSnippet} numberOfLines={1}>
              {item.notes}
            </Text>
          ) : (
            <Text style={styles.taxInclusiveText}>
              Inclusive of all Taxes
            </Text>
          )}
        </View>

        <View style={styles.actionButtonsGroup}>
          <TouchableOpacity
            style={styles.actionViewBtn}
            activeOpacity={0.7}
            onPress={() => onOpenView(item)}
          >
            <Ionicons name="eye-outline" size={13} color={"#0F172A"} />
            <Text style={styles.actionViewText}>View</Text>
          </TouchableOpacity>

          {canEdit && (
            <TouchableOpacity
              style={styles.actionEditBtn}
              onPress={() => onOpenEdit(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={13} color={"#2563EB"} />
              <Text style={styles.actionEditText}>Edit</Text>
            </TouchableOpacity>
          )}

          {isApproved && (
            <TouchableOpacity
              style={[
                styles.actionConvertBtn,
                isPOConverted && styles.actionConvertedBtn,
              ]}
              onPress={() => onConvertToCustomerPO(item)}
              activeOpacity={0.7}
              disabled={isConverting}
            >
              {isConverting ? (
                <ActivityIndicator
                  size="small"
                  color={isPOConverted ? "#15803D" : "#047857"}
                />
              ) : (
                <>
                  <Ionicons
                    name={isPOConverted ? "checkmark-done-circle" : "swap-horizontal"}
                    size={14}
                    color={isPOConverted ? "#15803D" : "#047857"}
                  />
                  <Text
                    style={[
                      styles.actionConvertText,
                      isPOConverted && styles.actionConvertedText,
                    ]}
                  >
                    {isPOConverted
                      ? "Converted to Customer PO"
                      : "Convert to Customer PO"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
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

  // View & Review & Convert PO States
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [viewingQuotation, setViewingQuotation] = useState<QuotationItem | null>(null);
  const [viewLoading, setViewLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<"approve" | "reject" | "convert" | "send" | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  // Reject Dialog States
  const [rejectModalVisible, setRejectModalVisible] = useState<boolean>(false);
  const [rejectTargetItem, setRejectTargetItem] = useState<QuotationItem | null>(null);
  const [rejectComment, setRejectComment] = useState<string>("Rejected");

  const isMountedRef = useRef<boolean>(false);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
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

      // Step 2: Fetch fresh data without timeout (same as Postman)
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

      // On initial focus, load cache + fetch. On subsequent focus (e.g. back from edit/create), refresh silently
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
    return quotations.filter((item) => {
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
  }, [quotations, activeTab, search]);

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
        const res = await fetchQuotationDetailApi(token, targetPlantId, item.id);
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
        item.sales_executive_id !== undefined && item.sales_executive_id !== null
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
                console.error("[Quotation] Approve error:", err?.response?.data || err?.message || err);
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
      console.error("[Quotation] Reject error:", err?.response?.data || err?.message || err);
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

  const renderQuotationCard = useCallback(
    ({ item }: { item: QuotationItem }) => {
      return (
        <QuotationCard
          item={item}
          onOpenView={handleOpenView}
          onOpenEdit={handleOpenEdit}
          onConvertToCustomerPO={handleConvertToCustomerPO}
          isConverting={convertingId === String(item.id)}
        />
      );
    },
    [handleOpenView, handleOpenEdit, handleConvertToCustomerPO, convertingId],
  );

  const keyExtractor = useCallback(
    (item: QuotationItem, index: number) =>
      String(item.id || item.reference || index),
    [],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle={"light-content"}
        backgroundColor={"#0B2A4A"}
        translucent={false}
      />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.headerTitleRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <Ionicons name={"arrow-back"} size={20} color={"#fff"} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Quotations</Text>
            </View>
            <View style={styles.plantBadgeRow}>
              <Ionicons name={"business"} size={12} color={"#94A3B8"} />
              <Text style={styles.plantBadgeText}>
                {plant_name ? plant_name : "Ready-Mix Commercial Pipeline"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <Ionicons
              name={"reload-outline"}
              size={18}
              color={"#fff"}
              style={
                refreshing ? { transform: [{ rotate: "45deg" }] } : undefined
              }
            />
          </TouchableOpacity>
        </View>

        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL QUOTES</Text>
            <Text style={styles.kpiValue}>{quotations.length}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>APPROVED</Text>
            <Text style={[styles.kpiValue, { color: "#34D399" }]}>
              {tabCounts.approved}
            </Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>PIPELINE VALUE</Text>
            <Text
              style={[styles.kpiValue, { color: "#60A5FA" }]}
              numberOfLines={1}
            >
              {formatCurrency(totalPipelineValue)}
            </Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={"#64748B"} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer, site..."
            placeholderTextColor={"#94A3B8"}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={"#94A3B8"} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {[
            { key: "All" as const, label: "All", count: tabCounts.all },
            { key: 0 as const, label: "Draft", count: tabCounts.draft },
            { key: 1 as const, label: "Sent", count: tabCounts.sent },
            { key: 2 as const, label: "Approved", count: tabCounts.approved },
            { key: 3 as const, label: "Rejected", count: tabCounts.rejected },
          ].map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={String(tab.key)}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipActive,
                ]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.filterCountBadge,
                    isSelected && styles.filterCountBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterCountText,
                      isSelected && styles.filterCountTextActive,
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

      {errorMessage && (
        <View style={styles.errorNotice}>
          <Ionicons name="warning-outline" size={16} color={"#DC2626"} />
          <Text style={styles.errorNoticeText}>{errorMessage}</Text>
          <TouchableOpacity onPress={() => loadQuotations(false, false)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && !refreshing && quotations.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size={"large"} color={"#2563EB"} />
          <Text style={styles.loadingText}>
            Fetching quotations from plant...
          </Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: "#F8FAFC" }}
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
              tintColor={"#2563EB"}
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
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </TouchableOpacity>

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

                    {viewingQuotation.is_customer_po === 1 && (
                      <View style={styles.poBadge}>
                        <Ionicons
                          name="shield-checkmark"
                          size={11}
                          color="#047857"
                        />
                        <Text style={styles.poBadgeText}>Customer PO Converted</Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: getStatusMeta(viewingQuotation.status).bg,
                          borderColor: getStatusMeta(viewingQuotation.status).border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: getStatusMeta(
                              viewingQuotation.status,
                            ).dot,
                          },
                        ]}
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
                <Text style={styles.modalLoadingText}>Refreshing details...</Text>
              </View>
            )}

            {viewingQuotation ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.viewModalScrollContent}
              >
                {/* Customer & Site */}
                <View style={styles.viewSectionCard}>
                  <Text style={styles.viewSectionTitle}>Project & Customer</Text>

                  <View style={styles.viewDetailRow}>
                    <View style={styles.viewDetailLabelGroup}>
                      <Ionicons name="business-outline" size={14} color="#64748B" />
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
                      <Ionicons name="location-outline" size={14} color="#64748B" />
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
                        <Ionicons name="person-outline" size={14} color="#64748B" />
                        <Text style={styles.viewDetailLabel}>Sales Executive</Text>
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
                      <Ionicons name="calendar-outline" size={14} color="#64748B" />
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
                      <Ionicons name="receipt-outline" size={14} color="#64748B" />
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
                        <Ionicons name="flash-outline" size={14} color="#64748B" />
                        <Text style={styles.viewDetailLabel}>Pump Requirement</Text>
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
                  <Text style={styles.viewSectionTitle}>Line Items & Mix Design</Text>

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
                        <View key={lineItem.id || idx} style={styles.viewLineItemCard}>
                          <View style={styles.viewLineItemHeader}>
                            <Text style={styles.viewLineItemName} numberOfLines={2}>
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
                            Qty: {viewingQuotation.volume || viewingQuotation.quantity || 0} m³
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
                  <Text style={styles.viewSectionTitle}>Financial Breakdown</Text>

                  {viewingQuotation.amount_untaxed ? (
                    <View style={styles.viewDetailRow}>
                      <Text style={styles.viewDetailLabel}>Untaxed Amount</Text>
                      <Text style={styles.viewDetailValue}>
                        {formatCurrency(viewingQuotation.amount_untaxed)}
                      </Text>
                    </View>
                  ) : null}

                  {viewingQuotation.amount_tax || viewingQuotation.tax_amount ? (
                    <View style={styles.viewDetailRow}>
                      <Text style={styles.viewDetailLabel}>Tax / GST</Text>
                      <Text style={styles.viewDetailValue}>
                        {formatCurrency(
                          viewingQuotation.amount_tax || viewingQuotation.tax_amount,
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
                    <Text style={styles.viewNotesText}>{viewingQuotation.notes}</Text>
                  </View>
                ) : null}
              </ScrollView>
            ) : null}

            {/* Modal Footer Actions */}
            {viewingQuotation && (() => {
              const currentStatus = normalizeQuotationStatus(viewingQuotation.status);
              return (
                <View style={styles.viewModalFooter}>
                  {currentStatus === 0 ? (
                    // Draft status: Show "Sent" button
                    <TouchableOpacity
                      style={styles.modalBtnSend}
                      onPress={() => handleSubmitQuotationStatus(viewingQuotation)}
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
                          <Text style={styles.modalBtnSendText}>Sent</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : currentStatus === 1 ? (
                    // Sent status: Show Reject and Approve buttons
                    <>
                      <TouchableOpacity
                        style={styles.modalBtnReject}
                        onPress={() => handleOpenRejectModal(viewingQuotation)}
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
                            <Text style={styles.modalBtnRejectText}>Reject</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.modalBtnApprove}
                        onPress={() => handleApproveQuotation(viewingQuotation)}
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
                            <Text style={styles.modalBtnApproveText}>Approve</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : currentStatus === 2 ? (
                    // Approved status: Show Convert to Customer PO button
                    <TouchableOpacity
                      style={styles.modalBtnConvert}
                      onPress={() => handleConvertToCustomerPO(viewingQuotation)}
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
                            {Number(viewingQuotation.is_customer_po) === 1
                              ? "Converted to Customer PO"
                              : "Convert to Customer PO"}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B2A4A",
  },
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
  },
  plantBadgeText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Quick KPI Strip
  kpiContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
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
    fontSize: 13,
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

  // Filter Chips Section
  filterSection: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingTop: 8,
    paddingBottom: 6,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
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
    fontWeight: "700",
  },
  filterCountBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  filterCountBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },
  filterCountTextActive: {
    color: "#FFFFFF",
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
    paddingTop: 12,
    paddingBottom: 80,
  },

  // Card Design (Exact Lead Card Design)
  quoteCard: {
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
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  quoteNumberBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    flexShrink: 1,
  },
  quoteNumberText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.5,
  },
  badgesRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  poBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
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
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
    flexShrink: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    includeFontPadding: false,
  },

  // Project & Contact
  projectSection: {
    marginBottom: 10,
  },
  projectTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  projectNameText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 20,
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
    color: "#475569",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  contactPersonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },

  // Core Concrete Specs Grid
  specBox: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
  },
  specCol: {
    flex: 1,
  },
  specHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  specLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  specValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  specDivider: {
    width: 1,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 8,
  },

  // Dates Bar
  datesBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  dateItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  dateVal: {
    fontWeight: "700",
    color: "#1E293B",
  },

  // Card Footer Actions
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
    marginTop: 2,
  },
  footerLeft: {
    flex: 1,
    marginRight: 8,
  },
  taxInclusiveText: {
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
  },
  notesSnippet: {
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
  },
  actionButtonsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionViewBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    gap: 4,
  },
  actionViewText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
  },
  actionEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 4,
  },
  actionEditText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  actionConvertBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 4,
  },
  actionConvertText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  actionConvertedBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    gap: 4,
  },
  actionConvertedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D",
  },
  // Multi-item chips
  multiItemsPreviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  multiItemChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  multiItemChipText: {
    fontSize: 11,
    color: "#1E40AF",
    fontWeight: "600",
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
    shadowRadius: 6,
    elevation: 6,
  },

  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
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

  // Modals Overlay & Container
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
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
  modalBtnConvertedBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  modalBtnConvertedBadgeText: {
    color: "#047857",
    fontSize: 13,
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
