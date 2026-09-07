import {
  Component, TemplateRef, computed, inject, input, OnChanges, signal, viewChild,
} from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminService } from './admin.service';
import {
  CONTRACT_TYPES, OffboardingCatalogTask, Role, SaveCatalogTaskRequest,
} from './models/admin.model';
import {
  ButtonComponent, StatusBadgeComponent, FormFieldComponent, SelectComponent, SelectOption,
  ToggleComponent, ModalService, ModalRef,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

@Component({
  selector: 'app-offboarding-catalog-admin',
  standalone: true,
  imports: [
    ButtonComponent, StatusBadgeComponent,
    FormFieldComponent, SelectComponent, ToggleComponent,
    DataTableComponent, DafCellDirective, TranslatePipe,
  ],
  template: `
    <div class="cat-header">
      <div>
        <h3 class="section-title">{{ 'ADMIN.docs.offboarding.title' | translate }}</h3>
        <p class="section-sub">{{ 'ADMIN.docs.offboarding.subtitle' | translate }}</p>
      </div>
      <daf-button class="desktop-only" [label]="'ADMIN.docs.offboarding.addTask' | translate" variant="teal" [options]="{ iconStart: 'add' }" (onClick)="openAdd()" />
      <daf-button class="icon-btn-toggle mobile-only" [title]="'ADMIN.docs.offboarding.addTask' | translate" variant="teal" [options]="{ iconStart: 'add', size: 'sm' }" (onClick)="openAdd()" />
    </div>

    <!-- Validator role for this country (V66) — kept in this tab rather than in one of its
         own: it is offboarding configuration for the same pays the catalog below is scoped to,
         and a whole tab for a single select would be harder to find, not easier. -->
    <div class="validator-card">
      <div class="validator-head">
        <span class="material-symbols-outlined">verified_user</span>
        <div>
          <p class="validator-title">{{ 'ADMIN.docs.offboarding.validatorTitle' | translate }}</p>
          <p class="validator-sub">{{ 'ADMIN.docs.offboarding.validatorSubtitle' | translate }}</p>
        </div>
      </div>
      <div class="validator-row">
        <div class="validator-select">
          <daf-select
            [selected]="validatorSelected()"
            [options]="validatorOptions()"
            [config]="{ disabled: savingValidator() }"
            (selectedChange)="onValidatorChange($event)" />
        </div>
        <daf-button
          [label]="'ADMIN.docs.offboarding.validatorSave' | translate"
          variant="teal"
          [options]="{ size: 'sm', loading: savingValidator() }"
          (onClick)="saveValidator()" />
      </div>
      @if (validatorRoleId === null) {
        <p class="validator-hint">{{ 'ADMIN.docs.offboarding.validatorFallback' | translate }}</p>
      }
      @if (validatorError()) {
        <div class="error-banner">{{ validatorError() }}</div>
      }
    </div>

    <!-- Contract-type tabs, same convention as "Listes configurables": one window per
         type, shown one after another, instead of a dropdown filter + grouped view. -->
    <nav class="cat-tab-bar" role="tablist">
      @for (ct of CONTRACT_TYPES; track ct) {
        <button
          class="cat-tab-btn"
          [class.active]="filterContractType === ct"
          (click)="selectContractType(ct)"
          role="tab"
          type="button"
        >{{ contractTypeLabel(ct) }}</button>
      }
    </nav>

    <!-- Loading / empty state -->
    @if (loading()) {
      <div class="skeleton-wrap">
        @for (_ of [1,2,3,4,5]; track $index) { <div class="skeleton-row"></div> }
      </div>
    } @else if (rows().length === 0) {
      <div class="empty-state">
        <span class="material-symbols-outlined">list_alt</span>
        <p>{{ 'ADMIN.docs.offboarding.empty' | translate }} {{ 'ADMIN.docs.offboarding.emptyForContract' | translate }}.</p>
      </div>
    } @else {
      <!-- Real daf-data-table, same convention as the other admin catalog pages. -->
      <div class="table-scroll">
      <daf-data-table [columns]="columns()" [rows]="tableRows()" [config]="tableConfig()">
        <ng-template dafCell="taskCode" let-row>
          <code class="code-chip">{{ row['_source'].taskCode }}</code>
        </ng-template>

        <ng-template dafCell="flags" let-row>
          <div class="flags-cell">
            @if (row['_source'].isMandatory) {
              <daf-badge [label]="'ADMIN.docs.offboarding.mandatory' | translate" [options]="{ variant: 'warning', size: 'sm' }" />
            }
            @if (row['_source'].isBlocking) {
              <daf-badge [label]="'ADMIN.docs.offboarding.blocking' | translate" [options]="{ variant: 'danger', size: 'sm' }" />
            }
          </div>
        </ng-template>

        <ng-template dafCell="isActive" let-row>
          <daf-badge
            [label]="(row['_source'].isActive ? 'ADMIN.docs.offboarding.active' : 'ADMIN.docs.offboarding.inactive') | translate"
            [options]="{ variant: row['_source'].isActive ? 'success' : 'neutral', size: 'sm' }"
          />
        </ng-template>

      </daf-data-table>
      </div>
    }

    <!-- Add / Edit modal body — projected into the real daf-modal-host via ModalService,
         same convention as the other admin catalog pages, instead of a hand-rolled overlay. -->
    <ng-template #bodyTpl>
      <div class="form-grid">
        <daf-select
          [selected]="formContractTypeSelected()"
          [options]="contractTypeOptions()"
          [config]="{ label: ('ADMIN.docs.offboarding.contractTypeLabel' | translate), placeholder: ('ADMIN.docs.offboarding.selectPlaceholder' | translate), disabled: !!editingId(), fullWidth: true }"
          (selectedChange)="onFormContractTypeChange($event)" />

        <daf-form-field
          [options]="{ label: ('ADMIN.docs.offboarding.taskCodeLabel' | translate), placeholder: ('ADMIN.docs.offboarding.taskCodePlaceholder' | translate), disabled: !!editingId(), fullWidth: true }"
          [value]="form.taskCode"
          (valueChange)="form.taskCode = ($any($event) ?? '').toUpperCase()" />

        <div class="field-full">
          <daf-form-field
            [options]="{ label: ('ADMIN.docs.offboarding.taskLabelLabel' | translate), placeholder: ('ADMIN.docs.offboarding.taskLabelPlaceholder' | translate), fullWidth: true }"
            [value]="form.taskLabel"
            (valueChange)="form.taskLabel = $any($event) ?? ''" />
        </div>

        <daf-form-field
          [options]="{ label: ('ADMIN.docs.offboarding.ownerRoleLabel' | translate), placeholder: ('ADMIN.docs.offboarding.ownerRolePlaceholder' | translate), fullWidth: true }"
          [value]="form.ownerRole"
          (valueChange)="form.ownerRole = $any($event) ?? ''" />

        <daf-form-field
          [options]="{ label: ('ADMIN.docs.offboarding.slaLabel' | translate), type: 'number', fullWidth: true }"
          [value]="form.slaWorkingDays"
          (valueChange)="form.slaWorkingDays = $any($event) ?? 0" />

        <daf-form-field
          [options]="{ label: ('ADMIN.docs.offboarding.orderLabel' | translate), type: 'number', fullWidth: true }"
          [value]="form.orderIndex"
          (valueChange)="form.orderIndex = $any($event) ?? 0" />

        <div class="field-full toggles-row">
          <daf-toggle
            [options]="{ label: ('ADMIN.docs.offboarding.mandatory' | translate) }"
            [checked]="form.isMandatory"
            (checkedChange)="form.isMandatory = $event" />
          <daf-toggle
            [options]="{ label: ('ADMIN.docs.offboarding.blockingToggle' | translate) }"
            [checked]="form.isBlocking"
            (checkedChange)="form.isBlocking = $event" />
        </div>
      </div>

      @if (formError()) {
        <div class="error-banner">{{ formError() }}</div>
      }

      <div class="offboarding-modal-footer">
        <daf-button [label]="'ADMIN.docs.offboarding.cancel' | translate" variant="secondary" [options]="{ disabled: saving() }" (onClick)="cancel()" />
        <daf-button
          [label]="(editingId() ? 'ADMIN.docs.offboarding.save' : 'ADMIN.docs.offboarding.add') | translate"
          variant="teal"
          [options]="{ loading: saving(), disabled: !isFormValid() || saving() }"
          (onClick)="save()"
        />
      </div>
    </ng-template>
  `,
  styles: [`
    .cat-header    { display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;flex-wrap:wrap }
    .section-title { font-size:15px;font-weight:700;color:var(--color-text);margin:0 0 4px }
    .section-sub   { font-size:13px;color:var(--color-text-muted);margin:0 }
    .validator-card { border:1px solid var(--color-border);border-radius:10px;padding:14px;margin-bottom:18px;display:flex;flex-direction:column;gap:10px }
    .validator-head { display:flex;align-items:flex-start;gap:10px }
    .validator-head .material-symbols-outlined { font-size:20px;color:var(--color-primary) }
    .validator-title { font-size:13px;font-weight:700;color:var(--color-text);margin:0 }
    .validator-sub   { font-size:12px;color:var(--color-text-muted);margin:2px 0 0 }
    .validator-row   { display:flex;align-items:center;gap:10px;flex-wrap:wrap }
    .validator-select { min-width:240px;flex:0 1 320px }
    .validator-hint  { font-size:11px;font-style:italic;color:var(--color-text-muted);margin:0 }
    .skeleton-wrap { display:flex;flex-direction:column;gap:8px }
    .skeleton-row  { height:44px;background:var(--color-bg-secondary,#F5F7F9);border-radius:6px;animation:pulse 1.4s ease-in-out infinite }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }
    .empty-state   { display:flex;flex-direction:column;align-items:center;gap:8px;padding:48px;color:var(--color-text-muted);text-align:center }
    .empty-state .material-symbols-outlined { font-size:40px;opacity:.4 }
    .empty-state p { font-size:13px;margin:0 }
    .cat-tab-bar   { display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px;border-bottom:1px solid var(--color-outline-variant);overflow-x:auto }
    .cat-tab-btn   { padding:10px 16px;border:none;border-bottom:2px solid transparent;background:none;font-family:var(--font-sans);font-size:var(--text-label-md);font-weight:500;color:var(--color-on-surface-variant);cursor:pointer;white-space:nowrap;margin-bottom:-1px;transition:color var(--duration-normal) var(--ease-smooth),border-color var(--duration-normal) var(--ease-smooth) }
    .cat-tab-btn:hover { color:var(--color-on-surface) }
    .cat-tab-btn.active { color:var(--color-primary);border-bottom-color:var(--color-primary);font-weight:600 }
    .table-scroll  { overflow-x:auto }
    .code-chip     { font-family:monospace;font-size:11px;background:var(--color-bg-secondary);padding:2px 6px;border-radius:4px;color:var(--color-primary) }
    .flags-cell    { display:flex;flex-wrap:wrap;gap:4px }
    .col-actions   { display:flex;gap:2px }

    /* Add/Edit modal body */
    .form-grid       { display:grid;grid-template-columns:1fr 1fr;gap:14px }
    .field-full      { grid-column:1/-1 }
    .toggles-row     { display:flex;gap:20px;align-items:center }
    .error-banner    { margin-top:12px;padding:10px 14px;border-radius:8px;background:#fee2e2;color:#991b1b;font-size:13px }
    .offboarding-modal-footer { display:flex;justify-content:flex-end;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--color-outline-variant) }
    @media(max-width:500px) { .form-grid { grid-template-columns:1fr } }

    .mobile-only { display:none }
    @media (max-width: 640px) {
      .desktop-only { display:none }
      .mobile-only  { display:inline-flex }
    }
  `],
})
export class OffboardingCatalogAdminComponent implements OnChanges {
  private svc = inject(AdminService);
  private translate = inject(TranslateService);
  private modal = inject(ModalService);
  private modalRef?: ModalRef;
  bodyTpl = viewChild.required<TemplateRef<unknown>>('bodyTpl');

  paysId = input.required<number>();

  protected readonly CONTRACT_TYPES = CONTRACT_TYPES;

  filterContractType: string = CONTRACT_TYPES[0];
  loading  = signal(false);
  rows     = signal<OffboardingCatalogTask[]>([]);

  // ── Validator role for this pays (V66) ─────────────────────────────────────
  roles           = signal<Role[]>([]);
  /** null = no row configured, i.e. the pays falls back to the RH permission. */
  validatorRoleId: number | null = null;
  savingValidator = signal(false);
  validatorError  = signal<string | null>(null);

  editingId = signal<number | null>(null);
  saving    = signal(false);
  formError = signal<string | null>(null);

  readonly contractTypeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return CONTRACT_TYPES.map(ct => ({ value: ct, label: this.contractTypeLabel(ct) }));
  });

  readonly validatorOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [
      { value: '', label: this.translate.instant('ADMIN.docs.offboarding.validatorNone') },
      ...this.roles().map(r => ({ value: String(r.id), label: r.frenchName })),
    ];
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'orderIndex',     label: '#', width: '50px' },
      { key: 'taskLabel',      label: this.translate.instant('ADMIN.docs.offboarding.colLabel') },
      { key: 'taskCode',       label: this.translate.instant('ADMIN.docs.offboarding.colCode') },
      { key: 'ownerRole',      label: this.translate.instant('ADMIN.docs.offboarding.colRole') },
      { key: 'slaWorkingDays', label: this.translate.instant('ADMIN.docs.offboarding.colSla'), align: 'center' },
      { key: 'flags',          label: this.translate.instant('ADMIN.docs.offboarding.colOptions') },
      { key: 'isActive',       label: this.translate.instant('ADMIN.docs.offboarding.colStatus') },
    ];
  });

  readonly tableRows = computed<TableRow[]>(() =>
    this.rows().map(t => ({
      orderIndex:     t.orderIndex,
      taskLabel:      t.taskLabel,
      taskCode:       t.taskCode,
      ownerRole:      t.ownerRole,
      slaWorkingDays: t.slaWorkingDays,
      flags:          null,
      isActive:       t.isActive,
      _source:        t,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      hoverable: true,
      actions: [
        {
          id: 'edit', icon: 'edit',
          tooltip: this.translate.instant('ADMIN.docs.offboarding.edit'),
          onClick: (row: TableRow) => this.openEdit(row['_source'] as OffboardingCatalogTask),
        },
        {
          id: 'deactivate', icon: 'toggle_on',
          tooltip: this.translate.instant('ADMIN.docs.offboarding.deactivate'),
          hidden: (row: TableRow) => !(row['_source'] as OffboardingCatalogTask).isActive,
          onClick: (row: TableRow) => this.toggleActive(row['_source'] as OffboardingCatalogTask),
        },
        {
          id: 'activate', icon: 'toggle_off',
          tooltip: this.translate.instant('ADMIN.docs.offboarding.activate'),
          hidden: (row: TableRow) => (row['_source'] as OffboardingCatalogTask).isActive,
          onClick: (row: TableRow) => this.toggleActive(row['_source'] as OffboardingCatalogTask),
        },
      ],
    };
  });

  selectContractType(ct: string): void {
    this.filterContractType = ct;
    this.load();
  }

  validatorSelected(): string[] { return [this.validatorRoleId !== null ? String(this.validatorRoleId) : '']; }
  onValidatorChange(v: string[]): void { this.validatorRoleId = v[0] ? Number(v[0]) : null; }

  formContractTypeSelected(): string[] { return [this.form.contractType]; }
  onFormContractTypeChange(v: string[]): void { this.form.contractType = v[0] ?? ''; }

  form: SaveCatalogTaskRequest & { contractType: string; taskCode: string } = {
    paysId:         0,
    contractType:   '',
    taskCode:       '',
    taskLabel:      '',
    ownerRole:      '',
    isMandatory:    true,
    isBlocking:     false,
    slaWorkingDays: 5,
    orderIndex:     0,
  };

  ngOnChanges() {
    this.load();
    this.loadValidator();
  }

  /**
   * The role list is the full `Roles` table on purpose: the validator is chosen freely rather
   * than picked from a hardcoded shortlist, because role naming is per-deployment.
   */
  private loadValidator() {
    this.svc.listRoles().pipe(catchError(() => of([] as Role[])))
      .subscribe(list => this.roles.set(list));

    this.svc.getOffboardingValidator(this.paysId())
      .pipe(catchError(() => of(null)))
      .subscribe(v => { this.validatorRoleId = v?.roleId ?? null; });
  }

  saveValidator() {
    if (this.savingValidator()) return;
    this.savingValidator.set(true);
    this.validatorError.set(null);

    // Clearing the select is a real operation, not a no-op: it removes the row and puts the
    // pays back on the permission-only rule. Widened to `unknown` so the two branches share
    // one observable type — DELETE answers void, PUT answers the saved row, and neither
    // payload is used here.
    const req$: Observable<unknown> = this.validatorRoleId === null
      ? this.svc.clearOffboardingValidator(this.paysId())
      : this.svc.setOffboardingValidator(this.paysId(), this.validatorRoleId);

    req$.pipe(catchError(err => {
      this.validatorError.set(err?.error?.message
        ?? this.translate.instant('ADMIN.docs.offboarding.validatorError'));
      this.savingValidator.set(false);
      return of(null);
    })).subscribe(() => this.savingValidator.set(false));
  }

  load() {
    this.loading.set(true);
    this.svc.listCatalogTasks(this.paysId(), this.filterContractType || undefined)
      .pipe(catchError(() => of([])))
      .subscribe(list => { this.rows.set(list); this.loading.set(false); });
  }

  openAdd() {
    this.editingId.set(null);
    this.form = {
      paysId:         this.paysId(),
      contractType:   this.filterContractType,
      taskCode:       '',
      taskLabel:      '',
      ownerRole:      '',
      isMandatory:    true,
      isBlocking:     false,
      slaWorkingDays: 5,
      orderIndex:     this.rows().length,
    };
    this.formError.set(null);
    this.openModal(this.translate.instant('ADMIN.docs.offboarding.addTask'));
  }

  openEdit(task: OffboardingCatalogTask) {
    this.editingId.set(task.id);
    this.form = {
      paysId:         task.paysId,
      contractType:   task.contractType,
      taskCode:       task.taskCode,
      taskLabel:      task.taskLabel,
      ownerRole:      task.ownerRole,
      isMandatory:    task.isMandatory,
      isBlocking:     task.isBlocking,
      slaWorkingDays: task.slaWorkingDays,
      orderIndex:     task.orderIndex,
    };
    this.formError.set(null);
    this.openModal(this.translate.instant('ADMIN.docs.offboarding.editTitle'));
  }

  private openModal(title: string): void {
    this.modalRef = this.modal.open({ title, body: this.bodyTpl(), closeOnBackdrop: false });
  }

  cancel(): void {
    this.modalRef?.close();
  }

  isFormValid(): boolean {
    return !!(this.form.contractType && this.form.taskCode.trim() &&
              this.form.taskLabel.trim() && this.form.ownerRole.trim() &&
              this.form.slaWorkingDays >= 1);
  }

  save() {
    if (!this.isFormValid()) return;
    const id = this.editingId();
    const payload: SaveCatalogTaskRequest = {
      ...this.form,
      taskCode: this.form.taskCode.toUpperCase().replace(/\s+/g, '_'),
    };
    this.saving.set(true);
    this.formError.set(null);

    const req$ = id
      ? this.svc.updateCatalogTask(id, payload)
      : this.svc.createCatalogTask(payload);

    req$.pipe(
      catchError(err => {
        this.formError.set(err?.error?.message ?? err?.error?.detail ?? this.translate.instant('ADMIN.docs.offboarding.saveError'));
        this.saving.set(false);
        return of(null);
      }),
    ).subscribe(result => {
      this.saving.set(false);
      if (result) {
        this.modalRef?.close();
        this.load();
      }
    });
  }

  toggleActive(task: OffboardingCatalogTask) {
    this.svc.toggleCatalogTaskActive(task.id)
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        if (updated) {
          this.rows.update(list => list.map(t => t.id === updated.id ? updated : t));
        }
      });
  }

  contractTypeLabel(ct: string): string {
    const key = `ADMIN.docs.offboarding.contractType.${ct}`;
    const val = this.translate.instant(key);
    return val === key ? ct : val;
  }
}
