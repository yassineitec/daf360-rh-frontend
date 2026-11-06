import { BadgeVariant } from '@khalilrebhiitec/daf360';
import { TeletravailCategory } from './models/teletravail.model';

/**
 * Presentation helpers shared by the télétravail screens. Free functions, as for the
 * autorisations: nothing here touches state.
 */

/** A full day reads as primary; the two halves share a softer tone so they read as « half ». */
export function categoryVariant(c: TeletravailCategory | string): BadgeVariant {
  return c === 'FULL_DAY' ? 'info' : 'neutral';
}

/** Material Symbol for a duration — sun up for the morning, sun down for the afternoon. */
export function categoryIcon(c: TeletravailCategory | string): string {
  switch (c) {
    case 'HALF_DAY_MORNING':   return 'wb_twilight';
    case 'HALF_DAY_AFTERNOON': return 'wb_sunny';
    default:                   return 'home_work';
  }
}

/** "1 j", "0,5 j" — the decimal written the way French readers expect. */
export function formatJours(jours: number | null | undefined, lang = 'fr'): string {
  if (jours == null) return '—';
  const n = new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: 1 })
    .format(jours);
  return lang === 'en' ? `${n} d` : `${n} j`;
}
