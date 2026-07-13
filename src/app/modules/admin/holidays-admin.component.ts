import { Component, computed, effect, inject, input, OnChanges, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AdminService }     from './admin.service';
import { Holiday }          from './models/admin.model';
import { SpinnerComponent } from '../../shared/spinner.component';
import { ModalComponent }   from '../../shared/modal.component';
import { RhSearchBarComponent } from '../../shared/search-bar.component';
import {
  MultiDatePickerComponent,
  FormFieldComponent,
  ToggleComponent,
  ButtonComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
  PaginationComponent, PaginationConfig,
  ModalService,
} from '@khalilrebhiitec/daf360';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-holidays-admin',
  standalone: true,
  imports: [
    SpinnerComponent, ModalComponent, MultiDatePickerComponent,
    FormFieldComponent, ToggleComponent, ButtonComponent,
    DataTableComponent, DafCellDirective, PaginationComponent,
    RhSearchBarComponent,
  ],
  template: `
    <div class="section-header">
      <div>
        <h3 class="col-title">Jours fériés</h3>
        <p class="col-sub">Gestion par entité et par année</p>
      </div>
      <div class="header-actions">
        <div class="search-field">
          <rh-search-bar
            placeholder="Rechercher par nom (fr/en)…"
            [value]="searchQuery()"
            (valueChange)="searchQuery.set($event)"
          />
        </div>
        <daf-button label="+ Ajouter" variant="primary" (onClick)="openAdd()" />
      </div>
    </div>

    @if (loading()) { <div class="center"><app-spinner /></div> }
    @else {
      <!-- List -->
      @if (holidays().length === 0) {
        <div class="empty-state"><p>Aucun jour férié pour {{ selectedYear }}.</p></div>
      } @else {
        <daf-data-table [columns]="columns" [rows]="rows()" [config]="tableConfig()">
          <ng-template dafCell="dateHoliday" let-row>
            <span class="date-td">{{ fmtDate(row['_source'].dateHoliday) }}</span>
          </ng-template>

          <ng-template dafCell="isRecurring" let-row>
            <span class="recur-badge" [class.yes]="row['_source'].isRecurring">
              {{ row['_source'].isRecurring ? 'Oui' : 'Non' }}
            </span>
          </ng-template>

          <ng-template dafCell="_actions" let-row>
            <div class="actions-cell">
              <daf-button class="icon-btn-edit" title="Modifier" variant="ghost" [options]="{ size: 'sm', iconStart: 'edit' }" (onClick)="openEdit(row['_source'])" />
              <daf-button class="icon-btn-delete" title="Suppr." variant="danger" [options]="{ size: 'sm', iconStart: 'delete' }" (onClick)="del(row['_source'])" />
            </div>
          </ng-template>
        </daf-data-table>

        @if (totalPages() > 1) {
          <div class="pagination-row">
            <daf-pagination
              [currentPage]="currentPage()"
              [totalPages]="totalPages()"
              [totalElements]="filteredHolidays().length"
              [config]="paginationConfig"
              (pageChange)="onPageChange($event)" />
          </div>
        }
      }
    }

    <!-- Add/Edit Modal -->
    <app-modal
      [title]="editTarget() ? 'Modifier le jour férié' : 'Nouveau jour férié'"
      [visible]="showModal()"
      [hasFooter]="true"
      (closed)="showModal.set(false)"
    >
      <div class="modal-form">
        <div class="field-row">
          <daf-multi-date-picker
            [value]="holidayPickerValue"
            [config]="{ label: 'Date', selectionMode: 'single', required: true, placeholder: 'Sélectionner une date' }"
            (valueChange)="onHolidayDateChange($event)"
          />
        </div>
        <div class="field-row">
          <daf-form-field
            [options]="{ label: 'Libellé français', required: true, fullWidth: true }"
            [value]="form.frenchLabel"
            (valueChange)="form.frenchLabel = $any($event)"
          />
        </div>
        <div class="field-row">
          <daf-form-field
            [options]="{ label: 'Libellé anglais', required: true, fullWidth: true }"
            [value]="form.englishLabel"
            (valueChange)="form.englishLabel = $any($event)"
          />
        </div>
        <daf-toggle
          [options]="{ label: 'Récurrent (chaque année)' }"
          [checked]="form.isRecurring"
          (checkedChange)="form.isRecurring = $event"
        />
      </div>
      @if (modalError()) { <div class="error-banner" role="alert">{{ modalError() }}</div> }
      <div slot="footer">
        <daf-button label="Annuler" variant="secondary" (onClick)="showModal.set(false)" />
        <daf-button
          [label]="editTarget() ? 'Enregistrer' : 'Créer'"
          variant="teal"
          [options]="{ disabled: !form.dateHoliday || !form.frenchLabel || saving(), loading: saving() }"
          (onClick)="save()"
        />
      </div>
    </app-modal>
  `,
  styles: [`
    .section-header { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px }
    .col-title { font-size:13px;font-weight:700;margin:0 }
    .col-sub   { font-size:12px;color:var(--color-text-muted);margin:2px 0 0 }
    .header-actions { display:flex;gap:8px;align-items:center }
    .search-field   { width:360px }
    .center         { display:flex;justify-content:center;padding:24px }
    .date-td   { font-weight:600;color:var(--color-primary);white-space:nowrap }
    .cell-muted{ color:var(--color-text-muted) }
    .recur-badge { padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;background:var(--color-bg-secondary);color:var(--color-text-muted) }
    .recur-badge.yes { background:#dcfce7;color:var(--color-success) }
    .actions-cell { display:flex;gap:6px }
    .empty-state { text-align:center;padding:36px;color:var(--color-text-muted) }
    .empty-state p { margin:0;font-size:13px }
    .modal-form { display:flex;flex-direction:column;gap:12px }
    .pagination-row { display:flex;justify-content:flex-end;padding:10px 0 }
    .field-row  { display:flex;flex-direction:column;gap:4px }
    .error-banner { margin-top:8px;padding:8px 12px;border-radius:8px;background:var(--color-error-container);color:var(--color-on-error-container);font-size:12px }

    /* daf-data-table purges the dynamically-computed text-right Tailwind class from its
       own build — force the centered Actions column ourselves. */
    :host ::ng-deep daf-data-table {
      th:last-child { text-align: center !important; }
      td:last-child { display:flex;justify-content:center;align-items:center;gap:6px; }
    }
  `],
})
export class HolidaysAdminComponent implements OnChanges {
  private svc   = inject(AdminService);
  private modal = inject(ModalService);

  paysId    = input(179);
  paysLabel = input('—');

  loading    = signal(false);
  saving     = signal(false);
  holidays   = signal<Holiday[]>([]);
  showModal  = signal(false);
  editTarget = signal<Holiday | null>(null);
  modalError = signal<string | null>(null);
  searchQuery = signal('');
  selectedYear = new Date().getFullYear();

  readonly columns: TableColumn[] = [
    { key: 'id',           label: 'ID',                    width: '70px' },
    { key: 'name',         label: 'Nom' },
    { key: 'pays',         label: 'Pays' },
    { key: 'dateHoliday',  label: 'Date du jour férié' },
    { key: 'isRecurring',  label: 'Récurrent' },
    { key: '_actions',     label: 'Actions', align: 'right' },
  ];

  readonly filteredHolidays = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.holidays();
    return this.holidays().filter(h =>
      h.frenchLabel.toLowerCase().includes(q) || h.englishLabel.toLowerCase().includes(q)
    );
  });

  currentPage = signal(0);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredHolidays().length / PAGE_SIZE)));

  readonly pagedHolidays = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.filteredHolidays().slice(start, start + PAGE_SIZE);
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedHolidays().map(h => ({
      id:          h.id,
      name:        h.frenchLabel,
      pays:        this.paysLabel(),
      dateHoliday: h.dateHoliday,
      isRecurring: h.isRecurring,
      _source:     h,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => ({
    hoverable: true,
    emptyMessage: 'Aucun jour férié ne correspond à la recherche.',
  }));

  readonly paginationConfig: PaginationConfig = {
    showFirstLast: true,
    showPrevNext:  true,
    maxVisible:    5,
    size:          'sm',
  };

  private resetPageOnFilterChange = effect(() => {
    this.filteredHolidays();
    this.currentPage.set(0);
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  readonly String = String;

  form = { dateHoliday: '', frenchLabel: '', englishLabel: '', isRecurring: false };

  ngOnChanges() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.listHolidays(this.paysId(), this.selectedYear).pipe(catchError(() => of([]))).subscribe(hs => {
      this.holidays.set(hs);
      this.loading.set(false);
    });
  }

  fmtDate(iso: string): string {
    try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return iso; }
  }

  get holidayPickerValue(): Date | null {
    return this.form.dateHoliday ? new Date(this.form.dateHoliday + 'T00:00:00') : null;
  }

  onHolidayDateChange(v: Date | Date[] | null): void {
    this.form.dateHoliday = v instanceof Date ? v.toISOString().substring(0, 10) : '';
  }

  openAdd()  { this.editTarget.set(null); this.form = { dateHoliday: '', frenchLabel: '', englishLabel: '', isRecurring: false }; this.showModal.set(true); this.modalError.set(null); }
  openEdit(h: Holiday) { this.editTarget.set(h); this.form = { dateHoliday: h.dateHoliday, frenchLabel: h.frenchLabel, englishLabel: h.englishLabel, isRecurring: h.isRecurring }; this.showModal.set(true); this.modalError.set(null); }

  save() {
    this.saving.set(true);
    const dto = { paysId: this.paysId(), ...this.form };
    const obs = this.editTarget()
      ? this.svc.updateHoliday(this.editTarget()!.id, dto)
      : this.svc.createHoliday(dto);

    obs.pipe(catchError(err => { this.modalError.set(err?.error?.message ?? 'Erreur'); this.saving.set(false); return of(null); }))
      .subscribe(result => {
        this.saving.set(false);
        if (result) { this.showModal.set(false); this.load(); }
      });
  }

  del(h: Holiday) {
    this.modal.open({
      title: 'Supprimer le jour férié',
      body: `Voulez-vous vraiment supprimer "${h.frenchLabel}" ? Cette action est irréversible.`,
      size: 'sm',
      closeOnBackdrop: false,
      buttons: [
        { label: 'Annuler', variant: 'secondary', action: r => r.close() },
        {
          label: 'Supprimer', variant: 'primary', icon: 'delete',
          action: r => {
            this.svc.deleteHoliday(h.id).pipe(catchError(() => of(null))).subscribe(() => {
              this.holidays.update(hs => hs.filter(x => x.id !== h.id));
            });
            r.close();
          },
        },
      ],
    });
  }
}
