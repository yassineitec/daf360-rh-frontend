import { Component, TemplateRef, computed, effect, inject, input, OnChanges, signal, untracked, viewChild } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AdminService }     from './admin.service';
import { DEFAULT_HOLIDAY_CALENDAR_CONFIG, Holiday, HolidayCalendarConfig } from './models/admin.model';
import { HolidayPaysOption, HolidayScopeService } from './holiday-scope.service';
import { FLAG_SVGS, flagDataUri } from './flag-svgs';
import { SpinnerComponent } from '../../shared/spinner.component';
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
  DataTableComponent, DafCellDirective, SortDirection, TableColumn, TableConfig, TableRow,
  PaginationComponent, PaginationConfig,
  SearchToolbarComponent, ToolbarToggleOption,
  ModalService, ModalRef,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableSort, searchRows, sortByColumn, toTableSort } from '../../shared/table-sort.utils';

const PAGE_SIZE = 10;

/**
 * What each holiday column sorts on. No entry for "Pays": the table always shows one
 * entity's calendar, so every row carries the same country.
 */
const HOLIDAY_SORT: Record<string, (h: Holiday) => string | number | null> = {
  dateHoliday: h => h.dateHoliday?.slice(0, 10) || null, // ISO: string order = date order
  frenchLabel: h => h.frenchLabel || null,
  isRecurring: h => (h.isRecurring ? 1 : 0),
};

/** Badge colour when none is configured — must match holiday-calendar.component.ts. */
const DEFAULT_BADGE_COLOR = '#b45309';
/** daf-select option standing for `flagIsoCode: null` (ISO codes are always 2 letters). */

@Component({
  selector: 'app-holidays-admin',
  standalone: true,
  imports: [
    SpinnerComponent, MultiDatePickerComponent, HolidayCalendarComponent,
    FormFieldComponent, ToggleComponent, ButtonComponent, SelectComponent,
    DataTableComponent, DafCellDirective, PaginationComponent, SearchToolbarComponent,
    TranslatePipe,
  ],
  template: `
    <div class="section-header">
      <div>
        <h3 class="col-title">{{ 'ADMIN.catalog.holidays.title' | translate }}</h3>
        <p class="col-sub">{{ 'ADMIN.catalog.holidays.subtitle' | translate }}</p>
      </div>
      <div class="header-actions">
        <!-- Which entity's holidays. Replaces the hard-wired paysId input: this screen is
             for administering calendars, and an administrator covering several entities had
             no way to reach the others. The list is SCOPED server side, so it can only offer
             what the writes would accept. -->
        @if (paysOptions().length > 1) {
          <daf-select
            class="pays-picker"
            [options]="paysOptions()"
            [selected]="selectedPaysSelected()"
            [config]="{ label: ('ADMIN.catalog.holidays.colCountry' | translate), fullWidth: false, searchable: true }"
            (selectedChange)="onPaysChange($event)" />
        }
      </div>
    </div>

    <!-- Same bar as the other lists (daf-search-toolbar): search, the Table / Calendar view
         toggle, « Ajouter », and [table] puts reset + column picker on the right. The bar
         handles its own mobile layout — no separate search toggle any more. The search filters
         the table only; the calendar always shows the whole year. -->
    <daf-search-toolbar class="mb-4 block"
      [placeholder]="'ADMIN.catalog.holidays.searchPlaceholder' | translate"
      [value]="searchQuery()"
      [debounce]="200"
      (valueChange)="onSearch($event)"
      [views]="viewOptions()"
      [view]="viewMode()"
      (viewChange)="viewMode.set($any($event))"
      [table]="table() ?? null">
      <daf-button
        [label]="'ADMIN.catalog.holidays.add' | translate"
        variant="teal"
        [options]="{ iconStart: 'add' }"
        (onClick)="openAdd()" />
    </daf-search-toolbar>

    @if (loading()) { <div class="center"><app-spinner /></div> }
    @else if (viewMode() === 'calendar') {
      <!-- Calendar view — month-grid, same visual language as the portal's /home calendar.
           Clicking an empty date opens "Ajouter" prefilled with that date; clicking an
           already-marked day opens it directly for editing. -->
      <div class="calendar-wrap">
        <app-holiday-calendar
          [holidays]="holidays()"
          [paysIsoCode]="paysIsoCode()"
          [config]="calendarConfig()"
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
        <daf-data-table [columns]="columns()" [rows]="rows()" [config]="tableConfig()"
                        (sortChange)="onSortChange($event.key, $event.dir)"
                        (resetClick)="onSortChange('', null)">
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
              [config]="{ label: ('ADMIN.catalog.holidays.colCountry' | translate), required: true, fullWidth: true, searchable: true }"
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
    .center         { display:flex;justify-content:center;padding:24px }
    .calendar-wrap  { width:100%;padding:8px 0 }

    .table-scroll   { overflow-x:auto }
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
    .footer-left  { margin-right:auto }

    .color-row      { display:flex;align-items:center;gap:10px }
    .color-input    { width:44px;height:32px;padding:2px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface);cursor:pointer }
    .warning-banner { padding:8px 12px;border-radius:8px;background:rgba(217,119,6,.12);color:#92400e;font-size:12px;line-height:1.45 }
  `],
})
export class HolidaysAdminComponent implements OnChanges {
  private svc      = inject(AdminService);
  private modal    = inject(ModalService);
  private translate = inject(TranslateService);
  private refData  = inject(RefDataService);
  private userStore = inject(UserStore);
  /** Scoped entity list — see the constructor. */
  private holidayScopeSvc = inject(HolidayScopeService);

  paysId    = input(179);
  paysLabel = input('—');
  paysIsoCode = input('');

  readonly isSuperAdmin = this.userStore.isSuperAdmin;
  availablePays = signal<HolidayPaysOption[]>([]);
  selectedPaysId = signal<number | null>(null);

  // imageUrl draws the country's flag on the option row AND on the trigger's selected
  // value — daf-select renders it at 20x15, the 4x3 ratio flag-svgs.ts is cut to.
  readonly paysOptions = computed<SelectOption[]>(() =>
    this.availablePays().map(p => ({
      value: String(p.id),
      label: p.frenchLabel,
      imageUrl: flagDataUri(p.isoCode),
    })));

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

  /**
   * The calendar badge, no longer configurable.
   *
   * Every field is null but showFlag: the calendar component already falls back to the
   * entity's own ISO code for the flag, the translated abbreviation for the text, and the
   * default amber for the colour. A settings modal existed to override those three — it wrote
   * a JSON blob into `parameter_sets`, and it decided nothing the country could not.
   */
  readonly calendarConfig = signal<HolidayCalendarConfig>(DEFAULT_HOLIDAY_CALENDAR_CONFIG);

  private modalRef?: ModalRef;
  bodyTpl = viewChild.required<TemplateRef<unknown>>('bodyTpl');
  searchQuery = signal('');
  selectedYear = new Date().getFullYear();
  viewMode = signal<'table' | 'calendar'>('table');

  /** The table (absent while loading, empty or in calendar view) — fed to the toolbar's `[table]`. */
  readonly table = viewChild(DataTableComponent);

  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'table',    icon: 'table_rows',     tooltip: this.translate.instant('ADMIN.catalog.holidays.viewTable') },
      { id: 'calendar', icon: 'calendar_month', tooltip: this.translate.instant('ADMIN.catalog.holidays.viewCalendar') },
    ];
  });

  /** New search → back to the first page (else one can sit on an empty page). */
  onSearch(value: string): void {
    if (value === this.searchQuery()) return;
    this.searchQuery.set(value);
    this.currentPage.set(0);
  }

  /** Searches what the row shows: the date as displayed, and both labels (fr/en). */
  readonly filteredHolidays = computed(() =>
    searchRows(this.holidays(), this.searchQuery(), h => [this.fmtDate(h.dateHoliday), h.frenchLabel, h.englishLabel]),
  );

  currentPage = signal(0);
  /** Table header sort — applied to the whole filtered list, before paging (`manualSort`). */
  readonly sort = signal<TableSort | null>(null);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredHolidays().length / PAGE_SIZE)));

  readonly pagedHolidays = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return sortByColumn(this.filteredHolidays(), this.sort(), HOLIDAY_SORT).slice(start, start + PAGE_SIZE);
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
      { key: 'dateHoliday', label: this.translate.instant('ADMIN.catalog.holidays.colDate'), sortable: true },
      { key: 'frenchLabel', label: this.translate.instant('ADMIN.catalog.holidays.colName'), sortable: true },
      { key: 'pays',        label: this.translate.instant('ADMIN.catalog.holidays.colCountry') },
      { key: 'isRecurring', label: this.translate.instant('ADMIN.catalog.holidays.colRecurring'), sortable: true },
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
    const t = (k: string) => this.translate.instant(k);
    // A seed read once by the table — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      showHeader: false,
      hoverable: true,
      emptyMessage: t('ADMIN.catalog.holidays.emptyMessage'),
      // Stable row identity: row heights are keyed by it, not by render index.
      rowId: (row: TableRow) => (row['_source'] as Holiday).id,
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

  /**
   * The entity being administered: the picker's choice, else the caller's own.
   *
   * Every read and write goes through this rather than the `paysId` input, so the screen
   * follows the picker. The input remains the sensible starting point — an administrator of
   * one entity never touches the picker and sees exactly what they saw before.
   */
  readonly activePaysId = computed(() => this.selectedPaysId() ?? this.paysId());

  constructor() {
    // Scoped server-side to the caller's role perimeter, and loaded for EVERYONE rather than
    // only super admins: a regional administrator covering two entities could previously
    // reach only the one on their own profile. The endpoint decides what is offered, so the
    // picker can never show an entity the save would refuse.
    this.holidayScopeSvc.scopedPays().subscribe({
      next: list => {
        this.availablePays.set(list);
        // Default to the caller's own entity when it is in scope; otherwise the first one
        // they do have, so the screen is never pointed at something they cannot read.
        if (!list.some(p => p.id === this.paysId()) && list.length) {
          this.selectedPaysId.set(list[0].id);
        }
        this.load();
      },
      error: () => this.availablePays.set([]),
    });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  /** Header click (or the reset icon): a new order makes the current page meaningless. */
  onSortChange(key: string, dir: SortDirection): void {
    this.sort.set(toTableSort(key, dir));
    this.currentPage.set(0);
  }

  readonly String = String;

  form = { dateHoliday: '', frenchLabel: '', englishLabel: '', isRecurring: false };

  ngOnChanges() {
    this.load();
  }


  load() {
    this.loading.set(true);
    this.svc.listHolidays(this.activePaysId(), this.selectedYear).pipe(catchError(() => of([]))).subscribe(hs => {
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
    const paysId = this.activePaysId();
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
