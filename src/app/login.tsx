import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Colors, Spacing } from '@/constants/theme';
import { loginUser, resetRmcAuth } from '@/store/authSlice';
import { RootState, AppDispatch } from '@/store/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const {isLoading, isError, errorMessage, token} = useSelector(
    (state: RootState) => state.auth
  )
  const dispatch = useDispatch<AppDispatch>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(()=>{
      setTimeout(()=>{
        emailInputRef.current?.focus();
      }, 500)
    },[])
  );

  useEffect(()=> {
    const loadSavedData = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem("savedRmcEmail")
        if(savedEmail){
          setEmail(savedEmail);
        }
      } catch (e) {
        console.log("failed to load saved data", e);
      }
    }
    loadSavedData();
  }, [])

  useEffect(()=>{
    if(token) {
      onLogin();
    }

    if(isError && errorMessage) {
      Alert.alert("Login Failed", errorMessage, [
        {
          text: "OK",
          onPress: () => dispatch(resetRmcAuth()),
        },
      ]);
    }
  },[token, isError, errorMessage])

  const handleEmailChange = (text: string) => {
    const cleanedText = text.replace(/\s/g, "");
    setEmail(cleanedText);    
  }

  const isFormValid = () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if(!trimmedEmail || !trimmedPassword) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(trimmedEmail);
  }

  const handleSignIn = async() => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if(!trimmedEmail || !trimmedPassword) {
      Alert.alert("Validation", "Please enter both email and password.");
      return;
    }

    try{
      await dispatch(
        loginUser({email: trimmedEmail, password: trimmedPassword}),
      );
      await AsyncStorage.setItem("savedRmcEmail", trimmedEmail)
    } catch (error) {
      console.log("Error", error)
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerSection}>
          <View style={[styles.logoBg, { backgroundColor: colors.primaryContainer }]}>
            <MaterialIcons name="local-shipping" size={32} color="#ffffff" />
          </View>
          <Text style={[styles.brandTitle, { color: colors.primary }]}>Onemodo RMC</Text>
          <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
            Sign in to manage your sales
          </Text>
        </View>

        <Card style={styles.formCard} variant="lowest">
          <Text style={[styles.formTitle, { color: colors.text }]}>Welcome Back</Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.errorContainer }]}>
              <MaterialIcons name="error-outline" size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {/* Email input */}
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
                ref={emailInputRef}
                style={[styles.input, { color: colors.text }]}
                placeholder="sundar@precision.com"
                placeholderTextColor={colors.outlineVariant}
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={()=>passwordInputRef.current?.focus()}
              />
            </View>
          </View>

          {/* Password input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>PASSWORD</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '33' },
              ]}
            >
              <MaterialIcons name="lock-outline" size={20} color={colors.outline} style={styles.inputIcon} />
              <TextInput
                ref={passwordInputRef}
                style={[styles.input, { color: colors.text }]}
                placeholder="••••••••"
                placeholderTextColor={colors.outlineVariant}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <MaterialIcons
                  name={showPassword ? 'visibility' : 'visibility-off'}
                  size={20}
                  color={colors.outline}
                />
              </Pressable>
            </View>
          </View>

          {/* Remember Me and Forgot Password */}
          <View style={styles.row}>
            <Pressable onPress={() => setRememberMe(!rememberMe)} style={styles.checkboxContainer}>
              <View
                style={[
                  styles.checkbox,
                  { borderColor: colors.outline },
                  rememberMe && { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
                ]}
              >
                {rememberMe && <MaterialIcons name="check" size={14} color="#ffffff" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: colors.textSecondary }]}>Remember me</Text>
            </Pressable>

            <Pressable>
              <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
            </Pressable>
          </View>

          {/* Sign In Button */}
          <Button title="Sign In" onPress={handleSignIn} variant="primary" style={styles.signInButton} />
        </Card>

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.outline }]}>Secure Enterprise Connection</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

    <Modal transparent={true} animationType="fade" visible={isLoading}>
      <View style= {styles.modalContainer}>
        <View style={styles.modalContent}>
              <ActivityIndicator size="large" color={"#DC2626"}/>
              <Text style={[styles.modalText, {color:'#ccc'}]}>
                Verifying RMC account...
              </Text>
        </View>
      </View>
    </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.six,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: Spacing.four * 1.5,
    gap: Spacing.two,
  },
  logoBg: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'System',
  },
  brandSubtitle: {
    fontSize: 14,
    fontFamily: 'System',
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    gap: Spacing.four,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'System',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    gap: Spacing.two,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'System',
    flex: 1,
  },
  inputGroup: {
    gap: Spacing.one * 1.5,
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
    borderRadius: 8,
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
  eyeIcon: {
    padding: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 13,
    fontFamily: 'System',
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'System',
  },
  signInButton: {
    width: '100%',
    marginTop: Spacing.two,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.six,
  },
  footerText: {
    fontSize: 11,
    fontFamily: 'System',
  },
  modalContainer: {
    flex:1,
    justifyContent:"center",
    alignItems: "center",
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalContent: {
    padding: 32,
    borderRadius: 24,
    alignItems:'center',
    minWidth: 200
  },
  modalText: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: 16,
    textAlign: 'center',
    includeFontPadding: false
  }
});
