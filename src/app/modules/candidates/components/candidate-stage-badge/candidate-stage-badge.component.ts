import { Component, Input } from '@angular/core';

interface StageConfig {
  label: string;
  dotColor: string;
  bgColor: string;
  textColor: string;
}

const STAGE_CONFIG: Record<string, StageConfig> = {
  'Candidature':          { label: 'Candidature',          dotColor: '#9ca3af', bgColor: '#f3f4f6', textColor: '#374151' },
  'Screening RH':         { label: 'Screening RH',         dotColor: '#f97316', bgColor: '#fff7ed', textColor: '#c2410c' },
  'Entretien Technique':  { label: 'Entretien Technique',  dotColor: '#3b82f6', bgColor: '#eff6ff', textColor: '#1d4ed8' },
  'Offre Envoyée':        { label: 'Offre Envoyée',        dotColor: '#14b8a6', bgColor: '#f0fdfa', textColor: '#0f766e' },
  'Recruté':              { label: 'Recruté',              dotColor: '#22c55e', bgColor: '#f0fdf4', textColor: '#15803d' },
  'Rejeté':               { label: 'Rejeté',              dotColor: '#ef4444', bgColor: '#fef2f2', textColor: '#dc2626' },
};

@Component({
  selector: 'rh-candidate-stage-badge',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold"
      [style.background-color]="cfg.bgColor"
      [style.color]="cfg.textColor"
    >
      <span class="w-1.5 h-1.5 rounded-full" [style.background-color]="cfg.dotColor"></span>
      {{ cfg.label || stage }}
    </span>
  `,
})
export class CandidateStageBadgeComponent {
  @Input() stage = '';

  get cfg(): StageConfig {
    return STAGE_CONFIG[this.stage] ?? { label: this.stage, dotColor: '#9ca3af', bgColor: '#f3f4f6', textColor: '#374151' };
  }
}
