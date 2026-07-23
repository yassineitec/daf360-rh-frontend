import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent, CheckboxComponent, DafCellDirective, DataTableComponent,
  FormFieldComponent, TableColumn, TableConfig, TableRow, StatusBadgeComponent,
  PaginationComponent, PaginationConfig,
} from '@khalilrebhiitec/daf360';
import { ModalComponent } from '../../../shared/modal.component';
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
    ButtonComponent, FormFieldComponent, CheckboxComponent, ModalComponent, StatusBadgeComponent,
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

  listTypes       = signal<ListType[]>([]);
  selectedType    = signal<ListType | null>(null);
  values          = signal<ListValue[]>([]);
  loadingTypes    = signal(true);
  loadingValues   = signal(false);
  searchQuery     = signal('');
  editingId       = signal<number | null>(null);
  showAddForm     = signal(false);
  error           = signal<string | null>(null);
  successMsg      = signal<string | null>(null);
  confirmDeleteId = signal<number | null>(null);

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
      { key: '_actions', label: this.translate.instant('ADMIN.data.lists.COL_ACTIONS'), align: 'right', width: '120px' },
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
    return {
      hoverable: false,
      showHeader: false,
      emptyMessage: this.translate.instant('ADMIN.data.lists.EMPTY_MESSAGE'),
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
    this.showAddForm.set(false);
    this.editingId.set(null);
    this.loadValues(type.id);
  }

  openAddForm(): void {
    this.addForm.reset({ sortOrder: 0 });
    this.showAddForm.set(true);
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

  confirmDelete(id: number): void { this.confirmDeleteId.set(id); }
  cancelDelete(): void { this.confirmDeleteId.set(null); }

  deleteValue(id: number, listTypeId: number): void {
    this.listService.deleteValue(id).subscribe({
      next: () => { this.confirmDeleteId.set(null); this.flash(this.translate.instant('ADMIN.data.lists.MSG_DELETED')); this.loadValues(listTypeId); },
      error: err => {
        this.confirmDeleteId.set(null);
        this.error.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('ADMIN.data.lists.ERR_DELETE'));
      },
    });
  }

  addValue(): void {
    if (this.addForm.invalid || !this.selectedType()) return;
    const type = this.selectedType()!;
    const dto: CreateListValueRequest = { listTypeId: type.id, paysId: null, ...this.addForm.value };
    this.listService.createValue(dto).subscribe({
      next: () => { this.showAddForm.set(false); this.addForm.reset({ sortOrder: 0 }); this.flash(this.translate.instant('ADMIN.data.lists.MSG_ADDED')); this.loadValues(type.id); },
      error: err => this.error.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('ADMIN.data.lists.ERR_CREATE')),
    });
  }

  private flash(msg: string): void {
    this.successMsg.set(msg);
    this.error.set(null);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
