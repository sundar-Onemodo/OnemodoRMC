import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback } from "react";
import { BackHandler, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OrderProgressScreen() {
  const handleBack = useCallback(() => {
    router.replace("/quotation" as any);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleBack();
        return true;
      };
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, [handleBack]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f7f8" }}>
      <StatusBar style="auto" />

      {/* header UI  */}
      <View
        style={{
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#ccc",
          padding: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <View
              style={{
                backgroundColor: "#087f8c",
                alignItems: "center",
                justifyContent: "center",
                padding: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>
                M
              </Text>
            </View>
            <Text
              style={{
                color: "#087f8c",
                fontSize: 14,
                fontWeight: "bold",
                letterSpacing: 1,
              }}
            >
              MODO SALES
            </Text>
          </View>

          <View
            style={{ backgroundColor: "#e9f3f5", borderRadius: 20, padding: 5 }}
          >
            <Text style={{ color: "#087f8c", fontSize: 14, fontWeight: "500" }}>
              RS
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={{ color: "#000", fontWeight: "bold", fontSize: 20 }}>
            Order progress
          </Text>
        </View>

        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "#637685", fontWeight: "400", fontSize: 12 }}>
            Guindy plant . My records
          </Text>

          <View
            style={{
              backgroundColor: "#f0f6f6",
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              padding: 8,
            }}
          >
            <Text style={{ color: "#5ab2d0", fontSize: 12, fontWeight: "400" }}>
              Demo workspace
            </Text>
          </View>
        </View>
      </View>

      <ScrollView>
        <View style={{ padding: 10, marginTop: 20 }}>
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
            onPress={handleBack}
          >
            <MaterialIcons name={"chevron-left"} size={24} color="#087f8c" />
            <Text style={{ color: "#087f8c", fontSize: 16, fontWeight: "700" }}>
              Orders
            </Text>
          </TouchableOpacity>

          <View
            style={{
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#e4ebef",
              padding: 20,
              borderRadius: 15,
              marginTop: 10,
            }}
          >
            <View style={{ marginTop: 20, gap: 6 }}>
              <Text style={{ color: "#000", fontSize: 16, fontWeight: "600" }}>
                SO/2672/0004
              </Text>
              <Text
                style={{ color: "#637685", fontSize: 12, fontWeight: "400" }}
              >
                Kavin Builders . M25 Design
              </Text>
            </View>

            <View
              style={{
                backgroundColor: "#e5e9f3",
                borderRadius: 10,
                height: 5,
                width: "100%",
                marginTop: 10,
              }}
            >
              <View
                style={{
                  backgroundColor: "#087f8c",
                  width: "40%",
                  height: 5,
                  borderRadius: 10,
                }}
              />
            </View>

            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",

                padding: 10,
                borderBottomWidth: 1,
                borderBottomColor: "#e4ebef",
              }}
            >
              <Text
                style={{ color: "#637685", fontSize: 14, fontWeight: "400" }}
              >
                Ordered
              </Text>
              <Text
                style={{ color: "#2c4146", fontSize: 14, fontWeight: "500" }}
              >
                40 m³
              </Text>
            </View>

            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",

                padding: 10,
                borderBottomWidth: 1,
                borderBottomColor: "#e4ebef",
              }}
            >
              <Text
                style={{ color: "#637685", fontSize: 14, fontWeight: "400" }}
              >
                Committed batches
              </Text>
              <Text
                style={{ color: "#2c4146", fontSize: 14, fontWeight: "500" }}
              >
                24 m³
              </Text>
            </View>
            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",

                padding: 10,
                borderBottomWidth: 1,
                borderBottomColor: "#e4ebef",
              }}
            >
              <Text
                style={{ color: "#637685", fontSize: 14, fontWeight: "400" }}
              >
                Dispatched
              </Text>
              <Text
                style={{ color: "#2c4146", fontSize: 14, fontWeight: "500" }}
              >
                18 m³
              </Text>
            </View>

            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",

                padding: 10,
                borderBottomWidth: 1,
                borderBottomColor: "#e4ebef",
              }}
            >
              <Text
                style={{ color: "#637685", fontSize: 14, fontWeight: "400" }}
              >
                Delivered
              </Text>
              <Text
                style={{ color: "#2c4146", fontSize: 14, fontWeight: "500" }}
              >
                12 m³
              </Text>
            </View>

            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",

                padding: 10,
              }}
            >
              <Text
                style={{ color: "#637685", fontSize: 14, fontWeight: "400" }}
              >
                Remaining delivery
              </Text>
              <Text
                style={{ color: "#2c4146", fontSize: 14, fontWeight: "500" }}
              >
                28 m³
              </Text>
            </View>
          </View>

          <Text
            style={{
              color: "#000",
              fontSize: 16,
              fontWeight: "bold",
              marginTop: 10,
            }}
          >
            4 batches - 2 completed
          </Text>
          <View
            style={{
              backgroundColor: "#fff",
              padding: 20,
              borderRadius: 15,
              marginTop: 10,
            }}
          >
            <View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{ color: "#172b40", fontSize: 14, fontWeight: "400" }}
                >
                  Batch #41
                </Text>
                <Text
                  style={{ color: "#637685", fontSize: 14, fontWeight: "400" }}
                >
                  6 m³
                </Text>
              </View>
              <Text
                style={{
                  color: "#637685",
                  fontSize: 12,
                  fontWeight: "500",
                }}
              >
                Completed . Delivered
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: "#fff",
              padding: 20,
              borderRadius: 15,
              marginTop: 10,
            }}
          >
            <View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{ color: "#172b40", fontSize: 14, fontWeight: "400" }}
                >
                  Batch #42
                </Text>
                <Text
                  style={{ color: "#637685", fontSize: 14, fontWeight: "400" }}
                >
                  6 m³
                </Text>
              </View>
              <Text
                style={{
                  color: "#637685",
                  fontSize: 12,
                  fontWeight: "500",
                }}
              >
                Completed . Delivered
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: "#fff",
              padding: 20,
              borderRadius: 15,
              marginTop: 10,
            }}
          >
            <View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{ color: "#172b40", fontSize: 14, fontWeight: "400" }}
                >
                  Batch #43
                </Text>
                <Text
                  style={{ color: "#637685", fontSize: 14, fontWeight: "400" }}
                >
                  6 m³
                </Text>
              </View>
              <Text
                style={{
                  color: "#637685",
                  fontSize: 12,
                  fontWeight: "500",
                }}
              >
                Dispatched . In transit
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: "#fff",
              padding: 20,
              borderRadius: 15,
              marginTop: 10,
            }}
          >
            <View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{ color: "#172b40", fontSize: 14, fontWeight: "400" }}
                >
                  Batch #44
                </Text>
                <Text
                  style={{ color: "#637685", fontSize: 14, fontWeight: "400" }}
                >
                  6 m³
                </Text>
              </View>
              <Text
                style={{
                  color: "#637685",
                  fontSize: 12,
                  fontWeight: "500",
                }}
              >
                Loading . Draft ticket
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
