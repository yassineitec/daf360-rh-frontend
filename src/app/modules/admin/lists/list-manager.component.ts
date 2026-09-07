import { Component, TemplateRef, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent, CheckboxComponent, DafCellDirective, DataTableComponent,
  FormFieldComponent, TableColumn, TableConfig, TableRow, StatusBadgeComponent,
  PaginationComponent, PaginationConfig, ModalService, ModalRef,
} from '@khalilrebhiitec/daf360';
import { ConfigurableListService } from '../../../core/lists/configurable-list.service';
import {
  CreateListValueRequest, ListType, ListValue, UpdateListValueRequest,
} from '../../../core/lists/configurable-list.model';
import { UserStore } from '../../../core/user.store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-list-manager',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule, DataTableComponent, DafCellDirective,
    ButtonComponent, FormFieldComponent, CheckboxComponent, StatusBadgeComponent,
    PaginationComponent, TranslatePipe,
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
  adding  = signal(false);

  listTypes       = signal<ListType[]>([]);
  selectedType    = signal<ListType | null>(null);
  values          = signal<ListValue[]>([]);
  loadingTypes    = signal(true);
  loadingValues   = signal(false);
  searchQuery     = signal('');
  editingId       = signal<number | null>(null);
  error           = signal<string | null>(null);
  successMsg      = signal<string | null>(null);

  readonly filteredTypes = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.listTypes().filter(t =>
      !q || t.labelFr.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
    );
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'valueCode', label: this.translate.instant('ADMIN.data.lists.COL_CODE') },
      { key: 'labelFr', label: this.translate.instant('ADMIN.data.lists.COL_LABEL_FR') },
      { key: 'labelEn', label: this.translate.instant('ADMIN.data.lists.COL_LABEL_EN') },
      { key: 'isActive', label: this.translate.instant('ADMIN.data.lists.COL_ACTIVE') },
      { key: 'isSystem', label: this.translate.instant('ADMIN.data.lists.COL_SYSTEM') },
    ];
  });

  currentPage = signal(0);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.values().length / PAGE_SIZE)));

  readonly pagedValues = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.values().slice(start, start + PAGE_SIZE);
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
    return {
      hoverable: false,
      showHeader: false,
      emptyMessage: this.translate.instant('ADMIN.data.lists.EMPTY_MESSAGE'),
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
    const dto: CreateListValueRequest = { listTypeId: type.id, paysId: null, ...this.addForm.value };
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
