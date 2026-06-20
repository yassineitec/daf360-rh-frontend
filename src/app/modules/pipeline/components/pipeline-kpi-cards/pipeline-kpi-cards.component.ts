import { Component, input } from '@angular/core';
import { PipelineStats } from '../../services/pipeline.service';

@Component({
  selector: 'rh-pipeline-kpi-cards',
  standalone: true,
  imports: [],
  template: `
    <div class="grid grid-cols-3 gap-6">

      <!-- Total Candidats -->
      <div class="bg-white p-6 rounded-xl border border-outline-variant shadow-sm flex items-center gap-4">
        <div class="p-3 rounded-lg bg-surface-container-low text-primary">
          <span class="material-symbols-outlined text-3xl">group</span>
        </div>
        <div>
          <p class="text-outline text-sm">Total Candidats</p>
          <p class="text-headline-md font-bold">{{ stats().totalCandidats }}</p>
          <p class="text-secondary text-xs font-bold">+12% ce mois</p>
        </div>
      </div>

      <!-- Délai Recrutement -->
      <div class="bg-white p-6 rounded-xl border border-outline-variant shadow-sm flex items-center gap-4">
        <div class="p-3 rounded-lg bg-surface-container-low">
          <span class="material-symbols-outlined text-3xl" style="color:#79D7BE">timer</span>
        </div>
        <div>
          <p class="text-outline text-sm">Délai Recrutement Moy.</p>
          <p class="text-headline-md font-bold">{{ stats().delaiMoyenJours }} jours</p>
          <p class="text-primary text-xs font-bold">-2j vs Q3</p>
        </div>
      </div>

      <!-- Postes Urgents -->
      <div class="bg-white p-6 rounded-xl border border-outline-variant shadow-sm flex items-center gap-4">
        <div class="p-3 rounded-lg bg-error-container">
          <span class="material-symbols-outlined text-3xl text-error">priority_high</span>
        </div>
        <div>
          <p class="text-outline text-sm">Postes Urgents</p>
          <p class="text-headline-md font-bold">{{ (stats().urgents ?? stats().postesUrgents ?? 0) }} Ouverts</p>
          <p class="text-error text-xs font-bold">Action requise</p>
        </div>
      </div>

    </div>
  `,
})
export class PipelineKpiCardsComponent {
  stats = input.required<PipelineStats>();
}
