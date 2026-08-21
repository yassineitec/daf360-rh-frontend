import {
  AfterViewInit, Component, TemplateRef, computed, inject, input, output, signal, viewChild,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  FormFieldComponent, ModalService, MultiDatePickerComponent, SelectComponent,
  type ModalRef, type SelectOption,
} from '@khalilrebhiitec/daf360';

import { RefDataItem } from '../../../core/ref/ref-data.model';
import { dateToIso, isoToDate } from '../../../shared/date-picker.utils';
import { ItAssetService } from './it-asset.service';
import { ASSIGN_CONDITIONS, ItAssetAssignmentDto } from './it-asset.model';

/**
 * Hands a new item to the employee, or corrects a line already in the ledger
 * (`existing` set → PATCH instead of POST).
 *
 * The return is NOT here: closing a line has its own rules and its own form, so that
 * "j'ai rendu le PC" can never be typed into the assignment date by mistake.
 */
@Component({
  selector: 'rh-asset-assign-form',
  standalone: true,
  imports: [FormFieldComponent, SelectComponent, MultiDatePickerComponent, TranslatePipe],
  template: `
    <ng-template #formTpl>
      <div class="flex flex-col gap-4">

        @if (error()) {
          <div class="rounded-lg bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">{{ error() }}</div>
        }

        <div class="grid gap-4 sm:grid-cols-2">
          <daf-select [options]="typeOptions()"
            [config]="{ label: ('PROFILES.IT_ASSETS.FORM.TYPE' | translate), searchable: true }"
            [selected]="selectedType()"
            (selectedChange)="onTypeChange($event)" />

          <daf-multi-date-picker
            [config]="{ label: ('PROFILES.IT_ASSETS.FORM.ASSIGNED_AT' | translate), selectionMode: 'single' }"
            [value]="toDate(assignedAt)" (valueChange)="assignedAt = fromDate($event)" />
        </div>

        <daf-form-field
          [options]="{ label: ('PROFILES.IT_ASSETS.FORM.BRAND_MODEL' | translate),
                       placeholder: ('PROFILES.IT_ASSETS.FORM.BRAND_MODEL_PH' | translate) }"
          [value]="brandModel" (valueChange)="brandModel = asText($event)" />

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <daf-form-field
              [options]="{ label: ('PROFILES.IT_ASSETS.FORM.SERIAL' | translate),
                           placeholder: ('PROFILES.IT_ASSETS.FORM.SERIAL_PH' | translate) }"
              [value]="serialNumber" (valueChange)="serialNumber = asText($event)" />
            <!-- Says up front why a serial can be refused: the ledger enforces one active
                 holder per serial, and the 409 that follows names the current one. -->
            <p class="mt-1 text-[11px] text-outline">{{ 'PROFILES.IT_ASSETS.FORM.SERIAL_HINT' | translate }}</p>
          </div>

          <daf-form-field
            [options]="{ label: ('PROFILES.IT_ASSETS.FORM.TAG' | translate) }"
            [value]="assetTag" (valueChange)="assetTag = asText($event)" />
        </div>

        <daf-select [options]="conditionOptions()"
          [config]="{ label: ('PROFILES.IT_ASSETS.FORM.CONDITION' | translate) }"
          [selected]="[conditionOnAssign]"
          (selectedChange)="onConditionChange($event)" />

        <daf-form-field
          [options]="{ label: ('PROFILES.IT_ASSETS.FORM.NOTES' | translate), type: 'textarea', rows: 2 }"
          [value]="notes" (valueChange)="notes = asText($event)" />
      </div>
    </ng-template>
  `,
})
export class AssetAssignFormComponent implements AfterViewInit {
  readonly profileId  = input.required<number>();
  readonly assetTypes = input<RefDataItem[]>([]);
  /** Set → edit mode: same fields, PATCH on save. */
  readonly existing   = input<ItAssetAssignmentDto | null>(null);

  readonly saved     = output<ItAssetAssignmentDto>();
  readonly cancelled = output<void>();

  private svc = inject(ItAssetService);
  private modalService = inject(ModalService);
  private translate = inject(TranslateService);

  formTpl = viewChild.required<TemplateRef<unknown>>('formTpl');

  assetTypeId: number | null = null;
  assignedAt = '';
  serialNumber = '';
  brandModel = '';
  assetTag = '';
  conditionOnAssign = 'BON_ETAT';
  notes = '';

  readonly saving = signal(false);
  readonly error  = signal<string | null>(null);

  readonly typeOptions = computed<SelectOption[]>(() => {
    const en = this.translate.currentLang() === 'en';
    return this.assetTypes().map(t => ({
      value: String(t.id),
      label: (en ? t.labelEn : t.labelFr) || t.labelFr,
    }));
  });

  readonly conditionOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return ASSIGN_CONDITIONS.map(c => ({
      value: c,
      label: this.translate.instant('PROFILES.IT_ASSETS.CONDITION.' + c),
    }));
  });

  ngAfterViewInit(): void {
    const e = this.existing();
    if (e) {
      this.assetTypeId       = e.assetTypeId;
      this.assignedAt        = e.assignedAt;
      this.serialNumber      = e.serialNumber ?? '';
      this.brandModel        = e.brandModel ?? '';
      this.assetTag          = e.assetTag ?? '';
      this.conditionOnAssign = e.conditionOnAssign;
      this.notes             = e.notes ?? '';
    } else {
      this.assignedAt = new Date().toISOString().slice(0, 10);
    }

    // closeOnBackdrop off: this component's lifetime is driven by the page's signal, so a
    // silent backdrop dismiss would leave that signal pointing at a closed modal.
    this.modalService.open({
      title: this.translate.instant(e
        ? 'PROFILES.IT_ASSETS.FORM.TITLE_EDIT'
        : 'PROFILES.IT_ASSETS.FORM.TITLE_ASSIGN'),
      body: this.formTpl(),
      closeOnBackdrop: false,
      buttons: [
        {
          label: this.translate.instant('PROFILES.COMMON.CANCEL'),
          variant: 'secondary',
          action: (ref) => { ref.close(); this.cancelled.emit(); },
        },
        {
          label: this.translate.instant(e
            ? 'PROFILES.IT_ASSETS.FORM.SAVE'
            : 'PROFILES.IT_ASSETS.FORM.CONFIRM_ASSIGN'),
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

  /**
   * `daf-select` speaks `string[]`, the DTO speaks a numeric FK. Converted here rather than
   * in the template — a template expression cannot reach globals like `String`/`Number`.
   */
  protected selectedType(): string[] {
    return this.assetTypeId != null ? [String(this.assetTypeId)] : [];
  }

  protected onTypeChange(values: string[]): void {
    const raw = values[0];
    this.assetTypeId = raw ? Number(raw) : null;
  }

  /** Clearing the select would leave `undefined` at runtime despite the `string[]` type. */
  protected onConditionChange(values: string[]): void {
    this.conditionOnAssign = values[0] || 'BON_ETAT';
  }

  private submit(ref: ModalRef): void {
    if (this.saving()) return;
    this.error.set(null);

    const assetTypeId = this.assetTypeId;
    if (!assetTypeId) {
      this.error.set(this.translate.instant('PROFILES.IT_ASSETS.FORM.ERR_TYPE')); return;
    }
    if (!this.assignedAt) {
      this.error.set(this.translate.instant('PROFILES.IT_ASSETS.FORM.ERR_DATE')); return;
    }
    const e = this.existing();
    if (e?.returnedAt && this.assignedAt > e.returnedAt) {
      this.error.set(this.translate.instant('PROFILES.IT_ASSETS.FORM.ERR_AFTER_RETURN')); return;
    }

    const body = {
      assetTypeId,
      assignedAt: this.assignedAt,
      // '' rather than undefined so clearing a field on edit actually clears it: the PATCH
      // treats null as "leave alone" and the backend trims '' back to null.
      serialNumber: this.serialNumber.trim(),
      brandModel: this.brandModel.trim(),
      assetTag: this.assetTag.trim(),
      conditionOnAssign: this.conditionOnAssign,
      notes: this.notes.trim(),
    };

    this.saving.set(true);
    const call$ = e ? this.svc.update(e.id, body) : this.svc.assign(this.profileId(), body);
    call$.subscribe({
      next: (row) => {
        this.saving.set(false);
        ref.close();
        this.saved.emit(row);
      },
      error: (err) => {
        this.saving.set(false);
        // The 409 body names the employee currently holding the serial — far more useful
        // than a generic "échec de l'enregistrement".
        this.error.set(err?.error?.message
          ?? this.translate.instant('PROFILES.IT_ASSETS.FORM.ERR_SAVE'));
      },
    });
  }
}
