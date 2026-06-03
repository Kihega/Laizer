/**
 * Laizer — Owner: Workers
 * Form: Full Name (caps) + Phone + Assign Centre dropdown. No NIM.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
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

  const load = useCallback(async () => {
    try {
      const [w, c] = await Promise.all([workerService.list(), centreService.list()]);
      setWorkers(w.data); setCentres(c.data);
      if (c.data.length > 0 && !form.centreId)
        setForm(p => ({ ...p, centreId: c.data[0].id }));
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleRegister = async () => {
    if (!form.fullName || !form.phone || !form.centreId) {
      Alert.alert('Missing fields', 'Please fill in all fields and select a centre.'); return;
    }
    setSaving(true);
    try {
      await workerService.register({
        fullName: form.fullName.toUpperCase(),
        phone:    form.phone,
        centreId: form.centreId,
      });
      setShowForm(false);
      setForm(p => ({ fullName:'', phone:'', centreId: p.centreId }));
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
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

          <Input label="Full Name" placeholder="JOHN DOE"
            value={form.fullName}
            onChangeText={t => setForm(p => ({ ...p, fullName: t.toUpperCase() }))}
            autoCapitalize="characters" />

          <Input label="Phone" placeholder="+255 712 345 678"
            value={form.phone}
            onChangeText={t => setForm(p => ({ ...p, phone: t }))}
            keyboardType="phone-pad" />

          {/* Centre picker */}
          <Text style={W.fieldLabel}>Assign to Centre <Text style={{ color:Colors.error }}>*</Text></Text>
          {centres.length === 0
            ? <Text style={W.nocentre}>No centres yet. Add a centre first.</Text>
            : (
              <View style={W.centreList}>
                {centres.map(c => (
                  <TouchableOpacity key={c.id}
                    style={[W.centrePill, form.centreId===c.id && W.centrePillActive]}
                    onPress={() => setForm(p => ({ ...p, centreId: c.id }))}>
                    <Ionicons name="storefront-outline" size={14}
                      color={form.centreId===c.id ? Colors.white : Colors.textSecondary} />
                    <Text style={[W.centrePillTxt, form.centreId===c.id && W.centrePillTxtActive]}>
                      {c.name}
                    </Text>
                    <Text style={[W.centrePillId, form.centreId===c.id && { color:'rgba(255,255,255,0.7)' }]}>
                      {c.centreId}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

          <View style={{ flexDirection:'row', gap:Spacing.sm, marginTop:Spacing.sm }}>
            <Button label="Cancel"   variant="secondary" onPress={() => setShowForm(false)} style={{ flex:1 }} />
            <Button label="Register" onPress={handleRegister} loading={saving} style={{ flex:1 }} />
          </View>
        </Card>
      )}

      {loading ? <ActivityIndicator style={W.loader} color={Colors.primary} /> : (
        <FlatList
          data={workers}
          keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding:Spacing.base }}
          ListEmptyComponent={<Text style={W.empty}>No workers registered yet.</Text>}
          renderItem={({ item }) => (
            <Card style={W.item}>
              <View style={W.row}>
                <View style={{ flex:1 }}>
                  <Text style={W.name}>{item.fullName}</Text>
                  <Text style={W.sub}>{item.phone}</Text>
                  <Text style={W.centre}>
                    {item.assignedCentre ? `📍 ${item.assignedCentre.name}` : '⚠️  Unassigned'}
                  </Text>
                </View>
                <StatusBadge type={item.isActive ? 'active' : 'inactive'} size="sm" />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const W = StyleSheet.create({
  root:      { flex:1, backgroundColor:Colors.background },
  header:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:Spacing.xl, paddingTop:60, backgroundColor:Colors.primary },
  title:     { fontSize:FontSize.xl, fontWeight:FontWeight.bold, color:Colors.white },
  form:      { margin:Spacing.base },
  formTitle: { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.textPrimary, marginBottom:Spacing.md },
  fieldLabel:{ fontSize:FontSize.sm, fontWeight:FontWeight.semiBold, color:Colors.textSecondary, marginBottom:Spacing.xs },
  nocentre:  { fontSize:FontSize.sm, color:Colors.textDisabled, fontStyle:'italic', marginBottom:Spacing.md },
  centreList:{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:Spacing.md },
  centrePill:{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:Radius.md, borderWidth:1.5, borderColor:Colors.border, backgroundColor:Colors.grey100 },
  centrePillActive:{ backgroundColor:Colors.primary, borderColor:Colors.primary },
  centrePillTxt:{ fontSize:FontSize.sm, color:Colors.textSecondary, fontWeight:FontWeight.semiBold },
  centrePillTxtActive:{ color:Colors.white },
  centrePillId:{ fontSize:FontSize.xs, color:Colors.textDisabled },
  loader:    { marginTop:60 },
  empty:     { textAlign:'center', color:Colors.textDisabled, padding:Spacing['3xl'] },
  item:      { marginBottom:Spacing.sm },
  row:       { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' },
  name:      { fontSize:FontSize.base, fontWeight:FontWeight.bold, color:Colors.textPrimary },
  sub:       { fontSize:FontSize.xs, color:Colors.textSecondary, marginTop:2 },
  centre:    { fontSize:FontSize.xs, color:Colors.primary, marginTop:4 },
});
