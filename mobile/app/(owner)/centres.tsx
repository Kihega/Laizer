/**
 * SMSS — Owner: Centres Screen
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { centreService, getApiError } from '@/services/api';
import { Card, Button, Input, StatusBadge } from '@/components/ui';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Colors, FontSize, FontWeight, Spacing }         from '@/constants/theme';

export default function CentresScreen() {
  const [centres,    setCentres]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [deactivate, setDeactivate] = useState<any>(null);
  const [saving,     setSaving]     = useState(false);
  const [form, setForm] = useState({ centreNo:'', centreId:'', name:'', location:'' });

  const load = useCallback(async () => {
    try { const { data } = await centreService.list(); setCentres(data); }
    catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.centreNo || !form.centreId || !form.name || !form.location) {
      Alert.alert('Missing fields', 'Please fill in all fields.'); return;
    }
    setSaving(true);
    try {
      await centreService.create(form);
      setShowForm(false); setForm({ centreNo:'', centreId:'', name:'', location:'' });
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async () => {
    if (!deactivate) return;
    setSaving(true);
    try { await centreService.deactivate(deactivate.id); setDeactivate(null); await load(); }
    catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={S.root}>
      <View style={S.header}>
        <Text style={S.title}>Centres</Text>
        <Button label="+ Add" size="sm" onPress={() => setShowForm(v => !v)} />
      </View>

      {showForm && (
        <Card style={S.form}>
          <Text style={S.formTitle}>New Centre</Text>
          {[
            { key:'centreNo',  label:'Centre No',  placeholder:'STN001' },
            { key:'centreId',  label:'Centre ID',  placeholder:'CENTRE-ARU-001' },
            { key:'name',      label:'Name',        placeholder:'Arusha Branch' },
            { key:'location',  label:'Location',    placeholder:'Arusha University' },
          ].map(f => (
            <Input key={f.key} label={f.label} placeholder={f.placeholder}
              value={(form as any)[f.key]}
              onChangeText={t => setForm(p => ({ ...p, [f.key]: t }))}
              autoCapitalize={f.key === 'centreId' ? 'characters' : 'words'}
            />
          ))}
          <View style={{ flexDirection:'row', gap: Spacing.sm }}>
            <Button label="Cancel"  variant="secondary" onPress={() => setShowForm(false)} style={{ flex:1 }} />
            <Button label="Create"  onPress={handleCreate} loading={saving} style={{ flex:1 }} />
          </View>
        </Card>
      )}

      {loading ? <ActivityIndicator style={S.loader} color={Colors.primary} /> : (
        <FlatList
          data={centres}
          keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding: Spacing.base }}
          ListEmptyComponent={<Text style={S.empty}>No centres yet. Add your first one.</Text>}
          renderItem={({ item }) => (
            <Card style={S.item}>
              <View style={S.itemRow}>
                <View style={{ flex:1 }}>
                  <Text style={S.itemName}>{item.name}</Text>
                  <Text style={S.itemSub}>{item.location}</Text>
                  <Text style={S.itemId}>Login ID: {item.centreId}</Text>
                </View>
                <View style={S.itemRight}>
                  <StatusBadge type="active" size="sm" />
                  <Text style={S.workerCount}>{item._count?.assignments ?? 0} workers</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setDeactivate(item)}>
                <Text style={S.deactivateBtn}>Deactivate</Text>
              </TouchableOpacity>
            </Card>
          )}
        />
      )}

      <ConfirmModal
        visible={!!deactivate}
        title="Deactivate Centre"
        message={`Are you sure you want to deactivate "${deactivate?.name}"? Workers will no longer be able to log in.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={saving}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivate(null)}
      />
    </View>
  );
}

const S = StyleSheet.create({
  root:        { flex:1, backgroundColor: Colors.background },
  header:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding: Spacing.xl, paddingTop:60, backgroundColor: Colors.primary },
  title:       { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  form:        { margin: Spacing.base, padding: Spacing.base },
  formTitle:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  loader:      { marginTop: 60 },
  empty:       { textAlign:'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  item:        { marginBottom: Spacing.sm },
  itemRow:     { flexDirection:'row', justifyContent:'space-between' },
  itemName:    { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemSub:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop:2 },
  itemId:      { fontSize: FontSize.xs, color: Colors.primary, marginTop:4 },
  itemRight:   { alignItems:'flex-end', gap: Spacing.xs },
  workerCount: { fontSize: FontSize.xs, color: Colors.textDisabled },
  deactivateBtn:{ fontSize: FontSize.xs, color: Colors.error, marginTop: Spacing.sm },
});
