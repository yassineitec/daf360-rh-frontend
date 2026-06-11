import { Pipe, PipeTransform } from '@angular/core';

export type SlaLevel = 'ok' | 'warning' | 'critical' | 'none';

export interface SlaResult {
  label: string;
  level: SlaLevel;
  hours: number | null;
}

/**
 * Transforms an ISO due-date string into an SLA status object.
 * Usage: {{ task.dueDate | slaCountdown }}
 *
 * Levels:
 *   none     — no due date
 *   ok       — more than 72 hours remaining
 *   warning  — 0–72 hours remaining
 *   critical — overdue (negative hours)
 */
@Pipe({ name: 'slaCountdown', standalone: true, pure: false })
export class SlaCountdownPipe implements PipeTransform {
  transform(dueDateIso: string | null | undefined): SlaResult {
    if (!dueDateIso) return { label: '—', level: 'none', hours: null };

    const due  = new Date(dueDateIso);
    const now  = new Date();
    const ms   = due.getTime() - now.getTime();
    const hrs  = Math.round(ms / 3_600_000);
    const days = Math.floor(Math.abs(hrs) / 24);
    const rem  = Math.abs(hrs) % 24;

    let label: string;
    let level: SlaLevel;

    if (hrs < 0) {
      label = days > 0 ? `-${days}j ${rem}h` : `-${Math.abs(hrs)}h`;
      level = 'critical';
    } else if (hrs <= 72) {
      label = days > 0 ? `${days}j ${rem}h` : `${hrs}h`;
      level = 'warning';
    } else {
      label = `${days}j ${rem}h`;
      level = 'ok';
    }

    return { label, level, hours: hrs };
  }
}
