import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
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

import { baseURL } from '@/components/baseUrl/baseUrlAPI';
import DispatchSummary from '@/components/srceens/dispatchSummary';
import SalesDetails from '@/components/srceens/salesDetails';
import SalesTripTruck from '@/components/srceens/salesTripTruck';
import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart-container';
import { Colors, Spacing } from '@/constants/theme';
import { setCustomRange, setPresetFilter } from '@/store/dateFilterSlice';
import { RootState } from '@/store/store';
import { useDispatch, useSelector } from 'react-redux';

export default function DashboardScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { token, plant_name, user, plant_id } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const { startDate, endDate, activeFilter } = useSelector((state: RootState) => state.dateFilter);

  const activeTheme = useMemo(() => {
    const isDark = scheme === 'dark';
    return {
      bg: colors.primary + '12', // Subtle primary tint background (~7% opacity)
      text: colors.primary,
      border: colors.primary + '28', // Subtle primary tint border (~16% opacity)
      activeBg: colors.primary,
      activeText: isDark ? colors.background : colors.onPrimary,
    };
  }, [scheme, colors]);

  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<string | null>(null);
  const [tempEndDate, setTempEndDate] = useState<string | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const calendarWidth = Math.min(screenWidth - 48, 380);

  const [mixDesigns, setMixDesigns] = useState<any[]>([]);
  const [isMixLoading, setIsMixLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchTopMixDesigns();
    }
  }, [token, plant_id, startDate, endDate]);

  const fetchTopMixDesigns = async () => {
    if (!token) return;
    try {
      setIsMixLoading(true);
      const trimToken = token.includes('|') ? token.split('|')[1] : token;
      const plantId = plant_id || 1;
      console.log('plantId:', plantId)
      const res = await axios.get(`${baseURL}/top-mix-designs?plant_id=${plant_id}&from_date=${startDate}&to_date=${endDate}`, {
        headers: {
          Authorization: `Bearer ${trimToken}`,
          "Content-Type": "application/json",
        },
      });
      if (res.data.success) {
        setMixDesigns(res.data.data || []);
      }
    } catch (err) {
      console.log("Error fetching mix designs:", err);
    } finally {
      setIsMixLoading(false);
    }
  };

  const maxRatio = useMemo(() => {
    if (mixDesigns.length === 0) return 1;
    return Math.max(...mixDesigns.map(d => {
      const qty = d.total_batch_size?.qty || 0;
      const count = d.total_batch_count?.qty || 1;
      return qty / count;
    }));
  }, [mixDesigns]);

  const formatSelectedDate = (date: any) => {
    if (!date) return null;
    const jsDate = typeof date.toDate === 'function' ? date.toDate() : new Date(date);
    return format(jsDate, 'yyyy-MM-dd');
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM dd, yyyy');
    } catch (e) {
      return dateStr;
    }
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


  const filters = [
    "Today",
    "Yesterday",
    "Last week",
    "This week",
    "This month",
    "Last month"
  ];



  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <AppHeader
        title={user?.name || "Logistics Manager"}
        showMenu={true}
        showNotification={false}
        rightElement={
          <Pressable
            onPress={handleOpenCalendar}
            style={({ pressed }) => [
              styles.headerCalendarButton,
              pressed && { backgroundColor: colors.surfaceContainerHigh },
            ]}>
            <MaterialIcons name="date-range" size={24} color={colors.primary} />
          </Pressable>
        }
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Redesigned Welcome Banner (without Greeting) */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeInfo}>
            {plant_name && (
              <View style={[styles.plantBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '33' }]}>
                <MaterialIcons name="business" size={14} color={colors.primary} />
                <Text style={[styles.plantText, { color: colors.primary }]}>{plant_name}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Date Filter selector using single color-code */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
          style={styles.filterScrollView}
        >
          {filters.map((item, index) => {
            const isActive = activeFilter === item;
            const itemTheme = activeTheme;

            return (
              <TouchableOpacity
                key={index}
                onPress={() => dispatch(setPresetFilter(item))}
                style={[
                  styles.filterButtonCard,
                  {
                    backgroundColor: isActive ? itemTheme.activeBg : itemTheme.bg,
                    borderColor: isActive ? itemTheme.activeBg : itemTheme.border,
                    shadowColor: isActive ? itemTheme.activeBg : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isActive ? 0.3 : 0,
                    shadowRadius: isActive ? 4 : 0,
                    elevation: isActive ? 3 : 0,
                  }
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    { 
                      color: isActive ? itemTheme.activeText : itemTheme.text,
                      fontWeight: isActive ? '700' : '600'
                    },
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Simplified Date Range Display Text Only */}
        <View style={[styles.dateRangeDisplay, { backgroundColor: activeTheme.bg, borderColor: activeTheme.border }]}>
          <MaterialIcons name="date-range" size={16} color={activeTheme.activeBg} style={{ marginRight: 8 }} />
          <Text style={[styles.dateRangeValueText, { color: activeTheme.activeBg }]}>
            {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)}
          </Text>
        </View>

        {/* Sales Summary Grid */}
        {/* <View style={styles.grid}>
          <View style={styles.row}>
            <StatCard
              iconName="payments"
              label="Cash Sales"
              value="$12,450"
              trend="+4.5%"
              trendPositive={true}
            />
            <StatCard
              iconName="credit-card"
              label="Credit Sales"
              value="$8,210"
              trend="+2.1%"
              trendPositive={true}
            />
          </View>
          <View style={styles.row}>
            <StatCard
              iconName="today"
              label="Today's Sales"
              value="$20,660"
              trend="+12%"
              trendPositive={true}
            />
            <StatCard
              iconName="calendar-month"
              label="Monthly Sales"
              value="$452,100"
              trend="+8%"
              trendPositive={true}
            />
          </View>
        </View> */}

        {/* Sales Distribution Chart */}
        <ChartContainer />

        <SalesDetails />
        <DispatchSummary/>
        <SalesTripTruck /> 

        {/* Top Mix Designs */}
        <Card style={styles.productsCard}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Top Mix Designs</Text>
            {isMixLoading && (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
          </View>

          {isMixLoading && mixDesigns.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading mix designs...</Text>
            </View>
          ) : mixDesigns.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="grid-on" size={32} color={colors.outline} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No mix designs available.</Text>
            </View>
          ) : (
            <View style={styles.productsList}>
              {mixDesigns.slice(0, 5).map((item) => {
                const qty = item.total_batch_size?.qty ?? 0;
                const unit = item.total_batch_size?.unit ?? 'cbm';
                const count = item.total_batch_count?.qty ?? 1;
                const ratio = qty / count;
                const percentage = Math.min(100, Math.max(5, (ratio / maxRatio) * 100));

                return (
                  <View key={item.mix_design_id} style={styles.productRow}>
                    <View style={styles.productInfo}>
                      <View style={[styles.productIconWrapper, { backgroundColor: colors.primary + '12' }]}>
                        <MaterialIcons
                          name="layers"
                          size={20}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.productDetails}>
                        <Text style={[styles.productName, { color: colors.text }]}>{item.design_name}</Text>
                        <Text style={[styles.productSku, { color: colors.textSecondary }]}>
                          Code: {item.design_code} • {count} batches
                        </Text>
                      </View>
                      <View style={styles.badgeAndQty}>
                        <View style={[styles.gradeBadge, { borderColor: colors.outlineVariant + '33' }]}>
                          <Text style={[styles.gradeText, { color: colors.primary }]}>{item.grade}</Text>
                        </View>
                        <Text style={[styles.productQty, { color: colors.text }]}>
                          {qty} <Text style={{ fontSize: 10, fontWeight: 'normal', color: colors.textSecondary }}>{unit}</Text>
                        </Text>
                      </View>
                    </View>
                    {/* Custom Progress Bar */}
                    <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceContainer }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { backgroundColor: colors.primaryContainer, width: `${percentage}%` },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Decorative Warehouse Cover */}
          <View style={styles.coverWrapper}>
            <Image
              style={styles.coverImage}
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDnLoGRgLXPuhjpsWviBL1_OttFpRap0A2TTbVizzdHb6ZYFN4NwRbeYCqXFcvz9NgAXCfdLdgXuxKgWzjAUCO-radAEnyqmfZU1yf_8OFVOEBEe27ViSPTZs0Mu6wp0a7tGTyy0hCfuscCW93VN3FLOwqlOMRrRG4ktsDMRSSFohH_TuKr3DalMi1IEzD2ocwlaMriwQM-sDPLA6IxkirUsKzPGw_LW6uB9dlulvTQ7x6B_QVBi2RG' }}
            />
            <View style={styles.coverOverlay}>
              <Text style={styles.coverText}>Global Production Status</Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Custom Calendar Range Picker Modal */}
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
                    {tempEndDate ? formatDisplayDate(tempEndDate) : tempStartDate ? formatDisplayDate(tempStartDate) : 'Not selected'}
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
  scrollContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackGap,
    paddingBottom: 100, // Account for bottom tab bar height
    gap: Spacing.sectionGap,
  },
  welcomeSection: {
    marginTop: Spacing.one,
    marginBottom: Spacing.one,
  },
  welcomeInfo: {
    gap: 4,
  },
  welcomeGreeting: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'System',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  welcomeName: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'System',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  plantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  plantText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'System',
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
    fontWeight: '600',
    fontFamily: 'System',
  },
  headerCalendarButton: {
    padding: Spacing.one * 1.5,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.one,
  },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'center',
  },
  dateRangeValueText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'System',
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
  grid: {
    gap: Spacing.stackGap,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.stackGap,
  },
  productsCard: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'System',
  },
  productsList: {
    gap: Spacing.four,
  },
  productRow: {
    gap: Spacing.one * 1.5,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.two,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'System',
  },
  productSku: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'System',
  },
  productQty: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'System',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 9999,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 9999,
  },
  coverWrapper: {
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: Spacing.four * 1.5,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: Spacing.three,
  },
  coverText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  gradeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'System',
  },
  badgeAndQty: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'System',
  },
  emptyContainer: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'System',
  },
});
