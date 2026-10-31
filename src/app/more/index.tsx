import { AppHeader } from '@/components/ui/app-header';
import { Colors } from '@/constants/theme';
import { RootState } from '@/store/store';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

interface MoreMenuItem {
  id: string;
  step: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  lightBg: string;
  borderColor: string;
  route: string;
  tags: string[];
}

export default function MoreScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const router = useRouter();
  const { plant_name: plantName } = useSelector((state: RootState) => state.auth);

  const [searchQuery, setSearchQuery] = useState('');

  const menuItems: MoreMenuItem[] = useMemo(
    () => [
      {
        id: 'lead',
        step: 'STAGE 1 • CRM',
        stepNumber: 1,
        title: 'Lead Management',
        subtitle: 'Customer inquiries, site visit logs & pre-sales opportunity pipeline',
        icon: 'trending-up',
        color: '#D97706',
        lightBg: '#FEF3C7',
        borderColor: '#FDE68A',
        route: '/lead',
        tags: ['Site Visits', 'Inquiries', 'CRM Pipeline'],
      },
      {
        id: 'quotation',
        step: 'STAGE 2 • ESTIMATION',
        stepNumber: 2,
        title: 'Quotation & Pricing',
        subtitle: 'Concrete mix rate estimates, tax-inclusive pricing & approval flow',
        icon: 'receipt-outline',
        color: '#2563EB',
        lightBg: '#EFF6FF',
        borderColor: '#BFDBFE',
        route: '/quotation',
        tags: ['Mix Rates', 'Tax Inclusive', 'Approvals'],
      },
      {
        id: 'customer-po',
        step: 'STAGE 3 • PROCUREMENT',
        stepNumber: 3,
        title: 'Customer Purchase Orders',
        subtitle: 'Client PO verification, mix specifications, delivery terms & SO conversion',
        icon: 'document-text-outline',
        color: '#059669',
        lightBg: '#ECFDF5',
        borderColor: '#A7F3D0',
        route: '/customer-po',
        tags: ['PO Verification', 'Mix Specs', 'SO Conversion'],
      },
      {
        id: 'sales-order',
        step: 'STAGE 4 • FULFILLMENT',
        stepNumber: 4,
        title: 'Sales Orders',
        subtitle: 'Confirmed concrete bookings, concrete pump allocations & site limits',
        icon: 'cart-outline',
        color: '#0284C7',
        lightBg: '#F0F9FF',
        borderColor: '#BAE6FD',
        route: '/sales-order',
        tags: ['Pour Bookings', 'Pumping Limits', 'Dispatch Balance'],
      },
      {
        id: 'batching-schedule',
        step: 'STAGE 5 • PRODUCTION',
        stepNumber: 5,
        title: 'Batching & Schedule',
        subtitle: 'Plant batching queues, transit mixer dispatch & driver trip allocations',
        icon: 'time-outline',
        color: '#7C3AED',
        lightBg: '#F5F3FF',
        borderColor: '#DDD6FE',
        route: '/batching-schedule',
        tags: ['Transit Mixers', 'Pour Queues', 'Driver Schedules'],
      },
    ],
    [],
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;
    const q = searchQuery.toLowerCase().trim();
    return menuItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.step.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [searchQuery, menuItems]);

  const handleNavigate = (route: string) => {
    router.push(route as any);
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: '#0B2A4A' }]}
      edges={['top']}
    >
      <AppHeader
        title="More"
        backgroundColor="#0B2A4A"
        showMenu={true}
        showNotification={true}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: isDark ? '#090D16' : '#F8FAFC' }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Plant Overview & Workflow Hero Card */}
        <View style={styles.heroCard}>
          {/* Top Hero Pill Row */}
          <View style={styles.heroTopRow}>
            <View style={styles.plantBadge}>
              <Ionicons name="business" size={13} color="#60A5FA" />
              <Text style={styles.plantBadgeText} numberOfLines={1}>
                {plantName || 'Ready Mix Concrete Operations'}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Active Plant</Text>
            </View>
          </View>

          {/* Hero Title & Subtitle */}
          <Text style={styles.heroTitle}>Operations & Sales Suite</Text>
          <Text style={styles.heroSubtitle}>
            Commercial workflows from lead generation to transit mixer dispatch
          </Text>

          {/* Workflow Stage Steps Indicator */}
          <View style={styles.pipelineContainer}>
            <Text style={styles.pipelineLabel}>OPERATIONAL LIFECYCLE</Text>
            <View style={styles.pipelineRow}>
              {menuItems.map((item, idx) => (
                <React.Fragment key={item.id}>
                  <Pressable
                    style={styles.pipelineStep}
                    onPress={() => handleNavigate(item.route)}
                  >
                    <View
                      style={[
                        styles.pipelineCircle,
                        { backgroundColor: item.color + '26', borderColor: item.color },
                      ]}
                    >
                      <Ionicons name={item.icon} size={13} color={item.color} />
                    </View>
                    <Text
                      style={[styles.pipelineStepText, { color: '#E2E8F0' }]}
                      numberOfLines={1}
                    >
                      {item.id === 'batching-schedule'
                        ? 'Batch'
                        : item.id === 'customer-po'
                        ? 'Cust PO'
                        : item.title.split(' ')[0]}
                    </Text>
                  </Pressable>
                  {idx < menuItems.length - 1 && (
                    <View style={styles.pipelineLine}>
                      <Ionicons name="chevron-forward" size={12} color="#475569" />
                    </View>
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={isDark ? '#94A3B8' : '#64748B'}
            style={styles.searchIcon}
          />
          <TextInput
            style={[
              styles.searchInput,
              { color: isDark ? '#F8FAFC' : '#0F172A' },
            ]}
            placeholder="Search modules, features, or mix specs..."
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            AVAILABLE MODULES
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {filteredItems.length} of {menuItems.length} Services
            </Text>
          </View>
        </View>

        {/* Module Cards */}
        <View style={styles.cardsContainer}>
          {filteredItems.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.moduleCard,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                },
                pressed && {
                  opacity: 0.94,
                  transform: [{ scale: 0.985 }],
                },
              ]}
              onPress={() => handleNavigate(item.route)}
            >
              {/* Left Color Accent Stripe */}
              <View
                style={[styles.leftAccentStripe, { backgroundColor: item.color }]}
              />

              <View style={styles.cardMainContent}>
                {/* Top Row: Icon + Step Badge + Title + Action Button */}
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.iconContainer,
                      {
                        backgroundColor: item.lightBg,
                        borderColor: item.borderColor,
                      },
                    ]}
                  >
                    <Ionicons name={item.icon} size={24} color={item.color} />
                  </View>

                  <View style={styles.cardTitleCol}>
                    <View
                      style={[
                        styles.stepBadge,
                        { backgroundColor: item.lightBg },
                      ]}
                    >
                      <Text
                        style={[styles.stepBadgeText, { color: item.color }]}
                      >
                        {item.step}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: isDark ? '#F8FAFC' : '#0F172A' },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                  </View>

                  {/* Circular Action Arrow */}
                  <View
                    style={[
                      styles.arrowContainer,
                      {
                        backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                        borderColor: isDark ? '#334155' : '#E2E8F0',
                      },
                    ]}
                  >
                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color={item.color}
                    />
                  </View>
                </View>

                {/* Subtitle / Description */}
                <Text
                  style={[
                    styles.cardSubtitle,
                    { color: isDark ? '#94A3B8' : '#475569' },
                  ]}
                  numberOfLines={2}
                >
                  {item.subtitle}
                </Text>

                {/* Feature Tags Strip */}
                <View style={styles.tagsRow}>
                  {item.tags.map((tag, tIdx) => (
                    <View
                      key={tIdx}
                      style={[
                        styles.tagPill,
                        {
                          backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
                          borderColor: isDark ? '#334155' : '#E2E8F0',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagPillText,
                          { color: isDark ? '#CBD5E1' : '#475569' },
                        ]}
                      >
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </Pressable>
          ))}

          {filteredItems.length === 0 && (
            <View style={styles.emptySearchBox}>
              <Ionicons name="search-outline" size={36} color="#94A3B8" />
              <Text style={styles.emptySearchTitle}>No Modules Found</Text>
              <Text style={styles.emptySearchSub}>
                No operational services match "{searchQuery}"
              </Text>
              <Pressable
                style={styles.resetSearchBtn}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.resetSearchBtnText}>Reset Search</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Operational System Footer */}
        <View style={styles.footerContainer}>
          <View style={styles.footerSyncRow}>
            <Ionicons name="checkmark-done-circle" size={16} color="#10B981" />
            <Text
              style={[
                styles.footerSyncText,
                { color: isDark ? '#64748B' : '#94A3B8' },
              ]}
            >
              All operational modules synchronized with plant server
            </Text>
          </View>
          <Text
            style={[
              styles.footerVersionText,
              { color: isDark ? '#475569' : '#CBD5E1' },
            ]}
          >
            OneModo RMC Enterprise Operations Suite
          </Text>
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
    padding: 16,
    paddingBottom: 110, // Clear floating bottom tab bar
    gap: 16,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#0B2A4A',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  plantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    flex: 1,
  },
  plantBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E0F2FE',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 16,
  },

  // Operational Lifecycle Pipeline
  pipelineContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pipelineLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#60A5FA',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pipelineStep: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  pipelineCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineStepText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  pipelineLine: {
    paddingHorizontal: 1,
    opacity: 0.7,
  },

  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 10,
  },
  clearSearchBtn: {
    padding: 4,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  countBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },

  // Module Cards
  cardsContainer: {
    gap: 12,
  },
  moduleCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  leftAccentStripe: {
    width: 5,
  },
  cardMainContent: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleCol: {
    flex: 1,
    gap: 2,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  stepBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  arrowContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardSubtitle: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagPillText: {
    fontSize: 10.5,
    fontWeight: '600',
  },

  // Empty State
  emptySearchBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  emptySearchSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  resetSearchBtn: {
    marginTop: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetSearchBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },

  // Footer
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  footerSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerSyncText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  footerVersionText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
