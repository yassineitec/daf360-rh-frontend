import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CardComponent, ProgressBarComponent } from '@khalilrebhiitec/daf360';

interface SeniorityBucket {
  key:      string;
  labelKey: string;
  rangeKey: string;
  icon:     string;
  count:    number | null | undefined;
  pct:      number | null | undefined;
}

/**
 * Junior / Confirmé / Senior split of the in-service headcount — the third sibling of
 * the Féminin/Masculin and Ing/Pro cards, same design but in THIRDS instead of halves.
 * Same container-query approach: the columns key off the card's own width, and the
 * stacked layout is the default (see `rh-workforce-stats` for the reasoning).
 *
 * Buckets are computed server-side from the hire date: see
 * `DashboardService.getSeniorityCounts()`.
 */
@Component({
  selector: 'rh-seniority-stats',
  standalone: true,
  host: { class: 'block h-full' },
  imports: [TranslatePipe, CardComponent, ProgressBarComponent],
  template: `
    <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl', fullHeight: true, hoverable: true }">
      <div class="sn-body">
        <p class="text-[11px] text-outline uppercase tracking-wider mb-2">
          {{ 'HOME.SENIORITY_STATS.LABEL' | translate }}
        </p>
        <p class="sn-total font-bold text-on-surface leading-snug">
          {{ total() }} {{ 'HOME.WORKFORCE_STATS.ACTIVE_EMPLOYEES' | translate }}
        </p>
        <div class="sn-split mt-6">
          @for (b of buckets(); track b.key) {
            <div class="sn-part flex items-center gap-3">
              <span class="sn-icon shrink-0 rounded-2xl flex items-center justify-center bg-teal/10 text-teal">
                <span class="material-symbols-outlined">{{ b.icon }}</span>
              </span>
              <div class="flex flex-col flex-1 min-w-0 w-full">
                <p class="text-[11px] text-outline font-bold uppercase truncate">{{ b.labelKey | translate }}</p>
                <p class="text-[18px] font-bold text-teal leading-tight">
                  {{ b.count ?? '—' }}
                  @if (b.pct != null) {
                    <span class="text-[12px] font-medium text-outline">· {{ b.pct }}%</span>
                  }
                </p>
                <daf-progress-bar class="block w-full mt-1.5"
                  [value]="b.pct ?? 0"
                  [options]="{ max: 100, size: 'sm', variant: 'teal', showPercent: false }" />
                <p class="text-[10.5px] text-outline truncate mt-1">{{ b.rangeKey | translate }}</p>
              </div>
            </div>
          }
        </div>
      </div>
    </daf-card>
  `,
  /*
   * Narrow default: the three buckets stacked with horizontal rules. From 20rem the
   * card is wide enough for three columns (~105px each: icon + "CONFIRMÉ" + "62.5%")
   * and the rules turn vertical, like the halves of the sibling cards.
   */
  styles: [`
    .sn-body { container-type: inline-size; }

    .sn-total { font-size: 18px; }
    .sn-icon  { width: 2.5rem; height: 2.5rem; }
    .sn-icon .material-symbols-outlined { font-size: 22px; }
    .sn-split { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
    .sn-part + .sn-part {
      padding-top: 0.75rem;
      border-top: 1px solid var(--color-outline-variant);
    }

    @container (min-width: 13rem) {
      .sn-total { font-size: 20px; }
    }

    @container (min-width: 20rem) {
      .sn-split { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; }
      .sn-part  { flex-direction: column; align-items: flex-start; padding-right: 0.75rem; }
      .sn-part + .sn-part {
        padding-top: 0;
        border-top: 0;
        padding-left: 0.75rem;
        border-left: 1px solid var(--color-outline-variant);
      }
      .sn-part:last-child { padding-right: 0; }
    }
  `],
})
export class SeniorityStatsComponent {
  readonly total        = input<number>(0);
  readonly pctJuniors   = input<number | null | undefined>(undefined);
  readonly pctConfirmes = input<number | null | undefined>(undefined);
  readonly pctSeniors   = input<number | null | undefined>(undefined);
  readonly juniors      = input<number | null | undefined>(undefined);
  readonly confirmes    = input<number | null | undefined>(undefined);
  readonly seniors      = input<number | null | undefined>(undefined);

  readonly buckets = computed<SeniorityBucket[]>(() => [
    { key: 'junior',   labelKey: 'HOME.SENIORITY_STATS.JUNIOR',   rangeKey: 'HOME.SENIORITY_STATS.JUNIOR_RANGE',   icon: 'school',            count: this.juniors(),   pct: this.pctJuniors() },
    { key: 'confirme', labelKey: 'HOME.SENIORITY_STATS.CONFIRME', rangeKey: 'HOME.SENIORITY_STATS.CONFIRME_RANGE', icon: 'trending_up',       count: this.confirmes(), pct: this.pctConfirmes() },
    { key: 'senior',   labelKey: 'HOME.SENIORITY_STATS.SENIOR',   rangeKey: 'HOME.SENIORITY_STATS.SENIOR_RANGE',   icon: 'workspace_premium', count: this.seniors(),   pct: this.pctSeniors() },
  ]);
}
