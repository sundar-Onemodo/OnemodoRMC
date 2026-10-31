import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import {
  AlertButton,
  AlertType,
  CustomAlertModal,
  formatSubmissionError,
} from "@/components/ui/custom-alert-modal";
import { AppHeader } from "@/components/ui/app-header";
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
import { useRouter } from "expo-router";
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

// Single-row format: "SO/2627/0023 - kavi , KK nagar"
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

// Format human-readable pump label without key
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

function getFutureDateString(daysToAdd: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysToAdd);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split("-");
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

// ==========================================
// COMPONENT
// ==========================================

export default function CreateBatchScheduleScreen() {
  const router = useRouter();
  const dispatch = useDispatch();

  const { token, plant_id, plant_name } = useSelector(
    (state: RootState) => state.auth,
  );

  // Redux: cached dropdowns from /dropdowns
  const { pumpTypes, isLoaded: dropdownsLoaded, customers: reduxCustomers } = useSelector(
    (state: RootState) => state.dropdowns,
  );

  // Redux: cached sites & mix designs
  const cachedSites = useSelector(
    (state: RootState) => state.quotation?.sites || [],
  );
  const cachedMixDesigns = useSelector(
    (state: RootState) => state.quotation?.mixDesigns || [],
  );

  // Hardware Back Navigation (explicit route replace)
  useEffect(() => {
    const onBackPress = () => {
      router.replace("/batching-schedule" as any);
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [router]);

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

  // Form Fields
  const [selectedOrder, setSelectedOrder] = useState<SalesOrderItem | null>(
    null,
  );

  // 1. Requirement 1: Schedule Date with dedicated date picker
  const [scheduleDate, setScheduleDate] =
    useState<string>(getTodayDateString());
  const [scheduleDatePickerVisible, setScheduleDatePickerVisible] =
    useState<boolean>(false);
  const [schedMonth, setSchedMonth] = useState<number>(new Date().getMonth());
  const [schedYear, setSchedYear] = useState<number>(new Date().getFullYear());

  // 2. Site & Mix Design
  const [selectedSite, setSelectedSite] = useState<SiteDropdownItem | null>(
    null,
  );
  const [selectedMixDesign, setSelectedMixDesign] =
    useState<MixDesignDropdownItem | null>(null);

  // Animated Custom Alert State
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

  const showAlert = (
    title: string,
    message: string,
    type: AlertType = "info",
    buttons?: AlertButton[],
  ) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      buttons,
    });
  };

  const hideAlert = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  // Decimal Volumes
  const [orderVolumeM3, setOrderVolumeM3] = useState<string>("50");
  const [qtyM3, setQtyM3] = useState<string>("5");

  const remainingCalc = useMemo(() => {
    const o = parseFloat(orderVolumeM3);
    const t = parseFloat(qtyM3);
    if (!isNaN(o) && !isNaN(t)) {
      return Math.max(0, o - t).toFixed(1);
    }
    return "0.0";
  }, [orderVolumeM3, qtyM3]);

  // Pump Type
  const [selectedPumpType, setSelectedPumpType] =
    useState<string>("direct_pour");
  const userManuallyChangedPumpRef = useRef<boolean>(false);

  // 3. Timings: Batching Time & Dispatch Time
  const [batchingDateTime, setBatchingDateTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  });

  const [dispatchDateTime, setDispatchDateTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(8, 30, 0, 0);
    return d;
  });

  const [notes, setNotes] = useState<string>("Requested by sales executive");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modals Visibility
  const [orderPickerVisible, setOrderPickerVisible] = useState<boolean>(false);
  const [orderSearch, setOrderSearch] = useState<string>("");

  const [pumpPickerVisible, setPumpPickerVisible] = useState<boolean>(false);

  // Combined Date & Time Picker Modal for Batching / Dispatch
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
  // FETCH APIS: Orders, Dropdowns, Sites, Mix Designs
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

    // 1. Fetch Dropdowns API
    if (!dropdownsLoaded) {
      dispatch(setDropdownsLoading(true));
      axios
        .get(`${baseURL}/dropdowns`, { headers, timeout: 15000 })
        .then((res) => {
          if (!isMounted) return;
          if (res.data?.success && res.data?.data) {
            dispatch(setDropdowns(res.data.data));
            if (
              !selectedOrder &&
              !userManuallyChangedPumpRef.current &&
              Array.isArray(res.data.data.pump_types) &&
              res.data.data.pump_types.length > 0
            ) {
              setSelectedPumpType(
                resolvePumpTypeFromOrder(res.data.data.pump_types[0]),
              );
            }
          }
        })
        .catch((err) => {
          console.warn("[Dropdowns API] Error:", err?.message || err);
          dispatch(
            setDropdownsError(err?.message || "Failed to load dropdowns"),
          );
        });
    }

    // 2. Fetch Orders API
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
          res.data?.data?.data || res.data?.data || [];
        if (Array.isArray(list)) {
          setOrdersList(list);
          dispatch(setOrders(list));
          if (!selectedOrder && list.length > 0) {
            handleSelectOrder(list[0]);
          }
        }
      })
      .catch((err) => {
        console.warn("[Orders API] Error loading orders:", err?.message || err);
      })
      .finally(() => {
        if (isMounted) setLoadingOrders(false);
      });

    // 3. Fetch Sites API (same API as createQuotationScreen.tsx)
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
        console.warn("[Sites API] Error loading sites:", err?.message || err);
      })
      .finally(() => {
        if (isMounted) setLoadingSites(false);
      });

    // 4. Fetch Mix Designs API (same API as createQuotationScreen.tsx)
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
          "[Mix Designs API] Error loading mix designs:",
          err?.message || err,
        );
      })
      .finally(() => {
        if (isMounted) setLoadingMix(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, plant_id, dropdownsLoaded, dispatch]);

  // When a Sales Order is selected:
  const handleSelectOrder = (order: SalesOrderItem) => {
    setSelectedOrder(order);

    // Autofill Site
    if (order.site) {
      setSelectedSite({
        id: order.site_id || order.site.id,
        name: order.site.name,
        site_address_1: order.site.site_address_1,
      });
    } else if (order.site_id) {
      const match = sitesList.find((s) => s.id === order.site_id);
      if (match) setSelectedSite(match);
      else
        setSelectedSite({ id: order.site_id, name: `Site #${order.site_id}` });
    }

    // Autofill Mix Design
    if (order.mix_design) {
      setSelectedMixDesign({
        id: order.mix_design_id || order.mix_design.id,
        design_name:
          order.mix_design.design_name || order.mix_design.name || "",
        name: order.mix_design.name || order.mix_design.design_name,
        code: order.mix_design.code,
      });
    } else if (order.mix_design_id) {
      const match = mixList.find((m) => m.id === order.mix_design_id);
      if (match) setSelectedMixDesign(match);
      else
        setSelectedMixDesign({
          id: order.mix_design_id,
          design_name: `Mix #${order.mix_design_id}`,
        });
    }

    // Autofill Order Volume (decimal)
    if (order.total_qty) {
      const qtyNum = parseFloat(String(order.total_qty));
      if (!isNaN(qtyNum)) {
        setOrderVolumeM3(String(qtyNum));
      }
    }

    // Autofill Pump Type if order has concrete_pump or pump_type
    const rawOrderPump = order.concrete_pump || order.pump_type || "";
    if (rawOrderPump) {
      setSelectedPumpType(resolvePumpTypeFromOrder(rawOrderPump));
    }

    // Schedule Date should always default to the current date and not be overwritten with historical order timestamps.
  };

  // Keep Site and Mix Design strictly bound to the selected Sales Order (read-only)
  useEffect(() => {
    if (!selectedOrder) {
      setSelectedSite(null);
      setSelectedMixDesign(null);
      return;
    }

    // Bind Site from Order
    if (selectedOrder.site) {
      setSelectedSite({
        id: selectedOrder.site_id || selectedOrder.site.id,
        name: selectedOrder.site.name,
        site_address_1: selectedOrder.site.site_address_1,
      });
    } else if (selectedOrder.site_id) {
      const match = sitesList.find((s) => s.id === selectedOrder.site_id);
      if (match) {
        setSelectedSite(match);
      } else if (!selectedSite || selectedSite.id !== selectedOrder.site_id) {
        setSelectedSite({
          id: selectedOrder.site_id,
          name: `Site #${selectedOrder.site_id}`,
        });
      }
    }

    // Bind Mix Design from Order (no code shown)
    if (selectedOrder.mix_design) {
      setSelectedMixDesign({
        id: selectedOrder.mix_design_id || selectedOrder.mix_design.id,
        design_name:
          selectedOrder.mix_design.design_name ||
          selectedOrder.mix_design.name ||
          "",
        name:
          selectedOrder.mix_design.name || selectedOrder.mix_design.design_name,
        code: selectedOrder.mix_design.code,
      });
    } else if (selectedOrder.mix_design_id) {
      const match = mixList.find((m) => m.id === selectedOrder.mix_design_id);
      if (match) {
        setSelectedMixDesign(match);
      } else if (
        !selectedMixDesign ||
        selectedMixDesign.id !== selectedOrder.mix_design_id
      ) {
        setSelectedMixDesign({
          id: selectedOrder.mix_design_id,
          design_name: `Mix #${selectedOrder.mix_design_id}`,
        });
      }
    }
  }, [selectedOrder, sitesList, mixList]);

  // ----------------------------------------------------
  // TIME CONTROLS: 1-by-1 increment/decrement & direct typing
  // ----------------------------------------------------
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

  // Hours: +1 / -1
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
      if (val >= 1 && val <= 12) {
        setTempHour(val);
      } else if (val > 12) {
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

  // Minutes: +1 / -1 (increases one by one!)
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
      if (val >= 0 && val <= 59) {
        setTempMinute(val);
      } else if (val > 59) {
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

    let hour24 = tempHour;
    if (tempAmPm === "PM" && hour24 < 12) hour24 += 12;
    if (tempAmPm === "AM" && hour24 === 12) hour24 = 0;

    const newDate = new Date(
      tempDate.getFullYear(),
      tempDate.getMonth(),
      tempDate.getDate(),
      hour24,
      tempMinute,
      0,
    );

    if (activeDateTimeTarget === "batching") {
      setBatchingDateTime(newDate);
      // Auto adjust dispatch time if it's equal or earlier
      if (dispatchDateTime.getTime() <= newDate.getTime()) {
        setDispatchDateTime(new Date(newDate.getTime() + 30 * 60 * 1000));
      }
    } else {
      // Validate against batching time
      if (newDate.getTime() === batchingDateTime.getTime()) {
        showAlert(
          "Invalid Time Range",
          "Batching time and Dispatch time cannot be the same. Dispatch time must be scheduled after Batching time.",
          "warning",
        );
        return;
      }
      if (newDate.getTime() < batchingDateTime.getTime()) {
        showAlert(
          "Invalid Time Range",
          "Dispatch time cannot be earlier than Batching time. Please select a later time.",
          "warning",
        );
        return;
      }
      setDispatchDateTime(newDate);
    }

    setActiveDateTimeTarget(null);
  };

  // Filtered lists
  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return ordersList;
    const q = orderSearch.toLowerCase().trim();
    return ordersList.filter((o) =>
      formatOrderRow(o).toLowerCase().includes(q),
    );
  }, [ordersList, orderSearch]);

  // Calendar helpers for Schedule Date Picker Modal
  const schedCalendarDays = useMemo(() => {
    const firstDayIndex = new Date(schedYear, schedMonth, 1).getDay();
    const daysInMonth = new Date(schedYear, schedMonth + 1, 0).getDate();
    return { firstDayIndex, daysInMonth };
  }, [schedYear, schedMonth]);

  const handleSelectScheduleDay = (day: number) => {
    const mStr = String(schedMonth + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const newDateStr = `${schedYear}-${mStr}-${dStr}`;
    setScheduleDate(newDateStr);

    // Sync year, month, date to batching and dispatch while keeping their times
    const [y, m, dNum] = [schedYear, schedMonth, day];
    const newBatch = new Date(batchingDateTime.getTime());
    newBatch.setFullYear(y, m, dNum);
    setBatchingDateTime(newBatch);

    const newDispatch = new Date(dispatchDateTime.getTime());
    newDispatch.setFullYear(y, m, dNum);
    setDispatchDateTime(newDispatch);

    setScheduleDatePickerVisible(false);
  };

  // Calendar helpers for Date & Time modal
  const dtCalendarDays = useMemo(() => {
    const firstDayIndex = new Date(dtCalYear, dtCalMonth, 1).getDay();
    const daysInMonth = new Date(dtCalYear, dtCalMonth + 1, 0).getDate();
    return { firstDayIndex, daysInMonth };
  }, [dtCalYear, dtCalMonth]);

  // ----------------------------------------------------
  // SUBMISSION: POST /batch-schedules
  // ----------------------------------------------------
  const handleSubmit = async () => {
    if (!selectedOrder?.id) {
      showAlert(
        "Missing Sales Order",
        "Please select a Sales Order from the dropdown.",
        "warning",
      );
      return;
    }

    if (!selectedSite?.id) {
      showAlert(
        "Missing Delivery Site",
        "The selected sales order does not have an associated delivery site.",
        "warning",
      );
      return;
    }

    if (!selectedMixDesign?.id) {
      showAlert(
        "Missing Mix Design",
        "The selected sales order does not have an associated concrete mix design.",
        "warning",
      );
      return;
    }

    const tripVal = parseFloat(qtyM3);
    if (isNaN(tripVal) || tripVal <= 0) {
      showAlert(
        "Invalid Trip Volume",
        "Please enter a valid trip volume in m³.",
        "warning",
      );
      return;
    }

    const orderVolVal = parseFloat(orderVolumeM3);
    if (isNaN(orderVolVal) || orderVolVal <= 0) {
      showAlert(
        "Invalid Order Volume",
        "Please enter a valid order volume in m³.",
        "warning",
      );
      return;
    }

    const batchingIso = formatToIsoWithoutZ(batchingDateTime);
    const dispatchIso = formatToIsoWithoutZ(dispatchDateTime);

    if (batchingIso === dispatchIso) {
      showAlert(
        "Invalid Schedule Timings",
        "Batching time and Dispatch time cannot be the same. Dispatch time must be scheduled after Batching time.",
        "warning",
      );
      return;
    }

    if (dispatchDateTime.getTime() <= batchingDateTime.getTime()) {
      showAlert(
        "Invalid Schedule Timings",
        "Dispatch time must be after Batching time. Please check your schedule timings.",
        "warning",
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

    // Exact Body format
    const payload = {
      schedule_date: scheduleDate,
      sales_order_id: Number(selectedOrder.id),
      site_id: Number(selectedSite.id),
      mix_design_id: Number(selectedMixDesign.id),
      qty_m3: tripVal,
      order_volume_m3: orderVolVal,
      pump_type: selectedPumpType,
      status: "scheduled",
      notes: notes.trim() || "Requested by sales executive",
      dispatch_time: dispatchIso,
      batching_time: batchingIso,
    };

    console.log(
      "[CreateBatchSchedule] POST /batch-schedules Payload:",
      payload,
    );

    try {
      const res = await axios.post(`${baseURL}/batch-schedules`, payload, {
        headers,
        timeout: 25000,
      });

      console.log("[CreateBatchSchedule] Response:", res.data);

      showAlert(
        "Batch Schedule Created",
        res.data?.message ||
          "Batch schedule registered and queued for production.",
        "success",
        [
          {
            text: "View Schedules",
            onPress: () => router.replace("/batching-schedule" as any),
          },
        ],
      );
    } catch (err: any) {
      console.warn(
        "[CreateBatchSchedule] Error submitting:",
        err?.response?.data || err?.message,
      );
      const msg = formatSubmissionError(
        err,
        "Could not save batch schedule. Please check connection and try again.",
      );
      showAlert("Submission Failed", msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2A4A" />

      {/* Screen Header matching App Header color */}
      <AppHeader
        title="Create Batch Schedule"
        backgroundColor="#0B2A4A"
        onBackPress={() => router.replace("/batching-schedule" as any)}
        showNotification={false}
      />

      {loadingOrders && ordersList.length === 0 ? (
        <View style={styles.centeredLoader}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.centeredLoaderText}>
            Loading sales orders and data...
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
              {/* SECTION 1: SALES ORDER (Format: SO/2627/0023 - kavi , KK nagar) */}
              <View style={[styles.sectionCard, styles.highlightCard]}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={20}
                    color="#2563EB"
                  />
                  <Text style={[styles.sectionTitle, { color: "#1D4ED8" }]}>
                    Select Sales Order <Text style={styles.asterisk}>*</Text>
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
                    {loadingOrders ? (
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
                    ) : selectedOrder ? (
                      <Text style={styles.orderMergedText} numberOfLines={1}>
                        {formatOrderRow(selectedOrder, reduxCustomers)}
                      </Text>
                    ) : (
                      <Text style={styles.orderPlaceholder}>
                        Choose sales order (SO / Customer / Site)
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#2563EB" />
                </TouchableOpacity>
              </View>

              {/* SECTION 2: REQUIREMENT 1: SCHEDULE DATE WITH DEDICATED PICKER */}
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
                    const parts = scheduleDate.split("-").map(Number);
                    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                      setSchedYear(parts[0]);
                      setSchedMonth(parts[1] - 1);
                    } else {
                      const now = new Date();
                      setSchedMonth(now.getMonth());
                      setSchedYear(now.getFullYear());
                    }
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
                  <View style={styles.badgeDate}>
                    <Text style={styles.badgeDateText}>{scheduleDate}</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="#2563EB"
                    />
                  </View>
                </TouchableOpacity>
              </View>

              {/* SECTION 3: DELIVERY SITE & MIX DESIGN (Non-editable: bound to selected sales order) */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons
                    name="edit-location-alt"
                    size={20}
                    color="#059669"
                  />
                  <Text style={styles.sectionTitle}>
                    Site & Concrete Mix Design
                  </Text>
                </View>

                {/* Delivery Site (Non-editable) */}
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>
                      Delivery Site <Text style={styles.asterisk}>*</Text>
                    </Text>
                    <View style={styles.readOnlyBadge}>
                      <Ionicons name="lock-closed" size={10} color="#64748B" />
                      <Text style={styles.readOnlyBadgeText}>From Order</Text>
                    </View>
                  </View>
                  <View style={styles.readOnlySelector}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text
                        style={[
                          styles.pickerSelectorValue,
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

                {/* Mix Design (Non-editable: NO CODE) */}
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>
                      Concrete Mix Design <Text style={styles.asterisk}>*</Text>
                    </Text>
                    <View style={styles.readOnlyBadge}>
                      <Ionicons name="lock-closed" size={10} color="#64748B" />
                      <Text style={styles.readOnlyBadgeText}>From Order</Text>
                    </View>
                  </View>
                  <View style={styles.readOnlySelector}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text
                        style={[
                          styles.pickerSelectorValue,
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

              {/* SECTION 4: PUMP TYPE (Just show Name, NOT key) */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="pipe-leak"
                    size={20}
                    color="#7C3AED"
                  />
                  <Text style={styles.sectionTitle}>Pump Type</Text>
                </View>

                <TouchableOpacity
                  style={styles.pickerSelector}
                  onPress={() => setPumpPickerVisible(true)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerSelectorValue}>
                      {formatPumpLabel(selectedPumpType)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* SECTION 5: DECIMAL VOLUMES */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="cube-send"
                    size={20}
                    color="#2563EB"
                  />
                  <Text style={styles.sectionTitle}>
                    Concrete Volumes (m³) <Text style={styles.asterisk}>*</Text>
                  </Text>
                </View>

                <View style={styles.twoColRow}>
                  {/* Trip Volume (qty_m3) Input Field */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>
                      Trip Volume <Text style={styles.asterisk}>*</Text>
                    </Text>
                    <View style={styles.volumeInputContainer}>
                      <TextInput
                        style={styles.volumeTextInput}
                        keyboardType="decimal-pad"
                        value={qtyM3}
                        onChangeText={setQtyM3}
                        placeholder="5.0"
                        placeholderTextColor="#94A3B8"
                      />
                      <Text style={styles.unitSuffix}>m³</Text>
                    </View>
                  </View>

                  {/* Order Volume (from Sales Order) - Locked / Non-editable */}
                  <View style={{ flex: 1 }}>
                    <View style={styles.fieldLabelRow}>
                      <Text style={styles.fieldLabel}>Order Volume</Text>
                      <View style={styles.readOnlyBadge}>
                        <Ionicons name="lock-closed" size={10} color="#64748B" />
                        <Text style={styles.readOnlyBadgeText}>From SO</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.volumeInputContainer,
                        styles.volumeInputContainerDisabled,
                      ]}
                    >
                      <TextInput
                        style={[
                          styles.volumeTextInput,
                          styles.volumeTextInputDisabled,
                        ]}
                        editable={false}
                        value={orderVolumeM3}
                        placeholder="50.0"
                        placeholderTextColor="#94A3B8"
                      />
                      <Text style={[styles.unitSuffix, { color: "#94A3B8" }]}>
                        m³
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Remaining Volume Info */}
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

              {/* SECTION 6: REQUIREMENT 3: TIMINGS (Date & Time with 1-by-1 step & typing) */}
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
                  {/* Batching Time (Date & Time) */}
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

                  {/* Dispatch Time (Date & Time) */}
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

              {/* SECTION 7: NOTES */}
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
              onPress={handleSubmit}
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
                <MaterialCommunityIcons
                  name="calendar-check"
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
              )}
              <Text style={styles.submitButtonText}>
                {isSubmitting
                  ? "Creating Batch Schedule..."
                  : "Save Batch Schedule"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ==========================================
          MODAL 1: SALES ORDER PICKER (Format: SO/2627/0023 - kavi , KK nagar)
         ========================================== */}
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
                  Order No - Customer , Site
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setOrderPickerVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchRow}>
              <Ionicons name="search" size={17} color="#94A3B8" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search order no, customer, site..."
                placeholderTextColor="#94A3B8"
                value={orderSearch}
                onChangeText={setOrderSearch}
                clearButtonMode="while-editing"
              />
              {orderSearch.length > 0 && (
                <TouchableOpacity onPress={() => setOrderSearch("")}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {loadingOrders ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.modalLoadingText}>
                  Loading sales orders...
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredOrders}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = selectedOrder?.id === item.id;
                  const rowDisplay = formatOrderRow(item, reduxCustomers);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.pickerModalItem,
                        isSelected && styles.pickerModalItemSelected,
                      ]}
                      onPress={() => {
                        handleSelectOrder(item);
                        setOrderPickerVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.orderItemSingleRow,
                            isSelected && styles.orderItemSingleRowSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {rowDisplay}
                        </Text>
                        <Text style={styles.orderItemDetailSub}>
                          Order Qty: {item.total_qty || "0"} m³ • Mix:{" "}
                          {item.mix_design?.design_name ||
                            item.mix_design?.name ||
                            "Standard"}
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
                  <View style={styles.modalEmpty}>
                    <Text style={styles.modalEmptyText}>
                      No sales orders found
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ==========================================
          MODAL 2: DEDICATED SCHEDULE DATE PICKER (Requirement 1)
         ========================================== */}
      <Modal
        visible={scheduleDatePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScheduleDatePickerVisible(false)}
      >
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContent}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Schedule Date</Text>
              <TouchableOpacity
                onPress={() => setScheduleDatePickerVisible(false)}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Quick Presets */}
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => {
                  const todayStr = getTodayDateString();
                  setScheduleDate(todayStr);
                  const now = new Date();
                  setSchedMonth(now.getMonth());
                  setSchedYear(now.getFullYear());
                  const newBatch = new Date(batchingDateTime.getTime());
                  newBatch.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
                  setBatchingDateTime(newBatch);
                  const newDispatch = new Date(dispatchDateTime.getTime());
                  newDispatch.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
                  setDispatchDateTime(newDispatch);
                  setScheduleDatePickerVisible(false);
                }}
              >
                <Text style={styles.presetChipText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => {
                  const tomStr = getFutureDateString(1);
                  setScheduleDate(tomStr);
                  const tom = new Date();
                  tom.setDate(tom.getDate() + 1);
                  setSchedMonth(tom.getMonth());
                  setSchedYear(tom.getFullYear());
                  const newBatch = new Date(batchingDateTime.getTime());
                  newBatch.setFullYear(tom.getFullYear(), tom.getMonth(), tom.getDate());
                  setBatchingDateTime(newBatch);
                  const newDispatch = new Date(dispatchDateTime.getTime());
                  newDispatch.setFullYear(tom.getFullYear(), tom.getMonth(), tom.getDate());
                  setDispatchDateTime(newDispatch);
                  setScheduleDatePickerVisible(false);
                }}
              >
                <Text style={styles.presetChipText}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => {
                  const d2Str = getFutureDateString(2);
                  setScheduleDate(d2Str);
                  const d2 = new Date();
                  d2.setDate(d2.getDate() + 2);
                  setSchedMonth(d2.getMonth());
                  setSchedYear(d2.getFullYear());
                  const newBatch = new Date(batchingDateTime.getTime());
                  newBatch.setFullYear(d2.getFullYear(), d2.getMonth(), d2.getDate());
                  setBatchingDateTime(newBatch);
                  const newDispatch = new Date(dispatchDateTime.getTime());
                  newDispatch.setFullYear(d2.getFullYear(), d2.getMonth(), d2.getDate());
                  setDispatchDateTime(newDispatch);
                  setScheduleDatePickerVisible(false);
                }}
              >
                <Text style={styles.presetChipText}>+2 Days</Text>
              </TouchableOpacity>
            </View>

            {/* Month Navigation */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() => {
                  if (schedMonth === 0) {
                    setSchedMonth(11);
                    setSchedYear((y) => y - 1);
                  } else {
                    setSchedMonth((m) => m - 1);
                  }
                }}
              >
                <Ionicons name="chevron-back" size={18} color="#2563EB" />
              </TouchableOpacity>
              <Text style={styles.monthNavTitle}>
                {
                  [
                    "January",
                    "February",
                    "March",
                    "April",
                    "May",
                    "June",
                    "July",
                    "August",
                    "September",
                    "October",
                    "November",
                    "December",
                  ][schedMonth]
                }{" "}
                {schedYear}
              </Text>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() => {
                  if (schedMonth === 11) {
                    setSchedMonth(0);
                    setSchedYear((y) => y + 1);
                  } else {
                    setSchedMonth((m) => m + 1);
                  }
                }}
              >
                <Ionicons name="chevron-forward" size={18} color="#2563EB" />
              </TouchableOpacity>
            </View>

            {/* Day of Week */}
            <View style={styles.dayOfWeekRow}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
                <Text key={i} style={styles.dayOfWeekText}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {Array.from({ length: schedCalendarDays.firstDayIndex }).map(
                (_, i) => (
                  <View key={`empty-sched-${i}`} style={styles.dayCellEmpty} />
                ),
              )}
              {Array.from({ length: schedCalendarDays.daysInMonth }).map(
                (_, i) => {
                  const day = i + 1;
                  const mStr = String(schedMonth + 1).padStart(2, "0");
                  const dStr = String(day).padStart(2, "0");
                  const cellDate = `${schedYear}-${mStr}-${dStr}`;
                  const isSelected = scheduleDate === cellDate;
                  return (
                    <TouchableOpacity
                      key={`d-sched-${day}`}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                      ]}
                      onPress={() => handleSelectScheduleDay(day)}
                    >
                      <Text
                        style={[
                          styles.dayCellText,
                          isSelected && styles.dayCellTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                },
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          MODAL 3: PUMP TYPE PICKER (Just show Name, NOT key)
         ========================================== */}
      <Modal
        visible={pumpPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPumpPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>Select Pump Type</Text>
                <Text style={styles.pickerModalSubtitle}>
                  Choose concrete pour method
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPumpPickerVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={pumpTypes}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = selectedPumpType === item;
                return (
                  <TouchableOpacity
                    style={[
                      styles.pickerModalItem,
                      isSelected && styles.pickerModalItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedPumpType(item);
                      userManuallyChangedPumpRef.current = true;
                      setPumpPickerVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.pickerModalItemTitle,
                          isSelected && styles.pickerModalItemTitleSelected,
                        ]}
                      >
                        {formatPumpLabel(item)}
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
            />
          </View>
        </View>
      </Modal>

      {/* ==========================================
          MODAL 6: REQUIREMENT 3: DATE & TIME PICKER (1-by-1 increment & Typing allowed)
         ========================================== */}
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
              {/* Quick Date Presets */}
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
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 2);
                    setTempDate(d);
                    setDtCalMonth(d.getMonth());
                    setDtCalYear(d.getFullYear());
                  }}
                >
                  <Text style={styles.presetChipText}>+2 Days</Text>
                </TouchableOpacity>
              </View>

              {/* Month Navigation */}
              <View style={styles.monthNavRow}>
                <TouchableOpacity
                  style={styles.monthNavBtn}
                  onPress={() => {
                    if (dtCalMonth === 0) {
                      setDtCalMonth(11);
                      setDtCalYear((y) => y - 1);
                    } else {
                      setDtCalMonth((m) => m - 1);
                    }
                  }}
                >
                  <Ionicons name="chevron-back" size={18} color="#2563EB" />
                </TouchableOpacity>
                <Text style={styles.monthNavTitle}>
                  {
                    [
                      "January",
                      "February",
                      "March",
                      "April",
                      "May",
                      "June",
                      "July",
                      "August",
                      "September",
                      "October",
                      "November",
                      "December",
                    ][dtCalMonth]
                  }{" "}
                  {dtCalYear}
                </Text>
                <TouchableOpacity
                  style={styles.monthNavBtn}
                  onPress={() => {
                    if (dtCalMonth === 11) {
                      setDtCalMonth(0);
                      setDtCalYear((y) => y + 1);
                    } else {
                      setDtCalMonth((m) => m + 1);
                    }
                  }}
                >
                  <Ionicons name="chevron-forward" size={18} color="#2563EB" />
                </TouchableOpacity>
              </View>

              {/* Day of Week */}
              <View style={styles.dayOfWeekRow}>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
                  <Text key={i} style={styles.dayOfWeekText}>
                    {d}
                  </Text>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.daysGrid}>
                {Array.from({ length: dtCalendarDays.firstDayIndex }).map(
                  (_, i) => (
                    <View key={`empty-dt-${i}`} style={styles.dayCellEmpty} />
                  ),
                )}
                {Array.from({ length: dtCalendarDays.daysInMonth }).map(
                  (_, i) => {
                    const day = i + 1;
                    const isSelected =
                      tempDate.getFullYear() === dtCalYear &&
                      tempDate.getMonth() === dtCalMonth &&
                      tempDate.getDate() === day;
                    return (
                      <TouchableOpacity
                        key={`d-dt-${day}`}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                        ]}
                        onPress={() => {
                          const newD = new Date(dtCalYear, dtCalMonth, day);
                          setTempDate(newD);
                        }}
                      >
                        <Text
                          style={[
                            styles.dayCellText,
                            isSelected && styles.dayCellTextSelected,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  },
                )}
              </View>

              {/* Divider */}
              <View style={styles.dateTimeDivider} />

              {/* REQUIREMENT 3: Time Section with 1-by-1 increment & Typing allowed */}
              <Text style={styles.timeSectionHeader}>
                Select Time (Tap to Type or Use Arrows)
              </Text>

              <View style={styles.timeDialRow}>
                {/* Hours (+1 / -1 & Typing allowed) */}
                <View style={styles.dialCol}>
                  <TouchableOpacity
                    style={styles.dialBtn}
                    onPress={incrementHour}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-up" size={22} color="#2563EB" />
                  </TouchableOpacity>
                  <View style={styles.dialValueBox}>
                    <TextInput
                      style={styles.dialValueInput}
                      keyboardType="number-pad"
                      value={hourText}
                      onChangeText={handleHourTextChange}
                      onBlur={handleHourBlur}
                      maxLength={2}
                      selectTextOnFocus
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.dialBtn}
                    onPress={decrementHour}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-down" size={22} color="#2563EB" />
                  </TouchableOpacity>
                  <Text style={styles.dialSubLabel}>Hours (1-12)</Text>
                </View>

                <Text style={styles.timeSeparator}>:</Text>

                {/* Minutes (+1 / -1 & Typing allowed: 12 -> 13 -> 14, NO JUMPING BY 5) */}
                <View style={styles.dialCol}>
                  <TouchableOpacity
                    style={styles.dialBtn}
                    onPress={incrementMinute}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-up" size={22} color="#2563EB" />
                  </TouchableOpacity>
                  <View style={styles.dialValueBox}>
                    <TextInput
                      style={styles.dialValueInput}
                      keyboardType="number-pad"
                      value={minuteText}
                      onChangeText={handleMinuteTextChange}
                      onBlur={handleMinuteBlur}
                      maxLength={2}
                      selectTextOnFocus
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.dialBtn}
                    onPress={decrementMinute}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-down" size={22} color="#2563EB" />
                  </TouchableOpacity>
                  <Text style={styles.dialSubLabel}>Minutes (00-59)</Text>
                </View>

                {/* AM/PM Switch */}
                <View style={styles.ampmCol}>
                  <TouchableOpacity
                    style={[
                      styles.ampmBtn,
                      tempAmPm === "AM" && styles.ampmBtnActive,
                    ]}
                    onPress={() => setTempAmPm("AM")}
                  >
                    <Text
                      style={[
                        styles.ampmBtnText,
                        tempAmPm === "AM" && styles.ampmBtnTextActive,
                      ]}
                    >
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.ampmBtn,
                      tempAmPm === "PM" && styles.ampmBtnActive,
                    ]}
                    onPress={() => setTempAmPm("PM")}
                  >
                    <Text
                      style={[
                        styles.ampmBtnText,
                        tempAmPm === "PM" && styles.ampmBtnTextActive,
                      ]}
                    >
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={styles.timeSaveBtn}
                onPress={handleConfirmDateTime}
                activeOpacity={0.8}
              >
                <Text style={styles.timeSaveBtnText}>Confirm Date & Time</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
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
    backgroundColor: "#0B2A4A",
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
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
    backgroundColor: "#F8FAFC",
  },
  centeredLoaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 12,
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
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  highlightCard: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F0F7FF",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  timingNotice: {
    fontSize: 11,
    color: "#D97706",
    fontWeight: "600",
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  readOnlyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  readOnlyBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  asterisk: {
    color: "#DC2626",
  },
  orderSelectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#2563EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  orderSelectorEmpty: {
    borderColor: "#93C5FD",
    borderStyle: "dashed",
  },
  orderMergedText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  orderPlaceholder: {
    fontSize: 13,
    color: "#64748B",
  },
  loadingOrderText: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "600",
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    fontWeight: "600",
    color: "#1E293B",
  },
  badgeDate: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 4,
  },
  badgeDateText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  pickerSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerSelectorValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  pickerPlaceholder: {
    color: "#94A3B8",
    fontWeight: "400",
  },
  pickerSelectorSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  readOnlySelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  twoColRow: {
    flexDirection: "row",
    gap: 10,
  },
  volumeInputContainerDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  volumeTextInputDisabled: {
    color: "#64748B",
  },
  volumeInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  volumeTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    paddingVertical: 10,
  },
  unitSuffix: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginLeft: 6,
  },
  remainingInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    gap: 6,
  },
  remainingInfoText: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "500",
  },
  volumeCol: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  volumeColLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    marginBottom: 6,
    textAlign: "center",
  },
  volumeInput: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    paddingVertical: 4,
    minWidth: 70,
  },
  volumeUnit: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
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
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  submitButtonDisabled: {
    backgroundColor: "#93C5FD",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Modal Styles
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
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    paddingVertical: 2,
  },
  modalLoading: {
    paddingVertical: 36,
    alignItems: "center",
    gap: 8,
  },
  modalLoadingText: {
    fontSize: 13,
    color: "#64748B",
  },
  pickerModalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  pickerModalItemSelected: {
    backgroundColor: "#EFF6FF",
  },
  pickerModalItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  pickerModalItemTitleSelected: {
    color: "#2563EB",
    fontWeight: "700",
  },
  pickerModalItemSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  orderItemSingleRow: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  orderItemSingleRowSelected: {
    color: "#2563EB",
    fontWeight: "800",
  },
  orderItemDetailSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },
  modalEmpty: {
    paddingVertical: 36,
    alignItems: "center",
  },
  modalEmptyText: {
    fontSize: 14,
    color: "#94A3B8",
  },

  // Dedicated Schedule Date Picker Modal
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  calendarModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 360,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },

  // Date & Time Modal
  dateTimeModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
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
  presetRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  dayOfWeekRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  dayOfWeekText: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCellEmpty: {
    width: "14.28%",
    height: 34,
  },
  dayCell: {
    width: "14.28%",
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: "#2563EB",
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
  },
  dayCellTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  dateTimeDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 14,
  },
  timeSectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
    textAlign: "center",
  },
  timeDialRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginVertical: 8,
  },
  dialCol: {
    alignItems: "center",
  },
  dialBtn: {
    width: 54,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    marginVertical: 4,
  },
  dialValueBox: {
    backgroundColor: "#F8FAFC",
    width: 64,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
  dialValueInput: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    width: "100%",
    height: "100%",
    padding: 0,
  },
  dialSubLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    marginTop: 4,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: "800",
    color: "#64748B",
    marginTop: -16,
  },
  ampmCol: {
    marginLeft: 8,
    gap: 6,
    marginTop: -10,
  },
  ampmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  ampmBtnActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  ampmBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  ampmBtnTextActive: {
    color: "#FFFFFF",
  },
  timeSaveBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 14,
    marginBottom: 16,
  },
  timeSaveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
