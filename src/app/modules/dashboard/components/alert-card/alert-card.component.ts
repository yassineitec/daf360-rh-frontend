import { Component, input } from '@angular/core';

export interface ProbationAlert {
  fullName:      string;
  joursRestants: number;
}

@Component({
  selector: 'rh-alert-card',
  standalone: true,
  host: { class: 'block h-full' },
  template: `
    <div class="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant shadow-sm h-full">

      <div class="flex items-center justify-between mb-4">
        <h3 class="text-[14px] font-bold text-on-surface">À surveiller</h3>
        <span class="material-symbols-outlined text-error text-[20px]">report</span>
      </div>

      <div class="space-y-3">

        <!-- Fin de période d'essai -->
        <div class="p-3 bg-error-container rounded-lg">
          <p class="text-[12px] font-bold text-on-error-container uppercase mb-2">
            Fin de période d'essai
          </p>
          @if (probationAlerts().length === 0) {
            <p class="text-[13px] text-on-error-container opacity-60">Aucune échéance proche.</p>
          }
          @for (alert of probationAlerts(); track alert.fullName) {
            <p class="text-[14px] text-on-error-container">
              {{ alert.fullName }} (J-{{ alert.joursRestants }})
            </p>
          }
        </div>

        <!-- Documents manquants -->
        <div class="p-3 bg-[#edeef0] rounded-lg">
          <p class="text-[12px] font-bold text-on-surface bg-danger mb-2">Documents manquants</p>
          <div class="flex items-center justify-between mb-2">
            <span class="text-[13px] text-on-surface">Sarah B. (RIB)</span>
            <span class="px-2 py-0.5 bg-danger text-blue-500 rounded text-[10px] font-bold">Urgent</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[13px] text-on-surface">Thomas D. (Attest.)</span>
            <span class="text-[12px] text-outline">Relance envoyée</span>
          </div>
        </div>

      </div>
    </div>
  `,
})
export class AlertCardComponent {
  readonly probationAlerts = input.required<ProbationAlert[]>();
}
