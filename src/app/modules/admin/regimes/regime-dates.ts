/**
 * The régime screens keep dates as 'YYYY-MM-DD' (what the API takes) while daf-multi-date-picker
 * works on Date. Local midnight both ways: going through toISOString() (UTC) shows the day before
 * for anyone west of Greenwich, and the day after near midnight east of it.
 */
export function isoToDate(text: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

/** The picker's value (single mode gives a Date; an array is tolerated) → 'YYYY-MM-DD', '' when empty. */
export function dateToIso(v: Date | Date[] | null | undefined): string {
  const d = Array.isArray(v) ? v[0] ?? null : v ?? null;
  if (!d) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
