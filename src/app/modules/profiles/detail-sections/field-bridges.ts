import { isoToDate, dateToIso } from '../../../shared/date-picker.utils';

/**
 * Value bridges shared by every profile-detail section.
 *
 * They used to be methods on `ProfileDetailComponent`, which meant a section could
 * only exist inside that template. Extracted as plain functions so each section
 * imports what it needs and stays independently testable.
 */

/** ISO date → locale display, or `null` so `rh-profile-field` renders its em dash. */
export function fmtDate(iso: string | null | undefined, locale = 'fr-FR'): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale);
}

/** Nullable FK id → `daf-select`'s `string[]` selection model. */
export function toSelected(id: number | null | undefined): string[] {
  return id != null ? [String(id)] : [];
}

/** `daf-select`'s emitted `string[]` → nullable FK id. */
export function fromSelected(values: string[]): number | null {
  return values[0] ? Number(values[0]) : null;
}

/** `daf-form-field` emits `string | number | null`; these narrow it to the DTO's shape. */
export function asText(v: string | number | null): string {
  return v == null ? '' : String(v);
}

export function asNumber(v: string | number | null): number | null {
  return v == null || v === '' ? null : Number(v);
}

/** `daf-multi-date-picker` speaks `Date`; the DTO speaks ISO strings. */
export const toDate = isoToDate;
export const fromDate = dateToIso;
