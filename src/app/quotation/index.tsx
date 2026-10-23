import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { RootState } from "@/store/store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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

export const getStatusMeta = (status: number | string | null | undefined) => {
  const s = Number(status);
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

async function fetchQuotationsApi(
  token: string | null,
  plantId: number | null,
) {
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

  if (plantId !== null && plantId !== undefined) {
    headers["X-Plant-Id"] = String(plantId);
  }

  const params: Record<string, any> = { page: 1 };
  if (plantId !== null && plantId !== undefined) {
    params.plant_id = String(plantId);
  }

  return axios.get(`${baseURL}/quotations`, {
    params,
    headers,
    timeout: 25000,
  });
}

export default function QuotationScreen({
  onBack,
  onSuccess,
}: ListQuotationScreenProps) {
  const { token, plant_id, plant_name } = useSelector(
    (state: RootState) => state.auth,
  );

  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"All" | 0 | 1 | 2 | 3>("All");

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#0B2A4A");
      }
    }, []),
  );

  useEffect(() => {
    let isCancelled = false;

    fetchQuotationsApi(token, plant_id)
      .then((res) => {
        if (isCancelled) return;
        if (res.data?.success && res.data?.data) {
          const apiData = res.data.data;
          console.log("CHECK API:", apiData.data[0]);

          const items: QuotationItem[] = Array.isArray(apiData.data)
            ? apiData.data
            : Array.isArray(apiData)
              ? apiData
              : [];
          setQuotations(items);
        } else if (Array.isArray(res.data)) {
          setQuotations(res.data);
        } else {
          setQuotations([]);
        }
      })
      .catch((err: any) => {
        if (isCancelled) return;
        console.log("Error loading real-time quotations:", err?.message || err);
        const serverError =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Network Error";

        setErrorMessage(
          serverError === "Network Error"
            ? "Network Error: Could not connect to quotations server. Tap retry."
            : `Server note: ${serverError}`,
        );
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [token, plant_id]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setErrorMessage(null);

    try {
      const res = await fetchQuotationsApi(token, plant_id);
      if (res.data?.success && res.data?.data) {
        const apiData = res.data.data;
        const items: QuotationItem[] = Array.isArray(apiData.data)
          ? apiData.data
          : Array.isArray(apiData)
            ? apiData
            : [];
        setQuotations(items);
      } else if (Array.isArray(res.data)) {
        setQuotations(res.data);
      } else {
        setQuotations([]);
      }
    } catch (err: any) {
      console.log("Error refreshing quotations:", err?.message || err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/quotation");
    }
  };

  const filteredQuotations = useMemo(() => {
    return quotations.filter((item) => {
      if (activeTab !== "All" && Number(item.status) !== activeTab) {
        return false;
      }
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const refMatch = item.reference?.toLowerCase().includes(query);
        const patronMatch = (item.patron?.legal_name || item.client || "")
          .toLowerCase()
          .includes(query);
        const siteMatch = item.site?.name?.toLowerCase().includes(query);
        const designMatch =
          item.mix_design?.toLowerCase().includes(query) ||
          item.items?.some((it) =>
            (it.mix_design?.design_name || it.mix_design?.name || "")
              .toLowerCase()
              .includes(query),
          );
        const totalMatch = item.amount_total?.includes(query);
        return Boolean(
          refMatch || patronMatch || siteMatch || designMatch || totalMatch,
        );
      }
      return true;
    });
  }, [quotations, activeTab, search]);

  const tabCounts = useMemo(() => {
    return {
      all: quotations.length,
      draft: quotations.filter((q) => Number(q.status) === 0).length,
      sent: quotations.filter((q) => Number(q.status) === 1).length,
      approved: quotations.filter((q) => Number(q.status) === 2).length,
      rejected: quotations.filter((q) => Number(q.status) === 3).length,
    };
  }, [quotations]);

  const totalPipelineValue = useMemo(() => {
    return quotations.reduce((sum, item) => {
      const val = parseFloat(String(item.amount_total || 0));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [quotations]);

  const handleOpenEdit = (item: QuotationItem) => {
    router.push({
      pathname: "/quotation/editQuotationScreen",
      params: { quotation_id: String(item.id) },
    });
  };

  const renderQuotationCard = ({ item }: { item: QuotationItem }) => {
    const statusMeta = getStatusMeta(item.status);
    const customer =
      item.patron?.legal_name || item.client || "Customer Not Specified";
    const site = item.site?.name || "Main Project Site";

    let mix = "Standard Mix";
    let volume = "0";

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
        mix = mixNames[0]!;
      } else if (mixNames.length > 1) {
        mix = mixNames.join(", ");
      } else if (item.mix_design) {
        mix = item.mix_design;
      }

      const totalQty = item.items.reduce((sum, it) => {
        const q = parseFloat(String(it.quantity || "0"));
        return sum + (isNaN(q) ? 0 : q);
      }, 0);
      volume =
        totalQty > 0
          ? String(parseFloat(totalQty.toFixed(2)))
          : String(item.volume || item.quantity || "0");
    } else {
      mix = item.mix_design || "Standard Mix";
      const q = parseFloat(String(item.volume || item.quantity || "0"));
      volume = isNaN(q) ? "0" : String(parseFloat(q.toFixed(2)));
    }

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
                <Text style={styles.poBadgeText}> PO Linked</Text>
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
              {formatCurrency(item.amount_total)}
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
              Quote:{" "}
              <Text style={styles.dateVal}>{formatDate(item.quote_date)}</Text>
            </Text>
          </View>

          <View style={styles.dateItem}>
            <Ionicons name={"time-outline"} size={13} color={"#64748B"} />
            <Text style={styles.dateLabel}>
              Valid Till:{" "}
              <Text style={styles.dateVal}>
                {formatDate(item.validity_date)}
              </Text>
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
            <TouchableOpacity style={styles.actionViewBtn} activeOpacity={0.7}>
              <Ionicons name="eye-outline" size={13} color={"#0F172A"} />
              <Text style={styles.actionViewText}>View</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionEditBtn}
              onPress={() => handleOpenEdit(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={13} color={"#2563EB"} />
              <Text style={styles.actionEditText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

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
          <TouchableOpacity onPress={handleRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && !refreshing ? (
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
          keyExtractor={(item) => String(item.id || item.reference)}
          renderItem={renderQuotationCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
                name="clipboard-text-search-outline"
                size={54}
                color={"#CBD5E1"}
              />
              <Text style={styles.emptyTitle}>No Quotations Found</Text>
              <Text style={styles.emptySubtitle}>
                {search.trim()
                  ? `No quotations matching "${search}".`
                  : activeTab !== "All"
                    ? "No quotations found for this status."
                    : "No commerical quotations available yet."}
              </Text>
              {(search.length > 0 || activeTab !== "All") && (
                <TouchableOpacity
                  style={styles.emptyResetBtn}
                  onPress={() => {
                    setSearch("");
                    setActiveTab("All");
                  }}
                >
                  <Text style={styles.emptyResetBtnText}>Reset Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
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
});
