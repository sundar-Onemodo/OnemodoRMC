import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { AppHeader } from "@/components/ui/app-header";
import { Colors } from "@/constants/theme";
import { RootState } from "@/store/store";
import {
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import axios from "axios";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

interface DropdownItem {
  id?: number | string;
  label: string;
  subLabel?: string;
  value?: string | number | null;
  extra?: any;
}

interface FormLineItem {
  id: string; // local temporary key or existing item id
  mix_design_id: number | null;
  mix_design_name?: string;
  quantity: string;
  rate: string;
  tax_id: number | null;
  tax_name?: string;
  tax_rate?: number;
  concrete_pump: string | null;
  pump_rate: string;
}

export function cleanSalesExecutiveName(raw?: string | null): string {
  if (!raw) return "";
  return raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

const DEFAULT_PUMP_OPTIONS: DropdownItem[] = [
  { id: "none", label: "None / Direct Pour", value: null },
  { id: "boom", label: "Boom Pump", value: "boom" },
  { id: "line", label: "Line Pump", value: "line" },
  { id: "pump", label: "Stationary Pump", value: "pump" },
  { id: "manual", label: "Manual Pour", value: "manual" },
];

export default function EditCustomerPOScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];

  const params = useLocalSearchParams<{ admin_po_id?: string; id?: string; quotation_id?: string }>();
  const adminPoId = params.admin_po_id || params.id;

  const { token, plant_id, user } = useSelector(
    (state: RootState) => state.auth,
  );

  const effectivePlantId =
    plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;

  // Dropdown lists
  const [customers, setCustomers] = useState<DropdownItem[]>([]);
  const [sites, setSites] = useState<DropdownItem[]>([]);
  const [mixDesigns, setMixDesigns] = useState<DropdownItem[]>([]);
  const [taxes, setTaxes] = useState<DropdownItem[]>([]);
  const [pumpOptions, setPumpOptions] = useState<DropdownItem[]>(
    DEFAULT_PUMP_OPTIONS,
  );
  const [salesExecutives, setSalesExecutives] = useState<DropdownItem[]>([]);

  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [referenceDisplay, setReferenceDisplay] = useState<string>("");
  const [quotationId, setQuotationId] = useState<string | number | null>(
    params.quotation_id || null,
  );
  const isLinkedToQuotation = Boolean(
    quotationId && String(quotationId).trim() !== "" && String(quotationId) !== "null" && Number(quotationId) > 0,
  );

  // Form Fields
  const [selectedCustomer, setSelectedCustomer] = useState<DropdownItem | null>(null);
  const [selectedSite, setSelectedSite] = useState<DropdownItem | null>(null);
  const [selectedSalesExecutive, setSelectedSalesExecutive] = useState<DropdownItem | null>(null);
  const [orderDate, setOrderDate] = useState<string>("");
  const [isTaxInclusive, setIsTaxInclusive] = useState<boolean>(false);
  const [customerPoReference, setCustomerPoReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Line items state
  const [items, setItems] = useState<FormLineItem[]>([]);

  // Modal Pickers State
  const [pickerModalVisible, setPickerModalVisible] = useState<boolean>(false);
  const [pickerType, setPickerType] = useState<"customer" | "site" | "salesExec" | "mix" | "tax" | "pump">("customer");
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);
  const [pickerSearch, setPickerSearch] = useState<string>("");

  // Date Picker State
  const [dateModalVisible, setDateModalVisible] = useState<boolean>(false);
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#0F172A");
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

  // Fetch dropdowns and Customer PO data
  useEffect(() => {
    let isMounted = true;
    if (!token || !adminPoId) return;

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

    setIsLoadingData(true);

    Promise.all([
      // 1. Fetch PO Details
      axios
        .get(`${baseURL}/customer-pos/${adminPoId}`, {
          headers,
          params: { plant_id: effectivePlantId },
          timeout: 25000,
        })
        .then((res) => res.data?.data || res.data)
        .catch((err) => {
          console.warn("[EditCustomerPO] Error loading PO details:", err?.message);
          return null;
        }),

      // 2. Fetch Customers
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

      // 3. Fetch Sites
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

      // 4. Fetch Mix Designs
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

      // 5. Fetch Taxes
      axios
        .get(`${baseURL}/taxes`, {
          headers,
          params: { page: 1, plant_id: effectivePlantId },
          timeout: 25000,
        })
        .then((res) => {
          const raw = res.data?.data?.data || res.data?.data || [];
          const parentTaxes = (raw || []).filter(
            (t: any) => t.parent_id === null || t.parent_id === undefined,
          );
          return parentTaxes.map((t: any) => ({
            id: t.id,
            label: t.tax_name || t.name || `Tax #${t.id}`,
            subLabel: `${t.tax_rate || t.rate || 0}%`,
            extra: t,
          }));
        })
        .catch(() => []),

      // 6. Fetch Pumps
      axios
        .get(`${baseURL}/dropdowns`, {
          headers,
          timeout: 25000,
        })
        .then((res) => {
          const data = res.data?.data || res.data || {};
          const dynamicPumps: DropdownItem[] = (data.pumps || []).map((p: any) => ({
            id: p.id || p.value || p.label,
            label: p.label || p.registration || "Pump",
            value: (p.label || p.registration || "").toLowerCase(),
          }));
          if (dynamicPumps.length > 0) {
            return [{ id: "none", label: "None / Direct Pour", value: null }, ...dynamicPumps];
          }
          return DEFAULT_PUMP_OPTIONS;
        })
        .catch(() => DEFAULT_PUMP_OPTIONS),

      // 7. Fetch Sales Executives
      axios
        .get(`${baseURL}/sales-executives`, {
          headers,
          params: effectivePlantId ? { plant_id: effectivePlantId } : undefined,
          timeout: 25000,
        })
        .then((res) => {
          const list = res.data?.data?.data || res.data?.data || [];
          return (list || []).map((se: any) => ({
            id: se.id,
            label: cleanSalesExecutiveName(se.label || se.name || se.full_name || `Executive #${se.id}`),
            value: se.id,
            extra: se,
          }));
        })
        .catch(() => []),
    ])
      .then(([poData, custList, siteList, mixList, taxList, pumpList, salesExecList]) => {
        if (!isMounted) return;

        setCustomers(custList);
        setSites(siteList);
        setMixDesigns(mixList);
        setTaxes(taxList);
        if (pumpList && pumpList.length > 0) {
          setPumpOptions(pumpList);
        }
        if (salesExecList && salesExecList.length > 0) {
          setSalesExecutives(salesExecList);
        }

        if (poData) {
          if (poData.quotation_id) {
            setQuotationId(poData.quotation_id);
          }
          const seId = poData.sales_executive_id ?? poData.sales_executive?.id ?? null;
          if (seId) {
            const foundSe = salesExecList.find((se: any) => Number(se.id) === Number(seId));
            setSelectedSalesExecutive(
              foundSe || {
                id: seId,
                label: cleanSalesExecutiveName(poData.sales_executive?.label || poData.sales_executive?.name || `Executive #${seId}`),
                value: seId,
              },
            );
          }
          setReferenceDisplay(poData.reference || `PO #${adminPoId}`);
          setCustomerPoReference(poData.customer_po_reference || "");
          setNotes(poData.notes || "");
          setIsTaxInclusive(Boolean(poData.is_tax_inclusive));

          // Order Date format YYYY-MM-DD
          if (poData.order_date) {
            const d = new Date(poData.order_date);
            if (!isNaN(d.getTime())) {
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const day = String(d.getDate()).padStart(2, "0");
              setOrderDate(`${y}-${m}-${day}`);
              setCalYear(y);
              setCalMonth(d.getMonth());
            } else {
              setOrderDate(String(poData.order_date).slice(0, 10));
            }
          }

          // Customer selection
          if (poData.patron) {
            setSelectedCustomer({
              id: poData.patron.id,
              label: poData.patron.legal_name || `Customer #${poData.patron.id}`,
            });
          } else if (poData.patron_id) {
            const foundCust = custList.find((c: any) => c.id === poData.patron_id);
            setSelectedCustomer(
              foundCust || { id: poData.patron_id, label: `Customer #${poData.patron_id}` },
            );
          }

          // Site selection
          if (poData.site) {
            setSelectedSite({
              id: poData.site.id,
              label: poData.site.name || `Site #${poData.site.id}`,
            });
          } else if (poData.site_id) {
            const foundSite = siteList.find((s: any) => s.id === poData.site_id);
            setSelectedSite(
              foundSite || { id: poData.site_id, label: `Site #${poData.site_id}` },
            );
          }

          // Items conversion
          const rawItems = poData.items || [];
          if (Array.isArray(rawItems) && rawItems.length > 0) {
            const converted: FormLineItem[] = rawItems.map((it: any, idx: number) => {
              const matchedMix = mixList.find((m: any) => m.id === it.mix_design_id);
              const matchedTax = taxList.find((t: any) => t.id === it.tax_id);

              return {
                id: String(it.id || idx),
                mix_design_id: it.mix_design_id,
                mix_design_name:
                  it.mix_design?.design_name ||
                  matchedMix?.label ||
                  `Mix #${it.mix_design_id}`,
                quantity: String(parseFloat(it.quantity) || it.quantity || ""),
                rate: String(parseFloat(it.rate) || it.rate || ""),
                tax_id: it.tax_id || null,
                tax_name: matchedTax?.label || (it.tax_id ? `Tax #${it.tax_id}` : "None"),
                tax_rate: matchedTax?.extra?.tax_rate || 0,
                concrete_pump: it.concrete_pump || null,
                pump_rate: String(parseFloat(it.pump_rate) || "0"),
              };
            });
            setItems(converted);
          } else {
            setItems([
              {
                id: "item-default",
                mix_design_id: null,
                mix_design_name: "",
                quantity: "",
                rate: "",
                tax_id: null,
                tax_name: "",
                tax_rate: 0,
                concrete_pump: null,
                pump_rate: "0",
              },
            ]);
          }
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingData(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, adminPoId, effectivePlantId]);

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
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        mix_design_id: null,
        mix_design_name: "",
        quantity: "",
        rate: "",
        tax_id: null,
        tax_name: "",
        tax_rate: 0,
        concrete_pump: null,
        pump_rate: "0",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      Alert.alert("Action not allowed", "At least one line item is required.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItemField = (index: number, field: keyof FormLineItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Open modal pickers
  const openPicker = (type: "customer" | "site" | "salesExec" | "mix" | "tax" | "pump", itemIdx = 0) => {
    setPickerType(type);
    setActiveItemIndex(itemIdx);
    setPickerSearch("");
    setPickerModalVisible(true);
  };

  const handleSelectPickerItem = (item: DropdownItem) => {
    if (pickerType === "customer") {
      setSelectedCustomer(item);
      setSelectedSite(null);
    } else if (pickerType === "site") {
      setSelectedSite(item);
    } else if (pickerType === "salesExec") {
      if (item.id === "none" || item.id === null) {
        setSelectedSalesExecutive(null);
      } else {
        setSelectedSalesExecutive(item);
      }
    } else if (pickerType === "mix") {
      const mix = item;
      updateItemField(activeItemIndex, "mix_design_id", Number(mix.id));
      updateItemField(activeItemIndex, "mix_design_name", mix.label);
      if (mix.extra?.rate_per_qty) {
        updateItemField(activeItemIndex, "rate", String(parseFloat(mix.extra.rate_per_qty) || ""));
      }
    } else if (pickerType === "tax") {
      const tax = item;
      if (tax.id === 0) {
        updateItemField(activeItemIndex, "tax_id", null);
        updateItemField(activeItemIndex, "tax_name", "Exempt / None");
        updateItemField(activeItemIndex, "tax_rate", 0);
      } else {
        updateItemField(activeItemIndex, "tax_id", Number(tax.id));
        updateItemField(activeItemIndex, "tax_name", tax.label);
        const rateNum = parseFloat(tax.extra?.tax_rate || tax.extra?.rate) || 0;
        updateItemField(activeItemIndex, "tax_rate", rateNum);
      }
    } else if (pickerType === "pump") {
      updateItemField(activeItemIndex, "concrete_pump", item.value as string | null);
    }
    setPickerModalVisible(false);
  };

  // Calculations Preview
  const totals = useMemo(() => {
    let totalQty = 0;
    let untaxedTotal = 0;
    let taxTotal = 0;

    items.forEach((it) => {
      const q = parseFloat(it.quantity) || 0;
      const r = parseFloat(it.rate) || 0;
      const pRate = parseFloat(it.pump_rate) || 0;

      totalQty += q;
      const baseAmount = q * r;
      const pumpAmount = it.concrete_pump ? pRate * (q > 0 ? q : 1) : 0;
      const subtotal = baseAmount + pumpAmount;

      untaxedTotal += subtotal;

      if (it.tax_rate && it.tax_rate > 0) {
        if (isTaxInclusive) {
          const itemUntaxed = subtotal / (1 + it.tax_rate / 100);
          taxTotal += subtotal - itemUntaxed;
        } else {
          taxTotal += subtotal * (it.tax_rate / 100);
        }
      }
    });

    const finalTotal = isTaxInclusive ? untaxedTotal : untaxedTotal + taxTotal;

    return {
      totalQty: Math.round(totalQty * 100) / 100,
      untaxedTotal: Math.round(untaxedTotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      finalTotal: Math.round(finalTotal * 100) / 100,
    };
  }, [items, isTaxInclusive]);

  // Submission PUT
  const handleUpdate = async () => {
    if (!adminPoId) {
      Alert.alert("Error", "Missing Customer PO ID.");
      return;
    }
    if (!selectedCustomer) {
      Alert.alert("Validation Error", "Please select a Customer.");
      return;
    }
    if (!selectedSite) {
      Alert.alert("Validation Error", "Please select a Delivery Site.");
      return;
    }
    if (!orderDate) {
      Alert.alert("Validation Error", "Please select an Order Date.");
      return;
    }

    // Validate Items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.mix_design_id) {
        Alert.alert("Validation Error", `Item #${i + 1}: Please select a Mix Design.`);
        return;
      }
      const q = parseFloat(it.quantity);
      if (isNaN(q) || q <= 0) {
        Alert.alert("Validation Error", `Item #${i + 1}: Please enter a valid quantity.`);
        return;
      }
      const r = parseFloat(it.rate);
      if (isNaN(r) || r < 0) {
        Alert.alert("Validation Error", `Item #${i + 1}: Please enter a valid rate.`);
        return;
      }
    }

    const payload = {
      patron_id: selectedCustomer.id,
      site_id: selectedSite.id,
      sales_executive_id: selectedSalesExecutive?.id && selectedSalesExecutive.id !== "none"
        ? Number(selectedSalesExecutive.id)
        : null,
      order_date: orderDate,
      is_tax_inclusive: isTaxInclusive,
      customer_po_reference: customerPoReference.trim() || null,
      notes: notes.trim() || null,
      items: items.map((it) => ({
        mix_design_id: it.mix_design_id,
        quantity: parseFloat(it.quantity),
        rate: parseFloat(it.rate),
        tax_id: it.tax_id || null,
        concrete_pump: it.concrete_pump || null,
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
      const queryParams = {
        admin_po_id: adminPoId,
        ...(effectivePlantId !== null && effectivePlantId !== undefined
          ? { plant_id: effectivePlantId }
          : {}),
      };
      const fullPayload = {
        admin_po_id: adminPoId,
        ...payload,
      };
      console.log(
        `[CustomerPO] PUT /customer-pos/${adminPoId} params:`,
        JSON.stringify(queryParams),
        "payload:",
        JSON.stringify(fullPayload),
      );

      const res = await axios.put(`${baseURL}/customer-pos/${adminPoId}`, fullPayload, {
        headers,
        params: queryParams,
        timeout: 30000,
      });

      if (res.data?.success) {
        Alert.alert(
          "Success",
          `Customer Purchase Order updated successfully: ${res.data?.data?.reference || referenceDisplay}`,
          [
            {
              text: "OK",
              onPress: () => router.replace("/customer-po" as any),
            },
          ],
        );
      } else {
        Alert.alert("Error", res.data?.message || "Failed to update Customer PO.");
      }
    } catch (err: any) {
      console.warn("[CustomerPO] PUT error:", err?.response?.data || err?.message);
      const errMsg =
        err?.response?.data?.message ||
        (err?.response?.data?.errors
          ? Object.values(err.response.data.errors).flat().join("\n")
          : null) ||
        err?.message ||
        "Failed to update Customer Purchase Order.";
      Alert.alert("Update Failed", errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calendar Helpers
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    return { firstDay, daysInMonth };
  }, [calYear, calMonth]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.headerBgColor }]}
      edges={["top"]}
    >
      <AppHeader
        title="Edit Customer PO"
        onBackPress={handleBack}
        showNotification={false}
      />

      {isLoadingData ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.centerLoaderText}>
            Loading Customer PO #{adminPoId} details...
          </Text>
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
                        {/* QUOTATION LOCK BANNER */}
            {isLinkedToQuotation && (
              <View style={styles.quotationNoticeBanner}>
                <Ionicons name="lock-closed" size={18} color="#0D9488" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.quotationNoticeTitle}>
                    Linked to Quotation #{quotationId}
                  </Text>
                  <Text style={styles.quotationNoticeText}>
                    This Customer PO was converted from Quotation #{quotationId}. Customer, delivery site, order date, and mix specifications are locked. You can only edit Sales Executive, Customer PO Reference, and Notes.
                  </Text>
                </View>
              </View>
            )}

            {/* REFERENCE DISPLAY HEADER */}
            {referenceDisplay ? (
              <View style={styles.referenceBanner}>
                <MaterialCommunityIcons name="file-document-check" size={20} color="#2563EB" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.referenceBannerTitle}>{referenceDisplay}</Text>
                  <Text style={styles.referenceBannerSub}>Modifying order & items</Text>
                </View>
              </View>
            ) : null}

            {/* SECTION 1: CUSTOMER & SITE */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name="domain"
                  size={20}
                  color="#2563EB"
                />
                <Text style={styles.sectionTitle}>
                  Customer & Delivery Site <Text style={styles.asterisk}>*</Text>
                </Text>
              </View>

              {/* Customer Selector */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>CUSTOMER (PATRON)</Text>
                <TouchableOpacity
                  style={[
                    styles.selectorBtn,
                    !selectedCustomer && styles.selectorBtnEmpty,
                    isLinkedToQuotation && styles.disabledSelectorBtn,
                  ]}
                  onPress={isLinkedToQuotation ? undefined : () => openPicker("customer")}
                  disabled={isLinkedToQuotation}
                  activeOpacity={isLinkedToQuotation ? 1 : 0.75}
                >
                  <Ionicons
                    name={isLinkedToQuotation ? "lock-closed" : "person"}
                    size={18}
                    color={isLinkedToQuotation ? "#94A3B8" : "#2563EB"}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.selectorText,
                        !selectedCustomer && styles.placeholderText,
                        isLinkedToQuotation && styles.disabledText,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedCustomer ? selectedCustomer.label : "Select Customer..."}
                    </Text>
                  </View>
                  {!isLinkedToQuotation ? (
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  ) : null}
                </TouchableOpacity>
              </View>

              {/* Site Selector */}
              <View style={[styles.fieldGroup, { marginTop: 12 }]}>
                <Text style={styles.fieldLabel}>DELIVERY SITE</Text>
                <TouchableOpacity
                  style={[
                    styles.selectorBtn,
                    !selectedSite && styles.selectorBtnEmpty,
                    isLinkedToQuotation && styles.disabledSelectorBtn,
                  ]}
                  onPress={isLinkedToQuotation ? undefined : () => openPicker("site")}
                  disabled={isLinkedToQuotation}
                  activeOpacity={isLinkedToQuotation ? 1 : 0.75}
                >
                  <Ionicons
                    name={isLinkedToQuotation ? "lock-closed" : "location"}
                    size={18}
                    color={isLinkedToQuotation ? "#94A3B8" : "#DC2626"}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.selectorText,
                        !selectedSite && styles.placeholderText,
                        isLinkedToQuotation && styles.disabledText,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSite ? selectedSite.label : "Select Delivery Site..."}
                    </Text>
                    {selectedSite?.subLabel && (
                      <Text style={styles.selectorSubText} numberOfLines={1}>
                        📍 {selectedSite.subLabel}
                      </Text>
                    )}
                  </View>
                  {!isLinkedToQuotation ? (
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  ) : null}
                </TouchableOpacity>
              </View>

              {/* Sales Executive Selector (Always Editable) */}
              <View style={[styles.fieldGroup, { marginTop: 12 }]}>
                <Text style={styles.fieldLabel}>SALES EXECUTIVE</Text>
                <TouchableOpacity
                  style={[
                    styles.selectorBtn,
                    !selectedSalesExecutive && styles.selectorBtnEmpty,
                  ]}
                  onPress={() => openPicker("salesExec")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="briefcase-outline" size={18} color="#2563EB" />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.selectorText,
                        !selectedSalesExecutive && styles.placeholderText,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSalesExecutive
                        ? selectedSalesExecutive.label
                        : "Select Sales Executive"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* SECTION 2: ORDER DETAILS */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar-outline" size={20} color="#2563EB" />
                <Text style={styles.sectionTitle}>Order Information</Text>
              </View>

              {/* Order Date */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ORDER DATE</Text>
                <TouchableOpacity
                  style={[
                    styles.selectorBtn,
                    isLinkedToQuotation && styles.disabledSelectorBtn,
                  ]}
                  onPress={
                    isLinkedToQuotation
                      ? undefined
                      : () => {
                          if (orderDate) {
                            const parts = orderDate.split("-");
                            if (parts.length === 3) {
                              setCalYear(parseInt(parts[0], 10));
                              setCalMonth(parseInt(parts[1], 10) - 1);
                            }
                          }
                          setDateModalVisible(true);
                        }
                  }
                  disabled={isLinkedToQuotation}
                  activeOpacity={isLinkedToQuotation ? 1 : 0.75}
                >
                  <Ionicons
                    name={isLinkedToQuotation ? "lock-closed" : "calendar"}
                    size={18}
                    color={isLinkedToQuotation ? "#94A3B8" : "#2563EB"}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.selectorText,
                        isLinkedToQuotation && styles.disabledText,
                      ]}
                    >
                      {orderDate || "Choose Date..."}
                    </Text>
                  </View>
                  {!isLinkedToQuotation && (
                    <View style={styles.dateChangeBadge}>
                      <Text style={styles.dateChangeBadgeText}>Pick Date</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Customer PO Reference */}
              <View style={[styles.fieldGroup, { marginTop: 12 }]}>
                <Text style={styles.fieldLabel}>CUSTOMER PO REFERENCE</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    value={customerPoReference}
                    onChangeText={setCustomerPoReference}
                    placeholder="e.g. PO/2026/0491 or client work order"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Tax Inclusive Rate (Matches Quotation Screen UI) */}
              <TouchableOpacity
                style={[
                  styles.taxInclusiveBox,
                  { marginTop: 14 },
                  isLinkedToQuotation && { opacity: 0.6 },
                ]}
                onPress={
                  isLinkedToQuotation
                    ? undefined
                    : () => setIsTaxInclusive((prev) => !prev)
                }
                disabled={isLinkedToQuotation}
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
            </View>

            {/* SECTION 3: LINE ITEMS */}
            <View style={styles.sectionCard}>
              <View style={[styles.sectionHeader, { justifyContent: "space-between" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons
                    name="cube-outline"
                    size={20}
                    color="#2563EB"
                  />
                  <Text style={styles.sectionTitle}>Order Items & Mix Spec</Text>
                </View>
                {!isLinkedToQuotation && (
                <TouchableOpacity
                  style={styles.addItemBtn}
                  onPress={handleAddItem}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.addItemBtnText}>Add Item</Text>
                </TouchableOpacity>
                )}
              </View>

              {items.map((item, index) => (
                <View key={item.id} style={styles.itemBox}>
                  {/* Item Box Header */}
                  <View style={styles.itemBoxHeader}>
                    <View style={styles.itemNumberBadge}>
                      <Text style={styles.itemNumberText}>Item #{index + 1}</Text>
                    </View>
                    {items.length > 1 && !isLinkedToQuotation && (
                      <TouchableOpacity
                        onPress={() => handleRemoveItem(index)}
                        style={styles.removeItemBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Mix Design Selector */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>CONCRETE MIX SPEC <Text style={styles.asterisk}>*</Text></Text>
                    <TouchableOpacity
                      style={[
                        styles.selectorBtn,
                        !item.mix_design_id && styles.selectorBtnEmpty,
                        isLinkedToQuotation && styles.disabledSelectorBtn,
                      ]}
                      onPress={isLinkedToQuotation ? undefined : () => openPicker("mix", index)}
                      disabled={isLinkedToQuotation}
                      activeOpacity={isLinkedToQuotation ? 1 : 0.75}
                    >
                      <MaterialCommunityIcons
                        name={isLinkedToQuotation ? "lock" : "cube-outline"}
                        size={18}
                        color={isLinkedToQuotation ? "#94A3B8" : "#2563EB"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.selectorText,
                            !item.mix_design_id && styles.placeholderText,
                            isLinkedToQuotation && styles.disabledText,
                          ]}
                          numberOfLines={1}
                        >
                          {item.mix_design_name || "Choose Concrete Mix Grade..."}
                        </Text>
                      </View>
                      {!isLinkedToQuotation && (
                        <Ionicons name="chevron-down" size={16} color="#64748B" />
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Quantity & Rate Row */}
                  <View style={styles.twoColRow}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>QUANTITY (m³) <Text style={styles.asterisk}>*</Text></Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={[
                            styles.textInput,
                            isLinkedToQuotation && styles.disabledInput,
                          ]}
                          keyboardType="numeric"
                          value={item.quantity}
                          editable={!isLinkedToQuotation}
                          onChangeText={(v) => updateItemField(index, "quantity", v)}
                          placeholder="e.g. 50"
                          placeholderTextColor="#94A3B8"
                        />
                        <Text style={styles.unitSuffix}>m³</Text>
                      </View>
                    </View>

                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>RATE (₹/m³) <Text style={styles.asterisk}>*</Text></Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={[
                            styles.textInput,
                            isLinkedToQuotation && styles.disabledInput,
                          ]}
                          keyboardType="numeric"
                          value={item.rate}
                          editable={!isLinkedToQuotation}
                          onChangeText={(v) => updateItemField(index, "rate", v)}
                          placeholder="e.g. 4500"
                          placeholderTextColor="#94A3B8"
                        />
                        <Text style={styles.unitSuffix}>₹</Text>
                      </View>
                    </View>
                  </View>

                  {/* Tax Dropdown */}
                  <View style={[styles.fieldGroup, { marginTop: 10 }]}>
                    <Text style={styles.fieldLabel}>APPLICABLE TAX</Text>
                    <TouchableOpacity
                      style={[
                        styles.selectorBtn,
                        isLinkedToQuotation && styles.disabledSelectorBtn,
                      ]}
                      onPress={isLinkedToQuotation ? undefined : () => openPicker("tax", index)}
                      disabled={isLinkedToQuotation}
                      activeOpacity={isLinkedToQuotation ? 1 : 0.75}
                    >
                      <Ionicons
                        name={isLinkedToQuotation ? "lock-closed" : "receipt-outline"}
                        size={17}
                        color={isLinkedToQuotation ? "#94A3B8" : "#2563EB"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.selectorText,
                            isLinkedToQuotation && styles.disabledText,
                          ]}
                          numberOfLines={1}
                        >
                          {item.tax_name || "Select Tax (or None)..."}
                        </Text>
                      </View>
                      {!isLinkedToQuotation && (
                        <Ionicons name="chevron-down" size={16} color="#64748B" />
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Pump Type & Rate Row */}
                  <View style={[styles.twoColRow, { marginTop: 10 }]}>
                    <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                      <Text style={styles.fieldLabel}>CONCRETE PUMP</Text>
                      <TouchableOpacity
                        style={[
                          styles.selectorBtn,
                          isLinkedToQuotation && styles.disabledSelectorBtn,
                        ]}
                        onPress={isLinkedToQuotation ? undefined : () => openPicker("pump", index)}
                        disabled={isLinkedToQuotation}
                        activeOpacity={isLinkedToQuotation ? 1 : 0.75}
                      >
                        <MaterialCommunityIcons
                          name={isLinkedToQuotation ? "lock" : "pipe-leak"}
                          size={17}
                          color={isLinkedToQuotation ? "#94A3B8" : "#7C3AED"}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.selectorText,
                              isLinkedToQuotation && styles.disabledText,
                            ]}
                            numberOfLines={1}
                          >
                            {item.concrete_pump || "Direct / None"}
                          </Text>
                        </View>
                        {!isLinkedToQuotation && (
                          <Ionicons name="chevron-down" size={14} color="#64748B" />
                        )}
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.fieldGroup, { flex: 0.8 }]}>
                      <Text style={styles.fieldLabel}>PUMP RATE</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={[
                            styles.textInput,
                            isLinkedToQuotation && styles.disabledInput,
                          ]}
                          keyboardType="numeric"
                          value={item.pump_rate}
                          editable={!isLinkedToQuotation}
                          onChangeText={(v) => updateItemField(index, "pump_rate", v)}
                          placeholder="0"
                          placeholderTextColor="#94A3B8"
                        />
                        <Text style={styles.unitSuffix}>₹</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}

              {/* Notes & Remarks (Shown in Order Items & Mix Spec space) */}
              <View style={{ marginTop: 14 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <MaterialCommunityIcons
                    name="note-text-outline"
                    size={17}
                    color="#64748B"
                  />
                  <Text style={styles.fieldLabel}>NOTES & REMARKS</Text>
                </View>
                <View style={styles.textAreaContainer}>
                  <TextInput
                    style={styles.textArea}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Enter any special instructions or remarks..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            </View>

            {/* SECTION 4: ORDER TOTALS SUMMARY (TOTAL PO VALUE SHOWN IN LAST) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="receipt-outline" size={19} color="#2563EB" />
                <Text style={styles.sectionTitle}>Total PO Value Summary</Text>
              </View>

              <View style={styles.totalsBox}>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total Volume:</Text>
                  <Text style={styles.totalsValue}>{totals.totalQty} m³</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Untaxed Subtotal:</Text>
                  <Text style={styles.totalsValue}>
                    ₹{totals.untaxedTotal.toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Estimated Tax:</Text>
                  <Text style={styles.totalsValue}>
                    ₹{totals.taxTotal.toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={[styles.totalsRow, styles.totalsGrandRow]}>
                  <Text style={styles.totalsGrandLabel}>Total PO Value:</Text>
                  <Text style={styles.totalsGrandValue}>
                    ₹{totals.finalTotal.toLocaleString("en-IN")}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Enhanced Bottom Action Bar */}
          <View style={styles.bottomBar}>
            <View style={styles.bottomTotalWrap}>
              <Text style={styles.bottomTotalLabel}>TOTAL PAYABLE</Text>
              <Text style={styles.bottomTotalAmount}>
                ₹{Math.round(totals.finalTotal).toLocaleString("en-IN")}
              </Text>
              <Text style={styles.bottomTotalSub}>
                {totals.totalQty}m³ {isTaxInclusive ? "tax inclusive" : "tax exclusive"}
              </Text>
            </View>

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
                  style={{ marginRight: 6 }}
                />
              ) : (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
              )}
              <Text style={styles.submitButtonText}>
                {isSubmitting ? "Updating..." : "Save Changes"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* MODAL PICKER */}
      <Modal
        visible={pickerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickerType === "customer"
                  ? "Select Customer"
                  : pickerType === "site"
                    ? "Select Delivery Site"
                    : pickerType === "salesExec"
                      ? "Select Sales Executive"
                      : pickerType === "mix"
                      ? "Select Mix Design"
                      : pickerType === "tax"
                        ? "Select Tax"
                        : "Select Concrete Pump"}
              </Text>
              <TouchableOpacity
                onPress={() => setPickerModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Search */}
            {pickerType !== "pump" && (
              <View style={styles.modalSearchBox}>
                <Ionicons name="search" size={16} color="#94A3B8" />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Filter options..."
                  placeholderTextColor="#94A3B8"
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                />
              </View>
            )}

            {/* Modal List */}
            <FlatList<DropdownItem>
              data={
                (pickerType === "pump"
                  ? pumpOptions
                  : pickerType === "customer"
                    ? customers
                    : pickerType === "site"
                      ? filteredSites
                      : pickerType === "salesExec"
                        ? ([{ id: "none", label: "-- None --", subLabel: "Clear / No Sales Executive", value: null }, ...salesExecutives] as DropdownItem[])
                        : pickerType === "mix"
                        ? mixDesigns
                        : ([{ id: 0, label: "Exempt / None", subLabel: "0%" }, ...taxes] as DropdownItem[])
                ).filter((item: DropdownItem) =>
                  pickerSearch.trim()
                    ? item.label.toLowerCase().includes(pickerSearch.toLowerCase())
                    : true,
                )
              }
              keyExtractor={(item: any, idx) => String(item.id || item.value || idx)}
              renderItem={({ item }: any) => {
                const isSelected =
                  pickerType === "customer"
                    ? selectedCustomer?.id === item.id
                    : pickerType === "site"
                      ? selectedSite?.id === item.id
                      : pickerType === "salesExec"
                        ? (item.id === "none" ? !selectedSalesExecutive : selectedSalesExecutive?.id === item.id)
                        : pickerType === "mix"
                        ? items[activeItemIndex]?.mix_design_id === item.id
                        : pickerType === "tax"
                          ? items[activeItemIndex]?.tax_id === (item.id === 0 ? null : item.id)
                          : items[activeItemIndex]?.concrete_pump === item.value;

                return (
                  <TouchableOpacity
                    style={[styles.modalItemRow, isSelected && styles.modalItemActive]}
                    onPress={() => handleSelectPickerItem(item)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.modalItemTitle,
                          isSelected && { color: "#2563EB", fontWeight: "700" },
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.subLabel ? (
                        <Text style={styles.modalItemSub}>{item.subLabel}</Text>
                      ) : null}
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>No matching options found.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* DATE PICKER MODAL */}
      <Modal
        visible={dateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: 420 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Order Date</Text>
              <TouchableOpacity onPress={() => setDateModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigation */}
            <View style={styles.calNavRow}>
              <TouchableOpacity
                onPress={() => {
                  if (calMonth === 0) {
                    setCalMonth(11);
                    setCalYear((y) => y - 1);
                  } else {
                    setCalMonth((m) => m - 1);
                  }
                }}
                style={styles.calNavBtn}
              >
                <Ionicons name="chevron-back" size={18} color="#2563EB" />
              </TouchableOpacity>
              <Text style={styles.calNavTitle}>
                {monthNames[calMonth]} {calYear}
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
                style={styles.calNavBtn}
              >
                <Ionicons name="chevron-forward" size={18} color="#2563EB" />
              </TouchableOpacity>
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <Text key={i} style={styles.dayHeaderCell}>{d}</Text>
              ))}

              {Array.from({ length: calendarDays.firstDay }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.dayCellEmpty} />
              ))}

              {Array.from({ length: calendarDays.daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const isSelected = orderDate === dStr;

                return (
                  <TouchableOpacity
                    key={`day-${dayNum}`}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                    onPress={() => {
                      setOrderDate(dStr);
                      setDateModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dayCellText,
                        isSelected && styles.dayCellTextSelected,
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  disabledSelectorBtn: {
    backgroundColor: "#F1F5F9",
    borderColor: "#CBD5E1",
  },
  disabledText: {
    color: "#64748B",
  },
  disabledInput: {
    backgroundColor: "#F1F5F9",
    borderColor: "#CBD5E1",
    color: "#64748B",
  },
  quotationNoticeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#99F6E4",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  quotationNoticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F766E",
    marginBottom: 2,
  },
  quotationNoticeText: {
    fontSize: 12,
    color: "#115E59",
    lineHeight: 17,
  },

  safeArea: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  referenceBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  referenceBannerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  referenceBannerSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  centerLoader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    gap: 12,
  },
  centerLoaderText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  asterisk: {
    color: "#EF4444",
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  selectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  selectorBtnEmpty: {
    borderColor: "#E2E8F0",
  },
  selectorText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  placeholderText: {
    color: "#94A3B8",
    fontWeight: "normal",
  },
  selectorSubText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    padding: 0,
  },
  unitSuffix: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginLeft: 6,
  },
  dateChangeBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dateChangeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  taxInclusiveBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  addItemBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  itemBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  itemBoxHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  itemNumberBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemNumberText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  removeItemBtn: {
    padding: 4,
  },
  twoColRow: {
    flexDirection: "row",
    gap: 10,
  },
  totalsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 8,
    gap: 8,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalsLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  totalsValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  totalsGrandRow: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 10,
    marginTop: 4,
  },
  totalsGrandLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  totalsGrandValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2563EB",
  },
  textAreaContainer: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 10,
  },
  textArea: {
    fontSize: 14,
    color: "#0F172A",
    minHeight: 60,
    textAlignVertical: "top",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomTotalWrap: {
    flex: 1,
    marginRight: 12,
  },
  bottomTotalLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  bottomTotalAmount: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  bottomTotalSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  submitButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: "#93C5FD",
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 10,
    height: 38,
    gap: 6,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
  },
  modalItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  modalItemActive: {
    backgroundColor: "#EFF6FF",
  },
  modalItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  modalItemSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  modalEmpty: {
    padding: 30,
    alignItems: "center",
  },
  modalEmptyText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  calNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  calNavBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
  },
  calNavTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
  },
  dayHeaderCell: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    paddingVertical: 6,
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
  },
  dayCellSelected: {
    backgroundColor: "#2563EB",
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  dayCellTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
