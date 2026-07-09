/**
 * SMSS — Worker: Services Screen
 * Log customer service events. Total is auto-calculated as pages × price/page.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { serviceEventService, getApiError } from '@/services/api';
import { Card, Button, Input, StatusBadge } from '@/components/ui';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

const SERVICE_TYPES  = ['photocopy','printing','lamination','scanning','designing','other'] as const;
const SERVICE_SUBS   = ['black_and_white','colour'] as const;
const EDIT_WINDOW_MS = 60 * 60 * 1000; // 60 minutes

function fmt(n: number) {
  return `Tshs ${Number(n).toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;
}

function canEdit(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < EDIT_WINDOW_MS;
}

const BLANK_FORM = {
  serviceType: 'photocopy' as string,
  serviceSubtype: '' as string,
  pages: '',
  pricePerPageTshs: '',
  customerNote: '',
};

export default function ServicesScreen() {
  const [events,     setEvents]    = useState<any[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefresh]   = useState(false);
  const [showForm,   setShowForm]  = useState(false);
  const [editTarget, setEditTarget]= useState<any>(null);
  const [delTarget,  setDelTarget] = useState<any>(null);
  const [saving,     setSaving]    = useState(false);
  const [form,       setForm]      = useState(BLANK_FORM);

  // Auto-calculated total (preview only — server recomputes)
  const previewTotal = (() => {
    const p = parseFloat(form.pages);
    const r = parseFloat(form.pricePerPageTshs);
    return (!isNaN(p) && !isNaN(r) && p > 0 && r > 0) ? p * r : 0;
  })();

  const load = useCallback(async () => {
    try {
      const { data } = await serviceEventService.list();
      setEvents(data);
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const openForm = (item?: any) => {
    if (item) {
      setEditTarget(item);
      setForm({
        serviceType:      item.serviceType,
        serviceSubtype:   item.serviceSubtype ?? '',
        pages:            item.pages != null ? String(item.pages) : '',
        pricePerPageTshs: item.pricePerPageTshs != null ? String(item.pricePerPageTshs) : '',
        customerNote:     item.customerNote ?? '',
      });
    } else {
      setEditTarget(null);
      setForm(BLANK_FORM);
    }
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.serviceType) { Alert.alert('Select a service type'); return; }

    const pages = form.pages ? parseInt(form.pages, 10) : undefined;
    const price = form.pricePerPageTshs ? parseFloat(form.pricePerPageTshs) : undefined;

    if (pages !== undefined && (isNaN(pages) || pages < 1)) {
      Alert.alert('Invalid pages', 'Pages must be a positive number.'); return;
    }
    if (price !== undefined && (isNaN(price) || price < 0)) {
      Alert.alert('Invalid price', 'Price must be 0 or more.'); return;
    }

    // Total computed server-side; send 0 as placeholder — backend will recalculate
    const totalAmountTshs = (pages && price) ? pages * price : 0;

    const body: any = {
      serviceType:    form.serviceType,
      totalAmountTshs,
      ...(form.serviceSubtype   ? { serviceSubtype:   form.serviceSubtype   } : {}),
      ...(pages !== undefined   ? { pages                                   } : {}),
      ...(price !== undefined   ? { pricePerPageTshs: price                 } : {}),
      ...(form.customerNote     ? { customerNote:     form.customerNote     } : {}),
    };

    setSaving(true);
    try {
      if (editTarget) {
        await serviceEventService.update(editTarget.id, body);
      } else {
        await serviceEventService.log(body);
      }
      setShowForm(false);
      setEditTarget(null);
      setForm(BLANK_FORM);
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setSaving(true);
    try {
      await serviceEventService.delete(delTarget.id);
      setDelTarget(null);
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={S.root}>
      {/* Header */}
      <View style={S.header}>
        <Text style={S.title}>Service Events</Text>
        <Button label="+ Log Service" size="sm" onPress={() => openForm()} />
      </View>

      {/* Log / Edit Form */}
      {showForm && (
        <Card style={S.form}>
          <Text style={S.formTitle}>{editTarget ? 'Edit Service Event' : 'Log New Service'}</Text>

          {/* Service Type */}
          <Text style={S.fieldLabel}>Service Type *</Text>
          <View style={S.chipRow}>
            {SERVICE_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[S.chip, form.serviceType === t && S.chipActive]}
                onPress={() => setForm(p => ({ ...p, serviceType: t }))}
              >
                <Text style={[S.chipText, form.serviceType === t && S.chipTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Subtype */}
          <Text style={S.fieldLabel}>Sub-type (optional)</Text>
          <View style={S.chipRow}>
            {SERVICE_SUBS.map(sub => (
              <TouchableOpacity
                key={sub}
                style={[S.chip, form.serviceSubtype === sub && S.chipActive]}
                onPress={() =>
                  setForm(p => ({ ...p, serviceSubtype: p.serviceSubtype === sub ? '' : sub }))
                }
              >
                <Text style={[S.chipText, form.serviceSubtype === sub && S.chipTextActive]}>
                  {sub === 'black_and_white' ? 'B & W' : 'Colour'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Pages & Price */}
          <View style={S.twoCol}>
            <Input
              label="Pages"
              placeholder="20"
              value={form.pages}
              onChangeText={t => setForm(p => ({ ...p, pages: t }))}
              keyboardType="numeric"
              containerStyle={{ flex: 1 }}
            />
            <Input
              label="Price / page (Tshs)"
              placeholder="100"
              value={form.pricePerPageTshs}
              onChangeText={t => setForm(p => ({ ...p, pricePerPageTshs: t }))}
              keyboardType="numeric"
              containerStyle={{ flex: 1 }}
            />
          </View>

          {/* Auto total preview */}
          {previewTotal > 0 && (
            <View style={S.totalPreview}>
              <Text style={S.totalLabel}>Total</Text>
              <Text style={S.totalValue}>{fmt(previewTotal)}</Text>
            </View>
          )}

          <Input
            label="Customer note (optional)"
            placeholder="e.g. John's thesis"
            value={form.customerNote}
            onChangeText={t => setForm(p => ({ ...p, customerNote: t }))}
          />

          <View style={S.formBtns}>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => { setShowForm(false); setEditTarget(null); }}
              style={{ flex: 1 }}
            />
            <Button
              label={editTarget ? 'Update' : 'Log Event'}
              onPress={handleSubmit}
              loading={saving}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      )}

      {/* Events list */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={i => i.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefresh(true); load(); }} />
          }
          contentContainerStyle={{ padding: Spacing.base }}
          ListEmptyComponent={
            <Text style={S.empty}>No service events logged today. Tap + Log Service to start.</Text>
          }
          renderItem={({ item }) => {
            const editable = canEdit(item.createdAt);
            return (
              <Card style={S.item}>
                <View style={S.itemTop}>
                  <StatusBadge type={item.serviceType} />
                  {item.serviceSubtype && (
                    <Text style={S.subtype}>
                      {item.serviceSubtype === 'black_and_white' ? 'B&W' : 'Colour'}
                    </Text>
                  )}
                  <Text style={S.itemTotal}>{fmt(Number(item.totalAmountTshs))}</Text>
                </View>

                <View style={S.itemMid}>
                  {item.pages != null && (
                    <Text style={S.itemDetail}>📄 {item.pages} pages</Text>
                  )}
                  {item.pricePerPageTshs != null && (
                    <Text style={S.itemDetail}>
                      @ Tshs {Number(item.pricePerPageTshs).toLocaleString()}/pg
                    </Text>
                  )}
                  {item.customerNote && (
                    <Text style={S.itemNote} numberOfLines={1}>📝 {item.customerNote}</Text>
                  )}
                </View>

                <View style={S.itemBottom}>
                  <Text style={S.itemTime}>
                    {new Date(item.createdAt).toLocaleTimeString('en-TZ', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                  {editable && (
                    <View style={S.itemActions}>
                      <TouchableOpacity onPress={() => openForm(item)}>
                        <Text style={S.editBtn}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setDelTarget(item)}>
                        <Text style={S.deleteBtn}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </Card>
            );
          }}
        />
      )}

      <ConfirmModal
        visible={!!delTarget}
        title="Delete Service Event"
        message="Delete this service event? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
      />
    </View>
  );
}

const S = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Colors.background },
  header:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                   padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.primary },
  title:         { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  form:          { margin: Spacing.base },
  formTitle:     { fontSize: FontSize.md, fontWeight: FontWeight.bold,
                   color: Colors.textPrimary, marginBottom: Spacing.md },
  fieldLabel:    { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold,
                   color: Colors.textSecondary, marginBottom: Spacing.xs },
  chipRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md },
  chip:          { paddingHorizontal: Spacing.sm, paddingVertical: 6,
                   borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
                   backgroundColor: Colors.grey100 },
  chipActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:      { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  chipTextActive:{ color: Colors.white, fontWeight: FontWeight.bold },
  twoCol:        { flexDirection: 'row', gap: Spacing.sm },
  totalPreview:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                   backgroundColor: Colors.accentSurface, borderRadius: Radius.md,
                   padding: Spacing.md, marginBottom: Spacing.md,
                   borderLeftWidth: 3, borderLeftColor: Colors.accent },
  totalLabel:    { fontSize: FontSize.sm, color: Colors.accent, fontWeight: FontWeight.semiBold },
  totalValue:    { fontSize: FontSize.lg, color: Colors.accent, fontWeight: FontWeight.black },
  formBtns:      { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  empty:         { textAlign: 'center', color: Colors.textDisabled,
                   padding: Spacing['3xl'], lineHeight: 22 },
  item:          { marginBottom: Spacing.sm },
  itemTop:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  subtype:       { fontSize: FontSize.xs, color: Colors.textSecondary,
                   backgroundColor: Colors.grey100, paddingHorizontal: 6,
                   paddingVertical: 2, borderRadius: Radius.full },
  itemTotal:     { marginLeft: 'auto', fontSize: FontSize.md,
                   fontWeight: FontWeight.bold, color: Colors.accent },
  itemMid:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xs },
  itemDetail:    { fontSize: FontSize.xs, color: Colors.textSecondary },
  itemNote:      { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: 'italic' },
  itemBottom:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                   borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing.xs },
  itemTime:      { fontSize: FontSize.xs, color: Colors.textDisabled },
  itemActions:   { flexDirection: 'row', gap: Spacing.md },
  editBtn:       { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semiBold },
  deleteBtn:     { fontSize: FontSize.xs, color: Colors.error, fontWeight: FontWeight.semiBold },
});
