import { Component } from '@angular/core';
@Component({ selector: 'app-lifecycle', standalone: true, template: `
  <div class="page-wrapper">
    <h1 class="page-title">Cycle de vie employé</h1>
    <p class="page-subtitle">Onboarding → Actif → Offboarding → Archivé</p>
    <p class="placeholder-text" style="margin-top:16px">Module Lifecycle — implémentation à venir.</p>
  </div>`,
  styles: [`.page-wrapper{padding:24px}.page-title{font-family:var(--font-display,'DM Serif Display',serif);font-size:22px;font-weight:400;color:var(--color-text,#1A1C1E);margin:0 0 4px}.page-subtitle{font-size:13px;color:var(--color-text-muted,#6B7280);margin:0}.placeholder-text{color:var(--color-text-muted);font-size:13px}`],
})
export class LifecycleComponent {}
