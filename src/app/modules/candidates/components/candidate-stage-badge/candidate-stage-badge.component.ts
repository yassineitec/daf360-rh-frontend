import { Component, Input } from '@angular/core';
import { BadgeVariant, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

const STAGE_VARIANT: Record<string, BadgeVariant> = {
  'Candidature':          'neutral',
  'Screening RH':         'warning',
  'Entretien Technique':  'info',
  'Offre Envoyée':        'teal',
  'Recruté':              'success',
  'Rejeté':               'danger',
};

@Component({
  selector: 'rh-candidate-stage-badge',
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    <daf-badge
      [label]="stage"
      [options]="{ variant: badgeVariant, size: 'sm', dot: true }"
    />
  `,
})
export class CandidateStageBadgeComponent {
  @Input() stage = '';

  get badgeVariant(): BadgeVariant {
    return STAGE_VARIANT[this.stage] ?? 'neutral';
  }
}
