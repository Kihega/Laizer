/**
 * Laizer — Owner: Centres
 * Centre ID auto-formatted STN-XX by backend.
 * Delete icon (trash) with confirm alert. All text inputs UPPERCASE.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons }        from '@expo/vector-icons';
import { centreService, getApiError } from '@/services/api';
import { Card, Button, Input, StatusBadge } from '@/components/ui';
import { Colors, FontSize, FontWeight, Spacing }         from '@/constants/theme';

export default function CentresScreen() {
  const [centres,    setCentres]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form, setForm] = useState({ name:'', location:'' });

  const load = useCallback(async () => {
    try { const { data } = await centreService.list(); setCentres(data); }
    catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.location) {
      Alert.alert('Missing fields', 'Please fill in Centre name and location.'); return;
    }
    setSaving(true);
    try {
      await centreService.create({ name: form.name.toUpperCase(), location: form.location.toUpperCase() });
      setShowForm(false); setForm({ name:'', location:'' });
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  const confirmDelete = (item: any) => {
    Alert.alert(
      'Delete Centre',
      `Are you sure you want to permanently delete "${item.name}"?\nWorkers will no longer be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await centreService.delete(item.id);
              await load();
            } catch (e) { Alert.alert('Error', getApiError(e)); }
          },
        },
      ],
    );
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
            { key:'name',     label:'Name',     placeholder:'ARUSHA BRANCH' },
            { key:'location', label:'Location', placeholder:'ARDHI UNIVERSITY' },
          ].map(f => (
            <Input key={f.key} label={f.label} placeholder={f.placeholder}
              value={(form as any)[f.key]}
              onChangeText={t => setForm(p => ({ ...p, [f.key]: t.toUpperCase() }))}
              autoCapitalize="characters"
            />
          ))}
          <Text style={S.centreIdNote}>
            ℹ️  Centre ID will be auto-assigned (e.g. STN-01)
          </Text>
          <View style={{ flexDirection:'row', gap:Spacing.sm, marginTop:Spacing.sm }}>
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
          contentContainerStyle={{ padding:Spacing.base }}
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
                  <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root:        { flex:1, backgroundColor:Colors.background },
  header:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:Spacing.xl, paddingTop:60, backgroundColor:Colors.primary },
  title:       { fontSize:FontSize.xl, fontWeight:FontWeight.bold, color:Colors.white },
  form:        { margin:Spacing.base, padding:Spacing.base },
  formTitle:   { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.textPrimary, marginBottom:Spacing.md },
  centreIdNote:{ fontSize:FontSize.xs, color:Colors.textDisabled, marginTop:Spacing.xs, fontStyle:'italic' },
  loader:      { marginTop:60 },
  empty:       { textAlign:'center', color:Colors.textDisabled, padding:Spacing['3xl'] },
  item:        { marginBottom:Spacing.sm },
  itemRow:     { flexDirection:'row', justifyContent:'space-between' },
  itemName:    { fontSize:FontSize.base, fontWeight:FontWeight.bold, color:Colors.textPrimary },
  itemSub:     { fontSize:FontSize.sm, color:Colors.textSecondary, marginTop:2 },
  itemId:      { fontSize:FontSize.xs, color:Colors.primary, marginTop:4 },
  itemRight:   { alignItems:'flex-end', gap:Spacing.sm },
  workerCount: { fontSize:FontSize.xs, color:Colors.textDisabled },
});
