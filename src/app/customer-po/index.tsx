import { baseURL } from "@/components/baseUrl/baseUrlAPI";
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
        icon: "file-document-edit-outline",
      };
    case 1:
      return {
        label: found?.label || "Confirmed",
        color: "#2563EB",
        bgColor: "#EFF6FF",
        borderColor: "#BFDBFE",
        icon: "check-circle-outline",
      };
    case 2:
      return {
        label: found?.label || "Completed",
        color: "#059669",
        bgColor: "#ECFDF5",
        borderColor: "#A7F3D0",
        icon: "checkbox-marked-circle-outline",
      };
    default:
      return {
        label: found?.label || "Unknown",
        color: "#64748B",
        bgColor: "#F1F5F9",
        borderColor: "#E2E8F0",
        icon: "help-circle-outline",
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

  // Status Confirmation State
  const [selectedPoForStatus, setSelectedPoForStatus] =
    useState<CustomerPOItem | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] =
    useState<boolean>(false);
  const [targetStatus, setTargetStatus] = useState<number>(1);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [updatingPoId, setUpdatingPoId] = useState<number | null>(null);

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

  const handleOpenGenerateSO = (po: CustomerPOItem) => {
    console.log("[CustomerPO] Opening Generate SO for PO:", {
      id: po.id,
      reference: po.reference,
      itemsCount: po.items?.length || 0,
      salesOrdersCount: (po as any).sales_orders?.length || 0,
    });

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

        // Calculate converted quantity from sales_orders array
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

        if (matchingSOs.length > 0) {
          conv = matchingSOs.reduce((sum: number, so: any) => {
            const q =
              parseFloat(
                String(so.total_qty ?? so.quantity ?? so.total_quantity ?? 0),
              ) || 0;
            return sum + q;
          }, 0);
        } else if (
          it.converted_quantity !== undefined &&
          it.converted_quantity !== null
        ) {
          conv = parseFloat(String(it.converted_quantity)) || 0;
        } else if (
          it.converted_qty !== undefined &&
          it.converted_qty !== null
        ) {
          conv = parseFloat(String(it.converted_qty)) || 0;
        } else if (it.sales_order && typeof it.sales_order === "object") {
          conv =
            parseFloat(
              String(
                it.sales_order.total_quantity ??
                  it.sales_order.quantity ??
                  it.sales_order.total_qty ??
                  0,
              ),
            ) || 0;
        } else if (Array.isArray(it.sales_orders)) {
          conv = it.sales_orders.reduce((sum: number, so: any) => {
            return (
              sum +
              (parseFloat(
                String(so.total_quantity ?? so.quantity ?? so.total_qty ?? 0),
              ) || 0)
            );
          }, 0);
        }

        let initPumpId: number | null = null;
        if (it.concrete_pump !== null && it.concrete_pump !== undefined) {
          const asNum = Number(it.concrete_pump);
          if (!isNaN(asNum) && Array.isArray(pumps) && pumps.some((p) => Number(p.id ?? p.value) === asNum)) {
            initPumpId = asNum;
          } else if (Array.isArray(pumps)) {
            const foundPump = pumps.find(
              (p) =>
                String(p.label).toLowerCase() === String(it.concrete_pump).toLowerCase() ||
                String(p.registration).toLowerCase() === String(it.concrete_pump).toLowerCase(),
            );
            if (foundPump) {
              initPumpId = Number(foundPump.id ?? foundPump.value);
            }
          }
        }

        const rem = Math.max(0, poQty - conv);
        return {
          item_id: Number(it.id || (it as any).item_id || idx),
          mix_design_id: mixId || null,
          mix_design_name: mixName,
          po_qty: poQty,
          converted_qty: conv,
          remaining_qty: rem,
          so_qty: rem > 0 ? String(rem) : "0",
          concrete_pump: initPumpId,
        };
      },
    );

    setGenModalItems(mappedItems);
    setGenerateModalVisible(true);
  };

  const handleSOQtyChange = (index: number, val: string) => {
    const clean = val.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    const formatted =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : clean;
    const num = parseFloat(formatted);
    const maxAllowed = genModalItems[index]?.remaining_qty ?? 0;

    if (!isNaN(num) && num > maxAllowed) {
      Alert.alert(
        "Quantity Exceeded",
        `Sales Order quantity cannot exceed remaining quantity of ${maxAllowed} m³.`,
      );
      setGenModalItems((prev) =>
        prev.map((it, idx) =>
          idx === index ? { ...it, so_qty: String(maxAllowed) } : it,
        ),
      );
      return;
    }

    setGenModalItems((prev) =>
      prev.map((it, idx) =>
        idx === index ? { ...it, so_qty: formatted } : it,
      ),
    );
  };

  const handleSubmitGenerateSO = async () => {
    if (!genModalItems || genModalItems.length === 0) {
      Alert.alert(
        "No Items",
        "There are no mix designs available for this PO.",
      );
      return;
    }

    const itemsToSubmit: {
      item_id: number;
      quantity: number;
      concrete_pump?: string;
    }[] = [];
    for (let i = 0; i < genModalItems.length; i++) {
      const it = genModalItems[i];
      const q = parseFloat(it.so_qty);
      if (isNaN(q) || q < 0) {
        Alert.alert(
          "Invalid Quantity",
          `Please enter a valid positive quantity for "${it.mix_design_name}".`,
        );
        return;
      }
      if (q > it.remaining_qty) {
        Alert.alert(
          "Quantity Exceeded",
          `Quantity for "${it.mix_design_name}" (${q} m³) cannot exceed remaining quantity (${it.remaining_qty} m³).`,
        );
        return;
      }
      if (q > 0) {
        const payloadItem: any = {
          item_id: it.item_id,
          quantity: q,
        };
        if (it.concrete_pump !== null && it.concrete_pump !== undefined) {
          payloadItem.concrete_pump = it.concrete_pump;
        }
        itemsToSubmit.push(payloadItem);
      }
    }

    if (itemsToSubmit.length === 0) {
      Alert.alert(
        "Quantity Required",
        "Please enter a sales order quantity greater than 0 for at least one mix design.",
      );
      return;
    }

    const cleanToken = token?.startsWith("Bearer ") ? token.slice(7) : token;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: cleanToken ? `Bearer ${cleanToken}` : "",
    };
    const effectivePlantId =
      plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;
    if (effectivePlantId !== null && effectivePlantId !== undefined) {
      headers["X-Plant-Id"] = String(effectivePlantId);
    }

    const customerPoId = genModalPoData?.id || selectedPoForGen?.id;
    const endpoint = `${baseURL}/customer-pos/${customerPoId}/convert-salesorder`;
    const body = {
      items: itemsToSubmit,
    };
    const params: Record<string, any> = {
      customer_po: customerPoId,
    };
    if (effectivePlantId !== null && effectivePlantId !== undefined) {
      params.plant_id = String(effectivePlantId);
    }

    setIsGeneratingSO(true);
    try {
      console.log(`[CustomerPO] POST ${endpoint}`, { params, body, headers });
      const res = await axios.post(endpoint, body, {
        headers,
        params,
        timeout: 30000,
      });
      console.log("[CustomerPO] Convert to Sales Order response:", res.data);
      Alert.alert(
        "Sales Order Generated",
        res.data?.message ||
          "Sales order has been successfully generated from this purchase order.",
        [
          {
            text: "OK",
            onPress: () => {
              setGenerateModalVisible(false);
              fetchCustomerPOs(true);
            },
          },
        ],
      );
    } catch (err: any) {
      console.error(
        "[CustomerPO] Convert to Sales Order error:",
        err?.response?.data || err?.message,
      );
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to generate sales order from customer purchase order.";
      Alert.alert("Generation Failed", msg);
    } finally {
      setIsGeneratingSO(false);
    }
  };

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
        console.log("================== [CustomerPO] GET LIST REQUEST ==================");
        console.log(`[CustomerPO] Fetching from ${baseURL}/customer-pos`);
        console.log(`[CustomerPO] Effective Plant ID:`, targetPlantId);
        console.log(`[CustomerPO] Query Params:`, JSON.stringify(params, null, 2));
        console.log(`[CustomerPO] Headers (X-Plant-Id):`, headers["X-Plant-Id"] || "None (All Plants)");
        console.log("===================================================================");

        const res = await axios.get(`${baseURL}/customer-pos`, {
          headers,
          params,
          timeout: 45000,
        });

        console.log("================== [CustomerPO] GET LIST RESPONSE =================");
        console.log(`[CustomerPO] Status Code:`, res.status);
        console.log(`[CustomerPO] Success:`, res.data?.success);

        if (res.data?.success && res.data?.data) {
          const apiData = res.data.data;
          const items: CustomerPOItem[] = Array.isArray(apiData.data)
            ? apiData.data
            : Array.isArray(apiData)
              ? apiData
              : [];
          console.log("[CustomerPO] Successfully loaded items count:", items.length);
          if (items.length > 0) {
            console.log(
              `[CustomerPO] Sample PO [0]: ID=${items[0].id}, Ref=${items[0].reference}, Items=${items[0].items?.length || 0}, SalesOrders=${(items[0] as any).sales_orders?.length || 0}`,
            );
          }
          setPoList(items);
        } else if (Array.isArray(res.data)) {
          console.log("[CustomerPO] Successfully loaded raw array count:", res.data.length);
          setPoList(res.data);
        } else {
          console.log("[CustomerPO] No items returned in response");
          setPoList([]);
        }
        console.log("===================================================================");
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
          console.log("CHECk RES", detailRes.data.data.length);

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
          tax_id: it.tax_id
            ? Number(it.tax_id)
            : it.tax?.id
              ? Number(it.tax.id)
              : null,
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

        console.log(
          `[CustomerPO] PUT status response:`,
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
      mixDesignNames.length > 0 ? mixDesignNames[0] : "Standard Mix";

    const firstPump = itemsList.find((i) => i.concrete_pump)?.concrete_pump;
    const firstPumpLabel = firstPump
      ? pumpOptionsList.find((p) => p.value === Number(firstPump))?.label ||
        formatPumpType(firstPump)
      : null;

    return (
      <View style={styles.cardContainer}>
        {/* Card Header: Reference Badges + Status */}
        <View style={styles.cardHeader}>
          <View style={styles.referenceGroup}>
            <View style={styles.refRow}>
              <View style={styles.refIconWrap}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={16}
                  color="#2563EB"
                />
              </View>
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
              {
                backgroundColor: statusMeta.bgColor,
                borderColor: statusMeta.borderColor || statusMeta.color + "30",
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

        {/* Customer & Site Details */}
        <View style={styles.cardBody}>
          <View style={styles.customerRow}>
            <Ionicons name="business-outline" size={15} color="#475569" />
            <Text style={styles.customerNameText} numberOfLines={1}>
              {item.patron?.legal_name || "Unknown Customer"}
            </Text>
          </View>

          <View style={styles.siteRow}>
            <Ionicons name="location-outline" size={15} color="#DC2626" />
            <Text style={styles.siteNameText} numberOfLines={1}>
              {item.site?.name || "Unassigned Site"}
            </Text>
          </View>
        </View>

        {/* Modern 3-Column Spec Box: Mix Design, Total Volume, Total Value */}
        <View style={styles.specBox}>
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
              {primaryMix}
            </Text>
          </View>

          <View style={styles.specDivider} />

          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <MaterialCommunityIcons
                name="cube-outline"
                size={13}
                color="#2563EB"
              />
              <Text style={styles.specLabel}>TOTAL QTY</Text>
            </View>
            <Text
              style={[
                styles.specValue,
                { color: "#2563EB", fontWeight: "800" },
              ]}
            >
              {totalVolume} m³
            </Text>
          </View>

          <View style={styles.specDivider} />

          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <Ionicons name="cash-outline" size={13} color="#059669" />
              <Text style={styles.specLabel}>TOTAL VALUE</Text>
            </View>
            <Text
              style={[
                styles.specValue,
                { color: "#059669", fontWeight: "800" },
              ]}
              numberOfLines={1}
            >
              {formatCurrency(item.amount_total)}
            </Text>
          </View>
        </View>

        {/* Multi Mix Designs Chips: When PO has 2 or more mix designs, display each name & qty */}
        {itemsList.length > 1 && (
          <View style={styles.multiMixRow}>
            {itemsList.map((it, idx) => {
              const mName =
                it.mix_design?.design_name ||
                it.mix_design?.name ||
                (it as any).mix_design_name ||
                `Mix #${it.mix_design_id || idx + 1}`;
              const mQty = parseFloat(String(it.quantity || "0")) || 0;
              return (
                <View key={String(it.id || idx)} style={styles.multiMixChip}>
                  <MaterialCommunityIcons
                    name="cube-outline"
                    size={11}
                    color="#2563EB"
                  />
                  <Text style={styles.multiMixChipText} numberOfLines={1}>
                    {mName}: {mQty} m³
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Meta details row: Date, Pump, Tax Badge */}
        <View style={styles.metaChipsRow}>
          <View style={styles.dateMetaChip}>
            <Ionicons name="calendar-outline" size={13} color="#64748B" />
            <Text style={styles.dateMetaText}>
              {formatDate(item.order_date)}
            </Text>
          </View>

          {firstPumpLabel ? (
            <View style={styles.pumpMetaChip}>
              <MaterialCommunityIcons
                name="pipe-leak"
                size={13}
                color="#2563EB"
              />
              <Text style={styles.pumpMetaText}>{firstPumpLabel}</Text>
            </View>
          ) : null}

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

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            {item.notes ? (
              <Text style={styles.notesText} numberOfLines={1}>
                Note: {item.notes}
              </Text>
            ) : null}
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

            {/* Generate Sales Order button: Show when In Progress / Confirmed (not Completed) */}
            {(Number(item.status) === 1 ||
              (statusMeta.label || "").toLowerCase().includes("progress") ||
              (statusMeta.label || "").toLowerCase().includes("confirmed")) &&
              Number(item.status) !== 2 &&
              !(statusMeta.label || "").toLowerCase().includes("completed") && (
                <TouchableOpacity
                  style={styles.generateSOBtn}
                  onPress={() => handleOpenGenerateSO(item)}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons
                    name="file-document-plus-outline"
                    size={15}
                    color="#FFFFFF"
                  />
                  <Text style={styles.generateSOBtnText}>Generate SO</Text>
                </TouchableOpacity>
              )}

            {/* Action Button: Edit (Hidden when status is completed) */}
            {Number(item.status) !== 2 &&
              !(statusMeta.label || "").toLowerCase().includes("completed") && (
                <TouchableOpacity
                  style={styles.editBtn}
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
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={15} color="#2563EB" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
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
        backgroundColor="#0B2A4A"
        translucent={false}
      />

      {/* UNIFIED NAVY HEADER (MATCHES QUOTATION, SALES ORDER & BATCH SCHEDULE) */}
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
              <Text style={styles.headerTitle}>Customer PO</Text>
            </View>
            <View style={styles.plantBadgeRow}>
              <Ionicons name="document-text-outline" size={12} color="#94A3B8" />
              <Text style={styles.plantBadgeText}>Procurement Pipeline</Text>
            </View>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => fetchCustomerPOs(true)}
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
                router.push("/customer-po/createCustomerPO" as any)
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
            <Text style={styles.kpiLabel}>TOTAL POS</Text>
            <Text style={styles.kpiValue}>{stats.totalCount}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL QTY</Text>
            <Text style={[styles.kpiValue, { color: "#60A5FA" }]}>
              {formatVolume(stats.totalVolume)} m³
            </Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL VALUE</Text>
            <Text
              style={[styles.kpiValue, { color: "#34D399" }]}
              numberOfLines={1}
            >
              {formatCurrency(stats.totalValue)}
            </Text>
          </View>
        </View>

        {/* Integrated Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" />
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
      </View>

      {/* FILTER TABS */}
      <View style={styles.tabsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.value;
            return (
              <TouchableOpacity
                key={String(tab.label)}
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

      <View style={styles.mainContainer}>

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

        {/* ========================================================= */}
        {/* GENERATE SALES ORDERS MODAL (Matches user screenshot)   */}
        {/* ========================================================= */}
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
              {/* Modal Header */}
              <View style={styles.genModalHeader}>
                <Text style={styles.genModalTitle}>Generate Sales Orders</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!isGeneratingSO) setGenerateModalVisible(false);
                  }}
                  disabled={isGeneratingSO}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                  {/* Top Info Card */}
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

                  {/* Section Heading */}
                  <View style={styles.genSectionHeader}>
                    <View style={styles.genSectionDot} />
                    <Text style={styles.genSectionTitle}>
                      ORDERED MIX DESIGNS
                    </Text>
                  </View>

                  {/* All items completed notice if every line is fulfilled */}
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

                  {/* Table with Horizontal Scroll */}
                  <View style={styles.genTableWrapper}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={true}
                    >
                      <View>
                        {/* Table Header Row */}
                        <View style={styles.genTableHeaderRow}>
                          <Text
                            style={[styles.genTableHeaderText, { width: 140 }]}
                          >
                            Mix Design
                          </Text>
                          <Text
                            style={[styles.genTableHeaderText, { width: 85 }]}
                          >
                            PO Qty
                          </Text>
                          <Text
                            style={[styles.genTableHeaderText, { width: 85 }]}
                          >
                            Converted
                          </Text>
                          <Text
                            style={[styles.genTableHeaderText, { width: 95 }]}
                          >
                            Remaining
                          </Text>
                          <Text
                            style={[styles.genTableHeaderText, { width: 105 }]}
                          >
                            SO Qty (m³)
                          </Text>
                          <Text
                            style={[styles.genTableHeaderText, { width: 165 }]}
                          >
                            Concrete Pump / Type
                          </Text>
                        </View>

                        {/* Table Rows */}
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
                  {/* Modal Action Buttons (aligned right) */}
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
                        (isGeneratingSO ||
                          (genModalItems.length > 0 &&
                            genModalItems.every(
                              (it) => it.remaining_qty <= 0,
                            ))) &&
                          styles.genSubmitBtnDisabled,
                      ]}
                      onPress={handleSubmitGenerateSO}
                      disabled={
                        isGeneratingSO ||
                        (genModalItems.length > 0 &&
                          genModalItems.every((it) => it.remaining_qty <= 0))
                      }
                      activeOpacity={0.85}
                    >
                      {isGeneratingSO ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.genSubmitBtnText}>
                          {genModalItems.length > 0 &&
                          genModalItems.every((it) => it.remaining_qty <= 0)
                            ? "All Mixes Fulfilled"
                            : "Generate Sales Orders"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}

              {/* PUMP SELECTION OVERLAY (In-modal overlay avoids Android nested Modal crashes) */}
              {pumpPickerVisible && (
                <View style={styles.pumpPickerOverlay}>
                  <TouchableOpacity
                    style={StyleSheet.absoluteFillObject}
                    activeOpacity={1}
                    onPress={() => setPumpPickerVisible(false)}
                  />
                  <View
                    style={styles.pumpPickerCard}
                    onStartShouldSetResponder={() => true}
                  >
                    <View style={styles.pumpPickerHeader}>
                      <Text style={styles.pumpPickerTitle}>
                        Select Concrete Pump
                      </Text>
                      <TouchableOpacity
                        onPress={() => setPumpPickerVisible(false)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close" size={20} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                    <ScrollView
                      style={{ maxHeight: 280 }}
                      keyboardShouldPersistTaps="handled"
                    >
                      {pumpOptionsList.map((opt, oIdx) => {
                        const isSelected =
                          activePumpRowIndex !== null &&
                          genModalItems[activePumpRowIndex]?.concrete_pump ===
                            opt.value;
                        return (
                          <TouchableOpacity
                            key={`pump-${opt.value ?? oIdx}`}
                            style={[
                              styles.pumpPickerItem,
                              isSelected && styles.pumpPickerItemSelected,
                            ]}
                            onPress={() => {
                              if (activePumpRowIndex !== null) {
                                setGenModalItems((prev) =>
                                  prev.map((it, i) =>
                                    i === activePumpRowIndex
                                      ? { ...it, concrete_pump: opt.value }
                                      : it,
                                  ),
                                );
                              }
                              setPumpPickerVisible(false);
                              setActivePumpRowIndex(null);
                            }}
                          >
                            <Text
                              style={[
                                styles.pumpPickerItemText,
                                isSelected && styles.pumpPickerItemTextSelected,
                              ]}
                            >
                              {opt.label}
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
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  quoteLinkedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#CCFBF1",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 6,
  },
  quoteLinkedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F766E",
  },

  safeArea: {
    flex: 1,
    backgroundColor: "#0B2A4A",
  },
  mainContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // Dark Navy Header (Matches Quotation, Sales Order & Batch Schedule)
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    alignItems: "flex-start",
  },
  referenceGroup: {
    flex: 1,
    marginRight: 8,
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  referenceText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  poRefBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 4,
  },
  poRefBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
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
  cardBody: {
    marginTop: 10,
    gap: 4,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  customerNameText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  siteNameText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#475569",
  },
  specBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  specCol: {
    flex: 1,
    alignItems: "flex-start",
  },
  specHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },
  specLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  specValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  specDivider: {
    width: 1,
    height: 26,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 8,
  },
  multiMixRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  multiMixChip: {
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
  multiMixChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1D4ED8",
  },
  metaChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  dateMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateMetaText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  pumpMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  pumpMetaText: {
    fontSize: 11,
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
  footerLeft: {
    flex: 1,
    justifyContent: "center",
  },
  notesText: {
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
    maxWidth: 160,
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
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
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

  // Generate SO Button in Card (Brand Blue Theme)
  generateSOBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  generateSOBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Generate Sales Order Modal
  genModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  genModalContainer: {
    width: "100%",
    maxWidth: 740,
    maxHeight: "92%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  genModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    justifyContent: "center",
    gap: 12,
  },
  genModalLoaderText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  genModalBody: {
    marginTop: 12,
  },
  genInfoCard: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  genInfoCol: {
    flex: 1,
    minWidth: 140,
  },
  genInfoLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 4,
  },
  genInfoVal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  genSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  genSectionDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#2563EB",
  },
  genSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1E40AF",
    letterSpacing: 0.5,
  },
  allCompletedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 14,
  },
  allCompletedBannerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065F46",
    flex: 1,
    lineHeight: 18,
  },
  genTableWrapper: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    marginBottom: 16,
  },
  genTableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  genTableHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  genTableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  genTableRowDisabled: {
    backgroundColor: "#F8FAFC",
    opacity: 0.6,
  },
  genMixNameText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  genCellText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  genRemainingText: {
    fontWeight: "800",
    color: "#2563EB",
  },
  completedBadgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  completedCellText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  genSoQtyInput: {
    height: 38,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  genSoQtyInputDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
    color: "#94A3B8",
  },
  genPumpSelectBtn: {
    height: 38,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  genPumpSelectBtnDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  genPumpSelectText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F172A",
    flex: 1,
  },
  genPumpDisabledText: {
    color: "#94A3B8",
    fontSize: 12,
    fontStyle: "italic",
    fontWeight: "500",
  },
  genPumpPlaceholder: {
    color: "#94A3B8",
    fontWeight: "400",
  },
  genModalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  genCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  genCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  genSubmitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2563EB",
    minWidth: 170,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  genSubmitBtnDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },
  genSubmitBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  // Pump Sub-picker Overlay
  pumpPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    zIndex: 999,
    elevation: 20,
    borderRadius: 16,
  },
  pumpPickerCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  pumpPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  pumpPickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
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
  pumpPickerItemTextSelected: {
    color: "#2563EB",
    fontWeight: "700",
  },
});
