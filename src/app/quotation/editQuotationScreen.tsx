import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import {
  CustomerDropdownItem,
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
} from "@/store/quotationSlice";
import { RootState } from "@/store/store";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  calculation: LineItemCalculationResult;
}

export interface EditQuotationScreenProps {
  quotationId?: string | number;
  onBack?: () => void;
  onSuccess?: () => void;
}

export type CreateQuotationScreenProps = EditQuotationScreenProps;

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

  // console.log("[Router Params] Sales Executive:", {
  //   "params.sales_executive_id": params.sales_executive_id,
  //   "params.salesExecutiveId": params.salesExecutiveId,
  //   "passedQuotation?.sales_executive_id": passedQuotation?.sales_executive_id,
  //   "passedQuotation?.sales_executive": passedQuotation?.sales_executive,
  //   resolved_initialSalesExecId: initialSalesExecId,
  // });

  const [storedQuotationId, setStoredQuotationId] = useState<
    number | string | null
  >(quotationId ?? null);
  const [storedPatronId, setStoredPatronId] = useState<number | null>(() => {
    const pId = passedQuotation?.patron_id ?? passedQuotation?.patron?.id;
    return pId ? Number(pId) : null;
  });
  const [storedSalesExecutiveId, setStoredSalesExecutiveId] = useState<
    number | null
  >(initialSalesExecId);
  const [quotationReference, setQuotationReference] = useState<string>(
    passedQuotation?.reference || "",
  );
  const [loadingDetail, setLoadingDetail] = useState<boolean>(!passedQuotation);

  const { token, plant_id, plant_name, user } = useSelector(
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

  // Form State - initialized from passedQuotation if available
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
          ) ||
          cachedSalesExecutives[0] ||
          null
        );
      }
      if (
        passedQuotation?.sales_executive &&
        typeof passedQuotation.sales_executive === "object" &&
        passedQuotation.sales_executive.label
      ) {
        return {
          id: Number(passedQuotation.sales_executive.id),
          label: passedQuotation.sales_executive.label,
          employee_code: passedQuotation.sales_executive.employee_code,
          plant_id: passedQuotation.sales_executive.plant_id,
        };
      }
      if (cachedSalesExecutives.length > 0) {
        return cachedSalesExecutives[0];
      }
      return null;
    });

  // Dedicated immediate fetch for sales executives so it does not wait for heavy dropdowns
  useEffect(() => {
    if (!token) return;
    let isCancelled = false;

    const fetchSalesExecutivesDirectly = async () => {
      try {
        const cleanToken = token.trim();
        const plantIdNum = effectivePlantId || 6;
        const headers: Record<string, string> = {
          Accept: "application/json",
          Authorization: cleanToken.startsWith("Bearer")
            ? cleanToken
            : `Bearer ${cleanToken}`,
          "X-Plant-Id": String(plantIdNum),
        };

        const res = await axios.get(`${baseURL}/sales-executives`, {
          headers,
          params: { plant_id: String(plantIdNum) },
        });

        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data?.data?.data)
            ? res.data.data.data
            : Array.isArray(res.data)
              ? res.data
              : [];

        if (!isCancelled && list.length > 0) {
          dispatch(setSalesExecutives(list));

          const targetId =
            storedSalesExecutiveId ??
            initialSalesExecId ??
            passedQuotation?.sales_executive_id ??
            passedQuotation?.sales_executive?.id;

          const matched = targetId
            ? list.find((se: any) => Number(se.id) === Number(targetId))
            : null;

          const finalItem = matched || list[0];
          setSelectedSalesExecutiveItem(finalItem);
          dispatch(setSelectedSalesExecutive(finalItem));
          if (finalItem?.id) {
            setStoredSalesExecutiveId(Number(finalItem.id));
          }
        }
      } catch (err: any) {
        console.warn(
          "[EditQuotation] Error fetching sales executives directly:",
          err?.message || err,
        );
      }
    };

    fetchSalesExecutivesDirectly();

    return () => {
      isCancelled = true;
    };
  }, [
    token,
    effectivePlantId,
    storedSalesExecutiveId,
    initialSalesExecId,
    passedQuotation?.sales_executive_id,
    passedQuotation?.sales_executive?.id,
  ]);

  // Synchronize Sales Executive name whenever cachedSalesExecutives or storedSalesExecutiveId updates
  useEffect(() => {
    const targetId =
      storedSalesExecutiveId ??
      initialSalesExecId ??
      passedQuotation?.sales_executive_id ??
      passedQuotation?.sales_executive?.id;
    if (cachedSalesExecutives.length > 0) {
      const matched = targetId
        ? cachedSalesExecutives.find((se) => Number(se.id) === Number(targetId))
        : null;
      const finalItem = matched || cachedSalesExecutives[0];
      if (finalItem) {
        setSelectedSalesExecutiveItem((prev) => prev || finalItem);
        dispatch(setSelectedSalesExecutive(finalItem));
      }
    }
  }, [
    storedSalesExecutiveId,
    initialSalesExecId,
    passedQuotation?.sales_executive_id,
    passedQuotation?.sales_executive?.id,
    cachedSalesExecutives,
  ]);

  const [quoteDate, setQuoteDate] = useState<string>(getTodayDateString());
  const [validityDate, setValidityDate] = useState<string>(
    getFutureDateString(15),
  );
  const [isTaxInclusive, setIsTaxInclusive] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>(
    "Delivery subject to schedule confirmation",
  );

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.replace("/quotation" as any);
    }
  }, [onBack]);

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

  const [loadingDropdowns, setLoadingDropdowns] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  useEffect(() => {
    let isCancelled = false;

    const loadAllDropdowns = async () => {
      setLoadingDropdowns(true);
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
        const queryParams: Record<string, any> = { page: 1 };
        if (effectivePlantId !== null && effectivePlantId !== undefined) {
          queryParams.plant_id = String(effectivePlantId);
        }

        const customersPromise = axios
          .get(`${baseURL}/customers`, {
            headers,
            params: queryParams,
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

        const sitesPromise = axios
          .get(`${baseURL}/sites`, {
            headers,
            params: queryParams,
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

        const mixDesignsPromise = axios
          .get(`${baseURL}/mix-designs`, {
            headers,
            params: queryParams,
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

        const taxesPromise = axios
          .get(`${baseURL}/taxes`, {
            headers,
            params: { page: 1 },
          })
          .then((res) => {
            const rawList = res.data?.data?.data || res.data?.data || [];
            if (Array.isArray(rawList) && rawList.length > 0) {
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

        const salesExecutivesPromise = axios
          .get(`${baseURL}/sales-executives`, {
            headers,
            params: { plant_id: String(effectivePlantId || 6) },
          })
          .then((res) => {
            const list = Array.isArray(res.data?.data)
              ? res.data.data
              : Array.isArray(res.data?.data?.data)
                ? res.data.data.data
                : Array.isArray(res.data)
                  ? res.data
                  : [];
            if (Array.isArray(list) && list.length > 0) {
              dispatch(setSalesExecutives(list));
              const targetSalesExecId =
                storedSalesExecutiveId ??
                initialSalesExecId ??
                passedQuotation?.sales_executive_id ??
                passedQuotation?.sales_executive?.id;
              const matched = targetSalesExecId
                ? list.find(
                    (se: any) => Number(se.id) === Number(targetSalesExecId),
                  )
                : null;
              const finalItem = matched || list[0];
              setSelectedSalesExecutiveItem((prev) => prev || finalItem);
              dispatch(setSelectedSalesExecutive(finalItem));
              if (finalItem?.id) {
                setStoredSalesExecutiveId(
                  (prev) => prev ?? Number(finalItem.id),
                );
              }
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
          // Match Sales Executive based on sales_executive_id (e.g. 1) or fallback to first executive
          if (fetchedSalesExecs.length > 0) {
            const targetSalesExecId =
              storedSalesExecutiveId ??
              initialSalesExecId ??
              passedQuotation?.sales_executive_id ??
              passedQuotation?.sales_executive?.id;
            const matched = targetSalesExecId
              ? fetchedSalesExecs.find(
                  (se: any) => Number(se.id) === Number(targetSalesExecId),
                )
              : null;
            const finalItem = matched || fetchedSalesExecs[0];
            setSelectedSalesExecutiveItem((prev) => prev || finalItem);
            dispatch(setSelectedSalesExecutive(finalItem));
            if (finalItem?.id) {
              setStoredSalesExecutiveId((prev) => prev ?? Number(finalItem.id));
            }
          }

          // Match Customer based on patron_id
          if (fetchedCustomers.length > 0) {
            const targetPatronId =
              passedQuotation?.patron_id ??
              passedQuotation?.patron?.id ??
              storedPatronId;
            if (targetPatronId) {
              const matchedCust = fetchedCustomers.find(
                (c: any) => Number(c.id) === Number(targetPatronId),
              );
              if (matchedCust) {
                setSelectedCustomerItem(matchedCust);
                dispatch(setSelectedCustomer(matchedCust));
              }
            } else {
              const defaultCust = fetchedCustomers[0];
              setSelectedCustomerItem((prev) => {
                if (prev) return prev;
                dispatch(setSelectedCustomer(defaultCust));
                return defaultCust;
              });
            }
          }

          // Match Site based on site_id
          if (fetchedSites.length > 0) {
            const targetSiteId =
              passedQuotation?.site_id ?? passedQuotation?.site?.id;
            if (targetSiteId) {
              const matchedSite = fetchedSites.find(
                (s: any) => Number(s.id) === Number(targetSiteId),
              );
              if (matchedSite) {
                setSelectedSiteItem(matchedSite);
                dispatch(setSelectedSite(matchedSite));
              }
            } else if (fetchedCustomers.length > 0) {
              const defaultCust = fetchedCustomers[0];
              const matchingSite = fetchedSites.find((s: any) =>
                Array.isArray(s.patron_id)
                  ? s.patron_id.includes(defaultCust.id)
                  : s.patron_id === defaultCust.id,
              );
              const defaultSite = matchingSite || fetchedSites[0] || null;
              if (defaultSite) {
                setSelectedSiteItem((prev) => {
                  if (prev) return prev;
                  dispatch(setSelectedSite(defaultSite));
                  return defaultSite;
                });
              }
            }
          }

          if (fetchedMixes.length > 0 && fetchedTaxes.length > 0) {
            setItems((prevItems) => {
              if (
                prevItems.length > 0 &&
                prevItems.some((it) => it.mix_design_id)
              ) {
                return prevItems;
              }
              if (passedQuotation?.items && passedQuotation.items.length > 0) {
                return prevItems;
              }
              const firstMix = fetchedMixes[0];
              const defaultTax =
                fetchedTaxes.find(
                  (t: any) =>
                    String(t.tax_name).includes("18%") ||
                    Number(t.rate || t.tax_rate) === 18,
                ) || fetchedTaxes[0];

              const initialRate =
                parseFloat(firstMix.rate_per_qty || "0") > 0
                  ? String(parseFloat(firstMix.rate_per_qty))
                  : "5000";

              return [
                {
                  id: "item-1",
                  mix_design_id: firstMix.id,
                  mix_design_name: firstMix.design_name || firstMix.name || "",
                  quantity: "6",
                  rate: initialRate,
                  tax_id: defaultTax.id,
                  tax_name: defaultTax.tax_name || defaultTax.name || "GST 18%",
                  tax_rate: Number(
                    defaultTax.rate || defaultTax.tax_rate || 18,
                  ),
                  calculation: calculateLineItemTotals({
                    quantity: 6,
                    rate: parseFloat(initialRate) || 5000,
                    pump_rate: 0,
                    taxRate: Number(
                      defaultTax.rate || defaultTax.tax_rate || 18,
                    ),
                    isTaxInclusive: false,
                  }),
                },
              ];
            });
          }
        }
      } finally {
        if (!isCancelled) {
          setLoadingDropdowns(false);
        }
      }
    };

    loadAllDropdowns();

    return () => {
      isCancelled = true;
    };
  }, [token, plant_id, effectivePlantId, dispatch]);

  useEffect(() => {
    if (!token || !quotationId) {
      return;
    }

    let isCancelled = false;

    const fetchQuotation = async () => {
      try {
        const headers: Record<string, string> = {
          Accept: "application/json",
        };
        const cleanToken = token.trim();
        headers["Authorization"] = cleanToken.startsWith("Bearer")
          ? cleanToken
          : `Bearer ${cleanToken}`;
        if (effectivePlantId !== null && effectivePlantId !== undefined) {
          headers["X-Plant-Id"] = String(effectivePlantId);
        }

        console.log(
          `[QuotationsViewAPI] Fetching quotation details for ID: ${quotationId}`,
        );

        const viewParams: Record<string, any> = {
          quotation: String(quotationId),
        };
        if (effectivePlantId !== null && effectivePlantId !== undefined) {
          viewParams.plant_id = String(effectivePlantId);
        }

        let res;
        try {
          res = await axios.get(`${baseURL}/quotations/${quotationId}`, {
            headers,
            params: viewParams,
          });
        } catch (pathErr: any) {
          if (
            pathErr?.response?.status === 404 ||
            pathErr?.response?.status === 405
          ) {
            console.log(
              "[QuotationsViewAPI] Fallback to ?quotation= parameter",
            );
            res = await axios.get(`${baseURL}/quotations`, {
              params: { ...viewParams, quotation: String(quotationId) },
              headers,
            });
          } else {
            throw pathErr;
          }
        }

        if (isCancelled) return;

        console.log("[QuotationsViewAPI] Raw response:", res?.data);
        const rawApiData = res?.data?.data || res?.data;
        let quoteData = rawApiData;
        if (rawApiData && Array.isArray(rawApiData.data)) {
          quoteData =
            rawApiData.data.find(
              (q: any) => String(q.id) === String(quotationId),
            ) || rawApiData.data[0];
        } else if (Array.isArray(rawApiData)) {
          quoteData =
            rawApiData.find((q: any) => String(q.id) === String(quotationId)) ||
            rawApiData[0];
        }

        if (quoteData) {
          console.log(
            "[QuotationsViewAPI] Successfully loaded quotation data:",
            quoteData,
          );
          if (quoteData.id) {
            setStoredQuotationId(quoteData.id);
          }
          const loadedPatronId = quoteData.patron_id ?? quoteData.patron?.id;
          if (loadedPatronId) {
            setStoredPatronId(Number(loadedPatronId));
          }
          if (quoteData.reference) {
            setQuotationReference(quoteData.reference);
          }

          // 1. Customer
          if (quoteData.patron) {
            const custItem: CustomerDropdownItem = {
              id: quoteData.patron.id,
              legal_name: quoteData.patron.legal_name || "Customer",
            };
            setSelectedCustomerItem(custItem);
            dispatch(setSelectedCustomer(custItem));
          } else if (quoteData.patron_id) {
            const found = cachedCustomers.find(
              (c: any) => Number(c.id) === Number(quoteData.patron_id),
            );
            const custItem: CustomerDropdownItem = found || {
              id: quoteData.patron_id,
              legal_name: "Customer",
            };
            setSelectedCustomerItem(custItem);
            dispatch(setSelectedCustomer(custItem));
          }

          // 2. Site
          if (quoteData.site) {
            const siteItem: SiteDropdownItem = {
              id: quoteData.site.id,
              name: quoteData.site.name || "Site",
              site_address_1: quoteData.site.site_address_1 || null,
            };
            setSelectedSiteItem(siteItem);
            dispatch(setSelectedSite(siteItem));
          } else if (quoteData.site_id) {
            const found = cachedSites.find(
              (s: any) => Number(s.id) === Number(quoteData.site_id),
            );
            const siteItem: SiteDropdownItem = found || {
              id: quoteData.site_id,
              name: "Site",
            };
            setSelectedSiteItem(siteItem);
            dispatch(setSelectedSite(siteItem));
          }

          // Sales Executive
          const loadedSalesExecutiveId =
            quoteData.sales_executive_id ??
            quoteData.sales_executive?.id ??
            (typeof quoteData.sales_executive === "number"
              ? quoteData.sales_executive
              : null) ??
            passedQuotation?.sales_executive_id ??
            initialSalesExecId;

          if (loadedSalesExecutiveId) {
            setStoredSalesExecutiveId(Number(loadedSalesExecutiveId));
          }

          if (
            quoteData.sales_executive &&
            typeof quoteData.sales_executive === "object" &&
            quoteData.sales_executive.label
          ) {
            const seItem: SalesExecutiveDropdownItem = {
              id: Number(quoteData.sales_executive.id),
              label:
                quoteData.sales_executive.label ||
                quoteData.sales_executive.name ||
                "Sales Executive",
              employee_code: quoteData.sales_executive.employee_code,
              plant_id: quoteData.sales_executive.plant_id,
            };
            setSelectedSalesExecutiveItem(seItem);
            dispatch(setSelectedSalesExecutive(seItem));
          } else if (loadedSalesExecutiveId) {
            const targetSeId = Number(loadedSalesExecutiveId);
            const found = cachedSalesExecutives.find(
              (se: any) => Number(se.id) === targetSeId,
            );
            if (found) {
              setSelectedSalesExecutiveItem(found);
              dispatch(setSelectedSalesExecutive(found));
            } else {
              try {
                const seHeaders = {
                  Accept: "application/json",
                  Authorization: cleanToken.startsWith("Bearer")
                    ? cleanToken
                    : `Bearer ${cleanToken}`,
                  "X-Plant-Id": String(effectivePlantId || 6),
                };
                const seRes = await axios.get(`${baseURL}/sales-executives`, {
                  headers: seHeaders,
                  params: { plant_id: String(effectivePlantId || 6) },
                });
                const seList = Array.isArray(seRes.data?.data)
                  ? seRes.data.data
                  : Array.isArray(seRes.data?.data?.data)
                    ? seRes.data.data.data
                    : [];
                if (seList.length > 0) {
                  dispatch(setSalesExecutives(seList));
                  const matchedDirectly = seList.find(
                    (se: any) => Number(se.id) === targetSeId,
                  );
                  const finalSe = matchedDirectly || seList[0];
                  setSelectedSalesExecutiveItem(finalSe);
                  dispatch(setSelectedSalesExecutive(finalSe));
                  if (finalSe?.id) {
                    setStoredSalesExecutiveId(Number(finalSe.id));
                  }
                }
              } catch (seErr) {
                const labelCandidate =
                  quoteData.sales_executive_name ||
                  (typeof quoteData.sales_executive === "string"
                    ? quoteData.sales_executive
                    : "") ||
                  passedQuotation?.sales_executive_name ||
                  passedQuotation?.sales_executive?.label;
                if (labelCandidate) {
                  setSelectedSalesExecutiveItem({
                    id: targetSeId,
                    label: labelCandidate,
                  });
                }
              }
            }
          } else {
            // When quotation has no sales_executive_id, default to plant's primary sales executive
            if (cachedSalesExecutives.length > 0) {
              const defaultSe = cachedSalesExecutives[0];
              setSelectedSalesExecutiveItem((prev) => prev || defaultSe);
              dispatch(setSelectedSalesExecutive(defaultSe));
              if (defaultSe?.id) {
                setStoredSalesExecutiveId(
                  (prev) => prev ?? Number(defaultSe.id),
                );
              }
            }
          }

          // 3. Dates
          if (quoteData.quote_date) {
            setQuoteDate(String(quoteData.quote_date).split("T")[0]);
          }
          if (quoteData.validity_date) {
            setValidityDate(String(quoteData.validity_date).split("T")[0]);
          }

          // 4. Tax Inclusive
          const taxInc = Boolean(quoteData.is_tax_inclusive);
          setIsTaxInclusive(taxInc);

          // 5. Notes
          if (quoteData.notes) {
            setNotes(quoteData.notes);
          }

          // 6. Line Items
          if (Array.isArray(quoteData.items) && quoteData.items.length > 0) {
            const mapped: FormLineItem[] = quoteData.items.map(
              (it: any, idx: number) => {
                const mix = it.mix_design || {};
                const tax = it.tax || {};
                const qty = parseFloat(it.quantity) || 0;
                const rate = parseFloat(it.rate) || 0;
                const taxRate = Number(
                  tax.rate ??
                    tax.tax_rate ??
                    (it.tax_amount && qty && rate
                      ? Math.round(
                          (parseFloat(it.tax_amount) / (qty * rate)) * 100,
                        )
                      : 18),
                );
                return {
                  id: `item-${it.id || idx}`,
                  mix_design_id: it.mix_design_id,
                  mix_design_name:
                    mix.design_name || mix.name || "Concrete Mix",
                  quantity: String(qty),
                  rate: String(rate),
                  tax_id:
                    it.tax_id !== null && it.tax_id !== undefined
                      ? Number(it.tax_id)
                      : null,
                  tax_name:
                    tax.tax_name ||
                    tax.name ||
                    (taxRate > 0 ? `GST ${taxRate}%` : "No Tax (0%)"),
                  tax_rate: taxRate,
                  calculation: calculateLineItemTotals({
                    quantity: qty,
                    rate: rate,
                    pump_rate: 0,
                    taxRate: taxRate,
                    isTaxInclusive: taxInc,
                  }),
                };
              },
            );
            setItems(mapped);
          }
        }
      } catch (error: any) {
        if (!isCancelled) {
          console.log(
            "[QuotationsViewAPI] Error:",
            error?.response?.status,
            error?.response?.data || error?.message,
          );
        }
      } finally {
        if (!isCancelled) {
          setLoadingDetail(false);
        }
      }
    };

    fetchQuotation();

    return () => {
      isCancelled = true;
    };
  }, [
    token,
    plant_id,
    quotationId,
    cachedCustomers,
    cachedSites,
    cachedSalesExecutives,
    dispatch,
  ]);

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

  const handleUpdateItem = (
    index: number,
    field: keyof FormLineItem,
    value: any,
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

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

  const openCustomerPicker = () => {
    const list = cachedCustomers;

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
    const list = cachedSites;

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
      selectedSalesExecutiveItem.id &&
      !list.some((s) => Number(s.id) === Number(selectedSalesExecutiveItem.id))
    ) {
      list.unshift(selectedSalesExecutiveItem);
    }

    setPickerConfig({
      title: "Select Sales Executive",
      items: list.map((s) => ({
        id: s.id,
        label: cleanSalesExecutiveName(s.label),
        subLabel: undefined,
      })),
      selectedId: selectedSalesExecutiveItem?.id ?? null,
      onSelect: (item) => {
        const found =
          list.find((s) => Number(s.id) === Number(item.id)) || null;
        setSelectedSalesExecutiveItem(found);
        if (found) {
          setStoredSalesExecutiveId(Number(found.id));
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

  // Days in selected calendar month
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 for Sun
    return { daysInMonth, firstDayIndex };
  }, [calendarYear, calendarMonth]);

  const handleSubmitQuotation = async () => {
    if (!selectedCustomerItem?.id) {
      Alert.alert("Validation", "Please select a Customer.");
      return;
    }
    if (!selectedSiteItem?.id) {
      Alert.alert("Validation", "Please select a Delivery Site.");
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.mix_design_id) {
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

    const activeQuotationId =
      passedQuotation?.id ?? storedQuotationId ?? quotationId;
    const activePatronId = selectedCustomerItem?.id ?? storedPatronId;

    const payload = {
      id: Number(activeQuotationId),
      quotation_id: Number(activeQuotationId),
      quotation: Number(activeQuotationId),
      patron_id: Number(activePatronId),
      site_id: selectedSiteItem ? Number(selectedSiteItem.id) : null,
      sales_executive_id: selectedSalesExecutiveItem?.id
        ? Number(selectedSalesExecutiveItem.id)
        : (storedSalesExecutiveId ??
          initialSalesExecId ??
          (passedQuotation?.sales_executive_id
            ? Number(passedQuotation.sales_executive_id)
            : null)),
      quote_date: quoteDate || getTodayDateString(),
      validity_date: validityDate,
      is_tax_inclusive: isTaxInclusive ? 1 : 0,
      notes: notes.trim(),
      plant_id: effectivePlantId ? Number(effectivePlantId) : undefined,
      items: items.map((it) => ({
        mix_design_id: Number(it.mix_design_id),
        quantity: Number(parseFloat(it.quantity).toFixed(2)),
        rate: Number(parseFloat(it.rate).toFixed(2)),
        tax_id:
          it.tax_id !== null && it.tax_id !== undefined
            ? Number(it.tax_id)
            : null,
      })),
    };

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

    const params: Record<string, any> = {};
    if (activeQuotationId !== null && activeQuotationId !== undefined) {
      params.quotation = String(activeQuotationId);
    }
    // if (effectivePlantId !== null && effectivePlantId !== undefined) {
    //   params.plant_id = String(effectivePlantId);
    // }

    try {
      console.log(
        `[Update Quotation] PUT ${baseURL}/quotations/${activeQuotationId} with payload:`,
        payload,
      );
      console.log(
        "[Update Quotation] Headers:",
        JSON.stringify(headers, null, 2),
      );
      console.log(
        "[Update Quotation] Params:",
        JSON.stringify(params, null, 2),
      );

      let updateRes;
      try {
        updateRes = await axios.put(
          `${baseURL}/quotations/${activeQuotationId}`,
          payload,
          {
            headers,
            params,
          },
        );
      } catch (putErr: any) {
        console.log(
          "[Update Quotation] PUT /quotations/:id error:",
          putErr?.message,
          putErr?.response?.data,
        );
        if (putErr?.response?.status === 405) {
          updateRes = await axios.patch(
            `${baseURL}/quotations/${activeQuotationId}`,
            payload,
            {
              headers,
              params,
            },
          );
        } else {
          throw putErr;
        }
      }

      console.log("[Update Quotation] Response:", updateRes?.data);

      Alert.alert(
        "Success",
        `Quotation ${quotationReference || ""} updated successfully!`,
        [
          {
            text: "OK",
            onPress: () => {
              if (onSuccess) onSuccess();
              router.push("/quotation");
            },
          },
        ],
        { cancelable: false },
      );
    } catch (err: any) {
      console.log(
        "Error updating quotation:",
        err?.message || err,
        err?.response?.data,
      );
      const serverData = err?.response?.data;
      let errMsg =
        serverData?.message ||
        serverData?.error ||
        err?.message ||
        "Could not update quotation. Please check your network and try again.";

      if (serverData?.errors && typeof serverData.errors === "object") {
        const errorDetails = Object.values(serverData.errors).flat().join("\n");
        if (errorDetails) {
          errMsg = `${errMsg}\n\n${errorDetails}`;
        }
      }

      Alert.alert("Update Note", errMsg, [{ text: "OK" }]);
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
            <Text style={styles.headerTitle}>Edit Quotation</Text>
            <Text style={styles.headerSubtitle}>
              {quotationReference ? `${quotationReference} · ` : ""}
              Plant: {plant_name || "Ready-Mix Concrete"}
            </Text>
          </View>
        </View>
      </View>

      {loadingDetail ? (
        <View style={styles.centeredLoadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
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

            {/* 1. CUSTOMER DROPDOWN */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Customer <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={openCustomerPicker}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    !selectedCustomerItem && styles.dropdownPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {selectedCustomerItem?.legal_name || "Select Customer"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* 2. DELIVERY SITE DROPDOWN */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Delivery Site <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={openSitePicker}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    !selectedSiteItem && styles.dropdownPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {selectedSiteItem?.name || "Select Delivery Site"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* 3. SALES EXECUTIVE DROPDOWN */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Sales Executive</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={openSalesExecutivePicker}
                activeOpacity={0.75}
              >
                {(() => {
                  const targetId =
                    storedSalesExecutiveId ??
                    initialSalesExecId ??
                    passedQuotation?.sales_executive_id ??
                    passedQuotation?.sales_executive?.id;

                  const matched =
                    selectedSalesExecutiveItem ||
                    (targetId && cachedSalesExecutives.length > 0
                      ? cachedSalesExecutives.find(
                          (se) => Number(se.id) === Number(targetId),
                        )
                      : null) ||
                    (cachedSalesExecutives.length > 0
                      ? cachedSalesExecutives[0]
                      : null);

                  const displayText = matched
                    ? cleanSalesExecutiveName(matched.label)
                    : "Loading Sales Executive...";

                  const isPlaceholder = !matched;

                  return (
                    <Text
                      style={[
                        styles.dropdownText,
                        isPlaceholder && styles.dropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {displayText}
                    </Text>
                  );
                })()}
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

                  {/* Product / Mix Design Dropdown */}
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
                        {formatAmountWithDecimals(
                          item.calculation.untaxedAmount,
                        )}
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
                        ₹
                        {formatAmountWithDecimals(item.calculation.amountTotal)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

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

            <View style={styles.totalEstimateCard}>
              <View style={styles.totalEstimateHeaderRow}>
                <Text style={styles.totalEstimateLabel}>Total estimate</Text>
                <Text style={styles.totalEstimateAmount}>
                  ₹{formatAmountWithDecimals(totalSummary.amountTotal)}
                </Text>
              </View>

              <View style={styles.totalEstimateBreakdownRow}>
                <Text style={styles.totalEstimateBreakdownText}>
                  Untaxed: ₹
                  {formatAmountWithDecimals(totalSummary.untaxedAmount)} · Tax:
                  ₹{formatAmountWithDecimals(totalSummary.taxAmount)}
                </Text>
              </View>

              <Text style={styles.totalEstimateFooterNote}>
                Commercial quote estimate · Ready for plant dispatch
              </Text>
            </View>

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
                <Text style={styles.saveDraftButtonText}>Save Changes</Text>
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
      )}

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
  centeredLoadingContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
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
});
