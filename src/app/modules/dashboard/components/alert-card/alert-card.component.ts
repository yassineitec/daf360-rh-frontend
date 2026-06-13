import { Component, input } from '@angular/core';

export interface ProbationAlert {
  fullName:      string;
  joursRestants: number;
}

@Component({
  selector: 'rh-alert-card',
  standalone: true,
  template: `
    <div class="bg-white p-5 rounded-xl border border-outline-variant shadow-sm h-full">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-[14px] font-bold text-on-surface">À surveiller</h3>
        <span class="material-symbols-outlined text-red-500 text-[20px]">report</span>
      </div>

      <!-- Fin de période d'essai -->
      <div class="bg-red-50 rounded-lg p-3 mb-3">
        <p class="text-[12px] font-bold text-red-700 uppercase mb-2">Fin de période d'essai</p>
        @if (probationAlerts().length === 0) {
          <p class="text-[13px] text-red-400">Aucune échéance proche.</p>
        }
        @for (alert of probationAlerts(); track alert.fullName) {
          <p class="text-[14px] text-red-600">{{ alert.fullName }} (J-{{ alert.joursRestants }})</p>
        }
      </div>

      <!-- Documents manquants (placeholder) -->
      <div class="bg-surface-container rounded-lg p-3">
        <p class="text-[12px] font-bold text-on-surface mb-2">Documents manquants</p>
        <div class="flex items-center justify-between mb-2">
          <span class="text-[13px] text-on-surface">Sarah B. (RIB)</span>
          <span class="bg-red-500 text-white rounded text-[10px] font-bold px-2 py-0.5">Urgent</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[13px] text-on-surface">Thomas D. (Attest.)</span>
          <span class="text-outline text-[12px]">Relance envoyée</span>
        </div>
      </div>
    </div>
  `,
})
export class AlertCardComponent {
  readonly probationAlerts = input.required<ProbationAlert[]>();
}
