import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

export interface StatusDropdownOption {
  label: string;
  value: number;
}

export interface VehicleDropdownItem {
  id: number;
  registration: string;
  plant_id?: number;
}

export interface PumpDropdownItem {
  id: number;
  registration: string;
  vehicle_model?: string | null;
  label: string;
  value: number;
}

export interface DriverDropdownItem {
  id: number;
  value: number;
  label: string;
  first_name: string;
  last_name?: string | null;
  mobile?: string | null;
}

export interface DropdownState {
  leadStatuses: string[];
  leadStatusOptions: { label: string; value: string }[];
  leadSources: string[];
  priorities: string[];
  activityTypes: string[];
  pumpTypes: string[];
  customerPoStatuses: StatusDropdownOption[];
  quotationStatuses: StatusDropdownOption[];
  salesOrderStatuses: StatusDropdownOption[];
  salesTaxes: any[];
  taxes: any[];
  vehicles: VehicleDropdownItem[];
  pumps: PumpDropdownItem[];
  drivers: DriverDropdownItem[];
  sites: any[];
  mixDesigns: any[];
  customers: any[];
  orders: any[];
  salesExecutives: any[];
  paymentTerms: any[];
  plants: any[];
  units: any[];
  rawData: Record<string, any>;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
}

const DEFAULT_PUMP_TYPES = [
  "boom_pump",
  "line_pump",
  "crane_bucket",
  "direct_pour",
  "stationary_pump",
];

const initialState: DropdownState = {
  leadStatuses: [],
  leadStatusOptions: [],
  leadSources: [],
  priorities: [],
  activityTypes: [],
  pumpTypes: DEFAULT_PUMP_TYPES,
  customerPoStatuses: [],
  quotationStatuses: [],
  salesOrderStatuses: [],
  salesTaxes: [],
  taxes: [],
  vehicles: [],
  pumps: [],
  drivers: [],
  sites: [],
  mixDesigns: [],
  customers: [],
  orders: [],
  salesExecutives: [],
  paymentTerms: [],
  plants: [],
  units: [],
  rawData: {},
  isLoading: false,
  isLoaded: false,
  error: null,
};

export const fetchDropdowns = createAsyncThunk(
  "dropdowns/fetchDropdowns",
  async (
    params: { token?: string | null; plant_id?: number | null } | undefined,
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as any;
      const token = params?.token || state?.auth?.token;
      const plant_id = params?.plant_id ?? state?.auth?.plant_id;

      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) {
        const cleanToken = String(token).trim();
        headers["Authorization"] = cleanToken.startsWith("Bearer")
          ? cleanToken
          : `Bearer ${cleanToken}`;
      }
      if (plant_id !== undefined && plant_id !== null) {
        headers["X-Plant-Id"] = String(plant_id);
      }

      const res = await axios.get(`${baseURL}/dropdowns`, {
        headers,
        timeout: 15000,
      });

      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
      return res.data?.data || res.data;
    } catch (err: any) {
      console.warn("[Dropdowns API] Thunk error:", err?.message || err);
      return rejectWithValue(err?.message || "Failed to load dropdowns");
    }
  },
);

function applyDropdownData(state: DropdownState, data: any) {
  if (!data || typeof data !== "object") return;
  state.rawData = data;

  if (Array.isArray(data.lead_statuses)) {
    state.leadStatuses = data.lead_statuses;
  }
  if (Array.isArray(data.lead_status_options)) {
    state.leadStatusOptions = data.lead_status_options;
  }
  if (Array.isArray(data.lead_sources)) {
    state.leadSources = data.lead_sources;
  }
  if (Array.isArray(data.priorities)) {
    state.priorities = data.priorities;
  }
  if (Array.isArray(data.activity_types)) {
    state.activityTypes = data.activity_types;
  }
  if (Array.isArray(data.pump_types) && data.pump_types.length > 0) {
    state.pumpTypes = data.pump_types;
  }
  if (Array.isArray(data.customer_po_statuses)) {
    state.customerPoStatuses = data.customer_po_statuses;
  } else if (Array.isArray(data.customerPoStatuses)) {
    state.customerPoStatuses = data.customerPoStatuses;
  }
  if (Array.isArray(data.quotation_statuses)) {
    state.quotationStatuses = data.quotation_statuses;
  } else if (Array.isArray(data.quotationStatuses)) {
    state.quotationStatuses = data.quotationStatuses;
  }
  const rawSalesOrderStatuses =
    data.sales_order_statuses ||
    data.salesOrderStatuses ||
    data.order_statuses ||
    data.orderStatuses;
  if (Array.isArray(rawSalesOrderStatuses)) {
    state.salesOrderStatuses = rawSalesOrderStatuses.map((item: any, idx: number) => {
      if (typeof item === "object" && item !== null) {
        return {
          label: item.label || item.name || item.title || String(item.value ?? item.id ?? `Status ${idx}`),
          value: Number(item.value ?? item.id ?? idx),
        };
      }
      return {
        label: String(item),
        value: idx,
      };
    });
  } else if (rawSalesOrderStatuses && typeof rawSalesOrderStatuses === "object") {
    state.salesOrderStatuses = Object.entries(rawSalesOrderStatuses).map(([key, val]) => ({
      label: String(val),
      value: Number(key),
    }));
  }
  if (Array.isArray(data.sales_taxes)) {
    state.salesTaxes = data.sales_taxes;
    state.taxes = data.sales_taxes;
  } else if (Array.isArray(data.taxes)) {
    state.salesTaxes = data.taxes;
    state.taxes = data.taxes;
  }
  if (Array.isArray(data.vehicles)) {
    state.vehicles = data.vehicles;
  }
  if (Array.isArray(data.pumps)) {
    state.pumps = data.pumps;
  }
  if (Array.isArray(data.drivers)) {
    state.drivers = data.drivers;
  }
  if (Array.isArray(data.sites)) {
    state.sites = data.sites;
  }
  if (Array.isArray(data.mix_designs)) {
    state.mixDesigns = data.mix_designs;
  } else if (Array.isArray(data.mixDesigns)) {
    state.mixDesigns = data.mixDesigns;
  }
  if (Array.isArray(data.customers)) {
    state.customers = data.customers;
  }
  if (Array.isArray(data.sales_executives)) {
    state.salesExecutives = data.sales_executives;
  } else if (Array.isArray(data.salesExecutives)) {
    state.salesExecutives = data.salesExecutives;
  }
  if (Array.isArray(data.payment_terms)) {
    state.paymentTerms = data.payment_terms;
  } else if (Array.isArray(data.paymentTerms)) {
    state.paymentTerms = data.paymentTerms;
  }
  if (Array.isArray(data.plants)) {
    state.plants = data.plants;
  }
  if (Array.isArray(data.units)) {
    state.units = data.units;
  } else if (Array.isArray(data.uoms)) {
    state.units = data.uoms;
  }

  state.isLoaded = true;
  state.isLoading = false;
  state.error = null;
}

const dropdownSlice = createSlice({
  name: "dropdowns",
  initialState,
  reducers: {
    setDropdowns: (state, action: PayloadAction<any>) => {
      applyDropdownData(state, action.payload);
    },
    setCustomerPoStatuses: (
      state,
      action: PayloadAction<StatusDropdownOption[]>,
    ) => {
      state.customerPoStatuses = action.payload;
    },
    setQuotationStatuses: (
      state,
      action: PayloadAction<StatusDropdownOption[]>,
    ) => {
      state.quotationStatuses = action.payload;
    },
    setSalesOrderStatuses: (
      state,
      action: PayloadAction<StatusDropdownOption[]>,
    ) => {
      state.salesOrderStatuses = action.payload;
    },
    setSalesTaxes: (state, action: PayloadAction<any[]>) => {
      state.salesTaxes = action.payload;
      state.taxes = action.payload;
    },
    setVehicles: (state, action: PayloadAction<VehicleDropdownItem[]>) => {
      state.vehicles = action.payload;
    },
    setPumps: (state, action: PayloadAction<PumpDropdownItem[]>) => {
      state.pumps = action.payload;
    },
    setDrivers: (state, action: PayloadAction<DriverDropdownItem[]>) => {
      state.drivers = action.payload;
    },
    setSites: (state, action: PayloadAction<any[]>) => {
      state.sites = action.payload;
    },
    setMixDesigns: (state, action: PayloadAction<any[]>) => {
      state.mixDesigns = action.payload;
    },
    setCustomers: (state, action: PayloadAction<any[]>) => {
      state.customers = action.payload;
    },
    setOrders: (state, action: PayloadAction<any[]>) => {
      state.orders = action.payload;
    },
    setDropdownField: (
      state,
      action: PayloadAction<{ key: string; value: any }>,
    ) => {
      (state as any)[action.payload.key] = action.payload.value;
    },
    setDropdownsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setDropdownsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    resetDropdowns: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDropdowns.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDropdowns.fulfilled, (state, action) => {
        applyDropdownData(state, action.payload);
      })
      .addCase(fetchDropdowns.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) || "Failed to load dropdowns";
      });
  },
});

export const {
  setDropdowns,
  setCustomerPoStatuses,
  setQuotationStatuses,
  setSalesOrderStatuses,
  setSalesTaxes,
  setVehicles,
  setPumps,
  setDrivers,
  setSites,
  setMixDesigns,
  setCustomers,
  setOrders,
  setDropdownField,
  setDropdownsLoading,
  setDropdownsError,
  resetDropdowns,
} = dropdownSlice.actions;

export const selectCustomerPoStatuses = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.customerPoStatuses;
export const selectQuotationStatuses = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.quotationStatuses;
export const selectSalesOrderStatuses = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.salesOrderStatuses;
export const selectSalesTaxes = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.salesTaxes;
export const selectVehicles = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.vehicles;
export const selectPumps = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.pumps;
export const selectDrivers = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.drivers;
export const selectPumpTypes = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.pumpTypes;
export const selectOrders = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.orders;
export const selectDropdownRawData = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.rawData;
export const selectLeadStatuses = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.leadStatuses;
export const selectLeadStatusOptions = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.leadStatusOptions;
export const selectLeadSources = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.leadSources;
export const selectPriorities = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.priorities;
export const selectSalesExecutives = (state: { dropdowns: DropdownState }) =>
  state.dropdowns.salesExecutives;

export default dropdownSlice.reducer;
