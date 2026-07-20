import {
  Component, OnChanges, SimpleChanges, computed, inject, input, signal,
} from '@angular/core';
import {
  ButtonComponent, FormFieldComponent, SelectComponent, SelectOption,
  StatusBadgeComponent, DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
  ModalService,
} from '@khalilrebhiitec/daf360';
import { BreakService } from './break.service';
import { BreakLegalRuleDto, CreateBreakLegalRuleRequest } from './break.model';
import { DafHasPermissionDirective } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-legal-rules-admin',
  standalone: true,
  imports: [
    ButtonComponent, FormFieldComponent, SelectComponent, DafHasPermissionDirective,
    StatusBadgeComponent, DataTableComponent, DafCellDirective, TranslatePipe,
  ],
  template: `
<div>
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
    <div>
      <h2 style="font-size:var(--text-headline-md);font-weight:700;color:var(--color-primary);margin:0;">{{ 'ADMIN.regimes.legal.title' | translate }}</h2>
      <p style="font-size:var(--text-body-sm);color:var(--color-on-surface-variant);margin:3px 0 0;">{{ 'ADMIN.regimes.legal.subtitle' | translate }}</p>
    </div>
    <daf-button *dafHasPermission="'ADMIN_BREAKS'"
      [label]="(showForm() ? 'ADMIN.regimes.common.cancel' : 'ADMIN.regimes.legal.newRule') | translate" variant="teal"
      [options]="{ iconStart: showForm() ? 'close' : 'add' }"
      (onClick)="showForm.set(!showForm())" />
  </div>

  <!-- Create form -->
  @if (showForm()) {
    <div style="background:var(--color-surface-container-low);border:1px solid var(--color-outline-variant);border-radius:14px;padding:20px;margin-bottom:20px;">
      <h3 style="font-size:var(--text-body-md);font-weight:700;color:var(--color-primary);margin:0 0 14px;text-transform:uppercase;letter-spacing:.4px;">{{ 'ADMIN.regimes.legal.formTitle' | translate }}</h3>
      @if (formError()) { <div style="background:var(--color-error-container);border-radius:8px;padding:10px;font-size:var(--text-body-sm);color:var(--color-on-error-container);margin-bottom:12px;">{{ formError() }}</div> }
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="grid-column:span 2">
          <daf-form-field
            [options]="{ label: ('ADMIN.regimes.legal.label' | translate), type: 'text', fullWidth: true }"
            [value]="formLabel"
            (valueChange)="formLabel = $any($event) ?? ''" />
        </div>
        <daf-form-field
          [options]="{ label: ('ADMIN.regimes.legal.minHours' | translate), type: 'number', fullWidth: true }"
          [value]="formMinHours"
          (valueChange)="formMinHours = Number($event) || 0" />
        <daf-form-field
          [options]="{ label: ('ADMIN.regimes.legal.maxHours' | translate), type: 'number', fullWidth: true }"
          [value]="formMaxHours"
          (valueChange)="formMaxHours = $event === '' || $event === null ? null : Number($event)" />
        <daf-form-field
          [options]="{ label: ('ADMIN.regimes.legal.deduction' | translate), type: 'number', fullWidth: true }"
          [value]="formDeductionMin"
          (valueChange)="formDeductionMin = Number($event) || 0" />
        <daf-select
          [selected]="[formDays]"
          [options]="daysOptions()"
          [config]="{ label: ('ADMIN.regimes.legal.applicableDays' | translate), fullWidth: true }"
          (selectedChange)="formDays = $event[0] ?? 'ALL'" />
        <daf-form-field
          [options]="{ label: ('ADMIN.regimes.legal.effFrom' | translate), type: 'date', fullWidth: true }"
          [value]="formEffFrom"
          (valueChange)="formEffFrom = $any($event)" />
        <daf-form-field
          [options]="{ label: ('ADMIN.regimes.legal.effTo' | translate), type: 'date', fullWidth: true }"
          [value]="formEffTo"
          (valueChange)="formEffTo = $any($event) ?? ''" />
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:14px;">
        <daf-button
          [label]="(isSaving() ? 'ADMIN.regimes.common.saving' : 'ADMIN.regimes.common.save') | translate" variant="teal"
          [options]="{ disabled: isSaving(), loading: isSaving() }"
          (onClick)="saveRule()" />
      </div>
    </div>
  }

  <!-- Rules table -->
  <daf-data-table [columns]="columns()" [rows]="rows()" [config]="tableConfig()">
    <ng-template dafCell="deductionMin" let-row>
      <daf-badge [label]="row['deductionMin'] + ' ' + ('ADMIN.regimes.common.minUnit' | translate)" [options]="{ variant: 'teal' }" />
    </ng-template>
    <ng-template dafCell="_actions" let-row>
      <daf-button *dafHasPermission="'ADMIN_BREAKS'"
        class="icon-btn-delete" [title]="'ADMIN.regimes.common.delete' | translate"
        label="" variant="danger"
        [options]="{ iconStart: 'delete', size: 'sm' }"
        (onClick)="removeRule(row['_source'].id)" />
    </ng-template>
  </daf-data-table>
</div>
  `,
})
export class LegalRulesAdminComponent implements OnChanges {
  private svc   = inject(BreakService);
  private modal = inject(ModalService);
  private translate = inject(TranslateService);

  readonly paysId = input<number>(179);

  rules     = signal<BreakLegalRuleDto[]>([]);
  isLoading = signal(true);
  showForm  = signal(false);
  isSaving  = signal(false);
  formError = signal<string | null>(null);

  readonly daysOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [
      { value: 'ALL', label: this.translate.instant('ADMIN.regimes.legal.daysOptions.ALL') },
      { value: 'WEEKDAYS', label: this.translate.instant('ADMIN.regimes.legal.daysOptions.WEEKDAYS') },
      { value: 'WEEKEND', label: this.translate.instant('ADMIN.regimes.legal.daysOptions.WEEKEND') },
    ];
  });

  readonly Number = Number;

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'labelFr', label: this.translate.instant('ADMIN.regimes.legal.columns.label') },
      { key: 'hours', label: this.translate.instant('ADMIN.regimes.legal.columns.minHours') },
      { key: 'deductionMin', label: this.translate.instant('ADMIN.regimes.legal.columns.deduction') },
      { key: 'appliesToDays', label: this.translate.instant('ADMIN.regimes.legal.columns.days') },
      { key: 'effective', label: this.translate.instant('ADMIN.regimes.legal.columns.effective') },
      { key: '_actions', label: this.translate.instant('ADMIN.regimes.common.action'), align: 'right' },
    ];
  });

  readonly rows = computed<TableRow[]>(() =>
    this.rules().map(rule => ({
      labelFr: rule.labelFr,
      hours: `${rule.minWorkHours}h${rule.maxWorkHours ? ' – ' + rule.maxWorkHours + 'h' : '+'}`,
      deductionMin: rule.deductionMin,
      appliesToDays: this.formatDays(rule.appliesToDays),
      effective: rule.effectiveFrom + (rule.effectiveTo ? ' → ' + rule.effectiveTo : ''),
      _source: rule,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      hoverable: true,
      loading: this.isLoading(),
      emptyMessage: this.translate.instant('ADMIN.regimes.legal.empty'),
    };
  });

  // Form fields
  formLabel = '';
  formMinHours = 0;
  formMaxHours: number | null = null;
  formDeductionMin = 0;
  formDays = 'ALL';
  formEffFrom = new Date().toISOString().split('T')[0];
  formEffTo = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['paysId']) this.loadRules();
  }

  loadRules(): void {
    this.isLoading.set(true);
    this.svc.getLegalRules(this.paysId()).subscribe({
      next: rs => { this.rules.set(rs); this.isLoading.set(false); },
      error: () => this.isLoading.set(false),
    });
  }

  saveRule(): void {
    if (!this.formLabel || !this.formMinHours || !this.formDeductionMin || !this.formEffFrom) {
      this.formError.set(this.translate.instant('ADMIN.regimes.legal.errorRequired'));
      return;
    }
    this.isSaving.set(true);
    this.formError.set(null);
    const req: CreateBreakLegalRuleRequest = {
      paysId: this.paysId(),
      labelFr: this.formLabel,
      minWorkHours: this.formMinHours,
      maxWorkHours: this.formMaxHours ?? undefined,
      deductionMin: this.formDeductionMin,
      appliesToDays: this.formDays,
      effectiveFrom: this.formEffFrom,
      effectiveTo: this.formEffTo || undefined,
    };
    this.svc.createLegalRule(req).subscribe({
      next: r => {
        this.rules.update(rs => [...rs, r]);
        this.showForm.set(false);
        this.isSaving.set(false);
        this.formLabel = ''; this.formMinHours = 0; this.formDeductionMin = 0;
      },
      error: err => {
        this.isSaving.set(false);
        this.formError.set(err?.error?.message ?? this.translate.instant('ADMIN.regimes.common.errorCreate'));
      },
    });
  }

  removeRule(id: number): void {
    this.modal.open({
      title: this.translate.instant('ADMIN.regimes.legal.deleteTitle'),
      body:  this.translate.instant('ADMIN.regimes.legal.deleteBody'),
      buttons: [
        { label: this.translate.instant('ADMIN.regimes.common.cancel'),   variant: 'secondary', action: r => r.close() },
        { label: this.translate.instant('ADMIN.regimes.common.delete'), variant: 'primary',   action: r => { this.doRemoveRule(id); r.close(); } },
      ],
    });
  }

  private doRemoveRule(id: number): void {
    this.svc.deleteLegalRule(id).subscribe({
      next: () => this.rules.update(rs => rs.filter(r => r.id !== id)),
      error: () => {},
    });
  }

  formatDays(d: string): string {
    const m: Record<string, string> = {
      ALL: this.translate.instant('ADMIN.regimes.legal.daysShort.ALL'),
      WEEKDAYS: this.translate.instant('ADMIN.regimes.legal.daysShort.WEEKDAYS'),
      WEEKEND: this.translate.instant('ADMIN.regimes.legal.daysShort.WEEKEND'),
    };
    return m[d] ?? d;
  }
}
