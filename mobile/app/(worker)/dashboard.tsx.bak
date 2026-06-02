/**
 * SMSS — Worker: Dashboard
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter }       from 'expo-router';
import { useAuthStore }    from '@/store/authStore';
import { useAuth }         from '@/hooks/useAuth';
import { serviceEventService, stockService, noticeService } from '@/services/api';
import { Card, StatusBadge }  from '@/components/ui';
import { BrandColors, Colors, FontSize, FontWeight, Radius, Spacing }          from '@/constants/theme';

function fmt(n: number) { return `Tshs ${n.toLocaleString('en-TZ',{maximumFractionDigits:0})}`; }

export default function WorkerDashboard() {
  const { user }   = useAuthStore();
  const { logout } = useAuth();
  const router     = useRouter();
  const [events,    setEvents]    = useState<any[]>([]);
  const [stockLow,  setStockLow]  = useState<any[]>([]);
  const [unreadCnt, setUnreadCnt] = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const load = useCallback(async () => {
    try {
      const [ev, st, nt] = await Promise.all([
        serviceEventService.list(),
        stockService.list(),
        noticeService.list(),
      ]);
      setEvents(ev.data);
      setStockLow(st.data.filter((i:any) => Number(i.quantity) < 5));
      setUnreadCnt(nt.data.filter((n:any) => !n.isRead).length);
    } catch (e) { console.error('[WorkerDash]', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const todayRevenue = events.reduce((s,e)=>s+Number(e.totalAmountTshs),0);

  return (
    <View style={WD.root}>
      <LinearGradient colors={[BrandColors.teal,'#0E7490']} style={WD.header}>
        <View style={WD.headerRow}>
          <View>
            <Text style={WD.greeting}>Hi, {user?.fullName?.split(' ')[0]} 👋</Text>
            <Text style={WD.sub}>Your service dashboard</Text>
          </View>
          <Text onPress={logout} style={WD.logout}>Logout</Text>
        </View>
        <View style={WD.statsRow}>
          <WStatCard label="Today's Revenue"  value={fmt(todayRevenue)}     icon="💰"/>
          <WStatCard label="Services Today"   value={String(events.length)} icon="📋"/>
          <WStatCard label="Unread Notices"   value={String(unreadCnt)}     icon="📢"/>
        </View>
      </LinearGradient>

      <ScrollView style={WD.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} />}
        showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator style={{marginTop:60}} color={Colors.primary}/> : (
          <>
            {/* Quick Actions */}
            <Text style={WD.section}>Quick Actions</Text>
            <View style={WD.actions}>
              {[
                {label:'Log Service', emoji:'✏️',  route:'/(worker)/services'},
                {label:'View Stock',  emoji:'📦', route:'/(worker)/stock'},
                {label:'Notices',     emoji:'📢', route:'/(worker)/notices'},
              ].map(a=>(
                <Card key={a.route} onPress={()=>router.push(a.route as any)} style={WD.actionCard}>
                  <Text style={WD.actionEmoji}>{a.emoji}</Text>
                  <Text style={WD.actionLabel}>{a.label}</Text>
                </Card>
              ))}
            </View>

            {/* Low stock warning */}
            {stockLow.length > 0 && (
              <>
                <Text style={WD.section}>⚠️  Low Stock Alert</Text>
                {stockLow.slice(0,3).map((item,i)=>(
                  <Card key={i} style={{marginBottom:Spacing.xs, borderLeftWidth:3, borderLeftColor:Colors.warning}}>
                    <Text style={WD.lowStockItem}>{item.itemName} — {Number(item.quantity)} {item.unit} remaining</Text>
                  </Card>
                ))}
              </>
            )}

            {/* Recent events */}
            {events.length > 0 && (
              <>
                <Text style={WD.section}>Today's Services</Text>
                {events.slice(0,5).map((e,i)=>(
                  <Card key={i} style={WD.eventCard}>
                    <View style={WD.eventRow}>
                      <StatusBadge type={e.serviceType} size="sm"/>
                      <Text style={WD.eventTotal}>{fmt(Number(e.totalAmountTshs))}</Text>
                    </View>
                    <Text style={WD.eventMeta}>
                      {e.pages ? `${e.pages} pages` : ''}{e.serviceSubtype ? ` · ${e.serviceSubtype.replace('_',' ')}` : ''}
                    </Text>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
        <View style={{height:40}}/>
      </ScrollView>
    </View>
  );
}
function WStatCard({label,value,icon}:{label:string;value:string;icon:string}) {
  return (
    <View style={WSS.card}>
      <Text style={WSS.icon}>{icon}</Text>
      <Text style={WSS.value}>{value}</Text>
      <Text style={WSS.label}>{label}</Text>
    </View>
  );
}
const WD = StyleSheet.create({
  root:        {flex:1,backgroundColor:Colors.background},
  header:      {paddingTop:60,paddingHorizontal:Spacing.xl,paddingBottom:Spacing['2xl']},
  headerRow:   {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:Spacing.xl},
  greeting:    {fontSize:FontSize.xl,fontWeight:FontWeight.bold,color:Colors.white},
  sub:         {fontSize:FontSize.sm,color:'rgba(255,255,255,0.7)',marginTop:2},
  logout:      {color:'rgba(255,255,255,0.7)',fontSize:FontSize.sm,paddingTop:4},
  statsRow:    {flexDirection:'row',gap:Spacing.sm},
  body:        {flex:1,padding:Spacing.xl},
  section:     {fontSize:FontSize.md,fontWeight:FontWeight.bold,color:Colors.textPrimary,marginBottom:Spacing.md,marginTop:Spacing.base},
  actions:     {flexDirection:'row',gap:Spacing.md,marginBottom:Spacing.sm},
  actionCard:  {flex:1,alignItems:'center',paddingVertical:Spacing.base},
  actionEmoji: {fontSize:28,marginBottom:Spacing.xs},
  actionLabel: {fontSize:FontSize.xs,fontWeight:FontWeight.semiBold,color:Colors.textPrimary,textAlign:'center'},
  lowStockItem:{fontSize:FontSize.sm,color:Colors.warning,fontWeight:FontWeight.medium},
  eventCard:   {marginBottom:Spacing.xs,paddingVertical:Spacing.sm},
  eventRow:    {flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  eventTotal:  {fontSize:FontSize.base,fontWeight:FontWeight.bold,color:Colors.accent},
  eventMeta:   {fontSize:FontSize.xs,color:Colors.textDisabled,marginTop:2},
});
const WSS = StyleSheet.create({
  card: {flex:1,backgroundColor:'rgba(255,255,255,0.15)',borderRadius:Radius.md,padding:Spacing.md,alignItems:'center'},
  icon: {fontSize:20,marginBottom:3},
  value:{fontSize:FontSize.md,fontWeight:FontWeight.black,color:Colors.white},
  label:{fontSize:9,color:'rgba(255,255,255,0.7)',textAlign:'center',marginTop:2},
});
