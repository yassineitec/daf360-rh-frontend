import { Component, TemplateRef, computed, effect, inject, input, OnChanges, signal, viewChild } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AdminService }     from './admin.service';
import { Holiday }          from './models/admin.model';
import { SpinnerComponent } from '../../shared/spinner.component';
import { RhSearchBarComponent } from '../../shared/search-bar.component';
import { HolidayCalendarComponent } from './holiday-calendar.component';
import { RefDataService } from '../../core/ref/ref-data.service';
import { PaysTimezone } from '../../core/ref/ref-data.model';
import { UserStore } from '../../core/user.store';
import {
  MultiDatePickerComponent,
  FormFieldComponent,
  ToggleComponent,
  ButtonComponent,
  SelectComponent, SelectOption,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
  PaginationComponent, PaginationConfig,
  ModalService, ModalRef,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-holidays-admin',
  standalone: true,
  imports: [
    SpinnerComponent, MultiDatePickerComponent, HolidayCalendarComponent,
    FormFieldComponent, ToggleComponent, ButtonComponent, SelectComponent,
    DataTableComponent, DafCellDirective, PaginationComponent,
    RhSearchBarComponent,
    TranslatePipe,
  ],
  template: `
    <div class="section-header">
      <div>
        <h3 class="col-title">{{ 'ADMIN.catalog.holidays.title' | translate }}</h3>
        <p class="col-sub">{{ 'ADMIN.catalog.holidays.subtitle' | translate }}</p>
      </div>
      <div class="header-actions">

        <!-- Table / Calendar view toggle — same daf-button pill-toggle pattern as regime-overview's source filters. -->
        <div class="view-toggle">
          <daf-button
            [title]="'ADMIN.catalog.holidays.viewTable' | translate"
            variant="toggle"
            [options]="{ active: viewMode() === 'table', pill: true, size: 'sm', iconStart: 'table_rows' }"
            (onClick)="viewMode.set('table')" />
          <daf-button
            [title]="'ADMIN.catalog.holidays.viewCalendar' | translate"
            variant="toggle"
            [options]="{ active: viewMode() === 'calendar', pill: true, size: 'sm', iconStart: 'calendar_month' }"
            (onClick)="viewMode.set('calendar')" />
        </div>

        <!-- Desktop/tablet: full search box + labeled button -->
        <div class="search-field desktop-only">
          <rh-search-bar
            [placeholder]="'ADMIN.catalog.holidays.searchPlaceholder' | translate"
            [value]="searchQuery()"
            (valueChange)="searchQuery.set($event)"
          />
        </div>
        <daf-button class="desktop-only" [label]="'ADMIN.catalog.holidays.add' | translate" variant="teal" (onClick)="openAdd()" />

        <!-- Mobile, search open: input takes the row, icon becomes "close" in place -->
        @if (mobileSearchOpen()) {
          <div class="search-field mobile-only mobile-search-open">
            <rh-search-bar
              placeholder="Rechercher par nom (fr/en)…"
              [value]="searchQuery()"
              (valueChange)="searchQuery.set($event)"
            />
          </div>
          <daf-button
            class="icon-btn-toggle mobile-only"
            title="Fermer la recherche"
            [options]="{ iconStart: 'close', variant: 'teal', size: 'sm' }"
            (onClick)="mobileSearchOpen.set(false)" />
        } @else {
          <daf-button
            class="icon-btn-toggle mobile-only"
            title="Rechercher"
            [options]="{ iconStart: 'search', variant: 'ghost', size: 'sm' }"
            (onClick)="mobileSearchOpen.set(true)" />
          <daf-button
            class="icon-btn-toggle mobile-only"
            title="Ajouter"
            [options]="{ iconStart: 'add', variant: 'teal', size: 'sm' }"
            (onClick)="openAdd()" />
        }
      </div>
    </div>

    @if (loading()) { <div class="center"><app-spinner /></div> }
    @else if (viewMode() === 'calendar') {
      <!-- Calendar view — month-grid, same visual language as the portal's /home calendar.
           Clicking an empty date opens "Ajouter" prefilled with that date; clicking an
           already-marked day opens it directly for editing. -->
      <div class="calendar-wrap">
        <app-holiday-calendar
          [holidays]="holidays()"
          [paysIsoCode]="paysIsoCode()"
          (dayClick)="onCalendarDayClick($event)"
          (holidayClick)="openEdit($event)"
        />
      </div>
    } @else {
      <!-- List -->
      @if (holidays().length === 0) {
        <div class="empty-state"><p>{{ 'ADMIN.catalog.holidays.empty' | translate:{ year: selectedYear } }}</p></div>
      } @else {
        <!-- Real daf-data-table, same convention as the other admin catalog pages. -->
        <div class="table-scroll">
        <daf-data-table [columns]="columns()" [rows]="rows()" [config]="tableConfig()">
          <ng-template dafCell="dateHoliday" let-row>
            <span class="date-td">{{ fmtDate(row['_source'].dateHoliday) }}</span>
          </ng-template>

          <ng-template dafCell="isRecurring" let-row>
            <span class="recur-badge" [class.yes]="row['_source'].isRecurring">
              {{ (row['_source'].isRecurring ? 'ADMIN.catalog.holidays.recurringYes' : 'ADMIN.catalog.holidays.recurringNo') | translate }}
            </span>
          </ng-template>

        </daf-data-table>
        </div>

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

    <!-- Add/Edit Modal body — projected into the real daf-modal-host via ModalService.
         Footer lives in here too since ModalConfig.buttons can't react to saving() / form. -->
    <ng-template #bodyTpl>
      <div class="modal-form">
        @if (isSuperAdmin()) {
          <!-- Super admin only: pick which country this holiday belongs to, instead of the
               connected admin's own pays. -->
          <div class="field-row">
            <daf-select
              [selected]="selectedPaysSelected()"
              [options]="paysOptions()"
              [config]="{ label: ('ADMIN.catalog.holidays.colCountry' | translate), required: true, fullWidth: true }"
              (selectedChange)="onPaysChange($event)"
            />
          </div>
        }
        <div class="field-row">
          <daf-multi-date-picker
            [value]="holidayPickerValue"
            [config]="{ label: ('ADMIN.catalog.holidays.fieldDate' | translate), selectionMode: 'single', required: true, placeholder: ('ADMIN.catalog.holidays.datePlaceholder' | translate) }"
            (valueChange)="onHolidayDateChange($event)"
          />
        </div>
        <div class="field-row">
          <daf-form-field
            [options]="{ label: ('ADMIN.catalog.holidays.fieldLabelFr' | translate), required: true, fullWidth: true }"
            [value]="form.frenchLabel"
            (valueChange)="form.frenchLabel = $any($event)"
          />
        </div>
        <div class="field-row">
          <daf-form-field
            [options]="{ label: ('ADMIN.catalog.holidays.fieldLabelEn' | translate), required: true, fullWidth: true }"
            [value]="form.englishLabel"
            (valueChange)="form.englishLabel = $any($event)"
          />
        </div>
        <daf-toggle
          [options]="{ label: ('ADMIN.catalog.holidays.toggleRecurring' | translate) }"
          [checked]="form.isRecurring"
          (checkedChange)="form.isRecurring = $event"
        />
      </div>
      @if (modalError()) { <div class="error-banner" role="alert">{{ modalError() }}</div> }
      <div class="modal-footer">
        <daf-button [label]="'ADMIN.catalog.holidays.cancel' | translate" variant="secondary" (onClick)="cancel()" />
        <daf-button
          [label]="(editTarget() ? 'ADMIN.catalog.holidays.save' : 'ADMIN.catalog.holidays.create') | translate"
          variant="teal"
          [options]="{ disabled: !form.dateHoliday || !form.frenchLabel || saving() || (isSuperAdmin() && !selectedPaysId()), loading: saving() }"
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
    .view-toggle    { display:flex;gap:4px }
    .search-field   { width:360px;max-width:100% }
    .center         { display:flex;justify-content:center;padding:24px }
    .calendar-wrap  { width:100%;padding:8px 0 }

    .table-scroll   { overflow-x:auto }

    .mobile-only { display:none }
    @media (max-width: 640px) {
      .desktop-only { display:none }
      .mobile-only  { display:inline-flex }
      .mobile-search-open { display:block;flex:1;min-width:0 }
      .header-actions { flex:1 }
    }
    .date-td   { font-weight:600;color:var(--color-primary);white-space:nowrap }
    .recur-badge { padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;background:var(--color-bg-secondary);color:var(--color-text-muted) }
    .recur-badge.yes { background:#dcfce7;color:var(--color-success) }
    .empty-state { text-align:center;padding:36px;color:var(--color-text-muted) }
    .empty-state p { margin:0;font-size:13px }
    .modal-form { display:flex;flex-direction:column;gap:12px }
    .pagination-row { display:flex;justify-content:flex-end;padding:10px 0 }
    .field-row  { display:flex;flex-direction:column;gap:4px }
    .error-banner { margin-top:8px;padding:8px 12px;border-radius:8px;background:var(--color-error-container);color:var(--color-on-error-container);font-size:12px }
    .modal-footer { display:flex;justify-content:flex-end;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--color-outline-variant) }
  `],
})
export class HolidaysAdminComponent implements OnChanges {
  private svc      = inject(AdminService);
  private modal    = inject(ModalService);
  private translate = inject(TranslateService);
  private refData  = inject(RefDataService);
  private userStore = inject(UserStore);

  paysId    = input(179);
  paysLabel = input('—');
  paysIsoCode = input('');

  readonly isSuperAdmin = this.userStore.isSuperAdmin;
  availablePays = signal<PaysTimezone[]>([]);
  selectedPaysId = signal<number | null>(null);

  readonly paysOptions = computed<SelectOption[]>(() =>
    this.availablePays().map(p => ({ value: String(p.id), label: p.frenchLabel })));

  selectedPaysSelected(): string[] {
    return this.selectedPaysId() ? [String(this.selectedPaysId())] : [];
  }

  onPaysChange(value: string[]): void {
    this.selectedPaysId.set(value[0] ? Number(value[0]) : null);
  }

  loading    = signal(false);
  saving     = signal(false);
  holidays   = signal<Holiday[]>([]);
  editTarget = signal<Holiday | null>(null);
  modalError = signal<string | null>(null);

  private modalRef?: ModalRef;
  bodyTpl = viewChild.required<TemplateRef<unknown>>('bodyTpl');
  searchQuery = signal('');
  mobileSearchOpen = signal(false);
  selectedYear = new Date().getFullYear();
  viewMode = signal<'table' | 'calendar'>('table');

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

  readonly paginationConfig: PaginationConfig = {
    showFirstLast: true,
    showPrevNext:  true,
    maxVisible:    5,
    size:          'sm',
  };

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'dateHoliday', label: this.translate.instant('ADMIN.catalog.holidays.colDate') },
      { key: 'frenchLabel', label: this.translate.instant('ADMIN.catalog.holidays.colName') },
      { key: 'pays',        label: this.translate.instant('ADMIN.catalog.holidays.colCountry') },
      { key: 'isRecurring', label: this.translate.instant('ADMIN.catalog.holidays.colRecurring') },
    ];
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedHolidays().map(h => ({
      dateHoliday: h.dateHoliday,
      frenchLabel: h.frenchLabel,
      pays:        this.paysLabel(),
      isRecurring: h.isRecurring,
      _source:     h,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      hoverable: true,
      actions: [
        {
          id: 'edit', icon: 'edit',
          tooltip: this.translate.instant('ADMIN.catalog.holidays.actionEdit'),
          onClick: (row: TableRow) => this.openEdit(row['_source'] as Holiday),
        },
        {
          id: 'delete', icon: 'delete', variant: 'danger',
          tooltip: this.translate.instant('ADMIN.catalog.holidays.actionDelete'),
          onClick: (row: TableRow) => this.del(row['_source'] as Holiday),
        },
      ],
    };
  });

  private resetPageOnFilterChange = effect(() => {
    this.filteredHolidays();
    this.currentPage.set(0);
  });

  constructor() {
    if (this.isSuperAdmin()) {
      this.refData.getPaysTimezones().subscribe(list => this.availablePays.set(list));
    }
  }

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

  /** `toISOString()` converts to UTC first, which shifts back a day in any timezone ahead
      of UTC (e.g. picking Sept 2 in UTC+1 would save Sept 1) — build the ISO string from
      the Date's own local fields instead. */
  private toLocalIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  onHolidayDateChange(v: Date | Date[] | null): void {
    this.form.dateHoliday = v instanceof Date ? this.toLocalIso(v) : '';
  }

  openAdd(prefillDate?: string) {
    this.editTarget.set(null);
    this.form = { dateHoliday: prefillDate ?? '', frenchLabel: '', englishLabel: '', isRecurring: false };
    this.selectedPaysId.set(this.paysId());
    this.modalError.set(null);
    this.openModal(this.translate.instant('ADMIN.catalog.holidays.modalTitleNew'));
  }

  onCalendarDayClick(date: Date): void {
    this.openAdd(this.toLocalIso(date));
  }

  openEdit(h: Holiday) {
    this.editTarget.set(h);
    this.form = { dateHoliday: h.dateHoliday, frenchLabel: h.frenchLabel, englishLabel: h.englishLabel, isRecurring: h.isRecurring };
    this.selectedPaysId.set(h.paysId);
    this.modalError.set(null);
    this.openModal(this.translate.instant('ADMIN.catalog.holidays.modalTitleEdit'));
  }

  private openModal(title: string): void {
    this.modalRef = this.modal.open({ title, body: this.bodyTpl(), closeOnBackdrop: false });
  }

  cancel(): void {
    this.modalRef?.close();
  }

  save() {
    this.saving.set(true);
    const paysId = this.isSuperAdmin() ? (this.selectedPaysId() ?? this.paysId()) : this.paysId();
    const dto = { paysId, ...this.form };
    const obs = this.editTarget()
      ? this.svc.updateHoliday(this.editTarget()!.id, dto)
      : this.svc.createHoliday(dto);

    obs.pipe(catchError(err => { this.modalError.set(err?.error?.message ?? this.translate.instant('ADMIN.catalog.holidays.error')); this.saving.set(false); return of(null); }))
      .subscribe(result => {
        this.saving.set(false);
        if (result) { this.modalRef?.close(); this.load(); }
      });
  }

  del(h: Holiday) {
    this.modal.open({
      title: this.translate.instant('ADMIN.catalog.holidays.deleteTitle'),
      body: this.translate.instant('ADMIN.catalog.holidays.deleteBody', { name: h.frenchLabel }),
      size: 'sm',
      closeOnBackdrop: false,
      buttons: [
        { label: this.translate.instant('ADMIN.catalog.holidays.cancel'), variant: 'secondary', action: r => r.close() },
        {
          label: this.translate.instant('ADMIN.catalog.holidays.deleteConfirm'), variant: 'primary', icon: 'delete',
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
