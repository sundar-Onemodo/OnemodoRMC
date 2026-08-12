import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TextInput, View, Pressable, Text, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  onFilterPress,
}: SearchBarProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceContainerLow }]}>
      <MaterialIcons name="search" size={20} color={colors.outline} style={styles.searchIcon} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.outlineVariant}
      />
      {onFilterPress && (
        <Pressable
          onPress={onFilterPress}
          style={({ pressed }) => [
            styles.filterButton,
            { backgroundColor: colors.surfaceContainerHigh },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.filterText, { color: colors.primary }]}>Filter</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    height: 50,
  },
  searchIcon: {
    marginRight: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    padding: 0,
    fontFamily: 'System',
  },
  filterButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one * 1.5,
    borderRadius: 8,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'System',
  },
  pressed: {
    opacity: 0.8,
  },
});
