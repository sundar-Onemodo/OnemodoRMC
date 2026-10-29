import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface CustomerDropdownItem {
  id: number;
  legal_name: string;
  plant_id?: number;
}

export interface SiteDropdownItem {
  id: number;
  name: string;
  patron_id?: number[] | null;
  site_address_1?: string | null;
  code?: string | null;
}

export interface MixDesignDropdownItem {
  id: number;
  design_name: string;
  name?: string;
  design_code?: string | null;
  code?: string | null;
  rate_per_qty?: string;
  concrete_grade_id?: number;
}

export interface TaxDropdownItem {
  id: number;
  tax_name: string;
  name?: string;
  tax_rate?: string | number;
  rate?: number;
  parent_id?: number | null;
}

export interface SalesExecutiveDropdownItem {
  id: number;
  label: string;
  plant_id?: number;
  employee_code?: string;
}

export interface QuotationState {
  customers: CustomerDropdownItem[];
  sites: SiteDropdownItem[];
  mixDesigns: MixDesignDropdownItem[];
  taxes: TaxDropdownItem[];
  salesExecutives: SalesExecutiveDropdownItem[];
  selectedCustomer: CustomerDropdownItem | null;
  selectedSite: SiteDropdownItem | null;
  selectedSalesExecutive: SalesExecutiveDropdownItem | null;
  isLoadingDropdowns: boolean;
  dropdownError: string | null;
}

const initialState: QuotationState = {
  customers: [],
  sites: [],
  mixDesigns: [],
  taxes: [],
  salesExecutives: [],
  selectedCustomer: null,
  selectedSite: null,
  selectedSalesExecutive: null,
  isLoadingDropdowns: false,
  dropdownError: null,
};

const quotationSlice = createSlice({
  name: "quotation",
  initialState,
  reducers: {
    setCustomers: (state, action: PayloadAction<CustomerDropdownItem[]>) => {
      state.customers = action.payload;
    },
    setSites: (state, action: PayloadAction<SiteDropdownItem[]>) => {
      state.sites = action.payload;
    },
    setMixDesigns: (state, action: PayloadAction<MixDesignDropdownItem[]>) => {
      state.mixDesigns = action.payload;
    },
    setTaxes: (state, action: PayloadAction<TaxDropdownItem[]>) => {
      state.taxes = action.payload;
    },
    setSalesExecutives: (
      state,
      action: PayloadAction<SalesExecutiveDropdownItem[]>,
    ) => {
      state.salesExecutives = action.payload;
    },
    setSelectedCustomer: (
      state,
      action: PayloadAction<CustomerDropdownItem | null>,
    ) => {
      state.selectedCustomer = action.payload;
    },
    setSelectedSite: (
      state,
      action: PayloadAction<SiteDropdownItem | null>,
    ) => {
      state.selectedSite = action.payload;
    },
    setSelectedSalesExecutive: (
      state,
      action: PayloadAction<SalesExecutiveDropdownItem | null>,
    ) => {
      state.selectedSalesExecutive = action.payload;
    },
    setDropdownLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoadingDropdowns = action.payload;
    },
    setDropdownError: (state, action: PayloadAction<string | null>) => {
      state.dropdownError = action.payload;
    },
    clearQuotationSelection: (state) => {
      state.selectedCustomer = null;
      state.selectedSite = null;
      state.selectedSalesExecutive = null;
    },
  },
});

export const {
  setCustomers,
  setSites,
  setMixDesigns,
  setTaxes,
  setSalesExecutives,
  setSelectedCustomer,
  setSelectedSite,
  setSelectedSalesExecutive,
  setDropdownLoading,
  setDropdownError,
  clearQuotationSelection,
} = quotationSlice.actions;

export default quotationSlice.reducer;
