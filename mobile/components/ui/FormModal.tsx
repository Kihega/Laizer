/**
 * Laizer — FormModal
 * __LAIZER_PATCH_V14__
 *
 * Every "add / register / send / log" form opens in this popup, on top of the
 * list screen behind it. The card scrolls when it is taller than the free
 * space and keeps the focused input above the keyboard.
 */
import type { ReactNode } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from './KeyboardAwareScrollView';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  children?: ReactNode;
}

export function FormModal({ visible, onClose, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={{ padding: Spacing.base }}
        >
          <View style={styles.box}>{children}</View>
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  scroll:  { width: '100%', flexGrow: 0, maxHeight: '96%' },
  box:     { width: '100%', backgroundColor: Colors.white, borderRadius: Radius.xl,
             padding: Spacing.xl, ...Shadows.lg },
});
