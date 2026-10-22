import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Formats an ISO date as a relative-time string in the UI language ("il y a 2 jours" /
 * "2 days ago"). Falls back to a short absolute date past 30 days, where "relative" stops
 * being useful.
 *
 * Reads `translate.currentLang()`, a signal — called inside a `computed`, the value
 * re-renders when the user switches language. Created with `new` in a field initializer,
 * it still gets the TranslateService (that is an injection context); without one, French.
 */
@Pipe({ name: 'relativeDate', standalone: true, pure: false })
export class RelativeDatePipe implements PipeTransform {
  private translate = inject(TranslateService, { optional: true });

  transform(iso: string | null | undefined): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '—';
    const en = this.translate?.currentLang() === 'en';

    const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (minutes < 1) return en ? 'just now' : "à l'instant";
    if (minutes < 60) return en ? `${minutes} min ago` : `il y a ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return en ? `${hours} h ago` : `il y a ${hours} h`;

    const days = Math.floor(hours / 24);
    if (days === 1) return en ? 'yesterday' : 'hier';
    if (days < 30) return en ? `${days} days ago` : `il y a ${days} jours`;

    return date.toLocaleDateString(en ? 'en-GB' : 'fr-FR');
  }
}
