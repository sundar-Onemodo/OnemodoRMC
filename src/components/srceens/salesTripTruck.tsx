import { RootState } from "@/store/store";
import { Feather, FontAwesome5, Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSelector } from "react-redux";
import { baseURL } from "../baseUrl/baseUrlAPI";

export default function SalesTripTruck() {

    const {token, plant_id} = useSelector((state:RootState) => state.auth)
    const { startDate, endDate } = useSelector((state: RootState) => state.dateFilter);

    const [isloading, setIsLoading] = useState(false)
    const [tripData, setTripData] = useState<any[]>([]);
    const [expandedTruckId, setExpandedTruckId] = useState<number | null>(null);
  const [openSections, setOpenSections] = useState({
    tripsDetails: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };
    const toggleTruckExpand = (truckId: number) => {
        setExpandedTruckId((prevId)=> (prevId === truckId ? null : truckId));
    };

    useEffect(()=>{
        tripDetailsAPI()
    },[token, plant_id, startDate, endDate])

    const tripDetailsAPI = async () => {
        if(!token) return;

        try{
            setIsLoading(true)
            const trimAPI = token.includes('|') ? token.split('|')[1] : token
            const res = await axios
                    .get(`${baseURL}/truck-dispatch-details?plant_id=${plant_id}&from_date=${startDate}&to_date=${endDate}`,
                        {
                            headers:{
                                Authorization: `Bearer ${trimAPI}`,
                                Accept: "application/json",
                                "Content-Type": "application/json"
                            }
                        }
                    )
                    setTripData(res.data.data)
        }catch(err){
            console.log('error')
        }finally{
            setIsLoading(false)
        }
    }

    const formatQty = (value: any) => {
        const num = parseFloat(value);
        if(isNaN(num)) return "0.00";
        return num.toLocaleString("en-IN",{
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
    };


    return (
        <View style={styles.section}>
            <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection("tripsDetails")}
                activeOpacity={0.7}
            >
                <View style={styles.sectionHeaderLeft}>
                    <View style={[styles.sectionIcon, { backgroundColor: "#FFF3E0" }]}>
                        <FontAwesome5 name="truck-moving" size={16} color="#ff9d06" />
                    </View>
                    <Text style={styles.sectionTitle}>Truck-Wise Summary</Text>
                </View>
                <Feather
                    name={openSections.tripsDetails ? "chevron-up" : "chevron-down"}
                    size={22}
                    color="#1c74fd"
                />
            </TouchableOpacity>

            {openSections.tripsDetails && (
                <View style={styles.tableContainer}>
                    {isloading ? (
                        <View style={styles.loadingWrapper}>
                            <ActivityIndicator size="small" color="#1c74fd" />
                            <Text style={styles.loadingText}>Syncing truck records...</Text>
                        </View>
                    ) : tripData.length === 0 ? (
                        <View style={styles.emptyWrapper}>
                            <Text style={styles.emptyText}>
                                No dispatch logs available for selected date intervals.
                            </Text>
                        </View>
                    ) : (
                        <>
                            <View style={styles.tableHeader}>
                                <Text
                                    style={[
                                        styles.tableHeaderCell,
                                        { flex: 1.5, textAlign: "left", paddingLeft: 6 },
                                    ]}
                                >
                                    Vehicle No
                                </Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Count</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>
                                    Batching (CBM)
                                </Text>
                                <Text style={[styles.tableHeaderCell, { flex: 0.4 }]} />
                            </View>

                            {tripData.map((item) => {
                                const isExpanded = expandedTruckId === item.truck_id;
                                // ✅ Fix: Access the nested qty values correctly
                                const dispatchCount =
                                    item.total_dispatch_count?.total_count ?? 0;
                                const batchSize = item.total_batch_size?.qty ?? 0;

                                return (
                                    <View key={item.truck_id} style={styles.rowContainer}>
                                        <TouchableOpacity
                                            onPress={() => toggleTruckExpand(item.truck_id)}
                                            style={[
                                                styles.tableRow,
                                                isExpanded && styles.activeTableRow,
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
                                                        color: "#1e293b",
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
                                                        color: "#475569",
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
                                                        color: "#2cc55c",
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
                                                    color="#1c74fd"
                                                />
                                            </View>
                                        </TouchableOpacity>

                                        {isExpanded && (
                                            <View style={styles.expandedDetailsPanel}>
                                                <View style={styles.detailsGrid}>
                                                    <View style={styles.detailBox}>
                                                        <Text style={styles.detailLabel}>
                                                            TOTAL LOAD (CFT)
                                                        </Text>
                                                        <Text style={styles.detailValue}>
                                                            {/* ✅ Fix: Access nested cft qty correctly */}
                                                            {formatQty(item.total_qty?.cft?.qty)}{" "}
                                                            <Text style={styles.detailUnit}>cft</Text>
                                                        </Text>
                                                    </View>

                                                    <View style={styles.detailBox}>
                                                        <Text style={styles.detailLabel}>
                                                            TOTAL LOAD (MTR)
                                                        </Text>
                                                        <Text style={styles.detailValue}>
                                                            {/* ✅ Fix: Access nested mtr qty correctly */}
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
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eeeff4",
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
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
    color: "#1e293b",
  },
  tableContainer: {
    padding: 12,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    marginBottom: 6,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    textAlign: "center",
  },
  rowContainer: {
    marginBottom: 6,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  activeTableRow: {
    backgroundColor: "rgba(28, 116, 253, 0.04)",
  },
  tableCell: {
    fontSize: 13,
  },
  expandedDetailsPanel: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#edf2f7",
  },
  detailsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  detailBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e293b",
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
    color: "#64748b",
  },
  emptyWrapper: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
  },
});