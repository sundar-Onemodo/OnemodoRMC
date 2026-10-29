import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { RootState } from "@/store/store";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import axios from "axios";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { setMixDesigns as setReduxMixDesigns } from "../../store/quotationSlice";

export type LeadPriority = "High" | "Medium" | "Low";

export type LeadSource =
  | "Phone"
  | "Website"
  | "Referral"
  | "Walk-in"
  | "Campaign"
  | "Other";

export function normalizeSourceForApi(src: string): string {
  const s = (src || "").toLowerCase().trim();
  if (s === "referal" || s === "referral") return "Referral";
  if (s === "orther" || s === "other") return "Other";
  if (s === "phone") return "Phone";
  if (s === "website") return "Website";
  if (s === "walk-in" || s === "walkin") return "Walk-in";
  if (s === "campaign") return "Campaign";
  return src;
}

export type LeadStatus = "New" | "Contacted" | "Qualified" | "Unqualified";

export interface MixDesignDropdownItem {
  id: number;
  design_name: string;
  name?: string;
  design_code?: string | null;
  code?: string | null;
  rate_per_qty?: string;
  concrete_grade_id?: number;
}

const PRIORITY_OPTIONS: {
  label: string;
  value: LeadPriority;
  color: string;
}[] = [
  { label: "High", value: "High", color: "#DC2626" },
  { label: "Medium", value: "Medium", color: "#D97706" },
  { label: "Low", value: "Low", color: "#16A34A" },
];

const STATUS_OPTIONS: { label: string; value: LeadStatus; color: string }[] = [
  { label: "New", value: "New", color: "#2563EB" },
  { label: "Contacted", value: "Contacted", color: "#7C3AED" },
  { label: "Qualified", value: "Qualified", color: "#059669" },
  { label: "Unqualified", value: "Unqualified", color: "#DC2626" },
];

const SOURCE_OPTIONS: { label: string; value: LeadSource; icon: string }[] = [
  { label: "Phone", value: "Phone", icon: "call-outline" },
  { label: "Website", value: "Website", icon: "globe-outline" },
  { label: "Referral", value: "Referral", icon: "people-outline" },
  { label: "Walk-in", value: "Walk-in", icon: "walk-outline" },
  { label: "Campaign", value: "Campaign", icon: "megaphone-outline" },
  { label: "Other", value: "Other", icon: "ellipsis-horizontal-outline" },
];

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getFutureDateString(daysToAdd: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysToAdd);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateFriendly(dateStr?: string): string {
  if (!dateStr) return "Select Date";
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

// ==========================================
// MAIN CREATE LEAD SCREEN
// ==========================================

export default function CreateLeadScreen() {
  const dispatch = useDispatch();
  const { token, plant_id, plant_name } = useSelector(
    (state: RootState) => state.auth,
  );
  const cachedMixDesigns = useSelector(
    (state: RootState) => state.quotation?.mixDesigns,
  );

  const scrollViewRef = useRef<ScrollView>(null);

  // Form Fields
  const [projectName, setProjectName] = useState("");
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [requirement, setRequirement] = useState("");

  // Enquiry date auto-set in background
  const enquiryDate = useMemo(() => getTodayString(), []);

  // Priority, Source, Status with Radio Selection
  const [priority, setPriority] = useState<LeadPriority>("High");
  const [source, setSource] = useState<LeadSource>("Referral");
  const [status, setStatus] = useState<LeadStatus>("New");
  const [classificationPicker, setClassificationPicker] = useState<
    "priority" | "status" | "source" | null
  >(null);

  // Mix Design Dropdown API State (Loaded directly from API)
  const [mixDesigns, setMixDesigns] = useState<MixDesignDropdownItem[]>(() => {
    if (cachedMixDesigns && cachedMixDesigns.length > 0) {
      return cachedMixDesigns;
    }
    return [];
  });
  const [loadingMixDesigns, setLoadingMixDesigns] = useState<boolean>(() => {
    return !cachedMixDesigns || cachedMixDesigns.length === 0;
  });
  const [mixPickerOpen, setMixPickerOpen] = useState<boolean>(false);
  const [mixSearch, setMixSearch] = useState<string>("");

  // Selected Mix Design: Store both ID and Name
  const [selectedMixDesignId, setSelectedMixDesignId] = useState<number | null>(
    () => {
      if (cachedMixDesigns && cachedMixDesigns.length > 0) {
        return cachedMixDesigns[0].id;
      }
      return null;
    },
  );
  const [selectedMixDesignName, setSelectedMixDesignName] = useState<string>(
    () => {
      if (cachedMixDesigns && cachedMixDesigns.length > 0) {
        return (
          cachedMixDesigns[0].design_name || cachedMixDesigns[0].name || ""
        );
      }
      return "";
    },
  );

  // Concrete & Financial Specs
  const [estimatedQuantity, setEstimatedQuantity] = useState("40");
  const [expectedValue, setExpectedValue] = useState("200000");

  // Purchase date with Date Picker
  const [expectedPurchaseDate, setExpectedPurchaseDate] = useState<string>(
    getFutureDateString(14),
  );

  // Site & Address
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [address, setAddress] = useState("");
  const [remarks, setRemarks] = useState("");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasFetchedMixRef = useRef(false);

  // Fetch Mix Designs from API on mount (runs only once per session)
  useEffect(() => {
    // If cached in Redux, skip network call to prevent 429 rate limit
    if (cachedMixDesigns && cachedMixDesigns.length > 0) {
      return;
    }

    if (hasFetchedMixRef.current) return;
    hasFetchedMixRef.current = true;
    let isCancelled = false;

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

    axios
      .get(`${baseURL}/mix-designs`, {
        headers,
        params: { page: 1, per_page: 100 },
        timeout: 20000,
      })
      .then((res) => {
        console.log("MIX DES:", res.data);
        if (isCancelled) return;
        const list = res.data?.data?.data || res.data?.data || [];

        if (Array.isArray(list) && list.length > 0) {
          setMixDesigns(list);
          dispatch(setReduxMixDesigns(list));
          setSelectedMixDesignId((prev) => {
            if (prev !== null && list.some((m: any) => m.id === prev)) {
              return prev;
            }
            return list[0].id;
          });
          setSelectedMixDesignName((prev) => {
            const matched = list.find(
              (m: any) =>
                (m.design_name || m.name || "").toLowerCase().trim() ===
                prev.toLowerCase().trim(),
            );
            if (matched) return matched.design_name || matched.name;
            return list[0].design_name || list[0].name || prev;
          });
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        if (err?.response?.status === 429) {
          console.log(
            "Mix designs rate limited (429); utilizing cached designs.",
          );
        } else {
          console.warn("Could not load live mix designs:", err?.message || err);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingMixDesigns(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [token, plant_id, cachedMixDesigns, dispatch]);

  // Filtered Mix Designs for Search
  const filteredMixDesigns = useMemo(() => {
    if (!mixSearch.trim()) return mixDesigns;
    const q = mixSearch.toLowerCase().trim();
    return mixDesigns.filter(
      (m) =>
        (m.design_name || "").toLowerCase().includes(q) ||
        (m.name || "").toLowerCase().includes(q) ||
        (m.code || "").toLowerCase().includes(q) ||
        (m.design_code || "").toLowerCase().includes(q),
    );
  }, [mixDesigns, mixSearch]);

  // Calendar Modal State
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [calendarYear, setCalendarYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [calendarMonth, setCalendarMonth] = useState<number>(
    new Date().getMonth(),
  );

  // Calendar Month Days Calculation
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
    return { daysInMonth, firstDayIndex };
  }, [calendarYear, calendarMonth]);

  const openCalendar = () => {
    try {
      const parts = expectedPurchaseDate.split("-");
      if (parts.length === 3) {
        setCalendarYear(parseInt(parts[0], 10));
        setCalendarMonth(parseInt(parts[1], 10) - 1);
      }
    } catch {
      // fallback
    }
    setCalendarModalVisible(true);
  };

  const handleSelectDay = (day: number) => {
    const y = calendarYear;
    const m = String(calendarMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    setExpectedPurchaseDate(`${y}-${m}-${d}`);
    setCalendarModalVisible(false);
  };

  // Submit Lead to API
  const handleSubmitLead = async () => {
    if (!projectName.trim()) {
      Alert.alert("Missing Field", "Please enter Project Name.");
      return;
    }
    if (!contactName.trim()) {
      Alert.alert("Missing Field", "Please enter Contact Person Name.");
      return;
    }
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (!trimmedPhone && !trimmedEmail) {
      Alert.alert(
        "Missing Contact Info",
        "Please enter either a Phone Number or an Email Address.",
      );
      return;
    }
    if (!deliveryLocation.trim()) {
      Alert.alert("Missing Field", "Please enter Delivery Location.");
      return;
    }

    setIsSubmitting(true);

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

    // REQUIREMENT: send mix_design_id as number and requirement as text
    if (!selectedMixDesignId) {
      Alert.alert(
        "Missing Field",
        "Please select a Concrete Grade / Mix Spec from the list.",
      );
      return;
    }

    const resolvedAddress = address.trim() || deliveryLocation.trim();

    const payload: Record<string, any> = {
      contact_name: contactName.trim(),
      company_name: companyName.trim() || null,
      phone: trimmedPhone || null,
      email: trimmedEmail || null,
      enquiry_date: enquiryDate,
      source: normalizeSourceForApi(source),
      status,
      priority,
      requirement: requirement.trim() || null,
      mix_design_id: Number(selectedMixDesignId),
      estimated_quantity: parseFloat(estimatedQuantity) || 0,
      expected_value: parseFloat(expectedValue) || 0,
      expected_purchase_date: expectedPurchaseDate || null,
      remarks: remarks.trim() || null,
      delivery_location: deliveryLocation.trim(),
      address: resolvedAddress,
      project_name: projectName.trim(),
    };

    console.log("CHECK PAYLOAD:", payload);

    try {
      const response = await axios.post(`${baseURL}/leads`, payload, {
        headers,
        timeout: 25000,
      });

      console.log("CHECK RES:", response);

      if (response.data?.success) {
        Alert.alert(
          "Success",
          response.data?.message || "Lead created successfully!",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ],
        );
      } else {
        Alert.alert(
          "Lead Created",
          "Lead saved and registered in your pipeline.",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ],
        );
      }
    } catch (err: any) {
      console.warn("Create Lead Error Status:", err?.response?.status);
      console.warn("Create Lead Error:", err?.message || err);
      console.warn(
        "Create Lead Response Data:",
        JSON.stringify(err?.response?.data),
      );

      let serverMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Could not save lead to the server.";

      if (
        err?.response?.data?.errors &&
        typeof err.response.data.errors === "object"
      ) {
        const errorList = Object.entries(err.response.data.errors)
          .map(([k, v]) => `• ${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join("\n");
        serverMessage = `${serverMessage}\n\nValidation Details:\n${errorList}`;
      }

      Alert.alert(
        "Submission Notice",
        `Server Response: ${serverMessage}\n\nWould you like to keep working or return?`,
        [
          { text: "Keep Editing", style: "cancel" },
          { text: "Go Back", onPress: () => router.back() },
        ],
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2A4A" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Add New Lead</Text>
            <Text style={styles.headerSubtitle}>
              Plant: {plant_name || "Ready-Mix Concrete"}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* ==========================================
              SECTION 1: PROJECT & CONTACT DETAILS
          ========================================== */}
          <View style={styles.card}>
            <View style={styles.cardSectionHeader}>
              <Ionicons name="business" size={16} color="#2563EB" />
              <Text style={styles.cardSectionTitle}>
                Project & Contact Info
              </Text>
            </View>

            {/* Project Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                PROJECT NAME <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="construct-outline"
                  size={16}
                  color="#64748B"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Prestige Tech Park Tower B"
                  placeholderTextColor="#94A3B8"
                  value={projectName}
                  onChangeText={setProjectName}
                />
              </View>
            </View>

            {/* Contact Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                CONTACT NAME <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="person-outline"
                  size={16}
                  color="#64748B"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Arun Kumar"
                  placeholderTextColor="#94A3B8"
                  value={contactName}
                  onChangeText={setContactName}
                />
              </View>
            </View>

            {/* Company Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>COMPANY NAME</Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="briefcase-outline"
                  size={16}
                  color="#64748B"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Kavin Builders"
                  placeholderTextColor="#94A3B8"
                  value={companyName}
                  onChangeText={setCompanyName}
                />
              </View>
            </View>

            {/* Phone & Email in 2 columns */}
            <View style={styles.twoColRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>
                  PHONE NUMBER{" "}
                  {!email.trim() ? (
                    <Text style={styles.requiredStar}>*</Text>
                  ) : null}
                </Text>
                <View style={styles.inputBox}>
                  <Ionicons
                    name="call-outline"
                    size={16}
                    color="#64748B"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="9876543210"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>
                  EMAIL ADDRESS{" "}
                  {!phone.trim() ? (
                    <Text style={styles.requiredStar}>*</Text>
                  ) : null}
                </Text>
                <View style={styles.inputBox}>
                  <Ionicons
                    name="mail-outline"
                    size={16}
                    color="#64748B"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="name@domain.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>
            </View>
            <Text
              style={{
                fontSize: 11,
                color: "#64748B",
                marginTop: -6,
                marginBottom: 8,
              }}
            >
              * Either Phone number or Email is required
            </Text>
          </View>

          {/* ==========================================
              SECTION 2: CLASSIFICATION (3 DROPDOWNS IN ONE ROW)
          ========================================== */}
          <View style={styles.card}>
            <View style={styles.cardSectionHeader}>
              <Ionicons name="options" size={16} color="#2563EB" />
              <Text style={styles.cardSectionTitle}>Lead Classification</Text>
            </View>

            <View style={styles.threeColRow}>
              {/* 1. Priority Dropdown */}
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel} numberOfLines={1}>
                  PRIORITY
                </Text>
                <TouchableOpacity
                  style={styles.dropdownTriggerCompact}
                  onPress={() => setClassificationPicker("priority")}
                  activeOpacity={0.8}
                >
                  <View style={styles.dropdownTriggerLeftCompact}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                          PRIORITY_OPTIONS.find((p) => p.value === priority)
                            ?.color || "#2563EB",
                        marginRight: 5,
                      }}
                    />
                    <Text
                      style={styles.dropdownTriggerTextCompact}
                      numberOfLines={1}
                    >
                      {priority}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* 2. Status Dropdown */}
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel} numberOfLines={1}>
                  STATUS
                </Text>
                <TouchableOpacity
                  style={styles.dropdownTriggerCompact}
                  onPress={() => setClassificationPicker("status")}
                  activeOpacity={0.8}
                >
                  <View style={styles.dropdownTriggerLeftCompact}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                          STATUS_OPTIONS.find((s) => s.value === status)
                            ?.color || "#2563EB",
                        marginRight: 5,
                      }}
                    />
                    <Text
                      style={styles.dropdownTriggerTextCompact}
                      numberOfLines={1}
                    >
                      {status}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* 3. Lead Source Dropdown */}
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel} numberOfLines={1}>
                  SOURCE
                </Text>
                <TouchableOpacity
                  style={styles.dropdownTriggerCompact}
                  onPress={() => setClassificationPicker("source")}
                  activeOpacity={0.8}
                >
                  <View style={styles.dropdownTriggerLeftCompact}>
                    <Ionicons
                      name={
                        (SOURCE_OPTIONS.find((s) => s.value === source)
                          ?.icon as any) || "pricetag-outline"
                      }
                      size={13}
                      color="#2563EB"
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={styles.dropdownTriggerTextCompact}
                      numberOfLines={1}
                    >
                      {source}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ==========================================
              SECTION 3: CONCRETE REQUIREMENT & FINANCIALS & PURCHASE DATE
          ========================================== */}
          <View style={styles.card}>
            <View style={styles.cardSectionHeader}>
              <MaterialCommunityIcons
                name="cube-outline"
                size={16}
                color="#2563EB"
              />
              <Text style={styles.cardSectionTitle}>Concrete Requirement</Text>
            </View>

            {/* Mix Design Dropdown from API */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                CONCRETE GRADE / MIX SPEC{" "}
                <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => {
                  setMixSearch("");
                  setMixPickerOpen(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownTriggerLeft}>
                  <MaterialCommunityIcons
                    name="layers-triple-outline"
                    size={18}
                    color="#2563EB"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.dropdownTriggerText,
                      !selectedMixDesignName && styles.dropdownPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {selectedMixDesignName || "Select Concrete Mix Design..."}
                  </Text>
                </View>
                <View style={styles.dropdownTriggerRight}>
                  {loadingMixDesigns ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : (
                    <Ionicons name="chevron-down" size={18} color="#64748B" />
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Requirement Text Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>REQUIREMENT</Text>
              <View style={styles.inputBox}>
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={16}
                  color="#2563EB"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Top floor, Foundation, Slab..."
                  placeholderTextColor="#94A3B8"
                  value={requirement}
                  onChangeText={setRequirement}
                />
              </View>
            </View>

            {/* Estimated Qty & Expected Value */}
            <View style={styles.twoColRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>
                  EST. QUANTITY (m³) <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.inputBox}>
                  <MaterialCommunityIcons
                    name="truck-outline"
                    size={16}
                    color="#2563EB"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 40"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={estimatedQuantity}
                    onChangeText={setEstimatedQuantity}
                  />
                </View>
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>EXPECTED VALUE (₹)</Text>
                <View style={styles.inputBox}>
                  <Ionicons
                    name="cash-outline"
                    size={16}
                    color="#16A34A"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 200000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={expectedValue}
                    onChangeText={setExpectedValue}
                  />
                </View>
              </View>
            </View>

            {/* Expected Purchase Date: Interactive Date Picker with Calendar Icon */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                EXPECTED PURCHASE DATE{" "}
                <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={openCalendar}
                activeOpacity={0.8}
              >
                <View style={styles.datePickerLeft}>
                  <Ionicons name="calendar-outline" size={18} color="#2563EB" />
                  <Text style={styles.datePickerText}>
                    {formatDateFriendly(expectedPurchaseDate)}
                  </Text>
                  <Text style={styles.datePickerRaw}>
                    ({expectedPurchaseDate})
                  </Text>
                </View>
                <View style={styles.datePickerIconRight}>
                  <Text style={styles.changeDateLabel}>Change Date</Text>
                  <Ionicons name="chevron-forward" size={14} color="#2563EB" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ==========================================
              SECTION 5: SITE LOCATION & REMARKS (LOCATION & NOTES)
          ========================================== */}
          <View style={styles.card}>
            <View style={styles.cardSectionHeader}>
              <Ionicons name="location" size={16} color="#DC2626" />
              <Text style={styles.cardSectionTitle}>Location & Notes</Text>
            </View>

            {/* Delivery Location */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                DELIVERY LOCATION <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="navigate-outline"
                  size={16}
                  color="#DC2626"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Madurai, Site Gate 2"
                  placeholderTextColor="#94A3B8"
                  value={deliveryLocation}
                  onChangeText={setDeliveryLocation}
                />
              </View>
            </View>

            {/* Address */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SITE / BILLING ADDRESS</Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="map-outline"
                  size={16}
                  color="#64748B"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Gopalan Industrial Layout"
                  placeholderTextColor="#94A3B8"
                  value={address}
                  onChangeText={setAddress}
                />
              </View>
            </View>

            {/* Remarks */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>REMARKS / PUMPING NOTES</Text>
              <TextInput
                style={styles.textAreaInput}
                placeholder="Site enquiry, pump requirements, timing..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={remarks}
                onChangeText={setRemarks}
              />
            </View>
          </View>

          {/* ACTION BUTTONS (IN-SCROLL AT BOTTOM OF FORM - NO FIXED FOOTER) */}
          <View style={styles.inScrollActionsRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => router.back()}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSubmitLead}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Create Lead</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Extra spacing */}
          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ==========================================
          CLASSIFICATION DROPDOWN PICKER MODAL
      ========================================== */}
      <Modal
        visible={classificationPicker !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setClassificationPicker(null)}
      >
        <TouchableOpacity
          style={styles.pickerModalOverlay}
          activeOpacity={1}
          onPress={() => setClassificationPicker(null)}
        >
          <View
            style={styles.pickerModalContent}
            onStartShouldSetResponder={() => true}
          >
            {/* Modal Title & Close */}
            <View style={styles.pickerModalHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>
                  {classificationPicker === "priority"
                    ? "Select Priority"
                    : classificationPicker === "status"
                      ? "Select Status"
                      : "Select Lead Source"}
                </Text>
                <Text style={styles.pickerModalSubtitle}>
                  {classificationPicker === "priority"
                    ? "Set the urgency level for this lead"
                    : classificationPicker === "status"
                      ? "Current pipeline stage of the lead"
                      : "Channel or source of discovery"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.pickerCloseBtn}
                onPress={() => setClassificationPicker(null)}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* List options */}
            <ScrollView
              style={{ maxHeight: 380 }}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 24,
              }}
            >
              {classificationPicker === "priority" &&
                PRIORITY_OPTIONS.map((opt) => {
                  const isSelected = priority === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.classificationItemRow,
                        isSelected && styles.classificationItemRowSelected,
                      ]}
                      onPress={() => {
                        setPriority(opt.value);
                        setClassificationPicker(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: opt.color,
                          }}
                        />
                        <Text
                          style={[
                            styles.classificationItemLabel,
                            isSelected && {
                              color: opt.color,
                              fontWeight: "800",
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={opt.color}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}

              {classificationPicker === "status" &&
                STATUS_OPTIONS.map((opt) => {
                  const isSelected = status === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.classificationItemRow,
                        isSelected && styles.classificationItemRowSelected,
                      ]}
                      onPress={() => {
                        setStatus(opt.value);
                        setClassificationPicker(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: opt.color,
                          }}
                        />
                        <Text
                          style={[
                            styles.classificationItemLabel,
                            isSelected && {
                              color: opt.color,
                              fontWeight: "800",
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={opt.color}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}

              {classificationPicker === "source" &&
                SOURCE_OPTIONS.map((opt) => {
                  const isSelected = source === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.classificationItemRow,
                        isSelected && styles.classificationItemRowSelected,
                      ]}
                      onPress={() => {
                        setSource(opt.value);
                        setClassificationPicker(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <Ionicons
                          name={opt.icon as any}
                          size={18}
                          color={isSelected ? "#2563EB" : "#64748B"}
                        />
                        <Text
                          style={[
                            styles.classificationItemLabel,
                            isSelected && {
                              color: "#2563EB",
                              fontWeight: "800",
                            },
                          ]}
                        >
                          {opt.label}
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
                })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ==========================================
          MIX DESIGN SEARCHABLE PICKER MODAL (DROPDOWN API)
      ========================================== */}
      <Modal
        visible={mixPickerOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMixPickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            {/* Modal Title & Close */}
            <View style={styles.pickerModalHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>Select Mix Design</Text>
                <Text style={styles.pickerModalSubtitle}>
                  Choose from available plant concrete grades
                </Text>
              </View>
              <TouchableOpacity
                style={styles.pickerCloseBtn}
                onPress={() => setMixPickerOpen(false)}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.pickerSearchBox}>
              <Ionicons name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Search mix design (e.g. M20, M25, M30)..."
                placeholderTextColor="#94A3B8"
                value={mixSearch}
                onChangeText={setMixSearch}
              />
              {mixSearch.length > 0 && (
                <TouchableOpacity onPress={() => setMixSearch("")}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Mix Designs List */}
            <FlatList
              data={filteredMixDesigns}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 24,
              }}
              renderItem={({ item }) => {
                const name = item.design_name || item.name || "Mix Design";
                const isSelected = selectedMixDesignId === item.id;
                const rateNum = parseFloat(item.rate_per_qty || "0");

                return (
                  <TouchableOpacity
                    style={[
                      styles.pickerItemRow,
                      isSelected && styles.pickerItemRowSelected,
                    ]}
                    onPress={() => {
                      setSelectedMixDesignId(item.id);
                      setSelectedMixDesignName(name);
                      if (rateNum > 0 && parseFloat(estimatedQuantity) > 0) {
                        setExpectedValue(
                          String(rateNum * parseFloat(estimatedQuantity)),
                        );
                      }
                      setMixPickerOpen(false);
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
                        {name}
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
                    No mix designs found matching &quot;{mixSearch}&quot;
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* ==========================================
          CALENDAR DATE PICKER MODAL
      ========================================== */}
      <Modal
        visible={calendarModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarCard}>
            {/* Calendar Modal Header */}
            <View style={styles.calendarHeader}>
              <View>
                <Text style={styles.calendarModalTitle}>
                  Expected Purchase Date
                </Text>
                <Text style={styles.calendarModalSubtitle}>
                  Select estimated order / pouring date
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setCalendarModalVisible(false)}
              >
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
            <View style={styles.presetsRow}>
              {[7, 15, 30].map((days) => (
                <TouchableOpacity
                  key={days}
                  style={styles.presetChip}
                  onPress={() => {
                    setExpectedPurchaseDate(getFutureDateString(days));
                    setCalendarModalVisible(false);
                  }}
                >
                  <Text style={styles.presetChipText}>+{days} Days</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Weekday Headers */}
            <View style={styles.dayOfWeekRow}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
                <Text key={i} style={styles.dayOfWeekText}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.daysGrid}>
              {Array.from({ length: calendarDays.firstDayIndex }).map(
                (_, idx) => (
                  <View key={`empty-${idx}`} style={styles.dayCellEmpty} />
                ),
              )}

              {Array.from({ length: calendarDays.daysInMonth }).map(
                (_, idx) => {
                  const day = idx + 1;
                  const currentMonthStr = String(calendarMonth + 1).padStart(
                    2,
                    "0",
                  );
                  const currentDayStr = String(day).padStart(2, "0");
                  const cellDateStr = `${calendarYear}-${currentMonthStr}-${currentDayStr}`;
                  const isSelected = expectedPurchaseDate === cellDateStr;

                  return (
                    <TouchableOpacity
                      key={`day-${day}`}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                      ]}
                      onPress={() => handleSelectDay(day)}
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

            {/* Footer */}
            <TouchableOpacity
              style={styles.calendarCancelBtn}
              onPress={() => setCalendarModalVisible(false)}
            >
              <Text style={styles.calendarCancelBtnText}>Done</Text>
            </TouchableOpacity>
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
    backgroundColor: "#0B2A4A",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
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
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  headerCalendarBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginLeft: 8,
  },
  headerCalendarBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  classificationItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    borderRadius: 8,
  },
  classificationItemRowSelected: {
    backgroundColor: "#EFF6FF",
  },
  classificationItemLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  headerSaveBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  headerSaveBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 50,
    gap: 14,
  },

  // CARD CONTAINERS
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
    gap: 12,
  },
  cardSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },

  // FIELD GROUPS
  fieldGroup: {
    gap: 5,
  },
  twoColRow: {
    flexDirection: "row",
    gap: 10,
  },
  threeColRow: {
    flexDirection: "row",
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    letterSpacing: 0.3,
  },
  requiredStar: {
    color: "#DC2626",
    fontWeight: "800",
  },
  labelWithBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  helperText: {
    fontSize: 11,
    color: "#94A3B8",
  },

  // INPUTS
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    paddingVertical: 0,
  },
  textAreaInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
    height: 75,
    textAlignVertical: "top",
  },

  // DROPDOWN TRIGGER (MIX DESIGN)
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
  },
  dropdownTriggerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dropdownTriggerRight: {
    marginLeft: 8,
  },
  dropdownTriggerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  dropdownPlaceholder: {
    color: "#94A3B8",
    fontWeight: "500",
  },
  dropdownTriggerCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 42,
  },
  dropdownTriggerLeftCompact: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 2,
  },
  dropdownTriggerTextCompact: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F172A",
    flex: 1,
  },

  // RADIO BUTTONS
  radioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  radioCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  radioCardSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  radioCircleSelected: {
    borderColor: "#2563EB",
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#2563EB",
  },
  radioLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    flex: 1,
  },
  radioLabelSelected: {
    fontWeight: "700",
    color: "#1D4ED8",
  },

  // DATE PICKER BUTTON
  datePickerBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  datePickerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  datePickerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E40AF",
  },
  datePickerRaw: {
    fontSize: 11,
    color: "#64748B",
  },
  datePickerIconRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  changeDateLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },

  // IN-SCROLL ACTIONS ROW (FLOWS NATURALLY AT BOTTOM OF FORM)
  inScrollActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  saveBtn: {
    flex: 2,
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    elevation: 2,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // PICKER MODAL (BOTTOM SHEET FOR MIX DESIGN)
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  pickerModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    paddingTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  pickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  pickerModalSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  pickerCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    marginLeft: 6,
    paddingVertical: 0,
  },
  pickerItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    borderRadius: 8,
  },
  pickerItemRowSelected: {
    backgroundColor: "#EFF6FF",
  },
  pickerItemLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  pickerItemLabelSelected: {
    color: "#2563EB",
  },
  pickerItemRate: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    marginTop: 2,
  },
  mixIdTag: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  mixIdTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
  },
  pickerEmpty: {
    paddingVertical: 30,
    alignItems: "center",
  },
  pickerEmptyText: {
    fontSize: 13,
    color: "#94A3B8",
  },

  // CALENDAR MODAL
  calendarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    maxWidth: 360,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  calendarModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  calendarModalSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  monthNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  monthNavTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
  },
  presetsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  presetChip: {
    flex: 1,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: "center",
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  dayOfWeekRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  dayOfWeekText: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
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
  },
  dayCellSelected: {
    backgroundColor: "#2563EB",
  },
  dayCellText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E293B",
  },
  dayCellTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  calendarCancelBtn: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  calendarCancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
});
