/**
 * Laizer — Owner: Full report of ONE branch on ONE day
 * __LAIZER_PATCH_V16__
 *
 * Opened from a daily report card (BranchReports). Shows everything the
 * branch's workers recorded that day: totals, services by type and the full
 * service log — plus the stock on hand when the day is today. Loads its own
 * data, so any problem shows here with a Retry button.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reportService, getApiError } from '@/services/api';
import { fmtDay, fmtMoney, serviceLabel } from '@/constants/labels';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

interface DayReport {
  centre: { name: string; centreNo: string; centreId: string };
  date: string;
  isToday: boolean;
  totalEvents: number;
  totalRevenueTshs: number;
  byServiceType: Record<string, number>;
  events: Array<{
    id: string; serviceType: string; serviceSubtype?: string | null;
    pages?: number | null; pricePerPageTshs?: number | null; totalAmountTshs: number;
    createdAt: string;
    worker?: { fullName: string } | null;
  }>;
  stock: Array<{ itemName: string; quantity: number; unit?: string }>;
}

function normalise(data: any): DayReport {
  if (!data || typeof data !== 'object' || !data.centre) throw new Error('bad_shape');
  return {
    ...data,
    byServiceType:    data.byServiceType ?? {},
    events:           Array.isArray(data.events) ? data.events : [],
    stock:            Array.isArray(data.stock)  ? data.stock  : [],
    totalEvents:      Number(data.totalEvents ?? 0),
    totalRevenueTshs: Number(data.totalRevenueTshs ?? 0),
  };
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-TZ', { hour: '2-digit', minute: '2-digit' });

interface Props {
  centreId: string;
  date: string;            // YYYY-MM-DD
  name?: string;
  centreNo?: string;
  onClose: () => void;
}

export function ReportDetail({ centreId, date, name, centreNo: centreNoProp, onClose }: Props) {
  const [row,        setRow]        = useState<DayReport | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await reportService.detail(centreId, date);
      setRow(normalise(res.data));
    } catch (e) {
      setError((e as Error)?.message === 'bad_shape'
        ? 'The server sent an unexpected response. Pull down to retry.'
        : getApiError(e, 'Could not load this report.'));
    } finally { setLoading(false); setRefreshing(false); }
  }, [centreId, date]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const title    = row?.centre.name ?? name ?? 'Report';
  const centreNo = row?.centre.centreNo ?? centreNoProp ?? '';
  const isEmpty  = !!row && row.events.length === 0 && row.stock.length === 0;

  return (
    <View style={D.root}>
      <View style={D.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={D.title} numberOfLines={1}>{title}</Text>
          <Text style={D.sub}>{centreNo ? `${centreNo}  ·  ` : ''}{fmtDay(date)}</Text>
        </View>
      </View>

      {loading ? (
        <View style={D.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={D.hint}>Loading report…</Text>
        </View>
      ) : error && !row ? (
        <View style={D.center}>
          <Ionicons name="alert-circle-outline" size={42} color={Colors.error} />
          <Text style={D.errTxt}>{error}</Text>
          <TouchableOpacity style={D.retry} onPress={() => { setLoading(true); load(); }}>
            <Text style={D.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : row && isEmpty ? (
        <View style={D.center}>
          <Text style={D.emptyTxt}>No reports yet.</Text>
        </View>
      ) : row && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Spacing.base, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {!!error && <Text style={D.staleNote}>Could not refresh — showing the last loaded data.</Text>}

          <View style={D.totalsRow}>
            <View style={D.totalBox}>
              <Text style={D.totalVal}>{fmtMoney(row.totalRevenueTshs)}</Text>
              <Text style={D.totalLbl}>Total Revenue</Text>
            </View>
            <View style={D.totalDivider} />
            <View style={D.totalBox}>
              <Text style={D.totalVal}>{row.totalEvents}</Text>
              <Text style={D.totalLbl}>Services</Text>
            </View>
          </View>

          {Object.keys(row.byServiceType).length > 0 && (
            <View style={D.section}>
              <Text style={D.sectionTitle}>BY SERVICE TYPE</Text>
              {Object.entries(row.byServiceType).map(([type, count]) => (
                <View key={type} style={D.line}>
                  <Text style={D.lineName}>{serviceLabel(type)}</Text>
                  <Text style={D.lineCount}>{count}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={D.section}>
            <Text style={D.sectionTitle}>SERVICE LOG</Text>
            {row.events.length === 0 ? (
              <Text style={D.none}>No services recorded.</Text>
            ) : row.events.map(ev => (
              <View key={ev.id} style={D.evtRow}>
                <View style={{ flex: 1 }}>
                  <Text style={D.evtType}>
                    {serviceLabel(ev.serviceType)}
                    {ev.serviceSubtype ? ` · ${ev.serviceSubtype === 'black_and_white' ? 'B&W' : 'Colour'}` : ''}
                  </Text>
                  {ev.pages != null && (
                    <Text style={D.evtMeta}>
                      {ev.pages} pages{ev.pricePerPageTshs != null ? ` @ ${fmtMoney(Number(ev.pricePerPageTshs))}` : ''}
                    </Text>
                  )}
                  {!!ev.worker && <Text style={D.evtMeta}>By {ev.worker.fullName}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={D.evtAmt}>{fmtMoney(Number(ev.totalAmountTshs))}</Text>
                  <Text style={D.evtMeta}>{fmtTime(ev.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>

          {row.isToday && (
            <View style={D.section}>
              <Text style={D.sectionTitle}>STOCK ON HAND</Text>
              {row.stock.length === 0 ? (
                <Text style={D.none}>No stock registered.</Text>
              ) : row.stock.map((s, i) => (
                <View key={i} style={D.line}>
                  <Text style={[D.lineName, { flex: 1 }]}>{s.itemName}</Text>
                  <Text style={D.lineCount}>{Number(s.quantity)} {s.unit ?? 'pcs'}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const D = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.primary },
  title:        { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  sub:          { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  hint:         { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: FontSize.sm },
  emptyTxt:     { textAlign: 'center', color: Colors.textDisabled, fontSize: FontSize.base, lineHeight: 22 },
  errTxt:       { marginTop: Spacing.md, textAlign: 'center', color: Colors.textSecondary, fontSize: FontSize.base, lineHeight: 22 },
  retry:        { marginTop: Spacing.base, paddingVertical: 10, paddingHorizontal: 28, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary },
  retryTxt:     { color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  staleNote:    { fontSize: FontSize.xs, color: Colors.warning, marginBottom: Spacing.sm, textAlign: 'center' },
  totalsRow:    { flexDirection: 'row', backgroundColor: Colors.primarySurface, borderRadius: Radius.md, marginBottom: Spacing.base },
  totalBox:     { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  totalVal:     { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  totalLbl:     { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  totalDivider: { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  section:      { backgroundColor: Colors.backgroundCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.base, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textDisabled, letterSpacing: 1, marginBottom: Spacing.sm },
  none:         { fontSize: FontSize.sm, color: Colors.textDisabled, fontStyle: 'italic' },
  line:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: 8 },
  lineName:     { fontSize: FontSize.sm, color: Colors.textPrimary },
  lineCount:    { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  evtRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  evtType:      { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  evtMeta:      { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: 2 },
  evtAmt:       { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.accent },
});
