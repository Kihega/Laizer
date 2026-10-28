/**
 * Laizer — Owner: Full Report view (one branch, daily or weekly)
 * __LAIZER_PATCH_V12__ / V13 — shown as a full-screen modal from Reports (not a
 * navigator route), so it can never bounce back to the previous screen.
 *
 * Opened from Reports → tap a branch card. Shows everything the branch's
 * workers have recorded up to now: services, stock and office utilities.
 * Loads its own data, so any problem is shown on this screen with a Retry
 * button instead of a generic popup.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, RefreshControl, ScrollView, Share,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing    from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { apiClient, getApiError } from '@/services/api';
import { API_ROUTES } from '@/constants/api';
import { fmtMoney, serviceLabel } from '@/constants/labels';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

interface DetailRow {
  centre: { name: string; centreNo: string; centreId: string; location?: string };
  label: string;
  mode: string;
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
  equipment: Array<{ itemName: string; quantity: number; notes?: string | null }>;
}

function fmtWhen(iso: string, weekly: boolean) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-TZ', { hour: '2-digit', minute: '2-digit' });
  return weekly
    ? `${d.toLocaleDateString('en-TZ', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`
    : time;
}

function normalise(data: any): DetailRow {
  if (!data || typeof data !== 'object' || !data.centre) throw new Error('bad_shape');
  return {
    ...data,
    byServiceType: data.byServiceType ?? {},
    events:        Array.isArray(data.events)    ? data.events    : [],
    stock:         Array.isArray(data.stock)     ? data.stock     : [],
    equipment:     Array.isArray(data.equipment) ? data.equipment : [],
    totalEvents:      Number(data.totalEvents ?? 0),
    totalRevenueTshs: Number(data.totalRevenueTshs ?? 0),
  };
}

interface ReportDetailProps {
  centreId?: string;
  mode?: string;
  name?: string;
  centreNo?: string;
  onClose: () => void;
}

export function ReportDetail({ centreId, mode: modeProp, name, centreNo: centreNoProp, onClose }: ReportDetailProps) {
  const params = { name, centreNo: centreNoProp };
  const mode   = modeProp === 'weekly' ? 'weekly' : 'daily';

  const [row,        setRow]        = useState<DetailRow | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!centreId) { setError('No branch selected.'); setLoading(false); return; }
    setError(null);
    try {
      const res = await apiClient.get(API_ROUTES.reportDetail, { params: { centreId, mode } });
      setRow(normalise(res.data));
    } catch (e) {
      setError((e as Error)?.message === 'bad_shape'
        ? 'The server sent an unexpected response. Pull down to retry.'
        : getApiError(e, 'Could not load this report.'));
    } finally { setLoading(false); setRefreshing(false); }
  }, [centreId, mode]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const title    = row?.centre.name ?? params.name ?? 'Report';
  const centreNo = row?.centre.centreNo ?? params.centreNo ?? '';
  const subLabel = row?.label ?? (mode === 'weekly' ? 'This week' : 'Today');
  const weekly   = mode === 'weekly';
  const isEmpty  = !!row && row.events.length === 0 && row.stock.length === 0 && row.equipment.length === 0;

  const shareText = (r: DetailRow) => [
    `📊 ${r.centre.name} (${r.centre.centreNo}) — ${r.label}`,
    `Total Revenue: ${fmtMoney(r.totalRevenueTshs)}`,
    `Total Services: ${r.totalEvents}`,
    '',
    'Services:',
    ...Object.entries(r.byServiceType).map(([t, c]) => `  • ${serviceLabel(t)}: ${c}`),
    '',
    'Stock:',
    ...(r.stock.length ? r.stock.map(s => `  • ${s.itemName}: ${Number(s.quantity)} ${s.unit ?? 'pcs'}`) : ['  • none']),
    '',
    'Office utilities:',
    ...(r.equipment.length ? r.equipment.map(q => `  • ${q.itemName}: ${q.quantity}`) : ['  • none']),
  ].join('\n');

  const handleShare = async () => {
    if (!row) return;
    try { await Share.share({ message: shareText(row), title: `${row.centre.name} Report` }); }
    catch { /* user cancelled */ }
  };

  const handleDownload = async () => {
    if (!row) return;
    try {
      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!dir) throw new Error('No writable folder available.');
      const fname = `laizer_report_${row.centre.centreId}_${row.label.replace(/\s/g, '_')}.json`;
      const path  = `${dir}${fname}`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(row, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: `Save ${fname}` });
      } else {
        CustomAlert.alert('Saved', `Report saved to:\n${path}`);
      }
    } catch (e) {
      CustomAlert.alert('Error', `Could not save the file: ${(e as Error).message}`);
    }
  };

  return (
    <View style={D.root}>
      {/* Header */}
      <View style={D.header}>
        <TouchableOpacity onPress={() => onClose()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={D.title} numberOfLines={1}>{title}</Text>
          <Text style={D.sub}>{centreNo ? `${centreNo}  ·  ` : ''}{weekly ? 'Weekly' : 'Daily'}  ·  {subLabel}</Text>
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
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: Spacing.base, paddingBottom: 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          >
            {!!error && <Text style={D.staleNote}>Could not refresh — showing the last loaded data.</Text>}

            {/* Totals */}
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

            {/* By service type */}
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

            {/* Service log */}
            <View style={D.section}>
              <Text style={D.sectionTitle}>SERVICE LOG</Text>
              {row.events.length === 0 ? (
                <Text style={D.none}>No services recorded {weekly ? 'this week' : 'today'} yet.</Text>
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
                    <Text style={D.evtMeta}>{fmtWhen(ev.createdAt, weekly)}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Stock */}
            <View style={D.section}>
              <Text style={D.sectionTitle}>STOCK</Text>
              {row.stock.length === 0 ? (
                <Text style={D.none}>No stock registered.</Text>
              ) : row.stock.map((s, i) => (
                <View key={i} style={D.line}>
                  <Text style={[D.lineName, { flex: 1 }]}>{s.itemName}</Text>
                  <Text style={D.lineCount}>{Number(s.quantity)} {s.unit ?? 'pcs'}</Text>
                </View>
              ))}
            </View>

            {/* Office utilities */}
            <View style={D.section}>
              <Text style={D.sectionTitle}>OFFICE UTILITIES</Text>
              {row.equipment.length === 0 ? (
                <Text style={D.none}>No equipment registered.</Text>
              ) : row.equipment.map((q, i) => (
                <View key={i} style={D.line}>
                  <View style={{ flex: 1 }}>
                    <Text style={D.lineName}>{q.itemName}</Text>
                    {!!q.notes && <Text style={D.evtMeta}>{q.notes}</Text>}
                  </View>
                  <Text style={D.lineCount}>{q.quantity}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={D.actions}>
            <TouchableOpacity style={D.actionBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
              <Text style={D.actionTxt}>Share</Text>
            </TouchableOpacity>
            <View style={D.actionDivider} />
            <TouchableOpacity style={D.actionBtn} onPress={handleDownload}>
              <Ionicons name="download-outline" size={18} color={Colors.primary} />
              <Text style={D.actionTxt}>Download</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const D = StyleSheet.create({
  emptyTxt:     { textAlign: 'center', color: Colors.textDisabled, fontSize: FontSize.base, lineHeight: 22 },
  root:         { flex: 1, backgroundColor: Colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.primary },
  title:        { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  sub:          { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  hint:         { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: FontSize.sm },
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
  actions:      { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.backgroundCard, paddingBottom: Platform.OS === 'ios' ? 12 : 4 },
  actionBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  actionTxt:    { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.primary },
  actionDivider:{ width: 1, backgroundColor: Colors.border, marginVertical: 8 },
});
