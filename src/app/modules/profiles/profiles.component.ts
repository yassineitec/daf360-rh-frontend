import { Component } from '@angular/core';
import { SpinnerComponent } from '../../shared/spinner.component';

@Component({
  selector: 'app-profiles',
  standalone: true,
  imports: [SpinnerComponent],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <h1 class="page-title">Profils employés</h1>
        <p class="page-subtitle">Gestion des profils RH</p>
      </div>
      <div class="page-body">
        <p class="placeholder-text">Module Profils — implémentation à venir.</p>
      </div>
    </div>
  `,
  styles: [`
    .page-wrapper  { padding: 24px; }
    .page-header   { margin-bottom: 24px; }
    .page-title    { font-family: var(--font-display, 'DM Serif Display', serif); font-size: 22px; font-weight: 400; color: var(--color-text, #1A1C1E); margin: 0; }
    .page-subtitle { font-size: 13px; color: var(--color-text-muted, #6B7280); margin: 4px 0 0; }
    .placeholder-text { color: var(--color-text-muted, #6B7280); font-size: 13px; }
  `],
})
export class ProfilesComponent {}
