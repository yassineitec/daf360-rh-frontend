import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'rh-workforce-stats',
  standalone: true,
  host: { class: 'block h-full' },
  imports: [TranslatePipe],
  template: `
    <div class="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant
                shadow-sm flex flex-col justify-between h-full">
      <div>
        <p class="text-[11px] text-outline uppercase tracking-wider mb-2">
          {{ 'DASHBOARD.WORKFORCE_STATS.LABEL' | translate }}
        </p>
        <p class="text-[20px] font-bold text-on-surface leading-snug">
          {{ totalActifs() }} {{ 'DASHBOARD.WORKFORCE_STATS.ACTIVE_EMPLOYEES' | translate }}
        </p>
        <div class="mt-6 flex gap-8">
          <div class="flex flex-col">
            <p class="text-[11px] text-outline font-bold uppercase">{{ 'DASHBOARD.WORKFORCE_STATS.FEMALE' | translate }}</p>
            <p class="text-[18px] font-bold text-teal">
              {{ pctFemmes() != null ? pctFemmes() + '%' : '—' }}
            </p>
          </div>
          <div class="flex flex-col">
            <p class="text-[11px] text-outline font-bold uppercase">{{ 'DASHBOARD.WORKFORCE_STATS.MALE' | translate }}</p>
            <p class="text-[18px] font-bold text-teal">
              {{ pctHommes() != null ? pctHommes() + '%' : '—' }}
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class WorkforceStatsComponent {
  readonly totalActifs = input.required<number>();
  readonly pctFemmes   = input<number | null | undefined>(undefined);
  readonly pctHommes   = input<number | null | undefined>(undefined);
}
