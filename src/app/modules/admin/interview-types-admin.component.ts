import { Component, Input, OnChanges, TemplateRef, computed, inject, signal, untracked, viewChild } from '@angular/core';
import {
  ButtonComponent, FormFieldComponent, StatusBadgeComponent, PaginationComponent,
  DataTableComponent, DafCellDirective, SortDirection, TableColumn, TableConfig, TableRow,
  ModalService, ModalRef, SearchToolbarComponent,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { InterviewService } from '../candidates/interview.service';
import { InterviewType } from '../candidates/interview.model';
import { TableSort, searchRows, sortByColumn, toTableSort } from '../../shared/table-sort.utils';

const PAGE_SIZE = 5;

/** What each interview-type column sorts on. No sort = the stored order (`orderIndex`). */
const INTERVIEW_TYPE_SORT: Record<string, (t: InterviewType) => string | number | null> = {
  orderIndex: t => t.orderIndex ?? null,
  name:       t => t.name || null,
  isActive:   t => (t.isActive ? 1 : 0),   // inactive first on an ascending sort
};

@Component({
  selector: 'app-interview-types-admin',
  standalone: true,
  imports: [
    ButtonComponent, FormFieldComponent,
    StatusBadgeComponent, PaginationComponent, DataTableComponent, DafCellDirective,
    SearchToolbarComponent, TranslatePipe,
  ],
  template: `
    <div class="ita-wrap">

      <!-- Header -->
      <div class="ita-header">
        <h2 class="ita-title">{{ 'ADMIN.docs.interviews.title' | translate }}</h2>
        <p class="ita-sub">{{ 'ADMIN.docs.interviews.subtitle' | translate:{ count: types().length } }}</p>
      </div>

      <!-- Same bar as the other lists: search, "Nouveau type", and [table] puts the
           table's reset + column picker on the right. -->
      <daf-search-toolbar class="mb-4 block"
        [placeholder]="'REQUESTS.TABLE.SEARCH' | translate"
        [value]="searchQuery()"
        [debounce]="200"
        (valueChange)="onSearch($event)"
        [table]="itaTable() ?? null">
        <daf-button
          [label]="'ADMIN.docs.interviews.newType' | translate"
          variant="teal"
          [options]="{ iconStart: 'add' }"
          (onClick)="openAdd()" />
      </daf-search-toolbar>

      <!-- Global error -->
      @if (error()) {
        <div class="ita-error">{{ error() }}</div>
      }

      <!-- Add / Edit modal body — projected into the real daf-modal-host via ModalService. -->
      <ng-template #bodyTpl>
        <div class="ita-form-grid">
          <daf-form-field
            [options]="{ label: ('ADMIN.docs.interviews.nameLabel' | translate), placeholder: ('ADMIN.docs.interviews.namePlaceholder' | translate), maxLength: 150, fullWidth: true }"
            [value]="form.name"
            (valueChange)="form.name = $any($event) ?? ''" />
          <daf-form-field
            [options]="{ label: ('ADMIN.docs.interviews.orderLabel' | translate), type: 'number', fullWidth: true }"
            [value]="form.orderIndex"
            (valueChange)="form.orderIndex = $event === null || $event === '' ? 0 : +$event" />
          <div style="grid-column:1/-1">
            <daf-form-field
              [options]="{ label: ('ADMIN.docs.interviews.descriptionLabel' | translate), type: 'textarea', rows: 2, placeholder: ('ADMIN.docs.interviews.descriptionPlaceholder' | translate), maxLength: 500, fullWidth: true }"
              [value]="form.description"
              (valueChange)="form.description = $any($event) ?? ''" />
          </div>
        </div>
        @if (modalError()) {
          <p class="ita-field-error">{{ modalError() }}</p>
        }
        <div class="ita-modal-footer">
          <daf-button [label]="'ADMIN.docs.interviews.cancel' | translate" variant="secondary" (onClick)="cancel()" />
          <daf-button
            [label]="(saving() ? 'ADMIN.docs.interviews.saving' : (editTarget() ? 'ADMIN.docs.interviews.save' : 'ADMIN.docs.interviews.add')) | translate"
            variant="teal"
            [options]="{ disabled: saving() || !form.name.trim(), loading: saving() }"
            (onClick)="save()" />
        </div>
      </ng-template>

      <!-- List -->
      @if (types().length === 0 && !loading()) {
        <p class="ita-empty">{{ 'ADMIN.docs.interviews.empty' | translate }}</p>
      } @else {
        <div class="table-scroll">
        <daf-data-table #itaTable [columns]="columns()" [rows]="rows()" [config]="tableConfig()"
                        (sortChange)="onSortChange($event.key, $event.dir)"
                        (resetClick)="onSortChange('', null)">
          <ng-template dafCell="name" let-row>
            <div class="ita-row-name">{{ row['name'] }}</div>
            @if (row['description']) {
              <div class="ita-row-desc">{{ row['description'] }}</div>
            }
          </ng-template>
          <ng-template dafCell="isActive" let-row>
            <daf-badge
              [label]="(row['isActive'] ? 'ADMIN.docs.interviews.active' : 'ADMIN.docs.interviews.inactive') | translate"
              [options]="{ variant: row['isActive'] ? 'success' : 'neutral', size: 'sm' }" />
          </ng-template>
        </daf-data-table>
        </div>

        <!-- Count + Pagination -->
        @if (filteredTypes().length > 0) {
          <div class="ita-footer">
            <span class="ita-count"><strong>{{ filteredTypes().length }}</strong> {{ 'ADMIN.docs.interviews.typesWord' | translate }}</span>
            @if (totalPages() > 1) {
              <daf-pagination
                [currentPage]="currentPage()"
                [totalPages]="totalPages()"
                [totalElements]="filteredTypes().length"
                (pageChange)="onPageChange($event)" />
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .ita-wrap   { width:100% }
    .ita-header { margin-bottom:20px }
    .ita-title  { font-size:var(--text-headline-md);font-weight:600;color:var(--color-on-surface);margin:0 }
    .ita-sub    { font-size:var(--text-body-sm);color:var(--color-on-surface-variant);margin:3px 0 0 }
    .ita-form-grid  { display:grid;grid-template-columns:1fr 120px;gap:12px }
    .ita-field-error { font-size:var(--text-body-sm);color:var(--color-danger);margin:8px 0 0 }
    .ita-modal-footer { display:flex;justify-content:flex-end;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--color-outline-variant) }
    .ita-error  { background:var(--color-error-container);border:1px solid var(--color-error-container);border-radius:8px;padding:10px 14px;font-size:var(--text-body-sm);color:var(--color-on-error-container);margin-bottom:14px }
    .ita-row-name { font-size:var(--text-body-sm);font-weight:600;color:var(--color-on-surface) }
    .ita-row-desc { font-size:var(--text-body-sm);color:var(--color-on-surface-variant);margin-top:1px }
    .ita-row-actions { display:flex;align-items:center;gap:8px;justify-content:flex-end }
    .ita-empty  { font-size:var(--text-body-sm);color:var(--color-outline);text-align:center;padding:24px }
    .ita-footer { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px }
    .ita-count  { font-size:var(--text-body-sm);color:var(--color-on-surface-variant) }
    .table-scroll { overflow-x:auto }

    @media (max-width: 480px) {
      .ita-form-grid { grid-template-columns:1fr }
    }
  `],
})
export class InterviewTypesAdminComponent implements OnChanges {
  @Input() paysId!: number;

  private svc = inject(InterviewService);
  private translate = inject(TranslateService);
  private modal = inject(ModalService);
  private modalRef?: ModalRef;
  bodyTpl = viewChild.required<TemplateRef<unknown>>('bodyTpl');

  types      = signal<InterviewType[]>([]);
  loading    = signal(false);
  error      = signal<string | null>(null);

  editTarget  = signal<InterviewType | null>(null);
  saving      = signal(false);
  modalError  = signal<string | null>(null);

  form = { name: '', description: '', orderIndex: 1 };

  // Pagination — 5 per page
  currentPage = signal(0);
  /** Table header sort — applied to the whole list, before paging (`manualSort`). */
  readonly sort = signal<TableSort | null>(null);
  /** Toolbar search text — filters the whole list, before sorting and paging. */
  readonly searchQuery = signal('');

  /** The table (absent when the list is empty) — handed to the toolbar's `[table]`. */
  readonly itaTable = viewChild<DataTableComponent>('itaTable');

  /** New search → back to the first page (otherwise one can sit on an empty page). */
  onSearch(value: string): void {
    if (value === this.searchQuery()) return;
    this.searchQuery.set(value);
    this.currentPage.set(0);
  }

  readonly filteredTypes = computed(() => {
    this.translate.currentLang();
    return searchRows(this.types(), this.searchQuery(), t => [
      t.orderIndex, t.name, t.description,
      this.translate.instant(t.isActive ? 'ADMIN.docs.interviews.active' : 'ADMIN.docs.interviews.inactive'),
    ]);
  });

  readonly totalPages = computed(() => Math.ceil(this.filteredTypes().length / PAGE_SIZE));

  readonly pagedTypes = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return sortByColumn(this.filteredTypes(), this.sort(), INTERVIEW_TYPE_SORT).slice(start, start + PAGE_SIZE);
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  /** Header click (or the reset icon): a new order makes the current page meaningless. */
  onSortChange(key: string, dir: SortDirection): void {
    this.sort.set(toTableSort(key, dir));
    this.currentPage.set(0);
  }

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'orderIndex', label: this.translate.instant('ADMIN.docs.interviews.colOrder'), align: 'center', width: '70px', sortable: true },
      { key: 'name', label: this.translate.instant('ADMIN.docs.interviews.colName'), sortable: true },
      { key: 'isActive', label: this.translate.instant('ADMIN.docs.interviews.colStatus'), align: 'center', width: '110px', sortable: true },
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
    loading: this.loading(),
    emptyMessage: this.translate.instant('ADMIN.docs.interviews.tableEmpty'),
    // Stable row identity: row heights are keyed by it, not by render index.
    rowId: (row: TableRow) => (row['_source'] as InterviewType).id,
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
        tooltip: this.translate.instant('ADMIN.docs.interviews.edit'),
        onClick: (row: TableRow) => this.openEdit(row['_source'] as InterviewType),
      },
      {
        id: 'deactivate', icon: 'toggle_on',
        tooltip: this.translate.instant('ADMIN.docs.interviews.deactivate'),
        hidden: (row: TableRow) => !(row['_source'] as InterviewType).isActive,
        onClick: (row: TableRow) => this.toggleActive(row['_source'] as InterviewType),
      },
      {
        id: 'activate', icon: 'toggle_off',
        tooltip: this.translate.instant('ADMIN.docs.interviews.activate'),
        hidden: (row: TableRow) => (row['_source'] as InterviewType).isActive,
        onClick: (row: TableRow) => this.toggleActive(row['_source'] as InterviewType),
      },
    ],
    };
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedTypes().map(t => ({
      orderIndex: t.orderIndex,
      name: t.name,
      description: t.description,
      isActive: t.isActive,
      _source: t,
    })),
  );

  ngOnChanges(): void { this.load(); }

  private load(): void {
    this.loading.set(true);
    this.currentPage.set(0);
    this.svc.getTypes().subscribe({
      next:  t  => { this.types.set(t); this.loading.set(false); },
      error: () => { this.error.set(this.translate.instant('ADMIN.docs.interviews.loadError')); this.loading.set(false); },
    });
  }

  openAdd(): void {
    const maxOrder = this.types().reduce((m, t) => Math.max(m, t.orderIndex), 0);
    this.editTarget.set(null);
    this.form = { name: '', description: '', orderIndex: maxOrder + 1 };
    this.modalError.set(null);
    this.openModal(this.translate.instant('ADMIN.docs.interviews.newTypeTitle'));
  }

  openEdit(t: InterviewType): void {
    this.editTarget.set(t);
    this.form = { name: t.name, description: t.description ?? '', orderIndex: t.orderIndex };
    this.modalError.set(null);
    this.openModal(this.translate.instant('ADMIN.docs.interviews.editTitle'));
  }

  private openModal(title: string): void {
    this.modalRef = this.modal.open({ title, body: this.bodyTpl(), closeOnBackdrop: false });
  }

  cancel(): void {
    this.modalRef?.close();
  }

  save(): void {
    if (!this.form.name.trim()) { this.modalError.set(this.translate.instant('ADMIN.docs.interviews.nameRequired')); return; }
    this.saving.set(true);
    this.modalError.set(null);

    const target = this.editTarget();
    const dto = {
      name: this.form.name.trim(),
      description: this.form.description.trim() || undefined,
      orderIndex: this.form.orderIndex,
    };

    const obs = target
      ? this.svc.updateType(target.id, dto)
      : this.svc.createType({ paysId: this.paysId, ...dto });

    obs.subscribe({
      next:  () => { this.saving.set(false); this.modalRef?.close(); this.load(); },
      error: err => {
        this.saving.set(false);
        this.modalError.set(err?.error?.detail ?? this.translate.instant('ADMIN.docs.interviews.saveError'));
      },
    });
  }

  toggleActive(t: InterviewType): void {
    this.error.set(null);
    const obs = t.isActive ? this.svc.deactivateType(t.id) : this.svc.activateType(t.id);
    obs.subscribe({
      next:  updated => this.types.update(list => list.map(x => x.id === updated.id ? updated : x)),
      error: err     => this.error.set(err?.error?.detail ?? this.translate.instant('ADMIN.docs.interviews.toggleError')),
    });
  }
}
