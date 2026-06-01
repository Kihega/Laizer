/**
 * SMSS — Card Component
 */
import { StyleProp, TouchableOpacity, View, ViewStyle }  from 'react-native';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
}

export function Card({ children, style, onPress, padded = true, elevated = true }: CardProps) {
  const base: ViewStyle = {
    backgroundColor: Colors.backgroundCard,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         padded ? Spacing.base : 0,
    overflow:        'hidden',
    ...(elevated ? Shadows.sm : {}),
  };

  const containerStyle: StyleProp<ViewStyle> = [base, style];

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={containerStyle}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={containerStyle}>{children}</View>;
}
