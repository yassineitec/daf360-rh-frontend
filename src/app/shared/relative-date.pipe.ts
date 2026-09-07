import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats an ISO date as a relative-time string in French ("il y a 2 jours").
 * Falls back to a short absolute date past 30 days, where "relative" stops being useful.
 */
@Pipe({ name: 'relativeDate', standalone: true, pure: false })
export class RelativeDatePipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '—';

    const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;

    const days = Math.floor(hours / 24);
    if (days === 1) return 'hier';
    if (days < 30) return `il y a ${days} jours`;

    return date.toLocaleDateString('fr-FR');
  }
}
