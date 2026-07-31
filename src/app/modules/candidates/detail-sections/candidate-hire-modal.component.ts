import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  ButtonComponent, CheckboxComponent, FormFieldComponent, MultiDatePickerComponent,
} from '@khalilrebhiitec/daf360';

import { ModalComponent } from '../../../shared/modal.component';
import { dateToIso, isoToDate } from '../../../shared/date-picker.utils';
import { HireCandidateRequest } from '../candidate.model';

/**
 * Hire a candidate — turns the record into an employee profile.
 *
 * Owns the **form only**; the page owns the request, the in-flight flag and the
 * error, so a retry after a 400 keeps what the user typed. The form is reseeded
 * every time the modal opens, so a cancelled attempt never leaks into the next one.
 *
 * `contractTypeCode` is deliberately never sent — the backend derives it from the
 * candidate's `employmentTypeId` (`CandidateService#hireCandidate`).
 */
@Component({
  selector: 'rh-candidate-hire-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalComponent, ButtonComponent, CheckboxComponent, FormFieldComponent,
    MultiDatePickerComponent, TranslatePipe,
  ],
  template: `
    <app-modal
      [title]="'CANDIDATES.DETAIL.HIRE_MODAL_TITLE' | translate"
      [visible]="visible()"
      [hasFooter]="true"
      (closed)="closed.emit()">

      <p class="mb-5 text-sm text-outline">
        <strong class="text-on-surface">{{ candidateName() }}</strong>
        @if (contractLabel()) { — {{ contractLabel() }} }
      </p>

      @if (error()) {
        <div class="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{{ error() }}</div>
      }

      <div class="flex flex-col gap-4">
        <daf-multi-date-picker
          [value]="hireDate()"
          [config]="{
            label: ('CANDIDATES.DETAIL.HIRE_DATE' | translate),
            placeholder: ('CANDIDATES.COMMON.SELECT' | translate),
            required: true, selectionMode: 'single'
          }"
          (valueChange)="patch({ hireDate: dateToIso($event) })" />

        <!-- CDD / CIVP / STAGE / DETACHEMENT — the backend enforces this too. -->
        @if (requiresEndDate()) {
          <daf-multi-date-picker
            [value]="endDate()"
            [config]="{
              label: ('CANDIDATES.DETAIL.END_DATE' | translate),
              placeholder: ('CANDIDATES.COMMON.SELECT' | translate),
              required: true, selectionMode: 'single'
            }"
            (valueChange)="patch({ dateFinPrevue: dateToIso($event) || undefined })" />
        }

        <daf-checkbox
          [checked]="form().managerProfile"
          [options]="{ label: ('CANDIDATES.DETAIL.MANAGER_PROFILE' | translate) }"
          (checkedChange)="patch({ managerProfile: $event })" />

        <daf-form-field
          [value]="form().notes ?? null"
          [options]="{
            type: 'textarea', rows: 3, fullWidth: true,
            label: ('CANDIDATES.DETAIL.NOTES' | translate),
            placeholder: ('CANDIDATES.DETAIL.COMMENT_OPTIONAL' | translate)
          }"
          (valueChange)="patch({ notes: asText($event) })" />
      </div>

      <div slot="footer">
        <daf-button
          [options]="{ variant: 'secondary', label: ('CANDIDATES.COMMON.CANCEL' | translate) }"
          (onClick)="closed.emit()" />
        <daf-button
          [options]="{
            variant: 'teal', iconStart: 'how_to_reg',
            label: ('CANDIDATES.DETAIL.CONFIRM_HIRE' | translate),
            loading: submitting(), disabled: submitting()
          }"
          (onClick)="submit.emit(form())" />
      </div>
    </app-modal>
  `,
})
export class CandidateHireModalComponent {
  readonly visible        = input(false);
  readonly candidateName  = input('');
  readonly contractLabel  = input<string | null>(null);
  readonly requiresEndDate = input(false);
  readonly submitting     = input(false);
  readonly error          = input<string | null>(null);

  readonly closed = output<void>();
  readonly submit = output<HireCandidateRequest>();

  protected readonly form = signal<HireCandidateRequest>({
    hireDate: '', managerProfile: false, notes: null,
  });

  constructor() {
    // Reseed on every open, so a cancelled attempt can't carry over.
    effect(() => {
      this.visible();
      this.form.set({ hireDate: '', managerProfile: false, notes: null, dateFinPrevue: undefined });
    });
  }

  protected readonly dateToIso = dateToIso;

  protected hireDate(): Date | null { return isoToDate(this.form().hireDate || null); }
  protected endDate():  Date | null { return isoToDate(this.form().dateFinPrevue || null); }

  protected patch(part: Partial<HireCandidateRequest>): void {
    this.form.update(f => ({ ...f, ...part }));
  }

  protected asText(value: string | number | null): string | null {
    return value == null || value === '' ? null : String(value);
  }
}
