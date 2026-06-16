/**
 * Laizer — Worker Dashboard
 * Profile card: owner pic + brand name + branch info (no personal name).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Image, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter }      from 'expo-router';
import { useAuthStore }   from '@/store/authStore';
import { useAuth }        from '@/hooks/useAuth';
import { serviceEventService, stockService, noticeService } from '@/services/api';
import { Card }           from '@/components/ui';
import { BrandColors, Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

function fmt(n: number) { return `Tshs ${n.toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`; }

export let globalUnreadCount = 0;
export function setGlobalUnreadCount(n: number) { globalUnreadCount = n; }

export default function WorkerDashboard() {
  const { user: _user, centreInfo } = useAuthStore() as any;
  const { logout }           = useAuth();
  const router               = useRouter();
  const [events,     setEvents]     = useState<any[]>([]);
  const [stockLow,   setStockLow]   = useState<any[]>([]);
  const [unreadCnt,  setUnreadCnt]  = useState(0);
  const [_loading,   setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ev, st, nt] = await Promise.allSettled([
        serviceEventService.list(), stockService.list(), noticeService.list(),
      ]);
      if (ev.status === 'fulfilled') setEvents(ev.value.data ?? []);
      if (st.status === 'fulfilled') setStockLow((st.value.data ?? []).filter((i: any) => Number(i.quantity) < 5));
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
    <View style={WD.root}>
      <LinearGradient colors={[BrandColors.teal, '#0E7490']} style={WD.header}>
        <TouchableOpacity onPress={logout} style={WD.logout}>
          <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.75)" />
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
        <Text style={WD.sectionTitle}>Quick Actions</Text>
        <View style={WD.actions}>
          {[
            { label:'Log Service', icon:'create-outline'    as const, route:'/(worker)/services' },
            { label:'View Stock',  icon:'cube-outline'      as const, route:'/(worker)/stock'    },
            { label:'Notices',     icon:'megaphone-outline' as const, route:'/(worker)/notices'  },
          ].map(a => (
            <Card key={a.route} onPress={() => router.push(a.route as any)} style={WD.actionCard}>
              <Ionicons name={a.icon} size={30} color={Colors.primary} style={{ marginBottom:6 }} />
              <Text style={WD.actionLabel}>{a.label}</Text>
            </Card>
          ))}
        </View>
        {stockLow.length > 0 && (
          <>
            <Text style={WD.sectionTitle}>⚠️ Low Stock</Text>
            {stockLow.map((s, i) => (
              <Card key={i} style={WD.stockCard}>
                <Text style={WD.stockName}>{s.itemName}</Text>
                <Text style={WD.stockQty}>{s.quantity} left</Text>
              </Card>
            ))}
          </>
        )}
        <View style={{ height:40 }} />
      </ScrollView>
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
  logout:        { alignSelf:'flex-end', marginBottom:Spacing.sm },
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
  actions:       { flexDirection:'row', gap:Spacing.md, marginBottom:Spacing.sm },
  actionCard:    { flex:1, alignItems:'center', paddingVertical:Spacing.base },
  actionLabel:   { fontSize:FontSize.sm, fontWeight:FontWeight.semiBold, color:Colors.textPrimary, textAlign:'center' },
  stockCard:     { flexDirection:'row', justifyContent:'space-between', marginBottom:Spacing.xs },
  stockName:     { fontSize:FontSize.sm, fontWeight:FontWeight.semiBold, color:Colors.textPrimary },
  stockQty:      { fontSize:FontSize.sm, color:Colors.error, fontWeight:FontWeight.bold },
});
