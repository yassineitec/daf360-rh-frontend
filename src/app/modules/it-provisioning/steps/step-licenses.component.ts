import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CheckboxComponent, FormFieldComponent } from '@khalilrebhiitec/daf360';

/** The five licences the provisioning record tracks, and their labels (product names). */
export interface LicenceFlags {
  office365: boolean;
  autocad:   boolean;
  revit:     boolean;
  autodesk:  boolean;
  kaspersky: boolean;
}

/** Step 4 — licence entitlements. Product names are brands, so they aren't translated. */
@Component({
  selector: 'rh-step-licenses',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent, FormFieldComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <daf-checkbox [checked]="licences().office365" [options]="{ label: 'Office 365' }"
                    (checkedChange)="licenceChange.emit({ key: 'office365', value: $event })" />
      <daf-checkbox [checked]="licences().autocad" [options]="{ label: 'AutoCAD' }"
                    (checkedChange)="licenceChange.emit({ key: 'autocad', value: $event })" />
      <daf-checkbox [checked]="licences().revit" [options]="{ label: 'Revit' }"
                    (checkedChange)="licenceChange.emit({ key: 'revit', value: $event })" />
      <daf-checkbox [checked]="licences().autodesk" [options]="{ label: 'Autodesk' }"
                    (checkedChange)="licenceChange.emit({ key: 'autodesk', value: $event })" />
      <daf-checkbox [checked]="licences().kaspersky" [options]="{ label: 'Kaspersky' }"
                    (checkedChange)="licenceChange.emit({ key: 'kaspersky', value: $event })" />
    </div>

    <div class="mt-3.5">
      <!-- Optional: this used to be flagged required although nothing enforces it. -->
      <daf-form-field
        [value]="other()"
        [options]="{
          label: ('IT_PROVISIONING.form.otherLicenses' | translate),
          placeholder: ('IT_PROVISIONING.form.otherLicensesPlaceholder' | translate),
          fullWidth: true
        }"
        (valueChange)="otherChange.emit($any($event) ?? '')" />
    </div>
  `,
})
export class StepLicensesComponent {
  readonly licences = input.required<LicenceFlags>();
  readonly other    = input('');

  readonly licenceChange = output<{ key: keyof LicenceFlags; value: boolean }>();
  readonly otherChange   = output<string>();
}
