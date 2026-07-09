/**
 * Laizer — Owner: Workers
 * Cards show Change Branch (swap icon) and Delete (trash icon).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { workerService, centreService, getApiError } from '@/services/api';
import { Card, Button, Input, StatusBadge } from '@/components/ui';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

export default function WorkersScreen() {
  const [workers,    setWorkers]    = useState<any[]>([]);
  const [centres,    setCentres]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form, setForm] = useState({ fullName:'', phone:'', centreId:'' });
  const [changingWorker, setChangingWorker] = useState<any>(null);
  const [newCentreId,    setNewCentreId]    = useState('');
  const [transferring,   setTransferring]   = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, c] = await Promise.allSettled([workerService.list(), centreService.list()]);
      if (w.status === 'fulfilled') setWorkers(w.value.data ?? []);
      if (c.status === 'fulfilled') {
        const list = c.value.data ?? [];
        setCentres(list);
        if (list.length > 0 && !form.centreId) setForm(p => ({ ...p, centreId: list[0].id }));
      }
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleRegister = async () => {
    if (!form.fullName || !form.phone || !form.centreId) {
      Alert.alert('Missing fields', 'Please fill in all required fields.'); return;
    }
    setSaving(true);
    try {
      await workerService.register({ fullName: form.fullName.toUpperCase(), phone: form.phone, centreId: form.centreId });
      setShowForm(false); setForm(p => ({ fullName:'', phone:'', centreId: p.centreId }));
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  const confirmDelete = (w: any) => {
    Alert.alert('Remove Worker', `Remove "${w.fullName}" from the system? This cannot be undone.`, [
      { text:'Cancel', style:'cancel' },
      { text:'Remove', style:'destructive', onPress: async () => {
        try { await workerService.remove(w.id); await load(); }
        catch (e) { Alert.alert('Error', getApiError(e)); }
      }},
    ]);
  };

  const openChangeBranch = (w: any) => {
    setChangingWorker(w);
    setNewCentreId(w.assignedCentre?.id ?? centres[0]?.id ?? '');
  };

  const handleTransfer = async () => {
    if (!newCentreId || !changingWorker) return;
    setTransferring(true);
    try {
      await workerService.transfer(changingWorker.id, newCentreId);
      setChangingWorker(null); await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setTransferring(false); }
  };

  return (
    <View style={W.root}>
      <View style={W.header}>
        <Text style={W.title}>Workers</Text>
        <Button label="+ Register" size="sm" onPress={() => setShowForm(v => !v)} />
      </View>

      {showForm && (
        <Card style={W.form}>
          <Text style={W.formTitle}>Register Worker</Text>
          <Input label="Full Name" placeholder="JOHN DOE" value={form.fullName}
            onChangeText={t => setForm(p => ({ ...p, fullName: t.toUpperCase() }))} autoCapitalize="characters" />
          <Input label="Phone" placeholder="+255 712 345 678" value={form.phone}
            onChangeText={t => setForm(p => ({ ...p, phone: t }))} keyboardType="phone-pad" />
          <Text style={W.fieldLabel}>Assign to Centre <Text style={{ color:Colors.error }}>*</Text></Text>
          {centres.length === 0
            ? <Text style={W.nocentre}>No centres yet. Add one first.</Text>
            : <View style={W.pills}>{centres.map(c => (
                <TouchableOpacity key={c.id} style={[W.pill, form.centreId===c.id && W.pillOn]}
                  onPress={() => setForm(p => ({ ...p, centreId: c.id }))}>
                  <Text style={[W.pillTxt, form.centreId===c.id && W.pillTxtOn]}>{c.name}</Text>
                  <Text style={[W.pillId,  form.centreId===c.id && { color:'rgba(255,255,255,0.7)' }]}>{c.centreId}</Text>
                </TouchableOpacity>))}</View>}
          <View style={{ flexDirection:'row', gap:Spacing.sm, marginTop:Spacing.sm }}>
            <Button label="Cancel"   variant="secondary" onPress={() => setShowForm(false)} style={{ flex:1 }} />
            <Button label="Register" onPress={handleRegister} loading={saving} style={{ flex:1 }} />
          </View>
        </Card>
      )}

      {loading ? <ActivityIndicator style={W.loader} color={Colors.primary} /> : (
        <FlatList data={workers} keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding:Spacing.base }}
          ListEmptyComponent={<Text style={W.empty}>No workers registered yet.</Text>}
          renderItem={({ item }) => (
            <Card style={W.item}>
              <View style={W.row}>
                <View style={{ flex:1 }}>
                  <Text style={W.name}>{item.fullName}</Text>
                  <Text style={W.sub}>{item.phone}</Text>
                  <Text style={W.branch}>{item.assignedCentre ? `📍 ${item.assignedCentre.name}` : '⚠️  Unassigned'}</Text>
                </View>
                <View style={W.cardRight}>
                  <StatusBadge type={item.isActive ? 'active' : 'inactive'} size="sm" />
                  <View style={W.iconRow}>
                    <TouchableOpacity onPress={() => openChangeBranch(item)} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                      <Ionicons name="swap-horizontal-outline" size={22} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                      <Ionicons name="trash-outline" size={22} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <Modal visible={!!changingWorker} animationType="slide" transparent onRequestClose={() => setChangingWorker(null)}>
        <View style={W.overlay}>
          <TouchableOpacity style={{ flex:1 }} activeOpacity={1} onPress={() => setChangingWorker(null)} />
          <View style={W.sheet}>
            <View style={W.handle} />
            <Text style={W.sheetTitle}>Change Branch</Text>
            <Text style={W.sheetSub}>Moving: <Text style={{ fontWeight:FontWeight.bold }}>{changingWorker?.fullName}</Text></Text>
            <View style={W.pills}>
              {centres.map(c => (
                <TouchableOpacity key={c.id} style={[W.pill, newCentreId===c.id && W.pillOn]}
                  onPress={() => setNewCentreId(c.id)}>
                  <Text style={[W.pillTxt, newCentreId===c.id && W.pillTxtOn]}>{c.name}</Text>
                  <Text style={[W.pillId, newCentreId===c.id && { color:'rgba(255,255,255,0.7)' }]}>{c.centreId}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection:'row', gap:Spacing.sm, marginTop:Spacing.md }}>
              <Button label="Cancel"   variant="secondary" onPress={() => setChangingWorker(null)} style={{ flex:1 }} />
              <Button label="Transfer" onPress={handleTransfer} loading={transferring} style={{ flex:1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const W = StyleSheet.create({
  root:        { flex:1, backgroundColor:Colors.background },
  header:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:Spacing.xl, paddingTop:60, backgroundColor:Colors.primary },
  title:       { fontSize:FontSize.xl, fontWeight:FontWeight.bold, color:Colors.white },
  form:        { margin:Spacing.base },
  formTitle:   { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.textPrimary, marginBottom:Spacing.md },
  fieldLabel:  { fontSize:FontSize.sm, fontWeight:FontWeight.semiBold, color:Colors.textSecondary, marginBottom:Spacing.xs },
  nocentre:    { fontSize:FontSize.sm, color:Colors.textDisabled, fontStyle:'italic', marginBottom:Spacing.md },
  pills:       { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:Spacing.md },
  pill:        { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:Radius.md, borderWidth:1.5, borderColor:Colors.border, backgroundColor:Colors.grey100 },
  pillOn:      { backgroundColor:Colors.primary, borderColor:Colors.primary },
  pillTxt:     { fontSize:FontSize.sm, color:Colors.textSecondary, fontWeight:FontWeight.semiBold },
  pillTxtOn:   { color:Colors.white },
  pillId:      { fontSize:FontSize.xs, color:Colors.textDisabled },
  loader:      { marginTop:60 },
  empty:       { textAlign:'center', color:Colors.textDisabled, padding:Spacing['3xl'] },
  item:        { marginBottom:Spacing.sm },
  row:         { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' },
  name:        { fontSize:FontSize.base, fontWeight:FontWeight.bold, color:Colors.textPrimary },
  sub:         { fontSize:FontSize.xs, color:Colors.textSecondary, marginTop:2 },
  branch:      { fontSize:FontSize.xs, color:Colors.primary, marginTop:4 },
  cardRight:   { alignItems:'flex-end', gap:Spacing.xs },
  iconRow:     { flexDirection:'row', gap:Spacing.base, marginTop:4 },
  overlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'flex-end' },
  sheet:       { backgroundColor:Colors.white, borderTopLeftRadius:28, borderTopRightRadius:28, padding:Spacing.xl, paddingBottom:40 },
  handle:      { width:44, height:4, borderRadius:2, backgroundColor:Colors.grey300, alignSelf:'center', marginBottom:Spacing.md },
  sheetTitle:  { fontSize:FontSize.xl, fontWeight:FontWeight.bold, color:Colors.textPrimary, marginBottom:4 },
  sheetSub:    { fontSize:FontSize.sm, color:Colors.textSecondary, marginBottom:Spacing.xl },
});
