import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Colors, Spacing } from '@/constants/theme';

function AnimatedTabIcon({ iconName, isFocused, colors, label }: { iconName: string; isFocused: boolean; colors: any; label: string }) {
  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(isFocused ? 1.15 : 1, {
            damping: 15,
            stiffness: 150,
          }),
        },
      ],
    };
  });

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    return {
      width: withSpring(isFocused ? 20 : 0, { damping: 10 }),
      opacity: withSpring(isFocused ? 1 : 0),
    };
  });

  return (
    <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
      <View style={[
        styles.iconBg,
        isFocused && { backgroundColor: colors.primary + '18' }
      ]}>
        <Ionicons
          name={iconName as any}
          size={20}
          color={isFocused ? colors.primary : colors.textSecondary}
        />
      </View>
      <Text style={[
        styles.tabLabel,
        {
          color: isFocused ? colors.primary : colors.textSecondary,
          fontWeight: isFocused ? '700' : '500',
        }
      ]}>
        {label}
      </Text>
      <Animated.View style={[styles.activeDot, { backgroundColor: colors.primary }, animatedIndicatorStyle]} />
    </Animated.View>
  );
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[styles.tabBarWrapper, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={[
        styles.tabBar,
        {
          backgroundColor: scheme === 'dark' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.92)',
          borderColor: colors.outlineVariant + '2A',
        }
      ]}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          // Only render tab buttons for the main screens
          if (['index', 'trucks', 'customers', 'profile'].indexOf(route.name) === -1) {
            return null;
          }

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          let iconName = 'home-outline';
          let displayLabel = 'Home';

          if (route.name === 'index') {
            iconName = isFocused ? 'grid' : 'grid-outline';
            displayLabel = 'Dashboard';
          } else if (route.name === 'trucks') {
            iconName = isFocused ? 'cube' : 'cube-outline';
            displayLabel = 'Stock';
          } else if (route.name === 'customers') {
            iconName = isFocused ? 'people' : 'people-outline';
            displayLabel = 'Customers';
          } else if (route.name === 'profile') {
            iconName = isFocused ? 'person' : 'person-outline';
            displayLabel = 'Profile';
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabItem}
              activeOpacity={0.8}
            >
              <AnimatedTabIcon
                iconName={iconName}
                isFocused={isFocused}
                colors={colors}
                label={displayLabel}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="trucks" options={{ title: 'Stock' }} />
      <Tabs.Screen name="customers" options={{ title: 'Customers' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99,
  },
  tabBar: {
    flexDirection: 'row',
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    position: 'relative',
    height: '100%',
    width: '100%',
  },
  iconBg: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: 'System',
    marginTop: 2,
  },
  activeDot: {
    height: 3,
    borderRadius: 1.5,
    position: 'absolute',
    bottom: 2,
  },
});
