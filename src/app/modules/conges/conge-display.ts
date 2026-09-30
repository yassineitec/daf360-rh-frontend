import { BadgeVariant } from '@khalilrebhiitec/daf360';
import { getAvatarUrl } from '../../shared/utils/avatar.utils';
import { CongeRow, DemandeEtat } from './models/conge.model';

/**
 * Display helpers shared by every congé screen.
 *
 * Here rather than in each component so the four pages cannot badge the same state two
 * different colours — the drift UI-PLAYBOOK §6b rule 5 exists to stop. Pure functions, no
 * Angular, so they are testable on their own.
 */

/** One state → one colour, everywhere. */
const STATE_VARIANT: Record<DemandeEtat, BadgeVariant> = {
  EN_ATTENTE: 'warning',
  VALIDE: 'success',
  REFUSE: 'danger',
  ARCHIVE: 'neutral',
};

export function stateVariant(etat: DemandeEtat): BadgeVariant {
  return STATE_VARIANT[etat] ?? 'neutral';
}

export function stateKey(etat: DemandeEtat): string {
  return 'CONGES.ETAT.' + etat;
}

/**
 * `daf-entity-card` has ONE status slot with three looks, so the four states collapse onto
 * it and the precision stays in `statusLabel`. A refusal reads as `inactive` rather than
 * getting a colour the component does not have.
 */
export function cardStatus(etat: DemandeEtat): 'active' | 'inactive' | 'pending' {
  switch (etat) {
    case 'EN_ATTENTE': return 'pending';
    case 'VALIDE':     return 'active';
    default:           return 'inactive';
  }
}

/**
 * The avatar tile's colour. A complete literal class — a runtime-assembled one is never
 * emitted by Tailwind (UI-PLAYBOOK §3), so these are spelled out in full.
 */
export function cardBadgeBg(etat: DemandeEtat): string {
  switch (etat) {
    case 'REFUSE':  return 'bg-danger';
    case 'VALIDE':  return 'bg-success';
    case 'ARCHIVE': return 'bg-outline';
    default:        return 'bg-warning';
  }
}

/**
 * The employee's photo for a list row or a modal, or the gendered placeholder.
 *
 * Delegates to the shared `getAvatarUrl` rather than building a URL here, so congé screens
 * resolve a face exactly as `/rh/profiles` does — same `?size=sm` variant, same cache-busting
 * token, same placeholder. `daf-avatar` then picks: photo, else initials, and initials again
 * if the photo 404s.
 *
 * Returns undefined, not null, when there is nothing to show: `AvatarData.avatarUrl` is
 * optional and an explicit null would still be "a URL was supplied".
 */
export function avatarFor(row: CongeRow): string | undefined {
  return getAvatarUrl(row.collaborateurProfileId, row.collaborateurPhotoUrl, row.collaborateurGender)
    || undefined;
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** Dates and numbers follow the UI language rather than a hard-wired fr-FR. */
export function localeOf(lang: string | null | undefined): string {
  switch (lang) {
    case 'en': return 'en-GB';
    case 'ar': return 'ar-TN';
    default:   return 'fr-FR';
  }
}

/**
 * An ISO date rendered in the given locale.
 *
 * Built from the parts rather than `new Date(iso)`: an ISO date string is parsed as UTC and
 * then rendered in local time, which shows the previous day for anyone west of Greenwich —
 * the exact class of bug this module moved away from.
 */
export function localeDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** The period cell: one date when it is one day, a range otherwise. */
export function periodOf(row: CongeRow, locale: string): string {
  return row.dateDebut === row.dateFin
    ? localeDate(row.dateDebut, locale)
    : `${localeDate(row.dateDebut, locale)} → ${localeDate(row.dateFin, locale)}`;
}

/** Half-days are 0.5, so the count keeps one decimal but drops a trailing `,0`. */
export function formatDays(value: number | null | undefined, locale: string): string {
  if (value == null) return '—';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

/** Server error bodies carry the rule that blocked the call; fall back to a translated line. */
export function errorMessage(err: unknown, fallback: string): string {
  const body = (err as { error?: { message?: string; detail?: string } } | null)?.error;
  return body?.message || body?.detail || fallback;
}
