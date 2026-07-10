// Laizer — Per-user theme hook (light / dark)
// __LAIZER_PATCH_V11__
// Backed by the single shared ThemeProvider (mounted once in
// app/_layout.tsx) instead of a private per-screen copy, so toggling the
// mode from ANY screen's side menu instantly applies to every other
// screen for the same signed-in user. Same return shape as before, so
// every existing call site keeps working unchanged.
export { useAppTheme as useTheme } from '@/store/ThemeProvider';
export type { AppTheme, ThemeColors } from '@/store/ThemeProvider';
