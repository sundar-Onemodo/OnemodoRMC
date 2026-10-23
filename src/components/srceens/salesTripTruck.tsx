import { Colors } from "@/constants/theme";
import { RootState } from "@/store/store";
import { Feather, FontAwesome5, Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSelector } from "react-redux";
import { baseURL } from "../baseUrl/baseUrlAPI";

export default function SalesTripTruck() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];

  const { token, plant_id } = useSelector((state: RootState) => state.auth);
  const { startDate, endDate } = useSelector(
    (state: RootState) => state.dateFilter,
  );

  const [isloading, setIsLoading] = useState(false);
  const [tripData, setTripData] = useState<any[]>([]);
  const [expandedTruckId, setExpandedTruckId] = useState<number | null>(null);
  const [openSections, setOpenSections] = useState({
    tripsDetails: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };
  const toggleTruckExpand = (truckId: number) => {
    setExpandedTruckId((prevId) => (prevId === truckId ? null : truckId));
  };

  useEffect(() => {
    tripDetailsAPI();
  }, [token, plant_id, startDate, endDate]);

  const tripDetailsAPI = async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const trimAPI = token.includes("|") ? token.split("|")[1] : token;
      const res = await axios.get(
        `${baseURL}/truck-dispatch-details?plant_id=${plant_id}&from_date=${startDate}&to_date=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${trimAPI}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );
      console.log("res.data", res.data);

      setTripData(res.data.data || []);
    } catch (err) {
      console.log("Error fetching truck dispatch details:", err);
      setTripData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatQty = (value: any) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "0.00";
    return num.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant + "33",
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.sectionHeader,
          {
            borderBottomColor: colors.outlineVariant + "22",
            backgroundColor: colors.surface,
          },
        ]}
        onPress={() => toggleSection("tripsDetails")}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderLeft}>
          <View
            style={[
              styles.sectionIcon,
              { backgroundColor: colors.primary + "14" },
            ]}
          >
            <FontAwesome5
              name="truck-moving"
              size={15}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Truck-Wise Summary
          </Text>
        </View>
        <Feather
          name={openSections.tripsDetails ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.primary}
        />
      </TouchableOpacity>

      {openSections.tripsDetails && (
        <View style={styles.tableContainer}>
          {isloading ? (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text
                style={[styles.loadingText, { color: colors.textSecondary }]}
              >
                Syncing truck records...
              </Text>
            </View>
          ) : tripData.length === 0 ? (
            <View style={styles.emptyWrapper}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No dispatch logs available for selected date intervals.
              </Text>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.tableHeader,
                  { backgroundColor: colors.surfaceContainerHigh },
                ]}
              >
                <Text
                  style={[
                    styles.tableHeaderCell,
                    {
                      flex: 1.5,
                      textAlign: "left",
                      paddingLeft: 6,
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  Vehicle No
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { flex: 1, color: colors.textSecondary },
                  ]}
                >
                  Count
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { flex: 1.2, color: colors.textSecondary },
                  ]}
                >
                  Batching (CBM)
                </Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.4 }]} />
              </View>

              {tripData.map((item) => {
                const isExpanded = expandedTruckId === item.truck_id;
                const dispatchCount =
                  item.total_dispatch_count?.total_count ?? 0;
                const batchSize = item.total_batch_size?.qty ?? 0;

                return (
                  <View
                    key={item.truck_id}
                    style={[
                      styles.rowContainer,
                      {
                        backgroundColor: colors.surfaceContainerLow,
                        borderColor: colors.outlineVariant + "22",
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => toggleTruckExpand(item.truck_id)}
                      style={[
                        styles.tableRow,
                        isExpanded && {
                          backgroundColor: colors.primary + "0C",
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.tableCell,
                          {
                            flex: 1.5,
                            textAlign: "left",
                            fontWeight: "600",
                            color: colors.text,
                          },
                        ]}
                      >
                        {item.truck_registration}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          {
                            flex: 1,
                            textAlign: "center",
                            color: colors.textSecondary,
                            fontWeight: "500",
                          },
                        ]}
                      >
                        {dispatchCount}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          {
                            flex: 1.2,
                            textAlign: "center",
                            color: colors.primary,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {formatQty(batchSize)}
                      </Text>

                      <View style={{ flex: 0.4, alignItems: "center" }}>
                        <Ionicons
                          name={
                            isExpanded
                              ? "chevron-up-circle"
                              : "chevron-down-circle"
                          }
                          size={18}
                          color={isExpanded ? colors.primary : colors.outline}
                        />
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View
                        style={[
                          styles.expandedDetailsPanel,
                          {
                            backgroundColor: colors.surface,
                            borderTopColor: colors.outlineVariant + "22",
                          },
                        ]}
                      >
                        <View style={styles.detailsGrid}>
                          <View
                            style={[
                              styles.detailBox,
                              {
                                backgroundColor: colors.surfaceContainerLow,
                                borderColor: colors.outlineVariant + "22",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.detailLabel,
                                { color: colors.textSecondary },
                              ]}
                            >
                              TOTAL LOAD (CFT)
                            </Text>
                            <Text
                              style={[
                                styles.detailValue,
                                { color: colors.text },
                              ]}
                            >
                              {formatQty(item.total_qty?.cft?.qty)}{" "}
                              <Text style={styles.detailUnit}>cft</Text>
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.detailBox,
                              {
                                backgroundColor: colors.surfaceContainerLow,
                                borderColor: colors.outlineVariant + "22",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.detailLabel,
                                { color: colors.textSecondary },
                              ]}
                            >
                              TOTAL LOAD (MTR)
                            </Text>
                            <Text
                              style={[
                                styles.detailValue,
                                { color: colors.text },
                              ]}
                            >
                              {formatQty(item.total_qty?.mtr?.qty)}{" "}
                              <Text style={styles.detailUnit}>mtr</Text>
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  tableContainer: {
    padding: 12,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 6,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  rowContainer: {
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  tableCell: {
    fontSize: 13,
  },
  expandedDetailsPanel: {
    padding: 12,
    borderTopWidth: 1,
  },
  detailsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  detailBox: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  detailUnit: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "normal",
  },
  loadingWrapper: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyWrapper: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
  },
});
