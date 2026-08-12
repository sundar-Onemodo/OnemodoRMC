import { Colors } from "@/constants/theme";
import { RootState } from "@/store/store";
import { Feather, FontAwesome, FontAwesome5 } from "@expo/vector-icons";
import axios from "axios";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSelector } from "react-redux";
import { baseURL } from "../baseUrl/baseUrlAPI";

export default function SalesDetails() {
    const scheme = useColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { token, plant_id: plantId } = useSelector((state: RootState) => state.auth);
    const { startDate, endDate } = useSelector((state: RootState) => state.dateFilter);

    const [isLoading, setIsLoading] = useState(false);
    const [salesDetails, setSalesDetails] = useState<any>(null);
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        if (token) {
            fetchSalesDetails();
        }
    }, [token, startDate, endDate, plantId]);

    const fetchSalesDetails = async () => {
        if (!token) return;

        try {
            setIsLoading(true);
            const backendToken = token.includes("|") ? token.split("|")[1] : token;
            const targetPlantId = plantId || 1;

            const res = await axios.get(
                `${baseURL}/sales-details?plant_id=${targetPlantId}&from_date=${startDate}&to_date=${endDate}`,
                {
                    headers: {
                        Authorization: `Bearer ${backendToken}`,
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                }
            );
            setSalesDetails(res.data.data);
        } catch (err) {
            console.log(err);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (value: any) => {
        const num = parseFloat(value);
        if (isNaN(num)) return "₹0.00";
        return (
            "₹" +
            num.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })
        );
    };

    const formatNumber = (value: any) => {
        const num = parseFloat(value);
        if (isNaN(num)) return "0.00";
        return num.toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
    };

    const cash = salesDetails?.cash_sales;
    const credit = salesDetails?.credit_sales;

    const renderContent = () => {
        if (isLoading) {
            return (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.loaderText, { color: colors.textSecondary }]}>
                        Loading sales details...
                    </Text>
                </View>
            );
        }

        if (!salesDetails) {
            return (
                <View style={styles.emptyContainer}>
                    <Feather name="info" size={20} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No sales details found for this period.
                    </Text>
                </View>
            );
        }

        return (
            <View style={styles.innerContent}>
                {/* Credit Sales Section */}
                <View style={[styles.salesCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '1A' }]}>
                    <View style={styles.salesHeaderRow}>
                        <View style={[styles.salesIconBg, { backgroundColor: '#56acce18' }]}>
                            <Feather name="credit-card" size={14} color="#56acce" />
                        </View>
                        <Text style={[styles.salesTitle, { color: '#56acce' }]}>
                            Credit Sales
                        </Text>
                    </View>
                    
                    <View style={styles.amountContainer}>
                        <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Sales Amount</Text>
                        <Text style={[styles.amountValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                            {formatCurrency(credit?.sales_amount?.amount)}
                        </Text>
                    </View>

                    <View style={[styles.statsRow, { backgroundColor: colors.surface }]}>
                        <View style={styles.statCol}>
                            <View style={styles.statIconRow}>
                                <FontAwesome5 name="route" size={11} color={colors.textSecondary} />
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trips</Text>
                            </View>
                            <Text style={[styles.statValue, { color: colors.text }]}>
                                {credit?.trips?.dispatch_count ?? 0}
                            </Text>
                        </View>

                        <View style={styles.statCol}>
                            <Text style={[styles.volumeLabel, { color: colors.textSecondary }]}>CBM</Text>
                            <Text style={[styles.volumeValue, { color: colors.text }]}>
                                {formatNumber(credit?.quantity?.cbm?.qty)}
                            </Text>
                        </View>

                        <View style={styles.statCol}>
                            <Text style={[styles.volumeLabel, { color: colors.textSecondary }]}>CFT</Text>
                            <Text style={[styles.volumeValue, { color: colors.text }]}>
                                {formatNumber(credit?.quantity?.cft?.qty)}
                            </Text>
                        </View>

                        <View style={styles.statCol}>
                            <Text style={[styles.volumeLabel, { color: colors.textSecondary }]}>MTR</Text>
                            <Text style={[styles.volumeValue, { color: colors.text }]}>
                                {formatNumber(credit?.quantity?.mtr?.qty)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Cash Sales Section */}
                <View style={[styles.salesCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '1A' }]}>
                    <View style={styles.salesHeaderRow}>
                        <View style={[styles.salesIconBg, { backgroundColor: '#8a56ce18' }]}>
                            <FontAwesome name="rupee" size={14} color="#8a56ce" />
                        </View>
                        <Text style={[styles.salesTitle, { color: '#8a56ce' }]}>
                            Cash Sales
                        </Text>
                    </View>
                    
                    <View style={styles.amountContainer}>
                        <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Sales Amount</Text>
                        <Text style={[styles.amountValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                            {formatCurrency(cash?.sales_amount?.amount)}
                        </Text>
                    </View>

                    <View style={[styles.statsRow, { backgroundColor: colors.surface }]}>
                        <View style={styles.statCol}>
                            <View style={styles.statIconRow}>
                                <FontAwesome5 name="route" size={11} color={colors.textSecondary} />
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trips</Text>
                            </View>
                            <Text style={[styles.statValue, { color: colors.text }]}>
                                {cash?.trips?.dispatch_count ?? 0}
                            </Text>
                        </View>

                        <View style={styles.statCol}>
                            <Text style={[styles.volumeLabel, { color: colors.textSecondary }]}>CBM</Text>
                            <Text style={[styles.volumeValue, { color: colors.text }]}>
                                {formatNumber(cash?.quantity?.cbm?.qty)}
                            </Text>
                        </View>

                        <View style={styles.statCol}>
                            <Text style={[styles.volumeLabel, { color: colors.textSecondary }]}>CFT</Text>
                            <Text style={[styles.volumeValue, { color: colors.text }]}>
                                {formatNumber(cash?.quantity?.cft?.qty)}
                            </Text>
                        </View>

                        <View style={styles.statCol}>
                            <Text style={[styles.volumeLabel, { color: colors.textSecondary }]}>MTR</Text>
                            <Text style={[styles.volumeValue, { color: colors.text }]}>
                                {formatNumber(cash?.quantity?.mtr?.qty)}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.outlineVariant + '33' }]}>
            <TouchableOpacity
                style={[styles.sectionHeader, { borderBottomColor: colors.outlineVariant + '22' }]}
                activeOpacity={0.7}
                onPress={() => setIsExpanded(!isExpanded)}
            >
                <View style={styles.sectionHeaderLeft}>
                    <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '12' }]}>
                        <Feather name="shopping-bag" size={18} color={colors.primary} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Sales Details</Text>
                </View>
                <Feather
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={22}
                    color={colors.primary}
                />
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.sectionContent}>
                    {renderContent()}
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
        shadowColor: '#000000',
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
        fontWeight: '600',
    },
    sectionContent: {
        padding: 16,
    },
    loaderContainer: {
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loaderText: {
        fontSize: 13,
        fontWeight: '500',
    },
    emptyContainer: {
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    emptyText: {
        fontSize: 13,
        fontWeight: '500',
    },
    innerContent: {
        gap: 16,
    },
    salesCard: {
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
    },
    salesHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    salesIconBg: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    salesTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    amountContainer: {
        marginBottom: 14,
        paddingHorizontal: 4,
    },
    amountLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    amountValue: {
        fontSize: 22,
        fontWeight: '800',
        marginTop: 4,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 8,
        gap: 4,
    },
    statCol: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '500',
    },
    statValue: {
        fontSize: 13,
        fontWeight: '700',
    },
    volumeLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginBottom: 2,
    },
    volumeValue: {
        fontSize: 13,
        fontWeight: '700',
    },
});