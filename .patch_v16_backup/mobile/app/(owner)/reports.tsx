/**
 * Laizer — Owner: Reports Screen
 * Daily/weekly toggle. Tap a branch card → its full report opens on its
 * own screen (app/(owner)/report-detail.tsx).
 * __LAIZER_PATCH_V12__
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons }  from '@expo/vector-icons';
import { CustomAlert } from '@/components/ui/CustomAlert'; // __LAIZER_PATCH_V10__
import { reportService, getApiError } from '@/services/api';
import { Card } from '@/components/ui';
import { ReportDetail } from '@/components/ReportDetail';
import { fmtMoney, serviceLabel } from '@/constants/labels';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

type ReportMode = 'daily' | 'weekly';

interface ReportRow {
  centre?: { id?: string; name?: string; centreNo?: string };
  totalRevenueTshs?: number;
  totalEvents?: number;
  topService?: string | null;
  byServiceType?: Record<string, number>;
}

export default function ReportsScreen() {
  const [mode,       setMode]       = useState<ReportMode>('daily');
  const [data,       setData]       = useState<ReportRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detail,     setDetail]     = useState<{ centreId: string; mode: ReportMode; name: string; centreNo: string } | null>(null);

  const load = useCallback(async (m: ReportMode) => {
    try {
      const res = m === 'daily' ? await reportService.daily() : await reportService.weekly();
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { setLoading(true); load(mode); }, [mode, load]);

  // The full report is a separate screen: it loads its own data, shows its own
  // loading / error state, and has a back button.
  const openDetail = (row: ReportRow) => {
    const centreId = row?.centre?.id;
    if (!centreId) return;
    setDetail({
      centreId,
      mode,
      name:     row.centre?.name ?? '',
      centreNo: row.centre?.centreNo ?? '',
    });
  };

  return (
    <View style={RS.root}>
      <View style={RS.header}>
        <Text style={RS.title}>Reports</Text>
        <View style={RS.toggle}>
          {(['daily', 'weekly'] as ReportMode[]).map(m => (
            <TouchableOpacity
              key={m}
              style={[RS.toggleBtn, mode === m && RS.toggleActive]}
              onPress={() => setMode(m)}>
              <Text style={[RS.toggleText, mode === m && RS.toggleTextActive]}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, padding: Spacing.base }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(mode); }} />}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
        ) : data.length === 0 ? (
          <Text style={RS.empty}>No data available.</Text>
        ) : (
          data.map((row, i) => (
            <TouchableOpacity key={row.centre?.id ?? i} activeOpacity={0.75} onPress={() => openDetail(row)}>
              <Card style={RS.card}>
                <View style={RS.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={RS.centreName}>{row.centre?.name ?? '—'}</Text>
                    <Text style={RS.centreNo}>{row.centre?.centreNo}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textDisabled} />
                </View>
                <View style={RS.stats}>
                  <StatItem label="Revenue"  value={fmtMoney(row.totalRevenueTshs ?? 0)} accent />
                  <StatItem label="Services" value={String(row.totalEvents ?? 0)} />
                  {!!row.topService && <StatItem label="Top Service" value={serviceLabel(row.topService)} />}
                </View>
                {!!row.byServiceType && Object.keys(row.byServiceType).length > 0 && (
                  <View style={RS.breakdown}>
                    {Object.entries(row.byServiceType).map(([type, count]) => (
                      <Text key={type} style={RS.breakdownRow}>
                        {serviceLabel(type)}: {count}
                      </Text>
                    ))}
                  </View>
                )}
                <Text style={RS.tapHint}>Tap for full report</Text>
              </Card>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full report — opens as its own full screen on top of this list */}
      <Modal
        visible={!!detail}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setDetail(null)}
      >
        {detail && (
          <ReportDetail
            centreId={detail.centreId}
            mode={detail.mode}
            name={detail.name}
            centreNo={detail.centreNo}
            onClose={() => setDetail(null)}
          />
        )}
      </Modal>
    </View>
  );
}

function StatItem({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[RS.statValue, accent && { color: Colors.accent }]}>{value}</Text>
      <Text style={RS.statLabel}>{label}</Text>
    </View>
  );
}

const RS = StyleSheet.create({
  root:            { flex: 1, backgroundColor: Colors.background },
  header:          { padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.primary },
  title:           { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white, marginBottom: Spacing.md },
  toggle:          { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.md, padding: 3 },
  toggleBtn:       { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  toggleActive:    { backgroundColor: Colors.white },
  toggleText:      { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: 'rgba(255,255,255,0.8)' },
  toggleTextActive:{ color: Colors.primary },
  empty:           { textAlign: 'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  card:            { marginBottom: Spacing.sm },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  centreName:      { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  centreNo:        { fontSize: FontSize.xs, color: Colors.textDisabled, marginBottom: Spacing.md },
  stats:           { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  statValue:       { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel:       { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  breakdown:       { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider },
  breakdownRow:    { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  tapHint:         { fontSize: FontSize.xs, color: Colors.primary, marginTop: Spacing.sm, textAlign: 'right' },
});
