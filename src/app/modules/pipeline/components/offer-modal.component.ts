import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, FormFieldComponent, FormFieldOptions, MultiDatePickerComponent,
} from '@khalilrebhiitec/daf360';

import { ModalComponent } from '../../../shared/modal.component';
import { isoToDate, dateToIso } from '../../../shared/date-picker.utils';
import { CreateOfferRequest } from '../services/offer.service';
import { KanbanCandidate } from '../services/pipeline.service';

export type OfferMode = 'send' | 'renegotiate';

/**
 * Send / renegotiate an offer. Owns the **form only** — the page owns the
 * request, the in-flight flag and the error, so a retry after a 400 keeps the
 * values the user typed.
 *
 * `initial` seeds the form: on renegotiation the page fetches the current offer
 * and sets it, which reseeds here as soon as the response lands. Opening the
 * modal also reseeds, so a cancelled edit never leaks into the next candidate.
 */
@Component({
  selector: 'rh-offer-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ButtonComponent, FormFieldComponent, MultiDatePickerComponent, TranslatePipe],
  template: `
    <app-modal
      [title]="(mode() === 'renegotiate' ? 'PIPELINE.OFFER.RENEGOTIATE_TITLE' : 'PIPELINE.OFFER.SEND_TITLE') | translate"
      [visible]="visible()"
      [hasFooter]="true"
      (closed)="closed.emit()">

      @if (candidate(); as target) {
        <p class="text-[13px] text-outline mb-4">{{ target.fullName }} — {{ target.poste }}</p>
      }

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-on-surface">{{ 'PIPELINE.OFFER.ASKED_SALARY_NET' | translate }}</label>
          <daf-form-field [value]="form().askedSalary ?? null" [options]="salaryOpts"
                          (valueChange)="patch({ askedSalary: asNum($event) })" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-on-surface">{{ 'PIPELINE.OFFER.PROPOSED_SALARY_NET' | translate }}</label>
          <daf-form-field [value]="form().proposedSalary ?? null" [options]="salaryOpts"
                          (valueChange)="patch({ proposedSalary: asNum($event) })" />
        </div>
      </div>

      <!-- Salary simulator (future module) -->
      <div class="mt-2">
        <daf-button
          [options]="{ variant: 'ghost', label: ('PIPELINE.OFFER.SALARY_SIM' | translate), iconStart: 'calculate', size: 'sm', disabled: true }"
          [title]="'PIPELINE.OFFER.MODULE_SOON' | translate" />
        <span class="text-[11px] text-outline ml-1">{{ 'PIPELINE.OFFER.COMING_SOON' | translate }}</span>
      </div>

      <div class="flex flex-col gap-1 mt-3">
        <label class="text-xs font-medium text-on-surface">{{ 'PIPELINE.OFFER.NOTE' | translate }}</label>
        <daf-form-field [value]="form().salaryNote ?? null" [options]="noteOpts()"
                        (valueChange)="patch({ salaryNote: asStr($event) })" />
      </div>

      <div class="grid grid-cols-2 gap-3 mt-3">
        <daf-multi-date-picker
          [value]="hireDate()"
          [config]="{ label: ('PIPELINE.OFFER.EXPECTED_HIRE_DATE' | translate), placeholder: ('PIPELINE.OFFER.SELECT' | translate), selectionMode: 'single' }"
          (valueChange)="patch({ expectedHireDate: dateToIso($event) || null })" />
        <daf-multi-date-picker
          [value]="expiryDate()"
          [config]="{ label: ('PIPELINE.OFFER.EXPIRY' | translate), placeholder: ('PIPELINE.OFFER.SELECT' | translate), selectionMode: 'single' }"
          (valueChange)="patch({ expiryDate: dateToIso($event) || null })" />
      </div>

      @if (error()) {
        <p class="text-xs text-danger mt-3">{{ error() }}</p>
      }

      <div slot="footer">
        <daf-button
          [options]="{ variant: 'secondary', label: ('PIPELINE.OFFER.CANCEL' | translate) }"
          (onClick)="closed.emit()" />
        <daf-button
          [options]="{
            variant: 'primary',
            label: submitting()
              ? ('PIPELINE.OFFER.SENDING' | translate)
              : ((mode() === 'renegotiate' ? 'PIPELINE.OFFER.RENEGOTIATE' : 'PIPELINE.OFFER.SEND_OFFER') | translate),
            iconStart: 'send',
            disabled: submitting(),
            loading: submitting()
          }"
          (onClick)="submit.emit(form())" />
      </div>
    </app-modal>
  `,
})
export class OfferModalComponent {
  private translate = inject(TranslateService);

  readonly visible    = input(false);
  readonly candidate  = input<KanbanCandidate | null>(null);
  readonly mode       = input<OfferMode>('send');
  readonly submitting = input(false);
  readonly error      = input<string | null>(null);
  /** Seed values — the current offer when renegotiating, empty when sending. */
  readonly initial    = input<CreateOfferRequest | null>(null);

  readonly closed = output<void>();
  readonly submit = output<CreateOfferRequest>();

  protected readonly form = signal<CreateOfferRequest>({});

  constructor() {
    effect(() => {
      this.visible();                       // reseed every time the modal opens
      this.form.set({ ...(this.initial() ?? {}) });
    });
  }

  protected readonly salaryOpts: FormFieldOptions = { type: 'number', placeholder: '0', fullWidth: true };
  protected readonly noteOpts = computed<FormFieldOptions>(() => {
    this.translate.currentLang();
    return { type: 'text', placeholder: this.translate.instant('PIPELINE.OFFER.NOTE_PLACEHOLDER'), fullWidth: true };
  });

  protected readonly hireDate   = computed(() => isoToDate(this.form().expectedHireDate ?? null));
  protected readonly expiryDate = computed(() => isoToDate(this.form().expiryDate ?? null));

  protected patch(part: Partial<CreateOfferRequest>): void {
    this.form.update(f => ({ ...f, ...part }));
  }

  protected asNum(v: string | number | null): number | null {
    if (v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return isNaN(n) ? null : n;
  }

  protected asStr(v: string | number | null): string | null {
    return v === null || v === '' ? null : String(v);
  }

  protected readonly dateToIso = dateToIso;
}
