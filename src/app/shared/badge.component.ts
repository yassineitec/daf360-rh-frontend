import { Component, input } from '@angular/core';

type BadgeVariant = 'primary' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';

@Component({
  selector: 'app-badge',
  standalone: true,
  template: `<span class="badge" [class]="'badge badge--' + variant()">{{ text() }}</span>`,
  styles: [`
    .badge { display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: .4px; }
    .badge--primary { background: #1C4E5C1a; color: #1C4E5C; }
    .badge--neutral { background: #64748b1a; color: #64748b; }
    .badge--success { background: #16a34a1a; color: #16a34a; }
    .badge--warning { background: #d977061a; color: #d97706; }
    .badge--danger  { background: #dc26261a; color: #dc2626; }
    .badge--info    { background: #3b82f61a; color: #3b82f6; }
  `],
})
export class BadgeComponent {
  text    = input.required<string>();
  variant = input<BadgeVariant>('neutral');
}
