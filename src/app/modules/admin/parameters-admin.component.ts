import { Component, TemplateRef, computed, inject, input, OnChanges, signal, viewChild } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AdminService }     from './admin.service';
import { ParameterSet }     from './models/admin.model';
import { SpinnerComponent } from '../../shared/spinner.component';
import {
  FormFieldComponent, ButtonComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
  PaginationComponent, PaginationConfig, ModalService, ModalRef,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-parameters-admin',
  standalone: true,
  imports: [
    SpinnerComponent, FormFieldComponent, ButtonComponent, DataTableComponent, DafCellDirective,
    PaginationComponent, TranslatePipe,
  ],
  template: `
    <div class="section-header">
      <div>
        <h3 class="col-title">{{ 'ADMIN.data.parameters.TITLE' | translate }}</h3>
        <p class="col-sub">{{ 'ADMIN.data.parameters.SUBTITLE' | translate }}</p>
      </div>
      <div class="header-actions">
        <!-- Desktop/tablet: full labeled buttons -->
        <daf-button
          [label]="'ADMIN.data.parameters.INIT_DEFAULT' | translate"
          class="desktop-only"
          variant="ghost"
          [options]="{ disabled: seeding(), loading: seeding() }"
          (onClick)="seed()"
        />
        <daf-button class="desktop-only" [label]="'ADMIN.data.parameters.ADD' | translate" variant="teal" (onClick)="startAdd()" />

        <!-- Mobile: icon-only -->
        <daf-button
          class="icon-btn-toggle mobile-only"
          title="Initialiser par défaut"
          variant="ghost"
          [options]="{ iconStart: 'restart_alt', size: 'sm', disabled: seeding(), loading: seeding() }"
          (onClick)="seed()"
        />
        <daf-button
          class="icon-btn-toggle mobile-only"
          title="Ajouter"
          variant="teal"
          [options]="{ iconStart: 'add', size: 'sm' }"
          (onClick)="startAdd()"
        />
      </div>
    </div>

    @if (loading()) { <div class="center"><app-spinner /></div> }
    @else if (params().length === 0) {
      <div class="empty-state">
        <p>{{ 'ADMIN.data.parameters.EMPTY' | translate }}</p>
        <daf-button [label]="'ADMIN.data.parameters.INIT_DEFAULT_VALUES' | translate" variant="ghost" (onClick)="seed()" />
      </div>
    } @else {
      <div class="table-scroll">
      <daf-data-table [columns]="columns()" [rows]="rows()" [config]="tableConfig()">
        <ng-template dafCell="cle" let-row>
          <span class="key-cell">{{ row['_source'].cle }}</span>
        </ng-template>

        <ng-template dafCell="valeur" let-row>
          @if (editingId() === row['_source'].id) {
            <daf-form-field
              [options]="{ fullWidth: true }"
              [value]="editValeur"
              (valueChange)="editValeur = $any($event)"
            />
          } @else {
            <span class="valeur-cell" [title]="row['_source'].valeur">
              {{ row['_source'].valeur.length > 60 ? row['_source'].valeur.slice(0, 60) + '…' : row['_source'].valeur }}
            </span>
          }
        </ng-template>

        <ng-template dafCell="description" let-row>
          <span class="desc-cell">{{ row['_source'].description ?? '—' }}</span>
        </ng-template>

        <ng-template dafCell="updatedAt" let-row>
          <span class="date-cell">{{ fmtDate(row['_source'].updatedAt) }}</span>
        </ng-template>

      </daf-data-table>
      </div>

      @if (totalPages() > 1) {
        <div class="pagination-row">
          <daf-pagination
            [currentPage]="currentPage()"
            [totalPages]="totalPages()"
            [totalElements]="params().length"
            [config]="paginationConfig"
            (pageChange)="onPageChange($event)" />
        </div>
      }
    }

    @if (error()) { <div class="error-banner" role="alert">{{ error() }}</div> }

    <!-- Add modal body — projected into the real daf-modal-host via ModalService. -->
    <ng-template #bodyTpl>
      <div class="modal-form">
        <daf-form-field
          [options]="{ label: ('ADMIN.data.parameters.KEY' | translate), placeholder: ('ADMIN.data.parameters.KEY_PLACEHOLDER' | translate), required: true, fullWidth: true }"
          [value]="newCle"
          (valueChange)="newCle = $any($event)"
        />
        <daf-form-field
          [options]="{ label: ('ADMIN.data.parameters.VALUE' | translate), required: true, fullWidth: true }"
          [value]="newValeur"
          (valueChange)="newValeur = $any($event)"
        />
        <daf-form-field
          [options]="{ label: ('ADMIN.data.parameters.DESCRIPTION' | translate), placeholder: ('ADMIN.data.parameters.OPTIONAL' | translate), fullWidth: true }"
          [value]="newDesc"
          (valueChange)="newDesc = $any($event)"
        />
      </div>
      <div class="modal-footer">
        <daf-button [label]="'ADMIN.data.parameters.CANCEL' | translate" variant="secondary" [options]="{ disabled: adding() }" (onClick)="cancel()" />
        <daf-button
          [label]="'ADMIN.data.parameters.CREATE' | translate"
          variant="teal"
          [options]="{ disabled: !newCle.trim() || !newValeur.trim() || adding(), loading: adding() }"
          (onClick)="add()" />
      </div>
    </ng-template>
  `,
  styles: [`
    .section-header  { display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px }
    .col-title       { font-size:13px;font-weight:700;margin:0 }
    .col-sub         { font-size:12px;color:var(--color-text-muted);margin:2px 0 0 }
    .header-actions  { display:flex;flex-wrap:wrap;gap:8px }
    .center          { display:flex;justify-content:center;padding:24px }
    .table-scroll    { overflow-x:auto }

    .mobile-only { display:none }
    @media (max-width: 640px) {
      .desktop-only { display:none }
      .mobile-only  { display:inline-flex }
    }
    .key-cell        { font-family:monospace;font-size:12px;font-weight:600;color:var(--color-primary);white-space:nowrap }
    .valeur-cell     { font-family:monospace;font-size:12px;color:var(--color-text-muted) }
    .desc-cell       { font-size:12px;color:var(--color-text-muted) }
    .date-cell       { font-size:11px;color:var(--color-text-muted);white-space:nowrap }
    .empty-state     { text-align:center;padding:36px;color:var(--color-text-muted);display:flex;flex-direction:column;align-items:center;gap:12px }
    .empty-state p   { margin:0;font-size:13px }
    .modal-form      { display:flex;flex-direction:column;gap:14px }
    .pagination-row  { display:flex;justify-content:flex-end;padding:10px 0 }
    .error-banner { margin-top:10px;padding:8px 12px;border-radius:8px;background:var(--color-error-container);color:var(--color-on-error-container);font-size:12px }
    .modal-footer { display:flex;justify-content:flex-end;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--color-outline-variant) }
  `],
})
export class ParametersAdminComponent implements OnChanges {
  private svc   = inject(AdminService);
  private modal = inject(ModalService);
  private t     = inject(TranslateService);
  private modalRef?: ModalRef;
  bodyTpl = viewChild.required<TemplateRef<unknown>>('bodyTpl');

  paysId = input(179);

  loading  = signal(false);
  seeding  = signal(false);
  params   = signal<ParameterSet[]>([]);
  error    = signal<string | null>(null);

  editingId = signal<number | null>(null);
  editValeur = '';

  adding   = signal(false);
  newCle   = '';
  newValeur = '';
  newDesc  = '';

  readonly columns = computed<TableColumn[]>(() => {
    this.t.currentLang();
    return [
      { key: 'cle',         label: this.t.instant('ADMIN.data.parameters.KEY') },
      { key: 'valeur',      label: this.t.instant('ADMIN.data.parameters.VALUE') },
      { key: 'description', label: this.t.instant('ADMIN.data.parameters.DESCRIPTION') },
      { key: 'updatedAt',   label: this.t.instant('ADMIN.data.parameters.COL_UPDATED') },
    ];
  });

  currentPage = signal(0);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.params().length / PAGE_SIZE)));

  readonly pagedParams = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.params().slice(start, start + PAGE_SIZE);
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedParams().map(p => ({
      cle:         p.cle,
      valeur:      p.valeur,
      description: p.description,
      updatedAt:   p.updatedAt,
      _source:     p,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => {
    this.t.currentLang();
    return {
      hoverable: true,
      actions: [
        {
          id: 'save', icon: 'check',
          tooltip: this.t.instant('ADMIN.data.parameters.SAVE'),
          hidden: (row: TableRow) => this.editingId() !== (row['_source'] as ParameterSet).id,
          onClick: (row: TableRow) => this.saveEdit(row['_source'] as ParameterSet),
        },
        {
          id: 'cancel', icon: 'close',
          tooltip: this.t.instant('ADMIN.data.parameters.CANCEL'),
          hidden: (row: TableRow) => this.editingId() !== (row['_source'] as ParameterSet).id,
          onClick: () => this.editingId.set(null),
        },
        {
          id: 'edit', icon: 'edit',
          tooltip: this.t.instant('ADMIN.data.parameters.EDIT'),
          hidden: (row: TableRow) => this.editingId() === (row['_source'] as ParameterSet).id,
          onClick: (row: TableRow) => this.startEdit(row['_source'] as ParameterSet),
        },
        {
          id: 'delete', icon: 'delete', variant: 'danger',
          tooltip: this.t.instant('ADMIN.data.parameters.DELETE_SHORT'),
          hidden: (row: TableRow) => this.editingId() === (row['_source'] as ParameterSet).id,
          onClick: (row: TableRow) => this.del(row['_source'] as ParameterSet),
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

  ngOnChanges() { this.load(); }

  private load() {
    this.loading.set(true);
    this.currentPage.set(0);
    this.svc.listParameters(this.paysId()).pipe(catchError(() => of([]))).subscribe(ps => {
      this.params.set(ps);
      this.loading.set(false);
    });
  }

  startEdit(p: ParameterSet) { this.editingId.set(p.id); this.editValeur = p.valeur; }

  saveEdit(p: ParameterSet) {
    this.svc.updateParameter(p.id, { paysId: this.paysId(), cle: p.cle, valeur: this.editValeur, description: p.description ?? undefined })
      .pipe(catchError(err => { this.error.set(err?.error?.message ?? this.t.instant('ADMIN.data.parameters.ERROR')); return of(null); }))
      .subscribe(updated => {
        if (updated) { this.params.update(ps => ps.map(x => x.id === updated.id ? updated : x)); this.editingId.set(null); }
      });
  }

  del(p: ParameterSet) {
    this.modal.open({
      title: this.t.instant('ADMIN.data.parameters.DELETE_TITLE'),
      body:  this.t.instant('ADMIN.data.parameters.DELETE_BODY', { cle: p.cle }),
      buttons: [
        { label: this.t.instant('ADMIN.data.parameters.CANCEL'), variant: 'secondary', action: r => r.close() },
        { label: this.t.instant('ADMIN.data.parameters.DELETE'), variant: 'primary',   action: r => { this.doDelete(p); r.close(); } },
      ],
    });
  }

  private doDelete(p: ParameterSet): void {
    this.svc.deleteParameter(p.id).pipe(catchError(() => of(null))).subscribe(() => {
      this.params.update(ps => ps.filter(x => x.id !== p.id));
    });
  }

  startAdd() {
    this.newCle = ''; this.newValeur = ''; this.newDesc = '';
    this.modalRef = this.modal.open({
      title: this.t.instant('ADMIN.data.parameters.ADD_TITLE'),
      body: this.bodyTpl(),
      closeOnBackdrop: false,
    });
  }

  cancel(): void {
    this.modalRef?.close();
  }

  add() {
    this.adding.set(true);
    this.svc.createParameter({ paysId: this.paysId(), cle: this.newCle.toUpperCase(), valeur: this.newValeur, description: this.newDesc || undefined })
      .pipe(catchError(err => { this.error.set(err?.error?.message ?? this.t.instant('ADMIN.data.parameters.ERROR')); this.adding.set(false); return of(null); }))
      .subscribe(created => {
        if (created) { this.adding.set(false); this.params.update(ps => [...ps, created]); this.modalRef?.close(); }
      });
  }

  seed() {
    this.seeding.set(true);
    this.svc.seedParameters().pipe(catchError(() => of(null))).subscribe(() => { this.seeding.set(false); this.load(); });
  }

  fmtDate(iso: string): string {
    try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return iso; }
  }
}
