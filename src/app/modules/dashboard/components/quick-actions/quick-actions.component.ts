import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface QuickAction {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="quick-actions-grid">
      @for (action of actions(); track action.route) {
        <a class="quick-action-btn" [routerLink]="action.route">
          <span class="qa-icon" [innerHTML]="action.icon"></span>
          <span class="qa-label">{{ action.label }}</span>
        </a>
      }
    </div>
  `,
  styles: [`
    .quick-actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 12px;
    }
    .quick-action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px 12px;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e5e7eb);
      border-radius: 10px;
      text-decoration: none;
      color: var(--color-text, #111827);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .quick-action-btn:hover {
      background: var(--color-surface-hover, #f9fafb);
      border-color: var(--color-primary, #6366f1);
    }
    .qa-icon { display: flex; align-items: center; justify-content: center; }
    .qa-icon svg { width: 22px; height: 22px; }
    .qa-label { text-align: center; line-height: 1.3; }
  `],
})
export class QuickActionsComponent {
  readonly actions = input.required<QuickAction[]>();
}
