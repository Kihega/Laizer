#!/usr/bin/env python3
"""
Laizer — Patch Script 14: Complete UI Overhaul (7 changes)
===========================================================
Run from the ROOT of your repository:

    python apply_ui_overhaul.py

Changes covered
───────────────
1. login.tsx    Worker tab: Centre ID → STN-XX format, "Enter Centre" → "Login"
                Owner tab: 2-step registration (Step1: info → Step2: password+photo)
                Phone field accepts 06..., +255..., 0712... etc.
                Password strength indicator + show/hide toggle
                Profile photo: pick from gallery OR take with camera

2. dashboard.tsx  Remove logout icon → hamburger menu (left sidebar)
                  Greeting → profile card (Name, Brand, Date)
                  Sidebar: Change Mode (light/dark per user), Change Password modal, Logout

3. centres.tsx    Remove "Deactivate" text → trash icon + confirm alert
                  New Centre form: remove Centre No, keep Centre ID (STN-XX auto-generated)
                  All text inputs formatted to UPPERCASE

4. workers.tsx    Form: Full Name (caps) + Phone + Assign Centre (dropdown)
                  Remove NIM field
                  Backend assignment in one step

5. notices.tsx    Centre picker → dropdown with branch names
                  Remove Title input
                  Message: max 100 words with counter
                  Notification shown on targeted workers' screens

6. useTheme.ts    New hook: per-user light/dark mode stored in AsyncStorage

7. Backend        centres.js: auto-generate STN-XX centreId, remove centreNo from schema
                  workers.js: accept centreId for immediate assignment, remove nim
                  auth.js:    add password to register + /change-password/ endpoint

Install note: if not already installed:
  cd mobile && npx expo install expo-image-picker @react-native-async-storage/async-storage
"""

import json
from pathlib import Path

REPO    = Path(".")
MOBILE  = REPO / "mobile"
BACKEND = REPO / "backend"


# ── Helpers ───────────────────────────────────────────────────────────────────

def write_file(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"  [WRITTEN]  {path.relative_to(REPO)}")


def patch(path: Path, old: str, new: str, label: str):
    if not path.exists():
        print(f"  [MISSING]  {path.relative_to(REPO)}")
        return
    text = path.read_text(encoding="utf-8")
    if old not in text:
        print(f"  [SKIP]     {path.relative_to(REPO)} — '{label}'")
        return
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"  [PATCHED]  {path.relative_to(REPO)} — {label}")


def patch_json(path: Path, updates: dict):
    data = json.loads(path.read_text())
    changed = []
    for k, v in updates.items():
        if data.get("scripts", {}).get(k) != v:
            data.setdefault("scripts", {})[k] = v
            changed.append(k)
    if changed:
        path.write_text(json.dumps(data, indent=2) + "\n")
        print(f"  [PATCHED]  {path.relative_to(REPO)} scripts: {changed}")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. mobile/hooks/useTheme.ts  (NEW)
# ═══════════════════════════════════════════════════════════════════════════════

USE_THEME_TS = """\
// Laizer — Per-user theme hook (light / dark)
// Persists each user's preference in AsyncStorage keyed by their user ID.
// Changes only affect the currently signed-in user's session.
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/authStore';

export type AppTheme = 'light' | 'dark';

/** Colour tokens that flip with the theme */
export interface ThemeColors {
  bg:      string;
  card:    string;
  text:    string;
  textSec: string;
  border:  string;
  input:   string;
}

const LIGHT: ThemeColors = {
  bg:      '#F9FAFB',
  card:    '#FFFFFF',
  text:    '#111827',
  textSec: '#6B7280',
  border:  '#E5E7EB',
  input:   '#FFFFFF',
};
const DARK: ThemeColors = {
  bg:      '#111827',
  card:    '#1F2937',
  text:    '#F9FAFB',
  textSec: '#9CA3AF',
  border:  '#374151',
  input:   '#374151',
};

export function useTheme() {
  const { user } = useAuthStore();
  const storageKey = `theme:${user?.id ?? 'default'}`;
  const [theme, setThemeState] = useState<AppTheme>('light');

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then(v => { if (v === 'light' || v === 'dark') setThemeState(v); })
      .catch(() => {});
  }, [storageKey]);

  const setTheme = useCallback(async (t: AppTheme) => {
    setThemeState(t);
    try { await AsyncStorage.setItem(storageKey, t); } catch {}
  }, [storageKey]);

  return {
    theme,
    setTheme,
    isDark: theme === 'dark',
    tc: theme === 'dark' ? DARK : LIGHT,
  };
}
"""


# ═══════════════════════════════════════════════════════════════════════════════
# 2. mobile/app/(auth)/login.tsx  (FULL REWRITE)
# ═══════════════════════════════════════════════════════════════════════════════

LOGIN_TSX = """\
/**
 * Laizer — Login Screen
 * Worker tab : STN-XX Centre ID format, "Login" button
 * Owner tab  : 2-step registration (info → password + photo)
 */
import { useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker    from 'expo-image-picker';
import { LinearGradient }  from 'expo-linear-gradient';
import { Ionicons }        from '@expo/vector-icons';
import { useAuth }         from '@/hooks/useAuth';
import { Button, Input }   from '@/components/ui';
import { BrandColors, Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { apiClient }       from '@/services/api';
import { API_ROUTES }      from '@/constants/api';

type LoginMode = 'owner' | 'worker';
type RegStep   = 1 | 2;

interface S1 { fullName: string; brandName: string; phone: string; email: string; }
interface S2 { password: string; confirm: string; photo: string; showPw: boolean; showCf: boolean; }

function strength(pw: string) {
  if (!pw) return { label:'', color: Colors.border, score: 0 };
  let s = 0;
  if (pw.length >= 8)               s++;
  if (/[A-Z]/.test(pw))            s++;
  if (/[0-9]/.test(pw))            s++;
  if (/[^A-Za-z0-9]/.test(pw))     s++;
  const map = [
    { label:'Weak',   color: Colors.error   },
    { label:'Weak',   color: Colors.error   },
    { label:'Fair',   color: Colors.warning },
    { label:'Good',   color: Colors.accent  },
    { label:'Strong', color: Colors.success },
  ];
  return { ...map[s], score: s };
}

export default function LoginScreen() {
  const { ownerLogin, workerLogin, isLoading, error, clearError } = useAuth();
  const [mode,     setMode]     = useState<LoginMode>('owner');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [centreId, setCentreId] = useState('');
  const [showPw,   setShowPw]   = useState(false);

  const [showReg,  setShowReg]  = useState(false);
  const [step,     setStep]     = useState<RegStep>(1);
  const [regErr,   setRegErr]   = useState('');
  const [regOk,    setRegOk]    = useState(false);
  const [regBusy,  setRegBusy]  = useState(false);
  const [s1, setS1] = useState<S1>({ fullName:'', brandName:'', phone:'', email:'' });
  const [s2, setS2] = useState<S2>({ password:'', confirm:'', photo:'', showPw:false, showCf:false });

  const switchMode = (m: LoginMode) => { setMode(m); clearError(); };

  const handleLogin = async () => {
    clearError();
    if (mode === 'owner') {
      if (!email.trim() || !password.trim()) return;
      await ownerLogin(email, password);
    } else {
      if (!centreId.trim()) return;
      await workerLogin(centreId.toUpperCase());
    }
  };

  const openReg = () => {
    setS1({ fullName:'', brandName:'', phone:'', email:'' });
    setS2({ password:'', confirm:'', photo:'', showPw:false, showCf:false });
    setStep(1); setRegErr(''); setRegOk(false); setShowReg(true);
  };

  const goNext = () => {
    setRegErr('');
    if (!s1.fullName.trim())  return setRegErr('Full name is required.');
    if (!s1.brandName.trim()) return setRegErr('Stationery brand name is required.');
    if (!s1.phone.trim())     return setRegErr('Phone number is required.');
    if (s1.email.trim() && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(s1.email.trim()))
      return setRegErr('Enter a valid email address.');
    setStep(2);
  };

  const pickPhoto = async (src: 'gallery' | 'camera') => {
    const { status } = src === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', `Allow ${src} access in your device settings.`); return;
    }
    const result = src === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing:true, aspect:[1,1], quality:0.6 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing:true, aspect:[1,1], quality:0.6 });
    if (!result.canceled && result.assets[0]?.uri)
      setS2(p => ({ ...p, photo: result.assets[0].uri }));
  };

  const handleRegister = async () => {
    setRegErr('');
    if (!s2.password)            return setRegErr('Password is required.');
    if (s2.password.length < 8)  return setRegErr('Password must be at least 8 characters.');
    if (s2.password !== s2.confirm) return setRegErr('Passwords do not match.');
    setRegBusy(true);
    try {
      await apiClient.post(API_ROUTES.ownerRegister, {
        fullName:  s1.fullName.trim().toUpperCase(),
        brandName: s1.brandName.trim().toUpperCase(),
        phone:     s1.phone.trim(),
        ...(s1.email.trim() ? { email: s1.email.trim().toLowerCase() } : {}),
        password:  s2.password,
        ...(s2.photo ? { profilePicture: s2.photo } : {}),
      });
      setRegOk(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setRegErr(err?.response?.data?.detail ?? 'Registration failed. Please try again.');
    } finally { setRegBusy(false); }
  };

  const pw = strength(s2.password);

  return (
    <LinearGradient colors={[BrandColors.blueDark, BrandColors.blue, '#3B82F6']}
      start={{ x:0.1, y:0 }} end={{ x:0.9, y:1 }} style={L.gradient}>
      <KeyboardAvoidingView behavior={Platform.OS==='ios' ? 'padding' : undefined} style={L.kav}>
        <ScrollView contentContainerStyle={L.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Brand */}
          <View style={L.header}>
            <View style={L.decoRow}>
              <View style={[L.decoShape, L.decoSquare]} />
              <View style={[L.decoShape, L.decoPill]} />
              <View style={[L.decoShape, L.decoCircle]} />
              <View style={[L.decoShape, L.decoPill]} />
              <View style={[L.decoShape, L.decoSquare, { opacity:0.4 }]} />
            </View>
            <Text adjustsFontSizeToFit numberOfLines={1}>
              <Text style={L.wordL}>L</Text><Text style={L.wordR}>AIZER</Text>
            </Text>
            <View style={L.accentBar}>
              <View style={[L.accentSeg, { flex:4 }]} />
              <View style={[L.accentSeg, { flex:2, opacity:0.45 }]} />
              <View style={[L.accentSeg, { flex:1, opacity:0.2 }]} />
            </View>
            <Text style={L.tagline}>Stationery Management & Sales</Text>
          </View>

          {/* Login card */}
          <View style={L.card}>
            <View style={L.tabRow}>
              {(['owner','worker'] as LoginMode[]).map(m => (
                <TouchableOpacity key={m} style={[L.tab, mode===m && L.tabActive]}
                  onPress={() => switchMode(m)} activeOpacity={0.8}>
                  <Text style={[L.tabTxt, mode===m && L.tabTxtActive]}>
                    {m==='owner' ? '🏢  Owner' : '👤  Worker'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {error && <View style={L.errBanner}><Text style={L.errTxt}>⚠️  {error.message}</Text></View>}

            {mode==='owner' ? (
              <>
                <Input label="Email address" placeholder="owner@example.com"
                  value={email} onChangeText={(t:string) => { setEmail(t); clearError(); }}
                  keyboardType="email-address" autoCapitalize="none" returnKeyType="next" />
                <Input label="Password" placeholder="Enter your password"
                  value={password} onChangeText={(t:string) => { setPassword(t); clearError(); }}
                  secureTextEntry={!showPw} returnKeyType="done" onSubmitEditing={handleLogin}
                  rightIcon={<Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textDisabled} />}
                  onPressRightIcon={() => setShowPw(v => !v)} />
              </>
            ) : (
              <Input label="Centre ID" placeholder="STN-01"
                value={centreId} onChangeText={(t:string) => { setCentreId(t.toUpperCase()); clearError(); }}
                autoCapitalize="characters" returnKeyType="done" onSubmitEditing={handleLogin}
                hint="Your Centre ID is provided by the shop owner." />
            )}

            <Button label={mode==='owner' ? 'Sign In' : 'Login'} onPress={handleLogin}
              loading={isLoading} fullWidth size="lg" style={L.submitBtn} />

            {mode==='owner' && (
              <TouchableOpacity style={L.signUpRow} onPress={openReg} activeOpacity={0.75}>
                <Text style={L.signUpTxt}>{"Don't have an account?  "}<Text style={L.signUpLnk}>Sign Up</Text></Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Registration Modal ───────────────────────────────────── */}
      <Modal visible={showReg} animationType="slide" transparent onRequestClose={() => setShowReg(false)}>
        <View style={L.overlay}>
          <TouchableOpacity style={{ flex:1 }} activeOpacity={1} onPress={() => setShowReg(false)} />
          <KeyboardAvoidingView behavior={Platform.OS==='ios' ? 'padding' : undefined}>
            <View style={L.sheet}>
              <View style={L.handle} />

              {/* Sheet header */}
              <View style={L.sheetHdr}>
                <View>
                  <Text style={L.sheetTitle}>Create Owner Account</Text>
                  <Text style={L.sheetSub}>
                    {regOk ? 'All done!' : step===1 ? 'Step 1 of 2 — Business details' : 'Step 2 of 2 — Security & photo'}
                  </Text>
                </View>
                <View style={{ flexDirection:'row', alignItems:'center', gap:16 }}>
                  {step===2 && !regOk && (
                    <TouchableOpacity onPress={() => { setStep(1); setRegErr(''); }}>
                      <Ionicons name="arrow-back-outline" size={22} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setShowReg(false)} hitSlop={{ top:12, bottom:12, left:12, right:12 }}>
                    <Text style={L.closeX}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Step dots */}
              {!regOk && (
                <View style={L.stepRow}>
                  <View style={[L.stepDot, L.stepOn]} />
                  <View style={[L.stepLine, step===2 && L.stepLineDone]} />
                  <View style={[L.stepDot, step===2 && L.stepOn]} />
                </View>
              )}

              {regOk ? (
                <View style={L.successBox}>
                  <Text style={{ fontSize:52 }}>🎉</Text>
                  <Text style={L.successTitle}>Registration Complete!</Text>
                  <Text style={L.successMsg}>
                    Your account has been created. An admin will activate it within 24 hours.
                    You'll then be able to sign in with your email and password.
                  </Text>
                  <Button label="Done" onPress={() => setShowReg(false)} fullWidth size="md" style={{ marginTop:24 }} />
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {!!regErr && <View style={L.errBanner}><Text style={L.errTxt}>⚠️  {regErr}</Text></View>}

                  {step===1 ? (
                    /* Step 1 */
                    <>
                      <RF label="Full Name" req>
                        <TextInput style={L.fi} placeholder="JOHN MICHAEL DOE" placeholderTextColor={Colors.grey400}
                          value={s1.fullName} onChangeText={t => setS1(p => ({ ...p, fullName: t.toUpperCase() }))}
                          autoCapitalize="characters" returnKeyType="next" />
                      </RF>
                      <RF label="Stationery Brand Name" req>
                        <TextInput style={L.fi} placeholder="LAIZER SUPPLIES CO." placeholderTextColor={Colors.grey400}
                          value={s1.brandName} onChangeText={t => setS1(p => ({ ...p, brandName: t.toUpperCase() }))}
                          autoCapitalize="characters" returnKeyType="next" />
                      </RF>
                      <RF label="Phone Number" req>
                        <TextInput style={L.fi} placeholder="0712345678  or  +255712345678"
                          placeholderTextColor={Colors.grey400} value={s1.phone}
                          onChangeText={t => setS1(p => ({ ...p, phone: t }))}
                          keyboardType="phone-pad" returnKeyType="next" />
                      </RF>
                      <RF label="Email Address" hint="(optional)">
                        <TextInput style={L.fi} placeholder="you@example.com" placeholderTextColor={Colors.grey400}
                          value={s1.email} onChangeText={t => setS1(p => ({ ...p, email: t }))}
                          keyboardType="email-address" autoCapitalize="none" returnKeyType="done" />
                      </RF>
                      <Button label="Next  →" onPress={goNext} fullWidth size="lg" style={{ marginTop:8 }} />
                    </>
                  ) : (
                    /* Step 2 */
                    <>
                      {/* Profile picture */}
                      <Text style={L.fl}>Profile Picture <Text style={{ color:Colors.textDisabled, fontWeight:'400' }}>(optional)</Text></Text>
                      <View style={L.photoRow}>
                        <View style={L.photoCircle}>
                          {s2.photo
                            ? <Image source={{ uri: s2.photo }} style={L.photoImg} />
                            : <Ionicons name="person-outline" size={36} color={Colors.grey400} />}
                        </View>
                        <View style={{ flex:1, gap:8 }}>
                          <TouchableOpacity style={L.photoBtn} onPress={() => pickPhoto('gallery')}>
                            <Ionicons name="image-outline" size={16} color={Colors.primary} />
                            <Text style={L.photoBtnTxt}>Choose from Gallery</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={L.photoBtn} onPress={() => pickPhoto('camera')}>
                            <Ionicons name="camera-outline" size={16} color={Colors.primary} />
                            <Text style={L.photoBtnTxt}>Take a Photo</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Password */}
                      <RF label="Password" req>
                        <View style={L.pwRow}>
                          <TextInput style={[L.fi, { flex:1 }]} placeholder="Min. 8 characters"
                            placeholderTextColor={Colors.grey400} value={s2.password}
                            onChangeText={t => setS2(p => ({ ...p, password: t }))}
                            secureTextEntry={!s2.showPw} returnKeyType="next" />
                          <TouchableOpacity style={L.pwEye} onPress={() => setS2(p => ({ ...p, showPw: !p.showPw }))}>
                            <Ionicons name={s2.showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textDisabled} />
                          </TouchableOpacity>
                        </View>
                        {s2.password.length > 0 && (
                          <View style={L.strengthRow}>
                            {[1,2,3,4].map(i => (
                              <View key={i} style={[L.strengthBar, { backgroundColor: i<=pw.score ? pw.color : Colors.grey200 }]} />
                            ))}
                            <Text style={[L.strengthLbl, { color: pw.color }]}>{pw.label}</Text>
                          </View>
                        )}
                      </RF>

                      {/* Confirm password */}
                      <RF label="Confirm Password" req>
                        <View style={L.pwRow}>
                          <TextInput style={[L.fi, { flex:1 }]} placeholder="Repeat your password"
                            placeholderTextColor={Colors.grey400} value={s2.confirm}
                            onChangeText={t => setS2(p => ({ ...p, confirm: t }))}
                            secureTextEntry={!s2.showCf} returnKeyType="done" onSubmitEditing={handleRegister} />
                          <TouchableOpacity style={L.pwEye} onPress={() => setS2(p => ({ ...p, showCf: !p.showCf }))}>
                            <Ionicons name={s2.showCf ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textDisabled} />
                          </TouchableOpacity>
                        </View>
                        {s2.confirm.length > 0 && (
                          <Text style={{ fontSize:FontSize.xs, marginTop:4,
                            color: s2.password===s2.confirm ? Colors.success : Colors.error }}>
                            {s2.password===s2.confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
                          </Text>
                        )}
                      </RF>

                      <Button label="Register" onPress={handleRegister} loading={regBusy} fullWidth size="lg" style={{ marginTop:8 }} />
                      <Text style={L.disclaimer}>
                        Your registration will be reviewed and your account activated within 24 hours.
                      </Text>
                      <View style={{ height:24 }} />
                    </>
                  )}
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </LinearGradient>
  );
}

function RF({ label, req, hint, children }: { label:string; req?:boolean; hint?:string; children:React.ReactNode }) {
  return (
    <View style={L.field}>
      <Text style={L.fl}>
        {label}{req && <Text style={{ color:Colors.error }}> *</Text>}
        {hint && <Text style={{ color:Colors.textDisabled, fontWeight:'400' }}> {hint}</Text>}
      </Text>
      {children}
    </View>
  );
}

const L = StyleSheet.create({
  gradient: { flex:1 }, kav: { flex:1 },
  scroll:   { flexGrow:1, justifyContent:'center', padding:Spacing.xl, paddingTop:72, paddingBottom:Spacing.xl },
  header:   { alignItems:'center', marginBottom:Spacing['3xl'] },
  decoRow:  { flexDirection:'row', alignItems:'center', gap:6, marginBottom:Spacing.base },
  decoShape:{ backgroundColor:'rgba(255,255,255,0.85)' },
  decoSquare:{ width:10, height:10, borderRadius:2 },
  decoPill: { width:22, height:8, borderRadius:4 },
  decoCircle:{ width:12, height:12, borderRadius:6 },
  wordL:    { fontSize:60, fontWeight:'900', color:Colors.white, letterSpacing:2 },
  wordR:    { fontSize:52, fontWeight:'200', color:'rgba(255,255,255,0.88)', letterSpacing:8 },
  accentBar:{ flexDirection:'row', height:4, width:170, gap:4, marginTop:6, marginBottom:Spacing.md, borderRadius:2, overflow:'hidden' },
  accentSeg:{ backgroundColor:Colors.white, borderRadius:2 },
  tagline:  { fontSize:FontSize.sm, color:'rgba(255,255,255,0.72)', letterSpacing:0.8 },
  card:     { backgroundColor:Colors.white, borderRadius:Radius.xl, padding:Spacing.xl, elevation:12 },
  tabRow:   { flexDirection:'row', backgroundColor:Colors.grey100, borderRadius:Radius.md, padding:4, marginBottom:Spacing.xl },
  tab:      { flex:1, height:40, alignItems:'center', justifyContent:'center', borderRadius:Radius.sm },
  tabActive:{ backgroundColor:Colors.white, elevation:2 },
  tabTxt:   { fontSize:FontSize.sm, fontWeight:FontWeight.medium, color:Colors.textDisabled },
  tabTxtActive:{ color:Colors.primary, fontWeight:FontWeight.bold },
  errBanner:{ backgroundColor:Colors.errorSurface, borderRadius:Radius.md, padding:Spacing.md, marginBottom:Spacing.base, borderLeftWidth:3, borderLeftColor:Colors.error },
  errTxt:   { fontSize:FontSize.sm, color:Colors.error },
  submitBtn:{ marginTop:Spacing.sm },
  signUpRow:{ alignItems:'center', marginTop:Spacing.base, paddingVertical:Spacing.xs },
  signUpTxt:{ fontSize:FontSize.sm, color:Colors.textSecondary },
  signUpLnk:{ color:Colors.primary, fontWeight:FontWeight.bold },
  overlay:  { flex:1, backgroundColor:'rgba(0,0,0,0.48)', justifyContent:'flex-end' },
  sheet:    { backgroundColor:Colors.white, borderTopLeftRadius:28, borderTopRightRadius:28, paddingHorizontal:Spacing.xl, paddingBottom:40, paddingTop:12, maxHeight:'92%' },
  handle:   { width:44, height:4, borderRadius:2, backgroundColor:Colors.grey300, alignSelf:'center', marginBottom:Spacing.md },
  sheetHdr: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:Spacing.md },
  sheetTitle:{ fontSize:FontSize.xl, fontWeight:FontWeight.bold, color:Colors.textPrimary },
  sheetSub: { fontSize:FontSize.sm, color:Colors.textSecondary, marginTop:2 },
  closeX:   { fontSize:20, color:Colors.textDisabled },
  stepRow:  { flexDirection:'row', alignItems:'center', marginBottom:Spacing.xl },
  stepDot:  { width:12, height:12, borderRadius:6, backgroundColor:Colors.grey300 },
  stepOn:   { backgroundColor:Colors.primary },
  stepLine: { flex:1, height:2, backgroundColor:Colors.grey200, marginHorizontal:6 },
  stepLineDone:{ backgroundColor:Colors.primary },
  successBox:{ alignItems:'center', paddingVertical:Spacing['2xl'] },
  successTitle:{ fontSize:FontSize['2xl'], fontWeight:FontWeight.bold, color:Colors.textPrimary, marginTop:12, marginBottom:8 },
  successMsg:{ textAlign:'center', fontSize:FontSize.sm, color:Colors.textSecondary, lineHeight:22, paddingHorizontal:16 },
  field:    { marginBottom:Spacing.md },
  fl:       { fontSize:FontSize.sm, fontWeight:FontWeight.semiBold, color:Colors.textSecondary, marginBottom:Spacing.xs },
  fi:       { height:52, borderWidth:1.5, borderColor:Colors.border, borderRadius:Radius.md, paddingHorizontal:Spacing.base, fontSize:FontSize.base, color:Colors.textPrimary, backgroundColor:Colors.white },
  photoRow: { flexDirection:'row', gap:16, marginBottom:Spacing.md, alignItems:'center' },
  photoCircle:{ width:80, height:80, borderRadius:40, backgroundColor:Colors.grey100, alignItems:'center', justifyContent:'center', overflow:'hidden', borderWidth:1, borderColor:Colors.border },
  photoImg: { width:80, height:80 },
  photoBtn: { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:10, paddingHorizontal:14, borderRadius:Radius.md, borderWidth:1.5, borderColor:Colors.primary, backgroundColor:Colors.primarySurface },
  photoBtnTxt:{ fontSize:FontSize.sm, color:Colors.primary, fontWeight:FontWeight.medium },
  pwRow:    { flexDirection:'row', alignItems:'center' },
  pwEye:    { position:'absolute', right:14 },
  strengthRow:{ flexDirection:'row', alignItems:'center', gap:4, marginTop:6 },
  strengthBar:{ flex:1, height:4, borderRadius:2 },
  strengthLbl:{ fontSize:FontSize.xs, marginLeft:6, fontWeight:FontWeight.semiBold },
  disclaimer:{ textAlign:'center', fontSize:FontSize.xs, color:Colors.textDisabled, marginTop:Spacing.md, lineHeight:18 },
});
"""


# ═══════════════════════════════════════════════════════════════════════════════
# 3. mobile/app/(owner)/dashboard.tsx  (FULL REWRITE)
# ═══════════════════════════════════════════════════════════════════════════════

DASHBOARD_TSX = """\
/**
 * Laizer — Owner Dashboard
 * Profile card + hamburger sidebar (dark/light mode, change password, logout)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Modal, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter }      from 'expo-router';
import { useAuthStore }   from '@/store/authStore';
import { useAuth }        from '@/hooks/useAuth';
import { useTheme }       from '@/hooks/useTheme';
import { reportService, centreService, apiClient } from '@/services/api';
import { API_ROUTES }     from '@/constants/api';
import { Card }           from '@/components/ui';
import { BrandColors, Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

function fmt(n: number) {
  return `Tshs ${n.toLocaleString('en-TZ', { maximumFractionDigits:0 })}`;
}
function todayStr() {
  return new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

export default function OwnerDashboard() {
  const { user }                   = useAuthStore();
  const { logout }                 = useAuth();
  const { theme, setTheme, isDark, tc } = useTheme();
  const router                     = useRouter();

  const [report,     setReport]    = useState<any[]>([]);
  const [centres,    setCentres]   = useState<any[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefreshing]= useState(false);

  // Sidebar
  const [sideOpen, setSideOpen] = useState(false);
  const sideAnim = useRef(new Animated.Value(-280)).current;
  const openSide  = () => { setSideOpen(true);  Animated.spring(sideAnim, { toValue:0,   useNativeDriver:true }).start(); };
  const closeSide = () => { Animated.spring(sideAnim, { toValue:-280, useNativeDriver:true }).start(() => setSideOpen(false)); };

  // Change password modal
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current:'', next:'', confirm:'', showC:false, showN:false });
  const [pwBusy, setPwBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rpt, ctr] = await Promise.all([reportService.daily(), centreService.list()]);
      setReport(rpt.data); setCentres(ctr.data);
    } catch (e) { console.error('[Dashboard]', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const totalRevenue  = report.reduce((s, r) => s + (r.totalRevenueTshs ?? 0), 0);
  const totalEvents   = report.reduce((s, r) => s + (r.totalEvents ?? 0), 0);
  const activeCentres = centres.length;

  const handleChangePw = async () => {
    if (!pwForm.current)             return Alert.alert('Error', 'Enter your current password.');
    if (pwForm.next.length < 8)      return Alert.alert('Error', 'New password must be at least 8 characters.');
    if (pwForm.next !== pwForm.confirm) return Alert.alert('Error', 'Passwords do not match.');
    setPwBusy(true);
    try {
      await apiClient.patch(API_ROUTES.changePassword, {
        currentPassword: pwForm.current,
        newPassword:     pwForm.next,
      });
      Alert.alert('Success', 'Password changed successfully.');
      setShowPwModal(false);
      setPwForm({ current:'', next:'', confirm:'', showC:false, showN:false });
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail ?? 'Failed to change password.');
    } finally { setPwBusy(false); }
  };

  const brandName = user?.nim ?? 'Laizer Business';

  return (
    <View style={[S.root, { backgroundColor: tc.bg }]}>

      {/* Header gradient */}
      <LinearGradient colors={[BrandColors.blueDark, BrandColors.blue]}
        style={[S.header, isDark && { backgroundColor:'#111827' }]}>

        {/* Top row: hamburger | logout shortcut */}
        <View style={S.headerTop}>
          <TouchableOpacity onPress={openSide} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
            <Ionicons name="menu-outline" size={28} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { Alert.alert('Sign out', 'Are you sure?', [
            { text:'Cancel', style:'cancel' },
            { text:'Sign out', style:'destructive', onPress: logout },
          ]); }} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
            <Ionicons name="log-out-outline" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Profile card */}
        <View style={S.profileCard}>
          <View style={S.profileAvatar}>
            <Ionicons name="person" size={28} color={Colors.primary} />
          </View>
          <View style={{ flex:1 }}>
            <Text style={S.profileName} numberOfLines={1}>{user?.fullName ?? '—'}</Text>
            <Text style={S.profileBrand} numberOfLines={1}>{brandName}</Text>
            <Text style={S.profileDate}>{todayStr()}</Text>
          </View>
        </View>

        {/* Stat cards */}
        <View style={S.statsRow}>
          <StatCard label="Today's Revenue" value={fmt(totalRevenue)} icon="cash-outline" />
          <StatCard label="Services Logged"  value={String(totalEvents)}   icon="list-outline" />
          <StatCard label="Active Centres"   value={String(activeCentres)} icon="storefront-outline" />
        </View>
      </LinearGradient>

      {/* Body */}
      <ScrollView style={S.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator style={S.loader} color={Colors.primary} size="large" /> : (
          <>
            <Text style={[S.sectionTitle, { color: tc.text }]}>Quick Actions</Text>
            <View style={S.actions}>
              {[
                { label:'View Centres',   icon:'storefront-outline' as const, route:'/(owner)/centres'  },
                { label:'Manage Workers', icon:'people-outline'     as const, route:'/(owner)/workers'  },
                { label:'Daily Report',   icon:'bar-chart-outline'  as const, route:'/(owner)/reports'  },
                { label:'Send Notice',    icon:'megaphone-outline'  as const, route:'/(owner)/notices'  },
              ].map(a => (
                <Card key={a.route} onPress={() => router.push(a.route as any)}
                  style={[S.actionCard, { backgroundColor: tc.card }]}>
                  <Ionicons name={a.icon} size={32} color={Colors.primary} style={S.actionIcon} />
                  <Text style={[S.actionLabel, { color: tc.text }]}>{a.label}</Text>
                </Card>
              ))}
            </View>

            {report.length > 0 && (
              <>
                <Text style={[S.sectionTitle, { color: tc.text }]}>Today by Centre</Text>
                {report.map((r, i) => (
                  <Card key={i} style={[S.centreCard, { backgroundColor: tc.card }]}>
                    <View style={S.centreRow}>
                      <Text style={[S.centreName, { color: tc.text }]}>{r.centre?.name ?? '—'}</Text>
                      <Text style={S.centreNo}>{r.centre?.centreId}</Text>
                    </View>
                    <View style={S.centreStats}>
                      <Text style={S.centreRev}>{fmt(r.totalRevenueTshs)}</Text>
                      <Text style={[S.centreEvt, { color: tc.textSec }]}>{r.totalEvents} services</Text>
                    </View>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
        <View style={{ height:40 }} />
      </ScrollView>

      {/* ── Sidebar Drawer ──────────────────────────────────────── */}
      {sideOpen && (
        <TouchableOpacity style={S.sideOverlay} activeOpacity={1} onPress={closeSide} />
      )}
      {sideOpen && (
        <Animated.View style={[S.sidebar, { transform:[{ translateX: sideAnim }], backgroundColor: isDark ? '#1F2937' : Colors.white }]}>
          {/* User info at top */}
          <LinearGradient colors={[BrandColors.blueDark, BrandColors.blue]} style={S.sideHeader}>
            <View style={S.sideAvatar}>
              <Ionicons name="person" size={28} color={Colors.primary} />
            </View>
            <Text style={S.sideName} numberOfLines={1}>{user?.fullName ?? '—'}</Text>
            <Text style={S.sideBrand} numberOfLines={1}>{brandName}</Text>
          </LinearGradient>

          <View style={S.sideMenu}>
            {/* Dark / Light mode */}
            <View style={S.sideSection}>
              <Text style={[S.sideSectionTitle, { color: isDark ? Colors.grey400 : Colors.textDisabled }]}>APPEARANCE</Text>
              <View style={S.modeRow}>
                {(['light','dark'] as const).map(t => (
                  <TouchableOpacity key={t} style={[S.modeBtn, theme===t && S.modeBtnActive]}
                    onPress={() => setTheme(t)} activeOpacity={0.8}>
                    <Ionicons name={t==='light' ? 'sunny-outline' : 'moon-outline'} size={18}
                      color={theme===t ? Colors.white : (isDark ? Colors.grey300 : Colors.textSecondary)} />
                    <Text style={[S.modeBtnTxt, theme===t && S.modeBtnTxtActive]}>
                      {t.charAt(0).toUpperCase()+t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Change password */}
            <View style={S.sideSection}>
              <Text style={[S.sideSectionTitle, { color: isDark ? Colors.grey400 : Colors.textDisabled }]}>ACCOUNT</Text>
              <TouchableOpacity style={S.sideItem} onPress={() => { closeSide(); setTimeout(() => setShowPwModal(true), 350); }}>
                <Ionicons name="lock-closed-outline" size={20} color={isDark ? Colors.grey300 : Colors.textSecondary} />
                <Text style={[S.sideItemTxt, { color: isDark ? Colors.grey100 : Colors.textPrimary }]}>Change Password</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} style={{ marginLeft:'auto' }} />
              </TouchableOpacity>
            </View>

            {/* Logout */}
            <TouchableOpacity style={[S.sideItem, S.sideLogout]} onPress={() => {
              closeSide();
              setTimeout(() => Alert.alert('Sign out', 'Are you sure you want to sign out?', [
                { text:'Cancel', style:'cancel' },
                { text:'Sign out', style:'destructive', onPress: logout },
              ]), 350);
            }}>
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
              <Text style={[S.sideItemTxt, { color: Colors.error }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* ── Change Password Modal ─────────────────────────────── */}
      <Modal visible={showPwModal} animationType="fade" transparent onRequestClose={() => setShowPwModal(false)}>
        <View style={S.pwOverlay}>
          <View style={[S.pwModal, { backgroundColor: tc.card }]}>
            <Text style={[S.pwTitle, { color: tc.text }]}>Change Password</Text>

            {/* Current */}
            <View style={S.pwField}>
              <Text style={[S.pwLabel, { color: tc.textSec }]}>Current Password</Text>
              <View style={S.pwInputRow}>
                <TextInput style={[S.pwInput, { flex:1, color: tc.text, borderColor: tc.border, backgroundColor: tc.input }]}
                  secureTextEntry={!pwForm.showC} value={pwForm.current}
                  onChangeText={t => setPwForm(p => ({ ...p, current: t }))}
                  placeholder="Your current password" placeholderTextColor={Colors.grey400} />
                <TouchableOpacity style={S.pwEye} onPress={() => setPwForm(p => ({ ...p, showC: !p.showC }))}>
                  <Ionicons name={pwForm.showC ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textDisabled} />
                </TouchableOpacity>
              </View>
            </View>

            {/* New */}
            <View style={S.pwField}>
              <Text style={[S.pwLabel, { color: tc.textSec }]}>New Password</Text>
              <View style={S.pwInputRow}>
                <TextInput style={[S.pwInput, { flex:1, color: tc.text, borderColor: tc.border, backgroundColor: tc.input }]}
                  secureTextEntry={!pwForm.showN} value={pwForm.next}
                  onChangeText={t => setPwForm(p => ({ ...p, next: t }))}
                  placeholder="Min. 8 characters" placeholderTextColor={Colors.grey400} />
                <TouchableOpacity style={S.pwEye} onPress={() => setPwForm(p => ({ ...p, showN: !p.showN }))}>
                  <Ionicons name={pwForm.showN ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textDisabled} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm */}
            <View style={S.pwField}>
              <Text style={[S.pwLabel, { color: tc.textSec }]}>Confirm New Password</Text>
              <TextInput style={[S.pwInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.input }]}
                secureTextEntry value={pwForm.confirm}
                onChangeText={t => setPwForm(p => ({ ...p, confirm: t }))}
                placeholder="Repeat new password" placeholderTextColor={Colors.grey400} />
            </View>

            <View style={{ flexDirection:'row', gap:12, marginTop:8 }}>
              <TouchableOpacity style={[S.pwCancel, { borderColor: tc.border }]} onPress={() => setShowPwModal(false)}>
                <Text style={[S.pwCancelTxt, { color: tc.textSec }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.pwSave, pwBusy && { opacity:0.6 }]} onPress={handleChangePw} disabled={pwBusy}>
                <Text style={S.pwSaveTxt}>{pwBusy ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatCard({ label, value, icon }: { label:string; value:string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={SC.card}>
      <Ionicons name={icon} size={22} color="rgba(255,255,255,0.9)" style={{ marginBottom:4 }} />
      <Text style={SC.value}>{value}</Text>
      <Text style={SC.label}>{label}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  root:        { flex:1 },
  header:      { paddingTop:60, paddingHorizontal:Spacing.xl, paddingBottom:Spacing['2xl'] },
  headerTop:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:Spacing.md },
  profileCard: { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:Radius.lg, padding:Spacing.base, marginBottom:Spacing.xl },
  profileAvatar:{ width:54, height:54, borderRadius:27, backgroundColor:'rgba(255,255,255,0.9)', alignItems:'center', justifyContent:'center' },
  profileName: { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.white },
  profileBrand:{ fontSize:FontSize.sm, color:'rgba(255,255,255,0.8)', marginTop:1 },
  profileDate: { fontSize:FontSize.xs, color:'rgba(255,255,255,0.6)', marginTop:2 },
  statsRow:    { flexDirection:'row', gap:Spacing.sm },
  body:        { flex:1, padding:Spacing.xl },
  loader:      { marginTop:Spacing['3xl'] },
  sectionTitle:{ fontSize:FontSize.md, fontWeight:FontWeight.bold, marginBottom:Spacing.md, marginTop:Spacing.base },
  actions:     { flexDirection:'row', flexWrap:'wrap', gap:Spacing.md, marginBottom:Spacing.sm },
  actionCard:  { width:'47%', alignItems:'center', paddingVertical:Spacing.base },
  actionIcon:  { marginBottom:Spacing.xs },
  actionLabel: { fontSize:FontSize.sm, fontWeight:FontWeight.semiBold, textAlign:'center' },
  centreCard:  { marginBottom:Spacing.sm },
  centreRow:   { flexDirection:'row', justifyContent:'space-between', marginBottom:Spacing.xs },
  centreName:  { fontSize:FontSize.base, fontWeight:FontWeight.bold },
  centreNo:    { fontSize:FontSize.xs, color:Colors.textDisabled, backgroundColor:Colors.grey100, paddingHorizontal:6, paddingVertical:2, borderRadius:Radius.full },
  centreStats: { flexDirection:'row', justifyContent:'space-between' },
  centreRev:   { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.accent },
  centreEvt:   { fontSize:FontSize.sm },
  sideOverlay: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.45)', zIndex:10 },
  sidebar:     { position:'absolute', top:0, left:0, bottom:0, width:280, zIndex:11, elevation:20 },
  sideHeader:  { paddingTop:60, padding:Spacing.xl, alignItems:'center' },
  sideAvatar:  { width:68, height:68, borderRadius:34, backgroundColor:'rgba(255,255,255,0.9)', alignItems:'center', justifyContent:'center', marginBottom:10 },
  sideName:    { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.white },
  sideBrand:   { fontSize:FontSize.sm, color:'rgba(255,255,255,0.8)', marginTop:2 },
  sideMenu:    { flex:1, padding:Spacing.xl },
  sideSection: { marginBottom:Spacing.xl },
  sideSectionTitle:{ fontSize:10, fontWeight:FontWeight.bold, letterSpacing:1, marginBottom:Spacing.sm },
  modeRow:     { flexDirection:'row', gap:8 },
  modeBtn:     { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:10, borderRadius:Radius.md, borderWidth:1.5, borderColor:Colors.border },
  modeBtnActive:{ backgroundColor:Colors.primary, borderColor:Colors.primary },
  modeBtnTxt:  { fontSize:FontSize.sm, color:Colors.textSecondary, fontWeight:FontWeight.medium },
  modeBtnTxtActive:{ color:Colors.white, fontWeight:FontWeight.bold },
  sideItem:    { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12 },
  sideItemTxt: { fontSize:FontSize.base, fontWeight:FontWeight.medium },
  sideLogout:  { marginTop:'auto' },
  pwOverlay:   { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center', padding:Spacing.xl },
  pwModal:     { width:'100%', borderRadius:Radius.xl, padding:Spacing.xl, elevation:20 },
  pwTitle:     { fontSize:FontSize.xl, fontWeight:FontWeight.bold, marginBottom:Spacing.xl },
  pwField:     { marginBottom:Spacing.md },
  pwLabel:     { fontSize:FontSize.sm, fontWeight:FontWeight.semiBold, marginBottom:Spacing.xs },
  pwInputRow:  { flexDirection:'row', alignItems:'center' },
  pwInput:     { height:50, borderWidth:1.5, borderRadius:Radius.md, paddingHorizontal:Spacing.base, fontSize:FontSize.base },
  pwEye:       { position:'absolute', right:12 },
  pwCancel:    { flex:1, height:46, alignItems:'center', justifyContent:'center', borderRadius:Radius.md, borderWidth:1.5 },
  pwCancelTxt: { fontSize:FontSize.base, fontWeight:FontWeight.medium },
  pwSave:      { flex:1, height:46, alignItems:'center', justifyContent:'center', borderRadius:Radius.md, backgroundColor:Colors.primary },
  pwSaveTxt:   { fontSize:FontSize.base, fontWeight:FontWeight.bold, color:Colors.white },
});
const SC = StyleSheet.create({
  card:  { flex:1, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:Radius.md, padding:Spacing.md, alignItems:'center' },
  value: { fontSize:FontSize.lg, fontWeight:FontWeight.black, color:Colors.white },
  label: { fontSize:10, color:'rgba(255,255,255,0.7)', textAlign:'center', marginTop:2 },
});
"""


# ═══════════════════════════════════════════════════════════════════════════════
# 4. mobile/app/(owner)/centres.tsx  (FULL REWRITE)
# ═══════════════════════════════════════════════════════════════════════════════

CENTRES_TSX = """\
/**
 * Laizer — Owner: Centres
 * Centre ID auto-formatted STN-XX by backend.
 * Delete icon (trash) with confirm alert. All text inputs UPPERCASE.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons }        from '@expo/vector-icons';
import { centreService, getApiError } from '@/services/api';
import { Card, Button, Input, StatusBadge } from '@/components/ui';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

export default function CentresScreen() {
  const [centres,    setCentres]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form, setForm] = useState({ name:'', location:'' });

  const load = useCallback(async () => {
    try { const { data } = await centreService.list(); setCentres(data); }
    catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.location) {
      Alert.alert('Missing fields', 'Please fill in Centre name and location.'); return;
    }
    setSaving(true);
    try {
      await centreService.create({ name: form.name.toUpperCase(), location: form.location.toUpperCase() });
      setShowForm(false); setForm({ name:'', location:'' });
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  const confirmDelete = (item: any) => {
    Alert.alert(
      'Delete Centre',
      `Are you sure you want to permanently delete "${item.name}"?\\nWorkers will no longer be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await centreService.delete(item.id);
              await load();
            } catch (e) { Alert.alert('Error', getApiError(e)); }
          },
        },
      ],
    );
  };

  return (
    <View style={S.root}>
      <View style={S.header}>
        <Text style={S.title}>Centres</Text>
        <Button label="+ Add" size="sm" onPress={() => setShowForm(v => !v)} />
      </View>

      {showForm && (
        <Card style={S.form}>
          <Text style={S.formTitle}>New Centre</Text>
          {[
            { key:'name',     label:'Name',     placeholder:'ARUSHA BRANCH' },
            { key:'location', label:'Location', placeholder:'ARDHI UNIVERSITY' },
          ].map(f => (
            <Input key={f.key} label={f.label} placeholder={f.placeholder}
              value={(form as any)[f.key]}
              onChangeText={t => setForm(p => ({ ...p, [f.key]: t.toUpperCase() }))}
              autoCapitalize="characters"
            />
          ))}
          <Text style={S.centreIdNote}>
            ℹ️  Centre ID will be auto-assigned (e.g. STN-01)
          </Text>
          <View style={{ flexDirection:'row', gap:Spacing.sm, marginTop:Spacing.sm }}>
            <Button label="Cancel"  variant="secondary" onPress={() => setShowForm(false)} style={{ flex:1 }} />
            <Button label="Create"  onPress={handleCreate} loading={saving} style={{ flex:1 }} />
          </View>
        </Card>
      )}

      {loading ? <ActivityIndicator style={S.loader} color={Colors.primary} /> : (
        <FlatList
          data={centres}
          keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding:Spacing.base }}
          ListEmptyComponent={<Text style={S.empty}>No centres yet. Add your first one.</Text>}
          renderItem={({ item }) => (
            <Card style={S.item}>
              <View style={S.itemRow}>
                <View style={{ flex:1 }}>
                  <Text style={S.itemName}>{item.name}</Text>
                  <Text style={S.itemSub}>{item.location}</Text>
                  <Text style={S.itemId}>Login ID: {item.centreId}</Text>
                </View>
                <View style={S.itemRight}>
                  <StatusBadge type="active" size="sm" />
                  <Text style={S.workerCount}>{item._count?.assignments ?? 0} workers</Text>
                  <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root:        { flex:1, backgroundColor:Colors.background },
  header:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:Spacing.xl, paddingTop:60, backgroundColor:Colors.primary },
  title:       { fontSize:FontSize.xl, fontWeight:FontWeight.bold, color:Colors.white },
  form:        { margin:Spacing.base, padding:Spacing.base },
  formTitle:   { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.textPrimary, marginBottom:Spacing.md },
  centreIdNote:{ fontSize:FontSize.xs, color:Colors.textDisabled, marginTop:Spacing.xs, fontStyle:'italic' },
  loader:      { marginTop:60 },
  empty:       { textAlign:'center', color:Colors.textDisabled, padding:Spacing['3xl'] },
  item:        { marginBottom:Spacing.sm },
  itemRow:     { flexDirection:'row', justifyContent:'space-between' },
  itemName:    { fontSize:FontSize.base, fontWeight:FontWeight.bold, color:Colors.textPrimary },
  itemSub:     { fontSize:FontSize.sm, color:Colors.textSecondary, marginTop:2 },
  itemId:      { fontSize:FontSize.xs, color:Colors.primary, marginTop:4 },
  itemRight:   { alignItems:'flex-end', gap:Spacing.sm },
  workerCount: { fontSize:FontSize.xs, color:Colors.textDisabled },
});
"""


# ═══════════════════════════════════════════════════════════════════════════════
# 5. mobile/app/(owner)/workers.tsx  (FULL REWRITE)
# ═══════════════════════════════════════════════════════════════════════════════

WORKERS_TSX = """\
/**
 * Laizer — Owner: Workers
 * Form: Full Name (caps) + Phone + Assign Centre dropdown. No NIM.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { workerService, centreService, getApiError } from '@/services/api';
import { Card, Button, Input, StatusBadge } from '@/components/ui';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

export default function WorkersScreen() {
  const [workers,    setWorkers]    = useState<any[]>([]);
  const [centres,    setCentres]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form, setForm] = useState({ fullName:'', phone:'', centreId:'' });

  const load = useCallback(async () => {
    try {
      const [w, c] = await Promise.all([workerService.list(), centreService.list()]);
      setWorkers(w.data); setCentres(c.data);
      if (c.data.length > 0 && !form.centreId)
        setForm(p => ({ ...p, centreId: c.data[0].id }));
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleRegister = async () => {
    if (!form.fullName || !form.phone || !form.centreId) {
      Alert.alert('Missing fields', 'Please fill in all fields and select a centre.'); return;
    }
    setSaving(true);
    try {
      await workerService.register({
        fullName: form.fullName.toUpperCase(),
        phone:    form.phone,
        centreId: form.centreId,
      });
      setShowForm(false);
      setForm(p => ({ fullName:'', phone:'', centreId: p.centreId }));
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={W.root}>
      <View style={W.header}>
        <Text style={W.title}>Workers</Text>
        <Button label="+ Register" size="sm" onPress={() => setShowForm(v => !v)} />
      </View>

      {showForm && (
        <Card style={W.form}>
          <Text style={W.formTitle}>Register Worker</Text>

          <Input label="Full Name" placeholder="JOHN DOE"
            value={form.fullName}
            onChangeText={t => setForm(p => ({ ...p, fullName: t.toUpperCase() }))}
            autoCapitalize="characters" />

          <Input label="Phone" placeholder="+255 712 345 678"
            value={form.phone}
            onChangeText={t => setForm(p => ({ ...p, phone: t }))}
            keyboardType="phone-pad" />

          {/* Centre picker */}
          <Text style={W.fieldLabel}>Assign to Centre <Text style={{ color:Colors.error }}>*</Text></Text>
          {centres.length === 0
            ? <Text style={W.nocentre}>No centres yet. Add a centre first.</Text>
            : (
              <View style={W.centreList}>
                {centres.map(c => (
                  <TouchableOpacity key={c.id}
                    style={[W.centrePill, form.centreId===c.id && W.centrePillActive]}
                    onPress={() => setForm(p => ({ ...p, centreId: c.id }))}>
                    <Ionicons name="storefront-outline" size={14}
                      color={form.centreId===c.id ? Colors.white : Colors.textSecondary} />
                    <Text style={[W.centrePillTxt, form.centreId===c.id && W.centrePillTxtActive]}>
                      {c.name}
                    </Text>
                    <Text style={[W.centrePillId, form.centreId===c.id && { color:'rgba(255,255,255,0.7)' }]}>
                      {c.centreId}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

          <View style={{ flexDirection:'row', gap:Spacing.sm, marginTop:Spacing.sm }}>
            <Button label="Cancel"   variant="secondary" onPress={() => setShowForm(false)} style={{ flex:1 }} />
            <Button label="Register" onPress={handleRegister} loading={saving} style={{ flex:1 }} />
          </View>
        </Card>
      )}

      {loading ? <ActivityIndicator style={W.loader} color={Colors.primary} /> : (
        <FlatList
          data={workers}
          keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding:Spacing.base }}
          ListEmptyComponent={<Text style={W.empty}>No workers registered yet.</Text>}
          renderItem={({ item }) => (
            <Card style={W.item}>
              <View style={W.row}>
                <View style={{ flex:1 }}>
                  <Text style={W.name}>{item.fullName}</Text>
                  <Text style={W.sub}>{item.phone}</Text>
                  <Text style={W.centre}>
                    {item.assignedCentre ? `📍 ${item.assignedCentre.name}` : '⚠️  Unassigned'}
                  </Text>
                </View>
                <StatusBadge type={item.isActive ? 'active' : 'inactive'} size="sm" />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const W = StyleSheet.create({
  root:      { flex:1, backgroundColor:Colors.background },
  header:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:Spacing.xl, paddingTop:60, backgroundColor:Colors.primary },
  title:     { fontSize:FontSize.xl, fontWeight:FontWeight.bold, color:Colors.white },
  form:      { margin:Spacing.base },
  formTitle: { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.textPrimary, marginBottom:Spacing.md },
  fieldLabel:{ fontSize:FontSize.sm, fontWeight:FontWeight.semiBold, color:Colors.textSecondary, marginBottom:Spacing.xs },
  nocentre:  { fontSize:FontSize.sm, color:Colors.textDisabled, fontStyle:'italic', marginBottom:Spacing.md },
  centreList:{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:Spacing.md },
  centrePill:{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:Radius.md, borderWidth:1.5, borderColor:Colors.border, backgroundColor:Colors.grey100 },
  centrePillActive:{ backgroundColor:Colors.primary, borderColor:Colors.primary },
  centrePillTxt:{ fontSize:FontSize.sm, color:Colors.textSecondary, fontWeight:FontWeight.semiBold },
  centrePillTxtActive:{ color:Colors.white },
  centrePillId:{ fontSize:FontSize.xs, color:Colors.textDisabled },
  loader:    { marginTop:60 },
  empty:     { textAlign:'center', color:Colors.textDisabled, padding:Spacing['3xl'] },
  item:      { marginBottom:Spacing.sm },
  row:       { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' },
  name:      { fontSize:FontSize.base, fontWeight:FontWeight.bold, color:Colors.textPrimary },
  sub:       { fontSize:FontSize.xs, color:Colors.textSecondary, marginTop:2 },
  centre:    { fontSize:FontSize.xs, color:Colors.primary, marginTop:4 },
});
"""


# ═══════════════════════════════════════════════════════════════════════════════
# 6. mobile/app/(owner)/notices.tsx  (FULL REWRITE)
# ═══════════════════════════════════════════════════════════════════════════════

NOTICES_TSX = """\
/**
 * Laizer — Owner: Notices
 * Centre: dropdown by branch name. No title. Message: max 100 words.
 * Sent notices appear on targeted workers' screens only.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons }        from '@expo/vector-icons';
import { noticeService, centreService, getApiError } from '@/services/api';
import { Card, Button, Input, StatusBadge } from '@/components/ui';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

const PRIORITIES = ['normal', 'urgent', 'low'] as const;
const MAX_WORDS = 100;

function wordCount(txt: string) {
  return txt.trim().split(/\\s+/).filter(Boolean).length;
}

export default function NoticesOwnerScreen() {
  const [notices,    setNotices]    = useState<any[]>([]);
  const [centres,    setCentres]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [showDrop,   setShowDrop]   = useState(false);
  const [form, setForm] = useState({ centreId:'', body:'', priority:'normal' as string });

  const load = useCallback(async () => {
    try {
      const [n, c] = await Promise.all([noticeService.list(), centreService.list()]);
      setNotices(n.data); setCentres(c.data);
      if (c.data.length > 0) setForm(p => ({ ...p, centreId: c.data[0].id }));
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const selectedCentre = centres.find(c => c.id === form.centreId);
  const wc = wordCount(form.body);
  const overLimit = wc > MAX_WORDS;

  const handleSend = async () => {
    if (!form.centreId || !form.body.trim()) {
      Alert.alert('Missing fields', 'Please select a centre and write a message.'); return;
    }
    if (overLimit) {
      Alert.alert('Too long', `Message exceeds ${MAX_WORDS} words (${wc} words).`); return;
    }
    setSaving(true);
    try {
      await noticeService.send({ centreId: form.centreId, body: form.body, priority: form.priority });
      setShowForm(false); setForm(p => ({ ...p, body:'', priority:'normal' }));
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={N.root}>
      <View style={N.header}>
        <Text style={N.title}>Notices</Text>
        <Button label="+ Send" size="sm" onPress={() => setShowForm(v => !v)} />
      </View>

      {showForm && (
        <Card style={N.form}>
          <Text style={N.formTitle}>Send Notice to Workers</Text>

          {/* Centre dropdown */}
          <Text style={N.fieldLabel}>Target Centre <Text style={{ color:Colors.error }}>*</Text></Text>
          <TouchableOpacity style={N.dropdown} onPress={() => setShowDrop(v => !v)}>
            <Ionicons name="storefront-outline" size={16} color={Colors.textSecondary} />
            <Text style={N.dropdownTxt} numberOfLines={1}>
              {selectedCentre ? `${selectedCentre.name}  (${selectedCentre.centreId})` : 'Select centre…'}
            </Text>
            <Ionicons name={showDrop ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textDisabled} />
          </TouchableOpacity>
          {showDrop && (
            <View style={N.dropList}>
              {centres.map(c => (
                <TouchableOpacity key={c.id} style={[N.dropItem, form.centreId===c.id && N.dropItemActive]}
                  onPress={() => { setForm(p => ({ ...p, centreId: c.id })); setShowDrop(false); }}>
                  <Text style={[N.dropItemTxt, form.centreId===c.id && { color:Colors.primary, fontWeight:FontWeight.bold }]}>
                    {c.name}
                  </Text>
                  <Text style={[N.dropItemId, form.centreId===c.id && { color:Colors.primaryLight }]}>
                    {c.centreId}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Message */}
          <View style={{ marginBottom:Spacing.xs }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:Spacing.xs }}>
              <Text style={N.fieldLabel}>Message <Text style={{ color:Colors.error }}>*</Text></Text>
              <Text style={[N.wordCnt, overLimit && { color:Colors.error }]}>
                {wc} / {MAX_WORDS} words
              </Text>
            </View>
            <Input placeholder="Write your instructions here…" value={form.body}
              onChangeText={t => setForm(p => ({ ...p, body: t }))}
              multiline numberOfLines={4}
              style={[{ height:90, textAlignVertical:'top' }, overLimit && { borderColor:Colors.error }]} />
          </View>

          {/* Priority */}
          <Text style={N.fieldLabel}>Priority</Text>
          <View style={N.pillRow}>
            {PRIORITIES.map(p => (
              <TouchableOpacity key={p} style={[N.pill, form.priority===p && N.pillActive]}
                onPress={() => setForm(f => ({ ...f, priority: p }))}>
                <Text style={[N.pillTxt, form.priority===p && N.pillTxtActive]}>
                  {p.charAt(0).toUpperCase()+p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection:'row', gap:Spacing.sm, marginTop:Spacing.sm }}>
            <Button label="Cancel"      variant="secondary" onPress={() => setShowForm(false)} style={{ flex:1 }} />
            <Button label="Send Notice" onPress={handleSend} loading={saving} style={{ flex:1 }} disabled={overLimit} />
          </View>
        </Card>
      )}

      {loading ? <ActivityIndicator style={{ marginTop:60 }} color={Colors.primary} /> : (
        <FlatList
          data={notices}
          keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding:Spacing.base }}
          ListEmptyComponent={<Text style={N.empty}>No notices sent yet.</Text>}
          renderItem={({ item }) => (
            <Card style={N.item}>
              <View style={N.itemRow}>
                <View style={{ flex:1, flexDirection:'row', alignItems:'center', gap:8 }}>
                  <Ionicons name="megaphone-outline" size={16} color={Colors.primary} />
                  <Text style={N.itemCentre} numberOfLines={1}>{item.centre?.name ?? '—'}</Text>
                </View>
                <StatusBadge type={item.priority} size="sm" />
              </View>
              <Text style={N.itemBody} numberOfLines={3}>{item.body}</Text>
              <View style={N.itemFooter}>
                <Text style={N.itemMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                <Text style={N.readCount}>{item._count?.reads ?? 0} read</Text>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const N = StyleSheet.create({
  root:         { flex:1, backgroundColor:Colors.background },
  header:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:Spacing.xl, paddingTop:60, backgroundColor:Colors.primary },
  title:        { fontSize:FontSize.xl, fontWeight:FontWeight.bold, color:Colors.white },
  form:         { margin:Spacing.base },
  formTitle:    { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.textPrimary, marginBottom:Spacing.md },
  fieldLabel:   { fontSize:FontSize.sm, fontWeight:FontWeight.semiBold, color:Colors.textSecondary, marginBottom:Spacing.xs },
  dropdown:     { flexDirection:'row', alignItems:'center', gap:8, height:48, borderWidth:1.5, borderColor:Colors.border, borderRadius:Radius.md, paddingHorizontal:Spacing.base, backgroundColor:Colors.white, marginBottom:Spacing.xs },
  dropdownTxt:  { flex:1, fontSize:FontSize.base, color:Colors.textPrimary },
  dropList:     { borderWidth:1, borderColor:Colors.border, borderRadius:Radius.md, backgroundColor:Colors.white, marginBottom:Spacing.md, overflow:'hidden' },
  dropItem:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:Spacing.base, paddingVertical:12, borderBottomWidth:1, borderBottomColor:Colors.grey100 },
  dropItemActive:{ backgroundColor:Colors.primarySurface },
  dropItemTxt:  { fontSize:FontSize.base, color:Colors.textPrimary },
  dropItemId:   { fontSize:FontSize.xs, color:Colors.textDisabled },
  wordCnt:      { fontSize:FontSize.xs, color:Colors.textDisabled, fontWeight:FontWeight.medium },
  pillRow:      { flexDirection:'row', gap:Spacing.xs, marginBottom:Spacing.md },
  pill:         { paddingHorizontal:Spacing.sm, paddingVertical:5, borderRadius:Radius.full, borderWidth:1, borderColor:Colors.border, backgroundColor:Colors.grey100 },
  pillActive:   { backgroundColor:Colors.primary, borderColor:Colors.primary },
  pillTxt:      { fontSize:FontSize.xs, color:Colors.textSecondary, fontWeight:FontWeight.medium },
  pillTxtActive:{ color:Colors.white, fontWeight:FontWeight.bold },
  empty:        { textAlign:'center', color:Colors.textDisabled, padding:Spacing['3xl'] },
  item:         { marginBottom:Spacing.sm },
  itemRow:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:Spacing.xs },
  itemCentre:   { fontSize:FontSize.sm, fontWeight:FontWeight.bold, color:Colors.textPrimary, flex:1 },
  itemBody:     { fontSize:FontSize.sm, color:Colors.textSecondary, lineHeight:20 },
  itemFooter:   { flexDirection:'row', justifyContent:'space-between', marginTop:Spacing.sm },
  itemMeta:     { fontSize:FontSize.xs, color:Colors.textDisabled },
  readCount:    { fontSize:FontSize.xs, color:Colors.primary },
});
"""


# ═══════════════════════════════════════════════════════════════════════════════
# 7. Backend patches
# ═══════════════════════════════════════════════════════════════════════════════

def patch_centres_backend():
    """Auto-generate STN-XX centreId; remove centreNo from schema."""
    patch(
        BACKEND / "src/routes/centres.js",
        old=(
            "const CreateCentreSchema = z.object({\n"
            "  centreNo: z.string().min(2).max(20),\n"
            "  centreId: z.string().min(2).max(50),\n"
            "  name:     z.string().min(2),\n"
            "  location: z.string().min(2),\n"
            "});"
        ),
        new=(
            "const CreateCentreSchema = z.object({\n"
            "  name:     z.string().min(2).transform(s => s.trim().toUpperCase()),\n"
            "  location: z.string().min(2).transform(s => s.trim().toUpperCase()),\n"
            "});"
        ),
        label="removed centreNo/centreId from schema (auto-generated)",
    )

    patch(
        BACKEND / "src/routes/centres.js",
        old=(
            "    const { centreNo, centreId, name, location } = parsed.data;\n"
            "    const centre = await prisma.centre.create({\n"
            "      data: { centreNo, centreId, name, location, ownerId: req.user.id },\n"
            "    });"
        ),
        new=(
            "    const { name, location } = parsed.data;\n"
            "\n"
            "    // Auto-generate STN-XX centreId (scoped per owner)\n"
            "    const count    = await prisma.centre.count({ where: { ownerId: req.user.id } });\n"
            "    const centreId = `STN-${String(count + 1).padStart(2, '0')}`;\n"
            "    const centreNo = centreId;  // keep centreNo in sync for legacy reads\n"
            "\n"
            "    const centre = await prisma.centre.create({\n"
            "      data: { centreNo, centreId, name, location, ownerId: req.user.id },\n"
            "    });"
        ),
        label="auto-generate STN-XX centreId on create",
    )


def patch_workers_backend():
    """Accept centreId (optional) in worker registration; auto-assign on create."""
    patch(
        BACKEND / "src/routes/workers.js",
        old=(
            "const RegisterWorkerSchema = z.object({\n"
            "  fullName: z.string().min(2),\n"
            "  nim:      z.string().min(2).max(20),\n"
            "  phone:    z.string().min(9).max(15),\n"
            "});"
        ),
        new=(
            "const RegisterWorkerSchema = z.object({\n"
            "  fullName: z.string().min(2).transform(s => s.trim().toUpperCase()),\n"
            "  phone:    z.string().min(7).max(20),\n"
            "  centreId: z.string().optional(),\n"
            "});"
        ),
        label="replaced nim with centreId (optional) in RegisterWorkerSchema",
    )

    patch(
        BACKEND / "src/routes/workers.js",
        old=(
            "    const { fullName, nim, phone } = parsed.data;\n"
            "\n"
            "    const exists = await prisma.user.findUnique({ where: { nim } });\n"
            "    if (exists)\n"
            "      return res.status(409).json({ error: 'duplicate', detail: 'A worker with this NIM already exists.' });\n"
            "\n"
            "    const worker = await prisma.user.create({\n"
            "      data: { fullName, nim, phone, role: 'worker' },\n"
            "    });\n"
            "\n"
            "    await redis.cacheDel(redis.CacheKey.workers(req.user.id));\n"
            "    await logAction(req.user.id, logAction.ACTIONS.WORKER_REGISTERED, { req, workerId: worker.id });\n"
            "    return res.status(201).json({ id: worker.id, fullName: worker.fullName, nim: worker.nim, phone: worker.phone });"
        ),
        new=(
            "    const { fullName, phone, centreId } = parsed.data;\n"
            "\n"
            "    // Phone uniqueness (workers identified by phone)\n"
            "    const exists = await prisma.user.findUnique({ where: { phone } });\n"
            "    if (exists)\n"
            "      return res.status(409).json({ error: 'duplicate', detail: 'A worker with this phone number already exists.' });\n"
            "\n"
            "    const worker = await prisma.user.create({\n"
            "      data: { fullName, phone, role: 'worker' },\n"
            "    });\n"
            "\n"
            "    // If centreId provided, assign immediately\n"
            "    if (centreId) {\n"
            "      const centre = await ownCentre(centreId, req.user.id);\n"
            "      if (centre) {\n"
            "        await prisma.workerCentreAssignment.create({\n"
            "          data: { workerId: worker.id, centreId: centre.id },\n"
            "        });\n"
            "      }\n"
            "    }\n"
            "\n"
            "    await redis.cacheDel(redis.CacheKey.workers(req.user.id));\n"
            "    await logAction(req.user.id, logAction.ACTIONS.WORKER_REGISTERED, { req, workerId: worker.id });\n"
            "    return res.status(201).json({ id: worker.id, fullName: worker.fullName, phone: worker.phone });"
        ),
        label="workers register: nim→phone uniqueness, centreId optional auto-assign",
    )


def patch_auth_register_password():
    """Add password field to RegisterSchema and hash it on create."""
    patch(
        BACKEND / "src/routes/auth.js",
        old=(
            "  email:     z.string().email('Valid email required').optional(),\n"
            "});"
        ),
        new=(
            "  email:     z.string().email('Valid email required').optional(),\n"
            "  password:  z.string().min(8, 'Password must be at least 8 characters'),\n"
            "  profilePicture: z.string().optional(),  // local URI — stored only in client for now\n"
            "});"
        ),
        label="added password (required) to RegisterSchema",
    )

    patch(
        BACKEND / "src/routes/auth.js",
        old=(
            "    const { fullName, brandName, phone, email } = parsed.data;\n"
        ),
        new=(
            "    const { fullName, brandName, phone, email, password } = parsed.data;\n"
        ),
        label="destructure password from parsed data",
    )

    patch(
        BACKEND / "src/routes/auth.js",
        old=(
            "    const user = await prisma.user.create({\n"
            "      data: {\n"
            "        fullName,\n"
            "        phone,\n"
            "        ...(email ? { email } : {}),\n"
            "        nim:      brandName,   // temporary: nim stores brandName until migration\n"
            "        role:     'owner',\n"
            "        isActive: false,\n"
            "      },\n"
            "    });"
        ),
        new=(
            "    const bcrypt      = require('bcryptjs');\n"
            "    const passwordHash = await bcrypt.hash(password, 12);\n"
            "\n"
            "    const user = await prisma.user.create({\n"
            "      data: {\n"
            "        fullName,\n"
            "        phone,\n"
            "        ...(email ? { email } : {}),\n"
            "        nim:          brandName,   // temporary: nim stores brandName until migration\n"
            "        passwordHash,\n"
            "        role:         'owner',\n"
            "        isActive:     false,\n"
            "      },\n"
            "    });"
        ),
        label="hash password and store on owner registration",
    )


def patch_auth_change_password():
    """Add PATCH /api/auth/change-password/ endpoint for authenticated users."""
    patch(
        BACKEND / "src/routes/auth.js",
        old="module.exports = router;",
        new=(
            "// ── PATCH /api/auth/change-password/ ────────────────────────────────────────\n"
            "// Authenticated endpoint — owner changes their own password.\n"
            "router.patch('/change-password/', authenticate, async (req, res, next) => {\n"
            "  try {\n"
            "    const { currentPassword, newPassword } = req.body;\n"
            "    if (!currentPassword || !newPassword)\n"
            "      return res.status(400).json({ error: 'validation_error', detail: 'Both currentPassword and newPassword are required.' });\n"
            "    if (newPassword.length < 8)\n"
            "      return res.status(400).json({ error: 'validation_error', detail: 'New password must be at least 8 characters.' });\n"
            "\n"
            "    const user = await prisma.user.findUnique({ where: { id: req.user.id } });\n"
            "    if (!user) return res.status(404).json({ error: 'not_found' });\n"
            "\n"
            "    const bcrypt = require('bcryptjs');\n"
            "    const ok = await bcrypt.compare(currentPassword, user.passwordHash || '');\n"
            "    if (!ok)\n"
            "      return res.status(401).json({ error: 'invalid_password', detail: 'Current password is incorrect.' });\n"
            "\n"
            "    const passwordHash = await bcrypt.hash(newPassword, 12);\n"
            "    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });\n"
            "    await logAction(req.user.id, 'PASSWORD_CHANGED', { req, result: 'success' });\n"
            "    return res.json({ success: true, message: 'Password changed successfully.' });\n"
            "  } catch (err) { next(err); }\n"
            "});\n"
            "\n"
            "module.exports = router;"
        ),
        label="added PATCH /api/auth/change-password/ endpoint",
    )


def patch_api_constants():
    """Add changePassword to API_ROUTES."""
    patch(
        MOBILE / "constants/api.ts",
        old="  ownerRegister: '/api/auth/owner/register/',",
        new=(
            "  ownerRegister:   '/api/auth/owner/register/',\n"
            "  changePassword:  '/api/auth/change-password/',"
        ),
        label="added changePassword to API_ROUTES",
    )


def patch_notices_service():
    """Update noticeService.send to not require title field."""
    patch(
        MOBILE / "services/api.ts",
        old="  send:   (body: Record<string, unknown>) => apiClient.post(API_ROUTES.noticesSend, body),",
        new="  send:   (body: { centreId:string; body:string; priority:string }) => apiClient.post(API_ROUTES.noticesSend, body),",
        label="typed noticeService.send (no title)",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print(f"\n📂 Repo root: {REPO.resolve()}")
    print("=" * 65)
    print()

    print("── New hook ──────────────────────────────────────────────────")
    write_file(MOBILE / "hooks/useTheme.ts", USE_THEME_TS)
    print()

    print("── Mobile screens (full rewrites) ────────────────────────────")
    write_file(MOBILE / "app/(auth)/login.tsx",         LOGIN_TSX)
    write_file(MOBILE / "app/(owner)/dashboard.tsx",    DASHBOARD_TSX)
    write_file(MOBILE / "app/(owner)/centres.tsx",      CENTRES_TSX)
    write_file(MOBILE / "app/(owner)/workers.tsx",      WORKERS_TSX)
    write_file(MOBILE / "app/(owner)/notices.tsx",      NOTICES_TSX)
    print()

    print("── Backend patches ───────────────────────────────────────────")
    patch_centres_backend()
    patch_workers_backend()
    patch_auth_register_password()
    patch_auth_change_password()
    patch_api_constants()
    patch_notices_service()
    print()

    print("=" * 65)
    print("✅  All patches applied.")
    print()
    print("Install mobile packages (if not already):")
    print("  cd mobile")
    print("  npx expo install expo-image-picker \\")
    print("    @react-native-async-storage/async-storage")
    print()
    print("Run backend tests:")
    print("  cd backend && npm test   # must still be 7/7")
    print()
    print("Commit:")
    print("  git add mobile/ backend/src/routes/")
    print('  git commit -m "feat: 2-step reg, sidebar, STN-XX, workers dropdown, notices word-limit"')
    print("  git push origin develop")
    print("=" * 65)


if __name__ == "__main__":
    main()
