import { BadgeVariant } from '@khalilrebhiitec/daf360';

import { getAvatarUrl, getInitials } from '../../shared/utils/avatar.utils';
import { KanbanCandidate } from './services/pipeline.service';

/**
 * Display helpers shared by the /rh/candidates page, its sections and the
 * kanban card. Kept in one place so the board card, the table row and the
 * mobile list can never drift on initials, avatar, fit-score colour or badge
 * variant — they used to each carry their own copy.
 */

const BADGE_VARIANT: Record<string, BadgeVariant> = {
  urgent:      'danger',
  new:         'info',
  in_progress: 'teal',
  offer:       'warning',
  hired:       'success',
  rejected:    'neutral',
  top:         'success',
};

/** Card badge variant for the backend's `badgeType`. */
export function badgeVariant(badgeType: string | undefined): BadgeVariant {
  return BADGE_VARIANT[badgeType ?? ''] ?? 'neutral';
}

/** Badge variant for a board stage, used by the table's `stage` column. */
export function stageVariant(stage: string | undefined): BadgeVariant {
  switch ((stage ?? '').toUpperCase()) {
    case 'RECRUTE':   return 'success';
    case 'OFFRE':     return 'warning';
    case 'ENTRETIEN': return 'teal';
    default:          return 'info';
  }
}

export function candidateInitials(fullName: string | null | undefined): string {
  return fullName ? getInitials(fullName) : '';
}

export function candidateAvatar(c: KanbanCandidate): string {
  return getAvatarUrl(c.id, c.photoUrl, c.gender);
}

/**
 * Colour class for the fit-score chip. Lib tokens only — `teal`, `primary` and
 * `danger` all exist in tokens.css (UI-PLAYBOOK §4). The board used to hardcode
 * `text-[#79D7BE]`, a raw hex that no token backs and no other page shares.
 */
export function fitScoreClass(score: number | null | undefined): string {
  if (score == null) return 'text-outline';
  if (score >= 85)   return 'text-teal';
  if (score >= 65)   return 'text-primary';
  return 'text-danger';
}
