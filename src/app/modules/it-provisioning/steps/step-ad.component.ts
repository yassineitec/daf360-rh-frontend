import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CheckboxComponent, SelectComponent, SelectOption } from '@khalilrebhiitec/daf360';

/** Step 5 — the Active Directory account and its profile type. */
@Component({
  selector: 'rh-step-ad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent, SelectComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <daf-checkbox
      [checked]="accountCreated()"
      [options]="{ label: ('IT_PROVISIONING.form.adAccountCreated' | translate) }"
      (checkedChange)="accountCreatedChange.emit($event)" />

    <div class="mt-3.5">
      <!-- profileTypeOptions is a computed on the page, not an inline .map() in
           the template: mapping here rebuilt the array on every CD cycle. -->
      <daf-select
        [selected]="profileType() ? [profileType()] : []"
        [options]="profileTypeOptions()"
        [config]="{ label: ('IT_PROVISIONING.form.adProfileType' | translate), required: true, fullWidth: true }"
        (selectedChange)="profileTypeChange.emit($event[0] || '')" />
    </div>
  `,
})
export class StepAdComponent {
  readonly accountCreated      = input(false);
  readonly profileType         = input('');
  readonly profileTypeOptions  = input<SelectOption[]>([]);

  readonly accountCreatedChange = output<boolean>();
  readonly profileTypeChange    = output<string>();
}
