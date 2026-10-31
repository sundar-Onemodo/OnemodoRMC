import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { fetchDropdowns } from "@/store/dropdownSlice";
import { AppDispatch, RootState } from "@/store/store";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import axios from "axios";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

// ==========================================
// TYPES & INTERFACES (Based on API response)
// ==========================================

export interface LeadOwner {
  id: number;
  username: string;
  profile_photo_url?: string | null;
}

export interface LeadItem {
  id: number;
  plant_id?: number;
  lead_number: string;
  enquiry_date: string;
  contact_name: string;
  company_name?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  source?: string | null;
  status: string;
  priority: string;
  assigned_to?: number | null;
  project_name: string;
  requirement: string;
  estimated_quantity: string | number;
  delivery_location: string;
  expected_value: string | number;
  expected_purchase_date?: string | null;
  remarks?: string | null;
  lost_reason?: string | null;
  customer_id?: number | null;
  converted_at?: string | null;
  created_at?: string;
  created_by?: number;
  updated_at?: string;
  updated_by?: number;
  deleted_at?: string | null;
  deleted_by?: number | null;
  mix_design_id?: number | null;
  mix_design?:
    | {
        id?: number;
        name?: string;
        design_name?: string;
        code?: string;
        design_code?: string;
        [key: string]: any;
      }
    | string
    | null;
  next_follow_up?: string | null;
  owner?: LeadOwner | null;
}

// ==========================================
// API HELPER
// ==========================================

async function fetchLeadsApi(
  token: string | null,
  plantId: number | null,
  page: number = 1,
  perPage: number = 50,
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

  const params: Record<string, any> = {
    page,
    per_page: perPage,
  };
  if (plantId !== null && plantId !== undefined) {
    params.plant_id = String(plantId);
  }

  return axios.get(`${baseURL}/leads`, {
    headers,
    params,
    timeout: 25000,
  });
}

// ==========================================
// FORMATTING HELPERS
// ==========================================

function formatCurrency(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "₹ 0";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return `₹ ${value}`;
  return `₹ ${num.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

function formatQuantity(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "0 m³";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return `${value} m³`;
  return `${num} m³`;
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
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
    return dateStr.split("T")[0];
  } catch {
    return dateStr;
  }
}

function getLeadMixDesignDisplayName(
  item: LeadItem,
  cachedMixDesigns?: any[],
): string {
  if (item.mix_design) {
    if (typeof item.mix_design === "object") {
      const name =
        item.mix_design.design_name ||
        item.mix_design.name ||
        item.mix_design.code ||
        item.mix_design.design_code;
      if (name) return String(name);
    } else if (typeof item.mix_design === "string" && item.mix_design.trim()) {
      return item.mix_design.trim();
    }
  }

  if (item.mix_design_id && cachedMixDesigns && cachedMixDesigns.length > 0) {
    const found = cachedMixDesigns.find(
      (m: any) => Number(m.id) === Number(item.mix_design_id),
    );
    if (found) {
      return (
        found.design_name ||
        found.name ||
        found.code ||
        `Mix #${item.mix_design_id}`
      );
    }
  }

  if (item.mix_design_id) {
    return `Mix #${item.mix_design_id}`;
  }

  // Fallback if legacy lead stored mix design name in requirement (e.g. "M20 MP")
  if (item.requirement && isNaN(Number(item.requirement))) {
    return item.requirement;
  }

  return "Standard Mix";
}

function getPriorityBadge(priority: string) {
  const p = (priority || "").toLowerCase();
  switch (p) {
    case "urgent":
      return {
        bg: "#FEF2F2",
        text: "#DC2626",
        border: "#FCA5A5",
        dot: "#EF4444",
      };
    case "high":
      return {
        bg: "#FFF7ED",
        text: "#C2410C",
        border: "#FDBA74",
        dot: "#EA580C",
      };
    case "medium":
      return {
        bg: "#FEFCE8",
        text: "#A16207",
        border: "#FDE047",
        dot: "#CA8A04",
      };
    case "low":
    default:
      return {
        bg: "#F0FDF4",
        text: "#15803D",
        border: "#86EFAC",
        dot: "#16A34A",
      };
  }
}

function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "new":
      return { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" };
    case "in negotiation":
    case "negotiation":
    case "in progress":
      return { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" };
    case "qualified":
    case "won":
      return { bg: "#DCFCE7", text: "#15803D", border: "#86EFAC" };
    case "approved":
      return { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" };
    case "converted":
      return { bg: "#CCFBF1", text: "#0F766E", border: "#99F6E4" };
    case "lost":
    case "unqualified":
    case "cancelled":
      return { bg: "#FFE4E6", text: "#BE123C", border: "#FECDD3" };
    case "contacted":
      return { bg: "#F3E8FF", text: "#7E22CE", border: "#D8B4FE" };
    default:
      return { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" };
  }
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function LeadScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { token, plant_id, plant_name } = useSelector(
    (state: RootState) => state.auth,
  );
  const cachedMixDesigns = useSelector(
    (state: RootState) => state.quotation?.mixDesigns,
  );
  const {
    leadStatuses: reduxLeadStatuses,
    leadStatusOptions: reduxLeadStatusOptions,
    isLoaded: dropdownsLoaded,
  } = useSelector((state: RootState) => state.dropdowns);

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatusFilter, setActiveStatusFilter] = useState("All");

  // Load dropdowns if not yet loaded
  useEffect(() => {
    if (!dropdownsLoaded) {
      dispatch(fetchDropdowns({ token, plant_id }));
    }
  }, [dropdownsLoaded, dispatch, token, plant_id]);

  // Initial single API load on mount or auth change
  useEffect(() => {
    let isCancelled = false;

    fetchLeadsApi(token, plant_id, 1, 50)
      .then((response) => {
        if (isCancelled) return;
        const resData = response.data;
        let fetchedList: LeadItem[] = [];
        if (Array.isArray(resData?.data?.data)) {
          fetchedList = resData.data.data;
        } else if (Array.isArray(resData?.data)) {
          fetchedList = resData.data;
        }

        if (fetchedList.length > 0) {
          setLeads(fetchedList);
        } else {
          setLeads([]);
        }
      })
      .catch((err: any) => {
        if (isCancelled) return;
        console.warn("API leads load note:", err?.message || err);
        const errMsg =
          err?.response?.data?.message ||
          err?.message ||
          "Could not connect to leads server.";
        setErrorMessage(errMsg);
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

  // Manual pull-to-refresh or retry
  const handleManualRefresh = useCallback(
    (isPull = false) => {
      if (isPull) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);

      fetchLeadsApi(token, plant_id, 1, 50)
        .then((response) => {
          const resData = response.data;
          let fetchedList: LeadItem[] = [];
          if (Array.isArray(resData?.data?.data)) {
            fetchedList = resData.data.data;
          } else if (Array.isArray(resData?.data)) {
            fetchedList = resData.data;
          }

          if (fetchedList.length > 0) {
            setLeads(fetchedList);
          } else {
            setLeads([]);
          }
        })
        .catch((err: any) => {
          console.warn("API leads load note:", err?.message || err);
          const errMsg =
            err?.response?.data?.message ||
            err?.message ||
            "Could not connect to leads server.";
          setErrorMessage(errMsg);
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [token, plant_id],
  );

  // Back navigation directly to More screen (no .back or goBack)
  const handleBack = useCallback(() => {
    router.replace("/more" as any);
  }, []);

  // Automatically refresh when screen regains focus and register hardware back handler
  useFocusEffect(
    useCallback(() => {
      fetchLeadsApi(token, plant_id, 1, 50)
        .then((response) => {
          const resData = response.data;
          let fetchedList: LeadItem[] = [];
          if (Array.isArray(resData?.data?.data)) {
            fetchedList = resData.data.data;
          } else if (Array.isArray(resData?.data)) {
            fetchedList = resData.data;
          }
          if (fetchedList.length > 0) {
            setLeads(fetchedList);
          }
        })
        .catch(() => {});

      const onBackPress = () => {
        handleBack();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      return () => subscription.remove();
    }, [token, plant_id, handleBack]),
  );

  // Phone Call Action
  const handleCall = (phone: string) => {
    if (!phone) {
      Alert.alert("No Phone Number", "This lead does not have a phone number.");
      return;
    }
    const cleanPhone = phone.replace(/[^\d+]/g, "");
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert("Unable to Call", `Could not initiate call to ${phone}`);
    });
  };

  // Email Action
  const handleEmail = (email?: string | null) => {
    if (!email) {
      Alert.alert("No Email", "This lead does not have an email address.");
      return;
    }
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert("Unable to Email", `Could not open mail app for ${email}`);
    });
  };

  // Quick Status Picker State
  const [selectedLeadForStatus, setSelectedLeadForStatus] =
    useState<LeadItem | null>(null);
  const [statusPickerVisible, setStatusPickerVisible] =
    useState<boolean>(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  // Unqualified Lost Reason Modal State
  const [unqualifiedModalVisible, setUnqualifiedModalVisible] =
    useState<boolean>(false);
  const [targetLeadForUnqualified, setTargetLeadForUnqualified] =
    useState<LeadItem | null>(null);
  const [unqualifiedLostReason, setUnqualifiedLostReason] =
    useState<string>("Reject this");
  const [isSubmittingUnqualified, setIsSubmittingUnqualified] =
    useState<boolean>(false);

  const handleOpenStatusPicker = (lead: LeadItem) => {
    const s = (lead.status || "").toLowerCase().trim();
    if (s === "qualified" || s === "approved" || s === "converted") {
      return;
    }
    setSelectedLeadForStatus(lead);
    setStatusPickerVisible(true);
  };

  const handleSelectStatus = async (newStatus: string) => {
    if (!selectedLeadForStatus) return;
    const targetLead = selectedLeadForStatus;
    setStatusPickerVisible(false);

    if (targetLead.status?.toLowerCase() === newStatus.toLowerCase()) return;

    if (newStatus.toLowerCase() === "unqualified") {
      setTargetLeadForUnqualified(targetLead);
      setUnqualifiedLostReason("Reject this");
      setUnqualifiedModalVisible(true);
      return;
    }

    setUpdatingStatusId(targetLead.id);

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

    const resolvedAddress =
      targetLead.address || targetLead.delivery_location || "";
    const rawSource = (targetLead.source || "Referral").toLowerCase();
    const sourceToSend =
      rawSource === "referal" || rawSource === "referral"
        ? "Referral"
        : rawSource === "orther" || rawSource === "other"
          ? "Other"
          : targetLead.source || "Referral";

    const resolvedMixDesignId =
      targetLead.mix_design_id !== undefined &&
      targetLead.mix_design_id !== null
        ? Number(targetLead.mix_design_id)
        : typeof targetLead.mix_design === "object" && targetLead.mix_design?.id
          ? Number(targetLead.mix_design.id)
          : targetLead.requirement && !isNaN(Number(targetLead.requirement))
            ? Number(targetLead.requirement)
            : null;

    const payload: Record<string, any> = {
      contact_name: targetLead.contact_name,
      company_name: targetLead.company_name || null,
      phone: targetLead.phone || null,
      email: targetLead.email || null,
      enquiry_date: targetLead.enquiry_date,
      source: sourceToSend,
      status: newStatus,
      priority: targetLead.priority || "Medium",
      requirement: targetLead.requirement || null,
      mix_design_id: resolvedMixDesignId,
      estimated_quantity: parseFloat(
        String(targetLead.estimated_quantity || 0),
      ),
      expected_value: parseFloat(String(targetLead.expected_value || 0)),
      expected_purchase_date: targetLead.expected_purchase_date || null,
      remarks: targetLead.remarks || null,
      delivery_location: targetLead.delivery_location,
      address: resolvedAddress,
      project_name: targetLead.project_name,
    };

    const isQualifying = newStatus.toLowerCase() === "new";
    const requestUrl = isQualifying
      ? `${baseURL}/leads/${targetLead.id}`
      : `${baseURL}/leads/${targetLead.id}`;
    const requestMethod = isQualifying ? "POST" : "PATCH";

    console.log("==================================================");
    console.log("[Lead Status Update] Initiating Status Change Request");
    console.log("[Lead Status Update] Target Lead ID:", targetLead.id);
    console.log("[Lead Status Update] New Status:", newStatus);
    console.log("[Lead Status Update] Method:", requestMethod);
    console.log("[Lead Status Update] API URL:", requestUrl);
    console.log("[Lead Status Update] Params:", { lead: targetLead.id });
    console.log(
      "[Lead Status Update] Headers:",
      JSON.stringify(headers, null, 2),
    );
    console.log(
      "[Lead Status Update] Payload:",
      JSON.stringify(payload, null, 2),
    );
    console.log("==================================================");

    try {
      const response = isQualifying
        ? await axios.post(requestUrl, payload, {
            headers,
            params: { lead: targetLead.id },
            timeout: 20000,
          })
        : await axios.patch(requestUrl, payload, {
            headers,
            params: { lead: targetLead.id },
            timeout: 20000,
          });

      console.log("==================================================");
      console.log("[Lead Status Update] Response Status:", response.status);
      console.log(
        "[Lead Status Update] Response Data:",
        JSON.stringify(response.data, null, 2),
      );
      console.log("==================================================");

      // Update particular card in leads state
      setLeads((prev) =>
        prev.map((l) =>
          l.id === targetLead.id ? { ...l, status: newStatus } : l,
        ),
      );
    } catch (err: any) {
      console.error("==================================================");
      console.error("[Lead Status Update] Error Occurred!");
      console.error("[Lead Status Update] Request URL:", requestUrl);
      console.error(
        "[Lead Status Update] HTTP Status Code:",
        err?.response?.status,
      );
      console.error(
        "[Lead Status Update] Response Data:",
        JSON.stringify(err?.response?.data || {}, null, 2),
      );
      console.error(
        "[Lead Status Update] Response Headers:",
        JSON.stringify(err?.response?.headers || {}, null, 2),
      );
      console.error("[Lead Status Update] Error Message:", err?.message || err);
      console.error("==================================================");
      console.warn("Status update note:", err?.message || err);
      Alert.alert(
        "Update Notice",
        err?.response?.data?.message || "Could not update status on server.",
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };


  const handleConfirmUnqualified = async () => {
    if (!targetLeadForUnqualified) return;
    const targetLead = targetLeadForUnqualified;
    const reasonToSend = unqualifiedLostReason.trim() || "Reject this";

    setUpdatingStatusId(targetLead.id);
    setIsSubmittingUnqualified(true);

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

    const payload = {
      status: "Unqualified",
      lost_reason: reasonToSend,
    };

    const requestUrl = `${baseURL}/leads/${targetLead.id}`;
    console.log("[Lead Unqualified PATCH] URL:", requestUrl);
    console.log("[Lead Unqualified PATCH] Payload:", JSON.stringify(payload, null, 2));

    try {
      const response = await axios.patch(requestUrl, payload, {
        headers,
        params: { lead: targetLead.id },
        timeout: 20000,
      });

      console.log("[Lead Unqualified PATCH] Response:", response.data);

      setLeads((prev) =>
        prev.map((l) =>
          l.id === targetLead.id
            ? { ...l, status: "Unqualified", lost_reason: reasonToSend }
            : l,
        ),
      );

      setUnqualifiedModalVisible(false);
      setTargetLeadForUnqualified(null);
      Alert.alert(
        "Lead Unqualified",
        "Lead status updated to Unqualified.",
      );
    } catch (err: any) {
      console.error(
        "[Lead Unqualified PATCH] Error:",
        err?.response?.data || err?.message,
      );
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to update lead status to Unqualified.";
      Alert.alert("Update Failed", errMsg);
    } finally {
      setIsSubmittingUnqualified(false);
      setUpdatingStatusId(null);
    }
  };

  // Full Edit Lead Action (navigates to editLeadScreen)
  const handleNavigateToEditLead = (leadOrId: LeadItem | number) => {
    const lead =
      typeof leadOrId === "object"
        ? leadOrId
        : leads.find((l) => l.id === leadOrId);
    const id = typeof leadOrId === "object" ? leadOrId.id : leadOrId;

    const assignedToVal =
      lead?.assigned_to !== undefined && lead?.assigned_to !== null
        ? String(lead.assigned_to)
        : lead?.owner?.id
          ? String(lead.owner.id)
          : "";

    const mixIdVal =
      lead?.mix_design_id !== undefined && lead?.mix_design_id !== null
        ? String(lead.mix_design_id)
        : typeof lead?.mix_design === "object" && lead?.mix_design?.id
          ? String(lead.mix_design.id)
          : "";

    const mixNameVal =
      typeof lead?.mix_design === "object"
        ? lead?.mix_design?.design_name ||
          lead?.mix_design?.name ||
          lead?.mix_design?.code ||
          ""
        : "";

    router.push({
      pathname: "/lead/editLeadScreen" as any,
      params: {
        id: String(id),
        assigned_to: assignedToVal,
        mix_design_id: mixIdVal,
        mix_design_name: mixNameVal,
        leadData: lead ? JSON.stringify(lead) : "",
      },
    });
  };

  // Navigate to Create Quotation Screen from Qualified Lead
  const handleCreateQuotationFromLead = (lead: LeadItem) => {
    const customerDisplayName = lead.company_name || lead.contact_name || "";
    const deliveryLocationName = lead.delivery_location || lead.address || "";
    const mixDesignDisplayName = getLeadMixDesignDisplayName(
      lead,
      cachedMixDesigns,
    );

    const payloadToPass = {
      fromLead: "true",
      returnTo: "/lead",
      timestamp: String(Date.now()),
      leadId: String(lead.id),
      leadNumber: lead.lead_number,
      customerName: customerDisplayName,
      deliveryLocation: deliveryLocationName,
      contactName: lead.contact_name || "",
      companyName: lead.company_name || "",
      phone: lead.phone || "",
      email: lead.email || "",
      address: lead.address || "",
      customerId: lead.customer_id ? String(lead.customer_id) : "",
      projectName: lead.project_name || "",
      requirement: lead.requirement || "",
      estimatedQuantity: String(lead.estimated_quantity || ""),
      expectedValue: String(lead.expected_value || ""),
      remarks: lead.remarks || "",
      leadData: JSON.stringify(lead),
    };

    console.log(
      "[LeadScreen] Navigating to createQuotationScreen with entire lead payload:",
      JSON.stringify(payloadToPass, null, 2),
    );

    router.push({
      pathname: "/quotation/createQuotationScreen" as any,
      params: payloadToPass,
    });
  };

  // Navigate to Create Lead Screen
  const handleNavigateToAddLead = () => {
    router.push("/lead/createLeadScreen" as any);
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Status filter
      if (
        activeStatusFilter !== "All" &&
        lead.status?.toLowerCase() !== activeStatusFilter.toLowerCase()
      ) {
        return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesProject = (lead.project_name || "")
          .toLowerCase()
          .includes(query);
        const matchesContact = (lead.contact_name || "")
          .toLowerCase()
          .includes(query);
        const matchesCompany = (lead.company_name || "")
          .toLowerCase()
          .includes(query);
        const matchesNumber = (lead.lead_number || "")
          .toLowerCase()
          .includes(query);
        const matchesPhone = (lead.phone || "").toLowerCase().includes(query);
        const matchesRequirement = (lead.requirement || "")
          .toLowerCase()
          .includes(query);
        const matchesMixDesign = getLeadMixDesignDisplayName(
          lead,
          cachedMixDesigns,
        )
          .toLowerCase()
          .includes(query);
        const matchesLocation = (lead.delivery_location || "")
          .toLowerCase()
          .includes(query);

        return (
          matchesProject ||
          matchesContact ||
          matchesCompany ||
          matchesNumber ||
          matchesPhone ||
          matchesRequirement ||
          matchesMixDesign ||
          matchesLocation
        );
      }
      return true;
    });
  }, [leads, activeStatusFilter, searchQuery, cachedMixDesigns]);

  // Aggregate KPI stats
  const totalPipelineValue = useMemo(() => {
    return leads.reduce((sum, item) => {
      const val = parseFloat(String(item.expected_value || 0));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [leads]);

  const highPriorityCount = useMemo(() => {
    return leads.filter(
      (l) =>
        l.priority?.toLowerCase() === "high" ||
        l.priority?.toLowerCase() === "urgent",
    ).length;
  }, [leads]);

  // Available options from Redux dropdown API
  const statusOptions = useMemo(() => {
    let list: string[] = [];
    if (reduxLeadStatuses && reduxLeadStatuses.length > 0) {
      list = reduxLeadStatuses;
    } else if (reduxLeadStatusOptions && reduxLeadStatusOptions.length > 0) {
      list = reduxLeadStatusOptions.map((o) => o.label || o.value);
    } else {
      list = ["New", "Contacted", "Qualified", "Converted", "Unqualified"];
    }
    return ["All", ...list];
  }, [reduxLeadStatuses, reduxLeadStatusOptions]);

  const statusModalOptions = useMemo(() => {
    const getColor = (val: string) => {
      const v = (val || "").toLowerCase();
      if (v === "new") return "#2563EB";
      if (v === "contacted") return "#7C3AED";
      if (v === "qualified" || v === "approved") return "#059669";
      if (v === "converted") return "#0D9488";
      if (v === "unqualified" || v === "lost" || v === "cancelled")
        return "#DC2626";
      return "#64748B";
    };

    if (reduxLeadStatusOptions && reduxLeadStatusOptions.length > 0) {
      return reduxLeadStatusOptions.map((opt) => ({
        label: opt.label || opt.value,
        value: opt.value || opt.label,
        color: getColor(opt.value || opt.label),
      }));
    }
    if (reduxLeadStatuses && reduxLeadStatuses.length > 0) {
      return reduxLeadStatuses.map((s) => ({
        label: s,
        value: s,
        color: getColor(s),
      }));
    }
    return [
      { label: "New", value: "New", color: "#2563EB" },
      { label: "Contacted", value: "Contacted", color: "#7C3AED" },
      { label: "Qualified", value: "Qualified", color: "#059669" },
      { label: "Approved", value: "Approved", color: "#16A34A" },
      { label: "Converted", value: "Converted", color: "#0D9488" },
      { label: "Unqualified", value: "Unqualified", color: "#DC2626" },
    ];
  }, [reduxLeadStatusOptions, reduxLeadStatuses]);

  // Render individual Lead Card
  const renderLeadCard = ({ item }: { item: LeadItem }) => {
    const priorityStyle = getPriorityBadge(item.priority);
    const statusStyle = getStatusBadge(item.status);
    const statusLower = (item.status || "").toLowerCase().trim();
    const isQualified = statusLower === "qualified";
    const isConverted = statusLower === "converted";
    const isStatusLocked =
      statusLower === "qualified" ||
      statusLower === "approved" ||
      statusLower === "converted";

    return (
      <View style={styles.leadCard}>
        {/* Card Header: Lead ID, Priority & Status */}
        <View style={styles.cardHeader}>
          <View style={styles.leadNumberBadge}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={14}
              color="#2563EB"
            />
            <Text style={styles.leadNumberText}>{item.lead_number}</Text>
          </View>

          <View style={styles.badgesRightRow}>
            {/* Priority Badge */}
            <View
              style={[
                styles.priorityBadge,
                {
                  backgroundColor: priorityStyle.bg,
                  borderColor: priorityStyle.border,
                },
              ]}
            >
              <View
                style={[
                  styles.priorityDot,
                  { backgroundColor: priorityStyle.dot },
                ]}
              />
              <Text
                style={[styles.priorityText, { color: priorityStyle.text }]}
              >
                {item.priority || "Medium"}
              </Text>
            </View>

            {/* Status Dropdown Badge */}
            {isStatusLocked ? (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusStyle.bg,
                    borderColor: statusStyle.border,
                  },
                ]}
              >
                <Text
                  style={[styles.statusText, { color: statusStyle.text }]}
                  numberOfLines={1}
                >
                  {item.status || "New"}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusStyle.bg,
                    borderColor: statusStyle.border,
                  },
                ]}
                onPress={() => handleOpenStatusPicker(item)}
                activeOpacity={0.7}
                disabled={updatingStatusId === item.id}
              >
                {updatingStatusId === item.id ? (
                  <ActivityIndicator size="small" color={statusStyle.text} />
                ) : (
                  <>
                    <Text
                      style={[styles.statusText, { color: statusStyle.text }]}
                      numberOfLines={1}
                    >
                      {item.status || "New"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={11}
                      color={statusStyle.text}
                    />
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Project Title & Source */}
        <View style={styles.projectSection}>
          <View style={styles.projectTitleRow}>
            <Text style={styles.projectNameText} numberOfLines={2}>
              {item.project_name || "Untitled Project"}
            </Text>
            {item.source ? (
              <View style={styles.sourceBadge}>
                <Ionicons name="pricetag-outline" size={11} color="#64748B" />
                <Text style={styles.sourceBadgeText}>{item.source}</Text>
              </View>
            ) : null}
          </View>

          {/* Contact Person & Company */}
          <View style={styles.contactRow}>
            <Ionicons name="person-circle-outline" size={15} color="#475569" />
            <Text style={styles.contactPersonText}>
              {item.contact_name}
              {item.company_name ? ` · ${item.company_name}` : ""}
            </Text>
          </View>

          {/* Requirement snippet if present and not just an ID */}
          {item.requirement && isNaN(Number(item.requirement)) ? (
            <View style={styles.requirementRow}>
              <MaterialCommunityIcons
                name="clipboard-text-outline"
                size={13}
                color="#2563EB"
              />
              <Text style={styles.requirementText} numberOfLines={1}>
                Req:{" "}
                <Text style={styles.requirementTextVal}>
                  {item.requirement}
                </Text>
              </Text>
            </View>
          ) : null}
        </View>

        {/* Core Specs Grid: Mix Design, Estimated Qty, Expected Value */}
        <View style={styles.specBox}>
          {/* Mix Design */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <MaterialCommunityIcons
                name="layers-triple-outline"
                size={13}
                color="#64748B"
              />
              <Text style={styles.specLabel}>MIX DESIGN</Text>
            </View>
            <Text style={styles.specValue} numberOfLines={1}>
              {getLeadMixDesignDisplayName(item, cachedMixDesigns)}
            </Text>
          </View>

          <View style={styles.specDivider} />

          {/* Est Quantity */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <MaterialCommunityIcons
                name="cube-outline"
                size={13}
                color="#2563EB"
              />
              <Text style={styles.specLabel}>EST. QUANTITY</Text>
            </View>
            <Text style={[styles.specValue, { color: "#2563EB" }]}>
              {formatQuantity(item.estimated_quantity)}
            </Text>
          </View>

          <View style={styles.specDivider} />

          {/* Expected Value */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <Ionicons name="cash-outline" size={13} color="#059669" />
              <Text style={styles.specLabel}>EXP. VALUE</Text>
            </View>
            <Text
              style={[
                styles.specValue,
                { color: "#059669", fontWeight: "800" },
              ]}
              numberOfLines={1}
            >
              {formatCurrency(item.expected_value)}
            </Text>
          </View>
        </View>

        {/* Location & Address Section */}
        <View style={styles.locationContainer}>
          <View style={styles.locationItem}>
            <Ionicons
              name="location"
              size={14}
              color="#DC2626"
              style={styles.locationIcon}
            />
            <Text style={styles.locationText} numberOfLines={1}>
              <Text style={styles.locationPrefix}>Delivery: </Text>
              {item.delivery_location || "Not specified"}
            </Text>
          </View>

          {item.address ? (
            <View style={styles.locationItem}>
              <Ionicons
                name="business-outline"
                size={14}
                color="#64748B"
                style={styles.locationIcon}
              />
              <Text style={styles.locationText} numberOfLines={1}>
                <Text style={styles.locationPrefix}>Address: </Text>
                {item.address}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Dates Bar: Enquiry Date & Expected Purchase Date */}
        <View style={styles.datesBar}>
          <View style={styles.dateItem}>
            <Ionicons name="calendar-outline" size={13} color="#64748B" />
            <Text style={styles.dateLabel}>
              Enquiry:{" "}
              <Text style={styles.dateVal}>
                {formatDateDisplay(item.enquiry_date)}
              </Text>
            </Text>
          </View>

          <View style={styles.dateItem}>
            <Ionicons name="time-outline" size={13} color="#D97706" />
            <Text style={styles.dateLabel}>
              Expected:{" "}
              <Text style={[styles.dateVal, { color: "#D97706" }]}>
                {formatDateDisplay(item.expected_purchase_date)}
              </Text>
            </Text>
          </View>
        </View>

        {/* Owner / Assignee & Remarks if available */}
        {item.owner?.username || item.remarks ? (
          <View style={styles.ownerRemarksRow}>
            {item.owner?.username ? (
              <View style={styles.ownerPill}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={12}
                  color="#2563EB"
                />
                <Text style={styles.ownerText}>
                  Assigned: {item.owner.username}
                </Text>
              </View>
            ) : (
              <View />
            )}

            {item.remarks ? (
              <Text style={styles.remarksSnippet} numberOfLines={1}>
                {`“${item.remarks}”`}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Create Quotation Action (Only shown when status is Qualified) */}
        {isQualified && (
          <TouchableOpacity
            style={styles.cardCreateQuotationBtn}
            onPress={() => handleCreateQuotationFromLead(item)}
            activeOpacity={0.85}
          >
            <View style={styles.cardCreateQuotationBtnLeft}>
              <View style={styles.cardCreateQuotationIconBg}>
                <MaterialCommunityIcons
                  name="file-document-edit-outline"
                  size={16}
                  color="#FFFFFF"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardCreateQuotationBtnTitle}>
                  Create Quotation
                </Text>
                <Text
                  style={styles.cardCreateQuotationBtnSubtitle}
                  numberOfLines={1}
                >
                  Convert qualified lead to quotation
                </Text>
              </View>
            </View>
            <View style={styles.cardCreateQuotationBtnArrow}>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}

        {/* Quick Action Footer: Phone / Call & Email */}
        <View style={styles.cardFooter}>
          <View style={styles.phoneDisplay}>
            <Ionicons name="call-outline" size={13} color="#475569" />
            <Text style={styles.phoneDisplayText}>
              {item.phone || "No phone"}
            </Text>
          </View>

          <View style={styles.actionButtonsGroup}>
            {!isConverted && (
              <TouchableOpacity
                style={styles.actionEditBtn}
                onPress={() => handleNavigateToEditLead(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={14} color="#0B2A4A" />
                <Text style={styles.actionEditText}>Edit</Text>
              </TouchableOpacity>
            )}

            {item.email ? (
              <TouchableOpacity
                style={styles.actionEmailBtn}
                onPress={() => handleEmail(item.email)}
                activeOpacity={0.7}
              >
                <Ionicons name="mail" size={14} color="#2563EB" />
                <Text style={styles.actionEmailText}>Email</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.actionCallBtn}
              onPress={() => handleCall(item.phone)}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={14} color="#FFFFFF" />
              <Text style={styles.actionCallText}>Call</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0B2A4A"
        translucent={false}
      />

      {/* TOP INDUSTRIAL HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <View style={styles.headerTitleBadgeRow}>
              <Text style={styles.headerTitle}>Lead</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{leads.length}</Text>
              </View>
            </View>
            <View style={styles.plantBadgeRow}>
              <Ionicons name="trending-up" size={12} color="#94A3B8" />
              <Text style={styles.plantBadgeText}>
                Sales Pipeline
              </Text>
            </View>
          </View>
        </View>

        {/* QUICK KPI METRIC STRIP */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL LEADS</Text>
            <Text style={styles.kpiValue}>{leads.length}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>HIGH PRIORITY</Text>
            <Text style={[styles.kpiValue, { color: "#FBBF24" }]}>
              {highPriorityCount}
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

        {/* SEARCH BAR */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search project, lead #, client, grade..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* FILTER TABS */}
      <View style={styles.filterSection}>
        {/* Status Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {statusOptions.map((status) => {
            const isActive = activeStatusFilter === status;
            return (
              <TouchableOpacity
                key={status}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveStatusFilter(status)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ERROR NOTICE IF ANY */}
      {errorMessage && (
        <View style={styles.errorNotice}>
          <Ionicons name="warning-outline" size={16} color="#DC2626" />
          <Text style={styles.errorNoticeText}>
            Showing cached data. ({errorMessage})
          </Text>
          <TouchableOpacity onPress={() => handleManualRefresh(false)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LEADS LIST / FLATLIST */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Fetching leads from plant...</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: "#F8FAFC" }}
          data={filteredLeads}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLeadCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => handleManualRefresh(true)}
              colors={["#2563EB"]}
              tintColor="#2563EB"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="clipboard-text-search-outline"
                size={54}
                color="#CBD5E1"
              />
              <Text style={styles.emptyTitle}>No Leads Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || activeStatusFilter !== "All"
                  ? "No matching leads found for current search/filter."
                  : "No sales leads currently available for this plant."}
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={handleNavigateToAddLead}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.emptyAddBtnText}>Add First Lead</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* FLOATING ACTION BUTTON: ADD LEAD */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={handleNavigateToAddLead}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.fabText}>Add Lead</Text>
      </TouchableOpacity>

      {/* QUICK STATUS PICKER MODAL */}
      <Modal
        visible={statusPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setStatusPickerVisible(false)}
      >
        <View style={styles.statusModalOverlay}>
          <View style={styles.statusModalContent}>
            <View style={styles.statusModalHeader}>
              <View>
                <Text style={styles.statusModalTitle}>Update Lead Status</Text>
                <Text style={styles.statusModalSubtitle}>
                  {selectedLeadForStatus?.lead_number} ·{" "}
                  {selectedLeadForStatus?.project_name}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.statusModalCloseBtn}
                onPress={() => setStatusPickerVisible(false)}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.statusOptionsList}>
              {statusModalOptions.map((opt) => {
                const isSelected =
                  selectedLeadForStatus?.status?.toLowerCase() ===
                  opt.value.toLowerCase();
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.statusOptionItem,
                      isSelected && styles.statusOptionItemSelected,
                    ]}
                    onPress={() => handleSelectStatus(opt.value)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.statusOptionLeft}>
                      <View
                        style={[
                          styles.statusOptionDot,
                          { backgroundColor: opt.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusOptionLabel,
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
                        size={18}
                        color={opt.color}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* UNQUALIFIED REASON TEXTINPUT MODAL */}
      <Modal
        visible={unqualifiedModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!isSubmittingUnqualified) {
            setUnqualifiedModalVisible(false);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.unqualifiedModalOverlay}
        >
          <View style={styles.unqualifiedModalContent}>
            <View style={styles.unqualifiedModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.unqualifiedModalTitle}>
                  Mark Lead as Unqualified
                </Text>
                <Text style={styles.unqualifiedModalSubtitle} numberOfLines={1}>
                  {targetLeadForUnqualified?.lead_number} ·{" "}
                  {targetLeadForUnqualified?.contact_name ||
                    targetLeadForUnqualified?.company_name ||
                    "Lead"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.statusModalCloseBtn}
                onPress={() => setUnqualifiedModalVisible(false)}
                disabled={isSubmittingUnqualified}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.unqualifiedModalBody}>
              <Text style={styles.unqualifiedInputLabel}>
                Reason for rejection / unqualifying{" "}
                <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={styles.unqualifiedTextInput}
                placeholder="Reject this"
                placeholderTextColor="#94A3B8"
                value={unqualifiedLostReason}
                onChangeText={setUnqualifiedLostReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!isSubmittingUnqualified}
              />
            </View>

            <View style={styles.unqualifiedModalActions}>
              <TouchableOpacity
                style={styles.unqualifiedCancelBtn}
                onPress={() => setUnqualifiedModalVisible(false)}
                disabled={isSubmittingUnqualified}
                activeOpacity={0.7}
              >
                <Text style={styles.unqualifiedCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.unqualifiedSubmitBtn,
                  isSubmittingUnqualified && styles.unqualifiedSubmitBtnDisabled,
                ]}
                onPress={handleConfirmUnqualified}
                disabled={isSubmittingUnqualified}
                activeOpacity={0.8}
              >
                {isSubmittingUnqualified ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.unqualifiedSubmitBtnText}>Submit</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({

  unqualifiedModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  unqualifiedModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxWidth: 420,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  unqualifiedModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  unqualifiedModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  unqualifiedModalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  unqualifiedModalBody: {
    marginBottom: 18,
  },
  unqualifiedInputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  requiredAsterisk: {
    color: "#EF4444",
  },
  unqualifiedTextInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
    minHeight: 70,
  },
  unqualifiedModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  unqualifiedCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  unqualifiedCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  unqualifiedSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#DC2626",
    justifyContent: "center",
  },
  unqualifiedSubmitBtnDisabled: {
    opacity: 0.6,
  },
  unqualifiedSubmitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  safeArea: {
    flex: 1,
    backgroundColor: "#0B2A4A",
  },
  header: {
    backgroundColor: "#0B2A4A",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitleBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  countBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
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

  // TOUCHABLEOPACITY: + ADD LEAD BUTTON
  addLeadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  addLeadButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
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
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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

  // Leads List
  listContent: {
    padding: 14,
    paddingBottom: 95,
    gap: 12,
  },

  // LEAD CARD
  leadCard: {
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
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  leadNumberBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    flexShrink: 1,
  },
  leadNumberText: {
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
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
    flexShrink: 0,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "700",
    includeFontPadding: false,
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
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  sourceBadgeText: {
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
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  requirementText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  requirementTextVal: {
    color: "#1E293B",
    fontWeight: "600",
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

  // Location details
  locationContainer: {
    backgroundColor: "#FFFFFF",
    gap: 4,
    marginBottom: 8,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationIcon: {
    marginRight: 6,
    width: 14,
  },
  locationPrefix: {
    fontWeight: "700",
    color: "#475569",
  },
  locationText: {
    fontSize: 12,
    color: "#334155",
    flex: 1,
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

  // Owner & Remarks
  ownerRemarksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    marginBottom: 8,
    gap: 8,
  },
  ownerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  ownerText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#1D4ED8",
  },
  remarksSnippet: {
    flex: 1,
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
    textAlign: "right",
  },

  // Create Quotation Button on Qualified Lead Cards
  cardCreateQuotationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#059669",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 8,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  cardCreateQuotationBtnLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flex: 1,
  },
  cardCreateQuotationIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardCreateQuotationBtnTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  cardCreateQuotationBtnSubtitle: {
    fontSize: 10,
    fontWeight: "500",
    color: "#DCFCE7",
    marginTop: 1,
  },
  cardCreateQuotationBtnArrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
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
  phoneDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  phoneDisplayText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  actionButtonsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionEmailBtn: {
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
  actionEmailText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  actionEditBtn: {
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
  actionEditText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
  },
  actionCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  actionCallText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Status Modal Styles
  statusModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  statusModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  statusModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 10,
  },
  statusModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  statusModalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  statusModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  statusOptionsList: {
    gap: 8,
  },
  statusOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusOptionItemSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  statusOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusOptionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 24,
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
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  emptyAddBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // Loading State
  centerContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },

  // FAB Button
  fabButton: {
    position: "absolute",
    bottom: 20,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
