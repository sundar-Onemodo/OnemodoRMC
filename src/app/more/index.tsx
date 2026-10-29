import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { Colors, Spacing } from '@/constants/theme';
import { RootState } from '@/store/store';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

interface MoreMenuItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  route: string;
  badge: string;
  isActive: boolean;
}

export default function MoreScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const { plant_name: plantName } = useSelector((state: RootState) => state.auth);

  const menuItems: MoreMenuItem[] = [
    {
      id: 'quotation',
      title: 'Quotation',
      subtitle: 'Create, review and manage customer quotations',
      icon: 'receipt-long',
      color: '#2563EB',
      route: '/quotation',
      badge: 'Active',
      isActive: true,
    },
    {
      id: 'customer-po',
      title: 'Customer PO',
      subtitle: 'Purchase order verification, terms & tracking',
      icon: 'assignment',
      color: '#10B981',
      route: '/customer-po',
      badge: 'Coming Soon',
      isActive: false,
    },
    {
      id: 'lead',
      title: 'Lead',
      subtitle: 'Customer inquiries, site visits & CRM pipeline',
      icon: 'trending-up',
      color: '#F59E0B',
      route: '/lead',
      badge: 'Coming Soon',
      isActive: false,
    },
    {
      id: 'batching-schedule',
      title: 'Batching / Schedule',
      subtitle: 'Plant batching queues, schedules & truck mix allocations',
      icon: 'precision-manufacturing',
      color: '#8B5CF6',
      route: '/batching-schedule',
      badge: 'Coming Soon',
      isActive: false,
    },
    {
      id: 'sales-order',
      title: 'Sales Order',
      subtitle: 'Confirmed bookings, delivery authorizations & fulfillment',
      icon: 'local-shipping',
      color: '#06B6D4',
      route: '/sales-order',
      badge: 'Coming Soon',
      isActive: false,
    },
  ];

  const handleNavigate = (route: string) => {
    router.push(route as any);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.headerBgColor }]} edges={['top']}>
      <AppHeader title={plantName || 'RMC Plant Operations'} showMenu={true} />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hub Header Card */}
        <Card style={styles.hubHeaderCard} variant="low">
          <View style={styles.hubHeaderRow}>
            <View style={[styles.hubIconBg, { backgroundColor: colors.primary + '18' }]}>
              <MaterialIcons name="apps" size={26} color={colors.primary} />
            </View>
            <View style={styles.hubHeaderTextContainer}>
              <Text style={[styles.hubTitle, { color: colors.text }]}>Operations & Sales Hub</Text>
              <Text style={[styles.hubSubtitle, { color: colors.textSecondary }]}>
                Extended tools for quotations, procurement & production
              </Text>
            </View>
          </View>
        </Card>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>AVAILABLE MODULES</Text>
          <Text style={[styles.sectionCount, { color: colors.primary }]}>{menuItems.length} Services</Text>
        </View>

        {/* Module Cards */}
        <View style={styles.cardsContainer}>
          {menuItems.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.moduleCard,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant + '2E',
                },
                pressed && {
                  opacity: 0.88,
                  transform: [{ scale: 0.99 }],
                },
              ]}
              onPress={() => handleNavigate(item.route)}
            >
              <View style={[styles.iconContainer, { backgroundColor: item.color + '1A' }]}>
                <MaterialIcons name={item.icon} size={28} color={item.color} />
              </View>

              <View style={styles.contentContainer}>
                <View style={styles.titleRow}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: item.isActive ? item.color + '18' : colors.outlineVariant + '33',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        {
                          color: item.isActive ? item.color : colors.textSecondary,
                        },
                      ]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              </View>

              <View style={styles.arrowContainer}>
                <MaterialIcons name="chevron-right" size={24} color={colors.outline} />
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: 110, // Ensure space for bottom floating tab bar
    gap: Spacing.three,
  },
  hubHeaderCard: {
    padding: Spacing.two * 1.5,
    borderRadius: 16,
  },
  hubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  hubIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubHeaderTextContainer: {
    flex: 1,
  },
  hubTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'System',
  },
  hubSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'System',
    lineHeight: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    marginTop: Spacing.one,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'System',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'System',
  },
  cardsContainer: {
    gap: Spacing.two,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two * 1.4,
    borderRadius: 16,
    borderWidth: 1,
    gap: Spacing.two * 1.2,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'System',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    fontFamily: 'System',
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'System',
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
