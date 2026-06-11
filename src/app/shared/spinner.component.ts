import { Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `
    <span
      class="spinner"
      [class.spinner--sm]="size() === 'sm'"
      [class.spinner--lg]="size() === 'lg'"
      role="status"
      aria-label="Chargement…"
    ></span>
  `,
  styles: [`
    .spinner {
      display: inline-block;
      width: 20px; height: 20px;
      border: 2px solid var(--color-border, #E0E7E9);
      border-top-color: var(--color-primary, #1C4E5C);
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    .spinner--sm { width: 14px; height: 14px; border-width: 2px; }
    .spinner--lg { width: 32px; height: 32px; border-width: 3px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class SpinnerComponent {
  size = input<'sm' | 'md' | 'lg'>('md');
}
