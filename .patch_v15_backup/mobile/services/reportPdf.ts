/**
 * Laizer — Full report → PDF
 * __LAIZER_PATCH_V14__
 *
 * Builds a formal A4 document (HTML → PDF with expo-print) from the data the
 * owner sees on the full-report screen, then either opens the share sheet
 * ("Share") or saves it to a folder the owner picks ("Download").
 */
import * as Print      from 'expo-print';
import * as Sharing    from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { fmtMoney, serviceLabel } from '@/constants/labels';

export interface ReportData {
  centre: { name: string; centreNo: string; centreId: string; location?: string };
  label: string;
  mode: string;
  rangeStart?: string;
  rangeEnd?: string;
  generatedAt?: string;
  totalEvents: number;
  totalRevenueTshs: number;
  byServiceType: Record<string, number>;
  events: Array<{
    id: string; serviceType: string; serviceSubtype?: string | null;
    pages?: number | null; pricePerPageTshs?: number | null; totalAmountTshs: number;
    createdAt: string;
    worker?: { fullName: string } | null;
  }>;
  stock: Array<{ itemName: string; quantity: number; unit?: string }>;
}

const TZ = 'Africa/Dar_es_Salaam';

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ,
  });

function period(r: ReportData): string {
  if (r.rangeStart && r.rangeEnd) {
    const a = fmtDate(r.rangeStart), b = fmtDate(r.rangeEnd);
    return a === b ? a : `${a} – ${b}`;
  }
  return r.label;
}

export function reportFileName(r: ReportData): string {
  const base = `Laizer_${r.centre.name}_${r.mode}_${r.label}`.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${base}.pdf`;
}

export function buildReportHtml(r: ReportData): string {
  const weekly   = r.mode === 'weekly';
  const generated = fmtDateTime(r.generatedAt ?? new Date().toISOString());

  // revenue per service type (from the log, so it always adds up to the total)
  const revenue: Record<string, number> = {};
  for (const e of r.events) revenue[e.serviceType] = (revenue[e.serviceType] ?? 0) + Number(e.totalAmountTshs);
  const typeRows = Object.keys({ ...r.byServiceType, ...revenue }).sort();
  const top = [...typeRows].sort((a, b) => (r.byServiceType[b] ?? 0) - (r.byServiceType[a] ?? 0))[0];

  const summary = r.totalEvents === 0
    ? `No services were recorded for this branch during the ${weekly ? 'week' : 'day'} covered by this report.`
    : `During the reporting period, <b>${r.totalEvents}</b> service${r.totalEvents === 1 ? ' was' : 's were'} recorded `
      + `at <b>${esc(r.centre.name)}</b>, generating a total revenue of <b>${esc(fmtMoney(r.totalRevenueTshs))}</b>. `
      + (top ? `The most frequent service was <b>${esc(serviceLabel(top))}</b> (${r.byServiceType[top] ?? 0}).` : '');

  const byTypeHtml = typeRows.length === 0
    ? '<p class="none">No services recorded.</p>'
    : `<table>
        <thead><tr><th>Service</th><th class="num">Count</th><th class="num">Revenue</th><th class="num">Share</th></tr></thead>
        <tbody>${typeRows.map(t => {
          const rev = revenue[t] ?? 0;
          const share = r.totalRevenueTshs > 0 ? Math.round((rev / r.totalRevenueTshs) * 100) : 0;
          return `<tr><td>${esc(serviceLabel(t))}</td><td class="num">${r.byServiceType[t] ?? 0}</td>`
               + `<td class="num">${esc(fmtMoney(rev))}</td><td class="num">${share}%</td></tr>`;
        }).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${r.totalEvents}</td><td class="num">${esc(fmtMoney(r.totalRevenueTshs))}</td><td class="num">100%</td></tr></tfoot>
      </table>`;

  const logHtml = r.events.length === 0
    ? '<p class="none">No services recorded.</p>'
    : `<table>
        <thead><tr><th>#</th><th>Date &amp; time</th><th>Service</th><th>Details</th><th>Recorded by</th><th class="num">Amount</th></tr></thead>
        <tbody>${r.events.map((e, i) => {
          const sub = e.serviceSubtype ? (e.serviceSubtype === 'black_and_white' ? 'B&W' : 'Colour') : '';
          const det = [
            sub,
            e.pages != null ? `${e.pages} pages` : '',
            e.pricePerPageTshs != null ? `@ ${fmtMoney(Number(e.pricePerPageTshs))}/page` : '',
          ].filter(Boolean).join(', ') || '—';
          return `<tr><td>${i + 1}</td><td>${esc(fmtDateTime(e.createdAt))}</td><td>${esc(serviceLabel(e.serviceType))}</td>`
               + `<td>${esc(det)}</td><td>${esc(e.worker?.fullName ?? '—')}</td><td class="num">${esc(fmtMoney(Number(e.totalAmountTshs)))}</td></tr>`;
        }).join('')}</tbody>
        <tfoot><tr><td colspan="5">Total revenue</td><td class="num">${esc(fmtMoney(r.totalRevenueTshs))}</td></tr></tfoot>
      </table>`;

  const stockHtml = r.stock.length === 0
    ? '<p class="none">No stock items on record.</p>'
    : `<table>
        <thead><tr><th>#</th><th>Item</th><th class="num">Quantity</th></tr></thead>
        <tbody>${r.stock.map((s, i) =>
          `<tr><td>${i + 1}</td><td>${esc(s.itemName)}</td><td class="num">${Number(s.quantity)} ${esc(s.unit ?? 'pcs')}</td></tr>`).join('')}</tbody>
      </table>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #111827; font-size: 11px; line-height: 1.45; margin: 0; }
  .brand { font-size: 10px; letter-spacing: 3px; color: #1D4ED8; font-weight: 700; }
  h1 { font-size: 22px; margin: 4px 0 2px; color: #0F172A; }
  .sub { color: #6B7280; font-size: 12px; margin-bottom: 10px; }
  .rule { border: 0; border-top: 2px solid #1D4ED8; margin: 10px 0 14px; }
  table.meta { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  table.meta td { padding: 4px 6px; border: 1px solid #E5E7EB; }
  table.meta td.k { width: 22%; background: #F3F4F6; font-weight: 700; color: #374151; }
  h2 { font-size: 13px; margin: 18px 0 6px; color: #1D4ED8; text-transform: uppercase; letter-spacing: 1px;
       border-bottom: 1px solid #D1D5DB; padding-bottom: 3px; }
  p { margin: 4px 0; }
  p.none { color: #6B7280; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { background: #1D4ED8; color: #fff; text-align: left; padding: 5px 6px; font-size: 10px; }
  td { padding: 4px 6px; border-bottom: 1px solid #E5E7EB; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #F9FAFB; }
  tfoot td { font-weight: 700; background: #EFF6FF; border-top: 2px solid #1D4ED8; }
  .num { text-align: right; white-space: nowrap; }
  tr { page-break-inside: avoid; }
  .sign { margin-top: 34px; display: flex; justify-content: space-between; }
  .sign div { width: 44%; border-top: 1px solid #6B7280; padding-top: 4px; color: #374151; }
  .foot { margin-top: 22px; color: #6B7280; font-size: 9px; text-align: center; border-top: 1px solid #E5E7EB; padding-top: 6px; }
</style></head>
<body>
  <div class="brand">LAIZER</div>
  <h1>Branch Activity Report</h1>
  <div class="sub">${weekly ? 'Weekly' : 'Daily'} report &middot; ${esc(period(r))}</div>
  <hr class="rule" />

  <table class="meta">
    <tr><td class="k">Branch</td><td>${esc(r.centre.name)}</td><td class="k">Branch ID</td><td>${esc(r.centre.centreNo || r.centre.centreId)}</td></tr>
    <tr><td class="k">Location</td><td>${esc(r.centre.location || '—')}</td><td class="k">Report type</td><td>${weekly ? 'Weekly' : 'Daily'}</td></tr>
    <tr><td class="k">Period</td><td>${esc(period(r))}</td><td class="k">Generated</td><td>${esc(generated)}</td></tr>
  </table>

  <h2>1. Summary</h2>
  <p>${summary}</p>

  <h2>2. Services by type</h2>
  ${byTypeHtml}

  <h2>3. Service log</h2>
  ${logHtml}

  <h2>4. Stock on hand</h2>
  ${stockHtml}

  <div class="sign"><div>Prepared by</div><div>Owner's signature &amp; date</div></div>
  <div class="foot">Generated by Laizer on ${esc(generated)} &middot; This report reflects the records entered by workers up to that time.</div>
</body></html>`;
}

/** Renders the report to a PDF file in the cache folder and returns its uri. */
export async function createReportPdf(r: ReportData): Promise<{ uri: string; name: string }> {
  const { uri } = await Print.printToFileAsync({ html: buildReportHtml(r), width: 595, height: 842 });
  const name = reportFileName(r);
  const dir  = FileSystem.cacheDirectory;
  if (!dir) return { uri, name };
  const target = `${dir}${name}`;
  try { await FileSystem.deleteAsync(target, { idempotent: true }); } catch { /* none yet */ }
  await FileSystem.moveAsync({ from: uri, to: target });
  return { uri: target, name };
}

/** Opens the system share sheet with the PDF. */
export async function shareReportPdf(r: ReportData): Promise<void> {
  const { uri, name } = await createReportPdf(r);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name });
}

/**
 * Saves the PDF where the owner chooses (Android: pick a folder, e.g. Downloads
 * or Documents). iOS has no folder picker, so it opens the share sheet, which
 * includes "Save to Files". Returns false if the owner cancelled.
 */
export async function downloadReportPdf(r: ReportData): Promise<boolean> {
  const { uri, name } = await createReportPdf(r);
  if (Platform.OS !== 'android') {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name });
    return true;
  }
  const saf  = FileSystem.StorageAccessFramework;
  const perm = await saf.requestDirectoryPermissionsAsync();
  if (!perm.granted) return false;
  const b64  = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const dest = await saf.createFileAsync(perm.directoryUri, name.replace(/\.pdf$/i, ''), 'application/pdf');
  await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
  return true;
}
