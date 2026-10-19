import { TranslateService } from '@ngx-translate/core';
import { FilterOption } from '@khalilrebhiitec/daf360';

import { ProvisioningListItem } from './it-provisioning.model';
import { ListValue } from '../../core/lists/configurable-list.model';
import { adminLabel } from '../../shared/utils/admin-label.utils';

/**
 * Display + derivation helpers shared by the `/rh/it-provisioning` page, its card
 * section and its table section, so the three can never disagree on what "overdue"
 * or "licences complete" means.
 */

/** Total hardware slots a provisioning file tracks — matches the form. */
export const HARDWARE_SLOTS = 6;
/** The five licences the record carries. */
export const LICENCE_SLOTS = 5;

export function initialsOf(fullName: string): string {
  const parts = (fullName ?? '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Past its expected start date and not finished. A completed file is never late. */
export function isOverdue(item: ProvisioningListItem): boolean {
  if (!item.expectedStartDate || item.status === 'COMPLETED') return false;
  return new Date(item.expectedStartDate).getTime() < Date.now();
}

export function overdueDays(item: ProvisioningListItem): number {
  if (!item.expectedStartDate) return 0;
  const diffMs = Date.now() - new Date(item.expectedStartDate).getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

export function licCount(item: ProvisioningListItem): number {
  return [
    item.licenseOffice365,
    item.licenseAutocad,
    item.licenseRevit,
    item.licenseAutodesk,
    item.licenseKaspersky,
  ].filter(Boolean).length;
}

export function hardwareComplete(item: ProvisioningListItem): boolean {
  return (item.assetsProvided ?? 0) >= HARDWARE_SLOTS;
}

export function licencesComplete(item: ProvisioningListItem): boolean {
  return licCount(item) >= LICENCE_SLOTS;
}

// ── Filtres partagés : Profil AD, Poste ──────────────────────────────────────

/** Filter value standing for "no AD profile picked" (the column is optional in the DB). */
export const NO_PROFILE = '__none__';

/** Filter value standing for "no position on the candidate". */
export const NO_POSITION = '__none__';

/**
 * "Profil AD" filter options: the configured `AD_PROFILE_TYPE` list, plus any code still
 * found on a file but since removed from the list (shown by its raw code), plus "Sans profil".
 * The file stores the list's `valueCode`, never its label.
 */
export function profileOptions(
  listValues: ListValue[], items: ProvisioningListItem[], translate: TranslateService,
): FilterOption[] {
  const known = new Set(listValues.map(v => v.valueCode));
  const orphans = [...new Set(items.map(r => r.adProfileType).filter((c): c is string => !!c && !known.has(c)))];
  return [
    ...listValues.map(v => ({ value: v.valueCode, label: adminLabel(v, translate) })),
    ...orphans.sort().map(code => ({ value: code, label: code })),
    { value: NO_PROFILE, label: translate.instant('IT_PROVISIONING.LIST.FILTERS.NO_PROFILE') },
  ];
}

/** "Poste" filter options: the positions found on the loaded files, alphabetical. */
export function positionOptions(items: ProvisioningListItem[], translate: TranslateService): FilterOption[] {
  const positions = [...new Set(items.map(r => r.appliedPosition?.trim()).filter((p): p is string => !!p))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const options = positions.map(p => ({ value: p, label: p }));
  if (items.some(r => !r.appliedPosition?.trim())) {
    options.push({ value: NO_POSITION, label: translate.instant('IT_PROVISIONING.LIST.POSITION_UNSPECIFIED') });
  }
  return options;
}

/** Empty selection = no constraint. */
export function matchesProfile(item: ProvisioningListItem, selected: string[]): boolean {
  return !selected.length || selected.includes(item.adProfileType || NO_PROFILE);
}

/** Empty selection = no constraint. */
export function matchesPosition(item: ProvisioningListItem, selected: string[]): boolean {
  return !selected.length || selected.includes(item.appliedPosition?.trim() || NO_POSITION);
}
