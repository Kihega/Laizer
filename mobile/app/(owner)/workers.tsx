/**
 * SMSS — Owner: Workers Screen
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { workerService, centreService, getApiError } from '@/services/api';
import { Card, Button, Input, StatusBadge } from '@/components/ui';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function WorkersScreen() {
  const [workers,    setWorkers]    = useState<any[]>([]);
  const [centres,    setCentres]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form, setForm] = useState({ fullName:'', nim:'', phone:'' });

  const load = useCallback(async () => {
    try {
      const [w, c] = await Promise.all([workerService.list(), centreService.list()]);
      setWorkers(w.data); setCentres(c.data);
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleRegister = async () => {
    if (!form.fullName || !form.nim || !form.phone) {
      Alert.alert('Missing fields', 'Please fill in all fields.'); return;
    }
    setSaving(true);
    try {
      await workerService.register(form);
      setShowForm(false); setForm({ fullName:'', nim:'', phone:'' });
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={WS.root}>
      <View style={WS.header}>
        <Text style={WS.title}>Workers</Text>
        <Button label="+ Register" size="sm" onPress={() => setShowForm(v => !v)} />
      </View>

      {showForm && (
        <Card style={WS.form}>
          <Text style={WS.formTitle}>Register Worker</Text>
          {[
            { key:'fullName', label:'Full Name', placeholder:'John Doe' },
            { key:'nim',      label:'NIM',        placeholder:'EMP001' },
            { key:'phone',    label:'Phone',       placeholder:'+255 7xx xxx xxx', keyboard:'phone-pad' as const },
          ].map(f => (
            <Input key={f.key} label={f.label} placeholder={f.placeholder}
              value={(form as any)[f.key]}
              onChangeText={t => setForm(p => ({ ...p, [f.key]: t }))}
              keyboardType={f.keyboard ?? 'default'}
            />
          ))}
          <View style={{ flexDirection:'row', gap: Spacing.sm }}>
            <Button label="Cancel" variant="secondary" onPress={() => setShowForm(false)} style={{ flex:1 }} />
            <Button label="Register" onPress={handleRegister} loading={saving} style={{ flex:1 }} />
          </View>
        </Card>
      )}

      {loading ? <ActivityIndicator style={WS.loader} color={Colors.primary} /> : (
        <FlatList
          data={workers}
          keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding: Spacing.base }}
          ListEmptyComponent={<Text style={WS.empty}>No workers registered yet.</Text>}
          renderItem={({ item }) => (
            <Card style={WS.item}>
              <View style={WS.row}>
                <View style={{ flex:1 }}>
                  <Text style={WS.name}>{item.fullName}</Text>
                  <Text style={WS.sub}>NIM: {item.nim}  ·  {item.phone}</Text>
                  <Text style={WS.centre}>
                    {item.assignedCentre ? `📍 ${item.assignedCentre.name}` : '⚠️ Unassigned'}
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

const WS = StyleSheet.create({
  root:      { flex:1, backgroundColor: Colors.background },
  header:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding: Spacing.xl, paddingTop:60, backgroundColor: Colors.primary },
  title:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  form:      { margin: Spacing.base },
  formTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  loader:    { marginTop:60 },
  empty:     { textAlign:'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  item:      { marginBottom: Spacing.sm },
  row:       { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' },
  name:      { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sub:       { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop:2 },
  centre:    { fontSize: FontSize.xs, color: Colors.primary, marginTop:4 },
});
