// Bridges the plain ISO date strings used by our DTOs to the Date-based value
// model of daf-multi-date-picker (used here in 'single' selection mode).
export function isoToDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function dateToIso(value: Date | Date[] | null): string {
  if (!value || Array.isArray(value)) return '';
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
