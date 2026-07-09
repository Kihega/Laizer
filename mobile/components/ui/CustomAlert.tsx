/**
 * SMSS — CustomAlert
 * __LAIZER_PATCH_V10__
 *
 * A drop-in replacement for React Native's `Alert.alert()`, styled to
 * match the app (icon + title + message + pill buttons) instead of the
 * plain OS dialog. Same call signature as Alert.alert — existing call
 * sites only need `Alert.alert(` swapped for `CustomAlert.alert(`.
 *
 * Mount <CustomAlertHost /> ONCE near the root of the app
 * (see app/_layout.tsx) — everything else just calls CustomAlert.alert().
 */
import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Shadows, Spacing } from '@/constants/theme';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

type IconName = ComponentProps<typeof Ionicons>['name'];
type Listener = (state: AlertState | null) => void;
let listener: Listener | null = null;

function inferIcon(title: string): { name: IconName; color: string } {
  const t = title.toLowerCase();
  if (/error|failed|invalid|denied|not found|missing|mismatch|wrong/.test(t))
    return { name: 'close-circle', color: Colors.error };
  if (/sign out|log ?out|delete|remove|are you sure|confirm|warning/.test(t))
    return { name: 'warning', color: Colors.warning };
  if (/success|registered|saved|done|updated|deleted|sent|created/.test(t))
    return { name: 'checkmark-circle', color: Colors.success };
  return { name: 'information-circle', color: Colors.primary };
}

function buttonColors(style: AlertButton['style']) {
  if (style === 'destructive') return { bg: Colors.error,   fg: Colors.white };
  if (style === 'cancel')      return { bg: Colors.grey100,  fg: Colors.textSecondary };
  return { bg: Colors.primary, fg: Colors.white };
}

export const CustomAlert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const finalButtons = buttons && buttons.length ? buttons : [{ text: 'OK' }];
    listener?.({ title, message, buttons: finalButtons });
  },
};

export function CustomAlertHost() {
  const [state, setState] = useState<AlertState | null>(null);

  useEffect(() => {
    listener = setState;
    return () => { listener = null; };
  }, []);

  if (!state) return null;
  const icon    = inferIcon(state.title);
  const stacked = state.buttons.length > 2;
  const close   = () => setState(null);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <TouchableWithoutFeedback onPress={close}>
        <View style={CA.overlay}>
          <TouchableWithoutFeedback>
            <View style={CA.box}>
              <View style={[CA.iconWrap, { backgroundColor: `${icon.color}1A` }]}>
                <Ionicons name={icon.name} size={30} color={icon.color} />
              </View>
              <Text style={CA.title}>{state.title}</Text>
              {!!state.message && <Text style={CA.message}>{state.message}</Text>}

              <View style={[CA.row, stacked && CA.col]}>
                {state.buttons.map((b, i) => {
                  const c = buttonColors(b.style);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[CA.btn, { backgroundColor: c.bg }, stacked && CA.btnFull]}
                      activeOpacity={0.8}
                      onPress={() => { close(); b.onPress?.(); }}>
                      <Text style={[CA.btnTxt, { color: c.fg }]}>{b.text}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const CA = StyleSheet.create({
  overlay:  { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'center', alignItems:'center', padding: Spacing.xl },
  box:      { width:'100%', maxWidth:360, backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing['2xl'], alignItems:'center', ...Shadows.lg },
  iconWrap: { width:56, height:56, borderRadius:28, alignItems:'center', justifyContent:'center', marginBottom: Spacing.md },
  title:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign:'center', marginBottom: Spacing.sm },
  message:  { fontSize: FontSize.base, color: Colors.textSecondary, textAlign:'center', lineHeight:22, marginBottom: Spacing.xl },
  row:      { flexDirection:'row', gap: Spacing.md, width:'100%' },
  col:      { flexDirection:'column' },
  btn:      { flex:1, height:48, borderRadius: Radius.md, alignItems:'center', justifyContent:'center' },
  btnFull:  { flex: undefined as unknown as number, width:'100%', marginBottom: Spacing.sm },
  btnTxt:   { fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
