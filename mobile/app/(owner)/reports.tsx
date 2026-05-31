/**
 * SMSS — Owner: Reports Screen (daily + weekly toggle)
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { reportService, getApiError } from '@/services/api';
import { Card } from '@/components/ui';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

type ReportMode = 'daily' | 'weekly';

function fmtMoney(n: number) { return `Tshs ${n.toLocaleString('en-TZ', { maximumFractionDigits:0 })}`; }

export default function ReportsScreen() {
  const [mode,    setMode]    = useState<ReportMode>('daily');
  const [data,    setData]    = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (m: ReportMode) => {
    setLoading(true);
    try {
      const res = m === 'daily' ? await reportService.daily() : await reportService.weekly();
      setData(res.data);
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(mode); }, [mode]);

  return (
    <View style={RS.root}>
      <View style={RS.header}>
        <Text style={RS.title}>Reports</Text>
        <View style={RS.toggle}>
          {(['daily','weekly'] as ReportMode[]).map(m => (
            <TouchableOpacity key={m} style={[RS.toggleBtn, mode===m && RS.toggleActive]} onPress={() => setMode(m)}>
              <Text style={[RS.toggleText, mode===m && RS.toggleTextActive]}>{m.charAt(0).toUpperCase()+m.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={{ flex:1, padding: Spacing.base }}>
        {loading ? <ActivityIndicator style={{ marginTop:60 }} color={Colors.primary} /> : (
          data.length === 0
            ? <Text style={RS.empty}>No data available.</Text>
            : data.map((row, i) => (
              <Card key={i} style={RS.card}>
                <Text style={RS.centreName}>{row.centre?.name ?? '—'}</Text>
                <Text style={RS.centreNo}>{row.centre?.centreNo}</Text>
                <View style={RS.stats}>
                  <StatItem label="Revenue"  value={fmtMoney(row.totalRevenueTshs ?? 0)} accent />
                  <StatItem label="Services" value={String(row.totalEvents ?? 0)} />
                  {row.topService && <StatItem label="Top Service" value={row.topService} />}
                </View>
                {row.byServiceType && Object.keys(row.byServiceType).length > 0 && (
                  <View style={RS.breakdown}>
                    {Object.entries(row.byServiceType).map(([type, count]) => (
                      <Text key={type} style={RS.breakdownRow}>
                        {type.charAt(0).toUpperCase()+type.slice(1)}: {count as number}
                      </Text>
                    ))}
                  </View>
                )}
              </Card>
            ))
        )}
        <View style={{ height:40 }} />
      </ScrollView>
    </View>
  );
}

function StatItem({ label, value, accent=false }: { label:string; value:string; accent?:boolean }) {
  return (
    <View style={{ flex:1, alignItems:'center' }}>
      <Text style={[RS.statValue, accent && { color: Colors.accent }]}>{value}</Text>
      <Text style={RS.statLabel}>{label}</Text>
    </View>
  );
}

const RS = StyleSheet.create({
  root:           { flex:1, backgroundColor: Colors.background },
  header:         { padding: Spacing.xl, paddingTop:60, backgroundColor: Colors.primary },
  title:          { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white, marginBottom: Spacing.md },
  toggle:         { flexDirection:'row', backgroundColor:'rgba(255,255,255,0.2)', borderRadius: Radius.md, padding:3 },
  toggleBtn:      { flex:1, height:34, alignItems:'center', justifyContent:'center', borderRadius: Radius.sm },
  toggleActive:   { backgroundColor: Colors.white },
  toggleText:     { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color:'rgba(255,255,255,0.8)' },
  toggleTextActive:{ color: Colors.primary },
  empty:          { textAlign:'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  card:           { marginBottom: Spacing.sm },
  centreName:     { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  centreNo:       { fontSize: FontSize.xs, color: Colors.textDisabled, marginBottom: Spacing.md },
  stats:          { flexDirection:'row', borderTopWidth:1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  statValue:      { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel:      { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop:2 },
  breakdown:      { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth:1, borderTopColor: Colors.divider },
  breakdownRow:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom:2 },
});
