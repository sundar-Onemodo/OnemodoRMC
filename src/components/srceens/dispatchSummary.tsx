import { Colors } from "@/constants/theme";
import { RootState } from "@/store/store";
import { Feather, FontAwesome5 } from "@expo/vector-icons";
import axios from "axios";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSelector } from "react-redux";
import { baseURL } from "../baseUrl/baseUrlAPI";

interface DispatchSummaryType {
    id: string;
    dispatch_time: string;
    customer: {
        name: string;
    };
    unload_site: {
        name: string;
    };
    mix_design: {
        name: string;
        code: string;
    };
    delivered_qty: {
        qty: number;
        unit: string;
    };
    truck: {
        registration: string;
    };
    driver: {
        name: string;
    };
}

export default function DispatchSummary() {
    const scheme = useColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [dispatchData, setDispatchData] = useState<DispatchSummaryType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [showAll, setShowAll] = useState(false);

    const { token, plant_id: plantId } = useSelector((state: RootState) => state.auth);
    const { startDate, endDate } = useSelector((state: RootState) => state.dateFilter);

    useEffect(() => {
        if (token) {
            getDispatchData();
        }
    }, [token, startDate, endDate, plantId]);

    const getDispatchData = async () => {
        if (!token) return;

        try {
            setIsLoading(true);
            const trimToken = token.includes('|') ? token.split('|')[1] : token;
            const targetPlantId = plantId || 1;

            const res = await axios.get(
                `${baseURL}/dispatch-details?plant_id=${targetPlantId}&from_date=${startDate}&to_date=${endDate}`,
                {
                    headers: {
                        Authorization: `Bearer ${trimToken}`,
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                }
            );
            if (res.data && res.data.data) {
                setDispatchData(res.data.data);
            } else {
                setDispatchData([]);
            }
        } catch (err) {
            console.log("Error fetching dispatch data:", err);
            setDispatchData([]);
        } finally {
            setIsLoading(false);
        }
    };

    const formatTime = (timeStr: string) => {
        try {
            if (!timeStr) return "N/A";
            // Check if it looks like a full date time string (e.g. 2023-10-15 14:30:00)
            if (timeStr.includes(" ") || timeStr.includes("T")) {
                const parts = timeStr.split(" ");
                if (parts.length > 1) {
                    const timePart = parts[1];
                    const timeComponents = timePart.split(":");
                    if (timeComponents.length >= 2) {
                        let hours = parseInt(timeComponents[0], 10);
                        const minutes = timeComponents[1];
                        const ampm = hours >= 12 ? "PM" : "AM";
                        hours = hours % 12;
                        hours = hours ? hours : 12;
                        return `${hours}:${minutes} ${ampm}`;
                    }
                }
                const dateObj = new Date(timeStr);
                if (!isNaN(dateObj.getTime())) {
                    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            }
            return timeStr;
        } catch (e) {
            return timeStr;
        }
    };

    const displayedData = showAll ? dispatchData : dispatchData.slice(0, 5);

    const renderContent = () => {
        if (isLoading) {
            return (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.loaderText, { color: colors.textSecondary }]}>
                        Syncing dispatch logs...
                    </Text>
                </View>
            );
        }

        if (dispatchData.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Feather name="info" size={20} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No dispatch logs available for selected date intervals.
                    </Text>
                </View>
            );
        }

        return (
            <View style={styles.listContainer}>
                {displayedData.map((item) => {
                    const regNo = item.truck?.registration || "N/A";
                    const driverName = item.driver?.name || "N/A";
                    const dispatchTime = item.dispatch_time || "N/A";
                    const customerName = item.customer?.name || "N/A";
                    const unloadSiteName = item.unload_site?.name || "N/A";
                    const mixCode = item.mix_design?.code || "N/A";
                    const qty = item.delivered_qty?.qty || 0;
                    const unit = item.delivered_qty?.unit || "cbm";

                    return (
                        <View
                            key={item.id}
                            style={[
                                styles.dispatchCard,
                                {
                                    backgroundColor: colors.surfaceContainerLow,
                                    borderColor: colors.outlineVariant + "1A",
                                },
                            ]}
                        >
                            {/* Card Header: Reg & Quantity */}
                            <View style={styles.cardHeader}>
                                <View style={styles.truckContainer}>
                                    <View style={[styles.truckIconBg, { backgroundColor: colors.primary + "12" }]}>
                                        <Feather name="truck" size={13} color={colors.primary} />
                                    </View>
                                    <Text style={[styles.truckRegText, { color: colors.text }]}>{regNo}</Text>
                                </View>
                                <View style={[styles.qtyBadge, { backgroundColor: colors.secondaryContainer }]}>
                                    <Text style={[styles.qtyText, { color: colors.onSecondaryContainer || "#006c49" }]}>
                                        {qty} {unit}
                                    </Text>
                                </View>
                            </View>

                            <View style={[styles.divider, { backgroundColor: colors.outlineVariant + "22" }]} />

                            {/* Card Body: Customer & Unload Site */}
                            <View style={styles.cardBody}>
                                <View style={styles.infoRow}>
                                    <Feather name="user" size={12} color={colors.textSecondary} style={styles.infoIcon} />
                                    <View style={styles.infoTextCol}>
                                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Customer</Text>
                                        <Text style={[styles.infoValue, { color: colors.text }]}>{customerName}</Text>
                                    </View>
                                </View>

                                <View style={styles.infoRow}>
                                    <Feather name="map-pin" size={12} color={colors.textSecondary} style={styles.infoIcon} />
                                    <View style={styles.infoTextCol}>
                                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Unload Site</Text>
                                        <Text style={[styles.infoValue, { color: colors.text }]}>{unloadSiteName}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={[styles.subDivider, { backgroundColor: colors.outlineVariant + "11" }]} />

                            {/* Card Footer: Driver, Time, Mix Design */}
                            <View style={styles.cardFooter}>
                                <View style={styles.footerItem}>
                                    <Feather name="user-check" size={11} color={colors.textSecondary} />
                                    <Text style={[styles.footerText, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {driverName}
                                    </Text>
                                </View>

                                <View style={styles.footerItem}>
                                    <Feather name="clock" size={11} color={colors.textSecondary} />
                                    <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                                        {formatTime(dispatchTime)}
                                    </Text>
                                </View>

                                <View style={styles.footerItem}>
                                    <Feather name="layers" size={11} color={colors.textSecondary} />
                                    <Text style={[styles.footerText, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {mixCode}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    );
                })}

                {dispatchData.length > 5 && (
                    <TouchableOpacity
                        style={[styles.showMoreButton, { borderColor: colors.outlineVariant + "44" }]}
                        activeOpacity={0.7}
                        onPress={() => setShowAll(!showAll)}
                    >
                        <Text style={[styles.showMoreText, { color: colors.primary }]}>
                            {showAll ? "Show Less" : `Show More (${dispatchData.length - 5} more)`}
                        </Text>
                        <Feather
                            name={showAll ? "chevron-up" : "chevron-down"}
                            size={14}
                            color={colors.primary}
                        />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.outlineVariant + "33" }]}>
            <TouchableOpacity
                style={[styles.sectionHeader, { borderBottomColor: colors.outlineVariant + "22" }]}
                activeOpacity={0.7}
                onPress={() => setIsExpanded(!isExpanded)}
            >
                <View style={styles.sectionHeaderLeft}>
                    <View style={[styles.sectionIcon, { backgroundColor: "#FFF3E0" }]}>
                        <FontAwesome5 name="truck-moving" size={14} color="#ff9d06" />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Dispatch Summary</Text>
                </View>
                <Feather
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={22}
                    color={colors.primary}
                />
            </TouchableOpacity>

            {isExpanded && <View style={styles.sectionContent}>{renderContent()}</View>}
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
    sectionContent: {
        padding: 16,
    },
    loaderContainer: {
        paddingVertical: 40,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
    },
    loaderText: {
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
    listContainer: {
        gap: 12,
    },
    dispatchCard: {
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    truckContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    truckIconBg: {
        width: 24,
        height: 24,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
    },
    truckRegText: {
        fontSize: 14,
        fontWeight: "700",
    },
    qtyBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    qtyText: {
        fontSize: 12,
        fontWeight: "700",
    },
    divider: {
        height: 1,
        marginVertical: 10,
    },
    cardBody: {
        gap: 8,
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
    },
    infoIcon: {
        marginTop: 2,
    },
    infoTextCol: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 10,
        fontWeight: "500",
        textTransform: "uppercase",
        letterSpacing: 0.2,
    },
    infoValue: {
        fontSize: 13,
        fontWeight: "600",
        marginTop: 1,
    },
    subDivider: {
        height: 1,
        marginVertical: 10,
    },
    cardFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    footerItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        flex: 1,
    },
    footerText: {
        fontSize: 11,
        fontWeight: "500",
    },
    showMoreButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderStyle: "dashed",
        marginTop: 4,
    },
    showMoreText: {
        fontSize: 13,
        fontWeight: "600",
    },
});