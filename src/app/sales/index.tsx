import { baseURL } from '@/components/baseUrl/baseUrlAPI';
import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { Colors, Spacing } from '@/constants/theme';
import { setCustomRange, setPresetFilter } from '@/store/dateFilterSlice';
import { RootState } from '@/store/store';
import { Feather, FontAwesome, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import CalendarPicker from 'react-native-calendar-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

export default function SalesDetailsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const dispatch = useDispatch();
  const params = useLocalSearchParams<{ type?: string }>();

  const { token, plant_id: plantId, plant_name: plantName } = useSelector((state: RootState) => state.auth);
  const { startDate, endDate, activeFilter } = useSelector((state: RootState) => state.dateFilter);

  // Tab filter: 'all' | 'cash' | 'credit'
  const [activeTab, setActiveTab] = useState<'all' | 'cash' | 'credit'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [salesDetails, setSalesDetails] = useState<any>(null);

  // Calendar Modal state
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<string | null>(null);
  const [tempEndDate, setTempEndDate] = useState<string | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const calendarWidth = Math.min(screenWidth - 48, 380);

  const handleBack = useCallback(() => {
    router.replace('/' as any);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
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

  // Initialize active tab from params if provided
  useEffect(() => {
    if (params.type === 'cash') {
      setActiveTab('cash');
    } else if (params.type === 'credit') {
      setActiveTab('credit');
    } else {
      setActiveTab('all');
    }
  }, [params.type]);

  useEffect(() => {
    if (token) {
      fetchSalesDetails();
    }
  }, [token, startDate, endDate, plantId]);

  const fetchSalesDetails = async (isSilent = false) => {
    if (!token) return;

    try {
      if (!isSilent) setIsLoading(true);
      const backendToken = token.includes('|') ? token.split('|')[1] : token;
      const targetPlantId = plantId || 1;

      const res = await axios.get(
        `${baseURL}/sales-details?plant_id=${targetPlantId}&from_date=${startDate}&to_date=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${backendToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );
      setSalesDetails(res.data.data);
    } catch (err) {
      console.log('Error fetching sales details:', err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSalesDetails(true);
    setRefreshing(false);
  };

  const formatCurrency = (value: any) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '₹0.00';
    return (
      '₹' +
      num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  const formatNumber = (value: any) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM dd, yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  const formatSelectedDate = (date: any) => {
    if (!date) return null;
    const jsDate = typeof date.toDate === 'function' ? date.toDate() : new Date(date);
    return format(jsDate, 'yyyy-MM-dd');
  };

  const handleOpenCalendar = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setIsCalendarVisible(true);
  };

  const onDateChange = (date: any, type: 'START_DATE' | 'END_DATE') => {
    const formatted = date ? formatSelectedDate(date) : null;
    if (type === 'END_DATE') {
      setTempEndDate(formatted);
    } else {
      setTempStartDate(formatted);
      setTempEndDate(null);
    }
  };

  const handleApplyRange = () => {
    if (tempStartDate) {
      const finalEnd = tempEndDate || tempStartDate;
      dispatch(setCustomRange({ startDate: tempStartDate, endDate: finalEnd }));
      setIsCalendarVisible(false);
    }
  };

  const filters = ['Today', 'Yesterday', 'Last week', 'This week', 'This month', 'Last month'];

  // Calculations
  const cash = salesDetails?.cash_sales;
  const credit = salesDetails?.credit_sales;

  const cashAmount = parseFloat(cash?.sales_amount?.amount || 0);
  const creditAmount = parseFloat(credit?.sales_amount?.amount || 0);
  const totalAmount = cashAmount + creditAmount;

  const cashTrips = parseInt(cash?.trips?.dispatch_count || 0, 10);
  const creditTrips = parseInt(credit?.trips?.dispatch_count || 0, 10);
  const totalTrips = cashTrips + creditTrips;

  const cashCbm = parseFloat(cash?.quantity?.cbm?.qty || 0);
  const creditCbm = parseFloat(credit?.quantity?.cbm?.qty || 0);
  const totalCbm = cashCbm + creditCbm;

  const cashCft = parseFloat(cash?.quantity?.cft?.qty || 0);
  const creditCft = parseFloat(credit?.quantity?.cft?.qty || 0);
  const totalCft = cashCft + creditCft;

  const cashMtr = parseFloat(cash?.quantity?.mtr?.qty || 0);
  const creditMtr = parseFloat(credit?.quantity?.mtr?.qty || 0);
  const totalMtr = cashMtr + creditMtr;

  const cashPct = totalAmount > 0 ? (cashAmount / totalAmount) * 100 : 0;
  const creditPct = totalAmount > 0 ? (creditAmount / totalAmount) * 100 : 0;

  const avgTicketCash = cashTrips > 0 ? cashAmount / cashTrips : 0;
  const avgTicketCredit = creditTrips > 0 ? creditAmount / creditTrips : 0;
  const avgTicketTotal = totalTrips > 0 ? totalAmount / totalTrips : 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.headerBgColor }]} edges={['top']}>
      <AppHeader
        title="Sales Details"
        onBackPress={handleBack}
        showNotification={false}
        rightElement={
          <Pressable
            onPress={handleOpenCalendar}
            style={({ pressed }) => [
              styles.headerCalendarButton,
              pressed && { backgroundColor: 'rgba(255, 255, 255, 0.15)' },
            ]}>
            <MaterialIcons name="date-range" size={22} color="#ffffff" />
          </Pressable>
        }
      />

      <ScrollView
        style={[styles.contentContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Date Filter selector bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
          style={styles.filterScrollView}
        >
          {filters.map((item, index) => {
            const isActive = activeFilter === item;
            return (
              <TouchableOpacity
                key={index}
                onPress={() => dispatch(setPresetFilter(item))}
                style={[
                  styles.filterButtonCard,
                  {
                    backgroundColor: isActive ? colors.primary : (scheme === 'dark' ? '#111827' : '#ffffff'),
                    borderColor: isActive ? colors.primary : colors.outlineVariant + '2E',
                    shadowColor: isActive ? colors.primary : 'transparent',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: isActive ? 0.25 : 0,
                    shadowRadius: 5,
                    elevation: isActive ? 4 : 0,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: isActive ? colors.onPrimary : colors.textSecondary,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Date Range Badge */}
        <View
          style={[
            styles.dateRangeBadge,
            {
              backgroundColor: scheme === 'dark' ? 'rgba(30, 41, 59, 0.35)' : 'rgba(255, 255, 255, 0.85)',
              borderColor: colors.outlineVariant + '28',
            },
          ]}
        >
          <MaterialIcons name="event" size={15} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.dateRangeText, { color: colors.textSecondary }]}>
            {formatDisplayDate(startDate)} — {formatDisplayDate(endDate)}
          </Text>
        </View>

        {/* Tab Selector: All | Cash | Credit */}
        <View style={[styles.segmentedControl, { backgroundColor: scheme === 'dark' ? '#111827' : '#E2E8F0' }]}>
          <TouchableOpacity
            style={[
              styles.segmentItem,
              activeTab === 'all' && [styles.activeSegmentItem, { backgroundColor: colors.surface }],
            ]}
            onPress={() => setActiveTab('all')}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="analytics"
              size={16}
              color={activeTab === 'all' ? colors.primary : colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'all' ? colors.primary : colors.textSecondary },
                activeTab === 'all' && styles.activeSegmentText,
              ]}
            >
              All Sales
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentItem,
              activeTab === 'cash' && [styles.activeSegmentItem, { backgroundColor: colors.surface }],
            ]}
            onPress={() => setActiveTab('cash')}
            activeOpacity={0.8}
          >
            <View style={[styles.tabDot, { backgroundColor: '#F59E0B' }]} />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'cash' ? '#F59E0B' : colors.textSecondary },
                activeTab === 'cash' && styles.activeSegmentText,
              ]}
            >
              Cash Sales
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentItem,
              activeTab === 'credit' && [styles.activeSegmentItem, { backgroundColor: colors.surface }],
            ]}
            onPress={() => setActiveTab('credit')}
            activeOpacity={0.8}
          >
            <View style={[styles.tabDot, { backgroundColor: '#0284C7' }]} />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'credit' ? '#0284C7' : colors.textSecondary },
                activeTab === 'credit' && styles.activeSegmentText,
              ]}
            >
              Credit Sales
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading && !salesDetails ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading sales details...</Text>
          </View>
        ) : !salesDetails ? (
          <View style={styles.emptyContainer}>
            <Feather name="info" size={32} color={colors.outline} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Sales Found</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              There are no recorded sales for {plantName || 'this plant'} during the selected date interval.
            </Text>
          </View>
        ) : (
          <View style={styles.mainContent}>
            {/* Hero Card: Total Revenue & Distribution */}
            {(activeTab === 'all' || activeTab === 'cash' || activeTab === 'credit') && (
              <Card style={styles.heroCard} variant="lowest">
                <View style={styles.heroHeader}>
                  <View>
                    <Text style={styles.heroPreLabel}>
                      {activeTab === 'all'
                        ? 'TOTAL REVENUE (CASH + CREDIT)'
                        : activeTab === 'cash'
                        ? 'TOTAL CASH REVENUE'
                        : 'TOTAL CREDIT REVENUE'}
                    </Text>
                    <Text style={[styles.heroAmount, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                      {activeTab === 'all'
                        ? formatCurrency(totalAmount)
                        : activeTab === 'cash'
                        ? formatCurrency(cashAmount)
                        : formatCurrency(creditAmount)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.heroBadge,
                      {
                        backgroundColor:
                          activeTab === 'cash'
                            ? '#F59E0B18'
                            : activeTab === 'credit'
                            ? '#0284C718'
                            : colors.primary + '18',
                      },
                    ]}
                  >
                    <Feather
                      name="trending-up"
                      size={14}
                      color={
                        activeTab === 'cash' ? '#F59E0B' : activeTab === 'credit' ? '#0284C7' : colors.primary
                      }
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.heroBadgeText,
                        {
                          color:
                            activeTab === 'cash' ? '#F59E0B' : activeTab === 'credit' ? '#0284C7' : colors.primary,
                        },
                      ]}
                    >
                      {activeTab === 'all'
                        ? `${totalTrips} Trips Total`
                        : activeTab === 'cash'
                        ? `${cashPct.toFixed(0)}% Share`
                        : `${creditPct.toFixed(0)}% Share`}
                    </Text>
                  </View>
                </View>

                {/* Progress bar split if in 'all' mode */}
                {activeTab === 'all' && totalAmount > 0 && (
                  <View style={styles.splitBarContainer}>
                    <View style={styles.splitBarLabels}>
                      <View style={styles.splitLabelItem}>
                        <View style={[styles.legendSquare, { backgroundColor: '#F59E0B' }]} />
                        <Text style={[styles.splitLabelText, { color: colors.textSecondary }]}>
                          Cash: {cashPct.toFixed(1)}%
                        </Text>
                      </View>
                      <View style={styles.splitLabelItem}>
                        <View style={[styles.legendSquare, { backgroundColor: '#0284C7' }]} />
                        <Text style={[styles.splitLabelText, { color: colors.textSecondary }]}>
                          Credit: {creditPct.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.progressBarBase, { backgroundColor: colors.surfaceContainerHigh }]}>
                      <View style={[styles.progressCashFill, { width: `${cashPct}%`, backgroundColor: '#F59E0B' }]} />
                      <View
                        style={[styles.progressCreditFill, { width: `${creditPct}%`, backgroundColor: '#0284C7' }]}
                      />
                    </View>
                  </View>
                )}

                {/* Micro Stats Quick Row */}
                <View style={[styles.heroStatsRow, { borderTopColor: colors.outlineVariant + '22' }]}>
                  <View style={styles.heroStatItem}>
                    <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>TOTAL DISPATCHES</Text>
                    <Text style={[styles.heroStatValue, { color: colors.text }]}>
                      {activeTab === 'all' ? totalTrips : activeTab === 'cash' ? cashTrips : creditTrips}
                    </Text>
                  </View>

                  <View style={[styles.heroStatDivider, { backgroundColor: colors.outlineVariant + '33' }]} />

                  <View style={styles.heroStatItem}>
                    <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>TOTAL CBM</Text>
                    <Text style={[styles.heroStatValue, { color: colors.text }]}>
                      {formatNumber(activeTab === 'all' ? totalCbm : activeTab === 'cash' ? cashCbm : creditCbm)}
                    </Text>
                  </View>

                  <View style={[styles.heroStatDivider, { backgroundColor: colors.outlineVariant + '33' }]} />

                  <View style={styles.heroStatItem}>
                    <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>AVG / TRIP</Text>
                    <Text style={[styles.heroStatValue, { color: colors.text }]}>
                      {formatCurrency(
                        activeTab === 'all'
                          ? avgTicketTotal
                          : activeTab === 'cash'
                          ? avgTicketCash
                          : avgTicketCredit
                      )}
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {/* CASH SALES CARD */}
            {(activeTab === 'all' || activeTab === 'cash') && (
              <Card style={styles.detailCard} variant="lowest">
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleLeft}>
                    <View style={[styles.iconBox, { backgroundColor: '#F59E0B18' }]}>
                      <FontAwesome name="rupee" size={16} color="#F59E0B" />
                    </View>
                    <View>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Cash Sales</Text>
                      <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                        Direct & Counter settlement payments
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.shareBadge, { backgroundColor: '#F59E0B15' }]}>
                    <Text style={[styles.shareBadgeText, { color: '#F59E0B' }]}>
                      {cashPct.toFixed(0)}% Share
                    </Text>
                  </View>
                </View>

                {/* Amount Big Text */}
                <View style={[styles.amountBanner, { backgroundColor: scheme === 'dark' ? '#451A0333' : '#FFFBEB' }]}>
                  <Text style={[styles.amountBannerLabel, { color: '#D97706' }]}>CASH SALES REVENUE</Text>
                  <Text style={[styles.amountBannerValue, { color: colors.text }]}>
                    {formatCurrency(cashAmount)}
                  </Text>
                </View>

                {/* Metrics 4-Box Grid */}
                <View style={styles.metricsGrid}>
                  <View
                    style={[
                      styles.metricBox,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '22' },
                    ]}
                  >
                    <View style={styles.metricIconRow}>
                      <FontAwesome5 name="truck" size={13} color="#F59E0B" />
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Dispatches</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: colors.text }]}>
                      {cashTrips} <Text style={styles.unitText}>trips</Text>
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricBox,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '22' },
                    ]}
                  >
                    <View style={styles.metricIconRow}>
                      <Feather name="box" size={13} color="#F59E0B" />
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>CBM Volume</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: colors.text }]}>
                      {formatNumber(cashCbm)} <Text style={styles.unitText}>cbm</Text>
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricBox,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '22' },
                    ]}
                  >
                    <View style={styles.metricIconRow}>
                      <Feather name="maximize-2" size={13} color="#F59E0B" />
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>CFT Volume</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: colors.text }]}>
                      {formatNumber(cashCft)} <Text style={styles.unitText}>cft</Text>
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricBox,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '22' },
                    ]}
                  >
                    <View style={styles.metricIconRow}>
                      <Feather name="layers" size={13} color="#F59E0B" />
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>MTR Volume</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: colors.text }]}>
                      {formatNumber(cashMtr)} <Text style={styles.unitText}>mtr</Text>
                    </Text>
                  </View>
                </View>

                {/* Footer Insight */}
                <View style={[styles.cardFooterInfo, { borderTopColor: colors.outlineVariant + '1A' }]}>
                  <Feather name="info" size={13} color={colors.textSecondary} />
                  <Text style={[styles.cardFooterText, { color: colors.textSecondary }]}>
                    Average revenue generated per cash dispatch: <Text style={{ fontWeight: '700', color: colors.text }}>{formatCurrency(avgTicketCash)}</Text>
                  </Text>
                </View>
              </Card>
            )}

            {/* CREDIT SALES CARD */}
            {(activeTab === 'all' || activeTab === 'credit') && (
              <Card style={styles.detailCard} variant="lowest">
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleLeft}>
                    <View style={[styles.iconBox, { backgroundColor: '#0284C718' }]}>
                      <Feather name="credit-card" size={16} color="#0284C7" />
                    </View>
                    <View>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Credit Sales</Text>
                      <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                        B2B contract & enterprise client accounts
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.shareBadge, { backgroundColor: '#0284C715' }]}>
                    <Text style={[styles.shareBadgeText, { color: '#0284C7' }]}>
                      {creditPct.toFixed(0)}% Share
                    </Text>
                  </View>
                </View>

                {/* Amount Big Text */}
                <View style={[styles.amountBanner, { backgroundColor: scheme === 'dark' ? '#082F4933' : '#F0F9FF' }]}>
                  <Text style={[styles.amountBannerLabel, { color: '#0284C7' }]}>CREDIT SALES REVENUE</Text>
                  <Text style={[styles.amountBannerValue, { color: colors.text }]}>
                    {formatCurrency(creditAmount)}
                  </Text>
                </View>

                {/* Metrics 4-Box Grid */}
                <View style={styles.metricsGrid}>
                  <View
                    style={[
                      styles.metricBox,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '22' },
                    ]}
                  >
                    <View style={styles.metricIconRow}>
                      <FontAwesome5 name="truck" size={13} color="#0284C7" />
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Dispatches</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: colors.text }]}>
                      {creditTrips} <Text style={styles.unitText}>trips</Text>
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricBox,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '22' },
                    ]}
                  >
                    <View style={styles.metricIconRow}>
                      <Feather name="box" size={13} color="#0284C7" />
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>CBM Volume</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: colors.text }]}>
                      {formatNumber(creditCbm)} <Text style={styles.unitText}>cbm</Text>
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricBox,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '22' },
                    ]}
                  >
                    <View style={styles.metricIconRow}>
                      <Feather name="maximize-2" size={13} color="#0284C7" />
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>CFT Volume</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: colors.text }]}>
                      {formatNumber(creditCft)} <Text style={styles.unitText}>cft</Text>
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricBox,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '22' },
                    ]}
                  >
                    <View style={styles.metricIconRow}>
                      <Feather name="layers" size={13} color="#0284C7" />
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>MTR Volume</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: colors.text }]}>
                      {formatNumber(creditMtr)} <Text style={styles.unitText}>mtr</Text>
                    </Text>
                  </View>
                </View>

                {/* Footer Insight */}
                <View style={[styles.cardFooterInfo, { borderTopColor: colors.outlineVariant + '1A' }]}>
                  <Feather name="info" size={13} color={colors.textSecondary} />
                  <Text style={[styles.cardFooterText, { color: colors.textSecondary }]}>
                    Average revenue generated per credit dispatch: <Text style={{ fontWeight: '700', color: colors.text }}>{formatCurrency(avgTicketCredit)}</Text>
                  </Text>
                </View>
              </Card>
            )}

            {/* Comparative Summary Bento Card */}
            {activeTab === 'all' && (
              <Card style={styles.comparisonCard} variant="lowest">
                <Text style={[styles.comparisonTitle, { color: colors.text }]}>
                  Volume & Dispatch Comparison
                </Text>
                <Text style={[styles.comparisonSubtitle, { color: colors.textSecondary }]}>
                  Concrete production allocation between Cash & Credit
                </Text>

                {/* CBM Comparison Bar */}
                <View style={styles.compBarSection}>
                  <View style={styles.compHeaderRow}>
                    <Text style={[styles.compLabel, { color: colors.text }]}>Concrete Volume (CBM)</Text>
                    <Text style={[styles.compTotal, { color: colors.textSecondary }]}>
                      Total: {formatNumber(totalCbm)} cbm
                    </Text>
                  </View>
                  <View style={[styles.progressBarBase, { backgroundColor: colors.surfaceContainerHigh }]}>
                    <View
                      style={[
                        styles.progressCashFill,
                        {
                          width: `${totalCbm > 0 ? (cashCbm / totalCbm) * 100 : 0}%`,
                          backgroundColor: '#F59E0B',
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.progressCreditFill,
                        {
                          width: `${totalCbm > 0 ? (creditCbm / totalCbm) * 100 : 0}%`,
                          backgroundColor: '#0284C7',
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.compLegendRow}>
                    <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '600' }}>
                      Cash: {formatNumber(cashCbm)} cbm ({totalCbm > 0 ? ((cashCbm / totalCbm) * 100).toFixed(0) : 0}%)
                    </Text>
                    <Text style={{ fontSize: 11, color: '#0284C7', fontWeight: '600' }}>
                      Credit: {formatNumber(creditCbm)} cbm ({totalCbm > 0 ? ((creditCbm / totalCbm) * 100).toFixed(0) : 0}%)
                    </Text>
                  </View>
                </View>

                {/* Dispatches Comparison Bar */}
                <View style={styles.compBarSection}>
                  <View style={styles.compHeaderRow}>
                    <Text style={[styles.compLabel, { color: colors.text }]}>Dispatch Trips Count</Text>
                    <Text style={[styles.compTotal, { color: colors.textSecondary }]}>
                      Total: {totalTrips} trips
                    </Text>
                  </View>
                  <View style={[styles.progressBarBase, { backgroundColor: colors.surfaceContainerHigh }]}>
                    <View
                      style={[
                        styles.progressCashFill,
                        {
                          width: `${totalTrips > 0 ? (cashTrips / totalTrips) * 100 : 0}%`,
                          backgroundColor: '#F59E0B',
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.progressCreditFill,
                        {
                          width: `${totalTrips > 0 ? (creditTrips / totalTrips) * 100 : 0}%`,
                          backgroundColor: '#0284C7',
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.compLegendRow}>
                    <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '600' }}>
                      Cash: {cashTrips} trips ({totalTrips > 0 ? ((cashTrips / totalTrips) * 100).toFixed(0) : 0}%)
                    </Text>
                    <Text style={{ fontSize: 11, color: '#0284C7', fontWeight: '600' }}>
                      Credit: {creditTrips} trips ({totalTrips > 0 ? ((creditTrips / totalTrips) * 100).toFixed(0) : 0}%)
                    </Text>
                  </View>
                </View>
              </Card>
            )}
          </View>
        )}
      </ScrollView>

      {/* Date Range Picker Modal */}
      <Modal
        visible={isCalendarVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCalendarVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsCalendarVisible(false)}
          />
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.outlineVariant + '22' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Date Range</Text>
              <TouchableOpacity
                onPress={() => setIsCalendarVisible(false)}
                style={[styles.closeButton, { backgroundColor: colors.surfaceContainerHigh }]}
              >
                <MaterialIcons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarContainer}>
              <CalendarPicker
                startFromMonday={true}
                allowRangeSelection={true}
                selectedStartDate={tempStartDate ? new Date(tempStartDate) : undefined}
                selectedEndDate={tempEndDate ? new Date(tempEndDate) : undefined}
                onDateChange={onDateChange}
                todayBackgroundColor={colors.outlineVariant + '33'}
                selectedDayColor={colors.primary}
                selectedDayTextColor={colors.onPrimary}
                selectedRangeStyle={{ backgroundColor: colors.primary + '18' }}
                selectedRangeStartStyle={{ backgroundColor: colors.primary }}
                selectedRangeEndStyle={{ backgroundColor: colors.primary }}
                textStyle={{ color: colors.text, fontSize: 13, fontFamily: 'System' }}
                disabledDatesTextStyle={{ color: colors.outline }}
                nextTitleStyle={{ color: colors.primary, fontWeight: '700' }}
                previousTitleStyle={{ color: colors.primary, fontWeight: '700' }}
                width={calendarWidth}
              />
            </View>

            <View style={[styles.modalFooter, { borderTopColor: colors.outlineVariant + '22' }]}>
              <View style={styles.selectedDatesPreview}>
                <View style={styles.previewCol}>
                  <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Start Date</Text>
                  <Text style={[styles.previewVal, { color: colors.text }]}>
                    {tempStartDate ? formatDisplayDate(tempStartDate) : 'Not selected'}
                  </Text>
                </View>
                <View style={[styles.previewDivider, { backgroundColor: colors.outlineVariant + '44' }]} />
                <View style={styles.previewCol}>
                  <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>End Date</Text>
                  <Text style={[styles.previewVal, { color: colors.text }]}>
                    {tempEndDate
                      ? formatDisplayDate(tempEndDate)
                      : tempStartDate
                      ? formatDisplayDate(tempStartDate)
                      : 'Not selected'}
                  </Text>
                </View>
              </View>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  onPress={() => setIsCalendarVisible(false)}
                  style={[styles.modalButtonSecondary, { borderColor: colors.outline }]}
                >
                  <Text style={[styles.modalButtonSecondaryText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleApplyRange}
                  disabled={!tempStartDate}
                  style={[
                    styles.modalButtonPrimary,
                    { backgroundColor: tempStartDate ? colors.primary : colors.surfaceContainerHigh },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalButtonPrimaryText,
                      { color: tempStartDate ? colors.onPrimary : colors.textSecondary },
                    ]}
                  >
                    Apply Range
                  </Text>
                </TouchableOpacity>
              </View>
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
  },
  contentContainer: {
    flex: 1,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: 20,
    paddingBottom: 100,
    gap: Spacing.stackGap,
  },
  headerCalendarButton: {
    padding: Spacing.one * 1.5,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.one,
  },
  filterScrollView: {
    marginHorizontal: -Spacing.containerMargin,
    paddingHorizontal: Spacing.containerMargin,
  },
  filterScrollContent: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingRight: Spacing.containerMargin * 2,
    alignItems: 'center',
    paddingVertical: 4,
  },
  filterButtonCard: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    fontSize: 12,
    fontFamily: 'System',
  },
  dateRangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'center',
  },
  dateRangeText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'System',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginTop: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeSegmentItem: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'System',
  },
  activeSegmentText: {
    fontWeight: '700',
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  loaderContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 13,
    fontFamily: 'System',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'System',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'System',
  },
  mainContent: {
    gap: Spacing.stackGap,
  },
  heroCard: {
    padding: Spacing.cardPadding,
    borderRadius: 20,
    gap: Spacing.three,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroPreLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    fontFamily: 'System',
  },
  heroAmount: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
    fontFamily: 'System',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'System',
  },
  splitBarContainer: {
    gap: 6,
  },
  splitBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitLabelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSquare: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  splitLabelText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'System',
  },
  progressBarBase: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
  },
  progressCashFill: {
    height: '100%',
  },
  progressCreditFill: {
    height: '100%',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    height: 28,
  },
  heroStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontFamily: 'System',
  },
  heroStatValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
    fontFamily: 'System',
  },
  detailCard: {
    borderRadius: 20,
    padding: Spacing.cardPadding,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'System',
  },
  cardSubtitle: {
    fontSize: 11,
    fontFamily: 'System',
    marginTop: 1,
  },
  shareBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  shareBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'System',
  },
  amountBanner: {
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  amountBannerLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: 'System',
  },
  amountBannerValue: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
    fontFamily: 'System',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  metricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'System',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'System',
  },
  unitText: {
    fontSize: 11,
    fontWeight: '400',
    color: '#94a3b8',
  },
  cardFooterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  cardFooterText: {
    fontSize: 11,
    fontFamily: 'System',
    flex: 1,
  },
  comparisonCard: {
    borderRadius: 20,
    padding: Spacing.cardPadding,
    gap: 12,
  },
  comparisonTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'System',
  },
  comparisonSubtitle: {
    fontSize: 11,
    fontFamily: 'System',
  },
  compBarSection: {
    marginTop: 6,
    gap: 6,
  },
  compHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'System',
  },
  compTotal: {
    fontSize: 11,
    fontFamily: 'System',
  },
  compLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  selectedDatesPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  previewCol: {
    flex: 1,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  previewVal: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  previewDivider: {
    width: 1,
    height: 24,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
