/**
 * Laizer — Owner: Notices
 * Centre: dropdown by branch name. No title. Message: max 100 words.
 * Sent notices appear on targeted workers' screens only.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons }        from '@expo/vector-icons';
import { noticeService, centreService, getApiError } from '@/services/api';
import { Card, Button, Input, StatusBadge } from '@/components/ui';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

const PRIORITIES = ['normal', 'urgent', 'low'] as const;
const MAX_WORDS = 100;

function wordCount(txt: string) {
  return txt.trim().split(/\s+/).filter(Boolean).length;
}

export default function NoticesOwnerScreen() {
  const [notices,    setNotices]    = useState<any[]>([]);
  const [centres,    setCentres]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [showDrop,   setShowDrop]   = useState(false);
  const [form, setForm] = useState({ centreId:'', body:'', priority:'normal' as string });

  const load = useCallback(async () => {
    try {
      const [n, c] = await Promise.all([noticeService.list(), centreService.list()]);
      setNotices(n.data); setCentres(c.data);
      if (c.data.length > 0) setForm(p => ({ ...p, centreId: c.data[0].id }));
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const selectedCentre = centres.find(c => c.id === form.centreId);
  const wc = wordCount(form.body);
  const overLimit = wc > MAX_WORDS;

  const handleSend = async () => {
    if (!form.centreId || !form.body.trim()) {
      Alert.alert('Missing fields', 'Please select a centre and write a message.'); return;
    }
    if (overLimit) {
      Alert.alert('Too long', `Message exceeds ${MAX_WORDS} words (${wc} words).`); return;
    }
    setSaving(true);
    try {
      await noticeService.send({ centreId: form.centreId, body: form.body, priority: form.priority });
      setShowForm(false); setForm(p => ({ ...p, body:'', priority:'normal' }));
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={N.root}>
      <View style={N.header}>
        <Text style={N.title}>Notices</Text>
        <Button label="+ Send" size="sm" onPress={() => setShowForm(v => !v)} />
      </View>

      {showForm && (
        <Card style={N.form}>
          <Text style={N.formTitle}>Send Notice to Workers</Text>

          {/* Centre dropdown */}
          <Text style={N.fieldLabel}>Target Centre <Text style={{ color:Colors.error }}>*</Text></Text>
          <TouchableOpacity style={N.dropdown} onPress={() => setShowDrop(v => !v)}>
            <Ionicons name="storefront-outline" size={16} color={Colors.textSecondary} />
            <Text style={N.dropdownTxt} numberOfLines={1}>
              {selectedCentre ? `${selectedCentre.name}  (${selectedCentre.centreId})` : 'Select centre…'}
            </Text>
            <Ionicons name={showDrop ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textDisabled} />
          </TouchableOpacity>
          {showDrop && (
            <View style={N.dropList}>
              {centres.map(c => (
                <TouchableOpacity key={c.id} style={[N.dropItem, form.centreId===c.id && N.dropItemActive]}
                  onPress={() => { setForm(p => ({ ...p, centreId: c.id })); setShowDrop(false); }}>
                  <Text style={[N.dropItemTxt, form.centreId===c.id && { color:Colors.primary, fontWeight:FontWeight.bold }]}>
                    {c.name}
                  </Text>
                  <Text style={[N.dropItemId, form.centreId===c.id && { color:Colors.primaryLight }]}>
                    {c.centreId}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Message */}
          <View style={{ marginBottom:Spacing.xs }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:Spacing.xs }}>
              <Text style={N.fieldLabel}>Message <Text style={{ color:Colors.error }}>*</Text></Text>
              <Text style={[N.wordCnt, overLimit && { color:Colors.error }]}>
                {wc} / {MAX_WORDS} words
              </Text>
            </View>
            <Input placeholder="Write your instructions here…" value={form.body}
              onChangeText={t => setForm(p => ({ ...p, body: t }))}
              multiline numberOfLines={4}
              style={[{ height:90, textAlignVertical:'top' }, overLimit && { borderColor:Colors.error }]} />
          </View>

          {/* Priority */}
          <Text style={N.fieldLabel}>Priority</Text>
          <View style={N.pillRow}>
            {PRIORITIES.map(p => (
              <TouchableOpacity key={p} style={[N.pill, form.priority===p && N.pillActive]}
                onPress={() => setForm(f => ({ ...f, priority: p }))}>
                <Text style={[N.pillTxt, form.priority===p && N.pillTxtActive]}>
                  {p.charAt(0).toUpperCase()+p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection:'row', gap:Spacing.sm, marginTop:Spacing.sm }}>
            <Button label="Cancel"      variant="secondary" onPress={() => setShowForm(false)} style={{ flex:1 }} />
            <Button label="Send Notice" onPress={handleSend} loading={saving} style={{ flex:1 }} disabled={overLimit} />
          </View>
        </Card>
      )}

      {loading ? <ActivityIndicator style={{ marginTop:60 }} color={Colors.primary} /> : (
        <FlatList
          data={notices}
          keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding:Spacing.base }}
          ListEmptyComponent={<Text style={N.empty}>No notices sent yet.</Text>}
          renderItem={({ item }) => (
            <Card style={N.item}>
              <View style={N.itemRow}>
                <View style={{ flex:1, flexDirection:'row', alignItems:'center', gap:8 }}>
                  <Ionicons name="megaphone-outline" size={16} color={Colors.primary} />
                  <Text style={N.itemCentre} numberOfLines={1}>{item.centre?.name ?? '—'}</Text>
                </View>
                <StatusBadge type={item.priority} size="sm" />
              </View>
              <Text style={N.itemBody} numberOfLines={3}>{item.body}</Text>
              <View style={N.itemFooter}>
                <Text style={N.itemMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                <Text style={N.readCount}>{item._count?.reads ?? 0} read</Text>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const N = StyleSheet.create({
  root:         { flex:1, backgroundColor:Colors.background },
  header:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:Spacing.xl, paddingTop:60, backgroundColor:Colors.primary },
  title:        { fontSize:FontSize.xl, fontWeight:FontWeight.bold, color:Colors.white },
  form:         { margin:Spacing.base },
  formTitle:    { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.textPrimary, marginBottom:Spacing.md },
  fieldLabel:   { fontSize:FontSize.sm, fontWeight:FontWeight.semiBold, color:Colors.textSecondary, marginBottom:Spacing.xs },
  dropdown:     { flexDirection:'row', alignItems:'center', gap:8, height:48, borderWidth:1.5, borderColor:Colors.border, borderRadius:Radius.md, paddingHorizontal:Spacing.base, backgroundColor:Colors.white, marginBottom:Spacing.xs },
  dropdownTxt:  { flex:1, fontSize:FontSize.base, color:Colors.textPrimary },
  dropList:     { borderWidth:1, borderColor:Colors.border, borderRadius:Radius.md, backgroundColor:Colors.white, marginBottom:Spacing.md, overflow:'hidden' },
  dropItem:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:Spacing.base, paddingVertical:12, borderBottomWidth:1, borderBottomColor:Colors.grey100 },
  dropItemActive:{ backgroundColor:Colors.primarySurface },
  dropItemTxt:  { fontSize:FontSize.base, color:Colors.textPrimary },
  dropItemId:   { fontSize:FontSize.xs, color:Colors.textDisabled },
  wordCnt:      { fontSize:FontSize.xs, color:Colors.textDisabled, fontWeight:FontWeight.medium },
  pillRow:      { flexDirection:'row', gap:Spacing.xs, marginBottom:Spacing.md },
  pill:         { paddingHorizontal:Spacing.sm, paddingVertical:5, borderRadius:Radius.full, borderWidth:1, borderColor:Colors.border, backgroundColor:Colors.grey100 },
  pillActive:   { backgroundColor:Colors.primary, borderColor:Colors.primary },
  pillTxt:      { fontSize:FontSize.xs, color:Colors.textSecondary, fontWeight:FontWeight.medium },
  pillTxtActive:{ color:Colors.white, fontWeight:FontWeight.bold },
  empty:        { textAlign:'center', color:Colors.textDisabled, padding:Spacing['3xl'] },
  item:         { marginBottom:Spacing.sm },
  itemRow:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:Spacing.xs },
  itemCentre:   { fontSize:FontSize.sm, fontWeight:FontWeight.bold, color:Colors.textPrimary, flex:1 },
  itemBody:     { fontSize:FontSize.sm, color:Colors.textSecondary, lineHeight:20 },
  itemFooter:   { flexDirection:'row', justifyContent:'space-between', marginTop:Spacing.sm },
  itemMeta:     { fontSize:FontSize.xs, color:Colors.textDisabled },
  readCount:    { fontSize:FontSize.xs, color:Colors.primary },
});
