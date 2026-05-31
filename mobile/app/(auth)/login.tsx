/**
 * SMSS — Login Screen
 * Two tabs: Owner (email + password) and Worker (Centre ID).
 */
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth }        from '@/hooks/useAuth';
import { Button, Input }  from '@/components/ui';
import {
  BrandColors, Colors, FontSize, FontWeight, Radius, Spacing,
} from '@/constants/theme';

type LoginMode = 'owner' | 'worker';

export default function LoginScreen() {
  const { ownerLogin, workerLogin, isLoading, error, clearError } = useAuth();
  const [mode,     setMode]     = useState<LoginMode>('owner');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [centreId, setCentreId] = useState('');
  const [showPass, setShowPass] = useState(false);

  const switchMode = (m: LoginMode) => { setMode(m); clearError(); };

  const handleSubmit = async () => {
    clearError();
    if (mode === 'owner') {
      if (!email.trim())    return;
      if (!password.trim()) return;
      await ownerLogin(email, password);
    } else {
      if (!centreId.trim()) return;
      await workerLogin(centreId);
    }
  };

  return (
    <LinearGradient
      colors={[BrandColors.blueDark, BrandColors.blue, '#3B82F6']}
      start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
      style={S.gradient}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={S.kav}
      >
        <ScrollView
          contentContainerStyle={S.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ───────────────────────────────────────────────── */}
          <View style={S.header}>
            <View style={S.logo}>
              <Text style={S.logoText}>📋</Text>
            </View>
            <Text style={S.appName}>SMSS</Text>
            <Text style={S.tagline}>Stationery Management & Sales</Text>
          </View>

          {/* ── Card ─────────────────────────────────────────────────── */}
          <View style={S.card}>
            {/* Mode tabs */}
            <View style={S.tabRow}>
              {(['owner', 'worker'] as LoginMode[]).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[S.tab, mode === m && S.tabActive]}
                  onPress={() => switchMode(m)}
                  activeOpacity={0.8}
                >
                  <Text style={[S.tabText, mode === m && S.tabTextActive]}>
                    {m === 'owner' ? '🏢  Owner' : '👤  Worker'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Error banner */}
            {error && (
              <View style={S.errorBanner}>
                <Text style={S.errorText}>⚠️  {error.message}</Text>
              </View>
            )}

            {/* Owner form */}
            {mode === 'owner' ? (
              <>
                <Input
                  label="Email address"
                  placeholder="owner@example.com"
                  value={email}
                  onChangeText={t => { setEmail(t); clearError(); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />
                <Input
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={t => { setPassword(t); clearError(); }}
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  rightIcon={
                    <Text style={S.eyeIcon}>{showPass ? '🙈' : '👁'}</Text>
                  }
                  onPressRightIcon={() => setShowPass(v => !v)}
                />
              </>
            ) : (
              <Input
                label="Centre ID"
                placeholder="e.g. CENTRE-ARU-001"
                value={centreId}
                onChangeText={t => { setCentreId(t.toUpperCase()); clearError(); }}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                hint="Your Centre ID is provided by the shop owner."
              />
            )}

            <Button
              label={mode === 'owner' ? 'Sign In' : 'Enter Centre'}
              onPress={handleSubmit}
              loading={isLoading}
              fullWidth
              size="lg"
              style={S.submitBtn}
            />
          </View>

          {/* Footer */}
          <Text style={S.footer}>SMSS v1.0 · Powered by SMSS Platform</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const S = StyleSheet.create({
  gradient:  { flex: 1 },
  kav:       { flex: 1 },
  scroll:    { flexGrow:1, justifyContent:'center', padding: Spacing.xl, paddingTop: 60 },
  header:    { alignItems:'center', marginBottom: Spacing['3xl'] },
  logo:      { width:80, height:80, borderRadius:20, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center', marginBottom: Spacing.md },
  logoText:  { fontSize:40 },
  appName:   { fontSize: FontSize['3xl'], fontWeight: FontWeight.black, color: Colors.white, letterSpacing:3 },
  tagline:   { fontSize: FontSize.sm, color:'rgba(255,255,255,0.75)', marginTop: Spacing.xs },
  card:      { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xl, shadowColor:'#000', shadowOffset:{width:0,height:8}, shadowOpacity:0.18, shadowRadius:24, elevation:12 },
  tabRow:    { flexDirection:'row', backgroundColor: Colors.grey100, borderRadius: Radius.md, padding:4, marginBottom: Spacing.xl },
  tab:       { flex:1, height:40, alignItems:'center', justifyContent:'center', borderRadius: Radius.sm },
  tabActive: { backgroundColor: Colors.white, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.12, shadowRadius:4, elevation:2 },
  tabText:   { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textDisabled },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  errorBanner:   { backgroundColor: Colors.errorSurface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.base, borderLeftWidth:3, borderLeftColor: Colors.error },
  errorText: { fontSize: FontSize.sm, color: Colors.error, lineHeight:18 },
  submitBtn: { marginTop: Spacing.sm },
  eyeIcon:   { fontSize:18 },
  footer:    { textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize: FontSize.xs, marginTop: Spacing.xl },
});
