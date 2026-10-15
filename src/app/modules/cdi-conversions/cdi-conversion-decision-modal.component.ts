import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, FormFieldComponent, MultiDatePickerComponent,
} from '@khalilrebhiitec/daf360';

import { ModalComponent } from '../../shared/modal.component';
import { dateToIso, isoToDate } from '../../shared/date-picker.utils';
import { formatAmount, localeDate, localeOf } from '../missions/mission-display';
import { CdiConversion, CdiDecisionAction, CdiDecisionPayload } from './cdi-conversion.model';

/**
 * One modal for the three decisions, mirroring the backend:
 *  - APPROVE — comment optional; the salary and start date can be adjusted (empty keeps the
 *    requester's proposal), which is what "validation salariale" means;
 *  - REJECT / ESCALATE — a comment is required (the reason, or what the arbiter must weigh).
 */
@Component({
  selector: 'rh-cdi-conversion-decision-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ButtonComponent, FormFieldComponent, MultiDatePickerComponent, TranslatePipe],
  template: `
    <app-modal
      [title]="('CDI_CONVERSION.DECISION.TITLE_' + action()) | translate"
      [visible]="visible()"
      [hasFooter]="true"
      (closed)="closed.emit()">

      <div class="flex flex-col gap-5">
        @if (request(); as r) {
          <div class="flex flex-col gap-1 rounded-xl bg-surface-container-low px-4 py-3">
            <span class="text-label-caps text-outline">
              {{ r.employeeName }} · {{ 'CDI_CONVERSION.FIELDS.REQUESTED_BY' | translate }} {{ r.requestedByName }}
            </span>
            <span class="text-[22px] font-black leading-tight text-on-surface">
              {{ formatAmount(r.proposedNetSalary) }}
            </span>
            <span class="text-body-sm text-on-surface-variant">
              {{ 'CDI_CONVERSION.FIELDS.START_DATE' | translate }} : {{ localeDate(r.requestedStartDate) }}
            </span>
          </div>
        }

        @if (action() === 'ESCALATE') {
          <p class="m-0 text-body-sm text-on-surface-variant">{{ 'CDI_CONVERSION.DECISION.ESCALATE_HELP' | translate }}</p>
        }

        @if (error()) {
          <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            <span class="material-symbols-outlined text-[18px]">error</span>
            {{ error() }}
          </div>
        }

        @if (action() === 'APPROVE') {
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <daf-form-field
              [value]="salary()"
              [options]="{
                type: 'number', align: 'end', fullWidth: true,
                label: ('CDI_CONVERSION.FIELDS.VALIDATED_SALARY' | translate),
                hint: ('CDI_CONVERSION.DECISION.KEEP_PROPOSAL' | translate)
              }"
              (valueChange)="onSalary($event)" />
            <daf-multi-date-picker
              [config]="{ label: ('CDI_CONVERSION.FIELDS.VALIDATED_START' | translate), selectionMode: 'single' }"
              [value]="toDate(startDate())"
              (valueChange)="startDate.set(fromDate($event) || '')" />
          </div>
        }

        <daf-form-field
          [value]="comment()"
          [options]="{
            type: 'textarea', rows: 3, fullWidth: true, maxLength: 2000,
            required: action() !== 'APPROVE',
            label: ((action() === 'APPROVE' ? 'CDI_CONVERSION.FIELDS.COMMENT' : 'CDI_CONVERSION.FIELDS.REASON') | translate)
          }"
          (valueChange)="onComment($event)" />
      </div>

      <div slot="footer">
        <daf-button
          [options]="{ variant: 'secondary', label: ('CDI_CONVERSION.ACTIONS.CANCEL' | translate) }"
          (onClick)="closed.emit()" />
        <daf-button
          [options]="{
            variant: action() === 'APPROVE' ? 'teal' : action() === 'REJECT' ? 'danger' : 'primary',
            iconStart: action() === 'APPROVE' ? 'check_circle' : action() === 'REJECT' ? 'cancel' : 'trending_up',
            label: (('CDI_CONVERSION.DECISION.CONFIRM_' + action()) | translate),
            loading: submitting(), disabled: submitting() || !canSubmit()
          }"
          (onClick)="emit()" />
      </div>
    </app-modal>
  `,
})
export class CdiConversionDecisionModalComponent {
  private translate = inject(TranslateService);

  readonly visible    = input(false);
  readonly request    = input<CdiConversion | null>(null);
  readonly action     = input<CdiDecisionAction>('APPROVE');
  readonly submitting = input(false);
  readonly error      = input<string | null>(null);

  readonly closed = output<void>();
  readonly submit = output<CdiDecisionPayload>();

  protected readonly comment   = signal('');
  protected readonly salary    = signal<number | null>(null);
  protected readonly startDate = signal('');

  constructor() {
    // Pre-filled with the proposal on every open; nothing typed for one request carries over.
    effect(() => {
      if (!this.visible()) return;
      const r = this.request();
      this.comment.set('');
      this.salary.set(r?.proposedNetSalary ?? null);
      this.startDate.set(r?.requestedStartDate ?? '');
    });
  }

  private readonly locale = computed(() => localeOf(this.translate.currentLang()));
  protected readonly localeDate = (iso: string | null) => localeDate(iso, this.locale());
  protected readonly formatAmount = (v: number | null | undefined) => formatAmount(v, null, this.locale());
  protected readonly toDate = isoToDate;
  protected readonly fromDate = dateToIso;

  protected readonly canSubmit = computed(() =>
    this.action() === 'APPROVE'
      ? (this.salary() === null || this.salary()! > 0)
      : !!this.comment().trim());

  protected onSalary(v: string | number | null): void {
    const n = v === null || v === '' ? null : Number(String(v).replace(',', '.'));
    this.salary.set(n === null || isNaN(n) ? null : n);
  }

  protected onComment(v: string | number | null): void {
    this.comment.set(v == null ? '' : String(v));
  }

  protected emit(): void {
    if (!this.canSubmit()) return;
    const approve = this.action() === 'APPROVE';
    this.submit.emit({
      action: this.action(),
      comment: this.comment().trim() || null,
      netSalary: approve ? this.salary() : null,
      startDate: approve ? (this.startDate() || null) : null,
    });
  }
}
