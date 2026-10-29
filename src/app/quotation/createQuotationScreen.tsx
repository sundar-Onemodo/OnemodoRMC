import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "axios";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import {
  CustomerDropdownItem,
  MixDesignDropdownItem,
  SalesExecutiveDropdownItem,
  setCustomers,
  setMixDesigns,
  setSalesExecutives,
  setSelectedCustomer,
  setSelectedSalesExecutive,
  setSelectedSite,
  setSites,
  setTaxes,
  SiteDropdownItem,
  TaxDropdownItem,
} from "@/store/quotationSlice";
import { RootState } from "@/store/store";
import {
  calculateLineItemTotals,
  LineItemCalculationResult,
} from "./quotationCalculation";

// ==========================================
// FORM LINE ITEM INTERFACE
// ==========================================

export interface FormLineItem {
  id: string;
  mix_design_id: number | string | null;
  mix_design_name: string;
  quantity: string;
  rate: string;
  tax_id: number | null;
  tax_name: string;
  tax_rate: number;
  calculation: LineItemCalculationResult;
}

export interface CreateQuotationScreenProps {
  onBack?: () => void;
  onSuccess?: () => void;
}

// ==========================================
// HELPER FOR INITIAL DATE STRINGS
// ==========================================

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

export function cleanSalesExecutiveName(rawName?: string | null): string {
  if (!rawName) return "";
  return rawName.replace(/\s*\([^)]*\)\s*$/, "").trim();
};

// ==========================================
// MAIN COMPONENT: CREATE QUOTATION SCREEN
// ==========================================

export default function CreateQuotationScreen({
  onBack,
  onSuccess,
}: CreateQuotationScreenProps = {}) {
  const dispatch = useDispatch();
  const { token, plant_id } = useSelector((state: RootState) => state.auth);

  // Route Params from Lead Screen
  const params = useLocalSearchParams<{
    fromLead?: string;
    returnTo?: string;
    timestamp?: string;
    leadId?: string;
    leadNumber?: string;
    customerName?: string;
    deliveryLocation?: string;
    contactName?: string;
    companyName?: string;
    phone?: string;
    email?: string;
    address?: string;
    customerId?: string;
    projectName?: string;
    requirement?: string;
    estimatedQuantity?: string;
    expectedValue?: string;
    mixDesignId?: string;
    mixDesignName?: string;
    remarks?: string;
    leadData?: string;
  }>();

  const isFromLead = params.fromLead === "true" || params.returnTo === "/lead";

  const passedLead = useMemo(() => {
    if (!params.leadData) return null;
    try {
      return JSON.parse(params.leadData);
    } catch {
      return null;
    }
  }, [params.leadData]);

  const lastLoggedTimestampRef = useRef<string | null>(null);

  // Log incoming parameters & entire lead payload on screen load (once per navigation)
  useEffect(() => {
    if (
      isFromLead &&
      params.timestamp &&
      params.timestamp !== lastLoggedTimestampRef.current
    ) {
      lastLoggedTimestampRef.current = params.timestamp;
      console.log(
        "[CreateQuotationScreen] Received route params from Lead screen (timestamp: " +
          params.timestamp +
          ", leadId: " +
          (params.leadId || "N/A") +
          ")",
      );
      if (passedLead) {
        console.log(
          "[CreateQuotationScreen] Entire lead data payload:",
          passedLead,
        );
      }
    }
  }, [isFromLead, params.timestamp, params.leadId, passedLead]);

  // Redux state for dropdown caches
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

  // Form State
  const [selectedCustomerItem, setSelectedCustomerItem] =
    useState<CustomerDropdownItem | null>(null);
  const [selectedSiteItem, setSelectedSiteItem] =
    useState<SiteDropdownItem | null>(null);
  const [selectedSalesExecutiveItem, setSelectedSalesExecutiveItem] =
    useState<SalesExecutiveDropdownItem | null>(null);
  const [quoteDate, setQuoteDate] = useState<string>(getTodayDateString());
  const [validityDate, setValidityDate] = useState<string>(
    getFutureDateString(15),
  );
  const [isTaxInclusive, setIsTaxInclusive] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>(
    "Delivery subject to schedule confirmation",
  );
  const [items, setItems] = useState<FormLineItem[]>([
    {
      id: "item-1",
      mix_design_id: null,
      mix_design_name: "",
      quantity: "6",
      rate: "5000",
      tax_id: null,
      tax_name: "GST 18% (Sales)",
      tax_rate: 18,
      calculation: calculateLineItemTotals({
        quantity: 6,
        rate: 5000,
        pump_rate: 0,
        taxRate: 18,
        isTaxInclusive: false,
      }),
    },
  ]);

  const lastSyncedKeyRef = useRef<string | null>(null);

  // Re-synchronize and refresh form state whenever params change or screen gains focus (prevents stale cached data)
  const syncFormWithParams = useCallback(
    (
      custs: CustomerDropdownItem[] = cachedCustomers,
      stList: SiteDropdownItem[] = cachedSites,
      mixes: MixDesignDropdownItem[] = cachedMixDesigns,
      txList: TaxDropdownItem[] = cachedTaxes,
      salesExecs: SalesExecutiveDropdownItem[] = cachedSalesExecutives,
      force = false,
    ) => {
      const syncKey = `${params.timestamp || ""}_${params.leadId || ""}_${custs.length}_${stList.length}_${mixes.length}_${salesExecs.length}`;
      if (!force && syncKey === lastSyncedKeyRef.current) {
        return;
      }
      lastSyncedKeyRef.current = syncKey;

      setQuoteDate(getTodayDateString());
      setValidityDate(getFutureDateString(15));
      setIsTaxInclusive(false);

      if (salesExecs.length > 0) {
        setSelectedSalesExecutiveItem((prev) => prev || salesExecs[0]);
      }

      if (isFromLead) {
        // 1. Customer
        const leadCustId =
          params.customerId && !isNaN(Number(params.customerId))
            ? Number(params.customerId)
            : passedLead?.customer_id
              ? Number(passedLead.customer_id)
              : null;
        const leadCustName = (
          params.customerName ||
          params.companyName ||
          params.contactName ||
          passedLead?.company_name ||
          passedLead?.contact_name ||
          ""
        )
          .trim()
          .toLowerCase();

        let matchedCust: CustomerDropdownItem | null = null;
        if (leadCustId && leadCustId > 0 && custs.length > 0) {
          matchedCust =
            custs.find((c: any) => Number(c.id) === leadCustId) || null;
        }
        if (!matchedCust && leadCustName && custs.length > 0) {
          matchedCust =
            custs.find((c: any) => {
              const cName = (c.legal_name || (c as any).name || "")
                .trim()
                .toLowerCase();
              return (
                cName === leadCustName ||
                cName.includes(leadCustName) ||
                leadCustName.includes(cName)
              );
            }) || null;
        }

        const effectiveCust: CustomerDropdownItem = matchedCust || {
          id: leadCustId && leadCustId > 0 ? leadCustId : custs[0]?.id || 1,
          legal_name:
            params.customerName ||
            params.companyName ||
            params.contactName ||
            passedLead?.company_name ||
            passedLead?.contact_name ||
            "Lead Customer",
        };
        setSelectedCustomerItem(effectiveCust);

        // 2. Site
        const leadDeliveryLoc = (
          params.deliveryLocation ||
          params.address ||
          passedLead?.delivery_location ||
          passedLead?.address ||
          ""
        )
          .trim()
          .toLowerCase();

        let matchedSite: SiteDropdownItem | null = null;
        if (leadDeliveryLoc && stList.length > 0) {
          matchedSite =
            stList.find((s: any) => {
              const sName = (s.name || "").trim().toLowerCase();
              const sAddr = (s.site_address_1 || "").trim().toLowerCase();
              return (
                sName === leadDeliveryLoc ||
                sName.includes(leadDeliveryLoc) ||
                leadDeliveryLoc.includes(sName) ||
                (sAddr && sAddr.includes(leadDeliveryLoc))
              );
            }) || null;
        }

        if (!matchedSite && matchedCust && stList.length > 0) {
          matchedSite =
            stList.find((s: any) =>
              Array.isArray(s.patron_id)
                ? s.patron_id.includes(matchedCust!.id)
                : s.patron_id === matchedCust!.id,
            ) || null;
        }

        const effectiveSite: SiteDropdownItem = matchedSite || {
          id: stList[0]?.id || 1,
          name:
            params.deliveryLocation ||
            params.address ||
            passedLead?.delivery_location ||
            passedLead?.address ||
            "Lead Delivery Site",
          site_address_1:
            params.address ||
            params.deliveryLocation ||
            passedLead?.address ||
            passedLead?.delivery_location ||
            null,
        };
        setSelectedSiteItem(effectiveSite);

        // 3. Notes
        const noteProject = params.projectName || passedLead?.project_name;
        const noteRemarks = params.remarks || passedLead?.remarks;
        if (noteProject || noteRemarks) {
          const parts = [
            noteProject ? `Project: ${noteProject}` : "",
            noteRemarks ? `Remarks: ${noteRemarks}` : "",
          ].filter(Boolean);
          setNotes(parts.join(" | "));
        } else {
          setNotes("Delivery subject to schedule confirmation");
        }

        // 4. Mix & Line Items
        const leadMixId =
          params.mixDesignId && !isNaN(Number(params.mixDesignId))
            ? Number(params.mixDesignId)
            : passedLead?.mix_design_id
              ? Number(passedLead.mix_design_id)
              : null;
        const leadMixName = (
          params.mixDesignName ||
          params.requirement ||
          passedLead?.requirement ||
          ""
        )
          .trim()
          .toLowerCase();

        let matchedMix: any = null;
        if (leadMixId && leadMixId > 0 && mixes.length > 0) {
          matchedMix = mixes.find((m: any) => Number(m.id) === leadMixId);
        }
        if (!matchedMix && leadMixName && mixes.length > 0) {
          matchedMix = mixes.find((m: any) => {
            const mName = (m.design_name || m.name || m.code || "")
              .trim()
              .toLowerCase();
            return (
              mName === leadMixName ||
              mName.includes(leadMixName) ||
              leadMixName.includes(mName)
            );
          });
        }

        const chosenMix = matchedMix || mixes[0] || null;
        const defaultTax =
          txList.find(
            (t: any) =>
              String(t.tax_name).includes("18%") ||
              Number(t.rate || t.tax_rate) === 18,
          ) ||
          txList[0] ||
          null;

        const initialRate = chosenMix
          ? parseFloat(chosenMix.rate_per_qty || "0") > 0
            ? String(parseFloat(chosenMix.rate_per_qty || "0"))
            : "5000"
          : "5000";

        const leadQty =
          params.estimatedQuantity && parseFloat(params.estimatedQuantity) > 0
            ? String(parseFloat(params.estimatedQuantity))
            : "6";

        const taxRate = defaultTax
          ? Number(defaultTax.rate || defaultTax.tax_rate || 18)
          : 18;

        setItems([
          {
            id: "item-1",
            mix_design_id: chosenMix ? chosenMix.id : leadMixId,
            mix_design_name:
              chosenMix?.design_name ||
              chosenMix?.name ||
              params.mixDesignName ||
              "Concrete Mix",
            quantity: leadQty,
            rate: initialRate,
            tax_id: defaultTax ? defaultTax.id : null,
            tax_name:
              defaultTax?.tax_name || defaultTax?.name || "GST 18% (Sales)",
            tax_rate: taxRate,
            calculation: calculateLineItemTotals({
              quantity: parseFloat(leadQty) || 6,
              rate: parseFloat(initialRate) || 5000,
              pump_rate: 0,
              taxRate: taxRate,
              isTaxInclusive: false,
            }),
          },
        ]);
      } else {
        // Not from lead: reset to fresh blank quotation
        if (custs.length > 0) {
          const defaultCust = custs[0];
          setSelectedCustomerItem(defaultCust);

          const matchingSite = stList.find((s: any) =>
            Array.isArray(s.patron_id)
              ? s.patron_id.includes(defaultCust.id)
              : s.patron_id === defaultCust.id,
          );
          const defaultSite = matchingSite || stList[0] || null;
          setSelectedSiteItem(defaultSite);
        } else {
          setSelectedCustomerItem(null);
          setSelectedSiteItem(null);
        }

        setNotes("Delivery subject to schedule confirmation");

        if (mixes.length > 0) {
          const firstMix = mixes[0];
          const defaultTax =
            txList.find(
              (t: any) =>
                String(t.tax_name).includes("18%") ||
                Number(t.rate || t.tax_rate) === 18,
            ) || txList[0];

          const initialRate =
            parseFloat(firstMix.rate_per_qty || "0") > 0
              ? String(parseFloat(firstMix.rate_per_qty || "0"))
              : "5000";

          setItems([
            {
              id: "item-1",
              mix_design_id: firstMix.id,
              mix_design_name: firstMix.design_name || firstMix.name || "",
              quantity: "6",
              rate: initialRate,
              tax_id: defaultTax ? defaultTax.id : null,
              tax_name: defaultTax?.tax_name || defaultTax?.name || "GST 18%",
              tax_rate: Number(defaultTax?.rate || defaultTax?.tax_rate || 18),
              calculation: calculateLineItemTotals({
                quantity: 6,
                rate: parseFloat(initialRate) || 5000,
                pump_rate: 0,
                taxRate: Number(defaultTax?.rate || defaultTax?.tax_rate || 18),
                isTaxInclusive: false,
              }),
            },
          ]);
        }
      }
    },
    [
      isFromLead,
      params.customerId,
      params.customerName,
      params.companyName,
      params.contactName,
      params.deliveryLocation,
      params.address,
      params.projectName,
      params.remarks,
      params.mixDesignId,
      params.mixDesignName,
      params.requirement,
      params.estimatedQuantity,
      params.timestamp,
      passedLead,
      cachedCustomers,
      cachedSites,
      cachedMixDesigns,
      cachedTaxes,
      cachedSalesExecutives,
    ],
  );

  // Back navigation directly to origin route (no .back or goBack)
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    if (isFromLead || params.returnTo === "/lead") {
      router.replace("/lead" as any);
      return;
    }
    if (params.returnTo) {
      router.replace(params.returnTo as any);
      return;
    }
    router.replace("/quotation" as any);
  }, [onBack, isFromLead, params.returnTo]);

  // Sync form on mount, on focus, and register hardware back handler
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#0B2A4A");
      }

      syncFormWithParams();

      const onBackPress = () => {
        handleBack();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      return () => subscription.remove();
    }, [handleBack, syncFormWithParams]),
  );

  // Sync form whenever route parameters change
  useEffect(() => {
    syncFormWithParams();
  }, [
    params.leadId,
    params.timestamp,
    params.fromLead,
    params.customerName,
    params.deliveryLocation,
    params.estimatedQuantity,
    passedLead,
    syncFormWithParams,
  ]);

  // Check if master dropdown data is already cached in Redux
  const hasCachedDropdowns =
    cachedCustomers.length > 0 &&
    cachedSites.length > 0 &&
    cachedMixDesigns.length > 0 &&
    cachedSalesExecutives.length > 0;

  // Loading & Submitting State
  const [loadingDropdowns, setLoadingDropdowns] =
    useState<boolean>(!hasCachedDropdowns);
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

  // References to prevent duplicate dropdown fetching and avoid effect dependency loops
  const isFetchingDropdownsRef = useRef(false);
  const syncFormWithParamsRef = useRef(syncFormWithParams);
  syncFormWithParamsRef.current = syncFormWithParams;

  // ==========================================
  // FETCH DROPDOWN APIS ON MOUNT (ONLY IF NOT IN REDUX)
  // ==========================================
  useEffect(() => {
    // If master data is already loaded in Redux, DO NOT fetch from network!
    if (
      cachedCustomers.length > 0 &&
      cachedSites.length > 0 &&
      cachedMixDesigns.length > 0 &&
      cachedSalesExecutives.length > 0
    ) {
      setLoadingDropdowns(false);
      return;
    }

    if (isFetchingDropdownsRef.current) return;
    isFetchingDropdownsRef.current = true;

    let isCancelled = false;
    setLoadingDropdowns(true);

    const loadAllDropdowns = async () => {
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
      if (plant_id !== null && plant_id !== undefined) {
        headers["X-Plant-Id"] = String(plant_id);
      }

      try {
        // 1. Fetch Customers
        const customersPromise = axios
          .get(`${baseURL}/customers`, {
            headers,
            params: { page: 1 },
          })
          .then((res) => {
            const list = res.data?.data?.data || res.data?.data || [];
            if (Array.isArray(list) && list.length > 0) {
              dispatch(setCustomers(list));
              return list;
            }
            return [];
          })
          .catch((err) => {
            console.log("Error loading customers:", err?.message || err);
            return [];
          });

        // 2. Fetch Sites
        const sitesPromise = axios
          .get(`${baseURL}/sites`, {
            headers,
            params: { page: 1 },
          })
          .then((res) => {
            const list = res.data?.data?.data || res.data?.data || [];
            if (Array.isArray(list) && list.length > 0) {
              dispatch(setSites(list));
              return list;
            }
            return [];
          })
          .catch((err) => {
            console.log("Error loading sites:", err?.message || err);
            return [];
          });

        // 3. Fetch Mix Designs
        const mixDesignsPromise = axios
          .get(`${baseURL}/mix-designs`, {
            headers,
            params: { page: 1 },
          })
          .then((res) => {
            const list = res.data?.data?.data || res.data?.data || [];
            if (Array.isArray(list) && list.length > 0) {
              dispatch(setMixDesigns(list));
              return list;
            }
            return [];
          })
          .catch((err) => {
            console.log("Error loading mix designs:", err?.message || err);
            return [];
          });

        // 4. Fetch Taxes (use parent taxes where parent_id is null)
        const taxesPromise = axios
          .get(`${baseURL}/taxes`, {
            headers,
            params: { page: 1 },
          })
          .then((res) => {
            const rawList = res.data?.data?.data || res.data?.data || [];
            if (Array.isArray(rawList) && rawList.length > 0) {
              // Filter parent taxes only
              const parentTaxes = rawList.filter(
                (t: any) => t.parent_id === null || t.parent_id === undefined,
              );
              const result = parentTaxes.length > 0 ? parentTaxes : rawList;
              dispatch(setTaxes(result));
              return result;
            }
            return [];
          })
          .catch((err) => {
            console.log("Error loading taxes:", err?.message || err);
            return [];
          });

        // 5. Fetch Sales Executives
        const salesExecutivesPromise = axios
          .get(`${baseURL}/sales-executives`, {
            headers,
            params: plant_id ? { plant_id } : undefined,
          })
          .then((res) => {
            const list = res.data?.data?.data || res.data?.data || [];
            if (Array.isArray(list) && list.length > 0) {
              dispatch(setSalesExecutives(list));
              return list;
            }
            return [];
          })
          .catch((err) => {
            console.log("Error loading sales executives:", err?.message || err);
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

        if (!isCancelled) {
          syncFormWithParamsRef.current(
            fetchedCustomers,
            fetchedSites,
            fetchedMixes,
            fetchedTaxes,
            fetchedSalesExecs,
            true,
          );
        }
      } finally {
        isFetchingDropdownsRef.current = false;
        if (!isCancelled) {
          setLoadingDropdowns(false);
        }
      }
    };

    loadAllDropdowns();

    return () => {
      isCancelled = true;
    };
  }, [token, plant_id]);

  // ==========================================
  // RE-CALCULATE ALL ITEMS WHEN TAX INCLUSIVE CHANGES
  // ==========================================
  const toggleTaxInclusive = () => {
    const nextVal = !isTaxInclusive;
    setIsTaxInclusive(nextVal);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        calculation: calculateLineItemTotals({
          quantity: parseFloat(item.quantity) || 0,
          rate: parseFloat(item.rate) || 0,
          pump_rate: 0,
          taxRate: item.tax_rate || 0,
          isTaxInclusive: nextVal,
        }),
      })),
    );
  };

  // ==========================================
  // ITEM MANAGEMENT
  // ==========================================
  const handleUpdateItem = (
    index: number,
    field: keyof FormLineItem,
    value: any,
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

      // Re-run the exact calculation function from quotationCalculation.ts
      const qtyNum =
        parseFloat(field === "quantity" ? value : target.quantity) || 0;
      const rateNum = parseFloat(field === "rate" ? value : target.rate) || 0;
      const taxRateNum =
        field === "tax_rate" ? Number(value) : target.tax_rate || 0;

      target.calculation = calculateLineItemTotals({
        quantity: qtyNum,
        rate: rateNum,
        pump_rate: 0,
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
        ? defaultTax.tax_name || defaultTax.name || "GST 18%"
        : "GST 18%",
      tax_rate: defaultTax
        ? Number(defaultTax.rate || defaultTax.tax_rate || 18)
        : 18,
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

  // ==========================================
  // AGGREGATE TOTAL ESTIMATE CALCULATION
  // ==========================================
  const totalSummary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        return {
          grossAmount: acc.grossAmount + item.calculation.grossAmount,
          untaxedAmount: acc.untaxedAmount + item.calculation.untaxedAmount,
          taxAmount: acc.taxAmount + item.calculation.taxAmount,
          amountTotal: acc.amountTotal + item.calculation.amountTotal,
        };
      },
      { grossAmount: 0, untaxedAmount: 0, taxAmount: 0, amountTotal: 0 },
    );
  }, [items]);

  // ==========================================
  // SEARCHABLE PICKER MODAL OPENERS (LIVE API ONLY)
  // ==========================================
  const openCustomerPicker = () => {
    const list = [...cachedCustomers];
    if (
      selectedCustomerItem &&
      !list.some(
        (c) =>
          c.id === selectedCustomerItem.id ||
          c.legal_name === selectedCustomerItem.legal_name,
      )
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
        if (found) {
          dispatch(setSelectedCustomer(found));
          // Filter matching sites
          const relatedSite = cachedSites.find((s) =>
            Array.isArray(s.patron_id)
              ? s.patron_id.includes(found.id)
              : (s.patron_id as any) === found.id,
          );
          if (relatedSite) {
            setSelectedSiteItem(relatedSite);
            dispatch(setSelectedSite(relatedSite));
          }
        }
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const openSitePicker = () => {
    const list = [...cachedSites];
    if (
      selectedSiteItem &&
      !list.some(
        (s) => s.id === selectedSiteItem.id || s.name === selectedSiteItem.name,
      )
    ) {
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
        if (found) dispatch(setSelectedSite(found));
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const openSalesExecutivePicker = () => {
    const list = [...cachedSalesExecutives];
    if (
      selectedSalesExecutiveItem &&
      !list.some((se) => se.id === selectedSalesExecutiveItem.id)
    ) {
      list.unshift(selectedSalesExecutiveItem);
    }

    setPickerConfig({
      title: "Select Sales Executive",
      items: list.map((se) => ({
        id: se.id,
        label: cleanSalesExecutiveName(se.label),
        subLabel: undefined,
      })),
      selectedId: selectedSalesExecutiveItem?.id ?? null,
      onSelect: (item) => {
        const found = list.find((se) => se.id === item.id) || null;
        setSelectedSalesExecutiveItem(found);
        if (found) {
          dispatch(setSelectedSalesExecutive(found));
        }
      },
    });
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const openMixDesignPicker = (itemIndex: number) => {
    const list = cachedMixDesigns;

    setPickerConfig({
      title: "Select Product / Mix Design",
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
          // If rate is currently empty or 0, autofill default rate
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

  // Filtered picker list based on search
  const filteredPickerItems = useMemo(() => {
    if (!pickerSearch.trim()) return pickerConfig.items;
    const q = pickerSearch.trim().toLowerCase();
    return pickerConfig.items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.subLabel && item.subLabel.toLowerCase().includes(q)),
    );
  }, [pickerConfig.items, pickerSearch]);

  // ==========================================
  // CALENDAR MODAL HELPERS
  // ==========================================
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

  // Days in selected calendar month
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 for Sun
    return { daysInMonth, firstDayIndex };
  }, [calendarYear, calendarMonth]);

  // ==========================================
  // SUBMIT QUOTATION TO LIVE API
  // ==========================================
  const handleSubmitQuotation = async () => {
    const customerIdToSubmit =
      selectedCustomerItem?.id ||
      (params.customerId && !isNaN(Number(params.customerId))
        ? Number(params.customerId)
        : null) ||
      (cachedCustomers.length > 0 ? Number(cachedCustomers[0].id) : null);

    if (!customerIdToSubmit) {
      Alert.alert("Validation", "Please select a Customer.");
      return;
    }

    const siteIdToSubmit =
      selectedSiteItem?.id ||
      (cachedSites.length > 0 ? Number(cachedSites[0].id) : null);

    if (!siteIdToSubmit) {
      Alert.alert("Validation", "Please select a Delivery Site.");
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!isFromLead && !item.mix_design_id) {
        Alert.alert(
          "Validation",
          `Please select a Product / Mix Design for Product #${i + 1}.`,
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
      patron_id: Number(customerIdToSubmit),
      site_id: Number(siteIdToSubmit),
      sales_executive_id: selectedSalesExecutiveItem
        ? Number(selectedSalesExecutiveItem.id)
        : cachedSalesExecutives.length > 0
          ? Number(cachedSalesExecutives[0].id)
          : null,
      quote_date: getTodayDateString(),
      validity_date: validityDate,
      is_tax_inclusive: isTaxInclusive,
      notes: notes.trim(),
      items: items.map((it) => {
        const itemObj: Record<string, any> = {
          quantity: Number(parseFloat(it.quantity).toFixed(2)),
          rate: Number(parseFloat(it.rate).toFixed(2)),
          tax_id:
            it.tax_id !== null && it.tax_id !== undefined
              ? Number(it.tax_id)
              : null,
        };
        if (!isFromLead && it.mix_design_id) {
          itemObj.mix_design_id = Number(it.mix_design_id);
        }
        return itemObj;
      }),
    };

    console.log(
      "[CreateQuotationScreen] Submitting quotation payload:",
      JSON.stringify(payload, null, 2),
    );

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
    if (plant_id !== null && plant_id !== undefined) {
      headers["X-Plant-Id"] = String(plant_id);
    }

    try {
      // Create API call
      const isLeadConvert = Boolean(isFromLead && params.leadId);
      const quotationUrl = isLeadConvert
        ? `${baseURL}/leads/${params.leadId}/quotation`
        : `${baseURL}/quotations`;
      const queryParams = isLeadConvert ? { lead: params.leadId } : undefined;

      console.log(`[Create Quotation] POST ${quotationUrl}`, {
        params: queryParams,
        headers,
        payload,
      });

      await axios.post(quotationUrl, payload, {
        headers,
        ...(queryParams ? { params: queryParams } : {}),
      });

      Alert.alert(
        "Success",
        "Quotation created successfully!",
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
      console.log("Error creating quotation:", err?.message || err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Could not create quotation. Please check your network and try again.";

      Alert.alert("Creation Note", errMsg, [{ text: "OK" }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0B2A4A"
        translucent={false}
      />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Add New Quotation</Text>
            <Text style={styles.headerSubtitle}>
              New draft · Number assigned on save
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loadingDropdowns && (
            <View style={styles.loadingBanner}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.loadingBannerText}>
                Loading master data (customers, sites, mix designs, taxes)...
              </Text>
            </View>
          )}

          {/* LEAD INFO BANNER (if navigated from lead) */}
          {isFromLead && (
            <View style={styles.leadInfoBanner}>
              <View style={styles.leadInfoBannerLeft}>
                <View style={styles.leadInfoBannerIcon}>
                  <Ionicons name="document-text" size={20} color="#0D9488" />
                </View>
                <View style={styles.leadInfoBannerTexts}>
                  <View style={styles.leadInfoBannerHeader}>
                    <Text style={styles.leadInfoBannerTitle}>
                      From Lead Screen
                    </Text>
                    {params.leadNumber ? (
                      <View style={styles.leadNumberBadge}>
                        <Text style={styles.leadNumberBadgeText}>
                          {params.leadNumber}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.leadInfoBannerSub} numberOfLines={1}>
                    Customer:{" "}
                    <Text style={styles.leadInfoBannerBold}>
                      {selectedCustomerItem?.legal_name ||
                        params.customerName ||
                        "N/A"}
                    </Text>
                  </Text>
                  {params.deliveryLocation || selectedSiteItem?.name ? (
                    <Text style={styles.leadInfoBannerSub} numberOfLines={1}>
                      Delivery:{" "}
                      <Text style={styles.leadInfoBannerBold}>
                        {selectedSiteItem?.name || params.deliveryLocation}
                      </Text>
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          )}

          {/* 1. CUSTOMER DROPDOWN */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>
                Customer <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              {isFromLead &&
              (selectedCustomerItem?.legal_name || params.customerName) ? (
                <View style={styles.fromLeadBadge}>
                  <Ionicons name="flash" size={11} color="#0D9488" />
                  <Text style={styles.fromLeadBadgeText}>Lead Customer</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={openCustomerPicker}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.dropdownText,
                  !selectedCustomerItem?.legal_name &&
                    !params.customerName &&
                    styles.dropdownPlaceholder,
                ]}
                numberOfLines={1}
              >
                {selectedCustomerItem?.legal_name ||
                  params.customerName ||
                  "Select Customer"}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* 2. DELIVERY SITE DROPDOWN */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>
                Delivery Site <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              {isFromLead &&
              (selectedSiteItem?.name || params.deliveryLocation) ? (
                <View style={styles.fromLeadBadge}>
                  <Ionicons name="location" size={11} color="#0D9488" />
                  <Text style={styles.fromLeadBadgeText}>Lead Location</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={openSitePicker}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.dropdownText,
                  !selectedSiteItem?.name &&
                    !params.deliveryLocation &&
                    styles.dropdownPlaceholder,
                ]}
                numberOfLines={1}
              >
                {selectedSiteItem?.name ||
                  params.deliveryLocation ||
                  "Select Delivery Site"}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* 3. SALES EXECUTIVE DROPDOWN */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Sales Executive</Text>
            </View>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={openSalesExecutivePicker}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.dropdownText,
                  !selectedSalesExecutiveItem && styles.dropdownPlaceholder,
                ]}
                numberOfLines={1}
              >
                {selectedSalesExecutiveItem
                  ? cleanSalesExecutiveName(selectedSalesExecutiveItem.label)
                  : "Select Sales Executive"}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* 4. VALIDITY DATE CALENDAR */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Validity Date <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => openCalendar("validity")}
              activeOpacity={0.75}
            >
              <Ionicons name="calendar-outline" size={16} color="#2563EB" />
              <Text style={styles.datePickerBtnText}>
                {formatDisplayDate(validityDate)}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.productsSectionHeader}>
            <Text style={styles.productsSectionTitle}>
              Products & Concrete Mixes ({items.length})
            </Text>
          </View>

          {items.map((item, index) => {
            return (
              <View key={item.id} style={styles.productCard}>
                {/* Product Header */}
                <View style={styles.productCardHeader}>
                  <View style={styles.productIndexBadge}>
                    <Text style={styles.productIndexText}>#{index + 1}</Text>
                  </View>
                  <Text style={styles.productCardTitle}>
                    {item.mix_design_name || "Concrete Product"}
                  </Text>

                  {items.length > 1 && (
                    <TouchableOpacity
                      style={styles.deleteProductBtn}
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

                {/* Product / Mix Design Dropdown (hidden if fromLead) */}
                {!isFromLead && (
                  <View style={styles.itemFieldGroup}>
                    <Text style={styles.label}>
                      Product or mix design{" "}
                      <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.dropdownButton}
                      onPress={() => openMixDesignPicker(index)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          !item.mix_design_id && styles.dropdownPlaceholder,
                        ]}
                        numberOfLines={1}
                      >
                        {item.mix_design_name || "Select Product or Mix Design"}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Quantity in m³ & Rate in ₹ (Reference Image Side-by-Side) */}
                <View style={styles.rowTwoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>
                      Quantity in m³{" "}
                      <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="decimal-pad"
                      value={item.quantity}
                      onChangeText={(val) =>
                        handleUpdateItem(index, "quantity", val)
                      }
                      placeholder="e.g. 6"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>
                      Rate in ₹ <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="decimal-pad"
                      value={item.rate}
                      onChangeText={(val) =>
                        handleUpdateItem(index, "rate", val)
                      }
                      placeholder="e.g. 5000"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Sales Tax Dropdown */}
                <View style={styles.itemFieldGroup}>
                  <Text style={styles.label}>Sales tax</Text>
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => openTaxPicker(index)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownText} numberOfLines={1}>
                      {item.tax_name || "GST 18%"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Line Item Calculated Subtotal Strip */}
                <View style={styles.lineItemCalcBox}>
                  <View>
                    <Text style={styles.lineItemCalcLabel}>
                      Material Untaxed
                    </Text>
                    <Text style={styles.lineItemCalcValue}>
                      ₹
                      {formatAmountWithDecimals(item.calculation.untaxedAmount)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text style={styles.lineItemCalcLabel}>
                      Tax ({item.tax_rate}%)
                    </Text>
                    <Text style={styles.lineItemCalcValue}>
                      ₹{formatAmountWithDecimals(item.calculation.taxAmount)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.lineItemCalcLabelTotal}>
                      Item Total
                    </Text>
                    <Text style={styles.lineItemCalcValueTotal}>
                      ₹{formatAmountWithDecimals(item.calculation.amountTotal)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* ADD ANOTHER PRODUCT BUTTON */}
          <TouchableOpacity
            style={styles.addProductButton}
            onPress={handleAddItem}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
            <Text style={styles.addProductButtonText}>
              + Add another product
            </Text>
          </TouchableOpacity>

          {/* 5. TAX INCLUSIVE RATE TOGGLE (MATCHES REFERENCE IMAGE) */}
          <TouchableOpacity
            style={styles.taxInclusiveBox}
            onPress={toggleTaxInclusive}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.checkboxBox,
                isTaxInclusive && styles.checkboxBoxChecked,
              ]}
            >
              {isTaxInclusive && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.taxInclusiveText}>Tax inclusive rate</Text>
          </TouchableOpacity>

          {/* 6. TERMS / NOTES */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Terms / notes</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes}
              placeholder="Delivery schedule, special pumping terms, site access..."
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* 7. TOTAL ESTIMATE BOX (MATCHES REFERENCE IMAGE) */}
          <View style={styles.totalEstimateCard}>
            <View style={styles.totalEstimateHeaderRow}>
              <Text style={styles.totalEstimateLabel}>Total estimate</Text>
              <Text style={styles.totalEstimateAmount}>
                ₹{formatAmountWithDecimals(totalSummary.amountTotal)}
              </Text>
            </View>

            <View style={styles.totalEstimateBreakdownRow}>
              <Text style={styles.totalEstimateBreakdownText}>
                Untaxed: ₹{formatAmountWithDecimals(totalSummary.untaxedAmount)}{" "}
                · Tax: ₹{formatAmountWithDecimals(totalSummary.taxAmount)}
              </Text>
            </View>

            <Text style={styles.totalEstimateFooterNote}>
              Commercial quote estimate · Ready for plant dispatch
            </Text>
          </View>

          {/* 8. SUBMIT ACTION BUTTONS (MATCHES REFERENCE IMAGE) */}
          <TouchableOpacity
            style={[
              styles.saveDraftButton,
              isSubmitting && styles.saveDraftButtonDisabled,
            ]}
            onPress={handleSubmitQuotation}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveDraftButtonText}>Save draft</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={pickerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            {/* Modal Title & Close */}
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>{pickerConfig.title}</Text>
              <TouchableOpacity
                style={styles.pickerCloseCircle}
                onPress={() => setPickerModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.pickerSearchBox}>
              <Ionicons name="search" size={17} color="#94A3B8" />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Search..."
                placeholderTextColor="#94A3B8"
                value={pickerSearch}
                onChangeText={setPickerSearch}
                clearButtonMode="while-editing"
                autoFocus
              />
              {pickerSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPickerSearch("")}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Items List */}
            <FlatList
              data={filteredPickerItems}
              keyExtractor={(item) => String(item.id ?? "null-id")}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.id === pickerConfig.selectedId;
                return (
                  <TouchableOpacity
                    style={[
                      styles.pickerItemRow,
                      isSelected && styles.pickerItemRowSelected,
                    ]}
                    onPress={() => {
                      pickerConfig.onSelect(item);
                      setPickerModalVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.pickerItemLabel,
                          isSelected && styles.pickerItemLabelSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.subLabel ? (
                        <Text style={styles.pickerItemSub}>
                          {item.subLabel}
                        </Text>
                      ) : null}
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
                <View style={styles.pickerEmptyContainer}>
                  <Text style={styles.pickerEmptyText}>No matches found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={calendarModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContent}>
            {/* Calendar Header */}
            <View style={styles.calendarModalHeader}>
              <Text style={styles.calendarModalTitle}>
                {calendarTarget === "quote"
                  ? "Select Quote Date"
                  : "Select Validity Date"}
              </Text>
              <TouchableOpacity onPress={() => setCalendarModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigation */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11);
                    setCalendarYear((y) => y - 1);
                  } else {
                    setCalendarMonth((m) => m - 1);
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
                  ][calendarMonth]
                }{" "}
                {calendarYear}
              </Text>

              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0);
                    setCalendarYear((y) => y + 1);
                  } else {
                    setCalendarMonth((m) => m + 1);
                  }
                }}
              >
                <Ionicons name="chevron-forward" size={18} color="#2563EB" />
              </TouchableOpacity>
            </View>

            {/* Quick Presets */}
            {calendarTarget === "validity" && (
              <View style={styles.presetsRow}>
                {[7, 15, 30].map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={styles.presetChip}
                    onPress={() => {
                      setValidityDate(getFutureDateString(days));
                      setCalendarModalVisible(false);
                    }}
                  >
                    <Text style={styles.presetChipText}>+{days} Days</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Day of Week Headers */}
            <View style={styles.dayOfWeekRow}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
                <Text key={i} style={styles.dayOfWeekText}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.daysGrid}>
              {/* Empty leading slots */}
              {Array.from({ length: calendarDays.firstDayIndex }).map(
                (_, index) => (
                  <View key={`empty-${index}`} style={styles.dayCellEmpty} />
                ),
              )}

              {/* Day cells */}
              {Array.from({ length: calendarDays.daysInMonth }).map(
                (_, index) => {
                  const day = index + 1;
                  const currentMonthStr = String(calendarMonth + 1).padStart(
                    2,
                    "0",
                  );
                  const currentDayStr = String(day).padStart(2, "0");
                  const cellDateStr = `${calendarYear}-${currentMonthStr}-${currentDayStr}`;
                  const isSelected =
                    calendarTarget === "quote"
                      ? quoteDate === cellDateStr
                      : validityDate === cellDateStr;

                  return (
                    <TouchableOpacity
                      key={`day-${day}`}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                      ]}
                      onPress={() => handleSelectCalendarDate(day)}
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
    borderBottomWidth: 1,
    borderBottomColor: "#1E3A5F",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },
  loadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  loadingBannerText: {
    flex: 1,
    fontSize: 11,
    color: "#2563EB",
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: 14,
  },
  itemFieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: "#EF4444",
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    flex: 1,
  },
  dropdownPlaceholder: {
    color: "#94A3B8",
    fontWeight: "400",
  },
  rowTwoCol: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
  },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  datePickerBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },

  // Products Section
  productsSectionHeader: {
    marginTop: 6,
    marginBottom: 10,
  },
  productsSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  productCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  productIndexBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  productIndexText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },
  productCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  deleteProductBtn: {
    padding: 4,
  },
  lineItemCalcBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#EEF2F6",
  },
  lineItemCalcLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "500",
  },
  lineItemCalcValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginTop: 1,
  },
  lineItemCalcLabelTotal: {
    fontSize: 10,
    color: "#2563EB",
    fontWeight: "700",
  },
  lineItemCalcValueTotal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
    marginTop: 1,
  },
  addProductButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#2563EB",
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
    marginBottom: 16,
  },
  addProductButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2563EB",
  },

  // Tax Inclusive Checkbox Box (Matches reference image)
  taxInclusiveBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 10,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#64748B",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxBoxChecked: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  taxInclusiveText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563EB",
  },

  // Notes
  notesInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    height: 85,
    textAlignVertical: "top",
    fontSize: 13,
    color: "#0F172A",
  },

  // Total Estimate Card (Matches reference image)
  totalEstimateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  totalEstimateHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  totalEstimateLabel: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  totalEstimateAmount: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },
  totalEstimateBreakdownRow: {
    marginBottom: 6,
  },
  totalEstimateBreakdownText: {
    fontSize: 12,
    color: "#64748B",
  },
  totalEstimateFooterNote: {
    fontSize: 11,
    color: "#94A3B8",
    fontStyle: "italic",
    marginTop: 2,
  },

  // Action Buttons
  saveDraftButton: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  saveDraftButtonDisabled: {
    opacity: 0.7,
  },
  saveDraftButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  cancelButton: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700",
  },

  // Picker Modal Styles
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  pickerModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: "82%",
  },
  pickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pickerModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  pickerCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 10,
    gap: 8,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    paddingVertical: 0,
  },
  pickerItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    borderRadius: 8,
  },
  pickerItemRowSelected: {
    backgroundColor: "#EFF6FF",
  },
  pickerItemLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  pickerItemLabelSelected: {
    color: "#2563EB",
    fontWeight: "700",
  },
  pickerItemSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  pickerEmptyContainer: {
    paddingVertical: 30,
    alignItems: "center",
  },
  pickerEmptyText: {
    fontSize: 13,
    color: "#94A3B8",
  },

  // Calendar Modal Styles
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  calendarModalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  calendarModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  calendarModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  monthNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  monthNavTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  presetsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  dayOfWeekRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  dayOfWeekText: {
    width: 36,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  dayCellEmpty: {
    width: "14.28%",
    height: 36,
  },
  dayCell: {
    width: "14.28%",
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: "#2563EB",
  },
  dayCellText: {
    fontSize: 13,
    color: "#1E293B",
    fontWeight: "600",
  },
  dayCellTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  fromLeadBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#CCFBF1",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fromLeadBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F766E",
  },
  leadInfoBanner: {
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#99F6E4",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  leadInfoBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  leadInfoBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#CCFBF1",
    justifyContent: "center",
    alignItems: "center",
  },
  leadInfoBannerTexts: {
    flex: 1,
  },
  leadInfoBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  leadInfoBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F766E",
  },
  leadNumberBadge: {
    backgroundColor: "#0D9488",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  leadNumberBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  leadInfoBannerSub: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  leadInfoBannerBold: {
    fontWeight: "700",
    color: "#0F172A",
  },
});
