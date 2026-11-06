/**
 * Laizer — Owner: a branch's daily report cards
 * __LAIZER_PATCH_V16__
 *
 * Shows the 7 most recent days that have records (fewer if there are fewer;
 * days without records get no card), newest first. The history icon in the top
 * bar switches to every day that has records. Each card has an Open button
 * (full report of that day) and a Delete button (removes that day's records).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { Card } from '@/components/ui';
import { reportService, getApiError } from '@/services/api';
import { fmtDay, fmtMoney } from '@/constants/labels';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

interface DayCard { date: string; totalEvents: number; totalRevenueTshs: number }

interface Props {
  centreId: string;
  name: string;
  centreNo: string;
  onClose: () => void;
  onOpenDay: (date: string) => void;
}

export function BranchReports({ centreId, name, centreNo, onClose, onOpenDay }: Props) {
  const [days,       setDays]       = useState<DayCard[]>([]);
  const [today,      setToday]      = useState('');
  const [showAll,    setShowAll]    = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await reportService.days(centreId, showAll);
      setDays(Array.isArray(data?.days) ? data.days : []);
      setToday(String(data?.today ?? ''));
    } catch (e) {
      setError(getApiError(e, 'Could not load the reports.'));
    } finally { setLoading(false); setRefreshing(false); }
  }, [centreId, showAll]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const confirmDelete = (d: DayCard) => {
    CustomAlert.alert(
      'Delete report',
      `Delete the report of ${fmtDay(d.date)}? All ${d.totalEvents} service record${d.totalEvents === 1 ? '' : 's'} of that day will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await reportService.removeDay(centreId, d.date);
              await load();
            } catch (e) { CustomAlert.alert('Error', getApiError(e)); }
          },
        },
      ],
    );
  };

  return (
    <View style={B.root}>
      <View style={B.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={B.title} numberOfLines={1}>{name}</Text>
          <Text style={B.sub}>{centreNo ? `${centreNo}  ·  ` : ''}{showAll ? 'All history' : 'Latest reports'}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowAll(v => !v)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={showAll ? 'Show last 7 days' : 'Show history'}
          style={[B.histBtn, showAll && B.histBtnOn]}
        >
          <Ionicons name={showAll ? 'time' : 'time-outline'} size={22} color={showAll ? Colors.primary : Colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
      ) : error && days.length === 0 ? (
        <View style={B.center}>
          <Ionicons name="alert-circle-outline" size={42} color={Colors.error} />
          <Text style={B.errTxt}>{error}</Text>
          <TouchableOpacity style={B.retry} onPress={() => { setLoading(true); load(); }}>
            <Text style={B.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Spacing.base, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {days.length === 0 ? (
            <Text style={B.empty}>No reports yet.</Text>
          ) : days.map(d => (
            <TouchableOpacity key={d.date} activeOpacity={0.75} onPress={() => onOpenDay(d.date)}>
              <Card style={B.card}>
                <View style={{ flex: 1 }}>
                  <View style={B.dateRow}>
                    <Text style={B.date}>{fmtDay(d.date)}</Text>
                    {d.date === today && <Text style={B.todayPill}>Today</Text>}
                  </View>
                  <Text style={B.meta}>
                    {d.totalEvents} service{d.totalEvents === 1 ? '' : 's'}  ·  {fmtMoney(d.totalRevenueTshs)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => onOpenDay(d.date)}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  accessibilityLabel="Open report"
                  style={B.iconBtn}
                >
                  <Ionicons name="document-text-outline" size={22} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(d)}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  accessibilityLabel="Delete report"
                  style={B.iconBtn}
                >
                  <Ionicons name="trash-outline" size={22} color={Colors.error} />
                </TouchableOpacity>
              </Card>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const B = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.background },
  header:    { flexDirection: 'row', alignItems: 'center', padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.primary },
  title:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  sub:       { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  histBtn:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  histBtnOn: { backgroundColor: Colors.white },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  errTxt:    { marginTop: Spacing.md, textAlign: 'center', color: Colors.textSecondary, fontSize: FontSize.base, lineHeight: 22 },
  retry:     { marginTop: Spacing.base, paddingVertical: 10, paddingHorizontal: 28, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary },
  retryTxt:  { color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  empty:     { textAlign: 'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  card:      { marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center' },
  dateRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  date:      { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  todayPill: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary,
               backgroundColor: Colors.primarySurface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  meta:      { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  iconBtn:   { padding: 6, marginLeft: Spacing.xs },
});
