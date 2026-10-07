import { TranslateService } from '@ngx-translate/core';

// Canonical gender vocabulary — mirrors the backend GENDER configurable-list
// value_codes (MALE/FEMALE/OTHER/UNSPECIFIED). This is the single source of truth
// for gender option values on the frontend; avatar selection keys off `FEMALE`.
export type GenderCode = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';

export interface GenderOption {
  value: GenderCode;
  /** French label — what callers without a TranslateService fall back to. */
  label: string;
  /** i18n key (GENDER.*) for the label in the UI language. */
  labelKey: string;
}

export const GENDER_OPTIONS: readonly GenderOption[] = [
  { value: 'MALE', label: 'Homme', labelKey: 'GENDER.MALE' },
  { value: 'FEMALE', label: 'Femme', labelKey: 'GENDER.FEMALE' }
];

const GENDER_BY_CODE: Record<string, GenderOption> = GENDER_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o }),
  {} as Record<string, GenderOption>,
);

/** Homme / Femme as select options, labelled in the UI language. */
export function genderOptions(translate: TranslateService): { value: GenderCode; label: string }[] {
  return GENDER_OPTIONS.map(o => ({ value: o.value, label: translate.instant(o.labelKey) }));
}

/** Maps a stored gender code to its label — in the UI language when a TranslateService is
 *  given, French otherwise; falls back to the raw value.
 *  Case-insensitive so legacy data (e.g. "Female") still resolves to a label. */
export function genderLabel(code: string | null | undefined, translate?: TranslateService): string {
  const key = code?.trim();
  if (!key) return '—';
  const option = GENDER_BY_CODE[key.toUpperCase()];
  if (!option) return key;
  return translate ? translate.instant(option.labelKey) : option.label;
}
