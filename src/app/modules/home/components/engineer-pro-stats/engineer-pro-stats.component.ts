import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CardComponent, ProgressBarComponent } from '@khalilrebhiitec/daf360';

/**
 * Ingénieurs / Pros split of the in-service headcount — the sibling of the
 * Féminin / Masculin card in `rh-workforce-stats`, same two-halves design and the
 * same container-query breakpoints (see that component for why they key off the
 * card's width rather than the viewport's).
 *
 * The split itself is decided server-side from the profile's grade: see
 * `DashboardService.getIngenieurProCounts()`.
 */
@Component({
  selector: 'rh-engineer-pro-stats',
  standalone: true,
  host: { class: 'block h-full' },
  imports: [TranslatePipe, CardComponent, ProgressBarComponent],
  template: `
    <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl', fullHeight: true, hoverable: true }">
      <div class="ep-body">
        <p class="text-[11px] text-outline uppercase tracking-wider mb-2">
          {{ 'HOME.ENGINEER_PRO_STATS.LABEL' | translate }}
        </p>
        <p class="ep-total font-bold text-on-surface leading-snug">
          {{ total() }} {{ 'HOME.WORKFORCE_STATS.ACTIVE_EMPLOYEES' | translate }}
        </p>
        <div class="ep-split mt-6 items-center">
          <div class="ep-half flex items-center gap-3">
            <span class="ep-icon shrink-0 rounded-2xl flex items-center justify-center bg-teal/10 text-teal">
              <span class="material-symbols-outlined">engineering</span>
            </span>
            <div class="flex flex-col flex-1 min-w-0">
              <p class="text-[11px] text-outline font-bold uppercase">{{ 'HOME.ENGINEER_PRO_STATS.ENGINEER' | translate }}</p>
              <p class="text-[18px] font-bold text-teal">
                {{ ingenieurs() ?? '—' }}
                @if (pctIngenieurs() != null) {
                  <span class="text-[12px] font-medium text-outline">· {{ pctIngenieurs() }}%</span>
                }
              </p>
              <daf-progress-bar class="block w-full mt-1.5"
                [value]="pctIngenieurs() ?? 0"
                [options]="{ max: 100, size: 'sm', variant: 'teal', showPercent: false }" />
            </div>
          </div>
          <div class="ep-half ep-half--second flex items-center gap-3">
            <span class="ep-icon shrink-0 rounded-2xl flex items-center justify-center bg-teal/10 text-teal">
              <span class="material-symbols-outlined">work</span>
            </span>
            <div class="flex flex-col flex-1 min-w-0">
              <p class="text-[11px] text-outline font-bold uppercase">{{ 'HOME.ENGINEER_PRO_STATS.PRO' | translate }}</p>
              <p class="text-[18px] font-bold text-teal">
                {{ pros() ?? '—' }}
                @if (pctPros() != null) {
                  <span class="text-[12px] font-medium text-outline">· {{ pctPros() }}%</span>
                }
              </p>
              <daf-progress-bar class="block w-full mt-1.5"
                [value]="pctPros() ?? 0"
                [options]="{ max: 100, size: 'sm', variant: 'teal', showPercent: false }" />
            </div>
          </div>
        </div>
      </div>
    </daf-card>
  `,
  // Same breakpoints as rh-workforce-stats — narrow state is the default.
  styles: [`
    .ep-body { container-type: inline-size; }

    .ep-total { font-size: 18px; }
    .ep-icon  { width: 2.5rem; height: 2.5rem; }
    .ep-icon .material-symbols-outlined { font-size: 22px; }
    .ep-split { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
    .ep-half--second {
      padding-top: 0.75rem;
      border-top: 1px solid var(--color-outline-variant);
    }

    @container (min-width: 13rem) {
      .ep-total { font-size: 20px; }
    }

    @container (min-width: 15rem) {
      .ep-icon  { width: 3rem; height: 3rem; }
      .ep-icon .material-symbols-outlined { font-size: 26px; }
      .ep-split { grid-template-columns: 1fr 1fr; gap: 0; }
      .ep-half  { padding-right: 1rem; }
      .ep-half--second {
        padding-top: 0;
        border-top: 0;
        padding-left: 1rem;
        padding-right: 0;
        border-left: 1px solid var(--color-outline-variant);
      }
    }
  `],
})
export class EngineerProStatsComponent {
  readonly total         = input<number>(0);
  readonly pctIngenieurs = input<number | null | undefined>(undefined);
  readonly pctPros       = input<number | null | undefined>(undefined);
  readonly ingenieurs    = input<number | null | undefined>(undefined);
  readonly pros          = input<number | null | undefined>(undefined);
}
