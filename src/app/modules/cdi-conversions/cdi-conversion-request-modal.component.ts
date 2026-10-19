import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, FormFieldComponent, MultiDatePickerComponent,
} from '@khalilrebhiitec/daf360';

import { ModalComponent } from '../../shared/modal.component';
import { dateToIso, isoToDate } from '../../shared/date-picker.utils';
import { localeDate, localeOf } from '../missions/mission-display';
import { SubmitCdiConversionPayload } from './cdi-conversion.model';

/**
 * Files a CIVP → CDI request from the profile's contract card. Three answers, all required
 * by the backend: when the CDI should start, the net salary proposed, and why — the
 * validator decides on the technical side (the managers' feedback) and the salary side.
 */
@Component({
  selector: 'rh-cdi-conversion-request-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ButtonComponent, FormFieldComponent, MultiDatePickerComponent, TranslatePipe],
  template: `
    <app-modal
      [title]="'CDI_CONVERSION.REQUEST.TITLE' | translate"
      [visible]="visible()"
      [hasFooter]="true"
      (closed)="closed.emit()">

      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-1 rounded-xl bg-surface-container-low px-4 py-3">
          <span class="text-label-caps text-outline">{{ 'CDI_CONVERSION.REQUEST.CONTRACT' | translate }}</span>
          <span class="text-body-md font-semibold text-on-surface">{{ employeeName() }}</span>
          <span class="text-body-sm text-on-surface-variant">
            CIVP · {{ localeDate(contractStart()) }}
            @if (contractEnd()) { → {{ localeDate(contractEnd()) }} }
          </span>
        </div>

        <p class="m-0 text-body-sm text-on-surface-variant">{{ 'CDI_CONVERSION.REQUEST.HELP' | translate }}</p>

        @if (error()) {
          <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            <span class="material-symbols-outlined text-[18px]">error</span>
            {{ error() }}
          </div>
        }

        <daf-multi-date-picker
          [config]="{ label: ('CDI_CONVERSION.FIELDS.START_DATE' | translate), selectionMode: 'single', required: true }"
          [value]="toDate(startDate())"
          (valueChange)="startDate.set(fromDate($event) || '')" />

        <daf-form-field
          [value]="salary()"
          [options]="{
            type: 'number', required: true, align: 'end', fullWidth: true,
            label: ('CDI_CONVERSION.FIELDS.PROPOSED_SALARY' | translate),
            hint: ('CDI_CONVERSION.FIELDS.SALARY_HINT' | translate)
          }"
          (valueChange)="onSalary($event)" />

        <daf-form-field
          [value]="justification()"
          [options]="{
            type: 'textarea', rows: 4, required: true, fullWidth: true, maxLength: 2000,
            label: ('CDI_CONVERSION.FIELDS.JUSTIFICATION' | translate),
            placeholder: ('CDI_CONVERSION.FIELDS.JUSTIFICATION_PH' | translate)
          }"
          (valueChange)="onJustification($event)" />
      </div>

      <div slot="footer">
        <daf-button
          [options]="{ variant: 'secondary', label: ('CDI_CONVERSION.ACTIONS.CANCEL' | translate) }"
          (onClick)="closed.emit()" />
        <daf-button
          [options]="{
            variant: 'primary', iconStart: 'send',
            label: ('CDI_CONVERSION.REQUEST.SUBMIT' | translate),
            loading: submitting(), disabled: submitting() || !canSubmit()
          }"
          (onClick)="emit()" />
      </div>
    </app-modal>
  `,
})
export class CdiConversionRequestModalComponent {
  private translate = inject(TranslateService);

  readonly visible       = input(false);
  readonly employeeName  = input<string | null>(null);
  readonly contractStart = input<string | null>(null);
  readonly contractEnd   = input<string | null>(null);
  readonly submitting    = input(false);
  readonly error         = input<string | null>(null);

  readonly closed = output<void>();
  readonly submit = output<SubmitCdiConversionPayload>();

  protected readonly startDate     = signal('');
  protected readonly salary        = signal<number | null>(null);
  protected readonly justification = signal('');

  constructor() {
    // Cleared on every open: a draft typed for one contract must never land on another.
    effect(() => {
      if (!this.visible()) return;
      this.startDate.set(this.contractEnd() ?? '');
      this.salary.set(null);
      this.justification.set('');
    });
  }

  private readonly locale = computed(() => localeOf(this.translate.currentLang()));
  protected readonly localeDate = (iso: string | null) => localeDate(iso, this.locale());
  protected readonly toDate = isoToDate;
  protected readonly fromDate = dateToIso;

  protected readonly canSubmit = computed(() =>
    !!this.startDate() && (this.salary() ?? 0) > 0 && !!this.justification().trim());

  protected onSalary(v: string | number | null): void {
    const n = v === null || v === '' ? null : Number(String(v).replace(',', '.'));
    this.salary.set(n === null || isNaN(n) ? null : n);
  }

  protected onJustification(v: string | number | null): void {
    this.justification.set(v == null ? '' : String(v));
  }

  protected emit(): void {
    if (!this.canSubmit()) return;
    this.submit.emit({
      requestedStartDate: this.startDate(),
      proposedNetSalary: this.salary()!,
      justification: this.justification().trim(),
    });
  }
}
