import { Component, Input, OnChanges, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import {
  ButtonComponent, FormFieldComponent, StatusBadgeComponent, PaginationComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
  ModalService, ModalRef,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { InterviewService } from '../candidates/interview.service';
import { InterviewType } from '../candidates/interview.model';

const PAGE_SIZE = 5;

@Component({
  selector: 'app-interview-types-admin',
  standalone: true,
  imports: [
    ButtonComponent, FormFieldComponent,
    StatusBadgeComponent, PaginationComponent, DataTableComponent, DafCellDirective,
    TranslatePipe,
  ],
  template: `
    <div class="ita-wrap">

      <!-- Header -->
      <div class="ita-header">
        <div>
          <h2 class="ita-title">{{ 'ADMIN.docs.interviews.title' | translate }}</h2>
          <p class="ita-sub">{{ 'ADMIN.docs.interviews.subtitle' | translate:{ count: types().length } }}</p>
        </div>
        <daf-button
          [label]="'ADMIN.docs.interviews.newType' | translate"
          variant="teal"
          class="desktop-only"
          [options]="{ iconStart: 'add' }"
          (onClick)="openAdd()" />
        <daf-button
          class="icon-btn-toggle mobile-only"
          title="Nouveau type"
          variant="teal"
          [options]="{ iconStart: 'add', size: 'sm' }"
          (onClick)="openAdd()" />
      </div>

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
        <daf-data-table [columns]="columns()" [rows]="rows()" [config]="tableConfig()">
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
        @if (types().length > 0) {
          <div class="ita-footer">
            <span class="ita-count"><strong>{{ types().length }}</strong> {{ 'ADMIN.docs.interviews.typesWord' | translate }}</span>
            @if (totalPages() > 1) {
              <daf-pagination
                [currentPage]="currentPage()"
                [totalPages]="totalPages()"
                [totalElements]="types().length"
                (pageChange)="onPageChange($event)" />
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .ita-wrap   { width:100% }
    .ita-header { display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px }
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

    .mobile-only { display:none }
    @media (max-width: 640px) {
      .desktop-only { display:none }
      .mobile-only  { display:inline-flex }
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
  readonly totalPages = computed(() => Math.ceil(this.types().length / PAGE_SIZE));

  readonly pagedTypes = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.types().slice(start, start + PAGE_SIZE);
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'orderIndex', label: this.translate.instant('ADMIN.docs.interviews.colOrder'), align: 'center', width: '70px' },
      { key: 'name', label: this.translate.instant('ADMIN.docs.interviews.colName') },
      { key: 'isActive', label: this.translate.instant('ADMIN.docs.interviews.colStatus'), align: 'center', width: '110px' },
    ];
  });

  readonly tableConfig = computed<TableConfig>(() => ({
    hoverable: true,
    loading: this.loading(),
    emptyMessage: this.translate.instant('ADMIN.docs.interviews.tableEmpty'),
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
  }));

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
