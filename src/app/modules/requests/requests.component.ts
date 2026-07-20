import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
@Component({ selector: 'app-requests', standalone: true, imports: [TranslatePipe], template: `
  <div style="padding:24px">
    <h1 style="font-family:var(--font-display,'DM Serif Display',serif);font-size:22px;font-weight:400;margin:0 0 4px">{{ 'REQUESTS.HEADER.TITLE' | translate }}</h1>
    <p style="font-size:13px;color:var(--color-text-muted,#6B7280);margin:0 0 16px">{{ 'REQUESTS.HEADER.SUBTITLE' | translate }}</p>
    <p style="font-size:13px;color:var(--color-text-muted)">{{ 'REQUESTS.HEADER.PLACEHOLDER' | translate }}</p>
  </div>` })
export class RequestsComponent {}
