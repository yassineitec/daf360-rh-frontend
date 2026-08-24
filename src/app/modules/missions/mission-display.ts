import { BadgeVariant } from '@khalilrebhiitec/daf360';
import { TranslateService } from '@ngx-translate/core';

import { Mission, MissionExpense, MissionStatus } from './mission.model';

/**
 * Display helpers shared by the Missions page, the Billeterie page, and the finance
 * remote's own queue — so none of them can disagree on a badge colour or on what a
 * mission's total actually costs.
 *
 * Labels are NOT here: they are i18n keys resolved by the templates (`MISSIONS.STATUS.*`),
 * unlike `shared/status-badge.utils`, whose French labels are hard-coded.
 */

const STATUS_VARIANTS: Record<MissionStatus, BadgeVariant> = {
  PENDING_HR:       'warning',
  PENDING_FINANCE:  'info',
  APPROVED:         'success',
  REJECTED_HR:      'danger',
  REJECTED_FINANCE: 'danger',
  CANCELLED:        'neutral',
};

export function statusVariant(status: string): BadgeVariant {
  return STATUS_VARIANTS[status as MissionStatus] ?? 'neutral';
}

/** i18n key of a status label. */
export function statusKey(status: string): string {
  return `MISSIONS.STATUS.${status}`;
}

/** Nothing more can happen to the mission. */
export function isTerminal(status: MissionStatus): boolean {
  return status === 'REJECTED_HR' || status === 'REJECTED_FINANCE' || status === 'CANCELLED';
}

/** Still moving through the workflow — the complement of {@link isTerminal}. */
export function isActive(status: MissionStatus): boolean {
  return !isTerminal(status);
}

/**
 * `daf-entity-card`'s status slot has only three looks (UI-PLAYBOOK §6): grey
 * `inactive`, warning `pending`, green for anything else. Six mission statuses collapse
 * onto them and the precision stays in the label.
 */
export function cardStatus(status: MissionStatus): 'active' | 'inactive' | 'pending' {
  if (status === 'APPROVED') return 'active';
  if (isTerminal(status)) return 'inactive';
  return 'pending';
}

/**
 * The card has no danger variant, so — exactly like `/rh/it-provisioning` — a mission
 * needing attention turns its avatar tile red instead. Two cases qualify: a refusal the
 * manager has to act on, and an employee ask waiting on RH.
 */
export function cardBadgeBg(mission: Mission): string | undefined {
  const refused = mission.status === 'REJECTED_HR' || mission.status === 'REJECTED_FINANCE';
  if (refused || mission.pendingChangeRequest) return 'bg-danger';
  return undefined;
}

/** Approved and still to come — what the employee is packing for. */
export function isUpcoming(mission: Mission, today = new Date()): boolean {
  if (mission.status !== 'APPROVED') return false;
  const start = parseIsoDate(mission.startDate)?.getTime();
  return start !== undefined && start > startOfDay(today).getTime();
}

/**
 * A mission whose start date has passed while it is still waiting on a desk. The
 * equivalent of it-provisioning's overdue flag, and the only urgency signal the queues
 * carry.
 */
export function isLate(mission: Mission, today = new Date()): boolean {
  if (mission.status !== 'PENDING_HR' && mission.status !== 'PENDING_FINANCE') return false;
  const start = parseIsoDate(mission.startDate)?.getTime();
  return start !== undefined && start < startOfDay(today).getTime();
}

/** Whole days between today and the departure. Negative once it has started. */
export function daysUntil(startIso: string, today = new Date()): number {
  const start = parseIsoDate(startIso);
  if (!start) return 0;
  return Math.round((start.getTime() - startOfDay(today).getTime()) / 86_400_000);
}

/**
 * The destination on one line — "Tunis, Tunisie" or just "Tunis" for a national mission
 * where the country adds nothing.
 */
export function destination(mission: Mission): string {
  return mission.countryLabel ? `${mission.city}, ${mission.countryLabel}` : mission.city;
}

/**
 * The figure the RH form shows live, BEFORE the server answers. It sums exactly what
 * `MissionExpense#recomputeTotal` sums — the advance excluded, since it is a share of the
 * total paid up front and not an extra cost. Keep the two in step.
 */
export function estimatedTotal(expense: Partial<MissionExpense> | null | undefined): number {
  if (!expense) return 0;
  return [
    expense.missionAllowance, expense.lodgingCost, expense.ticketCost,
    expense.visaFees, expense.insuranceFees, expense.otherFees,
  ].reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

/** Inclusive day count, from the dates alone — used before the server sends `durationDays`. */
export function durationDays(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/**
 * The BCP-47 tag for the active UI language. Same mapping the offboarding, candidate and
 * profile sections use, so a date reads the same way on every RH screen.
 *
 * It matters: every formatter below took `locale = 'fr-FR'` and no caller ever passed
 * anything, so an English UI printed "14 sept. 2026" under an English label. Arabic falls
 * back to French formatting deliberately — `ar-*` would switch to Arabic-Indic digits,
 * which nothing else in the app does.
 */
export function localeOf(lang: string | null | undefined): string {
  return lang === 'en' ? 'en-GB' : 'fr-FR';
}

export function localeDate(iso: string | null, locale = 'fr-FR'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Date + hour, for the travel times — the only values in the process that carry an hour. */
export function localeDateTime(iso: string | null, locale = 'fr-FR'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString(locale, {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
}

export function formatAmount(
  value: number | null | undefined,
  currency: string | null,
  locale = 'fr-FR',
): string {
  if (value === null || value === undefined) return '—';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0, maximumFractionDigits: 3,
  }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

/**
 * The backend's own message when it sent one — it carries the useful detail (which dates
 * clash, which field is missing) that a generic string would throw away. Shared by both RH
 * mission screens so the two report a failure the same way.
 */
export function errorMessage(err: unknown, translate: TranslateService): string {
  const body = (err as { error?: { message?: string } } | null)?.error;
  return body?.message || translate.instant('MISSIONS.COMMON.ERROR');
}

export function initialsOf(fullName: string | null): string {
  const parts = (fullName ?? '').trim().split(/\s+/);
  const from = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return from ? from.toUpperCase() : '—';
}

/**
 * `YYYY-MM-DD` as a LOCAL date. `new Date('2026-08-21')` is parsed as UTC midnight, which
 * renders (and compares) as the previous day west of Greenwich.
 */
export function parseIsoDate(iso: string | null): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? undefined : date;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
