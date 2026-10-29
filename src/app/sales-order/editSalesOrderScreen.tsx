import { baseURL } from '@/components/baseUrl/baseUrlAPI';
import { AppHeader } from '@/components/ui/app-header';
import { Colors } from '@/constants/theme';
import { StatusDropdownOption, setSalesOrderStatuses } from '@/store/dropdownSlice';
import { RootState } from '@/store/store';
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from '@expo/vector-icons';
import axios from 'axios';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

// ==========================================
// INTERFACES
// ==========================================

export interface DropdownOption {
  id: number | string;
  label: string;
  subLabel?: string;
  value?: any;
  extra?: any;
}

const DEFAULT_PUMP_OPTIONS: DropdownOption[] = [
  { id: 'none', label: 'None / Direct Pour', value: null },
  { id: 'boom_pump', label: 'Boom Pump', value: 'boom_pump' },
  { id: 'line_pump', label: 'Line Pump', value: 'line_pump' },
  { id: 'stationary_pump', label: 'Stationary Pump', value: 'stationary_pump' },
  { id: 'crane_bucket', label: 'Crane Bucket', value: 'crane_bucket' },
  { id: 'direct_pour', label: 'Direct Pour', value: 'direct_pour' },
  { id: 'manual', label: 'Manual Pour', value: 'manual' },
];

const FALLBACK_STATUS_OPTIONS: StatusDropdownOption[] = [
  { label: 'Draft', value: 0 },
  { label: 'Schedule', value: 1 },
  { label: 'Inprogress', value: 2 },
  { label: 'Completed', value: 3 },
  { label: 'Cancel', value: 4 },
];

function formatDateTimeDisplay(date: Date | null): string {
  if (!date) return 'Not Scheduled';
  const d = date.getDate();
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minStr = minutes < 10 ? `0${minutes}` : String(minutes);

  return `${d} ${monthName} ${year}, ${hours}:${minStr} ${ampm}`;
}

function formatToApiDateTime(date: Date | null): string | null {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}T${hours}:${minutes}:${seconds}`;
}

function parseApiDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function cleanSalesExecutiveName(raw?: string | null): string {
  if (!raw) return '';
  return raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function extractSalesExecutiveId(se: any): number | null {
  if (!se) return null;
  if (typeof se === 'number' && !isNaN(se) && se > 0) return se;
  if (typeof se === 'string' && !isNaN(Number(se)) && se.trim() !== '') {
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
    se.extra?.value ??
    se.extra?.user_id ??
    se.extra?.sales_executive_id ??
    se.user?.id;

  if (raw !== undefined && raw !== null && raw !== '') {
    const num = Number(raw);
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
}

export function extractTaxId(tax: any): number | null {
  if (!tax) return null;
  if (tax.id === 'no_tax' || tax.id === 'none') return null;
  if (typeof tax === 'number' && !isNaN(tax) && tax > 0) return tax;
  if (typeof tax === 'string' && !isNaN(Number(tax)) && tax.trim() !== '') {
    const n = Number(tax.trim());
    if (n > 0) return n;
  }

  const raw =
    tax.id ??
    tax.value ??
    tax.tax_id ??
    tax.extra?.id ??
    tax.extra?.value ??
    tax.extra?.tax_id;

  if (raw !== undefined && raw !== null && raw !== 'no_tax' && raw !== '') {
    const num = Number(raw);
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
}

export interface StatusRadioOption {
  label: string;
  value: number;
  color: string;
  bgColor: string;
  description: string;
}

// ==========================================
// MAIN COMPONENT: EDIT SALES ORDER
// ==========================================

export default function EditSalesOrderScreen() {
  const dispatch = useDispatch();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const params = useLocalSearchParams<{
    admin_order_id?: string;
    id?: string;
    orderData?: string;
  }>();
  const adminOrderId = params.admin_order_id || params.id;

  // Immediately parse orderData if passed from list screen
  const initialOrderData = useMemo(() => {
    if (!params.orderData) return null;
    try {
      return typeof params.orderData === 'string'
        ? JSON.parse(params.orderData)
        : params.orderData;
    } catch (e) {
      console.warn('[EditSalesOrderScreen] Failed to parse orderData param:', e);
      return null;
    }
  }, [params.orderData]);

  const { token, plant_id, user } = useSelector(
    (state: RootState) => state.auth,
  );
  const reduxPumpTypes = useSelector(
    (state: RootState) => state.dropdowns.pumpTypes,
  );
  const reduxSalesOrderStatuses = useSelector(
    (state: RootState) => state.dropdowns.salesOrderStatuses,
  );
  const reduxSalesExecutives = useSelector(
    (state: RootState) =>
      state.dropdowns.salesExecutives ||
      (state as any).quotation?.salesExecutives ||
      [],
  );
  const reduxTaxes = useSelector(
    (state: RootState) =>
      state.dropdowns.salesTaxes ||
      state.dropdowns.taxes ||
      (state as any).quotation?.taxes ||
      [],
  );

  const effectivePlantId =
    plant_id ?? user?.default_plant_id ?? (user as any)?.plant_id ?? null;

  // Dropdown lists initialized with redux fallback
  const [customers, setCustomers] = useState<DropdownOption[]>([]);
  const [sites, setSites] = useState<DropdownOption[]>([]);
  const [mixDesigns, setMixDesigns] = useState<DropdownOption[]>([]);
  const [taxes, setTaxes] = useState<DropdownOption[]>(() => {
    if (Array.isArray(reduxTaxes) && reduxTaxes.length > 0) {
      const parentTaxes = reduxTaxes.filter(
        (t: any) => t.parent_id === null || t.parent_id === undefined,
      );
      const list = parentTaxes.length > 0 ? parentTaxes : reduxTaxes;
      return [
        { id: 'no_tax', label: 'No Tax / None', subLabel: '0%', extra: null },
        ...list.map((t: any) => ({
          id: t.id,
          label: t.tax_name || t.name || t.title || `Tax #${t.id}`,
          subLabel: `${t.tax_rate ?? t.rate ?? 0}%`,
          extra: t,
        })),
      ];
    }
    return [{ id: 'no_tax', label: 'No Tax / None', subLabel: '0%', extra: null }];
  });

  const [salesExecutives, setSalesExecutives] = useState<DropdownOption[]>(() => {
    if (Array.isArray(reduxSalesExecutives) && reduxSalesExecutives.length > 0) {
      return reduxSalesExecutives.map((se: any) => {
        const execId = extractSalesExecutiveId(se);
        const effectiveId = execId ?? se.id ?? se.value;
        return {
          id: effectiveId,
          value: execId,
          label: cleanSalesExecutiveName(
            se.label || se.name || se.full_name || se.first_name || (se.user?.name ?? `Executive #${effectiveId}`),
          ),
          subLabel: se.employee_code || undefined,
          extra: se,
        };
      });
    }
    return [];
  });
  const [pumpOptions, setPumpOptions] =
    useState<DropdownOption[]>(DEFAULT_PUMP_OPTIONS);

  const [isLoadingData, setIsLoadingData] = useState<boolean>(() => {
    return !initialOrderData;
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form Fields - Initialized with initialOrderData immediately
  const [orderHeaderInfo, setOrderHeaderInfo] = useState<{
    orderNo?: string;
    fullNumber?: string;
    initialStatus?: number;
  }>(() => ({
    orderNo: initialOrderData?.order_no || String(adminOrderId || ''),
    fullNumber: initialOrderData?.full_number || initialOrderData?.order_no,
    initialStatus: Number(initialOrderData?.status ?? 1),
  }));

  const [selectedCustomer, setSelectedCustomer] =
    useState<DropdownOption | null>(() => {
      if (initialOrderData?.customer) {
        return {
          id: initialOrderData.customer.id,
          label:
            initialOrderData.customer.legal_name ||
            initialOrderData.customer.name ||
            `Customer #${initialOrderData.customer.id}`,
        };
      }
      if (initialOrderData?.customer_id) {
        return {
          id: initialOrderData.customer_id,
          label: `Customer #${initialOrderData.customer_id}`,
        };
      }
      return null;
    });

  const [selectedSite, setSelectedSite] = useState<DropdownOption | null>(
    () => {
      if (initialOrderData?.site) {
        return {
          id: initialOrderData.site.id,
          label:
            initialOrderData.site.name ||
            `Site #${initialOrderData.site.id}`,
        };
      }
      if (initialOrderData?.site_id) {
        return {
          id: initialOrderData.site_id,
          label: `Site #${initialOrderData.site_id}`,
        };
      }
      return null;
    },
  );

  const [selectedMixDesign, setSelectedMixDesign] =
    useState<DropdownOption | null>(() => {
      if (initialOrderData?.mix_design) {
        return {
          id: initialOrderData.mix_design.id,
          label:
            initialOrderData.mix_design.design_name ||
            initialOrderData.mix_design.name ||
            `Mix #${initialOrderData.mix_design.id}`,
        };
      }
      if (initialOrderData?.mix_design_id) {
        return {
          id: initialOrderData.mix_design_id,
          label: `Mix #${initialOrderData.mix_design_id}`,
        };
      }
      return null;
    });

  const [selectedSalesExecutive, setSelectedSalesExecutive] =
    useState<DropdownOption | null>(() => {
      if (initialOrderData?.sales_executive) {
        const execId = extractSalesExecutiveId(initialOrderData.sales_executive);
        const effId = execId ?? initialOrderData.sales_executive.id;
        return {
          id: effId,
          value: execId,
          label: cleanSalesExecutiveName(
            initialOrderData.sales_executive.name ||
              initialOrderData.sales_executive.label ||
              `Executive #${effId}`,
          ),
          subLabel: initialOrderData.sales_executive.employee_code || undefined,
          extra: initialOrderData.sales_executive,
        };
      }
      const seId = extractSalesExecutiveId(initialOrderData?.sales_executive_id);
      if (seId) {
        const found = Array.isArray(reduxSalesExecutives)
          ? reduxSalesExecutives.find(
              (se: any) => extractSalesExecutiveId(se) === seId,
            )
          : null;
        if (found) {
          return {
            id: seId,
            value: seId,
            label: cleanSalesExecutiveName(
              found.label || found.name || `Executive #${seId}`,
            ),
            subLabel: found.employee_code || undefined,
            extra: found,
          };
        }
        return {
          id: seId,
          value: seId,
          label: `Executive #${seId}`,
        };
      }
      return null;
    });

  const [totalQty, setTotalQty] = useState<string>(() => {
    return initialOrderData?.total_qty !== undefined &&
      initialOrderData?.total_qty !== null
      ? String(initialOrderData.total_qty)
      : '';
  });

  const [rate, setRate] = useState<string>(() => {
    return initialOrderData?.rate !== undefined &&
      initialOrderData?.rate !== null
      ? String(initialOrderData.rate)
      : '';
  });

  const [selectedTax, setSelectedTax] = useState<DropdownOption | null>(() => {
    if (initialOrderData?.tax) {
      const taxId = extractTaxId(initialOrderData.tax);
      return {
        id: taxId ?? initialOrderData.tax.id,
        value: taxId,
        label:
          initialOrderData.tax.tax_name ||
          initialOrderData.tax.name ||
          `Tax #${taxId}`,
        subLabel: initialOrderData.tax.tax_rate
          ? `${initialOrderData.tax.tax_rate}%`
          : undefined,
        extra: initialOrderData.tax,
      };
    }
    const taxId = extractTaxId(initialOrderData?.tax_id);
    if (taxId) {
      const found = Array.isArray(reduxTaxes)
        ? reduxTaxes.find(
            (t: any) => extractTaxId(t) === taxId,
          )
        : null;
      if (found) {
        return {
          id: taxId,
          value: taxId,
          label: found.tax_name || found.name || `Tax #${taxId}`,
          subLabel: `${found.tax_rate ?? found.rate ?? 0}%`,
          extra: found,
        };
      }
      return {
        id: taxId,
        value: taxId,
        label: `Tax #${taxId}`,
        subLabel: 'GST',
      };
    }
    return null;
  });

  const [isTaxInclusive, setIsTaxInclusive] = useState<boolean>(() => {
    return Boolean(initialOrderData?.is_tax_inclusive);
  });

  const [selectedPump, setSelectedPump] = useState<DropdownOption | null>(
    () => {
      const rawPump =
        initialOrderData?.concrete_pump || initialOrderData?.pump_type;
      if (rawPump) {
        const match = DEFAULT_PUMP_OPTIONS.find((p) => p.value === rawPump);
        return (
          match || {
            id: rawPump,
            label: String(rawPump)
              .split('_')
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' '),
            value: rawPump,
          }
        );
      }
      return DEFAULT_PUMP_OPTIONS[0];
    },
  );

  const [pumpRate, setPumpRate] = useState<string>(() => {
    return initialOrderData?.pump_rate !== undefined &&
      initialOrderData?.pump_rate !== null
      ? String(initialOrderData.pump_rate)
      : '0';
  });

  const [scheduledStart, setScheduledStart] = useState<Date | null>(() => {
    return parseApiDate(initialOrderData?.scheduled_start);
  });

  const [scheduledEnd, setScheduledEnd] = useState<Date | null>(() => {
    return parseApiDate(initialOrderData?.scheduled_end);
  });

  const [selectedStatus, setSelectedStatus] = useState<number>(() => {
    return Number(initialOrderData?.status ?? 1);
  });

  const [initialStatus, setInitialStatus] = useState<number>(() => {
    return Number(initialOrderData?.status ?? 1);
  });

  const isStatusTouchedByUserRef = useRef<boolean>(false);

  const handleStatusChange = (newStatus: number) => {
    console.log('[EditSalesOrder] Status selected by user:', newStatus);
    isStatusTouchedByUserRef.current = true;
    setSelectedStatus(newStatus);
  };

  // Searchable Picker Modal State
  const [pickerModalVisible, setPickerModalVisible] = useState<boolean>(false);
  const [pickerType, setPickerType] = useState<
    'customer' | 'site' | 'mix' | 'tax' | 'salesExec' | 'pump' | 'status'
  >('customer');
  const [pickerSearch, setPickerSearch] = useState<string>('');

  // DateTime Picker Modal State
  const [activeDateTimeTarget, setActiveDateTimeTarget] = useState<
    'start' | 'end' | null
  >(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [dtCalMonth, setDtCalMonth] = useState<number>(new Date().getMonth());
  const [dtCalYear, setDtCalYear] = useState<number>(new Date().getFullYear());
  const [tempHour, setTempHour] = useState<number>(10);
  const [hourText, setHourText] = useState<string>('10');
  const [tempMinute, setTempMinute] = useState<number>(0);
  const [minuteText, setMinuteText] = useState<string>('00');
  const [tempAmPm, setTempAmPm] = useState<'AM' | 'PM'>('AM');

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('#0F172A');
      }

      const onBackPress = () => {
        handleBack();
        return true;
      };
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );
      return () => subscription.remove();
    }, [handleBack]),
  );

  // Status options calculation based on user requirement:
  // "when user click edit status want to show Inprogress , cancel"
  // "if the status change to cancel (4) show edit button on the list when user selected cancel then want to edit that time the status should need to show Schedule,Inprogress"
  const availableStatusOptions: StatusRadioOption[] = useMemo(() => {
    const allStatuses =
      reduxSalesOrderStatuses && reduxSalesOrderStatuses.length > 0
        ? reduxSalesOrderStatuses
        : FALLBACK_STATUS_OPTIONS;

    const findOption = (
      targetVal: number,
      fallbackLabel: string,
      color: string,
      bgColor: string,
      description: string,
    ): StatusRadioOption => {
      const found = allStatuses.find((s: any) => {
        const val = Number(s.value ?? s.id);
        if (val === targetVal) return true;
        const normLabel = String(s.label || s.name || '').toLowerCase().replace(/[\s_-]/g, '');
        const normFallback = fallbackLabel.toLowerCase().replace(/[\s_-]/g, '');
        return normLabel.includes(normFallback) || normFallback.includes(normLabel);
      });

      const effectiveVal =
        found && (found.value !== undefined || (found as any).id !== undefined)
          ? Number(found.value ?? (found as any).id)
          : targetVal;

      return {
        label: found?.label || (found as any)?.name || fallbackLabel,
        value: effectiveVal,
        color,
        bgColor,
        description,
      };
    };

    const scheduleOpt = findOption(
      1,
      'Schedule',
      '#2563EB',
      '#EFF6FF',
      'Queue order for production & dispatch schedule',
    );
    const inprogressOpt = findOption(
      2,
      'Inprogress',
      '#059669',
      '#ECFDF5',
      'Mark as active order currently in progress at plant',
    );
    const cancelOpt = findOption(
      4,
      'Cancel',
      '#DC2626',
      '#FEF2F2',
      'Cancel this sales order and stop fulfillment',
    );

    if (initialStatus === 4) {
      // If initial status was Cancel (4): show Cancel, Schedule (1) & Inprogress (2)
      return [
        cancelOpt,
        scheduleOpt,
        inprogressOpt,
      ];
    } else {
      // Initial status was 0 or 1 (Draft / Schedule): show Schedule, Inprogress (2) & Cancel (4)
      return [
        scheduleOpt,
        inprogressOpt,
        cancelOpt,
      ];
    }
  }, [initialStatus, reduxSalesOrderStatuses]);

  // Load order data and all dropdowns
  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const cleanToken = token.trim();
    headers['Authorization'] = cleanToken.startsWith('Bearer ')
      ? cleanToken
      : `Bearer ${cleanToken}`;

    if (effectivePlantId !== null && effectivePlantId !== undefined) {
      headers['X-Plant-Id'] = String(effectivePlantId);
    }

    // Only show full-screen loader if we don't have initial data already
    if (!initialOrderData) {
      setIsLoadingData(true);
    }

    Promise.all([
      // 1. Fetch Order Details (if adminOrderId exists)
      adminOrderId
        ? axios
            .get(`${baseURL}/orders/${adminOrderId}`, {
              headers,
              params: effectivePlantId ? { plant_id: effectivePlantId } : undefined,
              timeout: 15000,
            })
            .then((res) => res.data?.data || res.data)
            .catch(async () => {
              if (initialOrderData) return initialOrderData;
              try {
                const listRes = await axios.get(`${baseURL}/orders`, {
                  headers,
                  params: {
                    page: 1,
                    per_page: 50,
                    ...(effectivePlantId ? { plant_id: effectivePlantId } : {}),
                  },
                  timeout: 15000,
                });
                const listData =
                  listRes.data?.data?.data || listRes.data?.data || [];
                return listData.find(
                  (o: any) => String(o.id) === String(adminOrderId),
                );
              } catch {
                return initialOrderData;
              }
            })
        : Promise.resolve(initialOrderData),

      // 2. Customers
      axios
        .get(`${baseURL}/customers`, {
          headers,
          params: { page: 1, per_page: 100, plant_id: effectivePlantId },
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

      // 3. Sites
      axios
        .get(`${baseURL}/sites`, {
          headers,
          params: { page: 1, per_page: 100, plant_id: effectivePlantId },
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

      // 4. Mix Designs
      axios
        .get(`${baseURL}/mix-designs`, {
          headers,
          params: { page: 1, per_page: 100, plant_id: effectivePlantId },
          timeout: 25000,
        })
        .then((res) => {
          const list = res.data?.data?.data || res.data?.data || [];
          return (list || []).map((m: any) => ({
            id: m.id,
            label: m.design_name || m.name || `Mix #${m.id}`,
            subLabel: m.rate_per_qty
              ? `Base: ₹${m.rate_per_qty}/m³`
              : undefined,
            extra: m,
          }));
        })
        .catch(() => []),

      // 5. Taxes (global endpoint, page=1 without plant_id/per_page)
      axios
        .get(`${baseURL}/taxes`, {
          headers,
          params: { page: 1 },
          timeout: 25000,
        })
        .then((res) => {
          const raw = Array.isArray(res.data?.data?.data)
            ? res.data.data.data
            : Array.isArray(res.data?.data)
              ? res.data.data
              : Array.isArray(res.data?.taxes)
                ? res.data.taxes
                : Array.isArray(res.data)
                  ? res.data
                  : [];
          const parentTaxes = raw.filter(
            (t: any) => t.parent_id === null || t.parent_id === undefined,
          );
          const effectiveList = parentTaxes.length > 0 ? parentTaxes : raw;
          return effectiveList.map((t: any) => ({
            id: t.id,
            label: t.tax_name || t.name || t.title || `Tax #${t.id}`,
            subLabel: `${t.tax_rate ?? t.rate ?? 0}%`,
            extra: t,
          }));
        })
        .catch(() => []),

      // 6. Sales Executives
      axios
        .get(`${baseURL}/sales-executives`, {
          headers,
          params: effectivePlantId ? { plant_id: String(effectivePlantId) } : undefined,
          timeout: 25000,
        })
        .then((res) => {
          const list = Array.isArray(res.data?.data)
            ? res.data.data
            : Array.isArray(res.data?.data?.data)
              ? res.data.data.data
              : Array.isArray(res.data)
                ? res.data
                : [];
          console.log('[EditSalesOrder] Step 2.6: Fetched /sales-executives count:', list.length);
          return list.map((se: any) => {
            const execId = extractSalesExecutiveId(se);
            const effectiveId = execId ?? se.id ?? se.value;
            return {
              id: effectiveId,
              value: execId,
              label: cleanSalesExecutiveName(
                se.name || se.label || se.full_name || se.first_name || (se.user ? se.user.name : `Executive #${effectiveId}`),
              ),
              subLabel: se.employee_code || undefined,
              extra: se,
            };
          });
        })
        .catch((err) => {
          console.warn('[EditSalesOrder] Error fetching /sales-executives:', err?.message || err);
          return [];
        }),

      // 7. Generic Dropdowns (/dropdowns contains pump_types, sales_executives, sales_taxes)
      axios
        .get(`${baseURL}/dropdowns`, {
          headers,
          params: effectivePlantId ? { plant_id: String(effectivePlantId) } : undefined,
          timeout: 25000,
        })
        .then((res) => res.data?.data || res.data || {})
        .catch(() => ({})),
    ])
      .then(
        ([
          fetchedOrder,
          custList,
          siteList,
          mixList,
          fetchedTaxList,
          fetchedExecList,
          dropdownData,
        ]) => {
          if (!isMounted) return;

          console.log('[EditSalesOrder] Step 3: All API responses received in edit screen:', {
            hasFetchedOrder: Boolean(fetchedOrder),
            custListCount: custList.length,
            siteListCount: siteList.length,
            mixListCount: mixList.length,
            fetchedTaxesCount: fetchedTaxList.length,
            fetchedExecsCount: fetchedExecList.length,
          });

          // Build dictionary of all known taxes for instant lookup
          const allKnownTaxes = new Map<string, any>();
          [
            ...(Array.isArray(fetchedTaxList) ? fetchedTaxList : []),
            ...(Array.isArray(reduxTaxes) ? reduxTaxes : []),
            ...(Array.isArray(dropdownData.sales_taxes) ? dropdownData.sales_taxes : []),
            ...(Array.isArray(dropdownData.taxes) ? dropdownData.taxes : []),
          ].forEach((t: any) => {
            const tid = extractTaxId(t);
            if (tid !== null) {
              allKnownTaxes.set(String(tid), t);
            }
            if (t && t.id !== undefined && t.id !== null) {
              allKnownTaxes.set(String(t.id), t);
            }
          });

          // Build dictionary of all known sales executives
          const allKnownExecs = new Map<string, any>();
          [
            ...(Array.isArray(fetchedExecList) ? fetchedExecList : []),
            ...(Array.isArray(reduxSalesExecutives) ? reduxSalesExecutives : []),
            ...(Array.isArray(dropdownData.sales_executives) ? dropdownData.sales_executives : []),
            ...(Array.isArray(dropdownData.salesExecutives) ? dropdownData.salesExecutives : []),
          ].forEach((se: any) => {
            const eid = extractSalesExecutiveId(se);
            if (eid !== null) {
              allKnownExecs.set(String(eid), se);
            }
            if (se && se.id !== undefined && se.id !== null) {
              allKnownExecs.set(String(se.id), se);
            }
          });

          // Resolve Taxes with redundancy
          let finalTaxItems = fetchedTaxList;
          if (!finalTaxItems || finalTaxItems.length === 0) {
            const ddTaxes =
              dropdownData.sales_taxes || dropdownData.taxes || reduxTaxes;
            if (Array.isArray(ddTaxes) && ddTaxes.length > 0) {
              const parentTaxes = ddTaxes.filter(
                (t: any) => t.parent_id === null || t.parent_id === undefined,
              );
              const effectiveT = parentTaxes.length > 0 ? parentTaxes : ddTaxes;
              finalTaxItems = effectiveT.map((t: any) => ({
                id: t.id,
                value: extractTaxId(t),
                label: t.tax_name || t.name || t.title || `Tax #${t.id}`,
                subLabel: `${t.tax_rate ?? t.rate ?? 0}%`,
                extra: t,
              }));
            }
          }
          const finalTaxes: DropdownOption[] = [
            { id: 'no_tax', label: 'No Tax / None', subLabel: '0%', extra: null },
            ...(finalTaxItems || []),
          ];

          // Resolve Sales Executives with redundancy
          let finalExecList = fetchedExecList;
          if (!finalExecList || finalExecList.length === 0) {
            const ddExecs =
              dropdownData.sales_executives || dropdownData.salesExecutives || reduxSalesExecutives;
            if (Array.isArray(ddExecs) && ddExecs.length > 0) {
              finalExecList = ddExecs.map((se: any) => {
                const execId = extractSalesExecutiveId(se);
                const effectiveId = execId ?? se.id ?? se.value;
                return {
                  id: effectiveId,
                  value: execId,
                  label: cleanSalesExecutiveName(
                    se.label || se.name || se.full_name || se.first_name || (se.user?.name ?? `Executive #${effectiveId}`),
                  ),
                  subLabel: se.employee_code || undefined,
                  extra: se,
                };
              });
            }
          }
          if (!finalExecList) finalExecList = [];

          // Resolve Pump Options
          const apiPumpTypes = dropdownData.pump_types || reduxPumpTypes;
          let finalPumpList = DEFAULT_PUMP_OPTIONS;
          if (Array.isArray(apiPumpTypes) && apiPumpTypes.length > 0) {
            const dynamicList: DropdownOption[] = apiPumpTypes.map(
              (p: string) => ({
                id: p,
                label: p
                  .split('_')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' '),
                value: p,
              }),
            );
            finalPumpList = [
              { id: 'none', label: 'None / Direct Pour', value: null },
              ...dynamicList,
            ];
          }

          setCustomers(custList);
          setSites(siteList);
          setMixDesigns(mixList);
          setTaxes(finalTaxes);
          setSalesExecutives(finalExecList);
          setPumpOptions(finalPumpList);

          // Merge fetchedOrder with initialOrderData so no attributes are lost
          const targetOrder =
            fetchedOrder && (fetchedOrder.id || fetchedOrder.order_no)
              ? { ...initialOrderData, ...fetchedOrder }
              : initialOrderData;

          console.log('[EditSalesOrder] Step 3.1: Resolved targetOrder in edit screen:', targetOrder);

          if (targetOrder) {
            setOrderHeaderInfo({
              orderNo: targetOrder.order_no || String(targetOrder.id),
              fullNumber: targetOrder.full_number || targetOrder.order_no,
              initialStatus: Number(targetOrder.status ?? 1),
            });

            const currStatus = Number(targetOrder.status ?? 1);
            setInitialStatus(currStatus);
            if (!isStatusTouchedByUserRef.current) {
              console.log('[EditSalesOrder] Step 3.1b: Initializing status to order status:', currStatus);
              setSelectedStatus(currStatus);
            } else {
              console.log('[EditSalesOrder] Step 3.1b: User already selected status; preserving selectedStatus:', selectedStatus);
            }

            // Total Qty & Rate
            if (targetOrder.total_qty !== undefined && targetOrder.total_qty !== null) {
              setTotalQty(String(targetOrder.total_qty));
            }
            if (targetOrder.rate !== undefined && targetOrder.rate !== null) {
              setRate(String(targetOrder.rate));
            }
            if (targetOrder.pump_rate !== undefined && targetOrder.pump_rate !== null) {
              setPumpRate(String(targetOrder.pump_rate));
            }
            if (targetOrder.is_tax_inclusive !== undefined) {
              setIsTaxInclusive(Boolean(targetOrder.is_tax_inclusive));
            }

            // Customer
            const custId = targetOrder.customer?.id ?? targetOrder.customer_id;
            if (custId) {
              const matchedCust = custList.find((c: any) => String(c.id) === String(custId));
              setSelectedCustomer(
                matchedCust || {
                  id: custId,
                  label:
                    targetOrder.customer?.legal_name ||
                    targetOrder.customer?.name ||
                    `Customer #${custId}`,
                },
              );
            }

            // Site
            const siteId = targetOrder.site?.id ?? targetOrder.site_id;
            if (siteId) {
              const matchedSite = siteList.find((s: any) => String(s.id) === String(siteId));
              setSelectedSite(
                matchedSite || {
                  id: siteId,
                  label:
                    targetOrder.site?.name || `Site #${siteId}`,
                },
              );
            }

            // Mix Design
            const mixId =
              targetOrder.mix_design?.id ?? targetOrder.mix_design_id;
            if (mixId) {
              const matchedMix = mixList.find((m: any) => String(m.id) === String(mixId));
              setSelectedMixDesign(
                matchedMix || {
                  id: mixId,
                  label:
                    targetOrder.mix_design?.design_name ||
                    targetOrder.mix_design?.name ||
                    `Mix #${mixId}`,
                },
              );
            }

            // Sales Executive matching
            const seId = extractSalesExecutiveId(
              targetOrder.sales_executive_id ?? targetOrder.sales_executive,
            );
            console.log('[EditSalesOrder] Step 3.2: Matching sales executive for seId:', seId, {
              order_sales_executive_id: targetOrder.sales_executive_id,
              order_sales_executive: targetOrder.sales_executive,
            });

            if (seId !== null && seId !== undefined) {
              let matchedSe: DropdownOption | null = null;
              const knownE = allKnownExecs.get(String(seId));

              if (knownE) {
                matchedSe = {
                  id: seId,
                  value: seId,
                  label: cleanSalesExecutiveName(
                    knownE.label || knownE.name || knownE.full_name || knownE.first_name || (knownE.user?.name ?? `Executive #${seId}`),
                  ),
                  subLabel: knownE.employee_code || undefined,
                  extra: knownE,
                };
              } else if (targetOrder.sales_executive) {
                matchedSe = {
                  id: seId,
                  value: seId,
                  label: cleanSalesExecutiveName(
                    targetOrder.sales_executive.name ||
                      targetOrder.sales_executive.label ||
                      `Executive #${seId}`,
                  ),
                  subLabel: targetOrder.sales_executive.employee_code || undefined,
                  extra: targetOrder.sales_executive,
                };
              } else {
                const found = finalExecList.find(
                  (e: any) => extractSalesExecutiveId(e) === seId || String(e.id) === String(seId),
                );
                if (found) {
                  matchedSe = found;
                } else {
                  matchedSe = {
                    id: seId,
                    value: seId,
                    label: `Executive #${seId}`,
                  };
                }
              }

              console.log('[EditSalesOrder] Step 3.3: Matched Sales Executive Option:', matchedSe);
              setSelectedSalesExecutive(matchedSe);

              if (matchedSe && !finalExecList.some((e: any) => extractSalesExecutiveId(e) === seId || String(e.id) === String(seId))) {
                finalExecList.push(matchedSe);
              }
            } else {
              console.log('[EditSalesOrder] Step 3.2: Order has null sales_executive_id. Auto-assigning default from available list');
              if (finalExecList.length > 0) {
                const match = user
                  ? finalExecList.find(
                      (e: any) =>
                        String(extractSalesExecutiveId(e)) === String(user.id) ||
                        (e.label &&
                          user.name &&
                          e.label.toLowerCase().includes(user.name.toLowerCase())),
                    )
                  : null;
                const fallback = match || finalExecList[0];
                console.log('[EditSalesOrder] Step 3.3: Default fallback sales executive:', fallback);
                setSelectedSalesExecutive(fallback);
              }
            }

            // Tax matching
            const taxId = extractTaxId(targetOrder.tax_id ?? targetOrder.tax);
            console.log('[EditSalesOrder] Step 3.4: Matching tax for taxId:', taxId, {
              order_tax_id: targetOrder.tax_id,
              order_tax: targetOrder.tax,
            });

            if (taxId !== null && taxId !== undefined) {
              let matchedTax: DropdownOption | null = null;
              const knownT = allKnownTaxes.get(String(taxId));

              if (knownT) {
                matchedTax = {
                  id: taxId,
                  value: taxId,
                  label: knownT.tax_name || knownT.name || knownT.title || `Tax #${taxId}`,
                  subLabel: `${knownT.tax_rate ?? knownT.rate ?? 0}%`,
                  extra: knownT,
                };
              } else if (targetOrder.tax) {
                matchedTax = {
                  id: taxId,
                  value: taxId,
                  label:
                    targetOrder.tax.tax_name ||
                    targetOrder.tax.name ||
                    `Tax #${taxId}`,
                  subLabel: targetOrder.tax.tax_rate
                    ? `${targetOrder.tax.tax_rate}%`
                    : undefined,
                  extra: targetOrder.tax,
                };
              } else {
                const found = finalTaxes.find(
                  (t: any) => extractTaxId(t) === taxId || String(t.id) === String(taxId),
                );
                if (found) {
                  matchedTax = found;
                } else {
                  matchedTax = {
                    id: taxId,
                    value: taxId,
                    label: `Tax #${taxId}`,
                    subLabel: 'GST',
                  };
                }
              }

              console.log('[EditSalesOrder] Step 3.5: Matched Tax Option:', matchedTax);
              setSelectedTax(matchedTax);

              if (matchedTax && !finalTaxes.some((t) => extractTaxId(t) === taxId || String(t.id) === String(taxId))) {
                finalTaxes.push(matchedTax);
              }
            } else {
              console.log('[EditSalesOrder] Step 3.4: Order has no tax_id, selectedTax set to null');
              setSelectedTax(null);
            }

            // Pump
            const rawPump =
              targetOrder.concrete_pump || targetOrder.pump_type || null;
            if (rawPump) {
              const matchedPump = finalPumpList.find(
                (p: any) =>
                  String(p.value).toLowerCase() ===
                    String(rawPump).toLowerCase() ||
                  String(p.id).toLowerCase() === String(rawPump).toLowerCase(),
              );
              setSelectedPump(
                matchedPump || {
                  id: rawPump,
                  label: String(rawPump)
                    .split('_')
                    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' '),
                  value: rawPump,
                },
              );
            }

            // Scheduled Start & End
            if (targetOrder.scheduled_start) {
              setScheduledStart(parseApiDate(targetOrder.scheduled_start));
            }
            if (targetOrder.scheduled_end) {
              setScheduledEnd(parseApiDate(targetOrder.scheduled_end));
            }
          }
        },
      )
      .finally(() => {
        if (isMounted) setIsLoadingData(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, adminOrderId, effectivePlantId]);

  // Filter sites when customer changes
  const filteredSites = useMemo(() => {
    if (!selectedCustomer) return sites;
    const custId = selectedCustomer.id;
    const matched = sites.filter((s) => {
      const pId = s.extra?.patron_id ?? s.extra?.customer_id;
      return pId === custId;
    });
    return matched.length > 0 ? matched : sites;
  }, [sites, selectedCustomer]);

  // Open searchable picker
  const openPicker = (
    type: 'customer' | 'site' | 'mix' | 'tax' | 'salesExec' | 'pump' | 'status',
  ) => {
    setPickerType(type);
    setPickerSearch('');
    setPickerModalVisible(true);
  };

  // Get current picker items
  const currentPickerData = useMemo(() => {
    let source: DropdownOption[] = [];
    switch (pickerType) {
      case 'customer':
        source = customers;
        break;
      case 'site':
        source = filteredSites;
        break;
      case 'mix':
        source = mixDesigns;
        break;
      case 'tax':
        source = taxes;
        break;
      case 'salesExec':
        source = salesExecutives;
        break;
      case 'pump':
        source = pumpOptions;
        break;
      case 'status':
        source = availableStatusOptions.map((s) => ({
          id: s.value,
          label: s.label,
          value: s.value,
        }));
        break;
    }

    if (!pickerSearch.trim()) return source;
    const q = pickerSearch.trim().toLowerCase();
    return source.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.subLabel && item.subLabel.toLowerCase().includes(q)),
    );
  }, [
    pickerType,
    pickerSearch,
    customers,
    filteredSites,
    mixDesigns,
    taxes,
    salesExecutives,
    pumpOptions,
    availableStatusOptions,
  ]);

  // Select item from modal
  const handleSelectItem = (item: DropdownOption) => {
    console.log('[EditSalesOrder] Step 4: Selection changed in picker:', {
      type: pickerType,
      selectedItem: item,
      extractedExecId:
        pickerType === 'salesExec' ? extractSalesExecutiveId(item) : undefined,
      extractedTaxId:
        pickerType === 'tax' ? extractTaxId(item) : undefined,
    });

    switch (pickerType) {
      case 'customer':
        setSelectedCustomer(item);
        if (selectedSite) {
          const pId =
            selectedSite.extra?.patron_id ?? selectedSite.extra?.customer_id;
          if (pId && pId !== item.id) {
            setSelectedSite(null);
          }
        }
        break;
      case 'site':
        setSelectedSite(item);
        break;
      case 'mix':
        setSelectedMixDesign(item);
        if (item.extra?.rate_per_qty && (!rate || rate === '0')) {
          setRate(String(item.extra.rate_per_qty));
        }
        break;
      case 'tax':
        if (item.id === 'no_tax' || item.id === 'none') {
          setSelectedTax(null);
        } else {
          setSelectedTax(item);
        }
        break;
      case 'salesExec':
        setSelectedSalesExecutive(item);
        break;
      case 'pump':
        setSelectedPump(item);
        break;
      case 'status':
        handleStatusChange(Number(item.value ?? item.id));
        break;
    }
    setPickerModalVisible(false);
  };

  // ----------------------------------------------------
  // DATE TIME PICKER CONTROLS
  // ----------------------------------------------------
  const openDateTimePicker = (target: 'start' | 'end') => {
    const current =
      target === 'start'
        ? scheduledStart || new Date()
        : scheduledEnd || scheduledStart || new Date();

    setTempDate(new Date(current.getTime()));
    setDtCalMonth(current.getMonth());
    setDtCalYear(current.getFullYear());

    let h = current.getHours();
    const m = current.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;

    setTempHour(h);
    setHourText(h < 10 ? `0${h}` : String(h));
    setTempMinute(m);
    setMinuteText(m < 10 ? `0${m}` : String(m));
    setTempAmPm(ampm);
    setActiveDateTimeTarget(target);
  };

  const incrementHour = () => {
    const nextH = tempHour >= 12 ? 1 : tempHour + 1;
    setTempHour(nextH);
    setHourText(nextH < 10 ? `0${nextH}` : String(nextH));
  };

  const decrementHour = () => {
    const prevH = tempHour <= 1 ? 12 : tempHour - 1;
    setTempHour(prevH);
    setHourText(prevH < 10 ? `0${prevH}` : String(prevH));
  };

  const handleHourTextChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    setHourText(clean);
    const val = parseInt(clean, 10);
    if (!isNaN(val)) {
      if (val >= 1 && val <= 12) setTempHour(val);
      else if (val > 12) {
        setTempHour(12);
        setHourText('12');
      }
    }
  };

  const handleHourBlur = () => {
    if (!hourText || parseInt(hourText, 10) < 1) {
      setHourText('12');
      setTempHour(12);
    } else {
      setHourText(tempHour < 10 ? `0${tempHour}` : String(tempHour));
    }
  };

  const incrementMinute = () => {
    const nextM = tempMinute >= 59 ? 0 : tempMinute + 1;
    setTempMinute(nextM);
    setMinuteText(nextM < 10 ? `0${nextM}` : String(nextM));
  };

  const decrementMinute = () => {
    const prevM = tempMinute <= 0 ? 59 : tempMinute - 1;
    setTempMinute(prevM);
    setMinuteText(prevM < 10 ? `0${prevM}` : String(prevM));
  };

  const handleMinuteTextChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    setMinuteText(clean);
    const val = parseInt(clean, 10);
    if (!isNaN(val)) {
      if (val >= 0 && val <= 59) setTempMinute(val);
      else if (val > 59) {
        setTempMinute(59);
        setMinuteText('59');
      }
    }
  };

  const handleMinuteBlur = () => {
    if (!minuteText) {
      setMinuteText('00');
      setTempMinute(0);
    } else {
      setMinuteText(tempMinute < 10 ? `0${tempMinute}` : String(tempMinute));
    }
  };

  const handleConfirmDateTime = () => {
    let finalH = tempHour % 12;
    if (tempAmPm === 'PM') finalH += 12;

    const result = new Date(
      tempDate.getFullYear(),
      tempDate.getMonth(),
      tempDate.getDate(),
      finalH,
      tempMinute,
      0,
    );

    if (activeDateTimeTarget === 'start') {
      setScheduledStart(result);
      if (scheduledEnd && scheduledEnd.getTime() < result.getTime()) {
        const autoEnd = new Date(result.getTime() + 4 * 3600000);
        setScheduledEnd(autoEnd);
      }
    } else if (activeDateTimeTarget === 'end') {
      if (scheduledStart && result.getTime() < scheduledStart.getTime()) {
        Alert.alert(
          'Invalid Timing',
          'Scheduled End cannot be earlier than Scheduled Start.',
        );
        return;
      }
      setScheduledEnd(result);
    }

    setActiveDateTimeTarget(null);
  };

  const dtCalendarDays = useMemo(() => {
    const daysInMonth = new Date(dtCalYear, dtCalMonth + 1, 0).getDate();
    const firstDayIndex = new Date(dtCalYear, dtCalMonth, 1).getDay();
    return { daysInMonth, firstDayIndex };
  }, [dtCalYear, dtCalMonth]);

  // Live order calculations
  const orderSummary = useMemo(() => {
    const qtyNum = parseFloat(totalQty) || 0;
    const rateNum = parseFloat(rate) || 0;
    const pumpRateNum = parseFloat(pumpRate) || 0;

    const concreteBase = qtyNum * rateNum;
    const pumpTotal = qtyNum * pumpRateNum;
    const subtotal = concreteBase + pumpTotal;

    const taxPercent =
      selectedTax && selectedTax.extra
        ? parseFloat(selectedTax.extra.tax_rate || selectedTax.extra.rate || 0)
        : 0;

    let taxAmount = 0;
    let grandTotal = 0;

    if (isTaxInclusive) {
      grandTotal = subtotal;
      taxAmount = subtotal - subtotal / (1 + taxPercent / 100);
    } else {
      taxAmount = (subtotal * taxPercent) / 100;
      grandTotal = subtotal + taxAmount;
    }

    return {
      subtotal,
      taxPercent,
      taxAmount,
      grandTotal,
    };
  }, [totalQty, rate, pumpRate, selectedTax, isTaxInclusive]);

  // Form submission
  const handleSubmit = async () => {
    console.log('[EditSalesOrder] Step 5: Submit button pressed. Starting validation for edit...');

    if (!token) {
      Alert.alert('Session Expired', 'Please log in again.');
      return;
    }

    if (!adminOrderId) {
      Alert.alert('Missing Order ID', 'Cannot update order without valid ID.');
      return;
    }

    if (!selectedCustomer) {
      Alert.alert('Required Field', 'Please select a Customer.');
      return;
    }

    if (!selectedSite) {
      Alert.alert('Required Field', 'Please select a Site.');
      return;
    }

    if (!selectedMixDesign) {
      Alert.alert('Required Field', 'Please select a Mix Design.');
      return;
    }

    if (!selectedSalesExecutive) {
      Alert.alert('Required Field', 'Please select a Sales Executive.');
      return;
    }

    const salesExecId = extractSalesExecutiveId(selectedSalesExecutive);
    console.log('[EditSalesOrder] Step 5.1: Sales Executive validation:', {
      selectedSalesExecutive,
      extractedSalesExecId: salesExecId,
    });

    if (!salesExecId) {
      Alert.alert('Required Field', 'Please select a valid Sales Executive.');
      return;
    }

    const qtyVal = parseFloat(totalQty);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      Alert.alert('Required Field', 'Please enter a valid Total Quantity (m³).');
      return;
    }

    const rateVal = parseFloat(rate);
    if (isNaN(rateVal) || rateVal < 0) {
      Alert.alert('Required Field', 'Please enter a valid Rate (₹/m³).');
      return;
    }

    const pumpRateVal = parseFloat(pumpRate) || 0;
    const taxId = extractTaxId(selectedTax);

    console.log('[EditSalesOrder] Step 5.2: Tax validation:', {
      selectedTax,
      extractedTaxId: taxId,
    });

    // Body payload as specified:
    // {
    //   "customer_id": 5,
    //   "site_id": 10,
    //   "mix_design_id": 6,
    //   "customer_po_id": null,
    //   "total_qty": 5,
    //   "rate": 4500,
    //   "tax_id": 204,
    //   "is_tax_inclusive": false,
    //   "concrete_pump": "line_pump",
    //   "pump_rate": 0,
    //   "scheduled_start": null,
    //   "scheduled_end": null,
    //   "sales_executive_id": 1,
    //   "status": 2
    // }
    const payload = {
      customer_id: Number(selectedCustomer.id),
      site_id: Number(selectedSite.id),
      mix_design_id: Number(selectedMixDesign.id),
      customer_po_id: null,
      total_qty: qtyVal,
      rate: rateVal,
      tax_id: taxId,
      is_tax_inclusive: isTaxInclusive,
      concrete_pump: selectedPump?.value ?? null,
      pump_rate: pumpRateVal,
      scheduled_start: formatToApiDateTime(scheduledStart),
      scheduled_end: formatToApiDateTime(scheduledEnd),
      sales_executive_id: salesExecId,
      status: Number(selectedStatus),
    };

    console.log(
      `[EditSalesOrder] Step 5.3: Submitting PUT /orders/${adminOrderId} with status = ${payload.status} (selectedStatus = ${selectedStatus}), payload:\n`,
      JSON.stringify(payload, null, 2),
    );

    setIsSubmitting(true);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const cleanToken = token.trim();
    headers['Authorization'] = cleanToken.startsWith('Bearer ')
      ? cleanToken
      : `Bearer ${cleanToken}`;

    if (effectivePlantId !== null && effectivePlantId !== undefined) {
      headers['X-Plant-Id'] = String(effectivePlantId);
    }

    try {
      let res;
      try {
        console.log(`[EditSalesOrder] Step 5.4: Calling PUT ${baseURL}/orders/${adminOrderId}`);
        res = await axios.put(`${baseURL}/orders/${adminOrderId}`, payload, {
          headers,
          timeout: 25000,
        });
      } catch (putErr: any) {
        // Fallback to POST if server only accepts POST
        if (putErr?.response?.status === 405) {
          console.log(`[EditSalesOrder] PUT returned 405 Method Not Allowed, falling back to POST ${baseURL}/orders/${adminOrderId}`);
          res = await axios.post(`${baseURL}/orders/${adminOrderId}`, payload, {
            headers,
            timeout: 25000,
          });
        } else {
          throw putErr;
        }
      }

      console.log('[EditSalesOrder] Step 6: PUT /orders SUCCESS response:', res.data);

      Alert.alert(
        'Sales Order Updated',
        res.data?.message || 'Sales Order has been updated successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/sales-order' as any),
          },
        ],
      );
    } catch (err: any) {
      console.error(
        '[EditSalesOrder] Step 6: PUT /orders ERROR response:',
        err?.response?.data || err?.message || err,
      );
      const msg =
        err?.response?.data?.message ||
        (err?.response?.data?.errors
          ? Object.values(err.response.data.errors).flat().join('\n')
          : null) ||
        err?.message ||
        'Failed to update sales order. Please try again.';
      Alert.alert('Update Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStatusLabel = useMemo(() => {
    const found = availableStatusOptions.find(
      (s) => Number(s.value) === Number(selectedStatus),
    );
    return found?.label || `Status ${selectedStatus}`;
  }, [availableStatusOptions, selectedStatus]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.headerBgColor }]}
      edges={['top']}
    >
      <AppHeader
        title={
          orderHeaderInfo.fullNumber
            ? `Edit ${orderHeaderInfo.fullNumber}`
            : 'Edit Sales Order'
        }
        onBackPress={handleBack}
        showNotification={false}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isLoadingData ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loaderText}>Loading order details...</Text>
            </View>
          ) : (
            <>
              {/* SECTION 0: ORDER STATUS SELECTION (RADIO BUTTONS) */}
              <View style={[styles.card, styles.statusCard]}>
                <View style={styles.cardHeader}>
                  <MaterialIcons
                    name="radio-button-checked"
                    size={20}
                    color="#2563EB"
                  />
                  <Text style={styles.cardTitle}>Sales Order Status</Text>
                </View>

                <Text style={styles.statusHelperText}>
                  Select updated status for this sales order:
                </Text>

                <View style={styles.radioGrid}>
                  {availableStatusOptions.map((opt) => {
                    const isSelected =
                      Number(selectedStatus) === Number(opt.value);
                    return (
                      <TouchableOpacity
                        key={String(opt.value)}
                        style={[
                          styles.radioStatusCard,
                          isSelected && {
                            borderColor: opt.color,
                            backgroundColor: opt.bgColor,
                          },
                        ]}
                        onPress={() => handleStatusChange(Number(opt.value))}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.radioCircle,
                            isSelected && { borderColor: opt.color },
                          ]}
                        >
                          {isSelected && (
                            <View
                              style={[
                                styles.radioDot,
                                { backgroundColor: opt.color },
                              ]}
                            />
                          )}
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text
                            style={[
                              styles.radioStatusLabel,
                              isSelected && {
                                color: opt.color,
                                fontWeight: '700',
                              },
                            ]}
                          >
                            {opt.label}
                          </Text>
                          {opt.description ? (
                            <Text style={styles.radioStatusDesc}>
                              {opt.description}
                            </Text>
                          ) : null}
                        </View>
                        <View
                          style={[
                            styles.statusBadgePill,
                            {
                              backgroundColor: opt.bgColor,
                              borderColor: opt.color + '44',
                            },
                          ]}
                        >
                          <View
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: opt.color,
                              marginRight: 5,
                            }}
                          />
                          <Text
                            style={[
                              styles.statusBadgePillText,
                              { color: opt.color },
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* SECTION 1: CUSTOMER & SITE */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons
                    name="domain"
                    size={20}
                    color="#2563EB"
                  />
                  <Text style={styles.cardTitle}>Customer & Site</Text>
                </View>

                {/* Customer Dropdown */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Customer <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.pickerSelector}
                    onPress={() => openPicker('customer')}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.pickerSelectorText,
                          !selectedCustomer && styles.placeholderText,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedCustomer?.label || 'Select Customer'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Site Dropdown */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Site Location <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.pickerSelector}
                    onPress={() => openPicker('site')}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.pickerSelectorText,
                          !selectedSite && styles.placeholderText,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedSite?.label || 'Select Site'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Sales Executive */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Sales Executive <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.pickerSelector}
                    onPress={() => openPicker('salesExec')}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.pickerSelectorText,
                          !selectedSalesExecutive && styles.placeholderText,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedSalesExecutive?.label ||
                          'Select Sales Executive'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* SECTION 2: CONCRETE & PRICING SPECIFICATIONS */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons
                    name="flask-outline"
                    size={20}
                    color="#7C3AED"
                  />
                  <Text style={styles.cardTitle}>Mix Design & Quantity</Text>
                </View>

                {/* Mix Design */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Mix Design <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.pickerSelector}
                    onPress={() => openPicker('mix')}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.pickerSelectorText,
                          !selectedMixDesign && styles.placeholderText,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedMixDesign?.label || 'Select Mix Design'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Total Quantity & Rate */}
                <View style={styles.twoColRow}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>
                      Total Qty (m³) <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      placeholder="e.g. 10.0"
                      placeholderTextColor="#94A3B8"
                      value={totalQty}
                      onChangeText={setTotalQty}
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>
                      Rate (₹/m³) <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      placeholder="e.g. 5000"
                      placeholderTextColor="#94A3B8"
                      value={rate}
                      onChangeText={setRate}
                    />
                  </View>
                </View>

                {/* Tax Option (Radio Buttons) & Tax Rate */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tax Calculation Type</Text>
                  <View style={styles.radioPairRow}>
                    <TouchableOpacity
                      style={[
                        styles.radioOptionCard,
                        !isTaxInclusive && styles.radioOptionCardSelected,
                      ]}
                      onPress={() => setIsTaxInclusive(false)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.radioCircle,
                          !isTaxInclusive && styles.radioCircleSelected,
                        ]}
                      >
                        {!isTaxInclusive && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ marginLeft: 8 }}>
                        <Text
                          style={[
                            styles.radioOptionLabel,
                            !isTaxInclusive && styles.radioOptionLabelSelected,
                          ]}
                        >
                          Tax Exclusive
                        </Text>
                        <Text style={styles.radioOptionSub}>
                          Tax added on top of rate
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.radioOptionCard,
                        isTaxInclusive && styles.radioOptionCardSelected,
                      ]}
                      onPress={() => setIsTaxInclusive(true)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.radioCircle,
                          isTaxInclusive && styles.radioCircleSelected,
                        ]}
                      >
                        {isTaxInclusive && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ marginLeft: 8 }}>
                        <Text
                          style={[
                            styles.radioOptionLabel,
                            isTaxInclusive && styles.radioOptionLabelSelected,
                          ]}
                        >
                          Tax Inclusive
                        </Text>
                        <Text style={styles.radioOptionSub}>
                          Rate already includes tax
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Tax Selector */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tax Rate / Scheme</Text>
                  <TouchableOpacity
                    style={styles.pickerSelector}
                    onPress={() => openPicker('tax')}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.pickerSelectorText,
                          !selectedTax && styles.placeholderText,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedTax?.label
                          ? `${selectedTax.label}${selectedTax.subLabel ? ` (${selectedTax.subLabel})` : ''}`
                          : 'No Tax / None (0%)'}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* SECTION 3: PUMP SPECIFICATION */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons
                    name="pump"
                    size={20}
                    color="#0284C7"
                  />
                  <Text style={styles.cardTitle}>Concrete Pump Setup</Text>
                </View>

                <View style={styles.twoColRow}>
                  <View style={[styles.fieldGroup, { flex: 1.3 }]}>
                    <Text style={styles.fieldLabel}>Concrete Pump</Text>
                    <TouchableOpacity
                      style={styles.pickerSelector}
                      onPress={() => openPicker('pump')}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={styles.pickerSelectorText}
                          numberOfLines={1}
                        >
                          {selectedPump?.label || 'None / Direct Pour'}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-down"
                        size={18}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Pump Rate (₹)</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      value={pumpRate}
                      onChangeText={setPumpRate}
                    />
                  </View>
                </View>
              </View>

              {/* SECTION 4: SCHEDULE START & END (DATE TIME PICKER) */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="calendar-outline" size={20} color="#059669" />
                  <Text style={styles.cardTitle}>Schedule Window</Text>
                </View>

                {/* Scheduled Start */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Scheduled Start (Date & Time)</Text>
                  <TouchableOpacity
                    style={styles.dateTimeSelector}
                    onPress={() => openDateTimePicker('start')}
                    activeOpacity={0.75}
                  >
                    <View style={styles.dateTimeSelectorLeft}>
                      <Ionicons
                        name="calendar"
                        size={18}
                        color={scheduledStart ? '#2563EB' : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.dateTimeText,
                          !scheduledStart && styles.placeholderText,
                        ]}
                      >
                        {formatDateTimeDisplay(scheduledStart)}
                      </Text>
                    </View>
                    <View style={styles.dateTimeActionPill}>
                      <Text style={styles.dateTimeActionText}>
                        {scheduledStart ? 'Change' : 'Pick Time'}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color="#2563EB"
                      />
                    </View>
                  </TouchableOpacity>
                  {scheduledStart && (
                    <TouchableOpacity
                      style={styles.clearDateBtn}
                      onPress={() => setScheduledStart(null)}
                    >
                      <Text style={styles.clearDateText}>Clear Start Time</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Scheduled End */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Scheduled End (Date & Time)</Text>
                  <TouchableOpacity
                    style={styles.dateTimeSelector}
                    onPress={() => openDateTimePicker('end')}
                    activeOpacity={0.75}
                  >
                    <View style={styles.dateTimeSelectorLeft}>
                      <Ionicons
                        name="time-outline"
                        size={18}
                        color={scheduledEnd ? '#059669' : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.dateTimeText,
                          !scheduledEnd && styles.placeholderText,
                        ]}
                      >
                        {formatDateTimeDisplay(scheduledEnd)}
                      </Text>
                    </View>
                    <View style={styles.dateTimeActionPill}>
                      <Text style={styles.dateTimeActionText}>
                        {scheduledEnd ? 'Change' : 'Pick Time'}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color="#2563EB"
                      />
                    </View>
                  </TouchableOpacity>
                  {scheduledEnd && (
                    <TouchableOpacity
                      style={styles.clearDateBtn}
                      onPress={() => setScheduledEnd(null)}
                    >
                      <Text style={styles.clearDateText}>Clear End Time</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* LIVE ESTIMATION SUMMARY CARD */}
              <View style={styles.estimateCard}>
                <Text style={styles.estimateTitle}>Estimated Summary</Text>
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateLabel}>
                    Base Value ({totalQty || 0} m³ @ ₹{rate || 0})
                  </Text>
                  <Text style={styles.estimateVal}>
                    ₹
                    {Math.round(
                      (parseFloat(totalQty) || 0) * (parseFloat(rate) || 0),
                    ).toLocaleString('en-IN')}
                  </Text>
                </View>
                {parseFloat(pumpRate) > 0 && (
                  <View style={styles.estimateRow}>
                    <Text style={styles.estimateLabel}>Pump Charge</Text>
                    <Text style={styles.estimateVal}>
                      ₹
                      {Math.round(
                        (parseFloat(totalQty) || 0) *
                          (parseFloat(pumpRate) || 0),
                      ).toLocaleString('en-IN')}
                    </Text>
                  </View>
                )}
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateLabel}>
                    Tax ({orderSummary.taxPercent}%{' '}
                    {isTaxInclusive ? 'Incl' : 'Excl'})
                  </Text>
                  <Text style={styles.estimateVal}>
                    ₹{Math.round(orderSummary.taxAmount).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.estimateDivider} />
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateGrandLabel}>Grand Total</Text>
                  <Text style={styles.estimateGrandVal}>
                    ₹{Math.round(orderSummary.grandTotal).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* BOTTOM ACTION BAR */}
        {!isLoadingData && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
              ) : (
                <MaterialCommunityIcons
                  name="content-save-check-outline"
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
              )}
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Updating Sales Order...' : 'Update Sales Order'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ==========================================
          MODAL 1: SEARCHABLE OPTION PICKER MODAL
         ========================================== */}
      <Modal
        visible={pickerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalContent}>
            {/* Header */}
            <View style={styles.pickerModalHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>
                  Select{' '}
                  {pickerType === 'customer'
                    ? 'Customer'
                    : pickerType === 'site'
                      ? 'Site Location'
                      : pickerType === 'mix'
                        ? 'Mix Design'
                        : pickerType === 'tax'
                          ? 'Tax Rate'
                          : pickerType === 'salesExec'
                            ? 'Sales Executive'
                            : pickerType === 'status'
                              ? 'Order Status'
                              : 'Concrete Pump'}
                </Text>
                <Text style={styles.pickerModalSubtitle}>
                  Choose from available items
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPickerModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Input (hide for status) */}
            {pickerType !== 'status' && (
              <View style={styles.modalSearchRow}>
                <Ionicons name="search" size={17} color="#94A3B8" />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search..."
                  placeholderTextColor="#94A3B8"
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                  clearButtonMode="while-editing"
                />
                {pickerSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setPickerSearch('')}>
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Item List */}
            <FlatList
              data={currentPickerData}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                let isSelected = false;
                if (pickerType === 'customer')
                  isSelected = selectedCustomer?.id === item.id;
                else if (pickerType === 'site')
                  isSelected = selectedSite?.id === item.id;
                else if (pickerType === 'mix')
                  isSelected = selectedMixDesign?.id === item.id;
                else if (pickerType === 'tax')
                  isSelected =
                    (selectedTax === null && item.id === 'no_tax') ||
                    selectedTax?.id === item.id;
                else if (pickerType === 'salesExec')
                  isSelected = selectedSalesExecutive?.id === item.id;
                else if (pickerType === 'pump')
                  isSelected = selectedPump?.id === item.id;
                else if (pickerType === 'status')
                  isSelected = Number(selectedStatus) === Number(item.value);

                return (
                  <TouchableOpacity
                    style={[
                      styles.pickerModalItem,
                      isSelected && styles.pickerModalItemSelected,
                    ]}
                    onPress={() => handleSelectItem(item)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleSelected,
                        { marginRight: 12 },
                      ]}
                    >
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.pickerModalItemTitle,
                          isSelected && styles.pickerModalItemTitleSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      {item.subLabel ? (
                        <Text style={styles.pickerModalItemSub}>
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
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>No items found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* ==========================================
          MODAL 2: DATE & TIME PICKER MODAL
         ========================================== */}
      <Modal
        visible={activeDateTimeTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveDateTimeTarget(null)}
      >
        <View style={styles.dateTimeModalOverlay}>
          <View style={styles.dateTimeModalContent}>
            {/* Header */}
            <View style={styles.pickerModalHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>
                  Select{' '}
                  {activeDateTimeTarget === 'start'
                    ? 'Scheduled Start'
                    : 'Scheduled End'}
                </Text>
                <Text style={styles.pickerModalSubtitle}>
                  Choose date and set hour / minute
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveDateTimeTarget(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Quick Date Presets */}
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    const today = new Date();
                    setTempDate(today);
                    setDtCalMonth(today.getMonth());
                    setDtCalYear(today.getFullYear());
                  }}
                >
                  <Text style={styles.presetChipText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    setTempDate(d);
                    setDtCalMonth(d.getMonth());
                    setDtCalYear(d.getFullYear());
                  }}
                >
                  <Text style={styles.presetChipText}>Tomorrow</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 2);
                    setTempDate(d);
                    setDtCalMonth(d.getMonth());
                    setDtCalYear(d.getFullYear());
                  }}
                >
                  <Text style={styles.presetChipText}>+2 Days</Text>
                </TouchableOpacity>
              </View>

              {/* Month Navigation */}
              <View style={styles.monthNavRow}>
                <TouchableOpacity
                  style={styles.monthNavBtn}
                  onPress={() => {
                    if (dtCalMonth === 0) {
                      setDtCalMonth(11);
                      setDtCalYear((y) => y - 1);
                    } else {
                      setDtCalMonth((m) => m - 1);
                    }
                  }}
                >
                  <Ionicons name="chevron-back" size={18} color="#2563EB" />
                </TouchableOpacity>
                <Text style={styles.monthNavTitle}>
                  {
                    [
                      'January',
                      'February',
                      'March',
                      'April',
                      'May',
                      'June',
                      'July',
                      'August',
                      'September',
                      'October',
                      'November',
                      'December',
                    ][dtCalMonth]
                  }{' '}
                  {dtCalYear}
                </Text>
                <TouchableOpacity
                  style={styles.monthNavBtn}
                  onPress={() => {
                    if (dtCalMonth === 11) {
                      setDtCalMonth(0);
                      setDtCalYear((y) => y + 1);
                    } else {
                      setDtCalMonth((m) => m + 1);
                    }
                  }}
                >
                  <Ionicons name="chevron-forward" size={18} color="#2563EB" />
                </TouchableOpacity>
              </View>

              {/* Day of Week */}
              <View style={styles.dayOfWeekRow}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                  <Text key={i} style={styles.dayOfWeekText}>
                    {d}
                  </Text>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.daysGrid}>
                {Array.from({ length: dtCalendarDays.firstDayIndex }).map(
                  (_, i) => (
                    <View key={`empty-dt-${i}`} style={styles.dayCellEmpty} />
                  ),
                )}
                {Array.from({ length: dtCalendarDays.daysInMonth }).map(
                  (_, i) => {
                    const day = i + 1;
                    const isSelected =
                      tempDate.getFullYear() === dtCalYear &&
                      tempDate.getMonth() === dtCalMonth &&
                      tempDate.getDate() === day;
                    return (
                      <TouchableOpacity
                        key={`d-dt-${day}`}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                        ]}
                        onPress={() => {
                          const newD = new Date(dtCalYear, dtCalMonth, day);
                          setTempDate(newD);
                        }}
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

              {/* Divider */}
              <View style={styles.dateTimeDivider} />

              {/* Time Section with Direct Typing & Arrow Controls */}
              <Text style={styles.timeSectionHeader}>
                Select Time (Tap to Type or Use Arrows)
              </Text>

              <View style={styles.timeDialRow}>
                {/* Hours (+1 / -1 & Direct Typing) */}
                <View style={styles.dialCol}>
                  <TouchableOpacity
                    style={styles.dialBtn}
                    onPress={incrementHour}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-up" size={22} color="#2563EB" />
                  </TouchableOpacity>
                  <View style={styles.dialValueBox}>
                    <TextInput
                      style={styles.dialValueInput}
                      keyboardType="number-pad"
                      value={hourText}
                      onChangeText={handleHourTextChange}
                      onBlur={handleHourBlur}
                      maxLength={2}
                      selectTextOnFocus
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.dialBtn}
                    onPress={decrementHour}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-down" size={22} color="#2563EB" />
                  </TouchableOpacity>
                  <Text style={styles.dialSubLabel}>Hours (1-12)</Text>
                </View>

                <Text style={styles.timeSeparator}>:</Text>

                {/* Minutes (+1 / -1 & Direct Typing) */}
                <View style={styles.dialCol}>
                  <TouchableOpacity
                    style={styles.dialBtn}
                    onPress={incrementMinute}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-up" size={22} color="#2563EB" />
                  </TouchableOpacity>
                  <View style={styles.dialValueBox}>
                    <TextInput
                      style={styles.dialValueInput}
                      keyboardType="number-pad"
                      value={minuteText}
                      onChangeText={handleMinuteTextChange}
                      onBlur={handleMinuteBlur}
                      maxLength={2}
                      selectTextOnFocus
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.dialBtn}
                    onPress={decrementMinute}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-down" size={22} color="#2563EB" />
                  </TouchableOpacity>
                  <Text style={styles.dialSubLabel}>Minutes (00-59)</Text>
                </View>

                {/* AM/PM Switch */}
                <View style={styles.ampmCol}>
                  <TouchableOpacity
                    style={[
                      styles.ampmBtn,
                      tempAmPm === 'AM' && styles.ampmBtnActive,
                    ]}
                    onPress={() => setTempAmPm('AM')}
                  >
                    <Text
                      style={[
                        styles.ampmBtnText,
                        tempAmPm === 'AM' && styles.ampmBtnTextActive,
                      ]}
                    >
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.ampmBtn,
                      tempAmPm === 'PM' && styles.ampmBtnActive,
                    ]}
                    onPress={() => setTempAmPm('PM')}
                  >
                    <Text
                      style={[
                        styles.ampmBtnText,
                        tempAmPm === 'PM' && styles.ampmBtnTextActive,
                      ]}
                    >
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                style={styles.timeSaveBtn}
                onPress={handleConfirmDateTime}
                activeOpacity={0.8}
              >
                <Text style={styles.timeSaveBtnText}>Confirm Date & Time</Text>
              </TouchableOpacity>
            </ScrollView>
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
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
    gap: 14,
  },
  loaderContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 10,
  },
  loaderText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  statusCard: {
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
  },
  statusHelperText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  radioGrid: {
    gap: 8,
  },
  radioStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioCircleSelected: {
    borderColor: '#2563EB',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  radioStatusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  radioStatusDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Radio Pair for Tax
  radioPairRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  radioOptionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  radioOptionCardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  radioOptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  radioOptionLabelSelected: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  radioOptionSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  fieldGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  requiredStar: {
    color: '#DC2626',
    fontWeight: '700',
  },
  pickerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
    gap: 8,
  },
  pickerSelectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  placeholderText: {
    color: '#94A3B8',
    fontWeight: '400',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  dateTimeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
    gap: 8,
  },
  dateTimeSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dateTimeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  dateTimeActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 2,
  },
  dateTimeActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  clearDateBtn: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  clearDateText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  estimateCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 14,
    gap: 8,
  },
  estimateTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1D4ED8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  estimateLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  estimateVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  estimateDivider: {
    height: 1,
    backgroundColor: '#BFDBFE',
    marginVertical: 2,
  },
  estimateGrandLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  estimateGrandVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563EB',
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  submitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal Common
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  pickerModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  pickerModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerModalItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  pickerModalItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  pickerModalItemTitleSelected: {
    color: '#2563EB',
    fontWeight: '700',
  },
  pickerModalItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalEmpty: {
    padding: 30,
    alignItems: 'center',
  },
  modalEmptyText: {
    color: '#94A3B8',
    fontSize: 13,
  },

  // DateTime Modal
  dateTimeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  dateTimeModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  presetChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  monthNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  monthNavTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  dayOfWeekRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  dayOfWeekText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    height: 36,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: '#2563EB',
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dateTimeDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  timeSectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  timeDialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  dialCol: {
    alignItems: 'center',
    width: 72,
  },
  dialBtn: {
    padding: 4,
  },
  dialValueBox: {
    width: 60,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialValueInput: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    width: '100%',
    padding: 0,
  },
  dialSubLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 16,
  },
  ampmCol: {
    gap: 6,
    marginLeft: 6,
    marginBottom: 16,
  },
  ampmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  ampmBtnActive: {
    backgroundColor: '#2563EB',
  },
  ampmBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  ampmBtnTextActive: {
    color: '#FFFFFF',
  },
  timeSaveBtn: {
    backgroundColor: '#2563EB',
    marginHorizontal: 16,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  timeSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
