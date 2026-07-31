import { ProvisioningListItem } from './it-provisioning.model';

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
