import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import {
  ButtonComponent, FormFieldComponent, StatusBadgeComponent, PaginationComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalComponent } from '../../shared/modal.component';
import { InterviewService } from '../candidates/interview.service';
import { InterviewType } from '../candidates/interview.model';

const PAGE_SIZE = 5;

@Component({
  selector: 'app-interview-types-admin',
  standalone: true,
  imports: [
    ButtonComponent, FormFieldComponent, ModalComponent,
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

      <!-- Add / Edit modal -->
      <app-modal
        [title]="(editTarget() ? 'ADMIN.docs.interviews.editTitle' : 'ADMIN.docs.interviews.newTypeTitle') | translate"
        [visible]="showModal()"
        [hasFooter]="true"
        (closed)="closeModal()"
      >
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
        <div slot="footer">
          <daf-button [label]="'ADMIN.docs.interviews.cancel' | translate" variant="secondary" (onClick)="closeModal()" />
          <daf-button
            [label]="(saving() ? 'ADMIN.docs.interviews.saving' : (editTarget() ? 'ADMIN.docs.interviews.save' : 'ADMIN.docs.interviews.add')) | translate"
            variant="teal"
            [options]="{ disabled: saving() || !form.name.trim(), loading: saving() }"
            (onClick)="save()" />
        </div>
      </app-modal>

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
          <ng-template dafCell="_actions" let-row>
            <div class="ita-row-actions">
              <daf-button
                class="icon-btn-toggle"
                variant="ghost"
                [options]="{ iconStart: row['_source'].isActive ? 'toggle_on' : 'toggle_off', size: 'sm' }"
                [title]="(row['_source'].isActive ? 'ADMIN.docs.interviews.deactivate' : 'ADMIN.docs.interviews.activate') | translate"
                (onClick)="toggleActive(row['_source'])" />
              <daf-button
                class="icon-btn-edit"
                variant="primary"
                [options]="{ iconStart: 'edit', size: 'sm' }"
                [title]="'ADMIN.docs.interviews.edit' | translate"
                (onClick)="openEdit(row['_source'])" />
            </div>
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
export class InterviewTypesAdminComponent implements OnInit {
  @Input() paysId!: number;

  private svc = inject(InterviewService);
  private translate = inject(TranslateService);

  types      = signal<InterviewType[]>([]);
  loading    = signal(false);
  error      = signal<string | null>(null);

  showModal   = signal(false);
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
      { key: '_actions', label: this.translate.instant('ADMIN.docs.interviews.colActions'), align: 'right', width: '120px' },
    ];
  });

  readonly tableConfig = computed<TableConfig>(() => ({
    hoverable: true,
    loading: this.loading(),
    emptyMessage: this.translate.instant('ADMIN.docs.interviews.tableEmpty'),
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

  ngOnInit(): void { this.load(); }

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
    this.showModal.set(true);
  }

  openEdit(t: InterviewType): void {
    this.editTarget.set(t);
    this.form = { name: t.name, description: t.description ?? '', orderIndex: t.orderIndex };
    this.modalError.set(null);
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); }

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
      next:  () => { this.saving.set(false); this.showModal.set(false); this.load(); },
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
