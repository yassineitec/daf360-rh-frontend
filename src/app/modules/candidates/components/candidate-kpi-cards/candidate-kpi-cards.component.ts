import { Component, Input } from '@angular/core';
import { MetricCardComponent } from '@khalilrebhiitec/daf360';
import { PipelineStats } from '../../services/candidates.service';

@Component({
  selector: 'rh-candidate-kpi-cards',
  standalone: true,
  imports: [MetricCardComponent],
  template: `
    <div class="grid grid-cols-4 gap-6">
      <daf-metric-card
        [value]="stats.totalCandidats"
        label="Total Candidats"
        [delta]="{ value: '+12%', direction: 'up' }"
        [options]="{ icon: 'group', iconBg: 'bg-primary/10', iconColor: 'text-primary' }"
      />
      <daf-metric-card
        [value]="stats.enEntretien"
        label="En Entretien"
        [options]="{ icon: 'groups', iconBg: 'bg-secondary/10', iconColor: 'text-secondary' }"
      />
      <daf-metric-card
        [value]="stats.scoreMoyen + '%'"
        label="Score Moyen"
        [options]="{ icon: 'star', iconBg: 'bg-teal/10', iconColor: 'text-teal' }"
      />
      <daf-metric-card
        [value]="stats.recrutementsClos"
        label="Recrutements Clos"
        [options]="{ icon: 'check_circle', iconBg: 'bg-tertiary/10', iconColor: 'text-tertiary' }"
      />
    </div>
  `,
})
export class CandidateKpiCardsComponent {
  @Input({ required: true }) stats!: PipelineStats;
}
