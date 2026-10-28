/**
 * Laizer — Owner: Reports
 * __LAIZER_PATCH_V16__
 *
 * Branch list (today's totals). Tap a branch → its daily report cards (last 7
 * days; history icon for older days) → open a day for the full report.
 * Everything opens as a full-screen modal over this list, so there is nothing
 * to navigate back through and no route can bounce.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons }  from '@expo/vector-icons';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { reportService, getApiError } from '@/services/api';
import { Card } from '@/components/ui';
import { BranchReports } from '@/components/BranchReports';
import { ReportDetail }  from '@/components/ReportDetail';
import { fmtMoney, serviceLabel } from '@/constants/labels';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

interface ReportRow {
  centre?: { id?: string; name?: string; centreNo?: string };
  totalRevenueTshs?: number;
  totalEvents?: number;
  topService?: string | null;
  byServiceType?: Record<string, number>;
}

interface Branch { centreId: string; name: string; centreNo: string }

export default function ReportsScreen() {
  const [data,       setData]       = useState<ReportRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [branch,     setBranch]     = useState<Branch | null>(null);   // open branch → its daily cards
  const [openDate,   setOpenDate]   = useState<string | null>(null);   // open day → full report

  const load = useCallback(async () => {
    try {
      const res = await reportService.daily();
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openBranch = (row: ReportRow) => {
    const centreId = row?.centre?.id;
    if (!centreId) return;
    setBranch({ centreId, name: row.centre?.name ?? '', centreNo: row.centre?.centreNo ?? '' });
  };

  // Android back button: day report → day cards → list
  const goBack = () => {
    if (openDate) setOpenDate(null);
    else { setBranch(null); load(); }   // refresh today's totals in case a day was deleted
  };

  return (
    <View style={RS.root}>
      <View style={RS.header}>
        <Text style={RS.title}>Reports</Text>
      </View>

      <ScrollView
        style={{ flex: 1, padding: Spacing.base }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
        ) : data.length === 0 ? (
          <Text style={RS.empty}>No data available.</Text>
        ) : (
          data.map((row, i) => (
            <TouchableOpacity key={row.centre?.id ?? i} activeOpacity={0.75} onPress={() => openBranch(row)}>
              <Card style={RS.card}>
                <View style={RS.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={RS.centreName}>{row.centre?.name ?? '—'}</Text>
                    <Text style={RS.centreNo}>{row.centre?.centreNo}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textDisabled} />
                </View>
                <View style={RS.stats}>
                  <StatItem label="Revenue today"  value={fmtMoney(row.totalRevenueTshs ?? 0)} accent />
                  <StatItem label="Services" value={String(row.totalEvents ?? 0)} />
                  {!!row.topService && <StatItem label="Top Service" value={serviceLabel(row.topService)} />}
                </View>
                <Text style={RS.tapHint}>Tap for full report</Text>
              </Card>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={!!branch} animationType="slide" statusBarTranslucent onRequestClose={goBack}>
        {branch && (openDate ? (
          <ReportDetail
            centreId={branch.centreId}
            date={openDate}
            name={branch.name}
            centreNo={branch.centreNo}
            onClose={() => setOpenDate(null)}
          />
        ) : (
          <BranchReports
            centreId={branch.centreId}
            name={branch.name}
            centreNo={branch.centreNo}
            onClose={goBack}
            onOpenDay={setOpenDate}
          />
        ))}
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
  root:       { flex: 1, backgroundColor: Colors.background },
  header:     { padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.primary },
  title:      { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  empty:      { textAlign: 'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  card:       { marginBottom: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  centreName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  centreNo:   { fontSize: FontSize.xs, color: Colors.textDisabled, marginBottom: Spacing.md },
  stats:      { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  statValue:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel:  { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  tapHint:    { fontSize: FontSize.xs, color: Colors.primary, marginTop: Spacing.sm, textAlign: 'right' },
});
