import { Component, TemplateRef, computed, inject, input, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent, CheckboxComponent, DafCellDirective, DataTableComponent,
  FormFieldComponent, SortDirection, TableColumn, TableConfig, TableRow, StatusBadgeComponent,
  PaginationComponent, PaginationConfig, ModalService, ModalRef,
  SearchToolbarComponent,
} from '@khalilrebhiitec/daf360';
import { ConfigurableListService } from '../../../core/lists/configurable-list.service';
import {
  CreateListValueRequest, ListType, ListValue, UpdateListValueRequest,
} from '../../../core/lists/configurable-list.model';
import { UserStore } from '../../../core/user.store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableSort, searchRows, sortByColumn, toTableSort } from '../../../shared/table-sort.utils';

const PAGE_SIZE = 10;

/** What each list-value column sorts on. No sort = the list's own `sortOrder`. */
const LIST_VALUE_SORT: Record<string, (v: ListValue) => string | number | null> = {
  valueCode: v => v.valueCode || null,
  labelFr:   v => v.labelFr || null,
  labelEn:   v => v.labelEn || null,
  isActive:  v => (v.isActive ? 1 : 0),   // inactive first on an ascending sort
  isSystem:  v => (v.isSystem ? 1 : 0),   // editable values first on an ascending sort
};

@Component({
  selector: 'app-list-manager',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule, DataTableComponent, DafCellDirective,
    ButtonComponent, FormFieldComponent, CheckboxComponent, StatusBadgeComponent,
    PaginationComponent, SearchToolbarComponent, TranslatePipe,
  ],
  templateUrl: './list-manager.component.html',
  styleUrl: './list-manager.component.scss',
})
export class ListManagerComponent implements OnInit {
  private listService = inject(ConfigurableListService);
  private fb          = inject(FormBuilder);
  private userStore   = inject(UserStore);
  private translate   = inject(TranslateService);
  private modal       = inject(ModalService);
  private modalRef?: ModalRef;
  bodyTpl = viewChild.required<TemplateRef<unknown>>('bodyTpl');

  /**
   * The entity picked in /rh/admin. A per-pays list (CONTRACT_TYPE…) shows and creates the
   * values of THIS entity; a global list ignores it. The admin shell rebuilds this tab when
   * the pick changes, so the value is read as-is, never watched.
   */
  readonly paysId = input<number | null>(null);
  adding  = signal(false);

  listTypes       = signal<ListType[]>([]);
  selectedType    = signal<ListType | null>(null);
  values          = signal<ListValue[]>([]);
  loadingTypes    = signal(true);
  loadingValues   = signal(false);
  /** Search over the selected list's values (toolbar above the table). */
  searchQuery     = signal('');
  editingId       = signal<number | null>(null);
  error           = signal<string | null>(null);
  successMsg      = signal<string | null>(null);

  /** The values table (absent while loading) — fed to the toolbar's `[table]`. */
  readonly table = viewChild(DataTableComponent);

  /** New search → back to the first page (else one can sit on an empty page). */
  onSearch(value: string): void {
    if (value === this.searchQuery()) return;
    this.searchQuery.set(value);
    this.currentPage.set(0);
  }

  /** Per-pays list: whether the selected list is split by entity right now. */
  readonly isPerPaysView = computed(() =>
    !!this.selectedType()?.isPerPays && this.paysId() != null);

  /**
   * The admin endpoint returns every entity's values at once. For a per-pays list, keep the
   * picked entity's own values plus the shared ones (pays_id NULL) — exactly what a form of
   * that entity is offered (ConfigurableListValueRepository.findActiveByListTypeAndPays).
   */
  readonly scopedValues = computed(() => {
    if (!this.isPerPaysView()) return this.values();
    const pays = this.paysId();
    return this.values().filter(v => v.paysId === pays || v.paysId === null);
  });

  /** Searches what the row shows: code, both labels, and the translated status badges. */
  readonly filteredValues = computed(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return searchRows(this.scopedValues(), this.searchQuery(), v => [
      v.valueCode, v.labelFr, v.labelEn,
      t(v.isActive ? 'ADMIN.data.lists.ACTIVE' : 'ADMIN.data.lists.INACTIVE'),
      v.isSystem ? t('ADMIN.data.lists.SYSTEM') : null,
    ]);
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'valueCode', label: this.translate.instant('ADMIN.data.lists.COL_CODE'), sortable: true },
      { key: 'labelFr', label: this.translate.instant('ADMIN.data.lists.COL_LABEL_FR'), sortable: true },
      { key: 'labelEn', label: this.translate.instant('ADMIN.data.lists.COL_LABEL_EN'), sortable: true },
      { key: 'isActive', label: this.translate.instant('ADMIN.data.lists.COL_ACTIVE'), sortable: true },
      { key: 'isSystem', label: this.translate.instant('ADMIN.data.lists.COL_SYSTEM'), sortable: true },
      // Only where it means something: a global list has no entity to tell apart.
      ...(this.isPerPaysView()
        ? [{ key: 'scope', label: this.translate.instant('ADMIN.data.lists.COL_SCOPE'), sortable: false }]
        : []),
    ];
  });

  currentPage = signal(0);
  /** Table header sort — applied to the whole filtered list, before paging (`manualSort`). */
  readonly sort = signal<TableSort | null>(null);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredValues().length / PAGE_SIZE)));

  readonly pagedValues = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return sortByColumn(this.filteredValues(), this.sort(), LIST_VALUE_SORT).slice(start, start + PAGE_SIZE);
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedValues().map(v => ({
      valueCode: v.valueCode,
      labelFr:   v.labelFr,
      labelEn:   v.labelEn,
      isActive:  v.isActive,
      isSystem:  v.isSystem,
      _source:   v,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    this.editingId();
    const tr = (k: string) => this.translate.instant(k);
    // A seed read once by the table — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      hoverable: false,
      showHeader: false,
      emptyMessage: this.translate.instant('ADMIN.data.lists.EMPTY_MESSAGE'),
      // Stable row identity: row heights are keyed by it, not by render index.
      rowId: (row: TableRow) => (row['_source'] as ListValue).id,
      resizableColumns:  true,
      resizableRows:     true,
      columnPicker:      true,
      columnPickerLabel: tr('REQUESTS.TABLE.COLUMN_PICKER'),
      showReset:         true,
      resetLabel:        tr('REQUESTS.TABLE.RESET'),
      sortLabel:         tr('REQUESTS.TABLE.SORT_BY'),
      // Rows are one client-side page; this component sorts the whole list (sortByColumn).
      manualSort:        true,
      ...(sort ? { defaultSort: sort } : {}),
      actions: [
        {
          id: 'save', icon: 'check', variant: 'default',
          tooltip: this.translate.instant('ADMIN.data.lists.SAVE'),
          hidden: (row: TableRow) => this.editingId() !== (row['_source'] as ListValue).id,
          disabled: () => this.editForm.invalid,
          onClick: (row: TableRow) => this.saveEdit(row['_source'] as ListValue),
        },
        {
          id: 'cancel', icon: 'close',
          tooltip: this.translate.instant('ADMIN.data.lists.CANCEL'),
          hidden: (row: TableRow) => this.editingId() !== (row['_source'] as ListValue).id,
          onClick: () => this.cancelEdit(),
        },
        {
          id: 'edit', icon: 'edit',
          tooltip: this.translate.instant('ADMIN.data.lists.EDIT'),
          hidden: (row: TableRow) => this.editingId() === (row['_source'] as ListValue).id,
          onClick: (row: TableRow) => this.startEdit(row['_source'] as ListValue),
        },
        {
          id: 'delete', icon: 'delete', variant: 'danger',
          tooltip: this.translate.instant('ADMIN.data.lists.DELETE'),
          hidden: (row: TableRow) => this.editingId() === (row['_source'] as ListValue).id,
          disabled: (row: TableRow) => (row['_source'] as ListValue).isSystem,
          onClick: (row: TableRow) => this.confirmDeleteValue(row['_source'] as ListValue),
        },
      ],
    };
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

  /** Header click (or the reset icon): a new order makes the current page meaningless. */
  onSortChange(key: string, dir: SortDirection): void {
    this.sort.set(toTableSort(key, dir));
    this.currentPage.set(0);
  }

  editForm: FormGroup = this.fb.group({
    labelFr:   ['', Validators.required],
    labelEn:   ['', Validators.required],
    sortOrder: [0],
    isActive:  [true],
  });

  addForm: FormGroup = this.fb.group({
    valueCode: ['', [Validators.required, Validators.maxLength(100)]],
    labelFr:   ['', Validators.required],
    labelEn:   ['', Validators.required],
    sortOrder: [0],
  });

  ngOnInit(): void {
    this.listService.getListTypes().subscribe({
      next: types => {
        this.listTypes.set(types);
        this.loadingTypes.set(false);
        if (types.length) this.selectType(types[0]);
      },
      error: () => { this.error.set(this.translate.instant('ADMIN.data.lists.ERR_LOAD_TYPES')); this.loadingTypes.set(false); },
    });
  }

  selectType(type: ListType): void {
    this.selectedType.set(type);
    this.modalRef?.close();
    this.editingId.set(null);
    this.searchQuery.set('');   // a search typed for one list means nothing in the next
    this.loadValues(type.id);
  }

  openAddForm(): void {
    this.addForm.reset({ sortOrder: 0 });
    this.modalRef = this.modal.open({
      title: this.translate.instant('ADMIN.data.lists.MODAL_ADD_TITLE'),
      body: this.bodyTpl(),
      closeOnBackdrop: false,
    });
  }

  cancelAdd(): void {
    this.modalRef?.close();
  }

  loadValues(id: number): void {
    this.loadingValues.set(true);
    this.currentPage.set(0);
    this.listService.getAllValuesForAdmin(id).subscribe({
      next: vals => { this.values.set(vals); this.loadingValues.set(false); },
      error: () => { this.error.set(this.translate.instant('ADMIN.data.lists.ERR_LOAD_VALUES')); this.loadingValues.set(false); },
    });
  }

  startEdit(value: ListValue): void {
    this.editingId.set(value.id);
    this.editForm.patchValue({
      labelFr: value.labelFr, labelEn: value.labelEn,
      sortOrder: value.sortOrder, isActive: value.isActive,
    });
  }

  cancelEdit(): void { this.editingId.set(null); }

  saveEdit(value: ListValue): void {
    if (this.editForm.invalid) return;
    // No nature sent: the backend keeps the value's current one.
    const dto: UpdateListValueRequest = this.editForm.value;
    this.listService.updateValue(value.id, dto).subscribe({
      next: () => { this.editingId.set(null); this.flash(this.translate.instant('ADMIN.data.lists.MSG_UPDATED')); this.loadValues(value.listTypeId); },
      error: err => this.error.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('ADMIN.data.lists.ERR_GENERIC')),
    });
  }

  /** Same ModalService confirm-dialog convention as the other admin catalog pages. */
  confirmDeleteValue(value: ListValue): void {
    this.modal.open({
      title: this.translate.instant('ADMIN.data.lists.DELETE'),
      body: this.translate.instant('ADMIN.data.lists.CONFIRM_Q'),
      size: 'sm',
      closeOnBackdrop: false,
      buttons: [
        { label: this.translate.instant('ADMIN.data.lists.NO'), variant: 'secondary', action: r => r.close() },
        {
          label: this.translate.instant('ADMIN.data.lists.YES'), variant: 'primary', icon: 'delete',
          action: r => { this.deleteValue(value.id, value.listTypeId); r.close(); },
        },
      ],
    });
  }

  deleteValue(id: number, listTypeId: number): void {
    this.listService.deleteValue(id).subscribe({
      next: () => { this.flash(this.translate.instant('ADMIN.data.lists.MSG_DELETED')); this.loadValues(listTypeId); },
      error: err => {
        this.error.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('ADMIN.data.lists.ERR_DELETE'));
      },
    });
  }

  addValue(): void {
    if (this.addForm.invalid || !this.selectedType()) return;
    const type = this.selectedType()!;
    this.adding.set(true);
    // A per-pays list gets the value for the entity picked in /rh/admin; a global one stays
    // shared (null), as before.
    const paysId = type.isPerPays ? this.paysId() : null;
    // No nature asked here: the backend gives a new contract type the nature of its code
    // (CDD → CDD), else CDI.
    const dto: CreateListValueRequest = { listTypeId: type.id, paysId, ...this.addForm.value };
    this.listService.createValue(dto).subscribe({
      next: () => {
        this.adding.set(false);
        this.modalRef?.close();
        this.addForm.reset({ sortOrder: 0 });
        this.flash(this.translate.instant('ADMIN.data.lists.MSG_ADDED'));
        this.loadValues(type.id);
      },
      error: err => {
        this.adding.set(false);
        this.error.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('ADMIN.data.lists.ERR_CREATE'));
      },
    });
  }

  private flash(msg: string): void {
    this.successMsg.set(msg);
    this.error.set(null);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
