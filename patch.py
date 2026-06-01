#!/usr/bin/env python3
"""
SMSS → Laizer — Patch Script 9: Rebrand + Owner Registration
=============================================================
Run from the ROOT of your repository:

    python apply_laizer_rebrand.py

Changes applied
───────────────
Mobile — mobile/app/(auth)/login.tsx   (full rewrite)
  • Replaces icon + "SMSS" with artistic "Laizer" wordmark
  • Removes the footer text
  • Adds "Don't have an account? Sign Up" link (owner tab only)
  • Adds bottom-sheet registration modal with:
      - Full Name     (auto-uppercased)
      - Brand Name    (auto-uppercased)
      - Phone Number
      - Register button → POST /api/auth/owner/register/
      - Success state with Done button

Mobile — mobile/constants/api.ts       (str.replace)
  • Adds  ownerRegister: '/api/auth/owner/register/'  to API_ROUTES

Mobile — mobile/services/api.ts        (str.replace)
  • Adds  register(body) → authService  function

Backend — backend/src/routes/auth.js   (str.replace)
  • Adds  POST /api/auth/owner/register/  endpoint
      - Validates fullName, brandName, phone (Zod)
      - Uppercases both text fields server-side
      - Checks phone/nim uniqueness
      - Creates User { role:'owner', isActive:false }
        brandName stored in `nim` field (unique index already there)
        TODO: add a dedicated brandName column in a future migration
      - Returns 201 with success message
"""

from pathlib import Path

REPO = Path(".")
MOBILE = REPO / "mobile"
BACKEND = REPO / "backend"


# ── Helper ────────────────────────────────────────────────────────────────────

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
        print(f"  [SKIP]     {path.relative_to(REPO)} — '{label}' (already applied?)")
        return
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"  [PATCHED]  {path.relative_to(REPO)} — {label}")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. MOBILE — login.tsx  (full rewrite)
# ═══════════════════════════════════════════════════════════════════════════════

LOGIN_TSX = """\
/**
 * Laizer — Login Screen
 * Owner tab: email + password, with Sign Up modal.
 * Worker tab: Centre ID only.
 */
import { useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth }        from '@/hooks/useAuth';
import { Button, Input }  from '@/components/ui';
import {
  BrandColors, Colors, FontSize, FontWeight, Radius, Spacing,
} from '@/constants/theme';
import { apiClient }      from '@/services/api';
import { API_ROUTES }     from '@/constants/api';

type LoginMode = 'owner' | 'worker';

interface RegForm {
  fullName:  string;
  brandName: string;
  phone:     string;
}

export default function LoginScreen() {
  const { ownerLogin, workerLogin, isLoading, error, clearError } = useAuth();

  // ── Login state ────────────────────────────────────────────────────────────
  const [mode,     setMode]     = useState<LoginMode>('owner');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [centreId, setCentreId] = useState('');
  const [showPass, setShowPass] = useState(false);

  // ── Registration modal state ───────────────────────────────────────────────
  const [showReg,    setShowReg]    = useState(false);
  const [regForm,    setRegForm]    = useState<RegForm>({ fullName:'', brandName:'', phone:'' });
  const [regLoading, setRegLoading] = useState(false);
  const [regError,   setRegError]   = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const switchMode = (m: LoginMode) => { setMode(m); clearError(); };

  const handleSubmit = async () => {
    clearError();
    if (mode === 'owner') {
      if (!email.trim() || !password.trim()) return;
      await ownerLogin(email, password);
    } else {
      if (!centreId.trim()) return;
      await workerLogin(centreId);
    }
  };

  const openReg = () => {
    setRegForm({ fullName:'', brandName:'', phone:'' });
    setRegError('');
    setRegSuccess(false);
    setShowReg(true);
  };

  const handleRegister = async () => {
    setRegError('');
    if (!regForm.fullName.trim())  return setRegError('Full name is required.');
    if (!regForm.brandName.trim()) return setRegError('Stationery brand name is required.');
    if (!regForm.phone.trim())     return setRegError('Phone number is required.');

    setRegLoading(true);
    try {
      await apiClient.post(API_ROUTES.ownerRegister, {
        fullName:  regForm.fullName.trim().toUpperCase(),
        brandName: regForm.brandName.trim().toUpperCase(),
        phone:     regForm.phone.trim(),
      });
      setRegSuccess(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setRegError(err?.response?.data?.detail ?? 'Registration failed. Please try again.');
    } finally {
      setRegLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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

          {/* ── Laizer Brand Header ──────────────────────────────────── */}
          <View style={S.header}>

            {/* Decorative geometric row */}
            <View style={S.decoRow}>
              <View style={[S.decoShape, S.decoSquare]} />
              <View style={[S.decoShape, S.decoPill]}   />
              <View style={[S.decoShape, S.decoCircle]} />
              <View style={[S.decoShape, S.decoPill]}   />
              <View style={[S.decoShape, S.decoSquare, { opacity:0.4 }]} />
            </View>

            {/* Wordmark: bold "L" + light "AIZER" */}
            <Text style={S.wordmark} adjustsFontSizeToFit numberOfLines={1}>
              <Text style={S.wordL}>L</Text>
              <Text style={S.wordRest}>AIZER</Text>
            </Text>

            {/* Segmented accent bar */}
            <View style={S.accentBar}>
              <View style={[S.accentSeg, { flex:4 }]} />
              <View style={[S.accentSeg, { flex:2, opacity:0.45 }]} />
              <View style={[S.accentSeg, { flex:1, opacity:0.2  }]} />
            </View>

            <Text style={S.tagline}>Stationery Management & Sales</Text>
          </View>

          {/* ── Login Card ────────────────────────────────────────────── */}
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
              <View style={S.errBanner}>
                <Text style={S.errText}>⚠️  {error.message}</Text>
              </View>
            )}

            {/* Owner form */}
            {mode === 'owner' ? (
              <>
                <Input
                  label="Email address"
                  placeholder="owner@example.com"
                  value={email}
                  onChangeText={(t: string) => { setEmail(t); clearError(); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />
                <Input
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={(t: string) => { setPassword(t); clearError(); }}
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  rightIcon={<Text style={S.eyeIcon}>{showPass ? '🙈' : '👁'}</Text>}
                  onPressRightIcon={() => setShowPass(v => !v)}
                />
              </>
            ) : (
              <Input
                label="Centre ID"
                placeholder="e.g. CENTRE-ARU-001"
                value={centreId}
                onChangeText={(t: string) => { setCentreId(t.toUpperCase()); clearError(); }}
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

            {/* Sign Up row — visible in owner tab only */}
            {mode === 'owner' && (
              <TouchableOpacity
                style={S.signUpRow}
                onPress={openReg}
                activeOpacity={0.75}
              >
                <Text style={S.signUpText}>
                  {"Don't have an account?  "}
                  <Text style={S.signUpLink}>Sign Up</Text>
                </Text>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ════════════════════════════════════════════════════════════
          Registration bottom-sheet modal
          ════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showReg}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReg(false)}
      >
        <View style={S.overlay}>
          <TouchableOpacity
            style={S.overlayDismiss}
            activeOpacity={1}
            onPress={() => setShowReg(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={S.sheet}>

              {/* Sheet handle */}
              <View style={S.sheetHandle} />

              {/* Header row */}
              <View style={S.sheetHeader}>
                <View>
                  <Text style={S.sheetTitle}>Create Owner Account</Text>
                  <Text style={S.sheetSubtitle}>Register your stationery business on Laizer</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowReg(false)}
                  hitSlop={{ top:12, bottom:12, left:12, right:12 }}
                >
                  <Text style={S.sheetCloseIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              {regSuccess ? (
                /* ── Success state ─────────────────────────────────────── */
                <View style={S.successBox}>
                  <Text style={S.successEmoji}>🎉</Text>
                  <Text style={S.successTitle}>Registration Received!</Text>
                  <Text style={S.successMsg}>
                    We'll reach out to you shortly to complete your account setup
                    and get your business live on Laizer.
                  </Text>
                  <Button
                    label="Done"
                    onPress={() => setShowReg(false)}
                    fullWidth
                    size="md"
                    style={S.doneBtn}
                  />
                </View>
              ) : (
                /* ── Form ──────────────────────────────────────────────── */
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {!!regError && (
                    <View style={S.errBanner}>
                      <Text style={S.errText}>⚠️  {regError}</Text>
                    </View>
                  )}

                  {/* Full Name */}
                  <View style={S.field}>
                    <Text style={S.fieldLabel}>
                      Full Name <Text style={S.req}>*</Text>
                    </Text>
                    <TextInput
                      style={S.fieldInput}
                      placeholder="E.G. JOHN MICHAEL DOE"
                      placeholderTextColor={Colors.grey400}
                      value={regForm.fullName}
                      onChangeText={t => setRegForm(p => ({ ...p, fullName: t.toUpperCase() }))}
                      autoCapitalize="characters"
                      returnKeyType="next"
                    />
                  </View>

                  {/* Brand Name */}
                  <View style={S.field}>
                    <Text style={S.fieldLabel}>
                      Stationery Brand Name <Text style={S.req}>*</Text>
                    </Text>
                    <TextInput
                      style={S.fieldInput}
                      placeholder="E.G. LAIZER SUPPLIES CO."
                      placeholderTextColor={Colors.grey400}
                      value={regForm.brandName}
                      onChangeText={t => setRegForm(p => ({ ...p, brandName: t.toUpperCase() }))}
                      autoCapitalize="characters"
                      returnKeyType="next"
                    />
                  </View>

                  {/* Phone */}
                  <View style={S.field}>
                    <Text style={S.fieldLabel}>
                      Phone Number <Text style={S.req}>*</Text>
                    </Text>
                    <TextInput
                      style={S.fieldInput}
                      placeholder="+255 712 345 678"
                      placeholderTextColor={Colors.grey400}
                      value={regForm.phone}
                      onChangeText={t => setRegForm(p => ({ ...p, phone: t }))}
                      keyboardType="phone-pad"
                      returnKeyType="done"
                      onSubmitEditing={handleRegister}
                    />
                  </View>

                  <Button
                    label="Register"
                    onPress={handleRegister}
                    loading={regLoading}
                    fullWidth
                    size="lg"
                    style={S.regBtn}
                  />

                  <Text style={S.disclaimer}>
                    Your registration will be reviewed and your account activated within 24 hours.
                  </Text>

                  {/* bottom padding so keyboard doesn't cover the button */}
                  <View style={{ height: 24 }} />
                </ScrollView>
              )}

            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  gradient: { flex: 1 },
  kav:      { flex: 1 },
  scroll:   {
    flexGrow: 1,
    justifyContent: 'center',
    padding:    Spacing.xl,
    paddingTop: 72,
    paddingBottom: Spacing.xl,
  },

  // ── Laizer header ──────────────────────────────────────────────────────────
  header: { alignItems: 'center', marginBottom: Spacing['3xl'] },

  decoRow:    { flexDirection:'row', alignItems:'center', gap:6, marginBottom: Spacing.base },
  decoShape:  { backgroundColor: 'rgba(255,255,255,0.85)' },
  decoSquare: { width:10, height:10, borderRadius:2 },
  decoPill:   { width:22, height:8,  borderRadius:4 },
  decoCircle: { width:12, height:12, borderRadius:6 },

  wordmark: { flexDirection:'row', lineHeight:60 },
  wordL:    {
    fontSize:    60,
    fontWeight:  '900',
    color:       Colors.white,
    letterSpacing: 2,
  },
  wordRest: {
    fontSize:    52,
    fontWeight:  '200',
    color:       'rgba(255,255,255,0.88)',
    letterSpacing: 8,
  },

  accentBar: {
    flexDirection: 'row',
    height:  4,
    width:   170,
    gap:     4,
    marginTop:    6,
    marginBottom: Spacing.md,
    borderRadius: 2,
    overflow: 'hidden',
  },
  accentSeg: { backgroundColor: Colors.white, borderRadius: 2 },

  tagline: {
    fontSize:      FontSize.sm,
    color:         'rgba(255,255,255,0.72)',
    letterSpacing: 0.8,
  },

  // ── Card ───────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.white,
    borderRadius:    Radius.xl,
    padding:         Spacing.xl,
    shadowColor:     '#000',
    shadowOffset:    { width:0, height:8 },
    shadowOpacity:   0.18,
    shadowRadius:    24,
    elevation:       12,
  },
  tabRow: {
    flexDirection:   'row',
    backgroundColor: Colors.grey100,
    borderRadius:    Radius.md,
    padding:         4,
    marginBottom:    Spacing.xl,
  },
  tab: {
    flex:            1,
    height:          40,
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    Radius.sm,
  },
  tabActive: {
    backgroundColor: Colors.white,
    shadowColor:     '#000',
    shadowOffset:    { width:0, height:1 },
    shadowOpacity:   0.12,
    shadowRadius:    4,
    elevation:       2,
  },
  tabText:       { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textDisabled },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },

  errBanner: {
    backgroundColor: Colors.errorSurface,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    marginBottom:    Spacing.base,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  errText:   { fontSize: FontSize.sm, color: Colors.error, lineHeight:18 },

  submitBtn: { marginTop: Spacing.sm },
  eyeIcon:   { fontSize: 18 },

  // ── Sign Up link ──────────────────────────────────────────────────────────
  signUpRow: {
    alignItems:     'center',
    marginTop:      Spacing.base,
    paddingVertical: Spacing.xs,
  },
  signUpText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  signUpLink: { color: Colors.primary, fontWeight: FontWeight.bold },

  // ── Modal overlay ──────────────────────────────────────────────────────────
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent:  'flex-end',
  },
  overlayDismiss: { flex: 1 },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  sheet: {
    backgroundColor:     Colors.white,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingHorizontal:    Spacing.xl,
    paddingBottom:        40,
    paddingTop:           12,
    maxHeight:            '90%',
  },
  sheetHandle: {
    width:           44,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.grey300,
    alignSelf:       'center',
    marginBottom:    Spacing.md,
  },
  sheetHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   Spacing.xl,
  },
  sheetTitle:    { fontSize: FontSize.xl,  fontWeight: FontWeight.bold,     color: Colors.textPrimary },
  sheetSubtitle: { fontSize: FontSize.sm,  fontWeight: FontWeight.regular,  color: Colors.textSecondary, marginTop: 2 },
  sheetCloseIcon:{ fontSize: 20, color: Colors.textDisabled, paddingTop: 2 },

  // ── Form fields ───────────────────────────────────────────────────────────
  field: { marginBottom: Spacing.md },
  fieldLabel: {
    fontSize:     FontSize.sm,
    fontWeight:   FontWeight.semiBold,
    color:        Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  req: { color: Colors.error },
  fieldInput: {
    height:            52,
    borderWidth:       1.5,
    borderColor:       Colors.border,
    borderRadius:      Radius.md,
    paddingHorizontal: Spacing.base,
    fontSize:          FontSize.base,
    color:             Colors.textPrimary,
    backgroundColor:   Colors.white,
    letterSpacing:     0.5,
  },
  regBtn:     { marginTop: Spacing.sm },
  disclaimer: {
    textAlign:   'center',
    fontSize:    FontSize.xs,
    color:       Colors.textDisabled,
    marginTop:   Spacing.md,
    lineHeight:  18,
  },

  // ── Success ───────────────────────────────────────────────────────────────
  successBox:   { alignItems:'center', paddingVertical: Spacing['2xl'] },
  successEmoji: { fontSize: 52, marginBottom: Spacing.md },
  successTitle: {
    fontSize:    FontSize['2xl'],
    fontWeight:  FontWeight.bold,
    color:       Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  successMsg: {
    textAlign:  'center',
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  doneBtn: { marginTop: Spacing.xl },
});
"""


# ═══════════════════════════════════════════════════════════════════════════════
# 2. MOBILE — constants/api.ts  (add ownerRegister route)
# ═══════════════════════════════════════════════════════════════════════════════

API_ROUTES_OLD = "  ownerLogin:   '/api/auth/owner/login/',"
API_ROUTES_NEW = (
    "  ownerLogin:    '/api/auth/owner/login/',\n"
    "  ownerRegister: '/api/auth/owner/register/',"
)


# ═══════════════════════════════════════════════════════════════════════════════
# 3. MOBILE — services/api.ts  (add register to authService)
# ═══════════════════════════════════════════════════════════════════════════════

AUTH_SVC_OLD = (
    "export const authService = {\n"
    "  ownerLogin:  (email: string, password: string) =>\n"
    "    apiClient.post(API_ROUTES.ownerLogin,  { email, password }),"
)
AUTH_SVC_NEW = (
    "export const authService = {\n"
    "  ownerLogin:  (email: string, password: string) =>\n"
    "    apiClient.post(API_ROUTES.ownerLogin,  { email, password }),\n"
    "  register: (body: { fullName: string; brandName: string; phone: string }) =>\n"
    "    apiClient.post(API_ROUTES.ownerRegister, body),"
)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. BACKEND — src/routes/auth.js  (add POST /owner/register/)
# ═══════════════════════════════════════════════════════════════════════════════

BACKEND_OLD = "// ── POST /api/auth/owner/login/ ───────────────────────────────────────────────"
BACKEND_NEW = """\
// ── POST /api/auth/owner/register/ ──────────────────────────────────────────
// Public endpoint — creates a pending owner account (isActive: false).
// brandName is stored in the `nim` field as an MVP workaround;
// add a dedicated `brandName` column in a future Prisma migration.
const RegisterSchema = z.object({
  fullName:  z.string().min(2, 'Full name required')
               .transform(s => s.trim().toUpperCase()),
  brandName: z.string().min(2, 'Brand name required')
               .transform(s => s.trim().toUpperCase()),
  phone:     z.string().min(7, 'Phone number required')
               .regex(/^[0-9+\\s\\-()]+$/, 'Invalid phone number format'),
});

router.post('/owner/register/', async (req, res, next) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const { fullName, brandName, phone } = parsed.data;

    // Uniqueness checks (phone and nim/brandName)
    const phoneUsed = await prisma.user.findUnique({ where: { phone } });
    if (phoneUsed)
      return res.status(409).json({
        error:  'phone_exists',
        detail: 'This phone number is already registered. Contact support if this is an error.',
      });

    const brandUsed = await prisma.user.findUnique({ where: { nim: brandName } });
    if (brandUsed)
      return res.status(409).json({
        error:  'brand_exists',
        detail: 'A business with this brand name is already registered.',
      });

    // Create owner account — inactive until manually activated by admin
    const user = await prisma.user.create({
      data: {
        fullName,
        phone,
        nim:      brandName,   // temporary: nim stores brandName until migration
        role:     'owner',
        isActive: false,
      },
    });

    await logAction(user.id, 'OWNER_REGISTER', { req, result: 'pending_activation' });

    return res.status(201).json({
      success:  true,
      userId:   user.id,
      message:  'Registration received. We will contact you shortly to activate your account.',
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/owner/login/ ───────────────────────────────────────────────"""


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print(f"\n📂 Repo root: {REPO.resolve()}")
    print("=" * 60)

    # 1 — Rewrite login.tsx
    write_file(MOBILE / "app/(auth)/login.tsx", LOGIN_TSX)

    # 2 — Add ownerRegister to API_ROUTES
    patch(
        MOBILE / "constants/api.ts",
        API_ROUTES_OLD, API_ROUTES_NEW,
        "added ownerRegister route",
    )

    # 3 — Add register() to authService
    patch(
        MOBILE / "services/api.ts",
        AUTH_SVC_OLD, AUTH_SVC_NEW,
        "added register() to authService",
    )

    # 4 — Add backend register endpoint
    patch(
        BACKEND / "src/routes/auth.js",
        BACKEND_OLD, BACKEND_NEW,
        "added POST /api/auth/owner/register/ endpoint",
    )

    print("\n" + "=" * 60)
    print("✅  All patches applied.")
    print()
    print("Run checks:")
    print("  cd mobile  && npm run lint && npm run typecheck")
    print("  cd backend && npm test")
    print()
    print("Then commit:")
    print("  git add mobile/app/\\(auth\\)/login.tsx \\")
    print("          mobile/constants/api.ts \\")
    print("          mobile/services/api.ts \\")
    print("          backend/src/routes/auth.js")
    print('  git commit -m "feat: Laizer rebrand, owner signup modal, register API"')
    print("  git push origin develop")
    print("=" * 60)


if __name__ == "__main__":
    main()
