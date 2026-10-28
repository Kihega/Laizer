/**
 * Laizer — shared display helpers
 * __LAIZER_PATCH_V12__
 */

export const SERVICE_LABELS: Record<string, string> = {
  photocopy:     'Photocopy',
  printing:      'Printing',
  lamination:    'Lamination',
  scanning:      'Scanning',
  designing:     'Designing',
  passport_size: 'Passport size',
  other:         'Other',
};

/** "passport_size" -> "Passport size" (unknown values are prettified). */
export function serviceLabel(type: string): string {
  if (!type) return '';
  return SERVICE_LABELS[type] ?? (type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '));
}

export function fmtMoney(n: number): string {
  return `Tshs ${Number(n || 0).toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;
}
