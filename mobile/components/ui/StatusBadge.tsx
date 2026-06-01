/**
 * SMSS — StatusBadge Component
 * Used for service types, notice priorities, stock units, etc.
 */
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, FontSize, FontWeight, Radius }          from '@/constants/theme';

type BadgeVariant =
  | 'photocopy' | 'printing' | 'lamination' | 'scanning' | 'designing' | 'other'
  | 'urgent' | 'normal' | 'low'
  | 'active' | 'inactive'
  | 'pcs' | 'boxes'
  | 'owner' | 'worker';

const CONFIG: Record<BadgeVariant, { bg: string; text: string; label: string }> = {
  // Service types
  photocopy:  { bg: '#EDE9FE', text: '#5B21B6', label: 'Photocopy'  },
  printing:   { bg: '#DBEAFE', text: '#1E40AF', label: 'Printing'   },
  lamination: { bg: '#DCFCE7', text: '#14532D', label: 'Lamination' },
  scanning:   { bg: '#CCFBF1', text: '#134E4A', label: 'Scanning'   },
  designing:  { bg: '#FEF9C3', text: '#713F12', label: 'Designing'  },
  other:      { bg: '#F3F4F6', text: '#374151', label: 'Other'      },
  // Notice priorities
  urgent:  { bg: Colors.errorSurface,   text: Colors.error,   label: 'Urgent'  },
  normal:  { bg: Colors.infoSurface,    text: Colors.info,    label: 'Normal'  },
  low:     { bg: Colors.grey100,        text: Colors.grey600, label: 'Low'     },
  // Active state
  active:   { bg: Colors.successSurface, text: Colors.success, label: 'Active'   },
  inactive: { bg: Colors.grey100,        text: Colors.grey500, label: 'Inactive' },
  // Units
  pcs:   { bg: Colors.primarySurface, text: Colors.primary, label: 'pcs'   },
  boxes: { bg: Colors.accentSurface,  text: Colors.accent,  label: 'boxes' },
  // Roles
  owner:  { bg: '#EDE9FE', text: '#5B21B6', label: 'Owner'  },
  worker: { bg: '#DBEAFE', text: '#1E40AF', label: 'Worker' },
};

interface BadgeProps {
  type:  BadgeVariant;
  label?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export default function StatusBadge({ type, label, size = 'md', style }: BadgeProps) {
  const cfg      = CONFIG[type] ?? CONFIG.other;
  const display  = label ?? cfg.label;
  const isSmall  = size === 'sm';
  return (
    <View style={[
      BS.base,
      { backgroundColor: cfg.bg, paddingVertical: isSmall ? 2 : 4, paddingHorizontal: isSmall ? 6 : 10 },
      style,
    ]}>
      <Text style={[BS.text, { color: cfg.text, fontSize: isSmall ? FontSize.xs : FontSize.sm }]}>
        {display}
      </Text>
    </View>
  );
}

const BS = StyleSheet.create({
  base: { borderRadius: Radius.full, alignSelf: 'flex-start' },
  text: { fontWeight: FontWeight.semiBold, letterSpacing: 0.2 },
});

// ── components/ui/index.ts barrel ─────────────────────────────────────────────
// Re-export all UI components for clean imports: import { Button, Card } from '@/components/ui'
export { Button }      from './Button';
export { Input }       from './Input';
export { Card }        from './Card';

