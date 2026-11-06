/**
 * SMSS — Worker: Office Utilities
 * __LAIZER_PATCH_V18__
 *
 * The branch's office utilities (scanner, printer, desktop computer, laptop...).
 * "+ Add" opens a popup for the utility name; the server issues the branch ID
 * (UTL-01, UTL-02, ...) shown on the card. The switch button on a card flips the
 * utility between Good and Defect. The owner sees all of this in the day report.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { utilityService, getApiError } from '@/services/api';
import { Card, Button, Input, FormModal, KeyboardAwareScrollView } from '@/components/ui';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

type UState = 'good' | 'defect';
interface UtilityRow { id: string; code: string; name: string; state: UState }

export default function UtilitiesScreen() {
  const [items,      setItems]    = useState<UtilityRow[]>([]);
  const [loading,    setLoading]  = useState(true);
  const [refreshing, setRefresh]  = useState(false);
  const [showForm,   setShowForm] = useState(false);
  const [name,       setName]     = useState('');
  const [saving,     setSaving]   = useState(false);
  const [busyId,     setBusyId]   = useState<string | null>(null);
  const [delItem,    setDelItem]  = useState<UtilityRow | null>(null);

  const load = useCallback(async () => {
    try { const { data } = await utilityService.list(); setItems(Array.isArray(data) ? data : []); }
    catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    const n = name.trim();
    if (!n) { CustomAlert.alert('Missing name', 'Enter the name of the utility.'); return; }
    setSaving(true);
    try {
      await utilityService.create(n);
      setShowForm(false); setName('');
      await load();
    } catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  const toggleState = async (u: UtilityRow) => {
    setBusyId(u.id);
    try {
      await utilityService.setState(u.id, u.state === 'good' ? 'defect' : 'good');
      await load();
    } catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setBusyId(null); }
  };

  const handleDelete = async () => {
    if (!delItem) return;
    setSaving(true);
    try { await utilityService.remove(delItem.id); setDelItem(null); await load(); }
    catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={U.root}>
      <View style={U.header}>
        <Text style={U.title}>Office Utilities</Text>
        <Button label="+ Add" size="sm" onPress={() => { setName(''); setShowForm(true); }} />
      </View>

      <KeyboardAwareScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefresh(true); load(); }} />}
        contentContainerStyle={{ padding: Spacing.base }}
      >
        {loading ? <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
          : items.length === 0 ? (
            <Text style={U.empty}>No utilities yet. Tap “+ Add” to record one.</Text>
          ) : items.map(u => {
            const good = u.state === 'good';
            return (
              <Card key={u.id} style={U.item}>
                <View style={U.row}>
                  <View style={{ flex: 1 }}>
                    <View style={U.codeRow}>
                      <Text style={U.code}>{u.code}</Text>
                      <Text style={[U.badge, good ? U.badgeGood : U.badgeBad]}>{good ? 'Good' : 'Defect'}</Text>
                    </View>
                    <Text style={U.name}>{u.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleState(u)} disabled={busyId === u.id}
                    hitSlop={{ top:8,bottom:8,left:8,right:8 }} accessibilityLabel="Switch good / defect" style={U.iconBtn}>
                    {busyId === u.id
                      ? <ActivityIndicator size="small" color={Colors.primary} />
                      : <Ionicons name="swap-horizontal-outline" size={24} color={Colors.primary} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDelItem(u)}
                    hitSlop={{ top:8,bottom:8,left:8,right:8 }} accessibilityLabel="Delete" style={U.iconBtn}>
                    <Ionicons name="trash-outline" size={22} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })}
      </KeyboardAwareScrollView>

      <FormModal visible={showForm} onClose={() => setShowForm(false)}>
        <Text style={U.formTitle}>Add Utility</Text>
        <Input label="Utility name" placeholder="e.g. Scanner, Printer, Desktop computer, Laptop"
          value={name} onChangeText={setName} autoFocus
          hint="An ID (UTL-01, UTL-02 …) is generated automatically." />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Button label="Cancel" variant="secondary" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
          <Button label="Save" onPress={handleCreate} loading={saving} style={{ flex: 1 }} />
        </View>
      </FormModal>

      <ConfirmModal
        visible={!!delItem}
        title="Delete Utility"
        message={`Delete ${delItem?.code} "${delItem?.name}"? Its ID will not be reused.`}
        confirmLabel="Delete"
        variant="danger"
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => setDelItem(null)}
      />
    </View>
  );
}

const U = StyleSheet.create({
  root:      { flex:1, backgroundColor: Colors.background },
  header:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding: Spacing.xl, paddingTop:60, backgroundColor: Colors.primary },
  title:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  formTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  empty:     { textAlign:'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  item:      { marginBottom: Spacing.sm },
  row:       { flexDirection:'row', alignItems:'center', gap: Spacing.sm },
  codeRow:   { flexDirection:'row', alignItems:'center', gap: Spacing.sm },
  code:      { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary,
               backgroundColor: Colors.primarySurface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm },
  badge:     { fontSize: FontSize.xs, fontWeight: FontWeight.bold, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, overflow:'hidden' },
  badgeGood: { color: Colors.accent, backgroundColor: Colors.accentSurface },
  badgeBad:  { color: Colors.error,  backgroundColor: '#FEE2E2' },
  name:      { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.xs },
  iconBtn:   { padding: 4 },
});
