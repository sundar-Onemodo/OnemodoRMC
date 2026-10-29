import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import {
  setDropdowns,
  setDropdownsError,
  setDropdownsLoading,
  setOrders,
} from "@/store/dropdownSlice";
import {
  MixDesignDropdownItem,
  setMixDesigns,
  setSites,
  SiteDropdownItem,
} from "@/store/quotationSlice";
import { RootState } from "@/store/store";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

// ==========================================
// INTERFACES & HELPERS
// ==========================================

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
  tax_id?: number;
  is_tax_inclusive?: boolean;
  total_qty?: string | number;
  produced_qty?: string | number;
  uom_id?: number | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  status?: number;
  created_at?: string;
  updated_at?: string;
  pump_rate?: number;
  full_number?: string;
  customer?: {
    id: number;
    legal_name: string;
  } | null;
  site?: {
    id: number;
    name: string;
    site_address_1?: string | null;
  } | null;
  mix_design?: {
    id: number;
    design_name?: string;
    name?: string;
    code?: string | null;
  } | null;
}

export function formatOrderRow(
  order: SalesOrderItem | null | undefined,
  customersList?: any[],
): string {
  if (!order) return "";
  const fullNo =
    order.full_number ||
    (order.prefix && order.order_no
      ? `${order.prefix}${order.order_no}`
      : "") ||
    (order.order_no && order.order_no !== String(order.id)
      ? order.order_no
      : "") ||
    `SO #${order.id}`;

  let custName =
    order.customer?.legal_name ||
    (order as any).customer?.name ||
    (order as any).customer?.trade_name ||
    (order as any).patron?.legal_name ||
    (order as any).patron?.name ||
    (order as any).customer_name ||
    "";

  if ((!custName || custName.toLowerCase() === "customer") && customersList) {
    const custId =
      order.customer_id ||
      (order as any).patron_id ||
      order.customer?.id;
    if (custId) {
      const match = customersList.find(
        (c: any) => Number(c.id) === Number(custId),
      );
      if (match) {
        custName = match.legal_name || match.name || match.trade_name || "";
      }
    }
  }

  const siteName =
    order.site?.name ||
    (order as any).site_name ||
    (order as any).site?.site_name ||
    "";

  let label = fullNo;
  if (custName && custName.toLowerCase() !== "customer") {
    label += ` - ${custName}`;
  }
  if (siteName && siteName.toLowerCase() !== "site") {
    label += ` , ${siteName}`;
  }
  return label;
}

export function resolvePumpTypeFromOrder(rawPump?: string | null): string {
  if (!rawPump) return "direct_pour";
  const p = rawPump.toLowerCase().trim();
  if (p === "manual" || p === "direct" || p === "direct_pour") {
    return "direct_pour";
  }
  if (p.includes("boom")) return "boom_pump";
  if (p.includes("line")) return "line_pump";
  if (p.includes("crane") || p.includes("bucket")) return "crane_bucket";
  if (p.includes("station") || p.includes("static")) return "stationary_pump";
  return p;
}

export function formatPumpLabel(type: string): string {
  if (!type) return "Direct Pour";
  switch (type.toLowerCase()) {
    case "direct_pour":
    case "direct":
    case "manual":
      return "Direct Pour";
    case "boom_pump":
    case "boom":
      return "Boom Pump";
    case "line_pump":
    case "line":
      return "Line Pump";
    case "crane_bucket":
    case "crane":
    case "bucket":
      return "Crane Bucket";
    case "stationary_pump":
    case "static_pump":
    case "stationary":
    case "static":
      return "Stationary Pump";
    default:
      return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function getTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split("T")[0].split("-");
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
    return dateStr;
  } catch {
    return dateStr;
  }
}

function formatDateTimeDisplay(date: Date): string {
  const d = date.getDate();
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
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minStr = minutes < 10 ? `0${minutes}` : String(minutes);

  return `${d} ${monthName} ${year}, ${hours}:${minStr} ${ampm}`;
}

function formatToIsoWithoutZ(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = "00";
  return `${y}-${m}-${d}T${hours}:${minutes}:${seconds}`;
}

function parseIsoOrDate(
  str?: string | null,
  fallbackHours = 8,
  fallbackMinutes = 0,
): Date {
  if (!str) {
    const d = new Date();
    d.setHours(fallbackHours, fallbackMinutes, 0, 0);
    return d;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  const d = new Date();
  d.setHours(fallbackHours, fallbackMinutes, 0, 0);
  return d;
}

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

const STATUS_OPTIONS = [
  { label: "Scheduled", value: "scheduled", color: "#2563EB", bg: "#EFF6FF" },
  { label: "In Transit", value: "in_transit", color: "#7C3AED", bg: "#EDE9FE" },
  { label: "Completed", value: "completed", color: "#059669", bg: "#ECFDF5" },
  { label: "Cancelled", value: "cancelled", color: "#DC2626", bg: "#FEF2F2" },
];

// ==========================================
// COMPONENT
// ==========================================

export default function EditBatchScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const params = useLocalSearchParams<{
    id?: string;
    schedule?: string;
    sales_order_id?: string;
    data?: string;
  }>();

  const scheduleId = params.id || params.schedule;

  const { token, plant_id, plant_name } = useSelector(
    (state: RootState) => state.auth,
  );

  // Redux dropdowns
  const {
    pumpTypes,
    isLoaded: dropdownsLoaded,
    customers: reduxCustomers,
    orders: reduxOrders = [],
  } = useSelector((state: RootState) => state.dropdowns);
  const cachedSites = useSelector(
    (state: RootState) => state.quotation?.sites || [],
  );
  const cachedMixDesigns = useSelector(
    (state: RootState) => state.quotation?.mixDesigns || [],
  );

  // Parse initial data passed in params
  const initialData = useMemo(() => {
    if (params.data) {
      try {
        const raw =
          typeof params.data === "string" ? params.data : params.data[0];
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        console.log("[EditBatch] Parsed initialData:", parsed);
        return parsed;
      } catch (e) {
        console.warn("[EditBatch] Error parsing initial data param:", e);
      }
    }
    return null;
  }, [params.data]);

  // Track if schedule already had a pump_type saved on it (e.g. user changed it on create or previous edit)
  const scheduleSavedPumpType = useMemo(() => {
    return initialData?.pump_type ? String(initialData.pump_type).trim() : null;
  }, [initialData]);

  const scheduleSavedPumpTypeRef = useRef<string | null>(scheduleSavedPumpType);
  const userManuallyChangedPumpRef = useRef<boolean>(false);
  const userManuallySelectedOrderRef = useRef<boolean>(false);

  useEffect(() => {
    if (initialData?.pump_type) {
      scheduleSavedPumpTypeRef.current = String(initialData.pump_type).trim();
    }
  }, [initialData]);

  // Back Navigation strictly to /batching-schedule
  const handleBack = () => {
    router.replace("/batching-schedule" as any);
  };

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, []);

  // Master Data Lists
  const [ordersList, setOrdersList] = useState<SalesOrderItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);

  const [sitesList, setSitesList] = useState<SiteDropdownItem[]>(cachedSites);
  const [loadingSites, setLoadingSites] = useState<boolean>(
    cachedSites.length === 0,
  );

  const [mixList, setMixList] =
    useState<MixDesignDropdownItem[]>(cachedMixDesigns);
  const [loadingMix, setLoadingMix] = useState<boolean>(
    cachedMixDesigns.length === 0,
  );

  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // Target Sales Order ID from route params, initialData or details API
  const [salesOrderId, setSalesOrderId] = useState<number | null>(() => {
    const rawId =
      initialData?.sales_order_id ||
      initialData?.sales_order?.id ||
      (params.sales_order_id ? Number(params.sales_order_id) : null);
    return rawId ? Number(rawId) : null;
  });

  // Form Fields Initialized with Redux orders cache or initialData if available
  const [selectedOrder, setSelectedOrder] = useState<SalesOrderItem | null>(
    () => {
      const rawId =
        initialData?.sales_order_id ||
        initialData?.sales_order?.id ||
        (params.sales_order_id ? Number(params.sales_order_id) : null);
      const orderId = rawId ? Number(rawId) : null;
      if (orderId) {
        const memoryMatch = (reduxOrders || []).find(
          (o: any) => Number(o.id) === Number(orderId),
        );
        if (memoryMatch) {
          console.log(
            "[EditBatch INIT] Found order in Redux cache:",
            memoryMatch,
          );
          return memoryMatch;
        }

        const so = initialData?.sales_order || {};
        return {
          id: orderId,
          full_number:
            so.full_number ||
            initialData?.sales_order_full_number ||
            initialData?.full_number ||
            undefined,
          order_no:
            so.order_no ||
            so.full_number ||
            initialData?.sales_order_full_number ||
            (so.prefix && so.order_no ? `${so.prefix}${so.order_no}` : undefined) ||
            String(orderId),
          prefix: so.prefix,
          customer:
            so.customer ||
            so.patron ||
            initialData?.customer ||
            initialData?.patron ||
            null,
          customer_id:
            so.customer_id ||
            so.patron_id ||
            initialData?.customer_id,
          site: so.site || initialData?.site || null,
          site_id: so.site_id || initialData?.site_id,
          mix_design: so.mix_design || initialData?.mix_design || null,
          mix_design_id: so.mix_design_id || initialData?.mix_design_id,
          total_qty: so.total_qty || initialData?.order_volume_m3,
          pump_type: so.pump_type || initialData?.pump_type,
        };
      }
      return null;
    },
  );

  // Rendered string for selected order
  const renderedOrderDisplay = useMemo(() => {
    return formatOrderRow(selectedOrder, reduxCustomers);
  }, [selectedOrder, reduxCustomers]);

  // Route Params and Mount Diagnostic Log
  useEffect(() => {
    console.log("==========================================");
    console.log("[EditBatch MOUNT] Route Params:", {
      id: params.id,
      schedule: params.schedule,
      sales_order_id: params.sales_order_id,
    });
    console.log("[EditBatch MOUNT] initialData:", initialData);
    console.log("  -> Schedule ID (initialData.id):", initialData?.id);
    console.log("  -> sales_order_id:", initialData?.sales_order_id);
    console.log("  -> site:", initialData?.site?.name || initialData?.site_id);
    console.log(
      "  -> Redux orders cache count:",
      (reduxOrders || []).length,
    );
    console.log("==========================================");
  }, []);

  // Comprehensive field log for sales order displaying state
  useEffect(() => {
    console.log("==========================================");
    console.log("[EditBatch SALES ORDER FIELD LOG]");
    console.log("  -> salesOrderId:", salesOrderId);
    console.log("  -> selectedOrder?.id:", selectedOrder?.id);
    console.log("  -> full_number:", selectedOrder?.full_number);
    console.log(
      "  -> customer name:",
      selectedOrder?.customer?.legal_name ||
        (selectedOrder as any)?.customer_name ||
        (selectedOrder as any)?.customer?.name,
    );
    console.log("  -> site name:", selectedOrder?.site?.name);
    console.log(
      "  -> RENDERED VALUE SHOWING ON SCREEN:",
      renderedOrderDisplay || "(Empty/Loading)",
    );
    console.log("==========================================");
  }, [salesOrderId, selectedOrder, renderedOrderDisplay]);

  // Helper: fetch single sales order if not found in ordersList
  const fetchSingleOrder = async (orderId: number) => {
    try {
      console.log(`[EditBatch] Fetching single order #${orderId}...`);
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
      if (plant_id) {
        headers["X-Plant-Id"] = String(plant_id);
      }

      let orderData: any = null;

      // Attempt 1: Direct endpoint GET /orders/${orderId}
      try {
        const orderRes = await axios.get(`${baseURL}/orders/${orderId}`, {
          headers,
          timeout: 15000,
        });
        orderData = orderRes.data?.data || orderRes.data;
      } catch (e1: any) {
        console.log(`[EditBatch] GET /orders/${orderId} returned:`, e1?.message);
      }

      // Attempt 2: If attempt 1 didn't return an order with id, try GET /orders with search
      if (!orderData || !orderData.id) {
        try {
          const searchRes = await axios.get(`${baseURL}/orders`, {
            headers,
            params: { page: 1, search: String(orderId), status: [0, 1, 2] },
            timeout: 15000,
          });
          const searchList =
            searchRes.data?.data?.data ||
            searchRes.data?.data?.orders ||
            searchRes.data?.data ||
            searchRes.data?.orders ||
            [];
          if (Array.isArray(searchList)) {
            orderData = searchList.find((o: any) => Number(o.id) === Number(orderId));
          }
        } catch (e2: any) {
          console.log(`[EditBatch] GET /orders search fallback returned:`, e2?.message);
        }
      }

      if (orderData && orderData.id) {
        console.log(`[EditBatch] Successfully resolved order #${orderId}:`, {
          id: orderData.id,
          full_number: orderData.full_number,
          customer: orderData.customer,
          site: orderData.site,
          mix_design: orderData.mix_design,
          total_qty: orderData.total_qty,
        });

        const cust =
          orderData.customer ||
          orderData.patron ||
          (orderData.customer_name
            ? { legal_name: orderData.customer_name }
            : null);
        const fullNo =
          orderData.full_number ||
          (orderData.prefix && orderData.order_no
            ? `${orderData.prefix}${orderData.order_no}`
            : "") ||
          orderData.order_no ||
          `SO #${orderId}`;

        const fullOrder: SalesOrderItem = {
          ...orderData,
          id: Number(orderId),
          full_number: fullNo,
          order_no: orderData.order_no || fullNo,
          customer: cust,
          site: orderData.site || null,
          mix_design: orderData.mix_design || null,
          total_qty: orderData.total_qty,
        };

        setSelectedOrder(fullOrder);
        if (fullOrder.site) {
          setSelectedSite({
            id: fullOrder.site.id,
            name: fullOrder.site.name,
            site_address_1: fullOrder.site.site_address_1,
          });
        }
        if (fullOrder.mix_design) {
          setSelectedMixDesign({
            id: fullOrder.mix_design.id,
            design_name:
              fullOrder.mix_design.design_name ||
              fullOrder.mix_design.name ||
              `Mix #${fullOrder.mix_design.id}`,
          });
        }
        if (fullOrder.total_qty) {
          setOrderVolumeM3(String(parseFloat(String(fullOrder.total_qty)) || 50));
        }
        // Only fallback to order's pump_type / concrete_pump IF schedule had NO pump_type saved
        // and user has not manually changed the pump or picked a different order in this session
        if (
          !scheduleSavedPumpTypeRef.current &&
          !userManuallyChangedPumpRef.current &&
          !userManuallySelectedOrderRef.current
        ) {
          if (fullOrder.pump_type || fullOrder.concrete_pump) {
            setSelectedPumpType(
              resolvePumpTypeFromOrder(
                fullOrder.pump_type || fullOrder.concrete_pump,
              ),
            );
          }
        }

        setOrdersList((prevList) => {
          if (prevList.some((o) => Number(o.id) === Number(orderId))) return prevList;
          return [fullOrder, ...prevList];
        });
        dispatch(
          setOrders([
            ...(reduxOrders || []).filter(
              (o: any) => Number(o.id) !== Number(orderId),
            ),
            fullOrder,
          ]),
        );
      }
    } catch (e: any) {
      console.warn(`[EditBatch] Could not fetch single order #${orderId}:`, e?.response?.data || e?.message);
    }
  };

  // Immediate trigger if salesOrderId is set but order details are incomplete
  useEffect(() => {
    if (
      salesOrderId &&
      (!selectedOrder || !selectedOrder.full_number || !selectedOrder.customer)
    ) {
      console.log(
        `[EditBatch] salesOrderId=${salesOrderId} present with incomplete details. Triggering immediate fetch...`,
      );
      fetchSingleOrder(salesOrderId);
    }
  }, [salesOrderId]);

  // Synchronize selectedOrder from reduxOrders or ordersList whenever salesOrderId, reduxOrders or ordersList changes
  useEffect(() => {
    if (!salesOrderId) {
      console.log("[EditBatch Sync] No salesOrderId set yet");
      return;
    }

    const allKnown = [...(ordersList || []), ...(reduxOrders || [])];
    console.log(
      `[EditBatch Sync] Searching for order #${salesOrderId} in ${allKnown.length} known orders (ordersList: ${ordersList.length}, redux: ${(reduxOrders || []).length})...`,
    );
    const matched = allKnown.find((o) => Number(o.id) === Number(salesOrderId));

    if (matched) {
      console.log("[EditBatch Sync] MATCH FOUND for salesOrderId=" + salesOrderId, {
        id: matched.id,
        full_number: matched.full_number,
        customer: matched.customer,
        site: matched.site,
        mix_design: matched.mix_design,
        total_qty: matched.total_qty,
      });

      setSelectedOrder(matched);

      if (matched.site) {
        setSelectedSite({
          id: matched.site.id,
          name: matched.site.name,
          site_address_1: matched.site.site_address_1,
        });
      }
      if (matched.mix_design) {
        setSelectedMixDesign({
          id: matched.mix_design.id,
          design_name:
            matched.mix_design.design_name ||
            matched.mix_design.name ||
            `Mix #${matched.mix_design.id}`,
        });
      }
      if (matched.total_qty) {
        setOrderVolumeM3(String(parseFloat(String(matched.total_qty)) || 50));
      }
      // Only fallback to order's pump_type / concrete_pump IF schedule had NO pump_type saved
      // and user has not manually changed the pump or picked a different order in this session
      if (
        !scheduleSavedPumpTypeRef.current &&
        !userManuallyChangedPumpRef.current &&
        !userManuallySelectedOrderRef.current
      ) {
        if (matched.pump_type || matched.concrete_pump) {
          setSelectedPumpType(
            resolvePumpTypeFromOrder(
              matched.pump_type || matched.concrete_pump,
            ),
          );
        }
      }
    } else {
      console.log(
        `[EditBatch Sync] Order id=${salesOrderId} NOT in known orders. Triggering fetchSingleOrder...`,
      );
      fetchSingleOrder(salesOrderId);
    }
  }, [salesOrderId, reduxOrders, ordersList]);

  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    return initialData?.schedule_date
      ? initialData.schedule_date.split("T")[0]
      : getTodayDateString();
  });
  const [scheduleDatePickerVisible, setScheduleDatePickerVisible] =
    useState<boolean>(false);
  const [schedMonth, setSchedMonth] = useState<number>(new Date().getMonth());
  const [schedYear, setSchedYear] = useState<number>(new Date().getFullYear());

  const [selectedSite, setSelectedSite] = useState<SiteDropdownItem | null>(
    () => {
      if (initialData?.site) {
        return { id: initialData.site.id, name: initialData.site.name };
      }
      if (initialData?.site_id) {
        return {
          id: initialData.site_id,
          name: `Site #${initialData.site_id}`,
        };
      }
      return null;
    },
  );

  const [selectedMixDesign, setSelectedMixDesign] =
    useState<MixDesignDropdownItem | null>(() => {
      if (initialData?.mix_design) {
        return {
          id: initialData.mix_design.id,
          design_name:
            initialData.mix_design.design_name ||
            initialData.mix_design.name ||
            `Mix #${initialData.mix_design.id}`,
        };
      }
      if (initialData?.mix_design_id) {
        return {
          id: initialData.mix_design_id,
          design_name: `Mix #${initialData.mix_design_id}`,
        };
      }
      return null;
    });

  const [orderVolumeM3, setOrderVolumeM3] = useState<string>(() => {
    return initialData?.order_volume_m3
      ? String(initialData.order_volume_m3)
      : "50";
  });

  const [qtyM3, setQtyM3] = useState<string>(() => {
    return initialData?.qty_m3 ? String(initialData.qty_m3) : "5";
  });

  const [selectedPumpType, setSelectedPumpType] = useState<string>(() => {
    return initialData?.pump_type
      ? resolvePumpTypeFromOrder(initialData.pump_type)
      : "direct_pour";
  });

  const [selectedStatus, setSelectedStatus] = useState<string>(() => {
    return initialData?.status
      ? normalizeStatusForApi(String(initialData.status))
      : "scheduled";
  });

  const [batchingDateTime, setBatchingDateTime] = useState<Date>(() => {
    return parseIsoOrDate(initialData?.batching_time, 8, 0);
  });

  const [dispatchDateTime, setDispatchDateTime] = useState<Date>(() => {
    return parseIsoOrDate(initialData?.dispatch_time, 8, 30);
  });

  const [notes, setNotes] = useState<string>(() => {
    return initialData?.notes || "Requested by sales executive";
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modals Visibility
  const [orderPickerVisible, setOrderPickerVisible] = useState<boolean>(false);
  const [orderSearch, setOrderSearch] = useState<string>("");

  const [pumpPickerVisible, setPumpPickerVisible] = useState<boolean>(false);

  // Date & Time Picker Modal for Batching / Dispatch
  const [activeDateTimeTarget, setActiveDateTimeTarget] = useState<
    "batching" | "dispatch" | null
  >(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [tempHour, setTempHour] = useState<number>(8);
  const [hourText, setHourText] = useState<string>("08");
  const [tempMinute, setTempMinute] = useState<number>(0);
  const [minuteText, setMinuteText] = useState<string>("00");
  const [tempAmPm, setTempAmPm] = useState<"AM" | "PM">("AM");
  const [dtCalMonth, setDtCalMonth] = useState<number>(new Date().getMonth());
  const [dtCalYear, setDtCalYear] = useState<number>(new Date().getFullYear());

  // ----------------------------------------------------
  // FETCH APIS: Schedule Details, Orders, Dropdowns, Sites, Mix Designs
  // ----------------------------------------------------
  useEffect(() => {
    let isMounted = true;
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
    if (plant_id) {
      headers["X-Plant-Id"] = String(plant_id);
    }

    // 1. Fetch Dropdowns if needed
    if (!dropdownsLoaded) {
      dispatch(setDropdownsLoading(true));
      axios
        .get(`${baseURL}/dropdowns`, { headers, timeout: 15000 })
        .then((res) => {
          if (!isMounted) return;
          if (res.data?.success && res.data?.data) {
            dispatch(setDropdowns(res.data.data));
          }
        })
        .catch((err) => {
          console.warn(
            "[EditBatch] Error fetching dropdowns:",
            err?.message || err,
          );
          dispatch(
            setDropdownsError(err?.message || "Failed to load dropdowns"),
          );
        });
    }

    // 2. Fetch Orders
    setLoadingOrders(true);
    const orderParams: Record<string, any> = { page: 1, status: [0, 1, 2] };
    if (plant_id) {
      orderParams.plant_id = String(plant_id);
    }
    axios
      .get(`${baseURL}/orders`, {
        headers,
        params: orderParams,
        timeout: 20000,
      })
      .then((res) => {
        if (!isMounted) return;
        const list: SalesOrderItem[] =
          res.data?.data?.data ||
          res.data?.data?.orders ||
          res.data?.data ||
          res.data?.orders?.data ||
          res.data?.orders ||
          (Array.isArray(res.data) ? res.data : []);
        console.log(`[EditBatch] GET /orders fetched ${list?.length || 0} orders`);
        if (Array.isArray(list)) {
          setOrdersList(list);
          if (list.length > 0) {
            dispatch(setOrders(list));
          }
        }
      })
      .catch((err) => {
        console.warn("[EditBatch] Error loading orders:", err?.message || err);
      })
      .finally(() => {
        if (isMounted) setLoadingOrders(false);
      });

    // 3. Fetch Sites
    setLoadingSites(true);
    axios
      .get(`${baseURL}/sites`, { headers, params: { page: 1 }, timeout: 20000 })
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.data?.data || res.data?.data || [];
        if (Array.isArray(list) && list.length > 0) {
          setSitesList(list);
          dispatch(setSites(list));
        }
      })
      .catch((err) => {
        console.warn("[EditBatch] Error loading sites:", err?.message || err);
      })
      .finally(() => {
        if (isMounted) setLoadingSites(false);
      });

    // 4. Fetch Mix Designs
    setLoadingMix(true);
    axios
      .get(`${baseURL}/mix-designs`, {
        headers,
        params: { page: 1 },
        timeout: 20000,
      })
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.data?.data || res.data?.data || [];
        if (Array.isArray(list) && list.length > 0) {
          setMixList(list);
          dispatch(setMixDesigns(list));
        }
      })
      .catch((err) => {
        console.warn(
          "[EditBatch] Error loading mix designs:",
          err?.message || err,
        );
      })
      .finally(() => {
        if (isMounted) setLoadingMix(false);
      });

    // 5. Fetch Single Batch Schedule Details if scheduleId available
    if (scheduleId) {
      setIsLoadingDetails(true);
      axios
        .get(`${baseURL}/batch-schedules/${scheduleId}`, {
          headers,
          params: { schedule: scheduleId },
          timeout: 20000,
        })
        .then((res) => {
          if (!isMounted) return;
          const data = res.data?.data || res.data;
          console.log(
            `[EditBatch] GET /batch-schedules/${scheduleId} response:`,
            data,
          );
          if (data && typeof data === "object") {
            if (data.schedule_date) {
              setScheduleDate(data.schedule_date.split("T")[0]);
            }
            const soId = Number(data.sales_order_id || data.sales_order?.id);
            if (soId) {
              console.log(
                "[EditBatch] Setting salesOrderId from schedule API:",
                soId,
              );
              setSalesOrderId(soId);

              // If nested sales_order object with full details is provided:
              if (data.sales_order && typeof data.sales_order === "object") {
                const so = data.sales_order;
                console.log("[EditBatch] Schedule API has nested sales_order:", so);
                setSelectedOrder((prev) => ({
                  ...(prev || {}),
                  ...so,
                  id: soId,
                  full_number: so.full_number || prev?.full_number,
                  customer:
                    so.customer || so.patron || prev?.customer || null,
                  site: so.site || prev?.site || null,
                  mix_design: so.mix_design || prev?.mix_design || null,
                }));
              }
            }
            if (data.site) {
              setSelectedSite({ id: data.site.id, name: data.site.name });
            } else if (data.site_id) {
              setSelectedSite((prev) => prev || {
                id: data.site_id,
                name: `Site #${data.site_id}`,
              });
            }
            if (data.mix_design) {
              setSelectedMixDesign({
                id: data.mix_design.id,
                design_name:
                  data.mix_design.design_name ||
                  data.mix_design.name ||
                  `Mix #${data.mix_design.id}`,
              });
            } else if (data.mix_design_id) {
              setSelectedMixDesign((prev) => prev || {
                id: data.mix_design_id,
                design_name: `Mix #${data.mix_design_id}`,
              });
            }
            if (data.qty_m3 !== undefined) setQtyM3(String(data.qty_m3));
            if (data.order_volume_m3 !== undefined)
              setOrderVolumeM3(String(data.order_volume_m3));
            if (data.pump_type) {
              const cleanSchedulePump = String(data.pump_type).trim();
              scheduleSavedPumpTypeRef.current = cleanSchedulePump;
              if (
                !userManuallyChangedPumpRef.current &&
                !userManuallySelectedOrderRef.current
              ) {
                setSelectedPumpType(
                  resolvePumpTypeFromOrder(cleanSchedulePump),
                );
              }
            }
            if (data.status)
              setSelectedStatus(normalizeStatusForApi(String(data.status)));
            if (data.notes) setNotes(data.notes);
            if (data.batching_time)
              setBatchingDateTime(parseIsoOrDate(data.batching_time, 8, 0));
            if (data.dispatch_time)
              setDispatchDateTime(parseIsoOrDate(data.dispatch_time, 8, 30));
          }
        })
        .catch((err) => {
          console.log(
            "[EditBatch] Single schedule fetch note:",
            err?.response?.data || err?.message,
          );
        })
        .finally(() => {
          if (isMounted) setIsLoadingDetails(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [token, plant_id, scheduleId]);

  // Synchronize site & mix design if order changes
  const handleSelectOrder = (order: SalesOrderItem) => {
    console.log("[EditBatch] User manually selected order:", {
      id: order.id,
      full_number: order.full_number,
      customer: order.customer?.legal_name,
      site: order.site?.name,
    });
    setSelectedOrder(order);
    setSalesOrderId(Number(order.id));
    setOrderPickerVisible(false);

    if (order.total_qty) {
      setOrderVolumeM3(String(parseFloat(String(order.total_qty)) || 50));
    }
    userManuallySelectedOrderRef.current = true;
    if (order.pump_type || order.concrete_pump) {
      setSelectedPumpType(
        resolvePumpTypeFromOrder(order.pump_type || order.concrete_pump),
      );
    }
    if (order.site_id || order.site?.id) {
      const sId = order.site_id || order.site?.id;
      const match = sitesList.find((s) => s.id === sId);
      if (match) {
        setSelectedSite(match);
      } else if (order.site?.name) {
        setSelectedSite({ id: sId!, name: order.site.name });
      }
    }
    if (order.mix_design_id || order.mix_design?.id) {
      const mId = order.mix_design_id || order.mix_design?.id;
      const match = mixList.find((m) => m.id === mId);
      if (match) {
        setSelectedMixDesign(match);
      } else if (order.mix_design?.design_name || order.mix_design?.name) {
        setSelectedMixDesign({
          id: mId!,
          design_name:
            order.mix_design.design_name || order.mix_design.name || "",
        });
      }
    }
  };

  // Calendar for Schedule Date
  const scheduleCalendarDays = useMemo(() => {
    const firstDayIndex = new Date(schedYear, schedMonth, 1).getDay();
    const daysInMonth = new Date(schedYear, schedMonth + 1, 0).getDate();
    return { firstDayIndex, daysInMonth };
  }, [schedYear, schedMonth]);

  // Calendar for Combined Date & Time modal
  const dtCalendarDays = useMemo(() => {
    const firstDayIndex = new Date(dtCalYear, dtCalMonth, 1).getDay();
    const daysInMonth = new Date(dtCalYear, dtCalMonth + 1, 0).getDate();
    return { firstDayIndex, daysInMonth };
  }, [dtCalYear, dtCalMonth]);

  // Open Date & Time picker
  const openDateTimePicker = (target: "batching" | "dispatch") => {
    const current = target === "batching" ? batchingDateTime : dispatchDateTime;
    setTempDate(new Date(current.getTime()));
    setDtCalMonth(current.getMonth());
    setDtCalYear(current.getFullYear());

    let h = current.getHours();
    const m = current.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;

    setTempHour(h);
    setHourText(h < 10 ? `0${h}` : String(h));
    setTempMinute(m);
    setMinuteText(m < 10 ? `0${m}` : String(m));
    setTempAmPm(ampm);
    setActiveDateTimeTarget(target);
  };

  const incrementHour = () => {
    const nextH = tempHour >= 12 ? 1 : tempHour + 1;
    setTempHour(nextH);
    setHourText(nextH < 10 ? `0${nextH}` : String(nextH));
  };

  const decrementHour = () => {
    const prevH = tempHour <= 1 ? 12 : tempHour - 1;
    setTempHour(prevH);
    setHourText(prevH < 10 ? `0${prevH}` : String(prevH));
  };

  const handleHourTextChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "");
    setHourText(clean);
    const val = parseInt(clean, 10);
    if (!isNaN(val)) {
      if (val >= 1 && val <= 12) setTempHour(val);
      else if (val > 12) {
        setTempHour(12);
        setHourText("12");
      }
    }
  };

  const handleHourBlur = () => {
    if (!hourText || parseInt(hourText, 10) < 1) {
      setHourText("12");
      setTempHour(12);
    } else {
      setHourText(tempHour < 10 ? `0${tempHour}` : String(tempHour));
    }
  };

  const incrementMinute = () => {
    const nextM = tempMinute >= 59 ? 0 : tempMinute + 1;
    setTempMinute(nextM);
    setMinuteText(nextM < 10 ? `0${nextM}` : String(nextM));
  };

  const decrementMinute = () => {
    const prevM = tempMinute <= 0 ? 59 : tempMinute - 1;
    setTempMinute(prevM);
    setMinuteText(prevM < 10 ? `0${prevM}` : String(prevM));
  };

  const handleMinuteTextChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "");
    setMinuteText(clean);
    const val = parseInt(clean, 10);
    if (!isNaN(val)) {
      if (val >= 0 && val <= 59) setTempMinute(val);
      else if (val > 59) {
        setTempMinute(59);
        setMinuteText("59");
      }
    }
  };

  const handleMinuteBlur = () => {
    if (!minuteText) {
      setMinuteText("00");
      setTempMinute(0);
    } else {
      setMinuteText(tempMinute < 10 ? `0${tempMinute}` : String(tempMinute));
    }
  };

  const handleConfirmDateTime = () => {
    if (!activeDateTimeTarget) return;

    let finalHour = tempHour % 12;
    if (tempAmPm === "PM") finalHour += 12;
    const finalMinute = tempMinute;

    const finalDate = new Date(
      tempDate.getFullYear(),
      tempDate.getMonth(),
      tempDate.getDate(),
      finalHour,
      finalMinute,
      0,
      0,
    );

    if (activeDateTimeTarget === "batching") {
      setBatchingDateTime(finalDate);
      if (dispatchDateTime.getTime() <= finalDate.getTime()) {
        const autoDisp = new Date(finalDate.getTime() + 30 * 60 * 1000);
        setDispatchDateTime(autoDisp);
      }
    } else {
      if (finalDate.getTime() <= batchingDateTime.getTime()) {
        Alert.alert(
          "Invalid Dispatch Time",
          "Dispatch time must be scheduled after Batching time.",
        );
        return;
      }
      setDispatchDateTime(finalDate);
    }

    setActiveDateTimeTarget(null);
  };

  // ----------------------------------------------------
  // SUBMISSION: PUT /batch-schedules/{schedule}
  // ----------------------------------------------------
  const handleUpdate = async () => {
    if (!scheduleId) {
      Alert.alert("Error", "Schedule ID is missing.");
      return;
    }

    if (!selectedOrder?.id) {
      Alert.alert("Missing Sales Order", "Please select a Sales Order.");
      return;
    }

    if (!selectedSite?.id) {
      Alert.alert("Missing Site", "Please select a delivery site.");
      return;
    }

    if (!selectedMixDesign?.id) {
      Alert.alert("Missing Mix Design", "Please select a concrete mix design.");
      return;
    }

    const tripVal = parseFloat(qtyM3);
    if (isNaN(tripVal) || tripVal <= 0) {
      Alert.alert(
        "Invalid Trip Volume",
        "Please enter a valid trip volume in m³.",
      );
      return;
    }

    const orderVolVal = parseFloat(orderVolumeM3);
    if (isNaN(orderVolVal) || orderVolVal <= 0) {
      Alert.alert(
        "Invalid Order Volume",
        "Please enter a valid order volume in m³.",
      );
      return;
    }

    const batchingIso = formatToIsoWithoutZ(batchingDateTime);
    const dispatchIso = formatToIsoWithoutZ(dispatchDateTime);

    if (dispatchDateTime.getTime() <= batchingDateTime.getTime()) {
      Alert.alert(
        "Invalid Schedule Timings",
        "Dispatch time must be after Batching time. Please adjust the timings.",
      );
      return;
    }

    setIsSubmitting(true);

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (plant_id) {
      headers["X-Plant-Id"] = String(plant_id);
    }

    if (token) {
      const cleanToken = token.trim();
      headers["Authorization"] = cleanToken.startsWith("Bearer")
        ? cleanToken
        : `Bearer ${cleanToken}`;
    }

    // Exact Body requested:
    const payload = {
      schedule_date: scheduleDate,
      sales_order_id: Number(selectedOrder.id),
      site_id: Number(selectedSite.id),
      mix_design_id: Number(selectedMixDesign.id),
      qty_m3: tripVal,
      order_volume_m3: orderVolVal,
      pump_type: selectedPumpType,
      status: normalizeStatusForApi(selectedStatus),
      notes: notes.trim() || "Requested by sales executive",
      dispatch_time: dispatchIso,
      batching_time: batchingIso,
    };

    console.log(
      "[EditBatch] PUT /batch-schedules payload:",
      JSON.stringify(payload, null, 2),
    );

    try {
      const res = await axios.put(
        `${baseURL}/batch-schedules/${scheduleId}`,
        payload,
        {
          headers,
          params: { schedule: scheduleId },
          timeout: 25000,
        },
      );

      console.log("[EditBatch] Response:", res.data);

      Alert.alert(
        "Batch Schedule Updated",
        res.data?.message || `Schedule #${scheduleId} updated successfully.`,
        [
          {
            text: "View Schedules",
            onPress: () => router.replace("/batching-schedule" as any),
          },
        ],
      );
    } catch (err: any) {
      console.warn(
        "[EditBatch] Error updating batch schedule:",
        err?.response?.data || err?.message,
      );
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update batch schedule. Please try again.";
      Alert.alert("Update Failed", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered lists for modals
  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return ordersList;
    const q = orderSearch.toLowerCase().trim();
    return ordersList.filter((item) => {
      const fullNo =
        item.full_number || `${item.prefix || ""}${item.order_no || ""}`;
      const cust = item.customer?.legal_name || "";
      const sName = item.site?.name || "";
      return (
        fullNo.toLowerCase().includes(q) ||
        cust.toLowerCase().includes(q) ||
        sName.toLowerCase().includes(q)
      );
    });
  }, [ordersList, orderSearch]);

  const remainingCalc = useMemo(() => {
    const o = parseFloat(orderVolumeM3);
    const t = parseFloat(qtyM3);
    if (!isNaN(o) && !isNaN(t)) {
      return Math.max(0, o - t).toFixed(1);
    }
    return "0.0";
  }, [orderVolumeM3, qtyM3]);


  console.log(
    `[EditBatch RENDER FIELD] Sales Order: "${renderedOrderDisplay || "(Empty)"}" | SO ID: ${selectedOrder?.id || salesOrderId} | FullNo: "${selectedOrder?.full_number || "N/A"}" | Customer: "${selectedOrder?.customer?.legal_name || (selectedOrder as any)?.customer_name || "N/A"}" | Site: "${selectedOrder?.site?.name || "N/A"}"`,
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2A4A" />

      {/* Screen Header matching status bar color */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Edit Batch Schedule</Text>
          <Text style={styles.headerSubTitle}>
            {scheduleId
              ? `Schedule #${scheduleId}`
              : "Update Batch & Pour Details"}
          </Text>
        </View>
      </View>

      {(isLoadingDetails || loadingOrders) && !selectedOrder ? (
        <View style={styles.centeredLoader}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.centeredLoaderText}>
            Loading batch schedule details...
          </Text>
        </View>
      ) : (
        <>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* SECTION 1: SALES ORDER */}
              <View style={[styles.sectionCard, styles.highlightCard]}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={20}
                    color="#2563EB"
                  />
                  <Text style={styles.sectionTitle}>
                    Sales Order <Text style={styles.asterisk}>*</Text>
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.orderSelectorBtn,
                    !selectedOrder && styles.orderSelectorEmpty,
                  ]}
                  onPress={() => setOrderPickerVisible(true)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    {renderedOrderDisplay ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Text style={styles.orderMergedText} numberOfLines={1}>
                          {renderedOrderDisplay}
                        </Text>
                        {loadingOrders && !selectedOrder?.full_number ? (
                          <ActivityIndicator size="small" color="#2563EB" />
                        ) : null}
                      </View>
                    ) : loadingOrders ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <ActivityIndicator size="small" color="#2563EB" />
                        <Text style={styles.loadingOrderText}>
                          Loading sales orders...
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.orderPlaceholder}>
                        Choose sales order (SO / Customer / Site)
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#2563EB" />
                </TouchableOpacity>
              </View>

              {/* SECTION 2: SCHEDULE DATE */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="calendar-outline" size={20} color="#2563EB" />
                  <Text style={styles.sectionTitle}>
                    Schedule Date <Text style={styles.asterisk}>*</Text>
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => {
                    setSchedMonth(
                      new Date(scheduleDate).getMonth() ||
                        new Date().getMonth(),
                    );
                    setSchedYear(
                      new Date(scheduleDate).getFullYear() ||
                        new Date().getFullYear(),
                    );
                    setScheduleDatePickerVisible(true);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.datePickerLeft}>
                    <Ionicons name="calendar" size={18} color="#2563EB" />
                    <Text style={styles.datePickerText}>
                      {formatFriendlyDate(scheduleDate)}
                    </Text>
                  </View>
                  <View style={styles.datePickerBadge}>
                    <Text style={styles.datePickerBadgeText}>Change</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="#2563EB"
                    />
                  </View>
                </TouchableOpacity>
              </View>

              {/* SECTION 3: SITE & MIX DESIGN (Non-editable: locked from Sales Order) */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="office-building-marker"
                    size={20}
                    color="#2563EB"
                  />
                  <Text style={styles.sectionTitle}>
                    Delivery Site & Mix Spec
                  </Text>
                </View>

                {/* Delivery Site (Non-editable) */}
                <View style={styles.subFieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldSubLabel}>DELIVERY SITE</Text>
                    <View style={styles.readOnlyBadge}>
                      <Ionicons name="lock-closed" size={10} color="#64748B" />
                      <Text style={styles.readOnlyBadgeText}>From Order</Text>
                    </View>
                  </View>
                  <View style={styles.readOnlySelector}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color="#DC2626"
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text
                        style={[
                          styles.readOnlySelectorValue,
                          !selectedSite && styles.pickerPlaceholder,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedSite
                          ? selectedSite.name
                          : "Auto-filled from Sales Order"}
                      </Text>
                      {selectedSite?.site_address_1 ? (
                        <Text
                          style={styles.pickerSelectorSub}
                          numberOfLines={1}
                        >
                          📍 {selectedSite.site_address_1}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name="lock-closed-outline"
                      size={16}
                      color="#94A3B8"
                    />
                  </View>
                </View>

                {/* Concrete Mix Design (Non-editable) */}
                <View style={[styles.subFieldGroup, { marginTop: 12 }]}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldSubLabel}>CONCRETE MIX SPEC</Text>
                    <View style={styles.readOnlyBadge}>
                      <Ionicons name="lock-closed" size={10} color="#64748B" />
                      <Text style={styles.readOnlyBadgeText}>From Order</Text>
                    </View>
                  </View>
                  <View style={styles.readOnlySelector}>
                    <MaterialCommunityIcons
                      name="cube-outline"
                      size={18}
                      color="#2563EB"
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text
                        style={[
                          styles.readOnlySelectorValue,
                          !selectedMixDesign && styles.pickerPlaceholder,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedMixDesign
                          ? selectedMixDesign.design_name ||
                            selectedMixDesign.name
                          : "Auto-filled from Sales Order"}
                      </Text>
                    </View>
                    <Ionicons
                      name="lock-closed-outline"
                      size={16}
                      color="#94A3B8"
                    />
                  </View>
                </View>
              </View>

              {/* SECTION 4: VOLUMES */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="truck-cargo-container"
                    size={20}
                    color="#2563EB"
                  />
                  <Text style={styles.sectionTitle}>
                    Concrete Volumes (m³) <Text style={styles.asterisk}>*</Text>
                  </Text>
                </View>

                <View style={styles.volumeRow}>
                  {/* Trip Volume */}
                  <View style={[styles.volumeCol, { marginRight: 8 }]}>
                    <Text style={styles.volumeLabel}>TRIP VOLUME</Text>
                    <View style={styles.volumeInputWrap}>
                      <TextInput
                        style={styles.volumeInput}
                        keyboardType="numeric"
                        value={qtyM3}
                        onChangeText={setQtyM3}
                        placeholder="5"
                        placeholderTextColor="#94A3B8"
                      />
                      <Text style={styles.volumeUnit}>m³</Text>
                    </View>
                  </View>

                  {/* Order Volume (Non-editable: locked from Sales Order) */}
                  <View style={[styles.volumeCol, { marginLeft: 8 }]}>
                    <View style={styles.fieldLabelRow}>
                      <Text style={styles.volumeLabel}>ORDER TOTAL</Text>
                      <View style={styles.readOnlyBadge}>
                        <Ionicons name="lock-closed" size={10} color="#64748B" />
                        <Text style={styles.readOnlyBadgeText}>From SO</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.volumeInputWrap,
                        styles.volumeInputWrapDisabled,
                      ]}
                    >
                      <TextInput
                        style={[
                          styles.volumeInput,
                          styles.volumeInputDisabled,
                        ]}
                        editable={false}
                        value={orderVolumeM3}
                        placeholder="50"
                        placeholderTextColor="#94A3B8"
                      />
                      <Text style={[styles.volumeUnit, { color: "#94A3B8" }]}>
                        m³
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.remainingInfoBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color="#D97706"
                  />
                  <Text style={styles.remainingInfoText}>
                    Remaining after this pour:{" "}
                    <Text style={{ fontWeight: "800", color: "#D97706" }}>
                      {remainingCalc} m³
                    </Text>
                  </Text>
                </View>
              </View>

              {/* SECTION 5: PUMP TYPE */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="pipe-leak"
                    size={20}
                    color="#2563EB"
                  />
                  <Text style={styles.sectionTitle}>Pouring / Pump Method</Text>
                </View>

                <TouchableOpacity
                  style={styles.pickerSelectorBtn}
                  onPress={() => setPumpPickerVisible(true)}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons
                    name="pipe-leak"
                    size={18}
                    color="#2563EB"
                  />
                  <Text style={styles.pickerSelectorText}>
                    {formatPumpLabel(selectedPumpType)}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* SECTION 6: STATUS SELECTOR */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="progress-clock"
                    size={20}
                    color="#2563EB"
                  />
                  <Text style={styles.sectionTitle}>
                    Schedule Status <Text style={styles.asterisk}>*</Text>
                  </Text>
                </View>

                <View style={styles.statusChipsGrid}>
                  {STATUS_OPTIONS.map((opt) => {
                    const isSelected = selectedStatus === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.statusChip,
                          { backgroundColor: isSelected ? opt.bg : "#F8FAFC" },
                          isSelected && {
                            borderColor: opt.color,
                            borderWidth: 2,
                          },
                        ]}
                        onPress={() => setSelectedStatus(opt.value)}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor: isSelected
                                ? opt.color
                                : "#94A3B8",
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusChipLabel,
                            { color: isSelected ? opt.color : "#64748B" },
                            isSelected && { fontWeight: "800" },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* SECTION 7: SCHEDULE TIMINGS (FIXED NON-OVERFLOWING STACKED UI) */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="time-outline" size={20} color="#2563EB" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Schedule Timings</Text>
                    <Text style={styles.timingNotice}>
                      Select Date & Time • Dispatch must be after Batching
                    </Text>
                  </View>
                </View>

                <View style={styles.timingList}>
                  {/* Batching Time */}
                  <TouchableOpacity
                    style={styles.timingItem}
                    onPress={() => openDateTimePicker("batching")}
                    activeOpacity={0.75}
                  >
                    <View style={styles.timingItemHeader}>
                      <View
                        style={[
                          styles.timingIconWrap,
                          { backgroundColor: "#EFF6FF" },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="factory"
                          size={18}
                          color="#2563EB"
                        />
                      </View>
                      <View style={styles.timingHeaderTextWrap}>
                        <Text style={styles.timingLabel}>
                          Batching Date & Time
                        </Text>
                        <Text style={styles.timingSub}>
                          Plant production start
                        </Text>
                      </View>
                    </View>

                    <View style={styles.timingValueBox}>
                      <View style={styles.timingValueLeft}>
                        <Ionicons
                          name="calendar-outline"
                          size={15}
                          color="#2563EB"
                        />
                        <Text style={styles.timingBadgeText} numberOfLines={1}>
                          {formatDateTimeDisplay(batchingDateTime)}
                        </Text>
                      </View>
                      <View style={styles.timingActionPill}>
                        <Text style={styles.timingActionText}>Select</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={13}
                          color="#2563EB"
                        />
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Dispatch Time */}
                  <TouchableOpacity
                    style={styles.timingItem}
                    onPress={() => openDateTimePicker("dispatch")}
                    activeOpacity={0.75}
                  >
                    <View style={styles.timingItemHeader}>
                      <View
                        style={[
                          styles.timingIconWrap,
                          { backgroundColor: "#EDE9FE" },
                        ]}
                      >
                        <MaterialIcons
                          name="local-shipping"
                          size={18}
                          color="#7C3AED"
                        />
                      </View>
                      <View style={styles.timingHeaderTextWrap}>
                        <Text style={styles.timingLabel}>
                          Dispatch Date & Time
                        </Text>
                        <Text style={styles.timingSub}>
                          Truck gate departure (after batching)
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.timingValueBox,
                        { borderColor: "#DDD6FE" },
                      ]}
                    >
                      <View style={styles.timingValueLeft}>
                        <Ionicons
                          name="calendar-outline"
                          size={15}
                          color="#7C3AED"
                        />
                        <Text style={styles.timingBadgeText} numberOfLines={1}>
                          {formatDateTimeDisplay(dispatchDateTime)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.timingActionPill,
                          { backgroundColor: "#F5F3FF" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.timingActionText,
                            { color: "#7C3AED" },
                          ]}
                        >
                          Select
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={13}
                          color="#7C3AED"
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* SECTION 8: NOTES */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="note-text-outline"
                    size={19}
                    color="#64748B"
                  />
                  <Text style={styles.sectionTitle}>Notes</Text>
                </View>

                <View style={[styles.inputContainer, styles.textAreaContainer]}>
                  <TextInput
                    style={styles.textArea}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Requested by sales executive"
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </View>

              <View style={{ height: 100 }} />
            </ScrollView>
          </KeyboardAvoidingView>

          {/* BOTTOM ACTION BAR */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleUpdate}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
              ) : (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
              )}
              <Text style={styles.submitButtonText}>
                {isSubmitting
                  ? "Updating Batch Schedule..."
                  : "Save & Update Schedule"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* MODAL 1: SALES ORDER PICKER */}
      <Modal
        visible={orderPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOrderPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>Select Sales Order</Text>
                <Text style={styles.pickerModalSubtitle}>
                  Choose confirmed order for production
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setOrderPickerVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={17} color="#64748B" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search order no, customer, site..."
                placeholderTextColor="#94A3B8"
                value={orderSearch}
                onChangeText={setOrderSearch}
              />
            </View>

            <FlatList
              data={filteredOrders}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected =
                  Number(selectedOrder?.id) === Number(item.id) ||
                  Number(salesOrderId) === Number(item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.pickerItemRow,
                      isSelected && styles.pickerItemActive,
                    ]}
                    onPress={() => handleSelectOrder(item)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.pickerItemTitle,
                          isSelected && { color: "#2563EB" },
                        ]}
                      >
                        {formatOrderRow(item, reduxCustomers)}
                      </Text>
                      <Text style={styles.pickerItemSub}>
                        {item.mix_design?.design_name ||
                          item.mix_design?.name ||
                          "Standard Grade"}{" "}
                        • Qty: {item.total_qty || "-"} m³
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#2563EB"
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>
                    No sales orders found.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* MODAL 4: PUMP TYPE PICKER */}
      <Modal
        visible={pumpPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPumpPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Pouring Method</Text>
              <TouchableOpacity
                onPress={() => setPumpPickerVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {(pumpTypes || []).map((type) => {
              const isSelected =
                selectedPumpType.toLowerCase() === type.toLowerCase();
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.pickerItemRow,
                    isSelected && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setSelectedPumpType(type);
                    userManuallyChangedPumpRef.current = true;
                    setPumpPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="pipe-leak"
                    size={18}
                    color={isSelected ? "#2563EB" : "#64748B"}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.pickerItemTitle,
                      { flex: 1 },
                      isSelected && { color: "#2563EB" },
                    ]}
                  >
                    {formatPumpLabel(type)}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#2563EB"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* MODAL 5: SCHEDULE DATE PICKER */}
      <Modal
        visible={scheduleDatePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setScheduleDatePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Schedule Date</Text>
              <TouchableOpacity
                onPress={() => setScheduleDatePickerVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Quick date presets */}
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => {
                  setScheduleDate(getTodayDateString());
                  setScheduleDatePickerVisible(false);
                }}
              >
                <Text style={styles.presetChipText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  setScheduleDate(`${y}-${m}-${day}`);
                  setScheduleDatePickerVisible(false);
                }}
              >
                <Text style={styles.presetChipText}>Tomorrow</Text>
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigator */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                onPress={() => {
                  if (schedMonth === 0) {
                    setSchedMonth(11);
                    setSchedYear((y) => y - 1);
                  } else {
                    setSchedMonth((m) => m - 1);
                  }
                }}
                style={styles.monthNavBtn}
              >
                <Ionicons name="chevron-back" size={18} color="#1E293B" />
              </TouchableOpacity>
              <Text style={styles.monthNavTitle}>
                {new Date(schedYear, schedMonth).toLocaleString("default", {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (schedMonth === 11) {
                    setSchedMonth(0);
                    setSchedYear((y) => y + 1);
                  } else {
                    setSchedMonth((m) => m + 1);
                  }
                }}
                style={styles.monthNavBtn}
              >
                <Ionicons name="chevron-forward" size={18} color="#1E293B" />
              </TouchableOpacity>
            </View>

            {/* Days Grid */}
            <View style={styles.weekHeaderRow}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <Text key={day} style={styles.weekDayText}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {Array.from({ length: scheduleCalendarDays.firstDayIndex }).map(
                (_, i) => (
                  <View key={`empty-${i}`} style={styles.calendarCellEmpty} />
                ),
              )}
              {Array.from({ length: scheduleCalendarDays.daysInMonth }).map(
                (_, i) => {
                  const dayNumber = i + 1;
                  const dateStr = `${schedYear}-${String(
                    schedMonth + 1,
                  ).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
                  const isSelected = scheduleDate === dateStr;

                  return (
                    <TouchableOpacity
                      key={`day-${dayNumber}`}
                      style={[
                        styles.calendarCell,
                        isSelected && styles.calendarCellSelected,
                      ]}
                      onPress={() => {
                        setScheduleDate(dateStr);
                        setScheduleDatePickerVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.calendarCellText,
                          isSelected && styles.calendarCellTextSelected,
                        ]}
                      >
                        {dayNumber}
                      </Text>
                    </TouchableOpacity>
                  );
                },
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 6: COMBINED DATE & TIME PICKER FOR BATCHING & DISPATCH */}
      <Modal
        visible={activeDateTimeTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveDateTimeTarget(null)}
      >
        <View style={styles.dateTimeModalOverlay}>
          <View style={styles.dateTimeModalContent}>
            <View style={styles.pickerModalHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>
                  {activeDateTimeTarget === "batching"
                    ? "Select Batching Date & Time"
                    : "Select Dispatch Date & Time"}
                </Text>
                <Text style={styles.pickerModalSubtitle}>
                  {activeDateTimeTarget === "batching"
                    ? "Production start at plant"
                    : "Mixer departure (must be after batching)"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveDateTimeTarget(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Presets */}
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    const today = new Date();
                    setTempDate(today);
                    setDtCalMonth(today.getMonth());
                    setDtCalYear(today.getFullYear());
                  }}
                >
                  <Text style={styles.presetChipText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    setTempDate(d);
                    setDtCalMonth(d.getMonth());
                    setDtCalYear(d.getFullYear());
                  }}
                >
                  <Text style={styles.presetChipText}>Tomorrow</Text>
                </TouchableOpacity>
              </View>

              {/* Month Navigation */}
              <View style={styles.monthNavRow}>
                <TouchableOpacity
                  onPress={() => {
                    if (dtCalMonth === 0) {
                      setDtCalMonth(11);
                      setDtCalYear((y) => y - 1);
                    } else {
                      setDtCalMonth((m) => m - 1);
                    }
                  }}
                  style={styles.monthNavBtn}
                >
                  <Ionicons name="chevron-back" size={18} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.monthNavTitle}>
                  {new Date(dtCalYear, dtCalMonth).toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    if (dtCalMonth === 11) {
                      setDtCalMonth(0);
                      setDtCalYear((y) => y + 1);
                    } else {
                      setDtCalMonth((m) => m + 1);
                    }
                  }}
                  style={styles.monthNavBtn}
                >
                  <Ionicons name="chevron-forward" size={18} color="#1E293B" />
                </TouchableOpacity>
              </View>

              {/* Week header & Calendar Days */}
              <View style={styles.weekHeaderRow}>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <Text key={day} style={styles.weekDayText}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {Array.from({ length: dtCalendarDays.firstDayIndex }).map(
                  (_, i) => (
                    <View
                      key={`dt-empty-${i}`}
                      style={styles.calendarCellEmpty}
                    />
                  ),
                )}
                {Array.from({ length: dtCalendarDays.daysInMonth }).map(
                  (_, i) => {
                    const dayNumber = i + 1;
                    const isSelected =
                      tempDate.getDate() === dayNumber &&
                      tempDate.getMonth() === dtCalMonth &&
                      tempDate.getFullYear() === dtCalYear;

                    return (
                      <TouchableOpacity
                        key={`dt-day-${dayNumber}`}
                        style={[
                          styles.calendarCell,
                          isSelected && styles.calendarCellSelected,
                        ]}
                        onPress={() => {
                          const updated = new Date(tempDate);
                          updated.setFullYear(dtCalYear, dtCalMonth, dayNumber);
                          setTempDate(updated);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.calendarCellText,
                            isSelected && styles.calendarCellTextSelected,
                          ]}
                        >
                          {dayNumber}
                        </Text>
                      </TouchableOpacity>
                    );
                  },
                )}
              </View>

              {/* TIME CONTROLS: 1-by-1 increment/decrement & direct typing */}
              <View style={styles.timeSectionBox}>
                <Text style={styles.timeSectionTitle}>
                  TIME (1-BY-1 CONTROLS)
                </Text>

                <View style={styles.timeControlsRow}>
                  {/* Hours Block */}
                  <View style={styles.timeDigitCol}>
                    <TouchableOpacity
                      onPress={incrementHour}
                      style={styles.timeStepperBtn}
                    >
                      <Ionicons name="chevron-up" size={18} color="#2563EB" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.timeDigitInput}
                      keyboardType="number-pad"
                      value={hourText}
                      onChangeText={handleHourTextChange}
                      onBlur={handleHourBlur}
                      maxLength={2}
                    />
                    <TouchableOpacity
                      onPress={decrementHour}
                      style={styles.timeStepperBtn}
                    >
                      <Ionicons name="chevron-down" size={18} color="#2563EB" />
                    </TouchableOpacity>
                    <Text style={styles.timeDigitLabel}>HOURS</Text>
                  </View>

                  <Text style={styles.timeColon}>:</Text>

                  {/* Minutes Block */}
                  <View style={styles.timeDigitCol}>
                    <TouchableOpacity
                      onPress={incrementMinute}
                      style={styles.timeStepperBtn}
                    >
                      <Ionicons name="chevron-up" size={18} color="#2563EB" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.timeDigitInput}
                      keyboardType="number-pad"
                      value={minuteText}
                      onChangeText={handleMinuteTextChange}
                      onBlur={handleMinuteBlur}
                      maxLength={2}
                    />
                    <TouchableOpacity
                      onPress={decrementMinute}
                      style={styles.timeStepperBtn}
                    >
                      <Ionicons name="chevron-down" size={18} color="#2563EB" />
                    </TouchableOpacity>
                    <Text style={styles.timeDigitLabel}>MINS</Text>
                  </View>

                  {/* AM / PM Toggle */}
                  <View style={styles.amPmCol}>
                    <TouchableOpacity
                      style={[
                        styles.amPmBtn,
                        tempAmPm === "AM" && styles.amPmBtnActive,
                      ]}
                      onPress={() => setTempAmPm("AM")}
                    >
                      <Text
                        style={[
                          styles.amPmBtnText,
                          tempAmPm === "AM" && styles.amPmBtnTextActive,
                        ]}
                      >
                        AM
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.amPmBtn,
                        tempAmPm === "PM" && styles.amPmBtnActive,
                      ]}
                      onPress={() => setTempAmPm("PM")}
                    >
                      <Text
                        style={[
                          styles.amPmBtnText,
                          tempAmPm === "PM" && styles.amPmBtnTextActive,
                        ]}
                      >
                        PM
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.confirmDtBtn}
                onPress={handleConfirmDateTime}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmDtBtnText}>Confirm Date & Time</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B2A4A",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  headerSubTitle: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
    marginTop: 2,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  scrollContent: {
    padding: 16,
  },
  centeredLoader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    minHeight: 320,
    backgroundColor: "#F1F5F9",
  },
  centeredLoaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 12,
  },
  loadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  loadingBannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },
  sectionCard: {
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
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  highlightCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#2563EB",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  asterisk: {
    color: "#DC2626",
    fontWeight: "800",
  },
  orderSelectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  orderSelectorEmpty: {
    borderColor: "#93C5FD",
  },
  orderMergedText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  orderPlaceholder: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  loadingOrderText: {
    fontSize: 13,
    color: "#64748B",
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  datePickerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  datePickerText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  datePickerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  datePickerBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  subFieldGroup: {
    width: "100%",
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  fieldSubLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  readOnlyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  readOnlyBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
  },
  readOnlySelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  readOnlySelectorValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  pickerPlaceholder: {
    color: "#94A3B8",
    fontWeight: "500",
  },
  pickerSelectorSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  pickerSelectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  pickerSelectorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  volumeCol: {
    flex: 1,
  },
  volumeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  volumeInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  volumeInputWrapDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  volumeInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    paddingVertical: 10,
  },
  volumeInputDisabled: {
    color: "#64748B",
  },
  volumeUnit: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  remainingInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
    gap: 6,
  },
  remainingInfoText: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "500",
  },
  statusChipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  timingNotice: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 2,
  },
  timingList: {
    gap: 12,
  },
  timingItem: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  timingItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timingHeaderTextWrap: {
    flex: 1,
  },
  timingIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  timingLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  timingSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  timingValueBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  timingValueLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  timingBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    flexShrink: 1,
  },
  timingActionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  timingActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  inputContainer: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
    justifyContent: "center",
  },
  textAreaContainer: {
    minHeight: 70,
    paddingVertical: 8,
  },
  textArea: {
    fontSize: 13,
    color: "#0F172A",
    textAlignVertical: "top",
    minHeight: 50,
  },
  bottomBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  submitButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#93C5FD",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  pickerModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 28,
    maxHeight: "80%",
  },
  pickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  pickerModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  pickerModalSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
  },
  modalSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 12,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
  },
  pickerItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "#F8FAFC",
  },
  pickerItemActive: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  pickerItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  pickerItemSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  pickerEmpty: {
    alignItems: "center",
    paddingVertical: 24,
  },
  pickerEmptyText: {
    fontSize: 13,
    color: "#94A3B8",
  },

  // Calendar
  presetRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  monthNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  monthNavBtn: {
    padding: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
  },
  monthNavTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  weekHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  weekDayText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    width: 36,
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  calendarCell: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginBottom: 6,
  },
  calendarCellSelected: {
    backgroundColor: "#2563EB",
  },
  calendarCellEmpty: {
    width: 36,
    height: 36,
    marginBottom: 6,
  },
  calendarCellText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
  },
  calendarCellTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  // Date & Time Modal
  dateTimeModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  dateTimeModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  timeSectionBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  timeSectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 10,
    textAlign: "center",
  },
  timeControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  timeDigitCol: {
    alignItems: "center",
    width: 58,
  },
  timeStepperBtn: {
    width: 36,
    height: 28,
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  timeDigitInput: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginVertical: 4,
    width: 48,
    paddingVertical: 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  timeDigitLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
    marginTop: 2,
  },
  timeColon: {
    fontSize: 22,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 14,
  },
  amPmCol: {
    marginLeft: 10,
    gap: 6,
    marginBottom: 12,
  },
  amPmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  amPmBtnActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  amPmBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  amPmBtnTextActive: {
    color: "#FFFFFF",
  },
  confirmDtBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 10,
  },
  confirmDtBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
