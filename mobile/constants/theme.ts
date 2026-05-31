/**
 * SMSS — Design System
 * Professional blue/indigo palette for a stationery business management app.
 */

export const BrandColors = {
  blue:      '#1D4ED8',
  blueDark:  '#1E3A8A',
  blueLight: '#3B82F6',
  teal:      '#0F766E',
  tealLight: '#14B8A6',
  amber:     '#D97706',
  amberLight:'#FCD34D',
  white:     '#FFFFFF',
} as const;

export const Colors = {
  // Primary — deep blue
  primary:        '#1D4ED8',
  primaryDark:    '#1E3A8A',
  primaryLight:   '#3B82F6',
  primarySurface: '#EFF6FF',

  // Accent — teal (for revenue/money indicators)
  accent:         '#0F766E',
  accentLight:    '#14B8A6',
  accentSurface:  '#F0FDFA',

  // Warning — amber
  warning:        '#D97706',
  warningLight:   '#FCD34D',
  warningSurface: '#FFFBEB',

  // Neutrals
  grey900: '#111827',
  grey800: '#1F2937',
  grey700: '#374151',
  grey600: '#4B5563',
  grey500: '#6B7280',
  grey400: '#9CA3AF',
  grey300: '#D1D5DB',
  grey200: '#E5E7EB',
  grey100: '#F3F4F6',
  grey50:  '#F9FAFB',
  white:   '#FFFFFF',

  // Semantic
  success:        '#059669',
  successSurface: '#ECFDF5',
  error:          '#DC2626',
  errorSurface:   '#FEF2F2',
  info:           '#2563EB',
  infoSurface:    '#EFF6FF',

  // Backgrounds
  background:          '#F9FAFB',
  backgroundSecondary: '#F3F4F6',
  backgroundCard:      '#FFFFFF',

  // Text
  textPrimary:   '#111827',
  textSecondary: '#4B5563',
  textDisabled:  '#9CA3AF',
  textInverse:   '#FFFFFF',

  // Borders
  border:        '#E5E7EB',
  borderFocused: '#1D4ED8',
  divider:       '#F3F4F6',

  // Notice priorities
  priorityLow:    '#6B7280',
  priorityNormal: '#1D4ED8',
  priorityUrgent: '#DC2626',

  // Service type pills
  servicePhotocopy: '#7C3AED',
  servicePrinting:  '#1D4ED8',
  serviceLamination:'#059669',
  serviceScanning:  '#0F766E',
  serviceDesigning: '#D97706',
  serviceOther:     '#6B7280',
} as const;

export type ColorKey = keyof typeof Colors;

export const FontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  '2xl':28,
  '3xl':34,
  display: 48,
} as const;

export const FontWeight = {
  regular:   '400' as const,
  medium:    '500' as const,
  semiBold:  '600' as const,
  bold:      '700' as const,
  extraBold: '800' as const,
  black:     '900' as const,
} as const;

export const Spacing = {
  xs: 4, sm: 8, md: 12, base: 16,
  lg: 20, xl: 24, '2xl': 32, '3xl': 40,
} as const;

export const Radius = {
  sm: 6, md: 10, lg: 14, xl: 20, full: 9999,
} as const;

export const Shadows = {
  sm: { shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.07, shadowRadius:3,  elevation:2 },
  md: { shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.09, shadowRadius:6,  elevation:4 },
  lg: { shadowColor:'#1D4ED8', shadowOffset:{width:0,height:4}, shadowOpacity:0.13, shadowRadius:12, elevation:8 },
} as const;

// ── Dark mode palette helper ──────────────────────────────────────────────────
export type Theme = 'light' | 'dark';

export function palette(theme: Theme) {
  const dark = theme === 'dark';
  return {
    bg:         dark ? '#0F172A' : Colors.background,
    card:       dark ? '#1E293B' : Colors.backgroundCard,
    headerBg:   dark ? '#1E293B' : Colors.primary,
    headerText: '#FFFFFF',
    text:       dark ? '#F1F5F9' : Colors.textPrimary,
    textSub:    dark ? '#94A3B8' : Colors.textSecondary,
    textMuted:  dark ? '#64748B' : Colors.grey400,
    border:     dark ? '#334155' : Colors.border,
    accent:     Colors.primary,
    statCard:   dark ? '#1E293B' : Colors.backgroundCard,
    navBg:      dark ? '#1E293B' : Colors.white,
    navBorder:  dark ? '#334155' : Colors.border,
    navActive:  Colors.primary,
    inputBg:    dark ? '#1E293B' : Colors.white,
    inputBorder:dark ? '#475569' : Colors.border,
  };
}
