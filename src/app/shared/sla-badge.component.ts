import { Component, computed, input } from '@angular/core';

type SlaState = 'on-time' | 'at-risk' | 'overdue';

@Component({
  selector: 'app-sla-badge',
  standalone: true,
  template: `
    <span class="sla-badge" [class]="'sla-badge--' + state()">
      <span class="dot"></span>
      {{ label() }}
    </span>
  `,
  styles: [`
    .sla-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 2px 9px; border-radius: 999px;
      font-size: 11px; font-weight: 600; letter-spacing: .4px;
      white-space: nowrap;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .sla-badge--on-time { color: #16A34A; background: #dcfce7; }
    .sla-badge--on-time .dot { background: #16A34A; }
    .sla-badge--at-risk  { color: #D97706; background: #fef3c7; }
    .sla-badge--at-risk  .dot { background: #D97706; }
    .sla-badge--overdue  { color: #DC2626; background: #fee2e2; }
    .sla-badge--overdue  .dot { background: #DC2626; }
  `],
})
export class SlaBadgeComponent {
  slaDays      = input.required<number>();
  submittedAt  = input.required<string>();  // ISO date string

  private elapsedDays = computed(() => {
    const ms = Date.now() - new Date(this.submittedAt()).getTime();
    return ms / 86_400_000;
  });

  private ratio = computed(() => this.elapsedDays() / this.slaDays());

  state = computed((): SlaState => {
    const r = this.ratio();
    if (r >= 1.5) return 'overdue';
    if (r >= 0.75) return 'at-risk';
    return 'on-time';
  });

  label = computed(() => {
    const elapsed = Math.round(this.elapsedDays());
    const sla     = this.slaDays();
    return `J+${elapsed} / J+${sla}`;
  });
}
