import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { AppDispatch, RootState } from "@/store/store";
import { fetchDropdowns } from "@/store/dropdownSlice";
import {
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  calculateLineItemTotals,
  LineItemCalculationResult,
} from "../quotation/quotationCalculation";

// ==========================================
// INTERFACES & HELPERS
// ==========================================

export interface DropdownItem {
  id?: number | string;
  label: string;
  subLabel?: string;
  value?: string | number | null;
  extra?: any;
}

export interface FormLineItem {
  id: string;
  mix_design_id: number | null;
  mix_design_name: string;
  quantity: string;
  rate: string;
  tax_id: number | null;
  tax_name: string;
  tax_rate: number;
  concrete_pump: string | null;
  pump_rate: string;
  calculation: LineItemCalculationResult;
}

export function cleanSalesExecutiveName(raw?: string | null): string {
  if (!raw) return "";
  const str = String(raw).trim();
  return str.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function extractSalesExecutiveId(se: any): number | null {
  if (!se) return null;
  if (typeof se === "number" && !isNaN(se) && se > 0) return se;
  if (typeof se === "string" && !isNaN(Number(se)) && se.trim() !== "") {
    const n = Number(se.trim());
    if (n > 0) return n;
  }
  const raw =
    se.id ??
    se.value ??
    se.user_id ??
    se.userId ??
    se.sales_executive_id ??
    se.salesExecutiveId ??
    se.extra?.id ??
    se.extra?.user_id ??
    se.user?.id;
  if (raw !== null && raw !== undefined && !isNaN(Number(raw))) {
    const n = Number(raw);
    if (n > 0) return n;
  }
  return null;
}

export function extractSalesExecutiveName(se: any): string {
  if (!se) return "";
  if (typeof se === "string") {
    const cleaned = cleanSalesExecutiveName(se);
    return cleaned.toLowerCase().startsWith("executive #") ? "" : cleaned;
  }

  const fullNameFromParts = [se.first_name, se.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const userFullName = [se.user?.first_name, se.user?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const employeeFullName = [
    se.employee?.first_name || se.employee?.name,
    se.employee?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const execFullName = [
    se.executive?.first_name || se.executive?.name,
    se.executive?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const raw =
    se.label ||
    se.name ||
    se.full_name ||
    fullNameFromParts ||
    se.display_name ||
    se.username ||
    se.user?.name ||
    se.user?.full_name ||
    userFullName ||
    se.user?.username ||
    se.owner?.name ||
    se.owner?.username ||
    se.creator?.name ||
    se.creator?.username ||
    se.employee_name ||
    se.employee?.name ||
    employeeFullName ||
    se.executive?.label ||
    se.executive?.name ||
    execFullName ||
    se.sales_executive_name ||
    se.executive_name ||
    se.sales_rep_name ||
    se.contact_name ||
    se.title ||
    se.extra?.label ||
    se.extra?.name ||
    se.extra?.full_name ||
    se.extra?.username ||
    se.extra?.user?.name ||
    se.extra?.user?.username ||
    "";

  const cleaned = cleanSalesExecutiveName(raw);
  if (cleaned.toLowerCase().startsWith("executive #")) {
    return "";
  }
  return cleaned;
}

const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return "Select Date";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      return `${day} ${months[d.getMonth()]} ${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

const formatAmountWithDecimals = (
  val: number | string | undefined | null,
): string => {
  const num = typeof val === "number" ? val : parseFloat(String(val || 0));
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatPumpType = (type?: any): string => {
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

const DEFAULT_PUMP_OPTIONS: DropdownItem[] = [
  { id: "none", label: "None / Direct Pour", value: null },
  { id: "boom_pump", label: "Boom Pump", value: "boom_pump" },
  { id: "line_pump", label: "Line Pump", value: "line_pump" },
  { id: "crane_bucket", label: "Crane Bucket", value: "crane_bucket" },
  { id: "direct_pour", label: "Direct Pour", value: "direct_pour" },
  { id: "stationary_pump", label: "Stationary Pump", value: "stationary_pump" },
];

const createDefaultLineItem = (idx = 1): FormLineItem => ({
  id: `item-${Date.now()}-${idx}`,
  mix_design_id: null,
  mix_design_name: "",
  quantity: "",
  rate: "",
  tax_id: null,
  tax_name: "GST 18% (Sales)",
  tax_rate: 18,
  concrete_pump: null,
  pump_rate: "0",
  calculation: calculateLineItemTotals({
    quantity: 0,
    rate: 0,
    pump_rate: 0,
    taxRate: 18,
    isTaxInclusive: false,
  }),
});

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function CreateCustomerPOScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const params = useLocalSearchParams<{
    quotation_id?: string;
    customer_id?: string;
    site_id?: string;
  }>();

  const { token, plant_id, user } = useSelector(
    (state: RootState) => state.auth,
  );
  const { pumpTypes } = useSelector((state: RootState) => state.dropdowns);
  const reduxDropdownSalesExecs = useSelector(
    (state: RootState) => (state.dropdowns as any)?.salesExecutives,
  );
  const reduxQuotationSalesExecs = useSelector(
    (state: RootState) => (state.quotation as any)?.salesExecutives,
  );

  const reduxDropdownSalesExecsRef = useRef(reduxDropdownSalesExecs);
  reduxDropdownSalesExecsRef.current = reduxDropdownSalesExecs;
  const reduxQuotationSalesExecsRef = useRef(reduxQuotationSalesExecs);
  reduxQuotationSalesExecsRef.current = reduxQuotationSalesExecs;

  const effectivePlantId =
    plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;

  // Refresh Redux dropdowns on mount
  useEffect(() => {
    if (token) {
      dispatch(fetchDropdowns({ token, plant_id: effectivePlantId }) as any);
    }
  }, [token, effectivePlantId, dispatch]);

  // Dropdown lists
  const [customers, setCustomers] = useState<DropdownItem[]>([]);
  const [sites, setSites] = useState<DropdownItem[]>([]);
  const [mixDesigns, setMixDesigns] = useState<DropdownItem[]>([]);
  const [taxes, setTaxes] = useState<DropdownItem[]>([]);
  const [pumpOptions, setPumpOptions] = useState<DropdownItem[]>(DEFAULT_PUMP_OPTIONS);
  const [salesExecutives, setSalesExecutives] = useState<DropdownItem[]>([]);

  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form Fields
  const [selectedCustomer, setSelectedCustomer] = useState<DropdownItem | null>(null);
  const [selectedSite, setSelectedSite] = useState<DropdownItem | null>(null);
  const [selectedSalesExecutive, setSelectedSalesExecutive] = useState<DropdownItem | null>(null);
  const [orderDate, setOrderDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [isTaxInclusive, setIsTaxInclusive] = useState<boolean>(false);
  const [customerPoReference, setCustomerPoReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Line items state
  const [items, setItems] = useState<FormLineItem[]>([createDefaultLineItem(1)]);
  const [collapsedItems, setCollapsedItems] = useState<{ [id: string]: boolean }>({});

  // Searchable Picker Modal State
  const [pickerModalVisible, setPickerModalVisible] = useState<boolean>(false);
  const [pickerSearch, setPickerSearch] = useState<string>("");
  const [pickerConfig, setPickerConfig] = useState<{
    title: string;
    items: DropdownItem[];
    selectedId: any;
    onSelect: (item: DropdownItem) => void;
  }>({
    title: "Select",
    items: [],
    selectedId: null,
    onSelect: () => {},
  });

  // Calendar Modal State
  const [dateModalVisible, setDateModalVisible] = useState<boolean>(false);
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/customer-po" as any);
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

  // Fetch all dropdowns on mount
  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    const cleanToken = token.trim();
    headers["Authorization"] = cleanToken.startsWith("Bearer ")
      ? cleanToken
      : `Bearer ${cleanToken}`;

    if (effectivePlantId !== null && effectivePlantId !== undefined) {
      headers["X-Plant-Id"] = String(effectivePlantId);
    }

    const globalHeaders: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: cleanToken.startsWith("Bearer ")
        ? cleanToken
        : `Bearer ${cleanToken}`,
    };

    setIsLoadingDropdowns(true);

    const initialQuotationId = params.quotation_id || null;

    Promise.all([
      // Customers
      axios
        .get(`${baseURL}/customers`, {
          headers,
          params: { page: 1, plant_id: effectivePlantId },
          timeout: 25000,
        })
        .then((res) => {
          const list = res.data?.data?.data || res.data?.data || [];
          return (list || []).map((c: any) => ({
            id: c.id,
            label: c.legal_name || c.name || `Customer #${c.id}`,
            subLabel: c.phone || c.email || undefined,
            extra: c,
          }));
        })
        .catch(() => []),

      // Sites
      axios
        .get(`${baseURL}/sites`, {
          headers,
          params: { page: 1, plant_id: effectivePlantId },
          timeout: 25000,
        })
        .then((res) => {
          const list = res.data?.data?.data || res.data?.data || [];
          return (list || []).map((s: any) => ({
            id: s.id,
            label: s.name || `Site #${s.id}`,
            subLabel: s.site_address_1 || undefined,
            extra: s,
          }));
        })
        .catch(() => []),

      // Mix Designs
      axios
        .get(`${baseURL}/mix-designs`, {
          headers,
          params: { page: 1, plant_id: effectivePlantId },
          timeout: 25000,
        })
        .then((res) => {
          const list = res.data?.data?.data || res.data?.data || [];
          return (list || []).map((m: any) => ({
            id: m.id,
            label: m.design_name || m.name || `Mix #${m.id}`,
            subLabel: m.rate_per_qty ? `Base: ₹${m.rate_per_qty}/m³` : undefined,
            extra: m,
          }));
        })
        .catch(() => []),

      // Taxes
      axios
        .get(`${baseURL}/taxes`, {
          headers,
          params: { page: 1, plant_id: effectivePlantId },
          timeout: 25000,
        })
        .then((res) => {
          const list = res.data?.data?.data || res.data?.data || [];
          return (list || []).map((t: any) => {
            const r = parseFloat(t.tax_rate || t.rate) || 0;
            return {
              id: t.id,
              label: t.name || t.tax_name || `GST ${r}%`,
              subLabel: `Tax Rate: ${r}%`,
              value: t.id,
              extra: t,
            };
          });
        })
        .catch(() => []),

      // Dropdowns (scoped)
      axios
        .get(`${baseURL}/dropdowns`, {
          headers,
          params: effectivePlantId ? { plant_id: effectivePlantId } : undefined,
          timeout: 25000,
        })
        .then((res) => res.data?.data || res.data || {})
        .catch(() => ({})),

      // Dropdowns (global)
      axios
        .get(`${baseURL}/dropdowns`, { headers: globalHeaders, timeout: 25000 })
        .then((res) => res.data?.data || res.data || {})
        .catch(() => ({})),

      // Sales executives (scoped)
      axios
        .get(`${baseURL}/sales-executives`, {
          headers,
          params: { page: 1, per_page: 100, ...(effectivePlantId ? { plant_id: effectivePlantId } : {}) },
          timeout: 25000,
        })
        .then((res) => res.data?.data?.data || res.data?.data || res.data || [])
        .catch(() => []),

      // Sales executives (global)
      axios
        .get(`${baseURL}/sales-executives`, {
          headers: globalHeaders,
          params: { page: 1, per_page: 100 },
          timeout: 25000,
        })
        .then((res) => res.data?.data?.data || res.data?.data || res.data || [])
        .catch(() => []),

      // Quotation if params.quotation_id
      initialQuotationId && Number(initialQuotationId) > 0
        ? axios
            .get(`${baseURL}/quotations/${initialQuotationId}`, {
              headers,
              timeout: 25000,
            })
            .then((res) => res.data?.data || res.data || null)
            .catch(() => null)
        : Promise.resolve(null),
    ])
      .then(
        ([
          custList,
          siteList,
          mixList,
          taxList,
          dropdownScoped,
          dropdownGlobal,
          directExecsScoped,
          directExecsGlobal,
          quotationData,
        ]) => {
          if (!isMounted) return;

          setCustomers(custList);
          setSites(siteList);
          setMixDesigns(mixList);

          if (taxList.length > 0) {
            setTaxes(taxList);
          }

          // Pump options - strictly use string pump_types
          const dataScoped = (dropdownScoped as any) || {};
          const dataGlobal = (dropdownGlobal as any) || {};
          const rawPumpTypes =
            (Array.isArray(dataScoped.pump_types) &&
            dataScoped.pump_types.length > 0
              ? dataScoped.pump_types
              : null) ||
            (Array.isArray(dataGlobal.pump_types) &&
            dataGlobal.pump_types.length > 0
              ? dataGlobal.pump_types
              : null) ||
            (Array.isArray(pumpTypes) && pumpTypes.length > 0
              ? pumpTypes
              : null) || [
              "boom_pump",
              "line_pump",
              "crane_bucket",
              "direct_pour",
              "stationary_pump",
            ];

          const mappedPumps: DropdownItem[] = [
            { id: "none", label: "None / Direct Pour", value: null },
          ];
          rawPumpTypes.forEach((p: any) => {
            if (!p) return;
            const strVal =
              typeof p === "object"
                ? String(p.value || p.id || p.name)
                : String(p);
            const strLabel =
              typeof p === "object"
                ? String(p.label || p.name || formatPumpType(strVal))
                : formatPumpType(strVal);
            if (strVal !== "direct_pour" && strVal !== "none") {
              mappedPumps.push({
                id: strVal,
                label: strLabel,
                value: strVal,
              });
            }
          });
          setPumpOptions(mappedPumps);

          // Sales executives combined
          const currentReduxDropdown = reduxDropdownSalesExecsRef.current;
          const currentReduxQuotation = reduxQuotationSalesExecsRef.current;
          const combinedExecs: any[] = [];
          if (Array.isArray(directExecsScoped)) combinedExecs.push(...directExecsScoped);
          if (Array.isArray(directExecsGlobal)) combinedExecs.push(...directExecsGlobal);
          if (Array.isArray(dataScoped.sales_executives)) combinedExecs.push(...dataScoped.sales_executives);
          if (Array.isArray(dataScoped.salesExecutives)) combinedExecs.push(...dataScoped.salesExecutives);
          if (Array.isArray(dataGlobal.sales_executives)) combinedExecs.push(...dataGlobal.sales_executives);
          if (Array.isArray(dataGlobal.salesExecutives)) combinedExecs.push(...dataGlobal.salesExecutives);
          if (Array.isArray(currentReduxDropdown)) combinedExecs.push(...currentReduxDropdown);
          if (Array.isArray(currentReduxQuotation)) combinedExecs.push(...currentReduxQuotation);
          if (quotationData?.sales_executive) combinedExecs.push(quotationData.sales_executive);

          const salesExecMap = new Map<number, DropdownItem>();
          for (const item of combinedExecs) {
            const id = extractSalesExecutiveId(item);
            if (!id) continue;
            const name = extractSalesExecutiveName(item);
            if (name) {
              salesExecMap.set(id, {
                id,
                label: name,
                subLabel: item.employee_code || item.email || item.phone || undefined,
                value: id,
                extra: item,
              });
            } else if (!salesExecMap.has(id)) {
              salesExecMap.set(id, {
                id,
                label: `Executive #${id}`,
                subLabel: item.employee_code || item.email || item.phone || undefined,
                value: id,
                extra: item,
              });
            }
          }

          const parsedExecs = Array.from(salesExecMap.values());
          parsedExecs.sort((a, b) => a.label.localeCompare(b.label));
          setSalesExecutives(parsedExecs);

          // If quotationData exists, pre-fill form
          if (quotationData) {
            if (quotationData.patron) {
              setSelectedCustomer({
                id: quotationData.patron.id,
                label: quotationData.patron.legal_name || `Customer #${quotationData.patron.id}`,
              });
            }
            if (quotationData.site) {
              setSelectedSite({
                id: quotationData.site.id,
                label: quotationData.site.name || `Site #${quotationData.site.id}`,
              });
            }
            if (quotationData.sales_executive) {
              const qSeId = extractSalesExecutiveId(quotationData.sales_executive);
              const qSeName = extractSalesExecutiveName(quotationData.sales_executive);
              if (qSeId && qSeName) {
                setSelectedSalesExecutive({
                  id: qSeId,
                  label: qSeName,
                  value: qSeId,
                  extra: quotationData.sales_executive,
                });
              }
            }
          }

        // Pre-select defaults for initial line item
        if (mixList.length > 0 && taxList.length > 0) {
          const firstTax = taxList.find((t: any) => t.label.includes("18")) || taxList[0];
          const taxRate = parseFloat(firstTax.extra?.tax_rate || firstTax.extra?.rate) || 18;
          setItems([
            {
              id: `item-${Date.now()}-1`,
              mix_design_id: null,
              mix_design_name: "",
              quantity: "",
              rate: "",
              tax_id: Number(firstTax.id),
              tax_name: firstTax.label,
              tax_rate: taxRate,
              concrete_pump: null,
              pump_rate: "0",
              calculation: calculateLineItemTotals({
                quantity: 0,
                rate: 0,
                pump_rate: 0,
                taxRate,
                isTaxInclusive: false,
              }),
            },
          ]);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingDropdowns(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, effectivePlantId]);

  // When customer changes, filter available sites
  const filteredSites = useMemo(() => {
    if (!selectedCustomer) return sites;
    return sites.filter((site) => {
      const pId = site.extra?.patron_id;
      if (!pId) return true;
      if (Array.isArray(pId)) return pId.includes(selectedCustomer.id);
      return Number(pId) === selectedCustomer.id;
    });
  }, [sites, selectedCustomer]);

  // Line items operations
  const handleAddItem = () => {
    const nextIdx = items.length + 1;
    const defaultTax = taxes.find((t) => t.label.includes("18")) || taxes[0];
    const taxRate = defaultTax ? (parseFloat(defaultTax.extra?.tax_rate || defaultTax.extra?.rate) || 18) : 18;

    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${nextIdx}`,
        mix_design_id: null,
        mix_design_name: "",
        quantity: "",
        rate: "",
        tax_id: defaultTax ? Number(defaultTax.id) : null,
        tax_name: defaultTax ? defaultTax.label : "GST 18% (Sales)",
        tax_rate: taxRate,
        concrete_pump: null,
        pump_rate: "0",
        calculation: calculateLineItemTotals({
          quantity: 0,
          rate: 0,
          pump_rate: 0,
          taxRate,
          isTaxInclusive,
        }),
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      Alert.alert("Action not allowed", "At least one product item is required.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleItemCollapse = (id: string) => {
    setCollapsedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const updateItemField = (index: number, field: keyof FormLineItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index], [field]: value };

      if (field === "pump_rate") {
        let clean = String(value || "").replace(/[^0-9.]/g, "");
        const parts = clean.split(".");
        if (parts.length > 2) clean = `${parts[0]}.${parts.slice(1).join("")}`;
        target.pump_rate = clean;
      }

      const qtyNum = parseFloat(field === "quantity" ? value : target.quantity) || 0;
      const rateNum = parseFloat(field === "rate" ? value : target.rate) || 0;
      const taxRateNum = field === "tax_rate" ? Number(value) : target.tax_rate || 0;
      const pumpRateNum = parseFloat(field === "pump_rate" ? target.pump_rate : target.pump_rate || "0") || 0;

      target.calculation = calculateLineItemTotals({
        quantity: qtyNum,
        rate: rateNum,
        pump_rate: pumpRateNum,
        taxRate: taxRateNum,
        isTaxInclusive,
      });

      copy[index] = target;
      return copy;
    });
  };

  // Tax Inclusive Toggle
  const toggleTaxInclusive = () => {
    const nextVal = !isTaxInclusive;
    setIsTaxInclusive(nextVal);
    setItems((prev) =>
      prev.map((item) => {
        const q = parseFloat(item.quantity) || 0;
        const r = parseFloat(item.rate) || 0;
        const p = parseFloat(item.pump_rate || "0") || 0;
        return {
          ...item,
          calculation: calculateLineItemTotals({
            quantity: q,
            rate: r,
            pump_rate: p,
            taxRate: item.tax_rate || 0,
            isTaxInclusive: nextVal,
          }),
        };
      }),
    );
  };

  // Calculations Preview
  const totals = useMemo(() => {
    let totalQty = 0;
    let untaxedTotal = 0;
    let taxTotal = 0;
    let finalTotal = 0;

    items.forEach((it) => {
      const q = parseFloat(it.quantity) || 0;
      totalQty += q;
      untaxedTotal += it.calculation.untaxedAmount;
      taxTotal += it.calculation.taxAmount;
      finalTotal += it.calculation.amountTotal;
    });

    return {
      totalQty: Math.round(totalQty * 100) / 100,
      untaxedTotal: Number(untaxedTotal.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      finalTotal: Number(finalTotal.toFixed(2)),
    };
  }, [items]);

  // Modal pickers openers
  const openCustomerPicker = () => {
    setPickerConfig({
      title: "Select Customer",
      items: customers,
      selectedId: selectedCustomer?.id ?? null,
      onSelect: (item) => {
        setSelectedCustomer(item);
        setSelectedSite(null);
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const openSitePicker = () => {
    setPickerConfig({
      title: "Select Delivery Site",
      items: filteredSites,
      selectedId: selectedSite?.id ?? null,
      onSelect: (item) => setSelectedSite(item),
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const openSalesExecutivePicker = () => {
    setPickerConfig({
      title: "Select Sales Executive",
      items: [{ id: "none", label: "No Sales Executive" }, ...salesExecutives],
      selectedId: selectedSalesExecutive?.id ?? null,
      onSelect: (item) => {
        if (item.id === "none") {
          setSelectedSalesExecutive(null);
        } else {
          setSelectedSalesExecutive(item);
        }
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const openMixDesignPicker = (itemIndex: number) => {
    setPickerConfig({
      title: "Select Product or Mix Design",
      items: mixDesigns,
      selectedId: items[itemIndex]?.mix_design_id ?? null,
      onSelect: (item) => {
        updateItemField(itemIndex, "mix_design_id", Number(item.id));
        updateItemField(itemIndex, "mix_design_name", item.label);
        if (item.extra?.rate_per_qty && (!items[itemIndex].rate || items[itemIndex].rate === "0")) {
          updateItemField(itemIndex, "rate", String(parseFloat(item.extra.rate_per_qty) || ""));
        }
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const openTaxPicker = (itemIndex: number) => {
    const pickerItems: DropdownItem[] = [
      { id: 0, label: "No Tax (0%)", subLabel: "Exempt or 0% GST" },
      ...taxes,
    ];
    setPickerConfig({
      title: "Select Sales Tax",
      items: pickerItems,
      selectedId: items[itemIndex]?.tax_id ?? 0,
      onSelect: (item) => {
        if (item.id === 0) {
          setItems((prev) => {
            const copy = [...prev];
            copy[itemIndex] = {
              ...copy[itemIndex],
              tax_id: null,
              tax_name: "No Tax (0%)",
              tax_rate: 0,
              calculation: calculateLineItemTotals({
                quantity: parseFloat(copy[itemIndex].quantity) || 0,
                rate: parseFloat(copy[itemIndex].rate) || 0,
                pump_rate: parseFloat(copy[itemIndex].pump_rate || "0") || 0,
                taxRate: 0,
                isTaxInclusive,
              }),
            };
            return copy;
          });
        } else {
          const rateNum = parseFloat(item.extra?.tax_rate || item.extra?.rate) || 0;
          setItems((prev) => {
            const copy = [...prev];
            copy[itemIndex] = {
              ...copy[itemIndex],
              tax_id: Number(item.id),
              tax_name: item.label,
              tax_rate: rateNum,
              calculation: calculateLineItemTotals({
                quantity: parseFloat(copy[itemIndex].quantity) || 0,
                rate: parseFloat(copy[itemIndex].rate) || 0,
                pump_rate: parseFloat(copy[itemIndex].pump_rate || "0") || 0,
                taxRate: rateNum,
                isTaxInclusive,
              }),
            };
            return copy;
          });
        }
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const openPumpPicker = (itemIndex: number) => {
    setPickerConfig({
      title: "Select Pump Type",
      items: pumpOptions,
      selectedId: items[itemIndex]?.concrete_pump ?? "none",
      onSelect: (item) => {
        updateItemField(
          itemIndex,
          "concrete_pump",
          item.value ? String(item.value) : null,
        );
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const filteredPickerItems = useMemo(() => {
    if (!pickerSearch.trim()) return pickerConfig.items;
    const q = pickerSearch.trim().toLowerCase();
    return pickerConfig.items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        (it.subLabel && it.subLabel.toLowerCase().includes(q)),
    );
  }, [pickerConfig.items, pickerSearch]);

  // Calendar Helpers
  const openCalendar = () => {
    try {
      const parts = orderDate.split("-");
      if (parts.length === 3) {
        setCalYear(parseInt(parts[0], 10));
        setCalMonth(parseInt(parts[1], 10) - 1);
      }
    } catch {}
    setDateModalVisible(true);
  };

  const handleSelectCalendarDate = (day: number) => {
    const y = calYear;
    const m = String(calMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    setOrderDate(`${y}-${m}-${d}`);
    setDateModalVisible(false);
  };

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    return { firstDayIndex, daysInMonth };
  }, [calYear, calMonth]);

  // Submission handler
  const handleSubmit = async () => {
    if (!selectedCustomer) {
      Alert.alert("Validation", "Please select a Customer.");
      return;
    }
    if (!selectedSite) {
      Alert.alert("Validation", "Please select a Delivery Site.");
      return;
    }
    if (!orderDate) {
      Alert.alert("Validation", "Please select an Order Date.");
      return;
    }

    // Validate Items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.mix_design_id) {
        Alert.alert("Validation", `Product #${i + 1}: Please select a Product or Mix Design.`);
        return;
      }
      const q = parseFloat(it.quantity);
      if (isNaN(q) || q <= 0) {
        Alert.alert("Validation", `Product #${i + 1}: Please enter a valid quantity in m³.`);
        return;
      }
      const r = parseFloat(it.rate);
      if (isNaN(r) || r < 0) {
        Alert.alert("Validation", `Product #${i + 1}: Please enter a valid rate in ₹.`);
        return;
      }
    }

    const payload = {
      patron_id: Number(selectedCustomer.id),
      site_id: Number(selectedSite.id),
      sales_executive_id:
        selectedSalesExecutive?.id && selectedSalesExecutive.id !== "none"
          ? Number(selectedSalesExecutive.id)
          : null,
      order_date: orderDate,
      is_tax_inclusive: isTaxInclusive,
      customer_po_reference: customerPoReference.trim() || null,
      notes: notes.trim() || null,
      items: items.map((it) => ({
        mix_design_id: Number(it.mix_design_id),
        quantity: parseFloat(it.quantity),
        rate: parseFloat(it.rate),
        tax_id: it.tax_id || null,
        concrete_pump: it.concrete_pump ? String(it.concrete_pump) : null,
        pump_rate: parseFloat(it.pump_rate) || 0,
      })),
    };

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
    if (effectivePlantId !== null && effectivePlantId !== undefined) {
      headers["X-Plant-Id"] = String(effectivePlantId);
    }

    try {
      setIsSubmitting(true);
      console.log("[CustomerPO] Submitting create payload:", JSON.stringify(payload));

      const res = await axios.post(`${baseURL}/customer-pos`, payload, {
        headers,
        timeout: 30000,
      });

      if (res.data?.success) {
        Alert.alert(
          "Success",
          `Customer Purchase Order created successfully: ${res.data?.data?.reference || ""}`,
          [
            {
              text: "OK",
              onPress: () => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/customer-po" as any);
                }
              },
            },
          ],
        );
      } else {
        Alert.alert("Error", res.data?.message || "Failed to create Customer PO.");
      }
    } catch (err: any) {
      console.warn("[CustomerPO] Create error:", err?.response?.data || err?.message);
      const errMsg =
        err?.response?.data?.message ||
        (err?.response?.data?.errors
          ? Object.values(err.response.data.errors).flat().join("\n")
          : null) ||
        err?.message ||
        "Failed to create Customer Purchase Order.";
      Alert.alert("Submission Failed", errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#063b89" translucent={false} />

      {/* HEADER SECTION (EXACT REFERENCE UI) */}
      <LinearGradient
        colors={["#063b89", "#0B4DA8", "#1E62D0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Create Customer PO</Text>
            <Text style={styles.headerSubtitle}>
              Draft · PO reference assigned on save
            </Text>
          </View>

          {/* Isometric Document Graphic */}
          <View style={styles.headerDocIsometric}>
            <View style={styles.headerDocLine1} />
            <View style={styles.headerDocLine2} />
            <View style={styles.headerDocLine3} />
          </View>
        </View>
      </LinearGradient>

      {isLoadingDropdowns ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading master data...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* ========================================================================= */}
            {/* CARD 1: CUSTOMER PO INFORMATION (2-COLUMN GRID) */}
            {/* ========================================================================= */}
            <View style={styles.cardContainer}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderIndicator} />
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={18}
                  color="#4F46E5"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.cardHeaderTitle}>Customer PO Information</Text>
              </View>

              {/* 2-Column Fields Grid: Customer & Site */}
              <View style={styles.gridRow}>
                {/* Customer */}
                <View style={styles.gridCol}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="person-outline" size={14} color="#4F46E5" />
                    <Text style={styles.fieldLabel}>
                      Customer <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dropdownInput}
                    onPress={openCustomerPicker}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.dropdownInputText,
                        !selectedCustomer && styles.dropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedCustomer ? selectedCustomer.label : "Select Customer"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Delivery Site */}
                <View style={styles.gridCol}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="location-outline" size={14} color="#4F46E5" />
                    <Text style={styles.fieldLabel}>
                      Delivery Site <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dropdownInput}
                    onPress={openSitePicker}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.dropdownInputText,
                        !selectedSite && styles.dropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSite ? selectedSite.label : "Select Delivery Site"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 2: Sales Executive & Order Date */}
              <View style={[styles.gridRow, { marginTop: 12 }]}>
                {/* Sales Executive */}
                <View style={styles.gridCol}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="briefcase-outline" size={14} color="#4F46E5" />
                    <Text style={styles.fieldLabel}>Sales Executive</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dropdownInput}
                    onPress={openSalesExecutivePicker}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.dropdownInputText,
                        !selectedSalesExecutive && styles.dropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSalesExecutive
                        ? cleanSalesExecutiveName(selectedSalesExecutive.label)
                        : "Select Sales Executive"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Order Date */}
                <View style={styles.gridCol}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="calendar-outline" size={14} color="#4F46E5" />
                    <Text style={styles.fieldLabel}>
                      Order Date <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={openCalendar}
                    activeOpacity={0.75}
                  >
                    <View style={styles.dateIconWrapper}>
                      <Ionicons name="calendar" size={14} color="#4F46E5" />
                    </View>
                    <Text style={styles.datePickerBtnText} numberOfLines={1}>
                      {formatDisplayDate(orderDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 3: PO Reference */}
              <View style={{ marginTop: 12 }}>
                <View style={styles.fieldLabelRow}>
                  <Ionicons name="receipt-outline" size={14} color="#4F46E5" />
                  <Text style={styles.fieldLabel}>Customer PO Reference</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={customerPoReference}
                  onChangeText={setCustomerPoReference}
                  placeholder="e.g. PO/2026/0491 or Client Work Order"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* ========================================================================= */}
            {/* CARD 2: PRODUCTS & CONCRETE MIXES (EXACT UI MATCH) */}
            {/* ========================================================================= */}
            <View style={styles.cardContainer}>
              <View style={styles.productsSectionHeader}>
                <MaterialCommunityIcons
                  name="layers-outline"
                  size={20}
                  color="#4F46E5"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.productsSectionTitle}>
                  Products & Concrete Mixes ({items.length})
                </Text>
              </View>

              {/* List of Concrete Product Cards */}
              {items.map((item, index) => {
                const itemNumberStr = String(index + 1).padStart(2, "0");
                const isCollapsed = Boolean(collapsedItems[item.id]);

                return (
                  <View key={item.id} style={styles.productCard}>
                    {/* Top Bar inside Product Card */}
                    <View style={styles.productCardTopBar}>
                      <TouchableOpacity
                        style={styles.productCardBadgeRow}
                        onPress={() => toggleItemCollapse(item.id)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.productNumberBadge}>
                          <Text style={styles.productNumberBadgeText}>
                            {itemNumberStr}
                          </Text>
                        </View>
                        <Text style={styles.productCardTitle}>
                          {item.mix_design_name || "Concrete Product"}
                        </Text>
                        <Ionicons
                          name={isCollapsed ? "chevron-down" : "chevron-up"}
                          size={16}
                          color="#64748B"
                          style={{ marginLeft: 4 }}
                        />
                      </TouchableOpacity>

                      {items.length > 1 && (
                        <TouchableOpacity
                          onPress={() => handleRemoveItem(index)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={17} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {!isCollapsed && (
                      <>
                        {/* 1. Product or Mix Design */}
                        <View style={styles.itemFieldGroup}>
                          <View style={styles.fieldLabelRow}>
                            <MaterialCommunityIcons
                              name="cube-outline"
                              size={15}
                              color="#4F46E5"
                            />
                            <Text style={styles.fieldLabel}>
                              Product or mix design{" "}
                              <Text style={styles.requiredAsterisk}>*</Text>
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.dropdownInput}
                            onPress={() => openMixDesignPicker(index)}
                            activeOpacity={0.75}
                          >
                            <Text
                              style={[
                                styles.dropdownInputText,
                                !item.mix_design_id && styles.dropdownPlaceholder,
                              ]}
                              numberOfLines={1}
                            >
                              {item.mix_design_name || "Select Product or Mix Design"}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color="#64748B" />
                          </TouchableOpacity>
                        </View>

                        {/* 2. 2-Col: Quantity & Rate */}
                        <View style={[styles.gridRow, { marginTop: 12 }]}>
                          {/* Quantity in m³ */}
                          <View style={styles.gridCol}>
                            <View style={styles.fieldLabelRow}>
                              <MaterialCommunityIcons
                                name="cube-outline"
                                size={15}
                                color="#4F46E5"
                              />
                              <Text style={styles.fieldLabel}>
                                Quantity in m³{" "}
                                <Text style={styles.requiredAsterisk}>*</Text>
                              </Text>
                            </View>
                            <TextInput
                              style={styles.textInput}
                              keyboardType="decimal-pad"
                              value={item.quantity}
                              onChangeText={(val) => updateItemField(index, "quantity", val)}
                              placeholder="0"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>

                          {/* Rate in ₹ */}
                          <View style={styles.gridCol}>
                            <View style={styles.fieldLabelRow}>
                              <MaterialCommunityIcons
                                name="cash-multiple"
                                size={15}
                                color="#4F46E5"
                              />
                              <Text style={styles.fieldLabel}>
                                Rate in ₹{" "}
                                <Text style={styles.requiredAsterisk}>*</Text>
                              </Text>
                            </View>
                            <TextInput
                              style={styles.textInput}
                              keyboardType="decimal-pad"
                              value={item.rate}
                              onChangeText={(val) => updateItemField(index, "rate", val)}
                              placeholder="0"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>

                        {/* 3. Sales Tax */}
                        <View style={[styles.itemFieldGroup, { marginTop: 12 }]}>
                          <View style={styles.fieldLabelRow}>
                            <MaterialCommunityIcons
                              name="percent"
                              size={15}
                              color="#4F46E5"
                            />
                            <Text style={styles.fieldLabel}>Sales tax</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.dropdownInput}
                            onPress={() => openTaxPicker(index)}
                            activeOpacity={0.75}
                          >
                            <Text style={styles.dropdownInputText} numberOfLines={1}>
                              {item.tax_name || "GST 18% (Sales)"}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color="#64748B" />
                          </TouchableOpacity>
                        </View>

                        {/* 4. 2-Col: Pump Type & Pump Rate */}
                        <View style={[styles.gridRow, { marginTop: 12 }]}>
                          {/* Pump type */}
                          <View style={styles.gridCol}>
                            <View style={styles.fieldLabelRow}>
                              <MaterialCommunityIcons
                                name="truck-delivery-outline"
                                size={15}
                                color="#4F46E5"
                              />
                              <Text style={styles.fieldLabel}>Pump type</Text>
                            </View>
                            <TouchableOpacity
                              style={styles.dropdownInput}
                              onPress={() => openPumpPicker(index)}
                              activeOpacity={0.75}
                            >
                              <Text
                                style={[
                                  styles.dropdownInputText,
                                  !item.concrete_pump && styles.dropdownPlaceholder,
                                ]}
                                numberOfLines={1}
                              >
                                {formatPumpType(item.concrete_pump) || "Select Pump Type"}
                              </Text>
                              <Ionicons name="chevron-down" size={16} color="#64748B" />
                            </TouchableOpacity>
                          </View>

                          {/* Pump rate in ₹ */}
                          <View style={styles.gridCol}>
                            <View style={styles.fieldLabelRow}>
                              <MaterialCommunityIcons
                                name="speedometer"
                                size={15}
                                color="#4F46E5"
                              />
                              <Text style={styles.fieldLabel}>Pump rate in ₹</Text>
                            </View>
                            <TextInput
                              style={styles.textInput}
                              keyboardType="decimal-pad"
                              value={item.pump_rate}
                              onChangeText={(val) => updateItemField(index, "pump_rate", val)}
                              placeholder="0"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>

                        {/* Calculations Strip inside Product Card */}
                        <View style={styles.calcStrip}>
                          <View style={styles.calcStripItem}>
                            <Text style={styles.calcStripLabel}>Material Untaxed</Text>
                            <Text style={styles.calcStripValue}>
                              ₹{formatAmountWithDecimals(item.calculation.materialUntaxed)}
                            </Text>
                          </View>

                          <View style={styles.calcStripItem}>
                            <Text style={styles.calcStripLabel}>Tax ({item.tax_rate}%)</Text>
                            <Text style={styles.calcStripValue}>
                              ₹{formatAmountWithDecimals(item.calculation.taxAmount)}
                            </Text>
                          </View>

                          <View style={styles.calcItemTotalBox}>
                            <Text style={styles.calcItemTotalLabel}>Item Total</Text>
                            <Text style={styles.calcItemTotalValue}>
                              ₹{formatAmountWithDecimals(item.calculation.amountTotal)}
                            </Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}

              {/* Add Another Product Button (Dashed Outline) */}
              <TouchableOpacity
                style={styles.addProductDashedBtn}
                onPress={handleAddItem}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
                <Text style={styles.addProductDashedBtnText}>Add another product</Text>
              </TouchableOpacity>

              {/* Tax Inclusive Checkbox */}
              <TouchableOpacity
                style={styles.taxInclusiveRow}
                onPress={toggleTaxInclusive}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, isTaxInclusive && styles.checkboxChecked]}>
                  {isTaxInclusive && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                </View>
                <Text style={styles.taxInclusiveText}>Tax inclusive rate</Text>
              </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* CARD 3: TERMS / NOTES */}
            {/* ========================================================================= */}
            <View style={styles.cardContainer}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderIndicator} />
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={18}
                  color="#4F46E5"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.cardHeaderTitle}>Terms / Notes</Text>
              </View>
              <TextInput
                style={styles.notesTextInput}
                multiline
                numberOfLines={3}
                placeholder="Delivery instructions, schedule remarks..."
                placeholderTextColor="#94A3B8"
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            {/* ========================================================================= */}
            {/* CARD 4: TOTAL ESTIMATE (EXACT UI MATCH) */}
            {/* ========================================================================= */}
            <View style={styles.cardContainer}>
              <View style={styles.estimateTopRow}>
                <View style={styles.estimateLeftGroup}>
                  <View style={styles.estimateTitleRow}>
                    <Ionicons
                      name="calculator-outline"
                      size={18}
                      color="#4F46E5"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.cardHeaderTitle}>Total Estimate</Text>
                  </View>
                  <Text style={styles.estimateSubtext}>
                    Untaxed: ₹{formatAmountWithDecimals(totals.untaxedTotal)} · Tax: ₹
                    {formatAmountWithDecimals(totals.taxTotal)}
                  </Text>
                </View>
                <View style={styles.estimateBadge}>
                  <Text style={styles.estimateBadgeText}>
                    ₹{formatAmountWithDecimals(totals.finalTotal)}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryFormulaBanner}>
                <MaterialCommunityIcons
                  name="cash-multiple"
                  size={16}
                  color="#2563EB"
                  style={{ marginRight: 4 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryFormulaText}>
                    Volume: {totals.totalQty} m³ · Amount: ₹{formatAmountWithDecimals(totals.finalTotal)}
                  </Text>
                  <Text style={styles.estimateFootnote}>
                    Commercial PO estimate · Ready for plant dispatch
                  </Text>
                </View>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* BOTTOM ACTIONS: CREATE & CANCEL */}
            {/* ========================================================================= */}
            <TouchableOpacity
              style={[
                styles.primarySubmitBtn,
                isSubmitting && styles.primarySubmitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.primarySubmitBtnText}>Create Customer PO</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleBack}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ========================================================================= */}
      {/* SEARCHABLE PICKER MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={pickerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerModalVisible(false)}
        >
          <View
            style={styles.pickerModalContent}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>{pickerConfig.title}</Text>
              <TouchableOpacity
                onPress={() => setPickerModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {pickerConfig.items.length > 5 && (
              <View style={styles.pickerSearchBox}>
                <Ionicons name="search" size={16} color="#94A3B8" />
                <TextInput
                  style={styles.pickerSearchInput}
                  placeholder="Search..."
                  placeholderTextColor="#94A3B8"
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                />
              </View>
            )}

            <FlatList
              data={filteredPickerItems}
              keyExtractor={(item, index) =>
                item.id !== null && item.id !== undefined
                  ? String(item.id)
                  : `null-${index}`
              }
              renderItem={({ item }) => {
                const isSelected = item.id === pickerConfig.selectedId;
                return (
                  <TouchableOpacity
                    style={[
                      styles.pickerItemRow,
                      isSelected && styles.pickerItemRowActive,
                    ]}
                    onPress={() => {
                      pickerConfig.onSelect(item);
                      setPickerModalVisible(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.pickerItemLabel,
                          isSelected && styles.pickerItemLabelActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.subLabel ? (
                        <Text style={styles.pickerItemSubLabel}>
                          {item.subLabel}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#2563EB"
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 340 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================================= */}
      {/* INTERACTIVE CALENDAR MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={dateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDateModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDateModalVisible(false)}
        >
          <View
            style={styles.calendarModalContent}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.calendarModalHeader}>
              <Text style={styles.calendarModalTitle}>Select Order Date</Text>
              <TouchableOpacity
                onPress={() => setDateModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Month / Year Navigator */}
            <View style={styles.calendarMonthRow}>
              <TouchableOpacity
                onPress={() => {
                  if (calMonth === 0) {
                    setCalMonth(11);
                    setCalYear((y) => y - 1);
                  } else {
                    setCalMonth((m) => m - 1);
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={20} color="#0F172A" />
              </TouchableOpacity>

              <Text style={styles.calendarMonthText}>
                {
                  [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December",
                  ][calMonth]
                }{" "}
                {calYear}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  if (calMonth === 11) {
                    setCalMonth(0);
                    setCalYear((y) => y + 1);
                  } else {
                    setCalMonth((m) => m + 1);
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-forward" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* Weekdays Header */}
            <View style={styles.calendarWeekdaysRow}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((w) => (
                <Text key={w} style={styles.calendarWeekdayText}>
                  {w}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.calendarDaysGrid}>
              {Array.from({ length: calendarDays.firstDayIndex }).map(
                (_, idx) => (
                  <View key={`empty-${idx}`} style={styles.calendarDayCell} />
                ),
              )}
              {Array.from({ length: calendarDays.daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const mStr = String(calMonth + 1).padStart(2, "0");
                const dStr = String(dayNum).padStart(2, "0");
                const thisDateStr = `${calYear}-${mStr}-${dStr}`;
                const isSelected = orderDate === thisDateStr;

                return (
                  <TouchableOpacity
                    key={`day-${dayNum}`}
                    style={[
                      styles.calendarDayCell,
                      isSelected && styles.calendarDayCellSelected,
                    ]}
                    onPress={() => handleSelectCalendarDate(dayNum)}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        isSelected && styles.calendarDayTextSelected,
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// STYLES (MATCHING QUOTATION REFERENCE UI)
// ==========================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#063b89",
  },
  container: {
    flex: 1,
    backgroundColor: "#F3F7FB",
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F3F7FB",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },

  // Gradient Header
  headerGradient: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 12 : 8,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
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

  // Isometric Document Graphic
  headerDocIsometric: {
    width: 38,
    height: 44,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 8,
    padding: 5,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  headerDocLine1: {
    height: 3,
    backgroundColor: "#2563EB",
    borderRadius: 1.5,
    width: "70%",
    marginBottom: 4,
  },
  headerDocLine2: {
    height: 3,
    backgroundColor: "#93C5FD",
    borderRadius: 1.5,
    width: "85%",
    marginBottom: 4,
  },
  headerDocLine3: {
    height: 3,
    backgroundColor: "#CBD5E1",
    borderRadius: 1.5,
    width: "50%",
  },

  // Card Container
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  cardHeaderIndicator: {
    width: 3.5,
    height: 16,
    borderRadius: 2,
    backgroundColor: "#4F46E5",
    marginRight: 8,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },

  // 2-Column Grid Layout
  gridRow: {
    flexDirection: "row",
    gap: 12,
  },
  gridCol: {
    flex: 1,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  requiredAsterisk: {
    color: "#EF4444",
    fontWeight: "700",
  },

  // Inputs
  dropdownInput: {
    height: 42,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownInputText: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
    flex: 1,
    marginRight: 6,
  },
  dropdownPlaceholder: {
    color: "#94A3B8",
    fontWeight: "400",
  },
  textInput: {
    height: 42,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  datePickerBtn: {
    height: 42,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
  },
  datePickerBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E40AF",
  },

  // Products Section
  productsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  productsSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  productCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 12,
  },
  productCardTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F7",
  },
  productCardBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  productNumberBadge: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  productNumberBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  productCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E1B4B",
    flex: 1,
  },
  itemFieldGroup: {
    marginBottom: 0,
  },

  // Calculations Strip inside Product Card
  calcStrip: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  calcStripItem: {
    flex: 1,
  },
  calcStripLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    marginBottom: 2,
  },
  calcStripValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  calcItemTotalBox: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "center",
  },
  calcItemTotalLabel: {
    fontSize: 10,
    color: "#1D4ED8",
    fontWeight: "700",
  },
  calcItemTotalValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1D4ED8",
  },

  // Dashed Add Product Button
  addProductDashedBtn: {
    borderWidth: 1.5,
    borderColor: "#2563EB",
    borderStyle: "dashed",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    height: 44,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  addProductDashedBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },

  // Tax Inclusive Row
  taxInclusiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#94A3B8",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  taxInclusiveText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },

  // Notes
  notesTextInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: "#0F172A",
    minHeight: 60,
    textAlignVertical: "top",
    backgroundColor: "#FFFFFF",
  },

  // Card 4: Total Estimate
  estimateTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  estimateLeftGroup: {
    flex: 1,
    marginRight: 10,
  },
  estimateTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  estimateSubtext: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  estimateBadge: {
    backgroundColor: "#1D4ED8",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  estimateBadgeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  summaryFormulaBanner: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryFormulaText: {
    color: "#1E40AF",
    fontSize: 12,
    fontWeight: "700",
  },
  estimateFootnote: {
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
    marginTop: 2,
  },

  // Submit & Cancel Buttons
  primarySubmitBtn: {
    backgroundColor: "#1D4ED8",
    borderRadius: 14,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primarySubmitBtnDisabled: {
    opacity: 0.7,
  },
  primarySubmitBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 37, 64, 0.45)",
    justifyContent: "flex-end",
  },
  pickerModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: "80%",
  },
  pickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  pickerSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10,
  },
  pickerSearchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 13,
    color: "#0F172A",
  },
  pickerItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  pickerItemRowActive: {
    backgroundColor: "#F0F7FF",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  pickerItemLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  pickerItemLabelActive: {
    color: "#2563EB",
    fontWeight: "700",
  },
  pickerItemSubLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  // Calendar Modal
  calendarModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  calendarModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  calendarModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  calendarMonthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  calendarMonthText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  calendarWeekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  calendarWeekdayText: {
    width: 36,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
  },
  calendarDaysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  calendarDayCell: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    marginVertical: 3,
  },
  calendarDayCellSelected: {
    backgroundColor: "#2563EB",
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  calendarDayTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
