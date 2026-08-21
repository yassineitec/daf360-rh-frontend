import {
  AfterViewInit, Component, TemplateRef, computed, inject, input, output, signal, viewChild,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  FormFieldComponent, ModalService, MultiDatePickerComponent, SelectComponent,
  type ModalRef, type SelectOption,
} from '@khalilrebhiitec/daf360';

import { dateToIso, isoToDate } from '../../../shared/date-picker.utils';
import { ProfileService } from '../profile.service';
import { DOCUMENT_TYPE_CODES, EmployeeDocument } from '../models/profile.model';

/**
 * Corrects a filed document: its type, its expiry, its note. Never its bytes — replacing a
 * file means uploading the new one and withdrawing the old, so the dossier keeps both facts.
 *
 * The expiry is the point of this form: `expiration_date` existed on the table from the
 * start and was never exposed, so an expiring CIN or titre de séjour could not be tracked.
 */
@Component({
  selector: 'rh-document-edit-form',
  standalone: true,
  imports: [FormFieldComponent, SelectComponent, MultiDatePickerComponent, TranslatePipe],
  template: `
    <ng-template #formTpl>
      <div class="flex flex-col gap-4">

        @if (error()) {
          <div class="rounded-lg bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">{{ error() }}</div>
        }

        <div class="rounded-lg bg-surface-container-low px-3.5 py-2.5 text-[13px]">
          <span class="font-semibold text-on-surface">{{ document().fileName ?? document().documentType }}</span>
          @if (document().fileSizeKb) {
            <span class="ml-1 text-[11px] text-on-surface-variant">
              {{ 'PROFILES.DOCUMENTS.SIZE_KB' | translate:{ size: document().fileSizeKb } }}
            </span>
          }
        </div>

        <daf-select [options]="typeOptions()"
          [config]="{ label: ('PROFILES.DOCUMENTS.TYPE_LABEL' | translate), searchable: true }"
          [selected]="[documentType]"
          (selectedChange)="onTypeChange($event)" />

        <div>
          <daf-multi-date-picker
            [config]="{ label: ('PROFILES.DOCUMENTS.EXPIRATION' | translate), selectionMode: 'single' }"
            [value]="toDate(expirationDate)" (valueChange)="expirationDate = fromDate($event)" />
          <p class="mt-1 text-[11px] text-outline">{{ 'PROFILES.DOCUMENTS.EXPIRATION_HINT' | translate }}</p>
        </div>

        <daf-form-field
          [options]="{ label: ('PROFILES.DOCUMENTS.NOTES' | translate), type: 'textarea', rows: 2 }"
          [value]="notes" (valueChange)="notes = asText($event)" />
      </div>
    </ng-template>
  `,
})
export class DocumentEditFormComponent implements AfterViewInit {
  readonly profileId = input.required<number>();
  readonly document  = input.required<EmployeeDocument>();

  readonly saved     = output<EmployeeDocument>();
  readonly cancelled = output<void>();

  private svc = inject(ProfileService);
  private modalService = inject(ModalService);
  private translate = inject(TranslateService);

  formTpl = viewChild.required<TemplateRef<unknown>>('formTpl');

  documentType = 'OTHER';
  expirationDate = '';
  notes = '';

  readonly saving = signal(false);
  readonly error  = signal<string | null>(null);

  readonly typeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return DOCUMENT_TYPE_CODES.map(code => ({
      value: code,
      label: this.translate.instant('PROFILES.DOC_TYPES.' + code),
    }));
  });

  ngAfterViewInit(): void {
    const d = this.document();
    this.documentType   = d.documentType;
    this.expirationDate = d.expirationDate ?? '';
    this.notes          = d.notes ?? '';

    this.modalService.open({
      title: this.translate.instant('PROFILES.DOCUMENTS.EDIT_TITLE'),
      body: this.formTpl(),
      closeOnBackdrop: false,
      buttons: [
        {
          label: this.translate.instant('PROFILES.COMMON.CANCEL'),
          variant: 'secondary',
          action: (ref) => { ref.close(); this.cancelled.emit(); },
        },
        {
          label: this.translate.instant('PROFILES.EDIT.SAVE'),
          variant: 'primary',
          action: (ref) => this.submit(ref),
        },
      ],
    });
  }

  protected readonly toDate = isoToDate;
  protected readonly fromDate = dateToIso;

  protected asText(v: string | number | null): string {
    return v == null ? '' : String(v);
  }

  protected onTypeChange(values: string[]): void {
    if (values[0]) this.documentType = values[0];
  }

  private submit(ref: ModalRef): void {
    if (this.saving()) return;
    this.error.set(null);
    this.saving.set(true);

    const had = !!this.document().expirationDate;
    this.svc.updateDocument(this.profileId(), this.document().id, {
      documentType: this.documentType,
      expirationDate: this.expirationDate || null,
      // A null date means "leave alone" on the backend PATCH, so emptying the field has to
      // say so explicitly — and only when there was a date to clear.
      clearExpirationDate: had && !this.expirationDate,
      notes: this.notes.trim(),
    }).subscribe({
      next: (doc) => {
        this.saving.set(false);
        ref.close();
        this.saved.emit(doc);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message
          ?? this.translate.instant('PROFILES.DOCUMENTS.ERR_SAVE'));
      },
    });
  }
}
