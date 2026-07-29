import type { BadgeVariant } from '@khalilrebhiitec/daf360';
import type { TranslateService } from '@ngx-translate/core';

/**
 * Single source of truth for the labels shared by the /rh/profiles card view,
 * table view and filter panel. Keeping them here is what stops the three from
 * drifting — the card used to carry its own copy of the contract-code set.
 *
 * Callers must read `translate.currentLang()` in the surrounding `computed()` so
 * the label re-resolves on a language switch; these helpers are pure.
 */

/**
 * Contract-type codes that have a translated label.
 *
 * `employee_profiles.contract_type` is a free `varchar(50)` holding two
 * generations of codes: the onboarding wizard writes PERMANENT / FIXED_TERM /
 * INTERN / CONSULTANT, while older rows hold CDI / CDD / … Anything not listed
 * here renders as the raw code — never as a bare translation key.
 */
export const CONTRACT_CODES = new Set([
  'PERMANENT', 'FIXED_TERM', 'INTERN', 'CONSULTANT',
  'CDI', 'CDD', 'CIVP', 'STAGE', 'DETACHEMENT', 'PORTAGE', 'FREELANCE',
]);

export function contractLabel(
  code: string | null | undefined,
  translate: TranslateService,
): string {
  if (!code) return '—';
  return CONTRACT_CODES.has(code)
    ? translate.instant('PROFILES.CONTRACT_TYPE.' + code)
    : code;
}

/** Mirrors the backend LifecycleStatus enum, in state-machine order. */
export const LIFECYCLE_CODES = [
  'PRE_ONBOARDING', 'ACTIVE', 'ON_LEAVE', 'ON_MISSION',
  'OFFBOARDING', 'TERMINATED', 'ARCHIVED',
] as const;

export type LifecycleCode = typeof LIFECYCLE_CODES[number];

/** Badge variant per lifecycle state, for the table view's status column. */
const LIFECYCLE_VARIANT: Record<string, BadgeVariant> = {
  PRE_ONBOARDING: 'secondary',
  ACTIVE:         'success',
  ON_LEAVE:       'warning',
  ON_MISSION:     'info',
  OFFBOARDING:    'warning',
  TERMINATED:     'danger',
  ARCHIVED:       'neutral',
};

/** Dot colour + glow per lifecycle state, for the card view's status line. */
const LIFECYCLE_DOT: Record<string, { color: string; glow?: string }> = {
  PRE_ONBOARDING: { color: '#8b5cf6' },
  ACTIVE:         { color: '#10b981', glow: '0 0 8px rgba(16,185,129,0.5)' },
  ON_LEAVE:       { color: '#f59e0b' },
  ON_MISSION:     { color: '#3b82f6' },
  OFFBOARDING:    { color: '#f97316' },
  TERMINATED:     { color: '#ef4444' },
  ARCHIVED:       { color: '#6b7280' },
};

const UNKNOWN_DOT = '#6b7280';

export function lifecycleLabel(
  status: string | null | undefined,
  translate: TranslateService,
): string {
  if (!status) return '—';
  return LIFECYCLE_VARIANT[status]
    ? translate.instant('PROFILES.LIFECYCLE.' + status)
    : status;
}

export function lifecycleVariant(status: string | null | undefined): BadgeVariant {
  return (status && LIFECYCLE_VARIANT[status]) || 'neutral';
}

export function lifecycleDotColor(status: string | null | undefined): string {
  return (status && LIFECYCLE_DOT[status]?.color) || UNKNOWN_DOT;
}

export function lifecycleDotGlow(status: string | null | undefined): string | null {
  return (status && LIFECYCLE_DOT[status]?.glow) || null;
}
