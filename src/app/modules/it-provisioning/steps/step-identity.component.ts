import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { statusBadge } from '../../../shared/status-badge.utils';
import { ProvisioningDetail } from '../it-provisioning.model';

/** Step 1 — the candidate's identity, read-only. Nothing to edit, nothing to emit. */
@Component({
  selector: 'rh-step-identity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusBadgeComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="flex flex-col gap-1">
        <span class="text-[11px] font-bold uppercase tracking-wide text-outline">{{ 'IT_PROVISIONING.form.fullName' | translate }}</span>
        <span class="text-[14px] text-on-surface">{{ prov().candidateFullName }}</span>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-[11px] font-bold uppercase tracking-wide text-outline">{{ 'IT_PROVISIONING.form.position' | translate }}</span>
        <span class="text-[14px] text-on-surface">{{ prov().appliedPosition ?? '—' }}</span>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-[11px] font-bold uppercase tracking-wide text-outline">{{ 'IT_PROVISIONING.form.expectedStart' | translate }}</span>
        <span class="text-[14px] text-on-surface">{{ prov().expectedStartDate ?? '—' }}</span>
      </div>
      <div class="flex flex-col items-start gap-1">
        <span class="text-[11px] font-bold uppercase tracking-wide text-outline">{{ 'IT_PROVISIONING.form.status' | translate }}</span>
        <daf-badge [label]="badge(prov().status).label" [options]="badge(prov().status).options" />
      </div>
    </div>
  `,
})
export class StepIdentityComponent {
  readonly prov = input.required<ProvisioningDetail>();
  protected readonly badge = statusBadge;
}
