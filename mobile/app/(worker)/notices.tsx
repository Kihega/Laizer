/**
 * SMSS — Worker: Notices Screen
 * Inbox of notices sent by the owner. Marks as read on open.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { noticeService, getApiError } from '@/services/api';
import { Card, StatusBadge } from '@/components/ui';
import { Colors, FontSize, FontWeight, Radius, Shadows, Spacing } from '@/constants/theme';

export default function WorkerNoticesScreen() {
  const [notices,    setNotices]   = useState<any[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefresh]   = useState(false);
  const [selected,   setSelected]  = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await noticeService.list();
      setNotices(data);
    } catch (e) { console.error('[Notices]', getApiError(e)); }
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const openNotice = async (item: any) => {
    setSelected(item);
    if (!item.isRead) {
      try {
        await noticeService.markRead(item.id);
        setNotices(prev =>
          prev.map(n => n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
        );
      } catch { /* non-critical */ }
    }
  };

  const unreadCount = notices.filter(n => !n.isRead).length;

  return (
    <View style={NS.root}>
      {/* Header */}
      <View style={NS.header}>
        <View>
          <Text style={NS.title}>Notices</Text>
          {unreadCount > 0 && (
            <Text style={NS.unreadBadge}>{unreadCount} unread</Text>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={notices}
          keyExtractor={i => i.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefresh(true); load(); }} />
          }
          contentContainerStyle={{ padding: Spacing.base }}
          ListEmptyComponent={
            <Text style={NS.empty}>No notices from the owner yet.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openNotice(item)} activeOpacity={0.85}>
              <Card
                style={[NS.item, !item.isRead && NS.itemUnread]}
                onPress={() => openNotice(item)}
              >
                <View style={NS.itemTop}>
                  <View style={NS.itemTitleRow}>
                    {!item.isRead && <View style={NS.dot} />}
                    <Text
                      style={[NS.itemTitle, !item.isRead && NS.itemTitleBold]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                  </View>
                  <StatusBadge type={item.priority} size="sm" />
                </View>

                <Text style={NS.itemBody} numberOfLines={2}>
                  {item.body}
                </Text>

                <View style={NS.itemFooter}>
                  <Text style={NS.itemSender}>
                    From: {item.sender?.fullName ?? 'Owner'}
                  </Text>
                  <Text style={NS.itemTime}>
                    {new Date(item.createdAt).toLocaleDateString('en-TZ', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Notice detail modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={NS.modalOverlay}>
          <View style={NS.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selected && (
                <>
                  <View style={NS.modalHeader}>
                    <StatusBadge type={selected.priority} />
                    <Text style={NS.modalTime}>
                      {new Date(selected.createdAt).toLocaleDateString('en-TZ', {
                        weekday:'short', day:'numeric', month:'short',
                        hour:'2-digit', minute:'2-digit',
                      })}
                    </Text>
                  </View>

                  <Text style={NS.modalTitle}>{selected.title}</Text>

                  <View style={NS.modalSender}>
                    <Text style={NS.modalSenderLabel}>From:</Text>
                    <Text style={NS.modalSenderName}>{selected.sender?.fullName ?? 'Owner'}</Text>
                  </View>

                  <View style={NS.modalDivider} />

                  <Text style={NS.modalBody}>{selected.body}</Text>

                  {selected.readAt && (
                    <Text style={NS.readAt}>
                      ✓ Read {new Date(selected.readAt).toLocaleTimeString('en-TZ', {
                        hour:'2-digit', minute:'2-digit',
                      })}
                    </Text>
                  )}
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={NS.closeBtn} onPress={() => setSelected(null)}>
              <Text style={NS.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const NS = StyleSheet.create({
  root:           { flex: 1, backgroundColor: Colors.background },
  header:         { padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.primary },
  title:          { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  unreadBadge:    { fontSize: FontSize.xs, color: Colors.amberLight ?? '#FCD34D',
                    marginTop: 2, fontWeight: FontWeight.semiBold },
  empty:          { textAlign: 'center', color: Colors.textDisabled,
                    padding: Spacing['3xl'], lineHeight: 22 },
  item:           { marginBottom: Spacing.sm },
  itemUnread:     { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  itemTop:        { flexDirection: 'row', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: Spacing.xs },
  itemTitleRow:   { flexDirection: 'row', alignItems: 'center', flex: 1,
                    marginRight: Spacing.sm, gap: Spacing.xs },
  dot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  itemTitle:      { fontSize: FontSize.base, color: Colors.textPrimary,
                    flex: 1, fontWeight: FontWeight.medium },
  itemTitleBold:  { fontWeight: FontWeight.bold },
  itemBody:       { fontSize: FontSize.sm, color: Colors.textSecondary,
                    lineHeight: 20, marginBottom: Spacing.sm },
  itemFooter:     { flexDirection: 'row', justifyContent: 'space-between' },
  itemSender:     { fontSize: FontSize.xs, color: Colors.textDisabled },
  itemTime:       { fontSize: FontSize.xs, color: Colors.textDisabled },

  // Modal
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
                    justifyContent: 'flex-end' },
  modalBox:       { backgroundColor: Colors.white, borderTopLeftRadius: 24,
                    borderTopRightRadius: 24, padding: Spacing.xl,
                    maxHeight: '80%', ...Shadows.lg },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: Spacing.md },
  modalTime:      { fontSize: FontSize.xs, color: Colors.textDisabled },
  modalTitle:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold,
                    color: Colors.textPrimary, marginBottom: Spacing.sm, lineHeight: 28 },
  modalSender:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
                    marginBottom: Spacing.md },
  modalSenderLabel:{ fontSize: FontSize.sm, color: Colors.textDisabled },
  modalSenderName: { fontSize: FontSize.sm, color: Colors.primary,
                     fontWeight: FontWeight.semiBold },
  modalDivider:   { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.md },
  modalBody:      { fontSize: FontSize.base, color: Colors.textPrimary,
                    lineHeight: 24, marginBottom: Spacing.xl },
  readAt:         { fontSize: FontSize.xs, color: Colors.success,
                    marginBottom: Spacing.base },
  closeBtn:       { height: 50, backgroundColor: Colors.grey100,
                    borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
                    marginTop: Spacing.sm },
  closeBtnText:   { fontSize: FontSize.base, fontWeight: FontWeight.semiBold,
                    color: Colors.textSecondary },
});
