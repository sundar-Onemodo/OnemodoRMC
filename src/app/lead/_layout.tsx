import { Stack } from "expo-router";
import React from "react";

export default function LeadLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="createLeadScreen" />
      <Stack.Screen name="editLeadScreen" />
    </Stack>
  );
}
