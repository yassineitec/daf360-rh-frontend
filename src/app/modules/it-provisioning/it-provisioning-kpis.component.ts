import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MetricCardComponent, MetricDelta } from '@khalilrebhiitec/daf360';

import { ProvisioningListItem } from './it-provisioning.model';
import { isOverdue } from './it-provisioning-display';

/** Local calendar month as `yyyy-MM` — `toISOString()` would shift it to UTC. */
function thisMonth(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/**
 * The KPI row of the « Provisioning IT » page — ABOVE the « Dossiers en cours | Historique »
 * strip and the same on both tabs: the page's own figures, not one tab's.
 *
 * The two tabs used to draw their own row under the strip (four « in progress » tiles on one,
 * three « history » tiles on the other), so the figures changed with the tab. One row now
 * covers both sides of the page:
 *   Dossiers en cours · En retard · Traités ce mois-ci · Délai moyen (jours).
 *
 * Presentational: both pages already load every file (`getAllList`) and pass it in, so this
 * costs no request. Counted on the whole set — never on a search, a filter or a page.
 */
@Component({
  selector: 'rh-it-provisioning-kpis',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MetricCardComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <section data-guide="kpis" class="grid grid-cols-4 gap-2 sm:gap-6">
      <daf-metric-card
        [label]="'IT_PROVISIONING.LIST.KPI_PENDING' | translate"
        [value]="stats().open"
        [delta]="openDelta()"
        [options]="{ icon: 'assignment_late', iconColor: 'text-primary', iconBg: 'bg-primary/10' }" />

      <daf-metric-card
        [label]="'IT_PROVISIONING.LIST.KPI_OVERDUE' | translate"
        [value]="stats().overdue"
        [delta]="overdueDelta()"
        [options]="{ icon: 'error', iconColor: 'text-danger', iconBg: 'bg-danger/10' }" />

      <daf-metric-card
        [label]="'IT_PROVISIONING.HISTORY.KPI.THIS_MONTH' | translate"
        [value]="stats().doneThisMonth"
        [options]="{ icon: 'calendar_month', iconColor: 'text-success', iconBg: 'bg-success/10' }" />

      <daf-metric-card
        [label]="'IT_PROVISIONING.HISTORY.KPI.AVG_DAYS' | translate"
        [value]="stats().avgDays"
        [options]="{ icon: 'timer', iconColor: 'text-warning', iconBg: 'bg-warning/10' }" />
    </section>
  `,
})
export class ItProvisioningKpisComponent {
  private readonly translate = inject(TranslateService);

  /** Every IT file, open and completed. */
  readonly items = input.required<ProvisioningListItem[]>();

  readonly stats = computed(() => {
    const all = this.items();
    const open = all.filter(r => r.status !== 'COMPLETED');
    const done = all.filter(r => r.status === 'COMPLETED');
    const month = thisMonth();
    // Days from file creation to completion — files missing either date are left out.
    const durations = done
      .filter(r => r.completedAt && r.createdAt)
      .map(r => (new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime()) / 86_400_000);
    return {
      total:         all.length,
      open:          open.length,
      overdue:       open.filter(r => isOverdue(r)).length,
      doneThisMonth: done.filter(r => r.completedAt?.slice(0, 7) === month).length,
      avgDays:       durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0,
    };
  });

  /** Share of all files already completed. */
  protected readonly openDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const s = this.stats();
    if (!s.total) return null;
    const rate = Math.round(((s.total - s.open) / s.total) * 100);
    return {
      value: this.translate.instant('IT_PROVISIONING.LIST.DELTA_COMPLETE', { pct: rate }),
      direction: rate >= 70 ? 'up' : rate >= 40 ? 'neutral' : 'down',
    };
  });

  protected readonly overdueDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const overdue = this.stats().overdue;
    if (overdue === 0) return null;
    return { value: this.translate.instant('IT_PROVISIONING.LIST.DELTA_OVERDUE', { count: overdue }), direction: 'down' };
  });
}
