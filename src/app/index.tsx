import {
  Feather,
  FontAwesome5,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import axios from "axios";
import { format, parseISO } from "date-fns";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
} from "react-native";
import CalendarPicker from "react-native-calendar-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

import { baseURL } from "@/components/baseUrl/baseUrlAPI";
import DispatchSummary from "@/components/srceens/dispatchSummary";
import SalesTripTruck from "@/components/srceens/salesTripTruck";
import { AppHeader } from "@/components/ui/app-header";
import { Card } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart-container";
import { Colors, Spacing } from "@/constants/theme";
import { setCustomRange, setPresetFilter } from "@/store/dateFilterSlice";
import { RootState } from "@/store/store";

export default function DashboardScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];
  const { token, plant_name, user, plant_id } = useSelector(
    (state: RootState) => state.auth,
  );
  console.log("token", token);
  const dispatch = useDispatch();
  const { startDate, endDate, activeFilter } = useSelector(
    (state: RootState) => state.dateFilter,
  );

  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<string | null>(null);
  const [tempEndDate, setTempEndDate] = useState<string | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const calendarWidth = Math.min(screenWidth - 48, 380);

  const [mixDesigns, setMixDesigns] = useState<any[]>([]);
  const [isMixLoading, setIsMixLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (token) {
      fetchTopMixDesigns();
    }
  }, [token, plant_id, startDate, endDate]);

  const fetchTopMixDesigns = async () => {
    if (!token) return;
    try {
      setIsMixLoading(true);
      const trimToken = token.includes("|") ? token.split("|")[1] : token;
      const targetPlantId = plant_id || 1;
      const res = await axios.get(
        `${baseURL}/top-mix-designs?plant_id=${targetPlantId}&from_date=${startDate}&to_date=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${trimToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (res.data && res.data.success) {
        setMixDesigns(res.data.data || []);
      } else {
        setMixDesigns([]);
      }
    } catch (err) {
      console.log("Error fetching mix designs:", err);
      setMixDesigns([]);
    } finally {
      setIsMixLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTopMixDesigns();
    setRefreshing(false);
  };

  const maxRatio = useMemo(() => {
    if (mixDesigns.length === 0) return 1;
    return Math.max(
      ...mixDesigns.map((d) => {
        const qty = d.total_batch_size?.qty || 0;
        const count = d.total_batch_count?.qty || 1;
        return qty / count;
      }),
    );
  }, [mixDesigns]);

  const formatSelectedDate = (date: any) => {
    if (!date) return null;
    const jsDate =
      typeof date.toDate === "function" ? date.toDate() : new Date(date);
    return format(jsDate, "yyyy-MM-dd");
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd MMM yyyy");
    } catch (e) {
      return dateStr;
    }
  };

  const handleOpenCalendar = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setIsCalendarVisible(true);
  };

  const onDateChange = (date: any, type: "START_DATE" | "END_DATE") => {
    const formatted = date ? formatSelectedDate(date) : null;
    if (type === "END_DATE") {
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
    "This week",
    "Last week",
    "This month",
    "Last month",
  ];

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.headerBgColor }]}
      edges={["top"]}
    >
      {/* App Header with Plant Name and Action */}
      <AppHeader
        title={plant_name || "RMC Plant Operations"}
        showMenu={true}
        showNotification={false}
        rightElement={
          <Pressable
            onPress={handleOpenCalendar}
            style={({ pressed }) => [
              styles.headerCalendarButton,
              pressed && { backgroundColor: "rgba(255, 255, 255, 0.18)" },
            ]}
          >
            <MaterialIcons name="date-range" size={22} color="#ffffff" />
          </Pressable>
        }
      />

      {/* Main Dashboard Scroll Container */}
      <ScrollView
        style={[
          styles.contentContainer,
          { backgroundColor: colors.background },
        ]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Executive Plant Hero Status Banner */}
        <View
          style={[
            styles.plantHeroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.outlineVariant + "33",
            },
          ]}
        >
          <View style={styles.plantHeroLeft}>
            <View
              style={[
                styles.plantAvatarBg,
                { backgroundColor: colors.primary + "14" },
              ]}
            >
              <FontAwesome5 name="industry" size={18} color={colors.primary} />
            </View>
            <View style={styles.plantInfoCol}>
              <View style={styles.plantNameRow}>
                <Text
                  style={[styles.plantTitleText, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {plant_name || "Batching Facility #1"}
                </Text>
              </View>
              <Text
                style={[
                  styles.plantSubtitleText,
                  { color: colors.textSecondary },
                ]}
              >
                {user?.name ? `Manager: ${user.name}` : "Live Batching Control"}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.liveStatusChip,
              { backgroundColor: "rgba(16, 185, 129, 0.12)" },
            ]}
          >
            <View style={styles.livePulseDot} />
            <Text style={styles.liveStatusText}>LIVE</Text>
          </View>
        </View>

        {/* Date Filter Segmented Carousel */}
        <View style={styles.filterSectionContainer}>
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
                  activeOpacity={0.7}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: isActive
                        ? colors.primary
                        : colors.surface,
                      borderColor: isActive
                        ? colors.primary
                        : colors.outlineVariant + "3A",
                      shadowColor: isActive ? colors.primary : "#000000",
                      shadowOpacity: isActive ? 0.25 : 0.03,
                      elevation: isActive ? 3 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      {
                        color: isActive ? "#ffffff" : colors.textSecondary,
                        fontWeight: isActive ? "700" : "500",
                      },
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Active Range Preview Callout */}
          <TouchableOpacity
            onPress={handleOpenCalendar}
            activeOpacity={0.8}
            style={[
              styles.dateRangeBadge,
              {
                backgroundColor:
                  scheme === "dark" ? "rgba(30, 41, 59, 0.6)" : "#ffffff",
                borderColor: colors.outlineVariant + "33",
              },
            ]}
          >
            <View style={styles.dateRangeLeft}>
              <View
                style={[
                  styles.dateRangeIconWrap,
                  { backgroundColor: colors.primary + "12" },
                ]}
              >
                <MaterialIcons name="event" size={15} color={colors.primary} />
              </View>
              <Text style={[styles.dateRangeText, { color: colors.text }]}>
                {formatDisplayDate(startDate)}
                <Text
                  style={{ color: colors.textSecondary, fontWeight: "normal" }}
                >
                  {" "}
                  to{" "}
                </Text>
                {formatDisplayDate(endDate)}
              </Text>
            </View>

            <View style={styles.dateRangeAction}>
              <Text style={[styles.changeRangeText, { color: colors.primary }]}>
                Filter
              </Text>
              <Feather name="chevron-right" size={14} color={colors.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Interactive Line Chart & Sales Metrics */}
        <ChartContainer />

        {/* Dispatch Logs Summary Section */}
        <DispatchSummary />

        {/* Fleet & Truck Logistics Section */}
        <SalesTripTruck />

        {/* Top Mix Designs Formulation Section */}
        <Card
          style={[
            styles.topMixCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.outlineVariant + "33",
            },
          ]}
        >
          <View style={styles.mixCardHeader}>
            <View style={styles.mixCardHeaderLeft}>
              <View
                style={[
                  styles.mixIconBg,
                  { backgroundColor: colors.secondary + "14" },
                ]}
              >
                <MaterialCommunityIcons
                  name="cube-outline"
                  size={18}
                  color={colors.secondary}
                />
              </View>
              <View>
                <Text style={[styles.mixCardTitle, { color: colors.text }]}>
                  Top Mix Designs
                </Text>
                <Text
                  style={[
                    styles.mixCardSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {mixDesigns.length > 0
                    ? `${mixDesigns.length} active formulations`
                    : "Production breakdown"}
                </Text>
              </View>
            </View>

            {isMixLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <TouchableOpacity
                onPress={fetchTopMixDesigns}
                activeOpacity={0.6}
              >
                <Feather
                  name="refresh-cw"
                  size={16}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

          {isMixLoading && mixDesigns.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text
                style={[styles.loadingText, { color: colors.textSecondary }]}
              >
                Loading concrete formulations...
              </Text>
            </View>
          ) : mixDesigns.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="grid-on" size={32} color={colors.outline} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No mix design batches recorded in this period.
              </Text>
            </View>
          ) : (
            <View style={styles.mixList}>
              {mixDesigns.slice(0, 5).map((item, idx) => {
                const qty = item.total_batch_size?.qty ?? 0;
                const unit = item.total_batch_size?.unit ?? "cbm";
                const count = item.total_batch_count?.qty ?? 1;
                const ratio = qty / count;
                const percentage = Math.min(
                  100,
                  Math.max(8, (ratio / maxRatio) * 100),
                );

                return (
                  <View
                    key={item.mix_design_id || idx}
                    style={[
                      styles.mixItemContainer,
                      {
                        backgroundColor: colors.surfaceContainerLow,
                        borderColor: colors.outlineVariant + "22",
                      },
                    ]}
                  >
                    <View style={styles.mixItemTopRow}>
                      <View style={styles.mixItemLeft}>
                        <View
                          style={[
                            styles.gradeTag,
                            {
                              backgroundColor: colors.primary + "14",
                              borderColor: colors.primary + "33",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.gradeTagText,
                              { color: colors.primary },
                            ]}
                          >
                            {item.grade || "M25"}
                          </Text>
                        </View>
                        <View style={styles.mixNameCol}>
                          <Text
                            style={[styles.mixItemName, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {item.design_name || "Standard Mix"}
                          </Text>
                          <Text
                            style={[
                              styles.mixItemCode,
                              { color: colors.textSecondary },
                            ]}
                          >
                            Code: {item.design_code} • {count}{" "}
                            {count === 1 ? "batch" : "batches"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.mixItemRight}>
                        <Text
                          style={[styles.mixQtyVal, { color: colors.text }]}
                        >
                          {Number(qty).toLocaleString("en-IN")}{" "}
                          <Text
                            style={[
                              styles.mixQtyUnit,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {unit}
                          </Text>
                        </Text>
                      </View>
                    </View>

                    {/* Proportional Production Bar */}
                    <View style={styles.progressSection}>
                      <View
                        style={[
                          styles.progressBarTrack,
                          { backgroundColor: colors.surfaceContainerHigh },
                        ]}
                      >
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${percentage}%`,
                              backgroundColor:
                                idx % 2 === 0
                                  ? colors.primary
                                  : colors.secondary,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Decorative Industry Banner */}
          <View style={styles.coverWrapper}>
            <Image
              style={styles.coverImage}
              source={require("../../assets/images/rmc.jpg")}
            />
            <View style={styles.coverOverlay}>
              <Text style={styles.coverTitle}>
                Ready-Mix Concrete Operations
              </Text>
              <Text style={styles.coverSubtitle}>
                High-Precision Batching & Logistics
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Date Range Picker Modal Sheet */}
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
          <View
            style={[styles.modalSheet, { backgroundColor: colors.surface }]}
          >
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: colors.outlineVariant + "22" },
              ]}
            >
              <View style={styles.modalHeaderLeft}>
                <MaterialIcons
                  name="date-range"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Select Date Range
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsCalendarVisible(false)}
                style={[
                  styles.closeButton,
                  { backgroundColor: colors.surfaceContainerHigh },
                ]}
              >
                <MaterialIcons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarContainer}>
              <CalendarPicker
                startFromMonday={true}
                allowRangeSelection={true}
                selectedStartDate={
                  tempStartDate ? new Date(tempStartDate) : undefined
                }
                selectedEndDate={
                  tempEndDate ? new Date(tempEndDate) : undefined
                }
                onDateChange={onDateChange}
                todayBackgroundColor={colors.outlineVariant + "33"}
                selectedDayColor={colors.primary}
                selectedDayTextColor="#ffffff"
                selectedRangeStyle={{ backgroundColor: colors.primary + "22" }}
                selectedRangeStartStyle={{ backgroundColor: colors.primary }}
                selectedRangeEndStyle={{ backgroundColor: colors.primary }}
                textStyle={{
                  color: colors.text,
                  fontSize: 13,
                  fontFamily: "System",
                }}
                disabledDatesTextStyle={{ color: colors.outline }}
                nextTitleStyle={{ color: colors.primary, fontWeight: "700" }}
                previousTitleStyle={{
                  color: colors.primary,
                  fontWeight: "700",
                }}
                width={calendarWidth}
              />
            </View>

            <View
              style={[
                styles.modalFooter,
                { borderTopColor: colors.outlineVariant + "22" },
              ]}
            >
              <View
                style={[
                  styles.selectedDatesPreview,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant + "22",
                  },
                ]}
              >
                <View style={styles.previewCol}>
                  <Text
                    style={[
                      styles.previewLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    FROM DATE
                  </Text>
                  <Text style={[styles.previewVal, { color: colors.text }]}>
                    {tempStartDate
                      ? formatDisplayDate(tempStartDate)
                      : "Select Start"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.previewDivider,
                    { backgroundColor: colors.outlineVariant + "44" },
                  ]}
                />
                <View style={styles.previewCol}>
                  <Text
                    style={[
                      styles.previewLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    TO DATE
                  </Text>
                  <Text style={[styles.previewVal, { color: colors.text }]}>
                    {tempEndDate
                      ? formatDisplayDate(tempEndDate)
                      : tempStartDate
                        ? formatDisplayDate(tempStartDate)
                        : "Select End"}
                  </Text>
                </View>
              </View>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  onPress={() => setIsCalendarVisible(false)}
                  style={[
                    styles.modalButtonSecondary,
                    { borderColor: colors.outlineVariant + "55" },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalButtonSecondaryText,
                      { color: colors.text },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleApplyRange}
                  disabled={!tempStartDate}
                  style={[
                    styles.modalButtonPrimary,
                    {
                      backgroundColor: tempStartDate
                        ? colors.primary
                        : colors.surfaceContainerHigh,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalButtonPrimaryText,
                      {
                        color: tempStartDate ? "#ffffff" : colors.textSecondary,
                      },
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  scrollContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: 18,
    paddingBottom: 110,
    gap: Spacing.sectionGap,
  },
  headerCalendarButton: {
    padding: 8,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  plantHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  plantHeroLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  plantAvatarBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  plantInfoCol: {
    flex: 1,
    gap: 2,
  },
  plantNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  plantTitleText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  plantSubtitleText: {
    fontSize: 12,
    fontWeight: "500",
  },
  liveStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  liveStatusText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: 0.5,
  },
  filterSectionContainer: {
    gap: 10,
  },
  filterScrollView: {
    marginHorizontal: -Spacing.containerMargin,
    paddingHorizontal: Spacing.containerMargin,
  },
  filterScrollContent: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingVertical: 4,
    paddingRight: Spacing.containerMargin * 2,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  filterPillText: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  dateRangeBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  dateRangeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  dateRangeIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  dateRangeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  dateRangeAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  changeRangeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  topMixCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  mixCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  mixCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mixIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  mixCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  mixCardSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  mixList: {
    gap: 10,
  },
  mixItemContainer: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  mixItemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mixItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  gradeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gradeTagText: {
    fontSize: 11,
    fontWeight: "800",
  },
  mixNameCol: {
    flex: 1,
  },
  mixItemName: {
    fontSize: 13,
    fontWeight: "700",
  },
  mixItemCode: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  mixItemRight: {
    alignItems: "flex-end",
  },
  mixQtyVal: {
    fontSize: 14,
    fontWeight: "800",
  },
  mixQtyUnit: {
    fontSize: 11,
    fontWeight: "500",
  },
  progressSection: {
    width: "100%",
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  coverWrapper: {
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 18,
    position: "relative",
  },
  coverImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  coverOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
    padding: 12,
  },
  coverTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  coverSubtitle: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
  modalOverlay: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  calendarContainer: {
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  selectedDatesPreview: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  previewCol: {
    flex: 1,
    alignItems: "center",
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  previewVal: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  previewDivider: {
    width: 1,
    height: 24,
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalButtonPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
