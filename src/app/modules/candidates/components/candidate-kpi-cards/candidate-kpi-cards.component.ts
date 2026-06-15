import { Component, Input } from '@angular/core';
import { PipelineStats } from '../../services/candidates.service';

@Component({
  selector: 'rh-candidate-kpi-cards',
  standalone: true,
  template: `
    <div class="grid grid-cols-4 gap-6">

      <!-- Total Candidats -->
      <div class="bg-surface rounded-2xl p-6 border border-outline-variant">
        <div class="flex justify-between items-start mb-4">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:#e0f2fe">
            <span class="material-symbols-outlined text-[20px]" style="color:#0369a1">group</span>
          </div>
          <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full" style="color:#15803d;background:#f0fdf4">
            +12%
          </span>
        </div>
        <p class="text-[28px] font-bold text-on-surface">{{ stats.totalCandidats }}</p>
        <p class="text-[13px] text-outline mt-1">Total Candidats</p>
      </div>

      <!-- En Entretien -->
      <div class="bg-surface rounded-2xl p-6 border border-outline-variant">
        <div class="flex justify-between items-start mb-4">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:#f3e8ff">
            <span class="material-symbols-outlined text-[20px]" style="color:#7c3aed">groups</span>
          </div>
          <div class="flex -space-x-2">
            @for (c of circles; track c.letter) {
              <div
                class="w-7 h-7 rounded-full border-2 border-surface flex items-center justify-center text-white text-[10px] font-bold"
                [style.background-color]="c.color"
              >{{ c.letter }}</div>
            }
          </div>
        </div>
        <p class="text-[28px] font-bold text-on-surface">{{ stats.enEntretien }}</p>
        <p class="text-[13px] text-outline mt-1">En Entretien</p>
      </div>

      <!-- Score Moyen -->
      <div class="bg-surface rounded-2xl p-6 border border-outline-variant">
        <div class="flex justify-between items-start mb-4">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:#fef3c7">
            <span class="material-symbols-outlined text-[20px]" style="color:#d97706">star</span>
          </div>
        </div>
        <p class="text-[28px] font-bold text-on-surface">{{ stats.scoreMoyen }}%</p>
        <p class="text-[13px] text-outline mt-1">Score Moyen</p>
        <div class="mt-3 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            [style.width.%]="stats.scoreMoyen"
            style="background:linear-gradient(90deg,#f97316,#eab308)"
          ></div>
        </div>
      </div>

      <!-- Recrutements Clos -->
      <div class="bg-surface rounded-2xl p-6 border border-outline-variant">
        <div class="flex justify-between items-start mb-4">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:#dcfce7">
            <span class="material-symbols-outlined text-[20px]" style="color:#16a34a">check_circle</span>
          </div>
        </div>
        <p class="text-[28px] font-bold text-on-surface">{{ stats.recrutementsClos }}</p>
        <p class="text-[13px] text-outline mt-1">Recrutements Clos</p>
      </div>

    </div>
  `,
})
export class CandidateKpiCardsComponent {
  @Input({ required: true }) stats!: PipelineStats;

  readonly circles = [
    { color: '#6366f1', letter: 'A' },
    { color: '#8b5cf6', letter: 'B' },
    { color: '#ec4899', letter: 'C' },
  ];
}
