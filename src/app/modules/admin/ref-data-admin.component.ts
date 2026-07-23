import {
  Component, OnChanges, SimpleChanges, inject, input, signal, computed,
} from '@angular/core';
import {
  ButtonComponent, FormFieldComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
  PaginationComponent, PaginationConfig, ModalService,
} from '@khalilrebhiitec/daf360';
import { ModalComponent } from '../../shared/modal.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const PAGE_SIZE = 10;

import { RefDataService }      from '../../core/ref/ref-data.service';
import { RefDataItem, CreateRefDataRequest } from '../../core/ref/ref-data.model';
import { ContractHistoryService } from '../profiles/contract-history/contract-history.service';
import { TypeContratDto } from '../profiles/contract-history/contract-history.model';

type RefTab = 'grades' | 'disciplines' | 'nog-levels' | 'departments' | 'banks' | 'nationalities' | 'type-contrat' | 'it-asset-types';

interface TabConfig {
  key:      RefTab;
  label:    string;
  hasPays:  boolean;
  endpoint: string;
}

const TABS: TabConfig[] = [
  { key: 'grades',        label: 'ADMIN.data.refData.TAB_GRADES',        hasPays: true,  endpoint: 'grades'        },
  { key: 'disciplines',   label: 'ADMIN.data.refData.TAB_DISCIPLINES',   hasPays: true,  endpoint: 'disciplines'   },
  { key: 'nog-levels',    label: 'ADMIN.data.refData.TAB_NOG_LEVELS',    hasPays: true,  endpoint: 'nog-levels'    },
  { key: 'departments',   label: 'ADMIN.data.refData.TAB_DEPARTMENTS',   hasPays: true,  endpoint: 'departments'   },
  { key: 'banks',         label: 'ADMIN.data.refData.TAB_BANKS',         hasPays: true,  endpoint: 'banks'         },
  { key: 'nationalities', label: 'ADMIN.data.refData.TAB_NATIONALITIES', hasPays: false, endpoint: 'nationalities' },
  { key: 'type-contrat',    label: 'ADMIN.data.refData.TAB_TYPE_CONTRAT', hasPays: false, endpoint: 'type-contrat'   },
  { key: 'it-asset-types',  label: 'ADMIN.data.refData.TAB_IT_ASSETS',    hasPays: false, endpoint: 'it-asset-types' },
];

@Component({
  selector: 'app-ref-data-admin',
  standalone: true,
  imports: [ButtonComponent, FormFieldComponent, DataTableComponent, DafCellDirective, ModalComponent, PaginationComponent, TranslatePipe],
  template: `
<div>
  <!-- Sub-tab bar -->
  <nav class="rda-tab-bar" role="tablist">
    @for (tab of tabs; track tab.key) {
      <button
        class="rda-tab-btn"
        [class.active]="activeTab().key === tab.key"
        (click)="selectTab(tab)"
        role="tab"
        type="button"
      >{{ tab.label | translate }}</button>
    }
  </nav>

  <!-- Flash messages -->
  @if (successMsg()) {
    <div style="background:var(--color-success,#dcfce7);color:#fff;border-radius:8px;padding:10px 14px;font-size:var(--text-body-sm,13px);margin-bottom:16px;">
      {{ successMsg() }}
    </div>
  }
  @if (error()) {
    <div style="background:var(--color-error-container,#fee2e2);color:var(--color-on-error-container,#991b1b);border-radius:8px;padding:10px 14px;font-size:var(--text-body-sm,13px);margin-bottom:16px;">
      {{ error() }}
    </div>
  }

  <!-- Header -->
  <div class="rda-header">
    <h3 class="rda-header-title">{{ activeTab().label | translate }}</h3>
    <daf-button
      [label]="'ADMIN.data.refData.ADD' | translate"
      class="desktop-only"
      variant="teal"
      [options]="{ iconStart: 'add' }"
      (onClick)="showForm.set(true)" />
    <daf-button
      class="icon-btn-toggle mobile-only"
      title="Ajouter"
      variant="teal"
      [options]="{ iconStart: 'add', size: 'sm' }"
      (onClick)="showForm.set(true)" />
  </div>

  <!-- Table — generic ref data -->
  @if (!isTypeContratTab()) {
    @if (loading()) {
      <p style="font-size:var(--text-body-sm,13px);color:var(--color-on-surface-variant,#6B7280);">{{ 'ADMIN.data.refData.LOADING' | translate }}</p>
    } @else {
      <div class="table-scroll">
      <daf-data-table [columns]="itemColumns()" [rows]="itemRows()" [config]="itemTableConfig()">
        <ng-template dafCell="isActive" let-row>
          @if (row['_source'].isActive) {
            <span class="rda-badge rda-badge-yes">{{ 'ADMIN.data.refData.YES' | translate }}</span>
          } @else {
            <span class="rda-badge rda-badge-no">{{ 'ADMIN.data.refData.NO' | translate }}</span>
          }
        </ng-template>
        <ng-template dafCell="_actions" let-row>
          <daf-button
            class="icon-btn-delete"
            [title]="'ADMIN.data.refData.DELETE' | translate"
            variant="danger"
            [options]="{ size: 'sm', iconStart: 'delete' }"
            (onClick)="deleteItem(row['_source'])" />
        </ng-template>
      </daf-data-table>
      </div>

      @if (totalPages() > 1) {
        <div class="rda-pagination">
          <daf-pagination
            [currentPage]="currentPage()"
            [totalPages]="totalPages()"
            [totalElements]="items().length"
            [config]="paginationConfig"
            (pageChange)="onPageChange($event)" />
        </div>
      }
    }
  }

  <!-- Table — Types de contrat -->
  @if (isTypeContratTab()) {
    @if (loading()) {
      <p style="font-size:var(--text-body-sm,13px);color:var(--color-on-surface-variant,#6B7280);">{{ 'ADMIN.data.refData.LOADING' | translate }}</p>
    } @else {
      <div class="table-scroll">
      <daf-data-table [columns]="tcColumns()" [rows]="tcRows()" [config]="itemTableConfig()">
        <ng-template dafCell="isActive" let-row>
          @if (row['_source'].isActive) {
            <span class="rda-badge rda-badge-yes">{{ 'ADMIN.data.refData.YES' | translate }}</span>
          } @else {
            <span class="rda-badge rda-badge-no">{{ 'ADMIN.data.refData.NO' | translate }}</span>
          }
        </ng-template>
        <ng-template dafCell="_actions" let-row>
          <daf-button
            class="icon-btn-delete"
            [title]="'ADMIN.data.refData.DELETE' | translate"
            variant="danger"
            [options]="{ size: 'sm', iconStart: 'delete' }"
            (onClick)="deleteTypeContrat(row['_source'])" />
        </ng-template>
      </daf-data-table>
      </div>

      @if (totalPages() > 1) {
        <div class="rda-pagination">
          <daf-pagination
            [currentPage]="currentPage()"
            [totalPages]="totalPages()"
            [totalElements]="typeContrats().length"
            [config]="paginationConfig"
            (pageChange)="onPageChange($event)" />
        </div>
      }
    }
  }
</div>

<!-- Add modal — generic ref data -->
@if (!isTypeContratTab()) {
  <app-modal
    [title]="'ADMIN.data.refData.MODAL_ADD_ENTRY' | translate"
    [visible]="showForm()"
    [hasFooter]="true"
    (closed)="showForm.set(false)"
  >
    <div class="rda-form-grid">
      <daf-form-field
        [options]="{ label: ('ADMIN.data.refData.FIELD_LABEL_FR' | translate), placeholder: ('ADMIN.data.refData.PH_LABEL_FR' | translate), required: true, fullWidth: true }"
        [value]="createForm.labelFr"
        (valueChange)="createForm.labelFr = $any($event) ?? ''" />
      <daf-form-field
        [options]="{ label: ('ADMIN.data.refData.FIELD_LABEL_EN' | translate), placeholder: ('ADMIN.data.refData.PH_LABEL_EN' | translate), fullWidth: true }"
        [value]="createForm.labelEn"
        (valueChange)="createForm.labelEn = $any($event) ?? ''" />
      <daf-form-field
        [options]="{ label: ('ADMIN.data.refData.FIELD_CODE' | translate), placeholder: ('ADMIN.data.refData.PH_CODE' | translate), fullWidth: true }"
        [value]="createForm.code"
        (valueChange)="createForm.code = $any($event) ?? ''" />
      <daf-form-field
        [options]="{ label: ('ADMIN.data.refData.FIELD_ORDER' | translate), type: 'number', placeholder: ('ADMIN.data.refData.PH_ORDER' | translate), fullWidth: true }"
        [value]="createForm.sortOrder"
        (valueChange)="createForm.sortOrder = $event === null || $event === '' ? null : +$event" />
    </div>
    <div slot="footer">
      <daf-button [label]="'ADMIN.data.refData.CANCEL' | translate" variant="secondary" (onClick)="showForm.set(false)" />
      <daf-button
        [label]="saving() ? ('ADMIN.data.refData.SAVING' | translate) : ('ADMIN.data.refData.ADD_SHORT' | translate)"
        variant="teal"
        [options]="{ disabled: saving() || !createForm.labelFr.trim(), loading: saving() }"
        (onClick)="onCreate()" />
    </div>
  </app-modal>
}

<!-- Add modal — type contrat -->
@if (isTypeContratTab()) {
  <app-modal
    [title]="'ADMIN.data.refData.MODAL_ADD_TC' | translate"
    [visible]="showForm()"
    [hasFooter]="true"
    (closed)="showForm.set(false)"
  >
    <div class="rda-form-grid">
      <daf-form-field
        [options]="{ label: ('ADMIN.data.refData.TC_FIELD_CODE' | translate), placeholder: ('ADMIN.data.refData.TC_PH_CODE' | translate), required: true, fullWidth: true }"
        [value]="tcCreateCode"
        (valueChange)="tcCreateCode = $any($event) ?? ''" />
      <daf-form-field
        [options]="{ label: ('ADMIN.data.refData.TC_FIELD_LABEL_FR' | translate), placeholder: ('ADMIN.data.refData.TC_PH_LABEL_FR' | translate), required: true, fullWidth: true }"
        [value]="tcCreateLabelFr"
        (valueChange)="tcCreateLabelFr = $any($event) ?? ''" />
      <daf-form-field
        [options]="{ label: ('ADMIN.data.refData.TC_FIELD_LABEL_EN' | translate), placeholder: ('ADMIN.data.refData.TC_PH_LABEL_EN' | translate), fullWidth: true }"
        [value]="tcCreateLabelEn"
        (valueChange)="tcCreateLabelEn = $any($event) ?? ''" />
    </div>
    <div slot="footer">
      <daf-button [label]="'ADMIN.data.refData.CANCEL' | translate" variant="secondary" (onClick)="showForm.set(false)" />
      <daf-button
        [label]="saving() ? ('ADMIN.data.refData.SAVING' | translate) : ('ADMIN.data.refData.ADD_SHORT' | translate)"
        variant="teal"
        [options]="{ disabled: saving() || !tcCreateLabelFr.trim() || !tcCreateCode.trim(), loading: saving() }"
        (onClick)="onCreateTypeContrat()" />
    </div>
  </app-modal>
}
  `,
  styles: [`
    .rda-tab-bar { display:flex;gap:4px;flex-wrap:wrap;margin-bottom:24px;border-bottom:1px solid var(--color-outline-variant);overflow-x:auto }
    .rda-tab-btn { padding:10px 16px;border:none;border-bottom:2px solid transparent;background:none;font-family:var(--font-sans);font-size:var(--text-label-sm);font-weight:500;color:var(--color-on-surface-variant);cursor:pointer;white-space:nowrap;margin-bottom:-1px;transition:color var(--duration-normal) var(--ease-smooth),border-color var(--duration-normal) var(--ease-smooth) }
    .rda-tab-btn:hover { color:var(--color-on-surface) }
    .rda-tab-btn.active { color:var(--color-tertiary);border-bottom-color:var(--color-tertiary);font-weight:600 }
    .rda-header { display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px }
    .rda-header-title { font-size:var(--text-body-lg);font-weight:700;color:var(--color-on-surface);margin:0 }
    .rda-badge { font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700 }
    .rda-badge-yes { background:var(--color-tertiary-container);color:var(--color-on-tertiary-container) }
    .rda-badge-no  { background:var(--color-surface-container);color:var(--color-on-surface-variant) }
    .rda-pagination { display:flex;justify-content:flex-end;padding:10px 0 }
    .rda-form-grid { display:grid;grid-template-columns:1fr 1fr;gap:12px }
    .table-scroll  { overflow-x:auto }

    @media (max-width: 480px) {
      .rda-form-grid { grid-template-columns:1fr }
    }

    .mobile-only { display:none }
    @media (max-width: 640px) {
      .desktop-only { display:none }
      .mobile-only  { display:inline-flex }
    }

    /* daf-data-table purges the dynamically-computed text-right Tailwind class from its
       own build — force the right-aligned Actions column ourselves. */
    :host ::ng-deep daf-data-table {
      th:last-child { text-align: right !important; }
      td:last-child { display:flex;justify-content:flex-end;align-items:center;gap:6px; }
    }
  `],
})
export class RefDataAdminComponent implements OnChanges {
  private refSvc      = inject(RefDataService);
  private contractSvc = inject(ContractHistoryService);
  private modal       = inject(ModalService);
  private translate   = inject(TranslateService);

  paysId = input<number>(179);

  // TypeContrat-specific state (loaded when tab = 'type-contrat')
  typeContrats     = signal<TypeContratDto[]>([]);
  tcCreateCode     = '';
  tcCreateLabelFr  = '';
  tcCreateLabelEn  = '';
  isTypeContratTab = computed(() => this.activeTab().key === 'type-contrat');

  readonly tabs = TABS;

  activeTab = signal<TabConfig>(TABS[0]);
  items     = signal<RefDataItem[]>([]);
  loading   = signal(false);
  saving    = signal(false);
  showForm  = signal(false);
  error     = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  createForm: { labelFr: string; labelEn: string; code: string; sortOrder: number | null } = {
    labelFr: '', labelEn: '', code: '', sortOrder: null,
  };

  readonly itemColumns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'labelFr',   label: this.translate.instant('ADMIN.data.refData.COL_LABEL_FR') },
      { key: 'labelEn',   label: this.translate.instant('ADMIN.data.refData.COL_LABEL_EN') },
      { key: 'code',      label: this.translate.instant('ADMIN.data.refData.COL_CODE') },
      { key: 'sortOrder', label: this.translate.instant('ADMIN.data.refData.COL_ORDER') },
      { key: 'isActive',  label: this.translate.instant('ADMIN.data.refData.COL_ACTIVE') },
      { key: '_actions',  label: '', align: 'right' },
    ];
  });

  currentPage = signal(0);

  readonly totalPages = computed(() => {
    const len = this.isTypeContratTab() ? this.typeContrats().length : this.items().length;
    return Math.max(1, Math.ceil(len / PAGE_SIZE));
  });

  readonly paginationConfig: PaginationConfig = {
    showFirstLast: true,
    showPrevNext:  true,
    maxVisible:    5,
    size:          'sm',
  };

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  readonly pagedItems = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.items().slice(start, start + PAGE_SIZE);
  });

  readonly itemRows = computed<TableRow[]>(() =>
    this.pagedItems().map(i => ({
      labelFr:   i.labelFr,
      labelEn:   i.labelEn,
      code:      i.code ?? '—',
      sortOrder: i.sortOrder ?? '—',
      isActive:  i.isActive,
      _source:   i,
    })),
  );

  readonly tcColumns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'code',     label: this.translate.instant('ADMIN.data.refData.COL_CODE') },
      { key: 'labelFr',  label: this.translate.instant('ADMIN.data.refData.COL_LABEL_FR') },
      { key: 'labelEn',  label: this.translate.instant('ADMIN.data.refData.COL_LABEL_EN') },
      { key: 'isActive', label: this.translate.instant('ADMIN.data.refData.COL_ACTIVE') },
      { key: '_actions', label: '', align: 'right' },
    ];
  });

  readonly pagedTypeContrats = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.typeContrats().slice(start, start + PAGE_SIZE);
  });

  readonly tcRows = computed<TableRow[]>(() =>
    this.pagedTypeContrats().map(tc => ({
      code:      tc.code,
      labelFr:   tc.labelFr,
      labelEn:   tc.labelEn,
      isActive:  tc.isActive,
      _source:   tc,
    })),
  );

  readonly itemTableConfig = computed<TableConfig>(() => ({
    hoverable: true,
  }));

  ngOnChanges(changes: SimpleChanges): void {
    this.loadItems();
  }

  selectTab(tab: TabConfig): void {
    this.activeTab.set(tab);
    this.showForm.set(false);
    this.currentPage.set(0);
    this.resetForm();
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.error.set(null);
    const tab = this.activeTab();

    if (tab.key === 'type-contrat') {
      this.contractSvc.getTypeContrats().subscribe({
        next: tc => { this.typeContrats.set(tc); this.loading.set(false); },
        error: () => { this.error.set(this.translate.instant('ADMIN.data.refData.ERR_LOAD_TC')); this.loading.set(false); },
      });
      return;
    }

    if (tab.key === 'it-asset-types') {
      this.refSvc.getItAssetTypes().subscribe({
        next: r  => { this.items.set(r); this.loading.set(false); },
        error: () => { this.error.set(this.translate.instant('ADMIN.data.refData.ERR_LOAD_ASSETS')); this.loading.set(false); },
      });
      return;
    }

    const obs = tab.hasPays
      ? this.getForType(tab.key, this.paysId())
      : this.refSvc.getNationalities();

    obs.subscribe({
      next: r  => { this.items.set(r); this.loading.set(false); },
      error: () => { this.error.set(this.translate.instant('ADMIN.data.refData.ERR_LOAD_DATA')); this.loading.set(false); },
    });
  }

  private getForType(key: RefTab, paysId: number) {
    switch (key) {
      case 'grades':       return this.refSvc.getGrades(paysId);
      case 'disciplines':  return this.refSvc.getDisciplines(paysId);
      case 'nog-levels':   return this.refSvc.getNogLevels(paysId);
      case 'departments':  return this.refSvc.getDepartments(paysId);
      case 'banks':        return this.refSvc.getBanks(paysId);
      default:             return this.refSvc.getNationalities();
    }
  }

  onCreate(): void {
    if (!this.createForm.labelFr.trim()) return;
    this.saving.set(true);
    this.error.set(null);
    const tab = this.activeTab();
    const req: CreateRefDataRequest = {
      labelFr:   this.createForm.labelFr.trim(),
      labelEn:   this.createForm.labelEn.trim() || undefined,
      code:      this.createForm.code.trim()    || undefined,
      sortOrder: this.createForm.sortOrder      ?? undefined,
      paysId:    tab.hasPays ? this.paysId()    : undefined,
    };
    this.refSvc.invalidateAll();
    this.refSvc.create(tab.endpoint, req).subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForm();
        this.showForm.set(false);
        this.flash(this.translate.instant('ADMIN.data.refData.MSG_CREATED'));
        this.loadItems();
      },
      error: err => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.data.refData.ERR_CREATE'));
      },
    });
  }

  deleteItem(item: RefDataItem): void {
    this.modal.open({
      title: this.translate.instant('ADMIN.data.refData.DELETE_ENTRY_TITLE'),
      body:  this.translate.instant('ADMIN.data.refData.DELETE_CONFIRM', { label: item.labelFr }),
      buttons: [
        { label: this.translate.instant('ADMIN.data.refData.CANCEL'), variant: 'secondary', action: r => r.close() },
        { label: this.translate.instant('ADMIN.data.refData.DELETE'), variant: 'primary',   action: r => { this.doDeleteItem(item); r.close(); } },
      ],
    });
  }

  private doDeleteItem(item: RefDataItem): void {
    const tab = this.activeTab();
    this.refSvc.invalidateAll();
    this.refSvc.delete(tab.endpoint, item.id, tab.hasPays ? this.paysId() : undefined).subscribe({
      next: () => { this.flash(this.translate.instant('ADMIN.data.refData.MSG_DELETED')); this.loadItems(); },
      error: err => this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.data.refData.ERR_DELETE')),
    });
  }

  onCreateTypeContrat(): void {
    if (!this.tcCreateLabelFr.trim() || !this.tcCreateCode.trim()) return;
    this.saving.set(true);
    this.error.set(null);
    this.contractSvc.createTypeContrat({
      code:    this.tcCreateCode.trim(),
      labelFr: this.tcCreateLabelFr.trim(),
      labelEn: this.tcCreateLabelEn.trim() || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.tcCreateCode = ''; this.tcCreateLabelFr = ''; this.tcCreateLabelEn = '';
        this.showForm.set(false);
        this.flash(this.translate.instant('ADMIN.data.refData.MSG_TC_CREATED'));
        this.loadItems();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.data.refData.ERR_CREATE'));
      },
    });
  }

  deleteTypeContrat(tc: TypeContratDto): void {
    this.modal.open({
      title: this.translate.instant('ADMIN.data.refData.DELETE_TC_TITLE'),
      body:  this.translate.instant('ADMIN.data.refData.DELETE_CONFIRM', { label: tc.labelFr }),
      buttons: [
        { label: this.translate.instant('ADMIN.data.refData.CANCEL'), variant: 'secondary', action: r => r.close() },
        { label: this.translate.instant('ADMIN.data.refData.DELETE'), variant: 'primary',   action: r => { this.doDeleteTypeContrat(tc); r.close(); } },
      ],
    });
  }

  private doDeleteTypeContrat(tc: TypeContratDto): void {
    this.contractSvc.deleteTypeContrat(tc.id).subscribe({
      next: () => { this.flash(this.translate.instant('ADMIN.data.refData.MSG_TC_DELETED')); this.loadItems(); },
      error: (err: any) => this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.data.refData.ERR_DELETE')),
    });
  }

  resetForm(): void {
    this.createForm = { labelFr: '', labelEn: '', code: '', sortOrder: null };
  }

  private flash(msg: string): void {
    this.successMsg.set(msg);
    this.error.set(null);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
