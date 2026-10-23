import { Stack } from "expo-router";
import React from "react";

export default function OrdersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="orderprogressScreen" />
      <Stack.Screen name="editQuotationScreen" />
    </Stack>
  );
}
