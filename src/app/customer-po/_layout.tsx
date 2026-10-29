import { Stack } from 'expo-router';
import React from 'react';

export default function CustomerPOLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="createCustomerPO" />
      <Stack.Screen name="editCustomerPO" />
    </Stack>
  );
}
