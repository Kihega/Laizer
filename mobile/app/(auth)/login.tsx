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
    if (s1.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s1.email.trim()))
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
