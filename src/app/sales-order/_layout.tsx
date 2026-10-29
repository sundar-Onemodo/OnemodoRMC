import { Stack } from "expo-router";
import React from "react";

export default function SalesOrderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="createSalesOrderScreen" />
      <Stack.Screen name="editSalesOrderScreen" />
    </Stack>
  );
}
