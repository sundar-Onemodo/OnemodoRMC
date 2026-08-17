import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

import { useAuth } from '@/context/auth-context';
import { RootState } from '@/store/store';
import { useSelector } from 'react-redux';

interface AppHeaderProps {
  title: string;
  showMenu?: boolean;
  showNotification?: boolean;
  onBackPress?: () => void;
  rightElement?: React.ReactNode;
}

export function AppHeader({
  title,
  showMenu = false,
  showNotification = true,
  onBackPress,
  rightElement,
}: AppHeaderProps) {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { toggleDrawer } = useAuth();
  const {plant_name} = useSelector((state:RootState)=> state.auth)

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.header, { backgroundColor: colors.headerBgColor, borderBottomColor: colors.outlineVariant + '99' }]}>
      <View style={styles.leftContainer}>
        {onBackPress || router.canGoBack() ? (
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && { backgroundColor: colors.surfaceContainerHigh },
            ]}>
            <MaterialIcons name="arrow-back" size={24} color={"#595d5c"} />
          </Pressable>
        ) : showMenu ? (
          <Pressable
            onPress={toggleDrawer}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && { backgroundColor: colors.surfaceContainerHigh },
            ]}>
            <MaterialIcons name="menu" size={24} color={'#595d5c'} />
          </Pressable>
        ) : null}
        
        <Text style={[styles.title, { color: '#434847' }]} ellipsizeMode='tail' numberOfLines={1}>
          {plant_name}
        </Text>
      </View>

      <View style={styles.rightContainer}>
        {rightElement}
        {showNotification && (
          <Pressable
            style={({ pressed }) => [
              styles.iconButton,
              pressed && { backgroundColor: colors.surfaceContainerHigh },
            ]}>
            <MaterialIcons name="notifications-none" size={24} color={'#595d5c'} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    zIndex: 50,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'System',
    width:200
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  iconButton: {
    padding: Spacing.one * 1.5,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
