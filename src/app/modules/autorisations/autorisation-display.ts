import { BadgeVariant } from '@khalilrebhiitec/daf360';
import { AutorisationEtat } from './models/autorisation.model';

/**
 * Presentation helpers shared by every autorisation screen.
 *
 * Free functions rather than a service: none of them touch state or injection, and a screen
 * that needs to format a duration should not have to acquire a dependency to do it.
 */

/** One state, one colour — the same four the congé screens use, so the two never disagree. */
export function etatVariant(etat: AutorisationEtat | string): BadgeVariant {
  switch (etat) {
    case 'VALIDE':  return 'success';
    case 'REFUSE':  return 'danger';
    case 'ARCHIVE': return 'neutral';
    default:        return 'warning';
  }
}

/**
 * Minutes as people say them: "45 min", "2 h", "1 h 30".
 *
 * Formatted here rather than stored: the server owns the number, and a rendered string in the
 * payload could not be re-localised or summed.
 */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** 'HH:mm:ss' → 'HH:mm'. The seconds are always zero and only add noise to a cell. */
export function hhmm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '—';
}

/**
 * The server's message when it has one.
 *
 * rh-service's AppException carries a French sentence naming the actual rule — the daily cap,
 * the monthly cap, an overlap. Showing it beats any generic text the frontend could invent,
 * and it is the only place the configured numbers appear.
 */
export function errorMessage(e: unknown, fallback: string): string {
  const msg = (e as { error?: { message?: string } })?.error?.message;
  return msg && msg.trim() ? msg : fallback;
}
