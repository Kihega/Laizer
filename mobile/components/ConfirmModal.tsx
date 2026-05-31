/**
 * SMSS — ConfirmModal
 * Generic confirmation / alert modal (mirrors PayPark pattern).
 */
import {
  Modal, StyleSheet, Text, TouchableOpacity,
  TouchableWithoutFeedback, View,
} from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Shadows, Spacing } from '@/constants/theme';

type ModalVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmModalProps {
  visible:     boolean;
  title:       string;
  message:     string;
  confirmLabel?: string;
  cancelLabel?:  string;
  variant?:    ModalVariant;
  loading?:    boolean;
  onConfirm:   () => void;
  onCancel:    () => void;
}

const VARIANT_COLORS: Record<ModalVariant, { icon: string; confirm: string; confirmText: string }> = {
  danger:  { icon: Colors.error,   confirm: Colors.error,   confirmText: Colors.white },
  warning: { icon: Colors.warning, confirm: Colors.warning, confirmText: Colors.white },
  info:    { icon: Colors.primary, confirm: Colors.primary, confirmText: Colors.white },
  success: { icon: Colors.success, confirm: Colors.success, confirmText: Colors.white },
};

const ICONS: Record<ModalVariant, string> = {
  danger: '⚠️', warning: '⚠️', info: 'ℹ️', success: '✅',
};

export function ConfirmModal({
  visible, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'danger', loading = false,
  onConfirm, onCancel,
}: ConfirmModalProps) {
  const vc = VARIANT_COLORS[variant];

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={CM.overlay}>
          <TouchableWithoutFeedback>
            <View style={CM.box}>
              <Text style={CM.icon}>{ICONS[variant]}</Text>
              <Text style={CM.title}>{title}</Text>
              <Text style={CM.message}>{message}</Text>

              <View style={CM.row}>
                <TouchableOpacity
                  style={[CM.btn, CM.cancelBtn]}
                  onPress={onCancel}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={CM.cancelText}>{cancelLabel}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[CM.btn, { backgroundColor: vc.confirm }]}
                  onPress={onConfirm}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={[CM.confirmText, { color: vc.confirmText }]}>
                    {loading ? 'Please wait…' : confirmLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const CM = StyleSheet.create({
  overlay:    { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'center', alignItems:'center', padding: Spacing.xl },
  box:        { width:'100%', maxWidth:360, backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing['2xl'], alignItems:'center', ...Shadows.lg },
  icon:       { fontSize:38, marginBottom: Spacing.md },
  title:      { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign:'center', marginBottom: Spacing.sm },
  message:    { fontSize: FontSize.base, color: Colors.textSecondary, textAlign:'center', lineHeight:22, marginBottom: Spacing.xl },
  row:        { flexDirection:'row', gap: Spacing.md, width:'100%' },
  btn:        { flex:1, height:48, borderRadius: Radius.md, alignItems:'center', justifyContent:'center' },
  cancelBtn:  { backgroundColor: Colors.grey100, borderWidth:1, borderColor: Colors.border },
  cancelText: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.textSecondary },
  confirmText:{ fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
