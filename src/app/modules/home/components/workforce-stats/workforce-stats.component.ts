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
      <div>
        <p class="text-[11px] text-outline uppercase tracking-wider mb-2">
          {{ 'HOME.WORKFORCE_STATS.LABEL' | translate }}
        </p>
        <p class="text-[20px] font-bold text-on-surface leading-snug">
          {{ totalActifs() }} {{ 'HOME.WORKFORCE_STATS.ACTIVE_EMPLOYEES' | translate }}
        </p>
        <div class="mt-6 flex gap-8">
          <div class="flex flex-col">
            <p class="text-[11px] text-outline font-bold uppercase">{{ 'HOME.WORKFORCE_STATS.FEMALE' | translate }}</p>
            <p class="text-[18px] font-bold text-teal">
              {{ pctFemmes() != null ? pctFemmes() + '%' : '—' }}
            </p>
          </div>
          <div class="flex flex-col">
            <p class="text-[11px] text-outline font-bold uppercase">{{ 'HOME.WORKFORCE_STATS.MALE' | translate }}</p>
            <p class="text-[18px] font-bold text-teal">
              {{ pctHommes() != null ? pctHommes() + '%' : '—' }}
            </p>
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
