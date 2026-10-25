/**
 * Laizer — Worker: Office Utilities (Equipment) Screen
 * Tracks durable equipment: printers, scanners, laptops, desktops, cameras, etc.
 * Reached via a quick-action card on the dashboard (not a tab) — includes its
 * own back button since it renders without tab-bar chrome.
 *
 * __LAIZER_PATCH_V12__ — the form is just Item name, Quantity and optional
 * Notes. Condition and category were removed: the worker types them into
 * Notes if they matter.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CustomAlert } from '@/components/ui/CustomAlert'; // __LAIZER_PATCH_V10__
import { useRouter } from 'expo-router';
import { Ionicons }  from '@expo/vector-icons';
import { equipmentService, getApiError } from '@/services/api';
import { Card, Button, Input, KeyboardAwareScrollView } from '@/components/ui';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

interface EquipmentItem {
  id: string;
  itemName: string;
  quantity: number;
  notes?: string | null;
}

const BLANK_FORM = { itemName: '', quantity: '1', notes: '' };

export default function EquipmentScreen() {
  const router = useRouter();
  const [items,      setItems]     = useState<EquipmentItem[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefresh]   = useState(false);
  const [showForm,   setShowForm]  = useState(false);
  const [delItem,    setDelItem]   = useState<EquipmentItem | null>(null);
  const [saving,     setSaving]    = useState(false);
  const [form, setForm] = useState(BLANK_FORM);

  const load = useCallback(async () => {
    try {
      const { data } = await equipmentService.list();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.itemName.trim()) { CustomAlert.alert('Missing field', 'Item name is required.'); return; }
    const qty = parseInt(form.quantity, 10);
    if (isNaN(qty) || qty < 1) { CustomAlert.alert('Invalid quantity', 'Quantity must be 1 or more.'); return; }
    setSaving(true);
    try {
      await equipmentService.create({
        itemName: form.itemName.trim(),
        quantity: qty,
        notes: form.notes.trim() || undefined,
      });
      setShowForm(false);
      setForm(BLANK_FORM);
      await load();
    } catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delItem) return;
    setSaving(true);
    try { await equipmentService.delete(delItem.id); setDelItem(null); await load(); }
    catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={ES.root}>
      <View style={ES.header}>
        <View style={ES.headerTop}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={ES.title}>Office Utilities</Text>
          <Button label="+ Add" size="sm" variant="onHeader" onPress={() => setShowForm(v => !v)} />
        </View>
      </View>

      <KeyboardAwareScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefresh(true); load(); }} />}
        contentContainerStyle={{ padding: Spacing.base }}
      >
        {showForm && (
          <Card style={ES.form}>
            <Text style={ES.formTitle}>Register Equipment</Text>
            <Input label="Item Name" placeholder="e.g. Printer, Scanner, Laptop" value={form.itemName}
              onChangeText={t => setForm(p => ({ ...p, itemName: t }))} />
            <Input label="Quantity" placeholder="1" value={form.quantity}
              onChangeText={t => setForm(p => ({ ...p, quantity: t.replace(/[^0-9]/g, '') }))}
              keyboardType="numeric" />
            <Input label="Notes (optional)" placeholder="Condition, category or any other info" value={form.notes}
              onChangeText={t => setForm(p => ({ ...p, notes: t }))}
              multiline style={ES.notesInput} />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Button label="Cancel" variant="secondary" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
              <Button label="Save" onPress={handleCreate} loading={saving} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        {loading ? <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
          : items.length === 0 ? (
            <Text style={ES.empty}>No equipment registered yet. Add your first item.</Text>
          ) : items.map(item => (
            <Card key={item.id} style={ES.item}>
              <View style={ES.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={ES.itemName}>{item.itemName}</Text>
                  <Text style={ES.qty}>{item.quantity} unit{item.quantity === 1 ? '' : 's'}</Text>
                </View>
                <Text onPress={() => setDelItem(item)} style={ES.deleteBtn}>Delete</Text>
              </View>
              {item.notes ? <Text style={ES.notes}>{item.notes}</Text> : null}
            </Card>
          ))}
      </KeyboardAwareScrollView>

      <ConfirmModal
        visible={!!delItem}
        title="Delete Equipment"
        message={`Remove "${delItem?.itemName}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => setDelItem(null)}
      />
    </View>
  );
}

const ES = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.background },
  header:    { padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.primary },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  title:     { flex: 1, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white, marginLeft: Spacing.sm },
  form:      { marginBottom: Spacing.base },
  formTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  notesInput:{ height: 88, paddingTop: 14, textAlignVertical: 'top' },
  empty:     { textAlign: 'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  item:      { marginBottom: Spacing.sm },
  itemRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  itemName:  { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  qty:       { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  deleteBtn: { fontSize: FontSize.xs, color: Colors.error },
  notes:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
});
