/**
 * Laizer — Owner: Reports Screen
 * Daily/weekly toggle. Tap a branch card → scrollable detail popup
 * with full service breakdown + stock snapshot + Share + Download.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Modal, Platform,
  ScrollView, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing    from 'expo-sharing';
import { Ionicons }    from '@expo/vector-icons';
import { reportService, getApiError } from '@/services/api';
import { Card } from '@/components/ui';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

type ReportMode = 'daily' | 'weekly';

function fmtMoney(n: number): string {
  return `Tshs ${Number(n).toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;
}

// ── Detail popup card ─────────────────────────────────────────────────────────
interface DetailRow {
  centre: { name: string; centreNo: string; centreId: string; location?: string };
  label: string;
  mode: string;
  totalEvents: number;
  totalRevenueTshs: number;
  byServiceType: Record<string, number>;
  events: Array<{
    id: string; serviceType: string; serviceSubtype?: string;
    pages?: number; pricePerPageTshs?: number; totalAmountTshs: number;
    customerNote?: string; createdAt: string;
    worker?: { fullName: string };
  }>;
  stock: Array<{ itemName: string; quantity: number; unit: string; netStockPriceTshs: number }>;
}

function DetailCard({
  visible, row, mode, onClose,
}: {
  visible: boolean; row: DetailRow | null; mode: ReportMode; onClose: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 600,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [visible]);

  if (!row) return null;

  const shareText = () => {
    const lines = [
      `📊 ${row.centre.name} (${row.centre.centreNo}) — ${row.label}`,
      `Total Revenue: ${fmtMoney(row.totalRevenueTshs)}`,
      `Total Services: ${row.totalEvents}`,
      '',
      'Services:',
      ...Object.entries(row.byServiceType).map(([t, c]) => `  • ${t}: ${c}`),
      '',
      'Stock Snapshot:',
      ...row.stock.map(s => `  • ${s.itemName}: ${s.quantity} ${s.unit}`),
    ];
    return lines.join('\n');
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: shareText(), title: `${row.centre.name} Report` });
    } catch { /* user cancelled */ }
  };

  const handleDownload = async () => {
    try {
      const json   = JSON.stringify(row, null, 2);
      const fname  = `laizer_report_${row.centre.centreId}_${row.label.replace(/\s/g,'_')}.json`;
      const path   = `${FileSystem.cacheDirectory}${fname}`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: `Save ${fname}` });
      } else {
        Alert.alert('Saved', `Report saved to:\n${path}`);
      }
    } catch (e) {
      Alert.alert('Error', `Could not save file: ${(e as Error).message}`);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={D.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[D.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={D.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={D.sheetTitle} numberOfLines={1}>{row.centre.name}</Text>
            <Text style={D.sheetSub}>{row.centre.centreNo}  ·  {row.label}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={D.closeBtn} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Totals row */}
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

        {/* Scrollable body */}
        <ScrollView style={D.body} showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 80 }}>

          {/* Service type breakdown */}
          {Object.keys(row.byServiceType).length > 0 && (
            <View style={D.section}>
              <Text style={D.sectionTitle}>BY SERVICE TYPE</Text>
              {Object.entries(row.byServiceType).map(([type, count]) => (
                <View key={type} style={D.svcRow}>
                  <Text style={D.svcName}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                  <Text style={D.svcCount}>{count as number}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Individual events */}
          {row.events.length > 0 && (
            <View style={D.section}>
              <Text style={D.sectionTitle}>SERVICE LOG</Text>
              {row.events.map(ev => (
                <View key={ev.id} style={D.evtRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={D.evtType}>
                      {ev.serviceType}{ev.serviceSubtype ? ` · ${ev.serviceSubtype}` : ''}
                    </Text>
                    {ev.worker && <Text style={D.evtMeta}>By {ev.worker.fullName}</Text>}
                    {ev.customerNote ? <Text style={D.evtNote}>{ev.customerNote}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={D.evtAmt}>{fmtMoney(Number(ev.totalAmountTshs))}</Text>
                    <Text style={D.evtMeta}>
                      {new Date(ev.createdAt).toLocaleTimeString('en-TZ', { hour:'2-digit', minute:'2-digit' })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Stock snapshot */}
          {row.stock.length > 0 && (
            <View style={D.section}>
              <Text style={D.sectionTitle}>STOCK SNAPSHOT</Text>
              {row.stock.map((s, i) => (
                <View key={i} style={D.stockRow}>
                  <Text style={D.stockName}>{s.itemName}</Text>
                  <Text style={D.stockQty}>{Number(s.quantity)} {s.unit}</Text>
                  <Text style={D.stockPrice}>{fmtMoney(Number(s.netStockPriceTshs))}</Text>
                </View>
              ))}
            </View>
          )}

          {row.events.length === 0 && row.stock.length === 0 && (
            <Text style={D.empty}>No data recorded for this period.</Text>
          )}
        </ScrollView>

        {/* Action buttons */}
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
      </Animated.View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const [mode,      setMode]      = useState<ReportMode>('daily');
  const [data,      setData]      = useState<unknown[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [selected,  setSelected]  = useState<DetailRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (m: ReportMode) => {
    setLoading(true);
    try {
      const res = m === 'daily' ? await reportService.daily() : await reportService.weekly();
      setData(res.data);
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(mode); }, [mode]);

  const openDetail = async (row: { centre?: { id?: string } }) => {
    const centreId = row?.centre?.id;
    if (!centreId) return;
    setDetailLoading(true);
    try {
      const res = await reportService.detail({ centreId, mode });
      setSelected(res.data as DetailRow);
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setDetailLoading(false); }
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

      {detailLoading && (
        <View style={RS.detailLoader}>
          <ActivityIndicator color={Colors.white} size="small" />
          <Text style={{ color: Colors.white, marginLeft: 8, fontSize: FontSize.sm }}>Loading report…</Text>
        </View>
      )}

      <ScrollView style={{ flex: 1, padding: Spacing.base }}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
        ) : data.length === 0 ? (
          <Text style={RS.empty}>No data available.</Text>
        ) : (
          (data as Array<Record<string, unknown>>).map((row, i) => (
            <TouchableOpacity key={i} activeOpacity={0.75} onPress={() => openDetail(row as { centre?: { id?: string } })}>
              <Card style={RS.card}>
                <View style={RS.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={RS.centreName}>{(row.centre as { name?: string })?.name ?? '—'}</Text>
                    <Text style={RS.centreNo}>{(row.centre as { centreNo?: string })?.centreNo}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textDisabled} />
                </View>
                <View style={RS.stats}>
                  <StatItem label="Revenue"  value={fmtMoney((row.totalRevenueTshs as number) ?? 0)} accent />
                  <StatItem label="Services" value={String((row.totalEvents as number) ?? 0)} />
                  {(row.topService as string) && <StatItem label="Top Service" value={row.topService as string} />}
                </View>
                {row.byServiceType && Object.keys(row.byServiceType as object).length > 0 && (
                  <View style={RS.breakdown}>
                    {Object.entries(row.byServiceType as Record<string, number>).map(([type, count]) => (
                      <Text key={type} style={RS.breakdownRow}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}: {count}
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

      <DetailCard
        visible={selected !== null}
        row={selected}
        mode={mode}
        onClose={() => setSelected(null)}
      />
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
  detailLoader:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
                     paddingHorizontal: Spacing.base, paddingVertical: 8 },
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

// Detail sheet styles
const D = StyleSheet.create({
  backdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:         { position: 'absolute', bottom: 0, left: 0, right: 0,
                   backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 20, borderTopRightRadius: 20,
                   maxHeight: '88%', shadowColor: '#000', shadowOffset: { width:0, height:-4 },
                   shadowOpacity: 0.15, shadowRadius: 12, elevation: 20 },
  sheetHeader:   { flexDirection: 'row', alignItems: 'center', padding: Spacing.base,
                   borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetTitle:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sheetSub:      { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  closeBtn:      { padding: 4 },
  totalsRow:     { flexDirection: 'row', backgroundColor: Colors.primarySurface,
                   marginHorizontal: Spacing.base, marginVertical: Spacing.sm, borderRadius: Radius.md },
  totalBox:      { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  totalVal:      { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  totalLbl:      { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  totalDivider:  { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  body:          { paddingHorizontal: Spacing.base },
  section:       { marginBottom: Spacing.md },
  sectionTitle:  { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textDisabled,
                   letterSpacing: 1, marginBottom: Spacing.sm },
  svcRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
                   borderBottomWidth: 1, borderBottomColor: Colors.divider },
  svcName:       { fontSize: FontSize.sm, color: Colors.textPrimary },
  svcCount:      { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  evtRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
                   borderBottomWidth: 1, borderBottomColor: Colors.divider },
  evtType:       { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  evtMeta:       { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: 2 },
  evtNote:       { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
  evtAmt:        { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.accent },
  stockRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
                   borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: 8 },
  stockName:     { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  stockQty:      { fontSize: FontSize.sm, color: Colors.textSecondary, minWidth: 60, textAlign: 'right' },
  stockPrice:    { fontSize: FontSize.sm, color: Colors.accent, minWidth: 80, textAlign: 'right' },
  empty:         { textAlign: 'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  actions:       { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border,
                   backgroundColor: Colors.backgroundCard, paddingBottom: Platform.OS === 'ios' ? 28 : 12 },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                   gap: 8, paddingVertical: 16 },
  actionTxt:     { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.primary },
  actionDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 8 },
});
