import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { fetchDropdowns } from "@/store/dropdownSlice";
import {
  CustomerDropdownItem,
  SalesExecutiveDropdownItem,
  setCustomers,
  setMixDesigns,
  setSalesExecutives,
  setSites,
  setTaxes,
  SiteDropdownItem,
} from "@/store/quotationSlice";
import { RootState } from "@/store/store";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Keyboard,
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
} from "./quotationCalculation";

export interface FormLineItem {
  id: string;
  mix_design_id: number | string | null;
  mix_design_name: string;
  quantity: string;
  rate: string;
  tax_id: number | null;
  tax_name: string;
  tax_rate: number;
  concrete_pump?: string | null;
  pump_rate?: string;
  calculation: LineItemCalculationResult;
}

export interface EditQuotationScreenProps {
  quotationId?: string | number;
  onBack?: () => void;
  onSuccess?: () => void;
}

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getFutureDateString = (daysAhead: number) => {
  const d = new Date(Date.now() + daysAhead * 86400000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateStr: string) => {
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
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

export function cleanSalesExecutiveName(rawName?: string | null): string {
  if (!rawName) return "";
  return rawName.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export default function EditQuotationScreen({
  quotationId: propQuotationId,
  onBack,
  onSuccess,
}: EditQuotationScreenProps = {}) {
  const dispatch = useDispatch();
  const params = useLocalSearchParams<{
    quotation_id?: string;
    id?: string;
    sales_executive_id?: string;
    salesExecutiveId?: string;
    plant_id?: string;
    quotationData?: string;
  }>();

  const passedQuotation = useMemo(() => {
    if (!params.quotationData) return null;
    if (typeof params.quotationData === "object") return params.quotationData;
    try {
      return typeof params.quotationData === "string"
        ? JSON.parse(params.quotationData)
        : params.quotationData;
    } catch {
      return null;
    }
  }, [params.quotationData]);

  const quotationId =
    propQuotationId ?? passedQuotation?.id ?? params.quotation_id ?? params.id;

  const initialSalesExecId = useMemo(() => {
    const raw =
      passedQuotation?.sales_executive_id ??
      passedQuotation?.sales_executive?.id ??
      (typeof passedQuotation?.sales_executive === "number"
        ? passedQuotation.sales_executive
        : null) ??
      params.sales_executive_id ??
      params.salesExecutiveId;
    if (
      raw !== undefined &&
      raw !== null &&
      raw !== "" &&
      !isNaN(Number(raw))
    ) {
      return Number(raw);
    }
    return null;
  }, [passedQuotation, params.sales_executive_id, params.salesExecutiveId]);

  const [storedQuotationId, setStoredQuotationId] = useState<
    number | string | null
  >(quotationId ?? null);
  const [storedSalesExecutiveId, setStoredSalesExecutiveId] = useState<
    number | null
  >(initialSalesExecId);
  const [quotationReference, setQuotationReference] = useState<string>(
    passedQuotation?.reference || "",
  );
  const [loadingDetail, setLoadingDetail] = useState<boolean>(!passedQuotation);

  const { token, plant_id, user } = useSelector(
    (state: RootState) => state.auth,
  );

  const effectivePlantId =
    plant_id ??
    passedQuotation?.plant_id ??
    (params.plant_id ? Number(params.plant_id) : null) ??
    user?.default_plant_id ??
    (user as any)?.plant_id ??
    6;

  const cachedCustomers = useSelector(
    (state: RootState) => state.quotation.customers,
  );
  const cachedSites = useSelector((state: RootState) => state.quotation.sites);
  const cachedMixDesigns = useSelector(
    (state: RootState) => state.quotation.mixDesigns,
  );
  const cachedTaxes = useSelector((state: RootState) => state.quotation.taxes);
  const cachedSalesExecutives = useSelector(
    (state: RootState) => state.quotation.salesExecutives,
  );
  console.log("SALES EXE:", cachedSalesExecutives);

  const { pumpTypes, salesExecutives: dropdownSalesExecutives } = useSelector(
    (state: RootState) => state.dropdowns,
  );

  // Form State
  const [selectedCustomerItem, setSelectedCustomerItem] =
    useState<CustomerDropdownItem | null>(() => {
      if (passedQuotation?.patron) {
        return {
          id: passedQuotation.patron.id,
          legal_name:
            passedQuotation.patron.legal_name ||
            passedQuotation.client ||
            "Customer",
        };
      }
      return null;
    });

  const [selectedSiteItem, setSelectedSiteItem] =
    useState<SiteDropdownItem | null>(() => {
      if (passedQuotation?.site) {
        return {
          id: passedQuotation.site.id,
          name: passedQuotation.site.name || "Site",
          site_address_1: passedQuotation.site.site_address_1 || null,
        };
      }
      return null;
    });

  const [selectedSalesExecutiveItem, setSelectedSalesExecutiveItem] =
    useState<SalesExecutiveDropdownItem | null>(() => {
      const targetId =
        initialSalesExecId ??
        passedQuotation?.sales_executive_id ??
        passedQuotation?.sales_executive?.id;
      if (targetId && cachedSalesExecutives.length > 0) {
        return (
          cachedSalesExecutives.find(
            (se) => Number(se.id) === Number(targetId),
          ) || null
        );
      }
      return null;
    });

  // Sync selected sales executive when cached sales executives arrive from API
  useEffect(() => {
    if (storedSalesExecutiveId && cachedSalesExecutives.length > 0) {
      const match = cachedSalesExecutives.find(
        (se) => Number(se.id) === Number(storedSalesExecutiveId),
      );
      if (match) {
        setSelectedSalesExecutiveItem(match);
      }
    }
  }, [storedSalesExecutiveId, cachedSalesExecutives]);

  const [quoteDate, setQuoteDate] = useState<string>(getTodayDateString());
  const [validityDate, setValidityDate] = useState<string>(
    getFutureDateString(15),
  );
  const [isTaxInclusive, setIsTaxInclusive] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>(
    "Delivery subject to schedule confirmation",
  );
  const [adjustment, setAdjustment] = useState<string>(() => {
    const adj = (passedQuotation as any)?.adjustment;
    return adj !== undefined && adj !== null
      ? String(Math.abs(parseFloat(adj) || 0))
      : "0";
  });

  useEffect(() => {
    if (!pumpTypes || pumpTypes.length === 0) {
      dispatch(fetchDropdowns() as any);
    }
  }, [pumpTypes, dispatch]);

  const handleAdjustmentChange = (val: string) => {
    let clean = val.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) {
      clean = `${parts[0]}.${parts.slice(1).join("")}`;
    }
    setAdjustment(clean);
  };

  // Keyboard padding & scroll-to-view
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardPadding, setKeyboardPadding] = useState<number>(0);
  const notesYRef = useRef<number>(0);
  const estimateYRef = useRef<number>(0);
  const productYRefs = useRef<Record<number, number>>({});
  const activeInputRef = useRef<string | null>(null);

  const scrollToTarget = useCallback((target?: string | null, delay = 100) => {
    const current = target ?? activeInputRef.current;
    if (!current) return;

    setTimeout(() => {
      if (!scrollViewRef.current) return;

      if (current === "notes") {
        const targetY = Math.max(0, notesYRef.current - 24);
        scrollViewRef.current.scrollTo({ y: targetY, animated: true });
      } else if (current === "adjustment") {
        scrollViewRef.current.scrollToEnd({ animated: true });
      } else if (current.startsWith("product_")) {
        const idx = parseInt(current.replace("product_", ""), 10);
        const pY = productYRefs.current[idx];
        if (typeof pY === "number") {
          scrollViewRef.current.scrollTo({
            y: Math.max(0, pY - 20),
            animated: true,
          });
        }
      }
    }, delay);
  }, []);

  const handleInputFocus = useCallback(
    (target: string) => {
      activeInputRef.current = target;
      scrollToTarget(target, Platform.OS === "ios" ? 100 : 150);
    },
    [scrollToTarget],
  );

  const handleInputBlur = useCallback(() => {
    activeInputRef.current = null;
  }, []);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onKeyboardShow = (e: any) => {
      const height = e?.endCoordinates?.height || 0;
      setKeyboardPadding(height);
      if (activeInputRef.current) {
        scrollToTarget(
          activeInputRef.current,
          Platform.OS === "ios" ? 50 : 100,
        );
      }
    };

    const onKeyboardHide = () => {
      setKeyboardPadding(0);
      activeInputRef.current = null;
    };

    const showSub = Keyboard.addListener(showEvent, onKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToTarget]);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/quotation" as any);
    }
  }, [onBack]);

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

  const [items, setItems] = useState<FormLineItem[]>(() => {
    if (
      passedQuotation?.items &&
      Array.isArray(passedQuotation.items) &&
      passedQuotation.items.length > 0
    ) {
      const taxInc = Boolean(passedQuotation.is_tax_inclusive);
      return passedQuotation.items.map((it: any, idx: number) => {
        const itemPump =
          it.pump_rate !== undefined && it.pump_rate !== null
            ? parseFloat(String(it.pump_rate))
            : (passedQuotation as any)?.pump_rate !== undefined &&
                (passedQuotation as any)?.pump_rate !== null
              ? parseFloat(String((passedQuotation as any).pump_rate))
              : 0;
        const itemQty = parseFloat(it.quantity || "6") || 6;
        const itemRate = parseFloat(it.rate || "5000") || 5000;
        const taxRate = Number(it.tax?.rate ?? it.tax?.tax_rate ?? 18);

        return {
          id: `item-${it.id || idx}`,
          mix_design_id: it.mix_design?.id || it.mix_design_id || null,
          mix_design_name:
            it.mix_design?.design_name ||
            it.mix_design?.name ||
            "Concrete Product",
          quantity: String(it.quantity ?? 6),
          rate: String(it.rate ?? 5000),
          tax_id: it.tax?.id || it.tax_id || null,
          tax_name:
            it.tax?.tax_name || it.tax?.name || `GST ${taxRate}% (Sales)`,
          tax_rate: taxRate,
          concrete_pump:
            it.concrete_pump ||
            (passedQuotation as any)?.concrete_pump ||
            (passedQuotation as any)?.pump_type ||
            null,
          pump_rate: String(itemPump || 0),
          calculation: calculateLineItemTotals({
            quantity: itemQty,
            rate: itemRate,
            pump_rate: itemPump,
            taxRate,
            isTaxInclusive: taxInc,
          }),
        };
      });
    }

    return [
      {
        id: "item-1",
        mix_design_id: null,
        mix_design_name: "",
        quantity: "6",
        rate: "5000",
        tax_id: null,
        tax_name: "GST 18% (Sales)",
        tax_rate: 18,
        concrete_pump: null,
        pump_rate: "0",
        calculation: calculateLineItemTotals({
          quantity: 6,
          rate: 5000,
          pump_rate: 0,
          taxRate: 18,
          isTaxInclusive: false,
        }),
      },
    ];
  });

  const [loadingDropdowns, setLoadingDropdowns] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Searchable Picker Modals State
  const [pickerModalVisible, setPickerModalVisible] = useState<boolean>(false);
  const [pickerConfig, setPickerConfig] = useState<{
    title: string;
    items: { id: number | string | null; label: string; subLabel?: string }[];
    selectedId: number | string | null;
    onSelect: (item: any) => void;
  }>({
    title: "",
    items: [],
    selectedId: null,
    onSelect: () => {},
  });
  const [pickerSearch, setPickerSearch] = useState<string>("");

  // Calendar Modal State
  const [calendarModalVisible, setCalendarModalVisible] =
    useState<boolean>(false);
  const [calendarTarget, setCalendarTarget] = useState<"quote" | "validity">(
    "validity",
  );
  const [calendarYear, setCalendarYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [calendarMonth, setCalendarMonth] = useState<number>(
    new Date().getMonth(),
  );

  // Fetch full quotation details from API if not fully populated
  useEffect(() => {
    const fetchQuotationDetails = async () => {
      const targetId = quotationId ?? storedQuotationId;
      if (!targetId || !token) {
        setLoadingDetail(false);
        return;
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      const cleanToken = token.trim();
      headers["Authorization"] = cleanToken.startsWith("Bearer")
        ? cleanToken
        : `Bearer ${cleanToken}`;
      if (effectivePlantId !== null && effectivePlantId !== undefined) {
        headers["X-Plant-Id"] = String(effectivePlantId);
      }

      try {
        let apiData: any = null;
        try {
          const res = await axios.get(`${baseURL}/quotations/${targetId}`, {
            headers,
          });
          apiData = res.data?.data || res.data;
        } catch {
          // fallback
        }

        if (apiData) {
          setStoredQuotationId(apiData.id || targetId);
          if (apiData.reference) setQuotationReference(apiData.reference);
          if (apiData.notes) setNotes(apiData.notes);
          if (apiData.quote_date) setQuoteDate(apiData.quote_date);
          if (apiData.validity_date) setValidityDate(apiData.validity_date);

          const isTaxInc = Boolean(apiData.is_tax_inclusive);
          setIsTaxInclusive(isTaxInc);

          const qPumpRate =
            apiData.pump_rate !== undefined && apiData.pump_rate !== null
              ? String(apiData.pump_rate)
              : "0";

          if (apiData.adjustment !== undefined && apiData.adjustment !== null) {
            setAdjustment(
              String(Math.abs(parseFloat(apiData.adjustment) || 0)),
            );
          }

          if (apiData.patron) {
            setSelectedCustomerItem({
              id: apiData.patron.id,
              legal_name: apiData.patron.legal_name || "Customer",
            });
          }

          if (apiData.site) {
            setSelectedSiteItem({
              id: apiData.site.id,
              name: apiData.site.name || "Site",
              site_address_1: apiData.site.site_address_1 || null,
            });
          }

          const apiSalesExecId =
            apiData.sales_executive?.id ??
            apiData.sales_executive_id ??
            (typeof apiData.sales_executive === "number"
              ? apiData.sales_executive
              : null);
          if (apiSalesExecId) {
            const numId = Number(apiSalesExecId);
            setStoredSalesExecutiveId(numId);
            if (cachedSalesExecutives && cachedSalesExecutives.length > 0) {
              const matched = cachedSalesExecutives.find(
                (se) => Number(se.id) === numId,
              );
              setSelectedSalesExecutiveItem(matched || null);
            }
          }

          if (Array.isArray(apiData.items) && apiData.items.length > 0) {
            const mappedItems: FormLineItem[] = apiData.items.map(
              (it: any, idx: number) => {
                const itemPump =
                  it.pump_rate !== undefined && it.pump_rate !== null
                    ? parseFloat(String(it.pump_rate))
                    : parseFloat(qPumpRate) || 0;
                const itemQty = parseFloat(it.quantity || "6") || 6;
                const itemRate = parseFloat(it.rate || "5000") || 5000;
                const taxRate = Number(it.tax?.rate ?? it.tax?.tax_rate ?? 18);

                return {
                  id: `item-${it.id || idx}`,
                  mix_design_id: it.mix_design?.id || it.mix_design_id || null,
                  mix_design_name:
                    it.mix_design?.design_name ||
                    it.mix_design?.name ||
                    "Concrete Product",
                  quantity: String(it.quantity ?? 6),
                  rate: String(it.rate ?? 5000),
                  tax_id: it.tax?.id || it.tax_id || null,
                  tax_name:
                    it.tax?.tax_name ||
                    it.tax?.name ||
                    `GST ${taxRate}% (Sales)`,
                  tax_rate: taxRate,
                  concrete_pump:
                    it.concrete_pump || apiData.concrete_pump || null,
                  pump_rate: String(itemPump || 0),
                  calculation: calculateLineItemTotals({
                    quantity: itemQty,
                    rate: itemRate,
                    pump_rate: itemPump,
                    taxRate,
                    isTaxInclusive: isTaxInc,
                  }),
                };
              },
            );
            setItems(mappedItems);
          }
        }
      } catch (err: any) {
        console.warn(
          "[EditQuotation] Error loading details:",
          err?.message || err,
        );
      } finally {
        setLoadingDetail(false);
      }
    };

    fetchQuotationDetails();
  }, [quotationId, token, effectivePlantId]);

  // Load all dropdown options
  useEffect(() => {
    let isCancelled = false;
    const loadDropdowns = async () => {
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
      if (effectivePlantId !== null && effectivePlantId !== undefined) {
        headers["X-Plant-Id"] = String(effectivePlantId);
      }

      try {
        const customersPromise = axios
          .get(`${baseURL}/customers`, { headers, params: { page: 1 } })
          .then((res) => {
            const list = res.data?.data?.data || res.data?.data || [];
            if (Array.isArray(list)) dispatch(setCustomers(list));
            return list;
          })
          .catch(() => []);

        const sitesPromise = axios
          .get(`${baseURL}/sites`, { headers, params: { page: 1 } })
          .then((res) => {
            const list = res.data?.data?.data || res.data?.data || [];
            if (Array.isArray(list)) dispatch(setSites(list));
            return list;
          })
          .catch(() => []);

        const mixDesignsPromise = axios
          .get(`${baseURL}/mix-designs`, { headers, params: { page: 1 } })
          .then((res) => {
            const list = res.data?.data?.data || res.data?.data || [];
            if (Array.isArray(list)) dispatch(setMixDesigns(list));
            return list;
          })
          .catch(() => []);

        const taxesPromise = axios
          .get(`${baseURL}/taxes`, { headers, params: { page: 1 } })
          .then((res) => {
            const rawList = res.data?.data?.data || res.data?.data || [];
            if (Array.isArray(rawList)) {
              const parentTaxes = rawList.filter(
                (t: any) => t.parent_id === null || t.parent_id === undefined,
              );
              const result = parentTaxes.length > 0 ? parentTaxes : rawList;
              dispatch(setTaxes(result));
              return result;
            }
            return [];
          })
          .catch(() => []);

        const salesExecParams: Record<string, any> = {
          per_page: 20,
          ...(effectivePlantId ? { plant_id: effectivePlantId } : {}),
        };

        const salesExecutivesPromise = axios
          .get(`${baseURL}/sales-executives`, {
            headers,
            params: salesExecParams,
            timeout: 15000,
          })
          .catch(async (firstErr) => {
            console.log(
              "[EditQuotation] /sales-executives (with plant_id param) status:",
              firstErr?.response?.status,
              firstErr?.response?.data || firstErr?.message,
            );
            // Fallback attempt: with headers and per_page: 20 (no plant_id param)
            try {
              return await axios.get(`${baseURL}/sales-executives`, {
                headers,
                params: { per_page: 20 },
                timeout: 15000,
              });
            } catch (secondErr: any) {
              console.log(
                "[EditQuotation] /sales-executives (without plant_id param) status:",
                secondErr?.response?.status,
                secondErr?.response?.data || secondErr?.message,
              );
              // Final fallback attempt: minimal auth-only headers
              const authOnlyHeaders: Record<string, string> = {
                Accept: "application/json",
                ...(token
                  ? {
                      Authorization: token.trim().startsWith("Bearer")
                        ? token.trim()
                        : `Bearer ${token.trim()}`,
                    }
                  : {}),
              };
              return await axios.get(`${baseURL}/sales-executives`, {
                headers: authOnlyHeaders,
                params: { per_page: 20 },
                timeout: 15000,
              });
            }
          })
          .then((res) => {
            const rawList =
              res?.data?.data?.data || res?.data?.data || res?.data || [];
            const list = Array.isArray(rawList)
              ? rawList.filter(
                  (se: any) =>
                    !String(se?.label || se?.name || "")
                      .toLowerCase()
                      .includes("testing account") &&
                    !String(se?.label || se?.name || "")
                      .toLowerCase()
                      .includes("testing"),
                )
              : [];
            console.log(
              "[EditQuotation] Fetched /sales-executives successfully, count:",
              list.length,
              list,
            );
            dispatch(setSalesExecutives(list));
            return list;
          })
          .catch((err) => {
            console.warn(
              "[EditQuotation] Failed to fetch sales executives:",
              err?.message || err,
              err?.response?.data,
            );
            return [];
          });

        const [
          fetchedCustomers,
          fetchedSites,
          fetchedMixes,
          fetchedTaxes,
          fetchedSalesExecs,
        ] = await Promise.all([
          customersPromise,
          sitesPromise,
          mixDesignsPromise,
          taxesPromise,
          salesExecutivesPromise,
        ]);

        if (
          !isCancelled &&
          Array.isArray(fetchedSalesExecs) &&
          fetchedSalesExecs.length > 0
        ) {
          const targetId = storedSalesExecutiveId ?? initialSalesExecId;
          if (targetId) {
            const found = fetchedSalesExecs.find(
              (se: any) => Number(se.id) === Number(targetId),
            );
            if (found) {
              setSelectedSalesExecutiveItem(found);
            }
          }
        }
      } finally {
        if (!isCancelled) setLoadingDropdowns(false);
      }
    };

    loadDropdowns();
    return () => {
      isCancelled = true;
    };
  }, [token, effectivePlantId, dispatch]);

  // Tax Inclusive Toggle
  const toggleTaxInclusive = () => {
    const nextVal = !isTaxInclusive;
    setIsTaxInclusive(nextVal);
    setItems((prev) =>
      prev.map((item) => {
        const itemPump = parseFloat(item.pump_rate || "0") || 0;
        return {
          ...item,
          calculation: calculateLineItemTotals({
            quantity: parseFloat(item.quantity) || 0,
            rate: parseFloat(item.rate) || 0,
            pump_rate: itemPump,
            taxRate: item.tax_rate || 0,
            isTaxInclusive: nextVal,
          }),
        };
      }),
    );
  };

  // Item Update
  const handleUpdateItem = (
    index: number,
    field: keyof FormLineItem,
    value: any,
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

      if (field === "pump_rate") {
        let clean = String(value || "").replace(/[^0-9.]/g, "");
        const parts = clean.split(".");
        if (parts.length > 2) {
          clean = `${parts[0]}.${parts.slice(1).join("")}`;
        }
        target.pump_rate = clean;
      }

      const qtyNum =
        parseFloat(field === "quantity" ? value : target.quantity) || 0;
      const rateNum = parseFloat(field === "rate" ? value : target.rate) || 0;
      const taxRateNum =
        field === "tax_rate" ? Number(value) : target.tax_rate || 0;
      const pumpRateNum =
        parseFloat(
          field === "pump_rate" ? target.pump_rate : target.pump_rate || "0",
        ) || 0;

      target.calculation = calculateLineItemTotals({
        quantity: qtyNum,
        rate: rateNum,
        pump_rate: pumpRateNum,
        taxRate: taxRateNum,
        isTaxInclusive,
      });

      updated[index] = target;
      return updated;
    });
  };

  const handleAddItem = () => {
    const nextIndex = items.length + 1;
    const defaultMix = cachedMixDesigns[0] || null;
    const defaultTax =
      cachedTaxes.find(
        (t) =>
          String(t.tax_name).includes("18%") ||
          Number(t.rate || t.tax_rate) === 18,
      ) || cachedTaxes[0];

    const initialRate =
      defaultMix && parseFloat(defaultMix.rate_per_qty || "0") > 0
        ? String(parseFloat(defaultMix.rate_per_qty || "0"))
        : "5000";

    const newItem: FormLineItem = {
      id: `item-${Date.now()}-${nextIndex}`,
      mix_design_id: defaultMix ? defaultMix.id : null,
      mix_design_name: defaultMix
        ? defaultMix.design_name || defaultMix.name || ""
        : "",
      quantity: "6",
      rate: initialRate,
      tax_id: defaultTax ? defaultTax.id : null,
      tax_name: defaultTax
        ? defaultTax.tax_name || defaultTax.name || "GST 18% (Sales)"
        : "GST 18% (Sales)",
      tax_rate: defaultTax
        ? Number(defaultTax.rate || defaultTax.tax_rate || 18)
        : 18,
      concrete_pump: null,
      pump_rate: "0",
      calculation: calculateLineItemTotals({
        quantity: 6,
        rate: parseFloat(initialRate) || 5000,
        pump_rate: 0,
        taxRate: defaultTax
          ? Number(defaultTax.rate || defaultTax.tax_rate || 18)
          : 18,
        isTaxInclusive,
      }),
    };

    setItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      Alert.alert(
        "Notice",
        "A quotation must have at least one product or mix design.",
      );
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const totalSummary = useMemo(() => {
    const baseSummary = items.reduce(
      (acc, item) => {
        return {
          grossAmount: acc.grossAmount + item.calculation.grossAmount,
          untaxedAmount: acc.untaxedAmount + item.calculation.untaxedAmount,
          taxAmount: acc.taxAmount + item.calculation.taxAmount,
          itemsAmountTotal: acc.itemsAmountTotal + item.calculation.amountTotal,
        };
      },
      { grossAmount: 0, untaxedAmount: 0, taxAmount: 0, itemsAmountTotal: 0 },
    );

    const adjVal = Math.max(0, parseFloat(adjustment) || 0);
    const finalAmountTotal = baseSummary.itemsAmountTotal + adjVal;

    return {
      ...baseSummary,
      adjustment: adjVal,
      amountTotal: finalAmountTotal,
    };
  }, [items, adjustment]);

  // Picker openers
  const openCustomerPicker = () => {
    const list = [...cachedCustomers];
    if (
      selectedCustomerItem &&
      !list.some((c) => c.id === selectedCustomerItem.id)
    ) {
      list.unshift(selectedCustomerItem);
    }

    setPickerConfig({
      title: "Select Customer",
      items: list.map((c) => ({
        id: c.id,
        label: c.legal_name || (c as any).name || "Customer",
      })),
      selectedId: selectedCustomerItem?.id ?? null,
      onSelect: (item) => {
        const found = list.find((c) => c.id === item.id) || null;
        setSelectedCustomerItem(found);
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const openSitePicker = () => {
    const list = [...cachedSites];
    if (selectedSiteItem && !list.some((s) => s.id === selectedSiteItem.id)) {
      list.unshift(selectedSiteItem);
    }

    setPickerConfig({
      title: "Select Delivery Site",
      items: list.map((s) => ({
        id: s.id,
        label: s.name,
        subLabel: s.site_address_1 ? `📍 ${s.site_address_1}` : undefined,
      })),
      selectedId: selectedSiteItem?.id ?? null,
      onSelect: (item) => {
        const found = list.find((s) => s.id === item.id) || null;
        setSelectedSiteItem(found);
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const openSalesExecutivePicker = () => {
    // Strictly show what is returned from the API (/sales-executives)
    const rawList =
      cachedSalesExecutives && cachedSalesExecutives.length > 0
        ? cachedSalesExecutives
        : (dropdownSalesExecutives || []);
    const list = rawList.filter(
      (se: any) =>
        !String(se?.label || se?.name || "").toLowerCase().includes("testing account") &&
        !String(se?.label || se?.name || "").toLowerCase().includes("testing"),
    );

    const pickerItems: {
      id: number | string | null;
      label: string;
      subLabel?: string;
    }[] = [
      { id: null, label: "-- None --", subLabel: "Clear / No Sales Executive" },
      ...list.map((se) => ({
        id: se.id,
        label: cleanSalesExecutiveName(se.label),
        subLabel: se.employee_code ? `Code: ${se.employee_code}` : undefined,
      })),
    ];

    setPickerConfig({
      title: "Select Sales Executive",
      items: pickerItems,
      selectedId: selectedSalesExecutiveItem?.id ?? null,
      onSelect: (item) => {
        if (item.id === null) {
          setSelectedSalesExecutiveItem(null);
          setStoredSalesExecutiveId(null);
        } else {
          const found =
            list.find((se) => Number(se.id) === Number(item.id)) || null;
          setSelectedSalesExecutiveItem(found);
          if (found) setStoredSalesExecutiveId(Number(found.id));
        }
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const openPumpPicker = (itemIndex: number) => {
    const list: { id: string | null; label: string; subLabel?: string }[] = [
      { id: null, label: "None / Direct Pour" },
    ];
    const availablePumps =
      Array.isArray(pumpTypes) && pumpTypes.length > 0
        ? pumpTypes
        : [
            "boom_pump",
            "line_pump",
            "crane_bucket",
            "direct_pour",
            "stationary_pump",
          ];
    availablePumps.forEach((p: any) => {
      if (!p) return;
      const val = typeof p === "object" ? p.value || p.id || p.name : String(p);
      const lbl = typeof p === "object" ? p.label || p.name : formatPumpType(p);
      list.push({ id: val, label: lbl });
    });

    setPickerConfig({
      title: "Select Pump Type",
      items: list,
      selectedId: items[itemIndex]?.concrete_pump ?? null,
      onSelect: (item) => {
        handleUpdateItem(
          itemIndex,
          "concrete_pump",
          item.id ? String(item.id) : null,
        );
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const openMixDesignPicker = (itemIndex: number) => {
    const list = cachedMixDesigns;

    setPickerConfig({
      title: "Select Product or Mix Design",
      items: list.map((m) => ({
        id: m.id,
        label: m.design_name || m.name || "Concrete Mix",
        subLabel:
          parseFloat(m.rate_per_qty || "0") > 0
            ? `Standard Rate: ₹${parseFloat(m.rate_per_qty || "0").toLocaleString("en-IN")}/m³`
            : undefined,
      })),
      selectedId: items[itemIndex]?.mix_design_id ?? null,
      onSelect: (selected) => {
        const found = list.find((m) => m.id === selected.id);
        if (found) {
          handleUpdateItem(
            itemIndex,
            "mix_design_name",
            found.design_name || found.name || "",
          );
          handleUpdateItem(itemIndex, "mix_design_id", found.id);
          if (
            parseFloat(found.rate_per_qty || "0") > 0 &&
            (!items[itemIndex].rate || items[itemIndex].rate === "0")
          ) {
            handleUpdateItem(
              itemIndex,
              "rate",
              String(parseFloat(found.rate_per_qty || "0")),
            );
          }
        }
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const openTaxPicker = (itemIndex: number) => {
    const list = cachedTaxes;

    const pickerItems = [
      { id: null, label: "No Tax (0%)", subLabel: "Exempt or 0% GST" },
      ...list.map((t) => ({
        id: t.id,
        label: t.tax_name || t.name || "Sales Tax",
        subLabel: `Tax Rate: ${t.rate ?? t.tax_rate ?? 0}%`,
      })),
    ];

    setPickerConfig({
      title: "Select Sales Tax",
      items: pickerItems,
      selectedId: items[itemIndex]?.tax_id ?? null,
      onSelect: (selected) => {
        if (selected.id === null) {
          handleUpdateItem(itemIndex, "tax_id", null);
          handleUpdateItem(itemIndex, "tax_name", "No Tax (0%)");
          handleUpdateItem(itemIndex, "tax_rate", 0);
        } else {
          const found = list.find((t) => t.id === selected.id);
          if (found) {
            handleUpdateItem(itemIndex, "tax_id", found.id);
            handleUpdateItem(
              itemIndex,
              "tax_name",
              found.tax_name || found.name || "",
            );
            handleUpdateItem(
              itemIndex,
              "tax_rate",
              Number(found.rate ?? found.tax_rate ?? 0),
            );
          }
        }
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const filteredPickerItems = useMemo(() => {
    if (!pickerSearch.trim()) return pickerConfig.items;
    const q = pickerSearch.trim().toLowerCase();
    return pickerConfig.items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.subLabel && item.subLabel.toLowerCase().includes(q)),
    );
  }, [pickerConfig.items, pickerSearch]);

  const openCalendar = (target: "quote" | "validity") => {
    setCalendarTarget(target);
    const currentDateStr = target === "quote" ? quoteDate : validityDate;
    try {
      const parts = currentDateStr.split("-");
      if (parts.length === 3) {
        setCalendarYear(parseInt(parts[0], 10));
        setCalendarMonth(parseInt(parts[1], 10) - 1);
      }
    } catch {
      // fallback
    }
    setCalendarModalVisible(true);
  };

  const handleSelectCalendarDate = (day: number) => {
    const y = calendarYear;
    const m = String(calendarMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    const formatted = `${y}-${m}-${d}`;

    if (calendarTarget === "quote") {
      setQuoteDate(formatted);
    } else {
      setValidityDate(formatted);
    }
    setCalendarModalVisible(false);
  };

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
    return { daysInMonth, firstDayIndex };
  }, [calendarYear, calendarMonth]);

  // Submit Changes
  const handleSubmitQuotation = async () => {
    const targetId = quotationId ?? storedQuotationId;
    if (!targetId) {
      Alert.alert("Error", "Missing Quotation ID.");
      return;
    }

    if (!selectedCustomerItem?.id) {
      Alert.alert("Validation", "Please select a Customer.");
      return;
    }

    if (!selectedSiteItem?.id) {
      Alert.alert("Validation", "Please select a Delivery Site.");
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.mix_design_id) {
        Alert.alert(
          "Validation",
          `Please select a Product or Mix Design for Product #${i + 1}.`,
        );
        return;
      }
      const qtyNum = parseFloat(item.quantity);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        Alert.alert(
          "Validation",
          `Please enter a valid Quantity for Product #${i + 1}.`,
        );
        return;
      }
      const rateNum = parseFloat(item.rate);
      if (isNaN(rateNum) || rateNum <= 0) {
        Alert.alert(
          "Validation",
          `Please enter a valid Rate for Product #${i + 1}.`,
        );
        return;
      }
    }

    setIsSubmitting(true);

    const payload = {
      patron_id: Number(selectedCustomerItem.id),
      site_id: Number(selectedSiteItem.id),
      sales_executive_id: selectedSalesExecutiveItem?.id
        ? Number(selectedSalesExecutiveItem.id)
        : null,
      quote_date: quoteDate,
      validity_date: validityDate,
      is_tax_inclusive: isTaxInclusive,
      notes: notes.trim(),
      concrete_pump: items[0]?.concrete_pump || null,
      pump_rate: parseFloat(items[0]?.pump_rate || "0") || 0,
      adjustment: parseFloat(adjustment) || 0,
      items: items.map((it) => ({
        mix_design_id: it.mix_design_id ? Number(it.mix_design_id) : null,
        quantity: Number(parseFloat(it.quantity).toFixed(2)),
        rate: Number(parseFloat(it.rate).toFixed(2)),
        tax_id:
          it.tax_id !== null && it.tax_id !== undefined
            ? Number(it.tax_id)
            : null,
        concrete_pump: it.concrete_pump || null,
        pump_rate: parseFloat(it.pump_rate || "0") || 0,
      })),
    };

    console.log("[EditQuotationScreen] Submitting Payload:", payload);

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
    if (effectivePlantId !== null && effectivePlantId !== undefined) {
      headers["X-Plant-Id"] = String(effectivePlantId);
    }

    try {
      await axios.put(`${baseURL}/quotations/${targetId}`, payload, {
        headers,
      });

      Alert.alert(
        "Success",
        "Quotation updated successfully!",
        [
          {
            text: "OK",
            onPress: () => {
              if (onSuccess) onSuccess();
              router.replace("/quotation");
            },
          },
        ],
        { cancelable: false },
      );
    } catch (err: any) {
      console.log("Error updating quotation:", err?.message || err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Could not update quotation. Please check your connection and try again.";

      Alert.alert("Update Failed", errMsg, [{ text: "OK" }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#063b89"
        translucent={false}
      />

      {/* HEADER SECTION WITH LINEAR GRADIENT & ISOMETRIC BADGE */}
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
            <Text style={styles.headerTitle}>Edit Quotation</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {quotationReference
                ? `${quotationReference} · Commercial Quote`
                : "Commercial Quote"}
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

      {loadingDetail ? (
        <View style={styles.centeredLoadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={{ marginTop: 12, color: "#64748B", fontSize: 13 }}>
            Loading Quotation Details...
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.container}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingBottom:
                  styles.scrollContent.paddingBottom +
                  (Platform.OS === "android"
                    ? keyboardPadding
                    : keyboardPadding > 0
                      ? 40
                      : 0),
              },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {loadingDropdowns && (
              <View style={styles.loadingBanner}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.loadingBannerText}>
                  Loading master data...
                </Text>
              </View>
            )}

            {/* ========================================================================= */}
            {/* CARD 1: QUOTATION INFORMATION (EXACT UI MATCH) */}
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
                <Text style={styles.cardHeaderTitle}>
                  Quotation Information
                </Text>
              </View>

              {/* 2-Column Fields Grid */}
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
                        !selectedCustomerItem && styles.dropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedCustomerItem?.legal_name || "Select Customer"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Delivery Site */}
                <View style={styles.gridCol}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color="#4F46E5"
                    />
                    <Text style={styles.fieldLabel}>
                      Delivery Site{" "}
                      <Text style={styles.requiredAsterisk}>*</Text>
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
                        !selectedSiteItem && styles.dropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSiteItem?.name || "Select Delivery Site"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 2: Sales Executive & Validity Date */}
              <View style={[styles.gridRow, { marginTop: 12 }]}>
                {/* Sales Executive */}
                <View style={styles.gridCol}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons
                      name="briefcase-outline"
                      size={14}
                      color="#4F46E5"
                    />
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
                        !selectedSalesExecutiveItem &&
                          styles.dropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSalesExecutiveItem
                        ? cleanSalesExecutiveName(
                            selectedSalesExecutiveItem.label,
                          )
                        : "Select Sales Executive"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Validity Date */}
                <View style={styles.gridCol}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color="#4F46E5"
                    />
                    <Text style={styles.fieldLabel}>
                      Validity Date{" "}
                      <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => openCalendar("validity")}
                    activeOpacity={0.75}
                  >
                    <View style={styles.dateIconWrapper}>
                      <Ionicons name="calendar" size={14} color="#4F46E5" />
                    </View>
                    <Text style={styles.datePickerBtnText} numberOfLines={1}>
                      {formatDisplayDate(validityDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
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

              {items.map((item, index) => {
                const itemNumberStr = String(index + 1).padStart(2, "0");
                return (
                  <View
                    key={item.id}
                    style={styles.productCard}
                    onLayout={(e) => {
                      productYRefs.current[index] = e.nativeEvent.layout.y;
                    }}
                  >
                    {/* Top Bar inside Product Card */}
                    <View style={styles.productCardTopBar}>
                      <View style={styles.productCardBadgeRow}>
                        <View style={styles.productNumberBadge}>
                          <Text style={styles.productNumberBadgeText}>
                            {itemNumberStr}
                          </Text>
                        </View>
                        <Text style={styles.productCardTitle}>
                          Concrete Product
                        </Text>
                      </View>

                      {items.length > 1 && (
                        <TouchableOpacity
                          onPress={() => handleRemoveItem(index)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={17}
                            color="#DC2626"
                          />
                        </TouchableOpacity>
                      )}
                    </View>

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
                          {item.mix_design_name ||
                            "Select Product or Mix Design"}
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color="#64748B"
                        />
                      </TouchableOpacity>
                    </View>

                    {/* 2. 2-Col: Quantity & Rate */}
                    <View style={styles.gridRow}>
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
                          onChangeText={(val) =>
                            handleUpdateItem(index, "quantity", val)
                          }
                          onFocus={() => handleInputFocus(`product_${index}`)}
                          onBlur={handleInputBlur}
                          placeholder="0"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

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
                          onChangeText={(val) =>
                            handleUpdateItem(index, "rate", val)
                          }
                          onFocus={() => handleInputFocus(`product_${index}`)}
                          onBlur={handleInputBlur}
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
                        <Text
                          style={styles.dropdownInputText}
                          numberOfLines={1}
                        >
                          {item.tax_name || "GST 18% (Sales)"}
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color="#64748B"
                        />
                      </TouchableOpacity>
                    </View>

                    {/* 4. 2-Col: Pump Type & Pump Rate */}
                    <View style={[styles.gridRow, { marginTop: 12 }]}>
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
                            {formatPumpType(item.concrete_pump) ||
                              "Select Pump Type"}
                          </Text>
                          <Ionicons
                            name="chevron-down"
                            size={16}
                            color="#64748B"
                          />
                        </TouchableOpacity>
                      </View>

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
                          onChangeText={(val) =>
                            handleUpdateItem(index, "pump_rate", val)
                          }
                          onFocus={() => handleInputFocus(`product_${index}`)}
                          onBlur={handleInputBlur}
                          placeholder="0"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>

                    {/* Calculations Strip inside Product Card */}
                    <View style={styles.calcStrip}>
                      <View style={styles.calcStripItem}>
                        <Text style={styles.calcStripLabel}>
                          Material Untaxed
                        </Text>
                        <Text style={styles.calcStripValue}>
                          ₹
                          {formatAmountWithDecimals(
                            item.calculation.materialUntaxed ||
                              item.calculation.untaxedAmount,
                          )}
                        </Text>
                      </View>

                      <View style={styles.calcStripItem}>
                        <Text style={styles.calcStripLabel}>
                          Tax ({item.tax_rate}%)
                        </Text>
                        <Text style={styles.calcStripValue}>
                          ₹
                          {formatAmountWithDecimals(item.calculation.taxAmount)}
                        </Text>
                      </View>

                      <View style={styles.calcItemTotalBox}>
                        <Text style={styles.calcItemTotalLabel}>
                          Item Total
                        </Text>
                        <Text style={styles.calcItemTotalValue}>
                          ₹
                          {formatAmountWithDecimals(
                            item.calculation.amountTotal,
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* "+ Add another product" Dashed Button */}
              <TouchableOpacity
                style={styles.addProductDashedBtn}
                onPress={handleAddItem}
                activeOpacity={0.75}
              >
                <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
                <Text style={styles.addProductDashedBtnText}>
                  Add another product
                </Text>
              </TouchableOpacity>

              {/* "Tax inclusive rate" Row */}
              <TouchableOpacity
                style={styles.taxInclusiveRow}
                onPress={toggleTaxInclusive}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isTaxInclusive ? "checkbox" : "square-outline"}
                  size={20}
                  color={isTaxInclusive ? "#2563EB" : "#94A3B8"}
                />
                <Text style={styles.taxInclusiveText}>Tax inclusive rate</Text>
              </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* CARD 3: TERMS / NOTES (EXACT UI MATCH) */}
            {/* ========================================================================= */}
            <View
              style={styles.cardContainer}
              onLayout={(e) => {
                notesYRef.current = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.cardHeaderRow}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color="#4F46E5"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.cardHeaderTitle}>Terms / Notes</Text>
              </View>

              <TextInput
                style={styles.notesTextInput}
                multiline
                value={notes}
                onChangeText={setNotes}
                onFocus={() => handleInputFocus("notes")}
                onBlur={handleInputBlur}
                placeholder="Delivery subject to schedule confirmation"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* ========================================================================= */}
            {/* CARD 4: TOTAL ESTIMATE (EXACT UI MATCH) */}
            {/* ========================================================================= */}
            <View
              style={styles.cardContainer}
              onLayout={(e) => {
                estimateYRef.current = e.nativeEvent.layout.y;
              }}
            >
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
                    Untaxed: ₹
                    {formatAmountWithDecimals(totalSummary.untaxedAmount)} ·
                    Tax: ₹{formatAmountWithDecimals(totalSummary.taxAmount)}
                  </Text>
                </View>

                <View style={styles.estimateBadge}>
                  <Text style={styles.estimateBadgeText}>
                    ₹{formatAmountWithDecimals(totalSummary.amountTotal)}
                  </Text>
                </View>
              </View>

              {/* Adjustment Row */}
              <View style={styles.adjustmentRow}>
                <View style={styles.fieldLabelRow}>
                  <Ionicons name="create-outline" size={14} color="#4F46E5" />
                  <Text style={styles.fieldLabel}>Adjustment in ₹</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  value={adjustment}
                  onChangeText={handleAdjustmentChange}
                  onFocus={() => handleInputFocus("adjustment")}
                  onBlur={handleInputBlur}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Blue Banner Summary Formula */}
              <View style={styles.summaryFormulaBanner}>
                <MaterialCommunityIcons
                  name="cash-multiple"
                  size={18}
                  color="#1D4ED8"
                />
                <Text style={styles.summaryFormulaText} numberOfLines={1}>
                  Amount: ₹
                  {formatAmountWithDecimals(totalSummary.itemsAmountTotal)} +
                  Adjust: ₹{formatAmountWithDecimals(totalSummary.adjustment)} =
                  ₹{formatAmountWithDecimals(totalSummary.amountTotal)}
                </Text>
              </View>

              {/* Commercial Quote Footnote */}
              <Text style={styles.estimateFootnote}>
                Commercial quote estimate · Ready for plant dispatch
              </Text>
            </View>

            {/* ========================================================================= */}
            {/* PRIMARY UPDATE ACTION BUTTON */}
            {/* ========================================================================= */}
            <TouchableOpacity
              style={styles.primarySubmitBtn}
              onPress={handleSubmitQuotation}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="paper-plane-outline"
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.primarySubmitBtnText}>
                    Update Quotation
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleBack}
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
                item.id !== null ? String(item.id) : `null-${index}`
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
        visible={calendarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCalendarModalVisible(false)}
        >
          <View
            style={styles.calendarModalContent}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.calendarModalHeader}>
              <Text style={styles.calendarModalTitle}>
                {calendarTarget === "quote"
                  ? "Select Quotation Date"
                  : "Select Validity Date"}
              </Text>
              <TouchableOpacity
                onPress={() => setCalendarModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Month / Year Navigator */}
            <View style={styles.calendarMonthRow}>
              <TouchableOpacity
                onPress={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11);
                    setCalendarYear((y) => y - 1);
                  } else {
                    setCalendarMonth((m) => m - 1);
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={20} color="#0F172A" />
              </TouchableOpacity>

              <Text style={styles.calendarMonthText}>
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
                  ][calendarMonth]
                }{" "}
                {calendarYear}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0);
                    setCalendarYear((y) => y + 1);
                  } else {
                    setCalendarMonth((m) => m + 1);
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
              {Array.from({ length: calendarDays.daysInMonth }).map(
                (_, idx) => {
                  const dayNum = idx + 1;
                  const mStr = String(calendarMonth + 1).padStart(2, "0");
                  const dStr = String(dayNum).padStart(2, "0");
                  const thisDateStr = `${calendarYear}-${mStr}-${dStr}`;
                  const isSelected =
                    calendarTarget === "quote"
                      ? quoteDate === thisDateStr
                      : validityDate === thisDateStr;

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
                },
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// STYLES (EXACT 1:1 REPLICATION OF IMAGE)
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
  centeredLoadingContainer: {
    flex: 1,
    backgroundColor: "#F3F7FB",
    justifyContent: "center",
    alignItems: "center",
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
  adjustmentRow: {
    marginBottom: 12,
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
    flex: 1,
  },
  estimateFootnote: {
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
    marginTop: 8,
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

  // Loading Banner
  loadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    padding: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  loadingBannerText: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "500",
    flex: 1,
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
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  pickerItemLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  pickerItemLabelActive: {
    color: "#2563EB",
    fontWeight: "700",
  },
  pickerItemSubLabel: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },

  // Calendar Modal
  calendarModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  calendarModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    marginBottom: 12,
  },
  calendarMonthText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  calendarWeekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  calendarWeekdayText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    width: 38,
    textAlign: "center",
  },
  calendarDaysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  calendarDayCell: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 19,
    marginVertical: 2,
  },
  calendarDayCellSelected: {
    backgroundColor: "#2563EB",
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  calendarDayTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
