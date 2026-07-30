import { avatarUrl } from '../../shared/utils/avatar.utils';

/**
 * Display helpers shared by the /rh/recrutement page, its sections and the
 * kanban card. Kept in one place so the card, the table row and the mobile list
 * can never drift on initials, avatar, fit-score colour or date format.
 */

export function candidateInitials(firstName: string, lastName: string): string {
  return ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase();
}

/**
 * Gender-based avatar image URL, or `undefined` when gender is unknown so the
 * caller falls back to initials.
 */
export function candidateAvatar(gender: string | null | undefined): string | undefined {
  const g = gender?.trim().toUpperCase();
  if (!g || g === 'UNSPECIFIED') return undefined;
  return avatarUrl(gender);
}

/**
 * Colour class for the fit-score chip. Lib tokens only — `teal`, `primary` and
 * `danger` all exist in tokens.css (UI-PLAYBOOK §4). The previous `text-error`
 * only renders because rh-frontend re-registers `error` in its own `@theme`;
 * a lib token can't lose its colour that way.
 */
export function fitScoreClass(score: number | null | undefined): string {
  if (score == null) return 'text-outline';
  if (score >= 85) return 'text-teal';
  if (score >= 65) return 'text-primary';
  return 'text-danger';
}

/** Compact "12 juil. · 14:00" label for a scheduled interview. */
export function interviewDateText(iso: string | null | undefined, locale = 'fr-FR'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export function formatDate(value: string | null | undefined, locale = 'fr-FR'): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}
