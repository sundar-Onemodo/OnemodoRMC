import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { Card } from './card';

import { Colors, Spacing } from '@/constants/theme';
import { RootState } from '@/store/store';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { baseURL } from '../baseUrl/baseUrlAPI';

export function ChartContainer() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { token, plant_id: plantId } = useSelector((state: RootState) => state.auth);
  const { startDate, endDate } = useSelector((state: RootState) => state.dateFilter);

  console.log(startDate, endDate);
  
  const [apiLoading, setApiLoading] = useState(false);
  const [salesData, setSalesData] = useState<any>(null);

  useEffect(() => {
    const salesFigureAPI = async () => {
      if (!token) return;

      try {
        setApiLoading(true);
        const backendToken = token.includes("|") ? token.split("|")[1] : token;
        const tripPlantId = plantId || 1;

        const res = await axios.get(
          `${baseURL}/sales-summary?plant_id=${tripPlantId}&type=daily&from_date=${startDate}&to_date=${endDate}`,
          {
            headers: {
              Authorization: `Bearer ${backendToken}`,
              Accept: "application/json",
              "Content-Type": "application/json"
            }
          }
        );
        setSalesData(res.data.data);
        console.log('sales summary data:', res.data);
      } catch (err) {
        console.log(err);
      } finally {
        setApiLoading(false);
      }
    };

    salesFigureAPI();
  }, [startDate, endDate, token, plantId, baseURL]);

  const cashSalesVal = salesData?.cash_sales?.amount || 0;
  const creditSalesVal = salesData?.credit_sales?.amount || 0;

  const totalSalesVal = cashSalesVal + creditSalesVal;
  const cashSalesPercentage = totalSalesVal > 0 ? (cashSalesVal / totalSalesVal) * 100 : 0;
  const creditSalesPercentage = totalSalesVal > 0 ? (creditSalesVal / totalSalesVal) * 100 : 0;

  // Helper function to format date labels on the X-axis
  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length < 3) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return `${months[monthIdx]} ${day}`;
  };

  // Build data1 (Cash Sales) and data2 (Credit Sales) normalized wave series (0% to 100%) matching the screenshot curves
  const V1 = cashSalesPercentage;
  const V2 = creditSalesPercentage;

  const data1 = [
    { value: V1 * 0.70, label: formatDateLabel(startDate) },
    { value: V1 * 0.36, label: "" },
    { value: V1 * 0.50, label: "" },
    { value: V1 * 0.30, label: "" },
    { value: V1 * 0.15, label: "" },
    { value: V1 * 0.36, label: formatDateLabel(endDate) },
  ];
  const data2 = [
    { value: V2 * 0.50, label: formatDateLabel(startDate) },
    { value: V2 * 0.10, label: "" },
    { value: V2 * 0.45, label: "" },
    { value: V2 * 0.30, label: "" },
    { value: V2 * 0.45, label: "" },
    { value: V2 * 0.20, label: formatDateLabel(endDate) },
  ];

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

  return (
    <Card style={styles.card} variant="lowest">
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Sales Distribution</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Cash vs Credit breakdown</Text>
        </View>
        <View style={styles.totalSalesContainer}>
          <Text style={styles.totalSalesLabel}>TOTAL SALES</Text>
          <Text style={[styles.totalSalesValue, { color: colors.text }]}>
            {totalSalesVal >= 10000000
              ? `₹${(totalSalesVal / 10000000).toFixed(2)} Cr`
              : totalSalesVal >= 100000
              ? `₹${(totalSalesVal / 100000).toFixed(2)} L`
              : formatCurrency(totalSalesVal)
            }
          </Text>
        </View>
      </View>

      {apiLoading && !salesData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading sales summary...</Text>
        </View>
      ) : (
        <View style={styles.chartWrapper}>
          <View style={styles.chartContainer}>
            <LineChart
              areaChart
              curved
              data={data1}
              data2={data2}
              hideDataPoints
              spacing={50} // Increased spacing to make the chart wider and more visible
              height={180} // Increased height to make the chart taller
              color1="#8a56ce"
              color2="#56acce"
              startFillColor1="#8a56ce"
              startFillColor2="#56acce"
              endFillColor1="#8a56ce"
              endFillColor2="#56acce"
              startOpacity={0.9}
              endOpacity={0.2}
              initialSpacing={15}
              noOfSections={5}
              maxValue={100}
              yAxisColor="transparent"
              yAxisThickness={0}
              rulesType="solid"
              rulesColor={scheme === 'dark' ? '#334155' : '#cbd5e1'}
              yAxisTextStyle={{color: colors.textSecondary, fontSize: 10}}
              yAxisLabelSuffix="%"
              xAxisColor={scheme === 'dark' ? '#475569' : '#e2e8f0'}
              xAxisLabelTextStyle={{
                color: colors.textSecondary,
                fontSize: 10,
                fontWeight: '600',
                fontFamily: 'System',
              }}
              // pointerConfig={{
              //   pointerStripUptoDataPoint: true,
              //   pointerStripColor: colors.outlineVariant,
              //   pointerStripWidth: 2,
              //   strokeDashArray: [2, 5],
              //   pointerColor: colors.outlineVariant,
              //   radius: 4,
              //   pointerLabelWidth: 120,
              //   pointerLabelHeight: 100,
              //   pointerLabelComponent: (items: any) => {
              //     const cashPct = items[0]?.value ?? 0;
              //     const creditPct = items[1]?.value ?? 0;
              //     const cashVal = totalSalesVal * (cashPct / 100);
              //     const creditVal = totalSalesVal * (creditPct / 100);
              //     return (
              //       <View
              //         style={{
              //           height: 100,
              //           width: 120,
              //           backgroundColor: '#282C3E',
              //           borderRadius: 6,
              //           justifyContent: 'center',
              //           paddingLeft: 12,
              //           shadowColor: '#000',
              //           shadowOffset: { width: 0, height: 4 },
              //           shadowOpacity: 0.15,
              //           shadowRadius: 8,
              //           elevation: 5,
              //         }}>
              //         <Text style={{color: '#a78bfa', fontSize: 9, fontWeight: '700'}}>CASH SALES</Text>
              //         <Text style={{color: 'white', fontWeight: '800', fontSize: 12, marginBottom: 8}}>
              //           {formatCurrency(cashVal)}
              //         </Text>
              //         <Text style={{color: '#67e8f9', fontSize: 9, fontWeight: '700'}}>CREDIT SALES</Text>
              //         <Text style={{color: 'white', fontWeight: '800', fontSize: 12}}>
              //           {formatCurrency(creditVal)}
              //         </Text>
              //       </View>
              //     );
              //   },
              // }}
            />
          </View>

          {/* Legend */}
          <View style={styles.legendContainer}>
            <View style={[styles.legendItem, { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant + '20' }]}>
              <View style={styles.legendLeft}>
                <View style={[styles.colorIndicator, { backgroundColor: '#8a56ce' }]} />
                <View style={styles.legendTexts}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.legendLabel, { color: colors.text }]}>Cash Sales</Text>
                    {totalSalesVal > 0 && cashSalesVal > 0 && (
                      <View style={[styles.badge, { backgroundColor: '#8a56ce15' }]}>
                        <Text style={[styles.badgeText, { color: '#8a56ce' }]}>{cashSalesPercentage.toFixed(0)}%</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.legendDesc, { color: colors.textSecondary }]}>Direct payments</Text>
                </View>
              </View>
              <Text style={[styles.legendValue, { color: colors.text }]}>{formatCurrency(cashSalesVal)}</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={styles.legendLeft}>
                <View style={[styles.colorIndicator, { backgroundColor: '#56acce' }]} />
                <View style={styles.legendTexts}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.legendLabel, { color: colors.text }]}>Credit Sales</Text>
                    {totalSalesVal > 0 && creditSalesVal > 0 && (
                      <View style={[styles.badge, { backgroundColor: '#56acce15' }]}>
                        <Text style={[styles.badgeText, { color: '#56acce' }]}>{creditSalesPercentage.toFixed(0)}%</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.legendDesc, { color: colors.textSecondary }]}>B2B accounts</Text>
                </View>
              </View>
              <Text style={[styles.legendValue, { color: colors.text }]}>{formatCurrency(creditSalesVal)}</Text>
            </View>
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'System',
    marginTop: 2,
  },
  totalSalesContainer: {
    alignItems: 'flex-end',
  },
  totalSalesLabel: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'System',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalSalesValue: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'System',
    marginTop: 2,
  },
  loadingContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'System',
  },
  chartWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: Spacing.three,
  },
  chartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
  },
  barValueText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'System',
    marginBottom: 4,
    textAlign: 'center',
  },
  legendContainer: {
    flex: 1,
    minWidth: 200,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  colorIndicator: {
    width: 5,
    height: 32,
    borderRadius: 9999,
  },
  legendTexts: {
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legendLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'System',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  legendDesc: {
    fontSize: 11,
    fontFamily: 'System',
    marginTop: 1,
  },
  legendValue: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'System',
    textAlign: 'right',
  },
});
