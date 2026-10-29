/**
 * Laizer — Worker Dashboard
 * Profile card: owner pic + brand name + branch info (no personal name).
 * __LAIZER_PATCH_V11__ — hamburger opens a side menu (light/dark mode, Sign Out),
 * matching the owner dashboard. No Change Password here — workers log in
 * with a Worker ID + Centre ID, not a password.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Image, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import type { ComponentProps } from 'react';
import { CustomAlert }    from '@/components/ui/CustomAlert';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter }      from 'expo-router';
import { useAuthStore }   from '@/store/authStore';
import { useAuth }        from '@/hooks/useAuth';
import { useTheme }       from '@/hooks/useTheme';
import { serviceEventService, noticeService } from '@/services/api';
import { Card }           from '@/components/ui';
import { BrandColors, Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

function fmt(n: number) { return `Tshs ${n.toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`; }

export let globalUnreadCount = 0;
export function setGlobalUnreadCount(n: number) { globalUnreadCount = n; }

export default function WorkerDashboard() {
  const { user: _user, centreInfo } = useAuthStore() as any;
  const { logout }           = useAuth();
  const { theme, setTheme, isDark, tc } = useTheme();
  const router               = useRouter();
  const [events,     setEvents]     = useState<any[]>([]);
  const [unreadCnt,  setUnreadCnt]  = useState(0);
  const [_loading,   setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Side menu
  const [sideOpen, setSideOpen] = useState(false);
  const sideAnim = useRef(new Animated.Value(-280)).current;
  const openSide  = () => { setSideOpen(true);  Animated.spring(sideAnim, { toValue:0,   useNativeDriver:true }).start(); };
  const closeSide = () => { Animated.spring(sideAnim, { toValue:-280, useNativeDriver:true }).start(() => setSideOpen(false)); };

  const load = useCallback(async () => {
    try {
      const [ev, nt] = await Promise.allSettled([
        serviceEventService.list(), noticeService.list(),
      ]);
      if (ev.status === 'fulfilled') setEvents(ev.value.data ?? []);
      if (nt.status === 'fulfilled') {
        const n = (nt.value.data ?? []).filter((n: any) => !n.isRead).length;
        setUnreadCnt(n); setGlobalUnreadCount(n);
      }
    } catch (e) { console.error('[WorkerDash]', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const revenue    = events.reduce((s, e) => s + Number(e.totalAmountTshs), 0);
  const brand      = centreInfo?.brandName      ?? 'Laizer Stationery';
  const branchName = centreInfo?.name           ?? 'Your Branch';
  const branchLoc  = centreInfo?.location       ?? '';
  const branchId   = centreInfo?.centreId       ?? '—';
  const ownerPic   = centreInfo?.profilePicture ?? null;

  return (
    <View style={[WD.root, { backgroundColor: tc.bg }]}>
      <LinearGradient colors={[BrandColors.teal, '#0E7490']} style={WD.header}>
        <TouchableOpacity onPress={openSide} style={WD.menuBtn} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
          <Ionicons name="menu-outline" size={26} color="white" />
        </TouchableOpacity>

        <View style={WD.card}>
          <View style={WD.avatar}>
            {ownerPic
              ? <Image source={{ uri: ownerPic }} style={WD.avatarImg} />
              : <View style={WD.avatarFallback}><Ionicons name="storefront" size={28} color={BrandColors.teal} /></View>}
          </View>
          <View style={{ flex:1 }}>
            <Text style={WD.brand} numberOfLines={1}>{brand}</Text>
            <Text style={WD.branchLine} numberOfLines={1}>📍 {branchName}{branchLoc ? ` · ${branchLoc}` : ''}</Text>
            <View style={WD.idRow}>
              <Text style={WD.idLabel}>Branch ID</Text>
              <Text style={WD.idVal}>{branchId}</Text>
            </View>
          </View>
        </View>

        <View style={WD.stats}>
          <Stat label="Today's Revenue"  value={fmt(revenue)}          icon="cash-outline" />
          <Stat label="Services Today"   value={String(events.length)} icon="list-outline" />
          <Stat label="Unread Notices"   value={String(unreadCnt)}     icon="megaphone-outline" />
        </View>
      </LinearGradient>

      <ScrollView style={WD.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        showsVerticalScrollIndicator={false}>
        <Text style={[WD.sectionTitle, { color: tc.text }]}>Quick Actions</Text>
        <View style={WD.actions}>
          {[
            { label:'Log Service', icon:'create-outline'    as const, route:'/(worker)/services' },
            { label:'View Stock',  icon:'cube-outline'      as const, route:'/(worker)/stock'    },
            { label:'Notices',     icon:'megaphone-outline' as const, route:'/(worker)/notices'  },
          ].map(a => (
            <Card key={a.route} onPress={() => router.push(a.route as any)}
              style={[WD.actionCard, { backgroundColor: tc.card, borderColor: tc.border }]}>
              <Ionicons name={a.icon} size={30} color={Colors.primary} style={{ marginBottom:6 }} />
              <Text style={[WD.actionLabel, { color: tc.text }]}>{a.label}</Text>
            </Card>
          ))}
        </View>
        <View style={{ height:40 }} />
      </ScrollView>

      {/* ── Side Menu ────────────────────────────────────────────────── */}
      {sideOpen && (
        <TouchableOpacity style={WD.sideOverlay} activeOpacity={1} onPress={closeSide} />
      )}
      {sideOpen && (
        <Animated.View style={[WD.sidebar, { transform:[{ translateX: sideAnim }], backgroundColor: isDark ? '#1F2937' : Colors.white }]}>
          <LinearGradient colors={[BrandColors.teal, '#0E7490']} style={WD.sideHeader}>
            <View style={WD.sideAvatar}>
              <Ionicons name="storefront" size={26} color={BrandColors.teal} />
            </View>
            <Text style={WD.sideName} numberOfLines={1}>{branchName}</Text>
            <Text style={WD.sideBrand} numberOfLines={1}>{brand}</Text>
          </LinearGradient>

          <View style={WD.sideMenu}>
            {/* Dark / Light mode */}
            <View style={WD.sideSection}>
              <Text style={[WD.sideSectionTitle, { color: isDark ? Colors.grey400 : Colors.textDisabled }]}>APPEARANCE</Text>
              <View style={WD.modeRow}>
                {(['light','dark'] as const).map(t => (
                  <TouchableOpacity key={t} style={[WD.modeBtn, theme===t && WD.modeBtnActive]}
                    onPress={() => setTheme(t)} activeOpacity={0.8}>
                    <Ionicons name={t==='light' ? 'sunny-outline' : 'moon-outline'} size={18}
                      color={theme===t ? Colors.white : (isDark ? Colors.grey300 : Colors.textSecondary)} />
                    <Text style={[WD.modeBtnTxt, theme===t && WD.modeBtnTxtActive]}>
                      {t.charAt(0).toUpperCase()+t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sign out */}
            <TouchableOpacity style={[WD.sideItem, WD.sideLogout]} onPress={() => {
              closeSide();
              setTimeout(() => CustomAlert.alert('Sign out', 'Are you sure you want to sign out?', [
                { text:'Cancel', style:'cancel' },
                { text:'Sign out', style:'destructive', onPress: logout },
              ]), 350);
            }}>
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
              <Text style={[WD.sideItemTxt, { color: Colors.error }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function Stat({ label, value, icon }: { label:string; value:string; icon: ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={WD.stat}>
      <Ionicons name={icon} size={20} color="rgba(255,255,255,0.85)" style={{ marginBottom:2 }} />
      <Text style={WD.statVal}>{value}</Text>
      <Text style={WD.statLbl}>{label}</Text>
    </View>
  );
}

const WD = StyleSheet.create({
  root:          { flex:1, backgroundColor:Colors.background },
  header:        { paddingTop:52, paddingHorizontal:Spacing.xl, paddingBottom:Spacing['2xl'] },
  menuBtn:       { alignSelf:'flex-start', marginBottom:Spacing.sm },
  card:          { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:Radius.xl, padding:Spacing.base, marginBottom:Spacing.xl },
  avatar:        { width:64, height:64, borderRadius:32, overflow:'hidden' },
  avatarImg:     { width:64, height:64 },
  avatarFallback:{ width:64, height:64, borderRadius:32, backgroundColor:'rgba(255,255,255,0.9)', alignItems:'center', justifyContent:'center' },
  brand:         { fontSize:FontSize.lg, fontWeight:FontWeight.black, color:Colors.white, letterSpacing:0.5, marginBottom:3 },
  branchLine:    { fontSize:FontSize.sm, color:'rgba(255,255,255,0.8)', marginBottom:4 },
  idRow:         { flexDirection:'row', alignItems:'center', gap:6 },
  idLabel:       { fontSize:FontSize.xs, color:'rgba(255,255,255,0.55)', fontWeight:FontWeight.semiBold },
  idVal:         { fontSize:FontSize.sm, fontWeight:FontWeight.bold, color:Colors.white, backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:8, paddingVertical:2, borderRadius:Radius.full },
  stats:         { flexDirection:'row', gap:Spacing.sm },
  stat:          { flex:1, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:Radius.md, padding:Spacing.md, alignItems:'center' },
  statVal:       { fontSize:FontSize.md, fontWeight:FontWeight.black, color:Colors.white },
  statLbl:       { fontSize:9, color:'rgba(255,255,255,0.7)', textAlign:'center', marginTop:1 },
  body:          { flex:1, padding:Spacing.xl },
  sectionTitle:  { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.textPrimary, marginBottom:Spacing.md, marginTop:Spacing.base },
  actions:       { flexDirection:'row', flexWrap:'wrap', gap:Spacing.md, marginBottom:Spacing.sm },
  actionCard:    { flexBasis:'45%', flexGrow:1, alignItems:'center', paddingVertical:Spacing.base },
  actionLabel:   { fontSize:FontSize.sm, fontWeight:FontWeight.semiBold, color:Colors.textPrimary, textAlign:'center' },
  // Side menu
  sideOverlay:   { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.45)', zIndex:10 },
  sidebar:       { position:'absolute', top:0, left:0, bottom:0, width:280, zIndex:11, elevation:20 },
  sideHeader:    { paddingTop:60, padding:Spacing.xl, alignItems:'center' },
  sideAvatar:    { width:68, height:68, borderRadius:34, backgroundColor:'rgba(255,255,255,0.9)', alignItems:'center', justifyContent:'center', marginBottom:10, overflow:'hidden' },
  sideName:      { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.white },
  sideBrand:     { fontSize:FontSize.sm, color:'rgba(255,255,255,0.8)', marginTop:2 },
  sideMenu:      { flex:1, padding:Spacing.xl },
  sideSection:   { marginBottom:Spacing.xl },
  sideSectionTitle:{ fontSize:10, fontWeight:FontWeight.bold, letterSpacing:1, marginBottom:Spacing.sm },
  modeRow:       { flexDirection:'row', gap:8 },
  modeBtn:       { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:10, borderRadius:Radius.md, borderWidth:1.5, borderColor:Colors.border },
  modeBtnActive: { backgroundColor:Colors.primary, borderColor:Colors.primary },
  modeBtnTxt:    { fontSize:FontSize.sm, color:Colors.textSecondary, fontWeight:FontWeight.medium },
  modeBtnTxtActive:{ color:Colors.white, fontWeight:FontWeight.bold },
  sideItem:      { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12 },
  sideItemTxt:   { fontSize:FontSize.base, fontWeight:FontWeight.medium },
  sideLogout:    { marginTop:'auto' },
});
