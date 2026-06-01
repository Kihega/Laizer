/**
 * SMSS — Input Component
 */
import { StyleSheet, Text, TextInput as RNInput, TextInputProps, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string; error?: string; hint?: string;
  rightIcon?: React.ReactNode; onPressRightIcon?: () => void;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, hint, rightIcon, onPressRightIcon, containerStyle, style, ...rest }: InputProps) {
  const hasError = Boolean(error);
  return (
    <View style={[IS.container, containerStyle]}>
      {label ? <Text style={IS.label}>{label}</Text> : null}
      <View style={IS.wrapper}>
        <RNInput style={[IS.input, hasError && IS.inputErr, rightIcon ? IS.inputIcon : null, style]}
          placeholderTextColor={Colors.grey400} {...rest} />
        {rightIcon ? (
          <TouchableOpacity style={IS.iconBtn} onPress={onPressRightIcon} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            {rightIcon}
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={IS.errText}>{error}</Text> : hint ? <Text style={IS.hintText}>{hint}</Text> : null}
    </View>
  );
}

const IS = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  label:     { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textSecondary, marginBottom: Spacing.xs },
  wrapper:   { position: 'relative' },
  input:     { height:52, borderWidth:1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.base, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.white },
  inputErr:  { borderColor: Colors.error, backgroundColor: `${Colors.error}0A` },
  inputIcon: { paddingRight:52 },
  iconBtn:   { position:'absolute', right:0, top:0, bottom:0, width:52, alignItems:'center', justifyContent:'center' },
  errText:   { marginTop: Spacing.xs, fontSize: FontSize.xs, color: Colors.error },
  hintText:  { marginTop: Spacing.xs, fontSize: FontSize.xs, color: Colors.textDisabled },
});
