import { BadgeVariant } from '@khalilrebhiitec/daf360';

import {
  OffboardingStatus, OffboardingWorkflowInstance, computeProgress, findNextDueTask, isTerminal,
} from './models/offboarding.model';

/**
 * Display helpers shared by the `/rh/offboarding` page, its card section and its
 * table section, so the three can never disagree on progress, lateness or the
 * badge variant of a status.
 */

const STATUS_VARIANTS: Record<OffboardingStatus, BadgeVariant> = {
  PENDING:     'neutral',
  IN_PROGRESS: 'teal',
  BLOCKED:     'danger',
  VALIDATED:   'success',
  CANCELLED:   'neutral',
  ARCHIVED:    'neutral',
};

export function statusVariant(status: string): BadgeVariant {
  return STATUS_VARIANTS[status as OffboardingStatus] ?? 'neutral';
}

/**
 * `daf-entity-card`'s status slot has only three looks (§6): grey `inactive`,
 * warning `pending`, green for anything else. Six offboarding statuses collapse
 * onto them and the precision lives in the label.
 */
export function cardStatus(status: OffboardingStatus): 'active' | 'inactive' | 'pending' {
  if (status === 'VALIDATED') return 'active';
  if (status === 'CANCELLED' || status === 'ARCHIVED') return 'inactive';
  return 'pending';
}

export function initialsOf(fullName: string | null): string {
  const parts = (fullName ?? '').trim().split(/\s+/);
  const from = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return from ? from.toUpperCase() : '—';
}

/** Task completion of the workflow, 0–100. Files with no tasks read 0. */
export function progressPct(item: OffboardingWorkflowInstance): number {
  return computeProgress(item.tasks ?? []);
}

export function hasTasks(item: OffboardingWorkflowInstance): boolean {
  return (item.tasks?.length ?? 0) > 0;
}

/** The next task is past its due date — a softer signal than `slaBreachFlag`. */
export function isOverdue(item: OffboardingWorkflowInstance): boolean {
  const next = findNextDueTask(item.tasks ?? []);
  return !!(next?.dueDate && new Date(next.dueDate) < new Date());
}

/** Still running: neither validated, cancelled nor archived. */
export function isActive(item: OffboardingWorkflowInstance): boolean {
  return !isTerminal(item.status);
}

export function localeDate(iso: string | null, locale = 'fr-FR'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}
