import { isoToDate, dateToIso } from '../date-picker.utils';

/**
 * Value bridges shared by every detail page that has an inline edit mode
 * (`/rh/profiles/:id`, `/rh/candidates/:id`).
 *
 * They started as methods on `ProfileDetailComponent`, then as
 * `profiles/detail-sections/field-bridges.ts`. They live in `shared/detail/`
 * alongside `rh-profile-field` now, for the same reason that component does:
 * two pages render the same label/value pairs and the same controls, so one
 * page's module cannot be the home of the glue.
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
