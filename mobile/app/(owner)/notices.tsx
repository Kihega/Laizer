/**
 * SMSS — Owner: Notices Screen
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { noticeService, centreService, getApiError } from '@/services/api';
import { Card, Button, Input, StatusBadge } from '@/components/ui';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

const PRIORITIES = ['normal', 'urgent', 'low'] as const;

export default function NoticesOwnerScreen() {
  const [notices,    setNotices]    = useState<any[]>([]);
  const [centres,    setCentres]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form, setForm] = useState({ centreId:'', title:'', body:'', priority:'normal' as string });

  const load = useCallback(async () => {
    try {
      const [n, c] = await Promise.all([noticeService.list(), centreService.list()]);
      setNotices(n.data); setCentres(c.data);
      if (c.data.length > 0) setForm(p => ({ ...p, centreId: c.data[0].id }));
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleSend = async () => {
    if (!form.centreId || !form.title || !form.body) {
      Alert.alert('Missing fields', 'Title, message and centre are required.'); return;
    }
    setSaving(true);
    try {
      await noticeService.send(form);
      setShowForm(false); setForm(p => ({ ...p, title:'', body:'', priority:'normal' }));
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={NS.root}>
      <View style={NS.header}>
        <Text style={NS.title}>Notices</Text>
        <Button label="+ Send" size="sm" onPress={() => setShowForm(v => !v)} />
      </View>

      {showForm && (
        <Card style={NS.form}>
          <Text style={NS.formTitle}>Send Notice to Workers</Text>

          {/* Centre picker */}
          <Text style={NS.fieldLabel}>Target Centre</Text>
          <View style={NS.pickerRow}>
            {centres.map(c => (
              <View key={c.id} style={[NS.pill, form.centreId === c.id && NS.pillActive]}>
                <Text
                  style={[NS.pillText, form.centreId === c.id && NS.pillTextActive]}
                  onPress={() => setForm(p => ({ ...p, centreId: c.id }))}
                >
                  {c.centreNo}
                </Text>
              </View>
            ))}
          </View>

          <Input label="Title" placeholder="e.g. Price update for A4 paper" value={form.title}
            onChangeText={t => setForm(p => ({ ...p, title: t }))} />
          <Input label="Message" placeholder="Write your instructions here…" value={form.body}
            onChangeText={t => setForm(p => ({ ...p, body: t }))}
            multiline numberOfLines={4} style={{ height:90, textAlignVertical:'top' }} />

          {/* Priority */}
          <Text style={NS.fieldLabel}>Priority</Text>
          <View style={NS.pickerRow}>
            {PRIORITIES.map(p => (
              <View key={p} style={[NS.pill, form.priority === p && NS.pillActive]}>
                <Text style={[NS.pillText, form.priority === p && NS.pillTextActive]}
                  onPress={() => setForm(f => ({ ...f, priority: p }))}>
                  {p.charAt(0).toUpperCase()+p.slice(1)}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection:'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
            <Button label="Cancel" variant="secondary" onPress={() => setShowForm(false)} style={{ flex:1 }} />
            <Button label="Send Notice" onPress={handleSend} loading={saving} style={{ flex:1 }} />
          </View>
        </Card>
      )}

      {loading ? <ActivityIndicator style={{ marginTop:60 }} color={Colors.primary} /> : (
        <FlatList
          data={notices}
          keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding: Spacing.base }}
          ListEmptyComponent={<Text style={NS.empty}>No notices sent yet.</Text>}
          renderItem={({ item }) => (
            <Card style={NS.item}>
              <View style={NS.itemRow}>
                <Text style={NS.itemTitle} numberOfLines={1}>{item.title}</Text>
                <StatusBadge type={item.priority} size="sm" />
              </View>
              <Text style={NS.itemBody} numberOfLines={2}>{item.body}</Text>
              <View style={NS.itemFooter}>
                <Text style={NS.itemMeta}>
                  {item.centre?.name ?? '—'}  ·  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
                <Text style={NS.readCount}>{item._count?.reads ?? 0} read</Text>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const NS = StyleSheet.create({
  root:          { flex:1, backgroundColor: Colors.background },
  header:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding: Spacing.xl, paddingTop:60, backgroundColor: Colors.primary },
  title:         { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  form:          { margin: Spacing.base },
  formTitle:     { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  fieldLabel:    { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textSecondary, marginBottom: Spacing.xs },
  pickerRow:     { flexDirection:'row', flexWrap:'wrap', gap: Spacing.xs, marginBottom: Spacing.md },
  pill:          { paddingHorizontal: Spacing.sm, paddingVertical:5, borderRadius: Radius.full, borderWidth:1, borderColor: Colors.border, backgroundColor: Colors.grey100 },
  pillActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText:      { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  pillTextActive:{ color: Colors.white, fontWeight: FontWeight.bold },
  empty:         { textAlign:'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  item:          { marginBottom: Spacing.sm },
  itemRow:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: Spacing.xs },
  itemTitle:     { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex:1, marginRight: Spacing.sm },
  itemBody:      { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight:20 },
  itemFooter:    { flexDirection:'row', justifyContent:'space-between', marginTop: Spacing.sm },
  itemMeta:      { fontSize: FontSize.xs, color: Colors.textDisabled },
  readCount:     { fontSize: FontSize.xs, color: Colors.primary },
});
