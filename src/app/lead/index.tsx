import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { fetchDropdowns } from "@/store/dropdownSlice";
import { AppDispatch, RootState } from "@/store/store";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import axios from "axios";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  CustomAlertModal,
  AlertType,
  AlertButton,
  formatSubmissionError,
} from "@/components/ui/custom-alert-modal";

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
// API HELPERS
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

export async function deleteLeadApi(
  leadsId: number | string,
  token?: string | null,
  plantId?: number | null,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const params: Record<string, any> = {
    leads_id: leadsId,
  };
  if (plantId !== null && plantId !== undefined) {
    params.plant_id = String(plantId);
  }

  console.log(`[Lead Delete] DELETE ${baseURL}/leads/${leadsId}`, {
    params,
    headers,
  });

  return await axios.delete(`${baseURL}/leads/${leadsId}`, {
    headers,
    params,
  });
}

// ==========================================
// FORMATTING HELPERS
// ==========================================

function formatCurrency(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "₹0";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return `₹${value}`;
  return `₹${Math.round(num).toLocaleString("en-IN")}`;
}

function formatQuantity(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "0 m³";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return `${value} m³`;
  return `${num} m³`;
}

function formatDateDisplay(dateStr?: string | null): string {
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
      return {
        bg: "#EFF6FF",
        text: "#1D4ED8",
        border: "#BFDBFE",
        accent: "#2563EB",
        icon: "flash-outline" as const,
      };
    case "in negotiation":
    case "negotiation":
    case "in progress":
      return {
        bg: "#FEF3C7",
        text: "#B45309",
        border: "#FDE68A",
        accent: "#F59E0B",
        icon: "time-outline" as const,
      };
    case "qualified":
    case "won":
      return {
        bg: "#DCFCE7",
        text: "#15803D",
        border: "#86EFAC",
        accent: "#16A34A",
        icon: "checkmark-circle" as const,
      };
    case "approved":
      return {
        bg: "#ECFDF5",
        text: "#059669",
        border: "#A7F3D0",
        accent: "#059669",
        icon: "shield-checkmark" as const,
      };
    case "converted":
      return {
        bg: "#CCFBF1",
        text: "#0F766E",
        border: "#99F6E4",
        accent: "#0D9488",
        icon: "swap-horizontal" as const,
      };
    case "lost":
    case "unqualified":
    case "cancelled":
      return {
        bg: "#FEE2E2",
        text: "#DC2626",
        border: "#FECDD3",
        accent: "#DC2626",
        icon: "close-circle" as const,
      };
    case "contacted":
      return {
        bg: "#F3E8FF",
        text: "#7E22CE",
        border: "#D8B4FE",
        accent: "#9333EA",
        icon: "call-outline" as const,
      };
    default:
      return {
        bg: "#F1F5F9",
        text: "#475569",
        border: "#CBD5E1",
        accent: "#64748B",
        icon: "help-circle-outline" as const,
      };
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
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "value_high" | "value_low">("newest");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [cardMenuLead, setCardMenuLead] = useState<LeadItem | null>(null);

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

  // Back navigation directly to More screen
  const handleBack = useCallback(() => {
    router.replace("/more" as any);
  }, []);

  // Automatically refresh when screen regains focus and register hardware back handler
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#063b89");
      }

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

  // Delete Lead State
  const [deletingLeadId, setDeletingLeadId] = useState<number | null>(null);
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

  const hideAlert = useCallback(() => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  const confirmDeleteLead = useCallback(
    async (item: LeadItem) => {
      hideAlert();
      setDeletingLeadId(item.id);
      try {
        const res = await deleteLeadApi(item.id, token, plant_id);
        const successMsg = res.data?.message || "Lead deleted successfully.";
        setLeads((prev) => prev.filter((l) => l.id !== item.id));
        setAlertConfig({
          visible: true,
          title: "Deleted",
          message: successMsg,
          type: "success",
          buttons: [{ text: "OK", onPress: hideAlert }],
        });
        handleManualRefresh(false);
      } catch (err: any) {
        const errMsg = formatSubmissionError(err, "Failed to delete lead.");
        setAlertConfig({
          visible: true,
          title: "Delete Failed",
          message: errMsg,
          type: "error",
          buttons: [{ text: "OK", onPress: hideAlert }],
        });
      } finally {
        setDeletingLeadId(null);
      }
    },
    [hideAlert, token, plant_id, handleManualRefresh],
  );

  const handlePromptDeleteLead = useCallback(
    (item: LeadItem) => {
      const leadLabel =
        item.project_name ||
        item.contact_name ||
        item.company_name ||
        `Lead #${item.id}`;

      setAlertConfig({
        visible: true,
        title: "Delete Lead",
        message: `Are you sure you want to delete lead "${leadLabel}"? This action cannot be undone.`,
        type: "warning",
        buttons: [
          {
            text: "Cancel",
            style: "cancel",
            onPress: hideAlert,
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => confirmDeleteLead(item),
          },
        ],
      });
    },
    [hideAlert, confirmDeleteLead],
  );

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
    const requestUrl = `${baseURL}/leads/${targetLead.id}`;

    try {
      if (isQualifying) {
        await axios.post(requestUrl, payload, {
          headers,
          params: { lead: targetLead.id },
          timeout: 20000,
        });
      } else {
        await axios.patch(requestUrl, payload, {
          headers,
          params: { lead: targetLead.id },
          timeout: 20000,
        });
      }

      setLeads((prev) =>
        prev.map((l) =>
          l.id === targetLead.id ? { ...l, status: newStatus } : l,
        ),
      );
    } catch (err: any) {
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

    try {
      await axios.patch(requestUrl, payload, {
        headers,
        params: { lead: targetLead.id },
        timeout: 20000,
      });

      setLeads((prev) =>
        prev.map((l) =>
          l.id === targetLead.id
            ? { ...l, status: "Unqualified", lost_reason: reasonToSend }
            : l,
        ),
      );

      setUnqualifiedModalVisible(false);
      setTargetLeadForUnqualified(null);
      Alert.alert("Lead Unqualified", "Lead status updated to Unqualified.");
    } catch (err: any) {
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
      mixDesignId: String(lead.mix_design_id || lead.mix_design?.id || ""),
      mixDesignName:
        lead.mix_design?.design_name ||
        lead.mix_design?.name ||
        lead.mix_design?.code ||
        "",
      leadData: JSON.stringify(lead),
      plant_id: String(lead.plant_id || plant_id || "6"),
      sales_executive_id: lead.assigned_to ? String(lead.assigned_to) : "",
    };

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
    const result = leads.filter((lead) => {
      if (
        activeStatusFilter !== "All" &&
        lead.status?.toLowerCase() !== activeStatusFilter.toLowerCase()
      ) {
        return false;
      }
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

    return result.sort((a, b) => {
      if (sortBy === "value_high") {
        return (
          (parseFloat(String(b.expected_value || 0)) || 0) -
          (parseFloat(String(a.expected_value || 0)) || 0)
        );
      }
      if (sortBy === "value_low") {
        return (
          (parseFloat(String(a.expected_value || 0)) || 0) -
          (parseFloat(String(b.expected_value || 0)) || 0)
        );
      }
      if (sortBy === "oldest") {
        return Number(a.id) - Number(b.id);
      }
      return Number(b.id) - Number(a.id);
    });
  }, [leads, activeStatusFilter, searchQuery, cachedMixDesigns, sortBy]);

  // Aggregate KPI stats
  const { totalPipelineValue, qualifiedCount, statusCounts } = useMemo(() => {
    let sum = 0;
    let qual = 0;
    const counts: Record<string, number> = { All: leads.length };

    for (const l of leads) {
      const v = parseFloat(String(l.expected_value || 0));
      if (!isNaN(v)) sum += v;

      const st = (l.status || "New").toLowerCase();
      if (st === "qualified" || st === "approved") qual++;

      counts[l.status] = (counts[l.status] || 0) + 1;
    }

    return { totalPipelineValue: sum, qualifiedCount: qual, statusCounts: counts };
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
    const canDeleteLead =
      statusLower === "new" ||
      statusLower === "contacted" ||
      statusLower === "unqualified";

    return (
      <View style={styles.leadCard}>
        {/* Status vertical accent stripe */}
        <View
          style={[styles.cardLeftStripe, { backgroundColor: statusStyle.accent }]}
        />

        <View style={styles.cardContent}>
          {/* Top Row: Lead Number & Status Badges */}
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

              {/* Status Badge */}
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
                  <Ionicons
                    name={statusStyle.icon}
                    size={13}
                    color={statusStyle.text}
                  />
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
                      <Ionicons
                        name={statusStyle.icon}
                        size={13}
                        color={statusStyle.text}
                      />
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

          {/* Project Title & 3-Dots */}
          <View style={styles.projectTitleRow}>
            <Text style={styles.projectNameText} numberOfLines={1}>
              {item.project_name || "Untitled Project"}
            </Text>
            <TouchableOpacity
              style={styles.cardOptionsBtn}
              onPress={() => setCardMenuLead(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Contact Person & Company */}
          <View style={styles.contactRow}>
            <Ionicons name="person-circle-outline" size={14} color="#64748B" />
            <Text style={styles.contactPersonText} numberOfLines={1}>
              {item.contact_name}
              {item.company_name ? ` · ${item.company_name}` : ""}
            </Text>
            {item.source ? (
              <View style={styles.sourceBadge}>
                <Text style={styles.sourceBadgeText}>{item.source}</Text>
              </View>
            ) : null}
          </View>

          {/* Site Location with Red Pin */}
          <View style={styles.siteRow}>
            <Ionicons name="location-sharp" size={14} color="#EF4444" />
            <Text style={styles.siteNameText} numberOfLines={1}>
              {item.delivery_location || item.address || "Main Site"}
            </Text>
          </View>

          {/* Core Specs Grid: Mix Design, Estimated Qty, Expected Value */}
          <View style={styles.specBox}>
            {/* Mix Design */}
            <View style={styles.specCol}>
              <View style={styles.specHeaderRow}>
                <MaterialCommunityIcons
                  name="layers-triple-outline"
                  size={14}
                  color="#64748B"
                />
                <Text style={styles.specLabel}>Mix Design</Text>
              </View>
              <Text style={styles.specMixValue} numberOfLines={1}>
                {getLeadMixDesignDisplayName(item, cachedMixDesigns)}
              </Text>
            </View>

            {/* Est Quantity */}
            <View style={styles.specCol}>
              <View style={styles.specHeaderRow}>
                <MaterialCommunityIcons
                  name="cube-outline"
                  size={14}
                  color="#2563EB"
                />
                <Text style={styles.specLabel}>Est. Quantity</Text>
              </View>
              <Text style={styles.specVolumeValue} numberOfLines={1}>
                {formatQuantity(item.estimated_quantity)}
              </Text>
            </View>

            {/* Expected Value */}
            <View style={styles.specCol}>
              <View style={styles.specHeaderRow}>
                <Ionicons name="cash-outline" size={14} color="#16A34A" />
                <Text style={styles.specLabel}>Exp. Value</Text>
              </View>
              <Text style={styles.specTotalValue} numberOfLines={1}>
                {formatCurrency(item.expected_value)}
              </Text>
            </View>
          </View>

          {/* Dates Bar: Enquiry Date & Expected Date */}
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

            <View style={styles.dateDivider} />

            <View style={styles.dateItem}>
              <Ionicons name="time-outline" size={13} color="#64748B" />
              <Text style={styles.dateLabel}>
                Expected:{" "}
                <Text style={styles.dateVal}>
                  {formatDateDisplay(item.expected_purchase_date)}
                </Text>
              </Text>
            </View>
          </View>

          {/* Qualified Banner Action */}
          {isQualified && (
            <TouchableOpacity
              style={styles.cardCreateQuotationBtn}
              onPress={() => handleCreateQuotationFromLead(item)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name="file-document-edit-outline"
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.cardCreateQuotationBtnTitle}>
                Convert to Quotation
              </Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Quick Actions Footer */}
          <View style={styles.cardFooter}>
            <View style={styles.actionButtonsGroup}>
              {/* Call */}
              {item.phone ? (
                <TouchableOpacity
                  style={styles.actionCallBtn}
                  onPress={() => handleCall(item.phone)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={13} color="#FFFFFF" />
                  <Text style={styles.actionCallText}>Call</Text>
                </TouchableOpacity>
              ) : null}

              {/* Edit */}
              {!isConverted && (
                <TouchableOpacity
                  style={styles.actionEditBtn}
                  onPress={() => handleNavigateToEditLead(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={14} color="#2563EB" />
                  <Text style={styles.actionEditText}>Edit</Text>
                </TouchableOpacity>
              )}

              {/* Delete */}
              {canDeleteLead && (
                <TouchableOpacity
                  style={styles.actionDeleteBtn}
                  onPress={() => handlePromptDeleteLead(item)}
                  activeOpacity={0.7}
                  disabled={deletingLeadId === item.id}
                >
                  {deletingLeadId === item.id ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      <Text style={styles.actionDeleteText}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#063b89"
        translucent={false}
      />

      {/* TOP INDUSTRIAL HEADER WITH LINEAR GRADIENT */}
      <LinearGradient
        colors={["#063b89", "#0B4DA8", "#1E62D0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        {/* Subtle decorative circles */}
        <View style={styles.headerBgCircle1} />
        <View style={styles.headerBgCircle2} />

        {/* Top Navigation Row: Back Button, Title, Bell, and Customized Lead Illustration */}
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTitles}>
              <Text style={styles.headerMainTitle}>Leads</Text>
              <Text style={styles.headerSubtitle}>Sales & Client Pipeline</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {/* Notification Bell */}
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() =>
                Alert.alert(
                  "Notifications",
                  "You have no unread notifications for leads.",
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#FFFFFF"
              />
              <View style={styles.bellDot} />
            </TouchableOpacity>

            {/* Customized Lead Profile Card Illustration with Star Badge */}
            <View style={styles.headerGraphicWrapper}>
              <View style={styles.headerLeadCard}>
                <View style={styles.headerLeadAvatar}>
                  <Ionicons name="person" size={12} color="#2563EB" />
                </View>
                <View style={styles.headerLeadLines}>
                  <View style={styles.headerLeadLine1} />
                  <View style={styles.headerLeadLine2} />
                </View>
              </View>
              <View style={styles.headerLeadBadge}>
                <Ionicons name="star" size={10} color="#FFFFFF" />
              </View>
            </View>
          </View>
        </View>

        {/* QUICK KPI METRIC STRIP */}
        <View style={styles.kpiContainer}>
          {/* Metric 1 */}
          <View style={styles.kpiItem}>
            <View style={[styles.kpiIconBox, { backgroundColor: "#EFF6FF" }]}>
              <MaterialCommunityIcons
                name="account-group-outline"
                size={20}
                color="#2563EB"
              />
            </View>
            <View style={styles.kpiTextGroup}>
              <Text style={styles.kpiValueText}>{leads.length}</Text>
              <Text style={styles.kpiLabelText}>Total Leads</Text>
            </View>
          </View>

          {/* Metric 2 */}
          <View style={styles.kpiItem}>
            <View style={[styles.kpiIconBox, { backgroundColor: "#DCFCE7" }]}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
            </View>
            <View style={styles.kpiTextGroup}>
              <Text style={styles.kpiValueText}>{qualifiedCount}</Text>
              <Text style={styles.kpiLabelText}>Qualified</Text>
            </View>
          </View>

          {/* Metric 3 */}
          <View style={styles.kpiItem}>
            <View style={[styles.kpiIconBox, { backgroundColor: "#F3E8FF" }]}>
              <MaterialCommunityIcons
                name="chart-timeline-variant"
                size={18}
                color="#9333EA"
              />
            </View>
            <View style={styles.kpiTextGroup}>
              <Text style={styles.kpiValueText} numberOfLines={1}>
                {formatCurrency(totalPipelineValue)}
              </Text>
              <Text style={styles.kpiLabelText}>Pipeline Value</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* SEARCH AND FILTER BAR */}
      <View style={styles.searchFilterRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search project, lead #, client..."
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

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="funnel" size={14} color="#2563EB" />
          <Text style={styles.filterButtonText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {/* HORIZONTAL STATUS FILTER PILLS */}
      <View style={styles.statusTabsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusTabsScroll}
        >
          {statusOptions.map((status) => {
            const isActive = activeStatusFilter === status;
            const count = statusCounts[status] ?? (status === "All" ? leads.length : 0);
            return (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusPill,
                  isActive && styles.statusPillActive,
                ]}
                onPress={() => setActiveStatusFilter(status)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    isActive && styles.statusPillTextActive,
                  ]}
                >
                  {status} ({count})
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
          style={{ flex: 1, backgroundColor: "#F4F7FC" }}
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
            </View>
          }
        />
      )}

      {/* 3-DOTS ACTION SHEET MODAL */}
      <Modal
        visible={Boolean(cardMenuLead)}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCardMenuLead(null)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setCardMenuLead(null)}
        >
          <View style={styles.actionSheetBox}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {cardMenuLead?.lead_number || "Lead Actions"}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {cardMenuLead?.project_name || cardMenuLead?.contact_name || ""}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCardMenuLead(null)}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {cardMenuLead && (
              <View style={styles.sheetOptionsContainer}>
                {/* Edit */}
                <TouchableOpacity
                  style={styles.sheetOptionItem}
                  onPress={() => {
                    const l = cardMenuLead;
                    setCardMenuLead(null);
                    handleNavigateToEditLead(l);
                  }}
                >
                  <View style={[styles.sheetIconBox, { backgroundColor: "#EFF6FF" }]}>
                    <Ionicons name="create-outline" size={18} color="#2563EB" />
                  </View>
                  <Text style={styles.sheetOptionText}>Edit Lead Details</Text>
                </TouchableOpacity>

                {/* Call */}
                {cardMenuLead.phone ? (
                  <TouchableOpacity
                    style={styles.sheetOptionItem}
                    onPress={() => {
                      const p = cardMenuLead.phone;
                      setCardMenuLead(null);
                      handleCall(p);
                    }}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: "#DCFCE7" }]}>
                      <Ionicons name="call" size={18} color="#16A34A" />
                    </View>
                    <Text style={styles.sheetOptionText}>
                      Call {cardMenuLead.phone}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Email */}
                {cardMenuLead.email ? (
                  <TouchableOpacity
                    style={styles.sheetOptionItem}
                    onPress={() => {
                      const e = cardMenuLead.email;
                      setCardMenuLead(null);
                      handleEmail(e);
                    }}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: "#EFF6FF" }]}>
                      <Ionicons name="mail" size={18} color="#2563EB" />
                    </View>
                    <Text style={styles.sheetOptionText}>
                      Send Email ({cardMenuLead.email})
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Convert to Quotation if Qualified */}
                {(cardMenuLead.status || "").toLowerCase() === "qualified" && (
                  <TouchableOpacity
                    style={styles.sheetOptionItem}
                    onPress={() => {
                      const l = cardMenuLead;
                      setCardMenuLead(null);
                      handleCreateQuotationFromLead(l);
                    }}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: "#ECFDF5" }]}>
                      <MaterialCommunityIcons
                        name="file-document-edit-outline"
                        size={18}
                        color="#059669"
                      />
                    </View>
                    <Text style={[styles.sheetOptionText, { color: "#059669" }]}>
                      Convert to Quotation
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Delete */}
                {(cardMenuLead.status?.toLowerCase() === "new" ||
                  cardMenuLead.status?.toLowerCase() === "contacted" ||
                  cardMenuLead.status?.toLowerCase() === "unqualified") && (
                  <TouchableOpacity
                    style={styles.sheetOptionItem}
                    onPress={() => {
                      const l = cardMenuLead;
                      setCardMenuLead(null);
                      handlePromptDeleteLead(l);
                    }}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: "#FEF2F2" }]}>
                      <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    </View>
                    <Text style={[styles.sheetOptionText, { color: "#DC2626" }]}>
                      Delete Lead
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FILTER & SORT MODAL */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterSheetContainer}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Sort & Filter Leads</Text>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }}>
              <Text style={styles.filterSectionHeader}>SORT BY</Text>
              {[
                { key: "newest" as const, label: "Newest First" },
                { key: "oldest" as const, label: "Oldest First" },
                { key: "value_high" as const, label: "Expected Value: High to Low" },
                { key: "value_low" as const, label: "Expected Value: Low to High" },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={styles.filterCheckRow}
                  onPress={() => setSortBy(opt.key)}
                >
                  <Text
                    style={[
                      styles.filterCheckLabel,
                      sortBy === opt.key && styles.filterCheckLabelActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {sortBy === opt.key && (
                    <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                  )}
                </TouchableOpacity>
              ))}

              <Text style={[styles.filterSectionHeader, { marginTop: 18 }]}>
                STATUS
              </Text>
              {statusOptions.map((st) => (
                <TouchableOpacity
                  key={st}
                  style={styles.filterCheckRow}
                  onPress={() => setActiveStatusFilter(st)}
                >
                  <Text
                    style={[
                      styles.filterCheckLabel,
                      activeStatusFilter === st && styles.filterCheckLabelActive,
                    ]}
                  >
                    {st}
                  </Text>
                  {activeStatusFilter === st && (
                    <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.filterModalFooter}>
              <TouchableOpacity
                style={styles.filterResetBtn}
                onPress={() => {
                  setSortBy("newest");
                  setActiveStatusFilter("All");
                  setSearchQuery("");
                  setFilterModalVisible(false);
                }}
              >
                <Text style={styles.filterResetBtnText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.filterApplyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                  <Text style={styles.unqualifiedSubmitBtnText}>
                    Confirm Reject
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ANIMATED CUSTOM ALERT MODAL */}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#063b89",
  },

  // Gradient Header
  headerGradient: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 12 : 8,
    paddingBottom: 16,
    position: "relative",
    overflow: "hidden",
  },
  headerBgCircle1: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    top: -60,
    right: -40,
  },
  headerBgCircle2: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    bottom: -20,
    left: -30,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitles: {
    flex: 1,
  },
  headerMainTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#BFDBFE",
    fontWeight: "500",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bellDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    position: "absolute",
    top: 7,
    right: 8,
    borderWidth: 1.5,
    borderColor: "#063b89",
  },

  // Customized Graphic for Lead Screen: Profile Card with Star
  headerGraphicWrapper: {
    position: "relative",
    width: 46,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  headerLeadCard: {
    width: 38,
    height: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    transform: [{ rotate: "4deg" }],
    alignItems: "center",
  },
  headerLeadAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 4,
  },
  headerLeadLines: {
    width: "100%",
    paddingHorizontal: 2,
    gap: 2.5,
  },
  headerLeadLine1: {
    height: 2.5,
    backgroundColor: "#CBD5E1",
    borderRadius: 1.5,
    width: "90%",
  },
  headerLeadLine2: {
    height: 2.5,
    backgroundColor: "#E2E8F0",
    borderRadius: 1.5,
    width: "60%",
  },
  headerLeadBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },

  // KPI Summary Container
  kpiContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpiItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  kpiTextGroup: {
    flex: 1,
  },
  kpiValueText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  kpiLabelText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
  },

  // Search & Filter Row
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "#F4F7FC",
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    marginLeft: 8,
    paddingVertical: 0,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 44,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563EB",
  },

  // Status Tabs
  statusTabsRow: {
    backgroundColor: "#F4F7FC",
    paddingBottom: 10,
  },
  statusTabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusPillActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  statusPillTextActive: {
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

  // List Content
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 85,
  },

  // Lead Card Design
  leadCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
  },
  cardLeftStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4.5,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  cardContent: {
    paddingLeft: 16,
    paddingRight: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  leadNumberBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 5,
  },
  leadNumberText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.3,
  },
  badgesRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  priorityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Project & 3-Dots
  projectTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  projectNameText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  cardOptionsBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },

  // Contact Row
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  contactPersonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    flex: 1,
  },
  sourceBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
  },

  // Site Row
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 12,
  },
  siteNameText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    flex: 1,
  },

  // 3-Column Specs Grid
  specBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 10,
  },
  specCol: {
    flex: 1,
  },
  specHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },
  specLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
  },
  specMixValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  specVolumeValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  specTotalValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#16A34A",
  },

  // Dates Row
  datesBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    marginBottom: 10,
  },
  dateItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 10,
  },
  dateLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  dateVal: {
    fontWeight: "700",
    color: "#1E293B",
  },

  // Card Convert to Quotation Banner Button
  cardCreateQuotationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 10,
  },
  cardCreateQuotationBtnTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Card Footer Buttons
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  actionButtonsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16A34A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    gap: 4,
  },
  actionCallText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  actionEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    gap: 4,
  },
  actionEditText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  actionDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 4,
  },
  actionDeleteText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },

  // FAB
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
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  // Loading & Empty States
  centerContainer: {
    flex: 1,
    backgroundColor: "#F4F7FC",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748B",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
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
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  emptyAddBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // Action Sheet & Filter Modal Overlay & Containers
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  actionSheetBox: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === "android" ? 24 : 34,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  sheetSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetOptionsContainer: {
    paddingTop: 10,
  },
  sheetOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
    gap: 12,
  },
  sheetIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },

  // Filter Sheet Container
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  filterSheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingTop: 16,
    paddingBottom: Platform.OS === "android" ? 20 : 30,
  },
  filterSectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8,
  },
  filterCheckRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  filterCheckLabel: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "500",
  },
  filterCheckLabelActive: {
    color: "#2563EB",
    fontWeight: "700",
  },
  filterModalFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  filterResetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  filterResetBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  filterApplyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  filterApplyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Status Picker Modal
  statusModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  statusModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingBottom: Platform.OS === "android" ? 24 : 34,
    paddingHorizontal: 20,
  },
  statusModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  statusModalTitle: {
    fontSize: 17,
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
    paddingTop: 10,
    gap: 4,
  },
  statusOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  statusOptionItemSelected: {
    backgroundColor: "#F8FAFC",
  },
  statusOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusOptionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },

  // Unqualified Lost Reason Modal
  unqualifiedModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  unqualifiedModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 400,
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
    marginBottom: 14,
  },
  unqualifiedModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  unqualifiedModalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  unqualifiedModalBody: {
    marginBottom: 16,
  },
  unqualifiedInputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: "#DC2626",
  },
  unqualifiedTextInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
    minHeight: 65,
  },
  unqualifiedModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  unqualifiedCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  unqualifiedCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  unqualifiedSubmitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#DC2626",
  },
  unqualifiedSubmitBtnDisabled: {
    opacity: 0.6,
  },
  unqualifiedSubmitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
