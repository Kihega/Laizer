/**
 * SMSS — Worker: Stock Screen
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { stockService, getApiError } from '@/services/api';
import { Card, Button, Input, StatusBadge } from '@/components/ui';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

const UNITS = ['pcs', 'boxes'] as const;

export default function StockScreen() {
  const [items,      setItems]     = useState<any[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefresh]   = useState(false);
  const [showForm,   setShowForm]  = useState(false);
  const [delItem,    setDelItem]   = useState<any>(null);
  const [saving,     setSaving]    = useState(false);
  const [form, setForm] = useState({ itemName:'', quantity:'', unit:'pcs' as string, netStockPriceTshs:'', notes:'' });

  const load = useCallback(async () => {
    try { const { data } = await stockService.list(); setItems(data); }
    catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.itemName || !form.quantity || !form.netStockPriceTshs) {
      Alert.alert('Missing fields', 'Item name, quantity and price are required.'); return;
    }
    const qty = parseFloat(form.quantity);
    const prc = parseFloat(form.netStockPriceTshs);
    if (isNaN(qty) || qty < 0) { Alert.alert('Invalid quantity'); return; }
    if (isNaN(prc) || prc < 0) { Alert.alert('Invalid price'); return; }
    setSaving(true);
    try {
      await stockService.create({ itemName: form.itemName, quantity: qty, unit: form.unit, netStockPriceTshs: prc, notes: form.notes || undefined });
      setShowForm(false); setForm({ itemName:'', quantity:'', unit:'pcs', netStockPriceTshs:'', notes:'' });
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delItem) return;
    setSaving(true);
    try { await stockService.delete(delItem.id); setDelItem(null); await load(); }
    catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={SS.root}>
      <View style={SS.header}>
        <Text style={SS.title}>Stock</Text>
        <Button label="+ Add Item" size="sm" onPress={() => setShowForm(v => !v)} />
      </View>

      {showForm && (
        <Card style={SS.form}>
          <Text style={SS.formTitle}>Register Stock Item</Text>
          <Input label="Item Name" placeholder="e.g. A4 Paper Ream" value={form.itemName}
            onChangeText={t => setForm(p => ({ ...p, itemName: t }))} />
          <View style={SS.row}>
            <Input label="Quantity" placeholder="0" value={form.quantity}
              onChangeText={t => setForm(p => ({ ...p, quantity: t }))}
              keyboardType="numeric" containerStyle={{ flex:1 }} />
            <View style={{ flex:1 }}>
              <Text style={SS.unitLabel}>Unit</Text>
              <View style={SS.unitRow}>
                {UNITS.map(u => (
                  <Button key={u} label={u} size="sm"
                    variant={form.unit === u ? 'primary' : 'secondary'}
                    onPress={() => setForm(p => ({ ...p, unit: u }))}
                    style={{ flex:1 }} />
                ))}
              </View>
            </View>
          </View>
          <Input label="Net Price (Tshs)" placeholder="e.g. 12000" value={form.netStockPriceTshs}
            onChangeText={t => setForm(p => ({ ...p, netStockPriceTshs: t }))}
            keyboardType="numeric" />
          <Input label="Notes (optional)" placeholder="Any additional info" value={form.notes}
            onChangeText={t => setForm(p => ({ ...p, notes: t }))} />
          <View style={{ flexDirection:'row', gap: Spacing.sm }}>
            <Button label="Cancel" variant="secondary" onPress={() => setShowForm(false)} style={{ flex:1 }} />
            <Button label="Save" onPress={handleCreate} loading={saving} style={{ flex:1 }} />
          </View>
        </Card>
      )}

      {loading ? <ActivityIndicator style={{ marginTop:60 }} color={Colors.primary} /> : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefresh(true); load(); }} />}
          contentContainerStyle={{ padding: Spacing.base }}
          ListEmptyComponent={<Text style={SS.empty}>No stock items yet. Add your first item.</Text>}
          renderItem={({ item }) => (
            <Card style={SS.item}>
              <View style={SS.itemRow}>
                <View style={{ flex:1 }}>
                  <Text style={SS.itemName}>{item.itemName}</Text>
                  <View style={SS.itemMeta}>
                    <StatusBadge type={item.unit} size="sm" />
                    <Text style={SS.qty}>{Number(item.quantity)} {item.unit}</Text>
                  </View>
                </View>
                <View style={SS.itemRight}>
                  <Text style={SS.price}>Tshs {Number(item.netStockPriceTshs).toLocaleString()}</Text>
                  <Text onPress={() => setDelItem(item)} style={SS.deleteBtn}>Delete</Text>
                </View>
              </View>
              {item.notes ? <Text style={SS.notes}>{item.notes}</Text> : null}
            </Card>
          )}
        />
      )}

      <ConfirmModal
        visible={!!delItem}
        title="Delete Stock Item"
        message={`Delete "${delItem?.itemName}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => setDelItem(null)}
      />
    </View>
  );
}

const SS = StyleSheet.create({
  root:      { flex:1, backgroundColor: Colors.background },
  header:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding: Spacing.xl, paddingTop:60, backgroundColor: Colors.primary },
  title:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  form:      { margin: Spacing.base },
  formTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  row:       { flexDirection:'row', gap: Spacing.sm },
  unitLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textSecondary, marginBottom: Spacing.xs },
  unitRow:   { flexDirection:'row', gap: Spacing.xs },
  empty:     { textAlign:'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  item:      { marginBottom: Spacing.sm },
  itemRow:   { flexDirection:'row', justifyContent:'space-between' },
  itemName:  { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemMeta:  { flexDirection:'row', alignItems:'center', gap: Spacing.xs, marginTop: Spacing.xs },
  qty:       { fontSize: FontSize.sm, color: Colors.textSecondary },
  itemRight: { alignItems:'flex-end', gap: Spacing.xs },
  price:     { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.accent },
  deleteBtn: { fontSize: FontSize.xs, color: Colors.error },
  notes:     { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: Spacing.xs },
});
