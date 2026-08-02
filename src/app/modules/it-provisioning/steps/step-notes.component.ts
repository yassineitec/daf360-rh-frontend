import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FormFieldComponent } from '@khalilrebhiitec/daf360';

import { PdfDownloadButtonComponent } from '../../../shared/pdf-download-button/pdf-download-button.component';

/**
 * Step 6 — general notes, and once the file is complete the discharge PDF.
 *
 * The PDF button only exists after completion because the document is generated
 * from the finalised record (`context: 'IT_COMPLETE'`).
 */
@Component({
  selector: 'rh-step-notes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldComponent, PdfDownloadButtonComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <daf-form-field
      [value]="notes()"
      [options]="{
        label: ('IT_PROVISIONING.form.generalNotes' | translate),
        type: 'textarea', rows: 4, fullWidth: true,
        placeholder: ('IT_PROVISIONING.form.generalNotesPlaceholder' | translate)
      }"
      (valueChange)="notesChange.emit($any($event) ?? '')" />

    @if (completed()) {
      <div class="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border
                  border-tertiary/25 bg-tertiary/5 px-5 py-4">
        <div class="flex flex-1 items-start gap-3">
          <span class="material-symbols-outlined text-teal">description</span>
          <div>
            <p class="text-[13px] font-bold text-on-surface">{{ 'IT_PROVISIONING.form.dischargeTitle' | translate }}</p>
            <p class="text-[12px] text-outline">{{ 'IT_PROVISIONING.form.dischargeSub' | translate }}</p>
          </div>
        </div>
        <app-pdf-download-button
          [label]="'IT_PROVISIONING.form.generateDischarge' | translate"
          endpoint="/api/hr/documents/decharge-responsabilite"
          [body]="{ candidateId: candidateId(), itProvisioningId: provisioningId(), context: 'IT_COMPLETE' }"
          [filename]="'decharge-responsabilite.pdf'"
          variant="outline" />
      </div>
    }
  `,
})
export class StepNotesComponent {
  readonly notes          = input('');
  readonly completed      = input(false);
  readonly candidateId    = input.required<number>();
  readonly provisioningId = input.required<number>();

  readonly notesChange = output<string>();
}
