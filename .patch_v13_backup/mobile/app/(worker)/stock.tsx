/**
 * SMSS — Worker: Stock Screen
 *
 * __LAIZER_PATCH_V12__
 *  • Stock is counted in PIECES only (no boxes, price or notes).
 *  • Registering an item that already has a card ADDS to that card's
 *    quantity instead of creating a second card.
 *  • "Use" takes pieces out of stock; when an item reaches 0 its card is
 *    removed automatically.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CustomAlert } from '@/components/ui/CustomAlert'; // __LAIZER_PATCH_V10__
import { stockService, getApiError } from '@/services/api';
import { Card, Button, Input, KeyboardAwareScrollView, StatusBadge } from '@/components/ui';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Colors, FontSize, FontWeight, Radius, Shadows, Spacing } from '@/constants/theme';

const BLANK_FORM = { itemName: '', quantity: '' };

export default function StockScreen() {
  const [items,      setItems]     = useState<any[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefresh]   = useState(false);
  const [showForm,   setShowForm]  = useState(false);
  const [delItem,    setDelItem]   = useState<any>(null);
  const [useItem,    setUseItem]   = useState<any>(null);
  const [useQty,     setUseQty]    = useState('');
  const [saving,     setSaving]    = useState(false);
  const [form, setForm] = useState(BLANK_FORM);

  const load = useCallback(async () => {
    try { const { data } = await stockService.list(); setItems(Array.isArray(data) ? data : []); }
    catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const name = form.itemName.trim();
    if (!name || !form.quantity) {
      CustomAlert.alert('Missing fields', 'Item name and quantity are required.'); return;
    }
    const qty = parseInt(form.quantity, 10);
    if (isNaN(qty) || qty < 1) { CustomAlert.alert('Invalid quantity', 'Quantity must be 1 piece or more.'); return; }
    setSaving(true);
    try {
      const { data } = await stockService.create({ itemName: name, quantity: qty });
      setShowForm(false); setForm(BLANK_FORM);
      await load();
      if (data?.merged) {
        CustomAlert.alert('Stock updated', `Added ${qty} pcs to "${data.itemName}". It now has ${Number(data.quantity)} pcs.`);
      }
    } catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  const handleUse = async () => {
    if (!useItem) return;
    const qty = parseInt(useQty, 10);
    if (isNaN(qty) || qty < 1) { CustomAlert.alert('Invalid quantity', 'Enter how many pieces were used.'); return; }
    setSaving(true);
    try {
      await stockService.use(useItem.id, qty);
      setUseItem(null); setUseQty('');
      await load();
    } catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delItem) return;
    setSaving(true);
    try { await stockService.delete(delItem.id); setDelItem(null); await load(); }
    catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={SS.root}>
      <View style={SS.header}>
        <Text style={SS.title}>Stock</Text>
        <Button label="+ Add Item" size="sm" onPress={() => setShowForm(v => !v)} />
      </View>

      <KeyboardAwareScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefresh(true); load(); }} />}
        contentContainerStyle={{ padding: Spacing.base }}
      >
        {showForm && (
          <Card style={SS.form}>
            <Text style={SS.formTitle}>Register Stock Item</Text>
            <Input label="Item Name" placeholder="e.g. A4 Paper Ream" value={form.itemName}
              onChangeText={t => setForm(p => ({ ...p, itemName: t }))} />
            <Input label="Quantity (pcs)" placeholder="0" value={form.quantity}
              onChangeText={t => setForm(p => ({ ...p, quantity: t.replace(/[^0-9]/g, '') }))}
              keyboardType="numeric"
              hint="If this item is already in stock, the quantity is added to its card." />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Button label="Cancel" variant="secondary" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
              <Button label="Save" onPress={handleCreate} loading={saving} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        {loading ? <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
          : items.length === 0 ? (
            <Text style={SS.empty}>No stock items yet. Add your first item.</Text>
          ) : items.map(item => (
            <Card key={item.id} style={SS.item}>
              <View style={SS.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={SS.itemName}>{item.itemName}</Text>
                  <View style={SS.itemMeta}>
                    <StatusBadge type={item.unit ?? 'pcs'} size="sm" />
                    <Text style={SS.qty}>{Number(item.quantity)} {item.unit ?? 'pcs'}</Text>
                  </View>
                </View>
                <View style={SS.itemRight}>
                  <Text onPress={() => { setUseItem(item); setUseQty(''); }} style={SS.useBtn}>Use</Text>
                  <Text onPress={() => setDelItem(item)} style={SS.deleteBtn}>Delete</Text>
                </View>
              </View>
            </Card>
          ))}
      </KeyboardAwareScrollView>

      {/* Use (consume) stock */}
      <Modal visible={!!useItem} transparent animationType="fade" onRequestClose={() => setUseItem(null)}>
        <View style={SS.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setUseItem(null)} />
          <KeyboardAwareScrollView
            style={{ width: '100%', flexGrow: 0 }}
            contentContainerStyle={{ padding: Spacing.xl }}>
            <View style={SS.useBox}>
              <Text style={SS.useTitle}>Use stock</Text>
              <Text style={SS.useSub}>
                {useItem?.itemName} — {Number(useItem?.quantity ?? 0)} {useItem?.unit ?? 'pcs'} available
              </Text>
              <Input label="Pieces used" placeholder="e.g. 5" value={useQty}
                onChangeText={t => setUseQty(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" autoFocus
                hint="The item disappears from the list when it reaches 0." />
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <Button label="Cancel" variant="secondary" onPress={() => setUseItem(null)} style={{ flex: 1 }} />
                <Button label="Confirm" onPress={handleUse} loading={saving} style={{ flex: 1 }} />
              </View>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>

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
  form:      { marginBottom: Spacing.base },
  formTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  empty:     { textAlign:'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  item:      { marginBottom: Spacing.sm },
  itemRow:   { flexDirection:'row', justifyContent:'space-between' },
  itemName:  { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemMeta:  { flexDirection:'row', alignItems:'center', gap: Spacing.xs, marginTop: Spacing.xs },
  qty:       { fontSize: FontSize.sm, color: Colors.textSecondary },
  itemRight: { alignItems:'flex-end', gap: Spacing.sm },
  useBtn:    { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  deleteBtn: { fontSize: FontSize.xs, color: Colors.error },
  overlay:   { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'center', alignItems:'center' },
  useBox:    { width:'100%', backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xl, ...Shadows.lg },
  useTitle:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  useSub:    { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, marginBottom: Spacing.md },
});
