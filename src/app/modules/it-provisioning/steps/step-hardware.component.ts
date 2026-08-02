import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  CheckboxComponent, DafCellDirective, DataTableComponent, FormFieldComponent,
  SelectComponent, SelectOption, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { ItAssetDto } from '../it-provisioning.model';

/** Hardware condition codes, in the order IT reads them. */
const HW_STATUSES = ['NEUF', 'BON_ETAT', 'USAGE', 'EN_REPARATION', 'DEFECTUEUX'];

/** One field edit, addressed by asset type rather than by row index. */
export interface AssetFieldChange {
  assetTypeCode: string;
  field: keyof ItAssetDto;
  value: unknown;
}

/**
 * Step 3 — the hardware handed over, one row per active `it_asset_types` entry.
 *
 * The table owns its own columns / rows / config here rather than on the page: it
 * is the only consumer, and the page keeps being the only *writer* — every edit
 * leaves as an output keyed by `assetTypeCode`, so no row index crosses the
 * boundary and a re-ordered catalog can't mis-address a write.
 *
 * The detail fields stay disabled until "Fourni" is ticked — that gate is why an
 * empty `it_asset_types` catalog reads as "I can't assign any material".
 */
@Component({
  selector: 'rh-step-hardware',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent, DafCellDirective, CheckboxComponent, FormFieldComponent,
    SelectComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <!-- No overflow-x-auto wrapper: daf-data-table already scrolls (§6b). -->
    <daf-data-table [columns]="columns()" [rows]="rows()" [config]="config()">

      <ng-template dafCell="provided" let-row>
        <daf-checkbox
          [checked]="row['provided']"
          (checkedChange)="providedChange.emit({ assetTypeCode: row['assetTypeCode'], provided: $event })" />
      </ng-template>

      <ng-template dafCell="serialNumber" let-row>
        <daf-form-field
          [value]="row['serialNumber'] ?? null"
          [options]="{ placeholder: 'SN-…', fullWidth: true, disabled: !row['provided'] }"
          (valueChange)="fieldChange.emit({ assetTypeCode: row['assetTypeCode'], field: 'serialNumber', value: $event })" />
      </ng-template>

      <ng-template dafCell="brandModel" let-row>
        <daf-form-field
          [value]="row['brandModel'] ?? null"
          [options]="{ placeholder: ('IT_PROVISIONING.form.assetCol.brandModel' | translate), fullWidth: true, disabled: !row['provided'] }"
          (valueChange)="fieldChange.emit({ assetTypeCode: row['assetTypeCode'], field: 'brandModel', value: $event })" />
      </ng-template>

      <ng-template dafCell="assetTag" let-row>
        <daf-form-field
          [value]="row['assetTag'] ?? null"
          [options]="{ placeholder: 'AT-…', fullWidth: true, disabled: !row['provided'] }"
          (valueChange)="fieldChange.emit({ assetTypeCode: row['assetTypeCode'], field: 'assetTag', value: $event })" />
      </ng-template>

      <ng-template dafCell="status" let-row>
        <daf-select
          [selected]="row['status'] ? [row['status']] : []"
          [options]="statusOptions()"
          [config]="{ placeholder: '—', fullWidth: true, disabled: !row['provided'] }"
          (selectedChange)="fieldChange.emit({ assetTypeCode: row['assetTypeCode'], field: 'status', value: $event[0] || '' })" />
      </ng-template>

    </daf-data-table>

    <div class="mt-3.5">
      <daf-form-field
        [value]="notes()"
        [options]="{
          label: ('IT_PROVISIONING.form.hardwareNotes' | translate),
          type: 'textarea', rows: 3, fullWidth: true,
          placeholder: ('IT_PROVISIONING.form.hardwareNotesPlaceholder' | translate)
        }"
        (valueChange)="notesChange.emit($any($event) ?? '')" />
    </div>
  `,
})
export class StepHardwareComponent {
  private translate = inject(TranslateService);

  readonly assets = input.required<ItAssetDto[]>();
  readonly notes  = input('');

  readonly providedChange = output<{ assetTypeCode: string; provided: boolean }>();
  readonly fieldChange    = output<AssetFieldChange>();
  readonly notesChange    = output<string>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'provided',         label: t('IT_PROVISIONING.form.assetCol.provided'), align: 'center', width: '60px' },
      { key: 'assetTypeLabelFr', label: t('IT_PROVISIONING.form.assetCol.material'), width: '160px' },
      { key: 'serialNumber',     label: t('IT_PROVISIONING.form.assetCol.serial') },
      { key: 'brandModel',       label: t('IT_PROVISIONING.form.assetCol.brandModel') },
      { key: 'assetTag',         label: t('IT_PROVISIONING.form.assetCol.assetTag') },
      { key: 'status',           label: t('IT_PROVISIONING.form.assetCol.status'), width: '160px' },
    ];
  });

  protected readonly rows = computed<TableRow[]>(() => this.assets().map(a => ({ ...a })));

  protected readonly config = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      // The step head above is this table's heading — without this the lib draws
      // its own empty title bar on top of the rows (§6b).
      showHeader:   false,
      hoverable:    false,
      emptyMessage: this.translate.instant('IT_PROVISIONING.form.assetEmpty'),
    };
  });

  protected readonly statusOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return HW_STATUSES.map(value => ({
      value,
      label: this.translate.instant('IT_PROVISIONING.form.hwStatus.' + value),
    }));
  });
}
