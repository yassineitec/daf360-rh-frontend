import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export interface ProbationAlert {
  fullName:      string;
  joursRestants: number;
}

@Component({
  selector: 'rh-alert-card',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="bg-white p-5 rounded-xl border border-outline-variant shadow-sm h-full">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-[14px] font-bold text-on-surface">{{ 'DASHBOARD.ALERT_CARD.TITLE' | translate }}</h3>
        <span class="material-symbols-outlined text-red-500 text-[20px]">report</span>
      </div>

      <!-- Fin de période d'essai -->
      <div class="bg-red-50 rounded-lg p-3 mb-3">
        <p class="text-[12px] font-bold text-red-700 uppercase mb-2">{{ 'DASHBOARD.ALERT_CARD.PROBATION_TITLE' | translate }}</p>
        @if (probationAlerts().length === 0) {
          <p class="text-[13px] text-red-400">{{ 'DASHBOARD.ALERT_CARD.PROBATION_EMPTY' | translate }}</p>
        }
        @for (alert of probationAlerts(); track alert.fullName) {
          <p class="text-[14px] text-red-600">
            {{ alert.fullName }} ({{ 'DASHBOARD.ALERT_CARD.PROBATION_DAYS' | translate:{ days: alert.joursRestants } }})
          </p>
        }
      </div>

      <!-- Documents manquants (placeholder) -->
      <div class="bg-surface-container rounded-lg p-3">
        <p class="text-[12px] font-bold text-on-surface mb-2">{{ 'DASHBOARD.ALERT_CARD.MISSING_DOCS_TITLE' | translate }}</p>
        <div class="flex items-center justify-between mb-2">
          <span class="text-[13px] text-on-surface">Sarah B. (RIB)</span>
          <span class="bg-error text-white rounded text-[10px] font-bold px-2 py-0.5">{{ 'DASHBOARD.ALERT_CARD.URGENT' | translate }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[13px] text-on-surface">Thomas D. (Attest.)</span>
          <span class="text-outline text-[12px]">{{ 'DASHBOARD.ALERT_CARD.REMINDER_SENT' | translate }}</span>
        </div>
      </div>
    </div>
  `,
})
export class AlertCardComponent {
  readonly probationAlerts = input.required<ProbationAlert[]>();
}
