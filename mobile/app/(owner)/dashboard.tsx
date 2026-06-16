/**
 * Laizer — Owner Dashboard
 * Profile card + hamburger sidebar (dark/light mode, change password, logout)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, Modal, RefreshControl,
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
  const [loadError,  setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
    const timer = setTimeout(() => {
      setLoading(false); setRefreshing(false);
      setLoadError('Server is taking too long.\nTap Retry to try again.');
    }, 12000);
    try {
      const [rpt, ctr] = await Promise.allSettled([
        reportService.daily(),
        centreService.list(),
      ]);
      clearTimeout(timer);
      if (rpt.status === 'fulfilled') setReport(rpt.value.data ?? []);
      else {
        const e = rpt.reason as any;
        console.error('[Dashboard] reports:', e?.response?.data ?? e?.message);
      }
      if (ctr.status === 'fulfilled') setCentres(ctr.value.data ?? []);
      else {
        const e = ctr.reason as any;
        const msg = e?.response?.data?.detail ?? e?.message ?? 'Unknown error';
        console.error('[Dashboard] centres:', e?.response?.data ?? msg);
        setLoadError(`Could not load: ${msg}`);
      }
    } catch (e: unknown) {
      clearTimeout(timer);
      const msg = (e as any)?.response?.data?.detail ?? (e as Error)?.message ?? 'Unexpected error';
      setLoadError(`Error: ${msg}`);
      console.error('[Dashboard] unexpected:', e);
    } finally { setLoading(false); setRefreshing(false); }
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
            {user?.profilePicture
              ? <Image source={{ uri: user.profilePicture }} style={S.profileAvatarImg} />
              : <Ionicons name="person" size={28} color={Colors.primary} />}
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
        {loading ? (
          <ActivityIndicator style={S.loader} color={Colors.primary} size="large" />
        ) : loadError ? (
          <View style={{ alignItems:'center', marginTop:40, paddingHorizontal:24 }}>
            <Ionicons name="cloud-offline-outline" size={40} color={Colors.primary} style={{ opacity:0.5 }} />
            <Text style={{ color:Colors.textSecondary, textAlign:'center', marginTop:12,
                           fontSize:FontSize.sm, lineHeight:20 }}>{loadError}</Text>
            <TouchableOpacity onPress={() => { setLoading(true); load(); }}
              style={{ marginTop:16, paddingVertical:8, paddingHorizontal:24,
                       borderRadius:8, borderWidth:1.5, borderColor:Colors.primary }}>
              <Text style={{ color:Colors.primary, fontWeight:FontWeight.bold }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
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

            {report.length === 0 && centres.length > 0 && (
              <View style={S.emptyReport}>
                <Text style={S.emptyReportIcon}>📋</Text>
                <Text style={[S.emptyReportTxt, { color: tc.textSec }]}>
                  No services logged today yet.
                </Text>
              </View>
            )}
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

function StatCard({ label, value, icon }: { label:string; value:string; icon: ComponentProps<typeof Ionicons>['name'] }) {
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
  profileAvatar:{ width:54, height:54, borderRadius:27, backgroundColor:'rgba(255,255,255,0.9)', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  profileAvatarImg:{ width:54, height:54, borderRadius:27 },
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
  emptyReport:    { alignItems:'center', paddingVertical:Spacing.xl, marginBottom:Spacing.md },
  emptyReportIcon:{ fontSize:36, marginBottom:8 },
  emptyReportTxt: { fontSize:FontSize.sm, textAlign:'center' },
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
  sideAvatar:  { width:68, height:68, borderRadius:34, backgroundColor:'rgba(255,255,255,0.9)', alignItems:'center', justifyContent:'center', marginBottom:10, overflow:'hidden' },
  sideAvatarImg:{ width:68, height:68, borderRadius:34 },
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
