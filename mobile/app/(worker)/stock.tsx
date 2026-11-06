/**
 * SMSS — Worker: Stock Screen
 *
 * __LAIZER_PATCH_V12__
 *  • Stock is counted in PIECES only (no boxes, price or notes).
 *  • Registering an item that already has a card ADDS to that card's
 *    quantity instead of creating a second card.
 *  • __LAIZER_PATCH_V18__ — each card has Sell / Add / Delete icon buttons.
 *    Sell: quantity + price each → stock goes down (card removed at 0) and the
 *    sale appears in the owner's day report. Add: quantity → stock goes up.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CustomAlert } from '@/components/ui/CustomAlert'; // __LAIZER_PATCH_V10__
import { stockService, getApiError } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Input, FormModal, KeyboardAwareScrollView, StatusBadge } from '@/components/ui';
import { ConfirmModal } from '@/components/ConfirmModal';
import { fmtMoney } from '@/constants/labels';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

const BLANK_FORM = { itemName: '', quantity: '' };

export default function StockScreen() {
  const [items,      setItems]     = useState<any[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefresh]   = useState(false);
  const [showForm,   setShowForm]  = useState(false);
  const [delItem,    setDelItem]   = useState<any>(null);
  const [sellItem,   setSellItem]  = useState<any>(null);
  const [sellQty,    setSellQty]   = useState('');
  const [sellPrice,  setSellPrice] = useState('');
  const [addItem,    setAddItem]   = useState<any>(null);
  const [addQty,     setAddQty]    = useState('');
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
      const { data } = await stockService.create({ itemName: name, quantity: qty, unit: 'pcs', netStockPriceTshs: 0 });
      setShowForm(false); setForm(BLANK_FORM);
      await load();
      if (data?.merged) {
        CustomAlert.alert('Stock updated', `Added ${qty} pcs to "${data.itemName}". It now has ${Number(data.quantity)} pcs.`);
      }
    } catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  const handleSell = async () => {
    if (!sellItem) return;
    const qty   = parseInt(sellQty, 10);
    const price = parseFloat(sellPrice);
    if (isNaN(qty) || qty < 1) { CustomAlert.alert('Invalid quantity', 'Enter how many pieces are sold.'); return; }
    if (qty > Number(sellItem.quantity)) {
      CustomAlert.alert('Not enough stock', `Only ${Number(sellItem.quantity)} pcs of "${sellItem.itemName}" in stock.`); return;
    }
    if (isNaN(price) || price < 0) { CustomAlert.alert('Invalid price', 'Enter the price of each piece.'); return; }
    setSaving(true);
    try {
      await stockService.sell(sellItem.id, qty, price);
      setSellItem(null); setSellQty(''); setSellPrice('');
      await load();
    } catch (e) { CustomAlert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  const handleAdd = async () => {
    if (!addItem) return;
    const qty = parseInt(addQty, 10);
    if (isNaN(qty) || qty < 1) { CustomAlert.alert('Invalid quantity', 'Enter how many pieces to add.'); return; }
    setSaving(true);
    try {
      await stockService.add(addItem.id, qty);
      setAddItem(null); setAddQty('');
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
                  <TouchableOpacity onPress={() => { setSellItem(item); setSellQty(''); setSellPrice(''); }}
                    hitSlop={{ top:8,bottom:8,left:8,right:8 }} accessibilityLabel="Sell" style={SS.iconBtn}>
                    <Ionicons name="cart-outline" size={22} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setAddItem(item); setAddQty(''); }}
                    hitSlop={{ top:8,bottom:8,left:8,right:8 }} accessibilityLabel="Add" style={SS.iconBtn}>
                    <Ionicons name="add-circle-outline" size={24} color={Colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDelItem(item)}
                    hitSlop={{ top:8,bottom:8,left:8,right:8 }} accessibilityLabel="Delete" style={SS.iconBtn}>
                    <Ionicons name="trash-outline" size={22} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))}
      </KeyboardAwareScrollView>

      {/* __LAIZER_PATCH_V14__ — form opens as a popup over the list */}
      <FormModal visible={showForm} onClose={() => setShowForm(false)}>
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
      </FormModal>

      {/* Sell */}
      <FormModal visible={!!sellItem} onClose={() => setSellItem(null)}>
        <Text style={SS.formTitle}>Sell stock</Text>
        <Text style={SS.useSub}>{sellItem?.itemName} — {Number(sellItem?.quantity ?? 0)} pcs available</Text>
        <Input label="Quantity to sell" placeholder="e.g. 5" value={sellQty}
          onChangeText={t => setSellQty(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" autoFocus />
        <Input label="Price per each (TSh)" placeholder="e.g. 500" value={sellPrice}
          onChangeText={t => setSellPrice(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric"
          hint={(parseInt(sellQty, 10) > 0 && parseFloat(sellPrice) >= 0)
            ? `Total: ${fmtMoney(parseInt(sellQty, 10) * parseFloat(sellPrice))}` : undefined} />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Button label="Cancel" variant="secondary" onPress={() => setSellItem(null)} style={{ flex: 1 }} />
          <Button label="Confirm" onPress={handleSell} loading={saving} style={{ flex: 1 }} />
        </View>
      </FormModal>

      {/* Add */}
      <FormModal visible={!!addItem} onClose={() => setAddItem(null)}>
        <Text style={SS.formTitle}>Add stock</Text>
        <Text style={SS.useSub}>{addItem?.itemName} — {Number(addItem?.quantity ?? 0)} pcs now</Text>
        <Input label="Quantity to add" placeholder="e.g. 20" value={addQty}
          onChangeText={t => setAddQty(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" autoFocus />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Button label="Cancel" variant="secondary" onPress={() => setAddItem(null)} style={{ flex: 1 }} />
          <Button label="Confirm" onPress={handleAdd} loading={saving} style={{ flex: 1 }} />
        </View>
      </FormModal>

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
  formTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  empty:     { textAlign:'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  item:      { marginBottom: Spacing.sm },
  itemRow:   { flexDirection:'row', justifyContent:'space-between' },
  itemName:  { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemMeta:  { flexDirection:'row', alignItems:'center', gap: Spacing.xs, marginTop: Spacing.xs },
  qty:       { fontSize: FontSize.sm, color: Colors.textSecondary },
  itemRight: { flexDirection:'row', alignItems:'center', gap: Spacing.sm },
  iconBtn:   { padding: 4 },
  useSub:    { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: -4, marginBottom: Spacing.md },
});
