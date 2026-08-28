import { Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CardComponent, ProgressBarComponent } from '@khalilrebhiitec/daf360';
import { CountryHeadcount } from '../../services/home.service';

interface CountryBar {
  key:   string;
  label: string;
  count: number;
}

@Component({
  selector: 'rh-workforce-stats',
  standalone: true,
  host: { class: 'block h-full' },
  imports: [TranslatePipe, CardComponent, ProgressBarComponent],
  template: `
    <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl', fullHeight: true, hoverable: true }">
      <!-- Container query, not viewport breakpoints. This card's width is a FRACTION of its
           row (a quarter at xl, a half at md), so it is at its NARROWEST on a wide screen —
           'lg:' / 'xl:' variants would fire exactly when the card gets smaller. It has to
           respond to its own box. Same lesson as the calendar legend's 'min-width: 1600px'
           rule, one component over.

           Written as real CSS in 'styles' rather than Tailwind's container-query variants
           because the breakpoints then live next to the reasoning that picked them, and the
           narrow state can be the DEFAULT rather than a min-width override. -->
      <div class="wf-body">
        <p class="text-[11px] text-outline uppercase tracking-wider mb-2">
          {{ 'HOME.WORKFORCE_STATS.LABEL' | translate }}
        </p>
        <!-- "101 Collaborateurs actifs" needs ~230px on one 20px line; below that the CSS
             drops it to 18px rather than letting it wrap mid-phrase, which reads as a broken
             layout instead of a deliberate one. -->
        <p class="wf-total font-bold text-on-surface leading-snug">
          {{ totalActifs() }} {{ 'HOME.WORKFORCE_STATS.ACTIVE_EMPLOYEES' | translate }}
        </p>
        <!-- Two even halves, each an illustration + its label/percentage. The vertical rule
             matches the card's other separators — but a vertical rule only means anything
             side by side, so when the halves stack it becomes a horizontal one. -->
        <div class="wf-split mt-6 items-center">
          <div class="wf-half flex items-center gap-3">
            <img src="/images/female.svg" alt="" class="wf-icon shrink-0" />
            <div class="flex flex-col min-w-0">
              <p class="text-[11px] text-outline font-bold uppercase">{{ 'HOME.WORKFORCE_STATS.FEMALE' | translate }}</p>
              <p class="text-[18px] font-bold text-teal">
                {{ pctFemmes() != null ? pctFemmes() + '%' : '—' }}
              </p>
            </div>
          </div>
          <div class="wf-half wf-half--second flex items-center gap-3">
            <img src="/images/male.svg" alt="" class="wf-icon shrink-0" />
            <div class="flex flex-col min-w-0">
              <p class="text-[11px] text-outline font-bold uppercase">{{ 'HOME.WORKFORCE_STATS.MALE' | translate }}</p>
              <p class="text-[18px] font-bold text-teal">
                {{ pctHommes() != null ? pctHommes() + '%' : '—' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Headcount per country — country name as text, no flags by design.
             Bars are sized against the sum of the rows so they always add up to
             100% of what's charted, even if totalActifs is counted differently. -->
        @if (countryBars().length) {
          <div class="mt-6 pt-4 border-t border-outline-variant">
            <p class="text-[11px] text-outline uppercase tracking-wider mb-3">
              {{ 'HOME.WORKFORCE_STATS.BY_COUNTRY' | translate }}
            </p>
            <div class="flex flex-col gap-2.5">
              @for (bar of countryBars(); track bar.key) {
                <daf-progress-bar
                  [label]="bar.label + ' · ' + bar.count"
                  [value]="bar.count"
                  [options]="{ max: chartTotal(), size: 'sm', variant: 'teal', showPercent: false }" />
              }
            </div>
          </div>
        }
      </div>
    </daf-card>
  `,
  /*
   * The card's own breakpoints. Everything here keys off the CARD's width, never the
   * viewport's — see the template comment for why that distinction is the whole point.
   *
   * 15rem is where the two halves stop fitting side by side: a 48px illustration + a 12px
   * uppercase label + an 18px percentage needs ~120px per half, and below 240px they start
   * clipping into each other. 13rem is where the headline phrase stops fitting on one line.
   */
  styles: [`
    .wf-body { container-type: inline-size; }

    /* Defaults are the NARROW state, so a browser without container-query support (or a
       zero-width container mid-layout) gets the stacked layout rather than a clipped one. */
    .wf-total { font-size: 18px; }
    .wf-icon  { width: 2.5rem; height: 2.5rem; }
    .wf-split { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
    .wf-half--second {
      padding-top: 0.75rem;
      border-top: 1px solid var(--color-outline-variant);
    }

    @container (min-width: 13rem) {
      .wf-total { font-size: 20px; }
    }

    @container (min-width: 15rem) {
      .wf-icon  { width: 3rem; height: 3rem; }
      .wf-split { grid-template-columns: 1fr 1fr; gap: 0; }
      .wf-half  { padding-right: 1rem; }
      .wf-half--second {
        padding-top: 0;
        border-top: 0;
        padding-left: 1rem;
        padding-right: 0;
        border-left: 1px solid var(--color-outline-variant);
      }
    }
  `],
})
export class WorkforceStatsComponent {
  private translate = inject(TranslateService);

  readonly totalActifs = input.required<number>();
  readonly pctFemmes   = input<number | null | undefined>(undefined);
  readonly pctHommes   = input<number | null | undefined>(undefined);
  readonly byCountry   = input<CountryHeadcount[]>([]);

  readonly countryBars = computed<CountryBar[]>(() =>
    this.byCountry().map((c, i) => ({
      key:   c.paysId != null ? String(c.paysId) : `unknown-${i}`,
      label: c.label ?? this.translate.instant('HOME.WORKFORCE_STATS.COUNTRY_UNKNOWN'),
      count: c.count,
    })),
  );

  readonly chartTotal = computed(() =>
    Math.max(1, this.countryBars().reduce((sum, c) => sum + c.count, 0)),
  );
}
