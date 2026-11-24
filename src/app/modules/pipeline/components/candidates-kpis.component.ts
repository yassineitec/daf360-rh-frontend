import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MetricCardComponent, MetricDelta } from '@khalilrebhiitec/daf360';

import { PipelineStats } from '../services/pipeline.service';

/**
 * The KPI row of the « Candidats » page — Total candidats, Délai moyen, Postes urgents.
 *
 * Page-level figures, so they sit ABOVE the Kanban | Historique tab strip and are drawn by
 * both tabs: switching tab changes the content under the strip, never the page's own
 * figures. One component so the two tabs can never show them differently.
 *
 * Presentational: each page fetches `/pipeline/stats` and passes it in (null = not loaded
 * yet, or the call failed — the tiles show 0 / « — » rather than block the page).
 */
@Component({
  selector: 'rh-candidates-kpis',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MetricCardComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <!-- One row at every width, never wraps: grid-cols-3 gap-2 covers mobile too. -->
    <section data-guide="kpis" class="grid grid-cols-3 gap-2 sm:gap-6">
      <daf-metric-card
        [label]="'PIPELINE.KPI_TOTAL' | translate"
        [value]="totalValue()"
        [delta]="totalDelta()"
        [options]="{ icon: 'group', iconColor: 'text-primary', iconBg: 'bg-primary/10' }" />

      <daf-metric-card
        [label]="'PIPELINE.KPI_AVG_DELAY' | translate"
        [value]="delayValue()"
        [delta]="delayDelta()"
        [options]="{ icon: 'timer', iconColor: 'text-teal', iconBg: 'bg-teal/10' }" />

      <daf-metric-card
        [label]="'PIPELINE.KPI_URGENT' | translate"
        [value]="urgentValue()"
        [delta]="urgentDelta()"
        [options]="{ icon: 'priority_high', iconColor: 'text-danger', iconBg: 'bg-danger/10' }" />
    </section>
  `,
})
export class CandidatesKpisComponent {
  private readonly translate = inject(TranslateService);

  readonly stats = input<PipelineStats | null>(null);

  private readonly total  = computed(() => this.stats()?.totalCandidats ?? 0);
  private readonly delay  = computed(() => this.stats()?.delaiMoyenJours ?? null);
  private readonly urgent = computed(() => this.stats()?.urgents ?? 0);

  protected readonly totalValue = computed(() => this.total().toLocaleString('fr-FR'));

  protected readonly delayValue = computed(() => {
    this.translate.currentLang();
    const d = this.delay();
    return d != null ? this.translate.instant('PIPELINE.DAYS', { count: d }) : '—';
  });

  protected readonly urgentValue = computed(() => {
    this.translate.currentLang();
    return this.translate.instant('PIPELINE.URGENT_OPEN', { count: this.urgent() });
  });

  protected readonly totalDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const s = this.stats();
    if (!s) return null;
    const rate = s.totalCandidats > 0 ? Math.round((s.recrutementsClos / s.totalCandidats) * 100) : 0;
    return {
      value: this.translate.instant('PIPELINE.DELTA.CLOSURE_RATE', { pct: rate }),
      direction: rate >= 50 ? 'up' : rate >= 30 ? 'neutral' : 'down',
    };
  });

  protected readonly delayDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const d = this.delay();
    if (d == null) return null;
    return d > 30 ? { value: this.translate.instant('PIPELINE.DELTA.DELAY_OVER'), direction: 'down' }
         : d > 15 ? { value: this.translate.instant('PIPELINE.DELTA.DELAY_OK'),   direction: 'neutral' }
                  : { value: this.translate.instant('PIPELINE.DELTA.DELAY_GOOD'), direction: 'up' };
  });

  protected readonly urgentDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const urgent = this.urgent();
    if (urgent === 0) return null;
    return { value: this.translate.instant('PIPELINE.DELTA.URGENT', { count: urgent }), direction: 'down' };
  });
}
