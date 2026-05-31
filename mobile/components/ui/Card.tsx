/**
 * SMSS — Card Component
 */
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
}

export function Card({ children, style, onPress, padded = true, elevated = true }: CardProps) {
  const container: ViewStyle = {
    backgroundColor: Colors.backgroundCard,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         padded ? Spacing.base : 0,
    overflow:        'hidden',
    ...(elevated ? Shadows.sm : {}),
    ...(style as object),
  };

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={container}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={container}>{children}</View>;
}
