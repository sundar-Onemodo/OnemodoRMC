import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { useDispatch, useSelector } from 'react-redux';

import { baseURL } from '@/components/baseUrl/baseUrlAPI';
import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { updateUser } from '@/store/authSlice';
import { RootState } from '@/store/store';

const formatLastLogin = (dateString?: string | null) => {
  if (!dateString) return 'Never';
  try {
    const d = new Date(dateString);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateString;
  }
};

const hasProfilePhoto = (url?: string | null) => {
  if (!url) return false;
  if (url.includes('ui-avatars.com')) return false;
  return true;
};

export default function ProfileScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { logout } = useAuth();
  const dispatch = useDispatch();

  const { token, user } = useSelector((state: RootState) => state.auth);

  const [apiUser, setApiUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchUserProfile();
  }, [token]);

  const fetchUserProfile = async (isSilent = false) => {
    if (!token) return;
    try {
      if (!isSilent) setIsLoading(true);
      const trimToken = token.includes('|') ? token.split("|")[1] : token;
      const res = await axios.get(`${baseURL}/user`, {
        headers: {
          Authorization: `Bearer ${trimToken}`,
          Accept: 'application/json',
        }
      });
      if (res.data && res.data.success) {
        setApiUser(res.data.data);
        dispatch(updateUser({
          username: res.data.data.username,
          email: res.data.data.email,
          profile_photo_url: res.data.data.profile_photo_url,
          mobile: res.data.data.mobile
        }));
      }
    } catch (err: any) {
      console.log("Error fetching user profile:", err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please grant gallery permissions to change the profile photo.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSaveChanges = async () => {
    if (!editUsername.trim()) {
      Alert.alert("Validation Error", "Name / Username cannot be empty.");
      return;
    }
    if (!editEmail.trim()) {
      Alert.alert("Validation Error", "Email cannot be empty.");
      return;
    }

    if (!token) {
      Alert.alert("Error", "Authentication token is missing. Please log in again.");
      return;
    }

    try {
      setIsSaving(true);
      const trimToken = token.includes('|') ? token.split("|")[1] : token;
      const userId = apiUser?.id || user?.id || 5;

      const formData = new FormData();
      formData.append('username', editUsername.trim());
      formData.append('email', editEmail.trim());
      formData.append('_method', 'PUT');

      if (selectedImage) {
        const filename = selectedImage.split('/').pop() || 'profile.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        formData.append('profile_photo_path', {
          uri: selectedImage,
          name: filename,
          type: type,
        } as any);
      }

      const res = await axios.post(`${baseURL}/users/${userId}`, formData, {
        headers: {
          Authorization: `Bearer ${trimToken}`,
          Accept: 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data) {
        Alert.alert("Success", "Profile updated successfully.");
        const updatedUser = res.data.user || res.data.data;
        if (updatedUser) {
          setApiUser(updatedUser);
          dispatch(updateUser({
            username: updatedUser.username,
            email: updatedUser.email,
            profile_photo_url: updatedUser.profile_photo_url,
            mobile: updatedUser.mobile
          }));
        } else {
          await fetchUserProfile(true);
        }
        setIsEditing(false);
      }
    } catch (err: any) {
      console.log("Error updating user:", err?.response?.data || err.message);
      const errMsg = err?.response?.data?.message || "Failed to update profile. Please try again.";
      Alert.alert("Error", errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const menuOptions = [
    {
      title: 'Edit Profile',
      subtitle: 'Personal information & display preferences',
      icon: 'person-outline',
      color: colors.primary,
      bgColor: colors.primary + '15',
      onPress: () => {
        setEditUsername(apiUser?.username || user?.name || '');
        setEditEmail(apiUser?.email || user?.email || '');
        setSelectedImage(null);
        setIsEditing(true);
      }
    },
    {
      title: 'Company Details',
      subtitle: 'Tax ID, HQ Address, & Operations',
      icon: 'business',
      color: colors.secondary,
      bgColor: colors.secondary + '15',
    },
    {
      title: 'Settings',
      subtitle: 'Notification alerts, Security, & Language',
      icon: 'settings',
      color: colors.onSurfaceVariant,
      bgColor: colors.outlineVariant + '33',
    },
    {
      title: 'Logout',
      subtitle: 'Sign out of your account securely',
      icon: 'logout',
      color: colors.error,
      bgColor: colors.error + '15',
      isLogout: true,
    },
  ];

  if (isLoading && !apiUser) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.headerBgColor }]} edges={['top']}>
        <AppHeader title="Profile" showNotification={false} />
        <View style={[styles.contentContainer, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isEditing) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.headerBgColor }]} edges={['top']}>
        <AppHeader 
          title="Edit Profile" 
          showNotification={false} 
          onBackPress={() => setIsEditing(false)} 
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: colors.headerBgColor }}
        >
          <ScrollView 
            style={[styles.contentContainer, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
          >
            <Card style={styles.profileHeaderCard} variant="lowest">
              <View style={[styles.glowBar, { backgroundColor: colors.primary }]} />
              
              <Pressable onPress={handlePickImage} style={styles.avatarContainer}>
                <View style={[styles.avatarBorder, { borderColor: colors.surfaceContainerHigh, backgroundColor: colors.surfaceContainer }]}>
                  {selectedImage || hasProfilePhoto(apiUser?.profile_photo_url || user?.profile_photo_url) ? (
                    <Image
                      style={styles.avatarImage}
                      source={{
                        uri: selectedImage || apiUser?.profile_photo_url || user?.profile_photo_url || '',
                      }}
                    />
                  ) : (
                    <MaterialIcons name="person" size={64} color={colors.outline} />
                  )}
                </View>
                <View style={[styles.editBadge, { backgroundColor: colors.primaryContainer }]}>
                  <MaterialIcons name="camera-alt" size={14} color="#ffffff" />
                </View>
              </Pressable>
              
              <Text style={[styles.profileName, { color: colors.text }]}>
                {editUsername || "Edit Details"}
              </Text>
              <Text style={[styles.profileRole, { color: colors.textSecondary, backgroundColor: colors.surfaceContainer }]}>
                Tap avatar to change photo
              </Text>
            </Card>

            <Card style={styles.formCard} variant="lowest">
              <Text style={[styles.formTitle, { color: colors.text }]}>Edit Personal Details</Text>

              {/* Username Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>NAME / USERNAME</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '33' },
                  ]}
                >
                  <MaterialIcons name="person-outline" size={20} color={colors.outline} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Enter name"
                    placeholderTextColor={colors.outlineVariant}
                    value={editUsername}
                    onChangeText={setEditUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>EMAIL ADDRESS</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '33' },
                  ]}
                >
                  <MaterialIcons name="mail-outline" size={20} color={colors.outline} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Enter email"
                    placeholderTextColor={colors.outlineVariant}
                    value={editEmail}
                    onChangeText={setEditEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Buttons */}
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => setIsEditing(false)}
                  disabled={isSaving}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    { borderColor: colors.outlineVariant },
                    pressed && { backgroundColor: colors.surfaceContainerLow }
                  ]}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveChanges}
                  disabled={isSaving}
                  style={({ pressed }) => [
                    styles.saveButton,
                    { backgroundColor: colors.primary },
                    pressed && { opacity: 0.8 },
                    isSaving && { opacity: 0.6 }
                  ]}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </Pressable>
              </View>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.headerBgColor }]} edges={['top']}>
      <AppHeader title="Profile" showNotification={false} />
      
      <ScrollView 
        style={[styles.contentContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card Header */}
        <Card style={styles.profileHeaderCard} variant="lowest">
          <View style={[styles.glowBar, { backgroundColor: colors.primary }]} />
          
          <View style={styles.avatarContainer}>
            <View style={[styles.avatarBorder, { borderColor: colors.surfaceContainerHigh, backgroundColor: colors.surfaceContainer }]}>
              {hasProfilePhoto(apiUser?.profile_photo_url || user?.profile_photo_url) ? (
                <Image
                  style={styles.avatarImage}
                  source={{
                    uri: apiUser?.profile_photo_url || user?.profile_photo_url || '',
                  }}
                />
              ) : (
                <MaterialIcons name="person" size={64} color={colors.outline} />
              )}
            </View>
            <Pressable 
              onPress={() => {
                setEditUsername(apiUser?.username || user?.name || '');
                setEditEmail(apiUser?.email || user?.email || '');
                setSelectedImage(null);
                setIsEditing(true);
              }}
              style={[styles.editBadge, { backgroundColor: colors.primaryContainer }]}
            >
              <MaterialIcons name="edit" size={14} color="#ffffff" />
            </Pressable>
          </View>

          <Text style={[styles.profileName, { color: colors.text }]}>
            {apiUser?.username || user?.name || "Sundar"}
          </Text>
          <Text style={[styles.profileRole, { color: colors.textSecondary, backgroundColor: colors.surfaceContainer }]}>
            {apiUser?.email || user?.email || "kiran@onemodo.com"}
          </Text>

          {/* Quick Stats Row */}
          <View style={[styles.statsRow, { borderTopColor: colors.outlineVariant + '33' }]}>
            <View style={styles.statCol}>
              <Text style={[styles.statValue, { color: colors.primary }]}>124</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trucks</Text>
            </View>
            <View style={[styles.statCol, styles.statBorder, { borderLeftColor: colors.outlineVariant + '33', borderRightColor: colors.outlineVariant + '33' }]}>
              <Text style={[styles.statValue, { color: colors.secondary }]}>1.2k</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Clients</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statValue, { color: colors.tertiary }]}>98%</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>On Time</Text>
            </View>
          </View>
        </Card>

        {/* Options List */}
        <Card style={styles.optionsCard} variant="lowest">
          <View style={styles.optionsList}>
            {menuOptions.map((opt, i) => (
              <Pressable
                key={i}
                onPress={opt.onPress || (opt.isLogout ? logout : undefined)}
                style={({ pressed }) => [
                  styles.optionItem,
                  i < menuOptions.length - 1 && { borderBottomColor: colors.outlineVariant + '15' },
                  pressed && { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.optionIconWrapper, { backgroundColor: opt.bgColor }]}>
                    <MaterialIcons name={opt.icon as any} size={20} color={opt.color} />
                  </View>
                  <View>
                    <Text style={[styles.optionTitle, opt.isLogout ? { color: colors.error, fontWeight: '700' } : { color: colors.text }]}>
                      {opt.title}
                    </Text>
                    <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]}>
                      {opt.subtitle}
                    </Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={opt.isLogout ? colors.error + '66' : colors.outlineVariant} />
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Asymmetric Info Grid */}
        <View style={styles.bentoRow}>
          <Card style={[styles.bentoCard, { backgroundColor: colors.primaryContainer }]} variant="lowest">
            <View style={styles.bentoCardContent}>
              <Text style={styles.bentoCardTitle}>Enterprise Plan</Text>
              <Text style={styles.bentoCardSubtitle}>Status: Active</Text>
              <Pressable style={styles.bentoActionBtn}>
                <Text style={[styles.bentoActionText, { color: colors.primary }]}>Manage Plan</Text>
              </Pressable>
            </View>
            <MaterialIcons name="verified" size={80} color="#ffffff" style={styles.bentoBgIcon} />
          </Card>

          <Card style={styles.bentoCard} variant="lowest">
            <Text style={[styles.bentoTitleDark, { color: colors.text }]}>Security</Text>
            <View style={styles.securityRow}>
              <View style={styles.securityDot} />
              <Text style={[styles.securityLabel, { color: colors.text }]}>
                {apiUser?.is_active ? "Account Active" : "Status: Inactive"}
              </Text>
            </View>
            <Text style={[styles.securityFootnote, { color: colors.textSecondary }]}>
              Last login: {formatLastLogin(apiUser?.last_login || user?.last_login)} from {apiUser?.login_location || "Unknown Location"}
            </Text>
          </Card>
        </View>

        {/* Version Info */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.outline }]}>App Version 4.2.0-stable</Text>
          <Text style={[styles.footerText, { color: colors.outline }]}>© 2024 Logistics Manager Pro</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: 24, // Added breathing room under rounded corners
    paddingBottom: 100, // Account for bottom tab bar
    gap: Spacing.sectionGap,
  },
  profileHeaderCard: {
    marginTop: Spacing.stackGap,
    alignItems: 'center',
    paddingTop: Spacing.four,
    position: 'relative',
    overflow: 'hidden',
  },
  glowBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.two,
  },
  avatarBorder: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
    resizeMode: 'cover',
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'System',
  },
  profileRole: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
    fontFamily: 'System',
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'System',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'System',
  },
  optionsCard: {
    padding: 0, // Options will have internal paddings
    overflow: 'hidden',
  },
  optionsList: {
    width: '100%',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.cardPadding,
    borderBottomWidth: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  optionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'System',
  },
  optionSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'System',
  },
  bentoRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bentoCard: {
    flex: 1,
    padding: Spacing.cardPadding,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 128,
  },
  bentoCardContent: {
    zIndex: 10,
    gap: 4,
  },
  bentoCardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  bentoCardSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontFamily: 'System',
  },
  bentoActionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one * 1.5,
    borderRadius: 12,
    marginTop: Spacing.two,
  },
  bentoActionText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'System',
  },
  bentoBgIcon: {
    position: 'absolute',
    bottom: -15,
    right: -15,
    opacity: 0.1,
    transform: [{ rotate: '12deg' }],
  },
  bentoTitleDark: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
    marginBottom: Spacing.two,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  securityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  securityLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'System',
  },
  securityFootnote: {
    fontSize: 10,
    marginTop: Spacing.three,
    fontFamily: 'System',
  },
  footer: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.two,
  },
  footerText: {
    fontSize: 11,
    fontFamily: 'System',
  },
  formCard: {
    padding: Spacing.cardPadding,
    gap: Spacing.four,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
    marginBottom: Spacing.one,
  },
  inputGroup: {
    gap: Spacing.one * 1.5,
    marginBottom: Spacing.three,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: Spacing.two,
  },
  inputIcon: {
    marginRight: Spacing.two,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    padding: 0,
    fontFamily: 'System',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'System',
  },
  saveButton: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'System',
  },
});