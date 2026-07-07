// Canonical gender vocabulary — mirrors the backend GENDER configurable-list
// value_codes (MALE/FEMALE/OTHER/UNSPECIFIED). This is the single source of truth
// for gender option values on the frontend; avatar selection keys off `FEMALE`.
export type GenderCode = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';

export interface GenderOption {
  value: GenderCode;
  label: string;
}

export const GENDER_OPTIONS: readonly GenderOption[] = [
  { value: 'MALE', label: 'Homme' },
  { value: 'FEMALE', label: 'Femme' },
  { value: 'OTHER', label: 'Autre' },
  { value: 'UNSPECIFIED', label: 'Non précisé' },
];

const GENDER_LABELS: Record<string, string> = GENDER_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>,
);

/** Maps a stored gender code to its French label; falls back to the raw value.
 *  Case-insensitive so legacy data (e.g. "Female") still resolves to a label. */
export function genderLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return GENDER_LABELS[code.toUpperCase()] ?? code;
}
