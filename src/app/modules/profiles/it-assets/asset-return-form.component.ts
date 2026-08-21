import {
  AfterViewInit, Component, TemplateRef, computed, inject, input, output, signal, viewChild,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  FormFieldComponent, ModalService, MultiDatePickerComponent, SelectComponent,
  type ModalRef, type SelectOption,
} from '@khalilrebhiitec/daf360';

import { dateToIso, isoToDate } from '../../../shared/date-picker.utils';
import { ItAssetService } from './it-asset.service';
import {
  AssetAssignmentStatus, ItAssetAssignmentDto, RETURN_CONDITIONS,
} from './it-asset.model';

/**
 * Closes one ledger line: the item came back, is lost, or is written off.
 *
 * All three end the possession — the difference is what is being said about the object,
 * and a write-off is an accounting event, so it is picked explicitly rather than inferred
 * from the condition.
 */
@Component({
  selector: 'rh-asset-return-form',
  standalone: true,
  imports: [FormFieldComponent, SelectComponent, MultiDatePickerComponent, TranslatePipe],
  template: `
    <ng-template #formTpl>
      <div class="flex flex-col gap-4">

        @if (error()) {
          <div class="rounded-lg bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">{{ error() }}</div>
        }

        <!-- Which object, spelled out: the modal is opened from a row and there is nothing
             else on screen once it covers the list. -->
        <div class="rounded-lg bg-surface-container-low px-3.5 py-2.5 text-[13px]">
          <span class="font-semibold text-on-surface">{{ label() }}</span>
          @if (assignment().serialNumber) {
            <span class="ml-1 font-mono text-on-surface-variant">{{ assignment().serialNumber }}</span>
          }
          <span class="ml-1 text-[11px] text-on-surface-variant">
            {{ 'PROFILES.IT_ASSETS.SINCE' | translate:{ date: fmtDate(assignment().assignedAt) } }}
          </span>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <daf-multi-date-picker
            [config]="{ label: ('PROFILES.IT_ASSETS.FORM.RETURNED_AT' | translate), selectionMode: 'single' }"
            [value]="toDate(returnedAt)" (valueChange)="returnedAt = fromDate($event)" />

          <daf-select [options]="statusOptions()"
            [config]="{ label: ('PROFILES.IT_ASSETS.FORM.OUTCOME' | translate) }"
            [selected]="[status]"
            (selectedChange)="onStatusChange($event)" />
        </div>

        <daf-select [options]="conditionOptions()"
          [config]="{ label: ('PROFILES.IT_ASSETS.FORM.CONDITION_ON_RETURN' | translate) }"
          [selected]="conditionOnReturn ? [conditionOnReturn] : []"
          (selectedChange)="onConditionChange($event)" />

        <daf-form-field
          [options]="{ label: ('PROFILES.IT_ASSETS.FORM.NOTES' | translate), type: 'textarea', rows: 2,
                       placeholder: ('PROFILES.IT_ASSETS.FORM.RETURN_NOTES_PH' | translate) }"
          [value]="notes" (valueChange)="notes = asText($event)" />
      </div>
    </ng-template>
  `,
})
export class AssetReturnFormComponent implements AfterViewInit {
  readonly assignment = input.required<ItAssetAssignmentDto>();

  readonly saved     = output<ItAssetAssignmentDto>();
  readonly cancelled = output<void>();

  private svc = inject(ItAssetService);
  private modalService = inject(ModalService);
  private translate = inject(TranslateService);

  formTpl = viewChild.required<TemplateRef<unknown>>('formTpl');

  returnedAt = '';
  conditionOnReturn = '';
  status: AssetAssignmentStatus = 'RETURNED';
  notes = '';

  readonly saving = signal(false);
  readonly error  = signal<string | null>(null);


  readonly label = computed(() => {
    const a = this.assignment();
    const en = this.translate.currentLang() === 'en';
    const type = (en ? a.assetTypeLabelEn : a.assetTypeLabelFr) ?? a.assetTypeCode ?? '';
    return a.brandModel ? `${type} — ${a.brandModel}` : type;
  });

  readonly conditionOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return RETURN_CONDITIONS.map(c => ({
      value: c,
      label: this.translate.instant('PROFILES.IT_ASSETS.CONDITION.' + c),
    }));
  });

  readonly statusOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    // ASSIGNED is deliberately absent: this form only ever closes a line.
    return (['RETURNED', 'LOST', 'WRITTEN_OFF'] as AssetAssignmentStatus[]).map(s => ({
      value: s,
      label: this.translate.instant('PROFILES.IT_ASSETS.STATUS.' + s),
    }));
  });

  ngAfterViewInit(): void {
    this.returnedAt = new Date().toISOString().slice(0, 10);

    this.modalService.open({
      title: this.translate.instant('PROFILES.IT_ASSETS.FORM.TITLE_RETURN'),
      body: this.formTpl(),
      closeOnBackdrop: false,
      buttons: [
        {
          label: this.translate.instant('PROFILES.COMMON.CANCEL'),
          variant: 'secondary',
          action: (ref) => { ref.close(); this.cancelled.emit(); },
        },
        {
          label: this.translate.instant('PROFILES.IT_ASSETS.FORM.CONFIRM_RETURN'),
          variant: 'primary',
          action: (ref) => this.submit(ref),
        },
      ],
    });
  }

  protected readonly toDate = isoToDate;
  protected readonly fromDate = dateToIso;

  protected fmtDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR');
  }

  protected asText(v: string | number | null): string {
    return v == null ? '' : String(v);
  }

  /**
   * Handlers rather than inline assignments: clearing a `daf-select` yields an empty array,
   * so `$event[0]` is `undefined` at runtime even though its type says `string`.
   */
  protected onStatusChange(values: string[]): void {
    this.status = (values[0] as AssetAssignmentStatus) || 'RETURNED';
  }

  protected onConditionChange(values: string[]): void {
    this.conditionOnReturn = values[0] || '';
  }

  private submit(ref: ModalRef): void {
    if (this.saving()) return;
    this.error.set(null);

    if (!this.returnedAt) {
      this.error.set(this.translate.instant('PROFILES.IT_ASSETS.FORM.ERR_RETURN_DATE')); return;
    }
    // Checked here as well as server-side (CK_it_asg_dates): the form can point at the
    // field, a 400 cannot.
    if (this.returnedAt < this.assignment().assignedAt) {
      this.error.set(this.translate.instant('PROFILES.IT_ASSETS.FORM.ERR_BEFORE_ASSIGN')); return;
    }

    this.saving.set(true);
    this.svc.returnAsset(this.assignment().id, {
      returnedAt: this.returnedAt,
      conditionOnReturn: this.conditionOnReturn || null,
      status: this.status,
      notes: this.notes.trim() || null,
    }).subscribe({
      next: (row) => {
        this.saving.set(false);
        ref.close();
        this.saved.emit(row);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message
          ?? this.translate.instant('PROFILES.IT_ASSETS.FORM.ERR_SAVE'));
      },
    });
  }
}
