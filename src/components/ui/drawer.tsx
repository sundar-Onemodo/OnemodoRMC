import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { RootState } from '@/store/store';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedPlant } from '@/store/authSlice';

const DRAWER_WIDTH = 280;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const hasProfilePhoto = (url?: string | null) => {
  if (!url) return false;
  if (url.includes('ui-avatars.com')) return false;
  return true;
};

export function Drawer() {
  const { isDrawerOpen, closeDrawer, logout } = useAuth();
  const { user, plant_id } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isDrawerOpen) {
      // Slide in drawer and fade in backdrop
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide out drawer and fade out backdrop
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isDrawerOpen]);

  const handleSelectPlant = (id: number, name: string) => {
    dispatch(setSelectedPlant({ id, plant_name: name }));
    setTimeout(() => {
      closeDrawer();
    }, 150);
  };

  const handleNavigate = (route: string) => {
    closeDrawer();
    // Wait a brief moment for drawer animation to close before pushing route
    setTimeout(() => {
      router.push(route as any);
    }, 150);
  };

  const handleLogout = () => {
    logout();
  };



  const menuItems = [
    { label: 'Dashboard', icon: 'dashboard', route: '/' },
    { label: 'Stock', icon: 'inventory', route: '/trucks' },
    { label: 'Customer Profile', icon: 'groups', route: '/customers' },
    { label: 'My Profile', icon: 'person', route: '/profile' },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isDrawerOpen ? 'auto' : 'none'}>
      {/* Semi-transparent backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={styles.backdropPressable} onPress={closeDrawer} />
      </Animated.View>

      {/* Drawer content pane */}
      <Animated.View
        style={[
          styles.drawerPane,
          {
            backgroundColor: colors.surfaceContainerLowest,
            transform: [{ translateX: slideAnim }],
            borderRightColor: colors.outlineVariant + '33',
          },
        ]}
      >
        {/* User profile header */}
        <View style={[styles.profileHeader, { borderBottomColor: colors.outlineVariant + '22' }]}>
          {hasProfilePhoto(user?.profile_photo_url) ? (
            <Image
              style={styles.avatar}
              source={{
                uri: user?.profile_photo_url || '',
              }}
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.surfaceContainer, justifyContent: 'center', alignItems: 'center' }]}>
              <MaterialIcons name="person" size={28} color={colors.outline} />
            </View>
          )}
          <View style={styles.profileTextWrapper}>
            <Text style={[styles.userName, { color: colors.text }]}>{user?.name || "Sundar"}</Text>
            <View style={[styles.roleBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.userRoleText, { color: colors.primary }]}>Admin Mode</Text>
            </View>
          </View>
        </View>

        {/* Plant Selector Section */}
        <View style={[styles.plantsSection, { borderBottomColor: colors.outlineVariant + '22' }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionHeaderAccent, { backgroundColor: colors.primary }]} />
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SELECT ACTIVE PLANT</Text>
          </View>
          <ScrollView 
            style={styles.plantsScroll} 
            contentContainerStyle={styles.plantsContent}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            {user?.plants && user.plants.length > 0 ? (
              user.plants.map((plant) => {
                const isSelected = plant.id === plant_id;
                return (
                  <Pressable
                    key={plant.id}
                    style={({ pressed }) => [
                      styles.plantItem,
                      {
                        backgroundColor: isSelected ? colors.primary + '0C' : colors.surfaceContainerLow,
                        borderColor: isSelected ? colors.primary : colors.outlineVariant + '22',
                      },
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => handleSelectPlant(plant.id, plant.plant_name)}
                  >
                    <View style={[
                      styles.plantIconCircle,
                      { backgroundColor: isSelected ? colors.primary : colors.outlineVariant + '33' }
                    ]}>
                      <MaterialIcons
                        name="business"
                        size={16}
                        color={isSelected ? '#ffffff' : colors.textSecondary}
                      />
                    </View>
                    
                    <View style={styles.plantTextContainer}>
                      <Text
                        style={[
                          styles.plantName,
                          { color: isSelected ? colors.primary : colors.text },
                          isSelected && { fontWeight: '700' }
                        ]}
                        numberOfLines={1}
                      >
                        {plant.plant_name}
                      </Text>
                      <Text style={[styles.plantSubtext, { color: colors.textSecondary }]}>
                        {isSelected ? 'Currently Active' : 'Tap to switch'}
                      </Text>
                    </View>

                    {isSelected && (
                      <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}>
                        <MaterialIcons name="check" size={10} color="#ffffff" />
                        <Text style={styles.activeBadgeText}>ACTIVE</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })
            ) : (
              <Text style={[styles.noPlantsText, { color: colors.textSecondary }]}>No plants assigned</Text>
            )}
          </ScrollView>
        </View>

        {/* Navigation list */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, idx) => (
            <Pressable
              key={idx}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { backgroundColor: colors.surfaceContainerLow },
              ]}
              onPress={() => handleNavigate(item.route)}
            >
              <MaterialIcons name={item.icon as any} size={22} color={colors.primary} />
              <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Bottom logout control */}
        <View style={[styles.footerContainer, { borderTopColor: colors.outlineVariant + '22' }]}>
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              styles.logoutItem,
              pressed && { backgroundColor: colors.errorContainer + '33' },
            ]}
            onPress={handleLogout}
          >
            <MaterialIcons name="logout" size={22} color={colors.error} />
            <Text style={[styles.menuLabel, styles.logoutLabel, { color: colors.error }]}>Logout</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 998,
  },
  backdropPressable: {
    flex: 1,
  },
  drawerPane: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 999,
    borderRightWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.cardPadding,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: Spacing.two,
  },
  profileTextWrapper: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'System',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  userRoleText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'System',
  },
  menuContainer: {
    flex: 1,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.two,
    gap: Spacing.one,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two * 1.5,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    gap: Spacing.three,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'System',
  },
  footerContainer: {
    padding: Spacing.two,
    borderTopWidth: 1,
  },
  logoutItem: {
    borderRadius: 10,
  },
  logoutLabel: {
    fontWeight: '700',
  },
  plantsSection: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two * 1.2,
    borderBottomWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one * 1.5,
    marginBottom: Spacing.two,
  },
  sectionHeaderAccent: {
    width: 4,
    height: 12,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    fontFamily: 'System',
  },
  plantsScroll: {
    maxHeight: 180,
  },
  plantsContent: {
    gap: Spacing.one * 1.5,
  },
  plantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two * 1.5,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: Spacing.two,
  },
  plantIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plantTextContainer: {
    flex: 1,
  },
  plantName: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'System',
  },
  plantSubtext: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
    fontFamily: 'System',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    fontFamily: 'System',
  },
  noPlantsText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: Spacing.one,
  },
});
