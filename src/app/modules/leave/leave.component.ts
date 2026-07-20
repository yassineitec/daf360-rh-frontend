import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
@Component({ selector: 'app-leave', standalone: true, imports: [TranslatePipe], template: `
  <div class="page-wrapper">
    <div class="page-header">
      <h1 class="page-title">{{ 'LEAVE.PAGE.TITLE' | translate }}</h1>
      <p class="page-subtitle">{{ 'LEAVE.PAGE.SUBTITLE' | translate }}</p>
    </div>
    <div class="page-body"><p class="placeholder-text">{{ 'LEAVE.PAGE.PLACEHOLDER' | translate }}</p></div>
  </div>`,
  styles: [`.page-wrapper{padding:24px}.page-header{margin-bottom:24px}.page-title{font-family:var(--font-display,'DM Serif Display',serif);font-size:22px;font-weight:400;color:var(--color-text,#1A1C1E);margin:0}.page-subtitle{font-size:13px;color:var(--color-text-muted,#6B7280);margin:4px 0 0}.placeholder-text{color:var(--color-text-muted,#6B7280);font-size:13px}`],
})
export class LeaveComponent {}
