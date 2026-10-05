import { Component, TemplateRef, computed, inject, input, OnChanges, signal, untracked, viewChild } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AdminService }        from './admin.service';
import { RequestTypeCatalog }  from './models/admin.model';
import { SpinnerComponent }    from '../../shared/spinner.component';
import {
  SelectComponent, SelectOption,
  FormFieldComponent,
  ButtonComponent,
  StatusBadgeComponent, DataTableComponent, DafCellDirective, SortDirection,
  TableColumn, TableConfig, TableRow, PaginationComponent, ModalService, ModalRef,
  SearchToolbarComponent,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableSort, searchRows, sortByColumn, toTableSort } from '../../shared/table-sort.utils';

/** What each request-type column sorts on — the raw values, not the formatted cells. */
const REQUEST_TYPE_SORT: Record<string, (t: RequestTypeCatalog) => string | number | null> = {
  typeCode:       t => t.typeCode || null,
  displayNameFr:  t => t.displayNameFr || null,
  category:       t => t.category || null,
  approvalLevel:  t => t.approvalLevel || null,        // L1 before L2
  defaultSlaDays: t => t.defaultSlaDays ?? null,       // the number, not "2 j"
  isActive:       t => (t.isActive ? 1 : 0),           // inactive first on an ascending sort
};

const CATEGORIES = ['DOCUMENT','PERSONAL_DATA_CHANGE','BANK_DETAILS','CAREER','OTHER'];
const PAGE_SIZE = 5;

@Component({
  selector: 'app-request-types-admin',
  standalone: true,
  imports: [
    SpinnerComponent, SelectComponent, FormFieldComponent, ButtonComponent,
    StatusBadgeComponent, DataTableComponent, DafCellDirective, PaginationComponent,
    SearchToolbarComponent, TranslatePipe,
  ],
  template: `
    <div class="section-header">
      <div>
        <h3 class="col-title">{{ 'ADMIN.catalog.requestTypes.title' | translate }}</h3>
        <p class="col-sub">{{ 'ADMIN.catalog.requestTypes.subtitle' | translate }}</p>
      </div>
      <div class="header-actions">
        <daf-button
          class="desktop-only"
          [label]="'ADMIN.catalog.requestTypes.initDefault' | translate"
          variant="ghost"
          [options]="{ disabled: seeding(), loading: seeding() }"
          (onClick)="seed()"
        />
        <daf-button class="desktop-only" [label]="'ADMIN.catalog.requestTypes.add' | translate" variant="teal" [options]="{ iconStart: 'add' }" (onClick)="openAdd()" />

        <daf-button
          class="icon-btn-toggle mobile-only"
          [label]="'ADMIN.catalog.requestTypes.initDefault' | translate"
          variant="ghost"
          [options]="{ iconStart: 'restart_alt', size: 'sm', disabled: seeding(), loading: seeding() }"
          (onClick)="seed()"
        />
        <daf-button
          class="icon-btn-toggle mobile-only"
          title="Ajouter"
          variant="teal"
          [options]="{ iconStart: 'add', size: 'sm' }"
          (onClick)="openAdd()"
        />
      </div>
    </div>

    @if (loading()) { <div class="center"><app-spinner /></div> }
    @else if (types().length === 0) {
      <div class="empty-state">
        <p>{{ 'ADMIN.catalog.requestTypes.empty' | translate }}</p>
        <daf-button [label]="'ADMIN.catalog.requestTypes.initFull' | translate" variant="ghost" (onClick)="seed()" />
      </div>
    } @else {
      <!-- Same toolbar as the other list pages: the search filters the rows, and [table]
           puts the table's reset + column picker on the right of the bar. -->
      <daf-search-toolbar class="mb-4 block"
        [placeholder]="'REQUESTS.TABLE.SEARCH' | translate"
        [value]="searchQuery()"
        [debounce]="200"
        (valueChange)="onSearch($event)"
        [table]="typesTable" />

      <div class="table-scroll">
      <daf-data-table #typesTable [columns]="columns()" [rows]="rows()" [config]="tableConfig()"
                      (sortChange)="onSortChange($event.key, $event.dir)"
                      (resetClick)="onSortChange('', null)">
        <ng-template dafCell="category" let-row>
          <daf-badge [label]="row['category']" [options]="{ variant: 'neutral', size: 'sm' }" />
        </ng-template>
        <ng-template dafCell="approvalLevel" let-row>
          <daf-badge [label]="row['approvalLevel']" [options]="{ variant: row['approvalLevel'] === 'L2' ? 'warning' : 'success', size: 'sm' }" />
        </ng-template>
        <ng-template dafCell="isActive" let-row>
          <daf-badge [label]="(row['_source'].isActive ? 'ADMIN.catalog.requestTypes.statusActive' : 'ADMIN.catalog.requestTypes.statusInactive') | translate" [options]="{ variant: row['_source'].isActive ? 'success' : 'neutral', size: 'sm' }" />
        </ng-template>
      </daf-data-table>
      </div>

      <!-- Count + Pagination -->
      <div class="rta-footer">
        <span class="rta-count"><strong>{{ totalElements() }}</strong> {{ 'ADMIN.catalog.requestTypes.countUnit' | translate }}</span>
        @if (totalPages() > 1) {
          <daf-pagination
            [currentPage]="currentPage()"
            [totalPages]="totalPages()"
            [totalElements]="totalElements()"
            (pageChange)="onPageChange($event)" />
        }
      </div>
    }

    <!-- Add/Edit Modal body — projected into the real daf-modal-host via ModalService.
         The footer lives in here too (not in ModalConfig.buttons), because that config is
         a one-shot snapshot that can't react to saving() / form afterward. -->
    <ng-template #bodyTpl>
      <div class="modal-form">
        <div class="field-row">
          <daf-form-field
            [options]="{ label: ('ADMIN.catalog.requestTypes.fieldCode' | translate), placeholder: ('ADMIN.catalog.requestTypes.placeholderCode' | translate), required: true, disabled: !!editTarget(), fullWidth: true }"
            [value]="form.typeCode"
            (valueChange)="form.typeCode = $any($event).toUpperCase()"
          />
        </div>
        <div class="field-row">
          <daf-form-field
            [options]="{ label: ('ADMIN.catalog.requestTypes.fieldLabelFr' | translate), required: true, fullWidth: true }"
            [value]="form.displayNameFr"
            (valueChange)="form.displayNameFr = $any($event)"
          />
        </div>
        <div class="field-row">
          <daf-form-field
            [options]="{ label: ('ADMIN.catalog.requestTypes.fieldLabelEn' | translate), required: true, fullWidth: true }"
            [value]="form.displayNameEn"
            (valueChange)="form.displayNameEn = $any($event)"
          />
        </div>
        <div class="form-row">
          <div class="field-row">
            <daf-select
              [selected]="[form.category]"
              [options]="categoryOptions"
              [config]="{ label: ('ADMIN.catalog.requestTypes.fieldCategory' | translate), required: true, fullWidth: true }"
              (selectedChange)="form.category = $event[0]"
            />
          </div>
          <div class="field-row">
            <daf-select
              [selected]="[form.approvalLevel]"
              [options]="approvalLevelOptions()"
              [config]="{ label: ('ADMIN.catalog.requestTypes.fieldApprovalLevel' | translate), fullWidth: true }"
              (selectedChange)="onApprovalLevelChange($event[0])"
            />
          </div>
          <div class="field-row">
            <daf-form-field
              [options]="{ label: ('ADMIN.catalog.requestTypes.fieldSla' | translate), type: 'number', fullWidth: true }"
              [value]="form.defaultSlaDays"
              (valueChange)="form.defaultSlaDays = $any($event)"
            />
          </div>
        </div>
        <div class="field-row">
          <daf-form-field
            [options]="{ label: ('ADMIN.catalog.requestTypes.fieldDescription' | translate), type: 'textarea', rows: 2, fullWidth: true }"
            [value]="form.description"
            (valueChange)="form.description = $any($event)"
          />
        </div>
      </div>
      @if (modalError()) { <div class="error-banner" role="alert">{{ modalError() }}</div> }
      <div class="rta-modal-footer">
        <daf-button [label]="'ADMIN.catalog.requestTypes.cancel' | translate" variant="secondary" (onClick)="cancel()" />
        <daf-button
          [label]="(editTarget() ? 'ADMIN.catalog.requestTypes.save' : 'ADMIN.catalog.requestTypes.create') | translate"
          variant="teal"
          [options]="{ disabled: !form.typeCode || !form.displayNameFr || saving(), loading: saving() }"
          (onClick)="save()"
        />
      </div>
    </ng-template>
  `,
  styles: [`
    .section-header { display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px }
    .col-title { font-size:13px;font-weight:700;margin:0 }
    .col-sub   { font-size:12px;color:var(--color-text-muted);margin:2px 0 0 }
    .header-actions { display:flex;flex-wrap:wrap;gap:8px;align-items:center }
    .center   { display:flex;justify-content:center;padding:24px }
    .table-scroll { overflow-x:auto }
    .rta-footer { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px }
    .rta-count  { font-size:12px;color:var(--color-text-muted) }
    .empty-state { text-align:center;padding:36px;color:var(--color-text-muted);display:flex;flex-direction:column;align-items:center;gap:12px }
    .empty-state p { margin:0;font-size:13px }
    .modal-form { display:flex;flex-direction:column;gap:12px }
    .form-row   { display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px }
    .field-row  { display:flex;flex-direction:column;gap:4px }
    .error-banner { margin-top:8px;padding:8px 12px;border-radius:8px;background:var(--color-error-container);color:var(--color-on-error-container);font-size:12px }

    /* The footer lives inside the body template (see the component class), so it needs its
       own separator — daf-modal-host only draws one around config.buttons. */
    .rta-modal-footer { display:flex;justify-content:flex-end;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--color-outline-variant) }

    @media (max-width: 560px) {
      .form-row { grid-template-columns:1fr }
    }

    .mobile-only { display:none }
    @media (max-width: 640px) {
      .desktop-only { display:none }
      .mobile-only  { display:inline-flex }
    }
  `],
})
export class RequestTypesAdminComponent implements OnChanges {
  private svc   = inject(AdminService);
  private modal = inject(ModalService);
  private translate = inject(TranslateService);

  paysId = input(179);

  loading    = signal(false);
  seeding    = signal(false);
  saving     = signal(false);
  types      = signal<RequestTypeCatalog[]>([]);
  editTarget = signal<RequestTypeCatalog | null>(null);
  modalError = signal<string | null>(null);

  private modalRef?: ModalRef;
  bodyTpl = viewChild.required<TemplateRef<unknown>>('bodyTpl');

  readonly categories = CATEGORIES;
  readonly categoryOptions: SelectOption[] = CATEGORIES.map(c => ({ value: c, label: c }));
  readonly approvalLevelOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [
      { value: 'L1', label: this.translate.instant('ADMIN.catalog.requestTypes.approvalL1') },
      { value: 'L2', label: this.translate.instant('ADMIN.catalog.requestTypes.approvalL2') },
    ];
  });

  form = { typeCode:'', displayNameFr:'', displayNameEn:'', description:'', category:'DOCUMENT', approvalLevel:'L1' as 'L1'|'L2', defaultSlaDays:2 };

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'typeCode', label: this.translate.instant('ADMIN.catalog.requestTypes.colCode'), sortable: true },
      { key: 'displayNameFr', label: this.translate.instant('ADMIN.catalog.requestTypes.colLabel'), sortable: true },
      { key: 'category', label: this.translate.instant('ADMIN.catalog.requestTypes.colCategory'), sortable: true },
      { key: 'approvalLevel', label: this.translate.instant('ADMIN.catalog.requestTypes.colApproval'), sortable: true },
      { key: 'defaultSlaDays', label: this.translate.instant('ADMIN.catalog.requestTypes.colSla'), align: 'center', sortable: true },
      { key: 'isActive', label: this.translate.instant('ADMIN.catalog.requestTypes.colActive'), align: 'center', sortable: true },
    ];
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // A seed read once by the table — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      showHeader: false,
      hoverable: true,
      // Stable row identity: row heights are keyed by it, not by render index.
      rowId: (row: TableRow) => (row['_source'] as RequestTypeCatalog).id,
      resizableColumns:  true,
      resizableRows:     true,
      columnPicker:      true,
      columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
      showReset:         true,
      resetLabel:        t('REQUESTS.TABLE.RESET'),
      sortLabel:         t('REQUESTS.TABLE.SORT_BY'),
      // Rows are one client-side page; this component sorts the whole list (sortByColumn).
      manualSort:        true,
      ...(sort ? { defaultSort: sort } : {}),
      actions: [
        {
          id: 'edit', icon: 'edit',
          tooltip: this.translate.instant('ADMIN.catalog.requestTypes.actionEdit'),
          onClick: (row: TableRow) => this.openEdit(row['_source'] as RequestTypeCatalog),
        },
        {
          id: 'deactivate', icon: 'toggle_on',
          tooltip: this.translate.instant('ADMIN.catalog.requestTypes.actionDeactivate'),
          hidden: (row: TableRow) => !(row['_source'] as RequestTypeCatalog).isActive,
          onClick: (row: TableRow) => this.deactivate(row['_source'] as RequestTypeCatalog),
        },
      ],
    };
  });

  // Pagination — 5 per page
  currentPage = signal(0);
  /** Table header sort — applied to the whole list, before paging (`manualSort`). */
  readonly sort = signal<TableSort | null>(null);
  /** Toolbar search — filters the whole list, before sort and paging. */
  readonly searchQuery = signal('');

  /** Searches what the cells show (the SLA as "2 j", the translated status). */
  readonly filteredTypes = computed(() => {
    this.translate.currentLang();
    const suffix = this.translate.instant('ADMIN.catalog.requestTypes.slaSuffix');
    return searchRows(this.types(), this.searchQuery(), t => [
      t.typeCode, t.displayNameFr, t.category, t.approvalLevel, t.defaultSlaDays + suffix,
      this.translate.instant(t.isActive ? 'ADMIN.catalog.requestTypes.statusActive' : 'ADMIN.catalog.requestTypes.statusInactive'),
    ]);
  });

  readonly totalElements = computed(() => this.filteredTypes().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / PAGE_SIZE));

  readonly pagedTypes = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return sortByColumn(this.filteredTypes(), this.sort(), REQUEST_TYPE_SORT).slice(start, start + PAGE_SIZE);
  });

  /** New search → back to the first page (otherwise it can land on an empty one). */
  onSearch(value: string): void {
    if (value === this.searchQuery()) return;   // daf-search-toolbar re-emits on blur
    this.searchQuery.set(value);
    this.currentPage.set(0);
  }

  readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    const suffix = this.translate.instant('ADMIN.catalog.requestTypes.slaSuffix');
    return this.pagedTypes().map(t => ({
      typeCode: t.typeCode,
      displayNameFr: t.displayNameFr,
      category: t.category,
      approvalLevel: t.approvalLevel,
      defaultSlaDays: t.defaultSlaDays + suffix,
      isActive: t.isActive,
      _source: t,
    }));
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  /** Header click (or the reset icon): a new order makes the current page meaningless. */
  onSortChange(key: string, dir: SortDirection): void {
    this.sort.set(toTableSort(key, dir));
    this.currentPage.set(0);
  }

  ngOnChanges() { this.load(); }

  private load() {
    this.loading.set(true);
    this.currentPage.set(0);
    this.svc.listRequestTypes(this.paysId()).pipe(catchError(() => of([]))).subscribe(ts => {
      this.types.set(ts);
      this.loading.set(false);
    });
  }

  onApprovalLevelChange(value: string): void {
    this.form.approvalLevel = (value === 'L2' ? 'L2' : 'L1');
  }

  openAdd() {
    this.editTarget.set(null);
    this.form = { typeCode:'', displayNameFr:'', displayNameEn:'', description:'', category:'DOCUMENT', approvalLevel:'L1', defaultSlaDays:2 };
    this.modalError.set(null);
    this.openModal(this.translate.instant('ADMIN.catalog.requestTypes.modalTitleNew'));
  }

  openEdit(t: RequestTypeCatalog) {
    this.editTarget.set(t);
    this.form = { typeCode:t.typeCode, displayNameFr:t.displayNameFr, displayNameEn:t.displayNameEn, description:t.description??'', category:t.category, approvalLevel:t.approvalLevel, defaultSlaDays:t.defaultSlaDays };
    this.modalError.set(null);
    this.openModal(this.translate.instant('ADMIN.catalog.requestTypes.modalTitleEdit'));
  }

  private openModal(title: string): void {
    // closeOnBackdrop: false — the form has unsaved input the moment it's open, unlike the
    // plain confirm dialog `deactivate()` opens below.
    this.modalRef = this.modal.open({ title, body: this.bodyTpl(), size: 'md', closeOnBackdrop: false });
  }

  cancel(): void {
    this.modalRef?.close();
  }

  save() {
    this.saving.set(true);
    const dto = { paysId:this.paysId(), ...this.form };
    const obs = this.editTarget() ? this.svc.updateRequestType(this.editTarget()!.id, dto) : this.svc.createRequestType(dto);
    obs.pipe(catchError(err => { this.modalError.set(err?.error?.message ?? this.translate.instant('ADMIN.catalog.requestTypes.error')); this.saving.set(false); return of(null); }))
       .subscribe(r => { this.saving.set(false); if (r) { this.modalRef?.close(); this.load(); } });
  }

  deactivate(t: RequestTypeCatalog) {
    this.modal.open({
      title: this.translate.instant('ADMIN.catalog.requestTypes.deactivateTitle'),
      body:  this.translate.instant('ADMIN.catalog.requestTypes.deactivateBody', { name: t.displayNameFr }),
      buttons: [
        { label: this.translate.instant('ADMIN.catalog.requestTypes.cancel'),            variant: 'secondary', action: r => r.close() },
        { label: this.translate.instant('ADMIN.catalog.requestTypes.actionDeactivate'),  variant: 'primary',   action: r => {
          this.svc.deactivateRequestType(t.id).pipe(catchError(() => of(null))).subscribe(() => this.load());
          r.close();
        } },
      ],
    });
  }

  seed() {
    this.seeding.set(true);
    this.svc.seedRequestTypes().pipe(catchError(() => of(null))).subscribe(() => { this.seeding.set(false); this.load(); });
  }
}
