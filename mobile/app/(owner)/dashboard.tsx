/**
 * SMSS — Owner Dashboard
 * Shows daily revenue totals, centre count, and quick-action cards.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter }       from 'expo-router';
import { useAuthStore }    from '@/store/authStore';
import { useAuth }         from '@/hooks/useAuth';
import { reportService, centreService } from '@/services/api';
import { Card }            from '@/components/ui';
import { BrandColors, Colors, FontSize, FontWeight, Radius, Spacing }          from '@/constants/theme';

function fmt(n: number) {
  return `Tshs ${n.toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;
}

export default function OwnerDashboard() {
  const { user }                 = useAuthStore();
  const { logout }               = useAuth();
  const router                   = useRouter();
  const [report,    setReport]   = useState<any[]>([]);
  const [centres,   setCentres]  = useState<any[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [refreshing,setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rpt, ctr] = await Promise.all([
        reportService.daily(),
        centreService.list(),
      ]);
      setReport(rpt.data);
      setCentres(ctr.data);
    } catch (e) {
      console.error('[Dashboard]', e);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const totalRevenue  = report.reduce((s, r) => s + (r.totalRevenueTshs ?? 0), 0);
  const totalEvents   = report.reduce((s, r) => s + (r.totalEvents ?? 0), 0);
  const activeCentres = centres.length;

  return (
    <View style={S.root}>
      {/* Header */}
      <LinearGradient colors={[BrandColors.blueDark, BrandColors.blue]} style={S.header}>
        <View style={S.headerRow}>
          <View>
            <Text style={S.greeting}>Good day, {user?.fullName?.split(' ')[0]} 👋</Text>
            <Text style={S.subGreeting}>Here's today's overview</Text>
          </View>
          <Text onPress={logout} style={S.logoutBtn}>Logout</Text>
        </View>

        {/* Stat cards */}
        <View style={S.statsRow}>
          <StatCard label="Today's Revenue" value={fmt(totalRevenue)} icon="💰" />
          <StatCard label="Services Logged" value={String(totalEvents)} icon="📋" />
          <StatCard label="Active Centres"  value={String(activeCentres)} icon="🏪" />
        </View>
      </LinearGradient>

      {/* Body */}
      <ScrollView
        style={S.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator style={S.loader} color={Colors.primary} size="large" />
        ) : (
          <>
            {/* Quick actions */}
            <Text style={S.sectionTitle}>Quick Actions</Text>
            <View style={S.actions}>
              {[
                { label:'View Centres',  emoji:'🏪', route:'/(owner)/centres'  },
                { label:'Manage Workers',emoji:'👥', route:'/(owner)/workers'  },
                { label:'Daily Report',  emoji:'📊', route:'/(owner)/reports'  },
                { label:'Send Notice',   emoji:'📢', route:'/(owner)/notices'  },
              ].map(a => (
                <Card key={a.route} onPress={() => router.push(a.route as any)} style={S.actionCard}>
                  <Text style={S.actionEmoji}>{a.emoji}</Text>
                  <Text style={S.actionLabel}>{a.label}</Text>
                </Card>
              ))}
            </View>

            {/* Per-centre summary */}
            {report.length > 0 && (
              <>
                <Text style={S.sectionTitle}>Today by Centre</Text>
                {report.map((r, i) => (
                  <Card key={i} style={S.centreCard}>
                    <View style={S.centreCardRow}>
                      <Text style={S.centreName}>{r.centre?.name ?? '—'}</Text>
                      <Text style={S.centreNo}>{r.centre?.centreNo}</Text>
                    </View>
                    <View style={S.centreStats}>
                      <Text style={S.centreRev}>{fmt(r.totalRevenueTshs)}</Text>
                      <Text style={S.centreEvents}>{r.totalEvents} services</Text>
                    </View>
                    {r.topService && (
                      <Text style={S.topService}>Top: {r.topService}</Text>
                    )}
                  </Card>
                ))}
              </>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={SS.card}>
      <Text style={SS.icon}>{icon}</Text>
      <Text style={SS.value}>{value}</Text>
      <Text style={SS.label}>{label}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  root:         { flex:1, backgroundColor: Colors.background },
  header:       { paddingTop:60, paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
  headerRow:    { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom: Spacing.xl },
  greeting:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  subGreeting:  { fontSize: FontSize.sm, color:'rgba(255,255,255,0.7)', marginTop:2 },
  logoutBtn:    { color:'rgba(255,255,255,0.7)', fontSize: FontSize.sm, paddingTop:4 },
  statsRow:     { flexDirection:'row', gap: Spacing.sm },
  body:         { flex:1, padding: Spacing.xl },
  loader:       { marginTop: Spacing['3xl'] },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md, marginTop: Spacing.base },
  actions:      { flexDirection:'row', flexWrap:'wrap', gap: Spacing.md, marginBottom: Spacing.sm },
  actionCard:   { width:'47%', alignItems:'center', paddingVertical: Spacing.base },
  actionEmoji:  { fontSize:32, marginBottom: Spacing.xs },
  actionLabel:  { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textPrimary, textAlign:'center' },
  centreCard:   { marginBottom: Spacing.sm },
  centreCardRow:{ flexDirection:'row', justifyContent:'space-between', marginBottom: Spacing.xs },
  centreName:   { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  centreNo:     { fontSize: FontSize.xs, color: Colors.textDisabled, backgroundColor: Colors.grey100, paddingHorizontal:6, paddingVertical:2, borderRadius: Radius.full },
  centreStats:  { flexDirection:'row', justifyContent:'space-between', marginTop: Spacing.xs },
  centreRev:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.accent },
  centreEvents: { fontSize: FontSize.sm, color: Colors.textSecondary },
  topService:   { fontSize: FontSize.xs, color: Colors.primary, marginTop: Spacing.xs },
});
const SS = StyleSheet.create({
  card:  { flex:1, backgroundColor:'rgba(255,255,255,0.15)', borderRadius: Radius.md, padding: Spacing.md, alignItems:'center' },
  icon:  { fontSize:22, marginBottom:4 },
  value: { fontSize: FontSize.lg, fontWeight: FontWeight.black, color: Colors.white },
  label: { fontSize:10, color:'rgba(255,255,255,0.7)', textAlign:'center', marginTop:2 },
});
