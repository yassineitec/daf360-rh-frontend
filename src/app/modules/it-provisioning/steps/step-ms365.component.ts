import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent, FormFieldComponent } from '@khalilrebhiitec/daf360';

import { ProvisioningDetail } from '../it-provisioning.model';

/**
 * Step 2 — the MS365 mailbox. Either it exists (read-only confirmation) or IT
 * types the address and submits it, which opens the confirmation modal the page owns.
 *
 * The invalid-address message is `daf-form-field`'s own `error` and nothing else:
 * the page used to render it a second time in a paragraph below the row.
 */
@Component({
  selector: 'rh-step-ms365',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlicePipe, FormFieldComponent, ButtonComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    @if (prov().ms365Email) {
      <div class="flex items-center gap-3.5 rounded-xl border border-success/30 bg-success/10 px-4 py-3.5">
        <span class="material-symbols-outlined text-success">check_circle</span>
        <div>
          <p class="text-[14px] font-bold text-on-surface">{{ prov().ms365Email }}</p>
          <p class="text-[12px] text-outline">
            {{ 'IT_PROVISIONING.form.submittedOn' | translate }}
            {{ prov().ms365EmailCreatedAt ? (prov().ms365EmailCreatedAt | slice:0:10) : '—' }}
          </p>
        </div>
      </div>
    } @else {
      <div class="flex items-end gap-3">
        <div class="flex flex-1 flex-col gap-1.5">
          <daf-form-field
            [value]="email()"
            [options]="{
              label: ('IT_PROVISIONING.form.emailFieldLabel' | translate),
              type: 'email',
              placeholder: ('IT_PROVISIONING.form.emailPlaceholder' | translate),
              required: true,
              fullWidth: true,
              disabled: submitting(),
              error: showError() ? ('IT_PROVISIONING.form.emailInvalid' | translate) : null
            }"
            (valueChange)="emailChange.emit($any($event) ?? '')" />
        </div>
        <daf-button
          [options]="{
            variant: 'teal', size: 'md',
            label: (submitting() ? 'IT_PROVISIONING.form.submitting' : 'IT_PROVISIONING.form.submitEmail') | translate,
            disabled: !valid() || submitting(),
            loading: submitting()
          }"
          (onClick)="submit.emit()" />
      </div>
    }
  `,
})
export class StepMs365Component {
  readonly prov       = input.required<ProvisioningDetail>();
  readonly email      = input('');
  readonly valid      = input(false);
  readonly submitting = input(false);

  readonly emailChange = output<string>();
  readonly submit      = output<void>();

  /** Don't shout at an empty field — only once something has been typed. */
  protected readonly showError = computed(() => !this.valid() && this.email().length > 0);
}
