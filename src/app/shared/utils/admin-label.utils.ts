import { TranslateService } from '@ngx-translate/core';

/** Any rh/admin entry carrying both labels — Référentiels, Listes configurables, régimes… */
export interface BilingualLabel {
  labelFr?: string | null;
  labelEn?: string | null;
}

/**
 * The rh/admin label in the UI language: English when the UI is English and the entry has
 * one, French otherwise (an entry with no English label never renders blank).
 *
 * Reads `translate.currentLang()`, a signal — called inside a `computed`, the list
 * re-labels itself when the user switches language.
 */
export function adminLabel(item: BilingualLabel | null | undefined, translate: TranslateService): string {
  if (!item) return '';
  return (translate.currentLang() === 'en' && item.labelEn) || item.labelFr || item.labelEn || '';
}

/** A role as the Roles table names it: `frenchName` always, `englishName` optional. */
export interface BilingualRoleName {
  frenchName?: string | null;
  englishName?: string | null;
}

/**
 * A role's name in the UI language — same rule as `adminLabel`: English when the UI is
 * English and the role has one, French otherwise.
 */
export function roleLabel(role: BilingualRoleName | null | undefined, translate: TranslateService): string {
  if (!role) return '';
  return (translate.currentLang() === 'en' && role.englishName) || role.frenchName || role.englishName || '';
}
