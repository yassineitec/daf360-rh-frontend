import { Component, TemplateRef, computed, effect, inject, input, OnChanges, signal, untracked, viewChild } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AdminService }     from './admin.service';
import { DEFAULT_HOLIDAY_CALENDAR_CONFIG, Holiday, HolidayCalendarConfig } from './models/admin.model';
import { HOLIDAY_ABBREV_MAX_LENGTH, HolidayCalendarConfigService } from './holiday-calendar-config.service';
import { FLAG_SVGS, flagDataUri } from './flag-svgs';
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
  DataTableComponent, DafCellDirective, SortDirection, TableColumn, TableConfig, TableRow,
  PaginationComponent, PaginationConfig,
  ModalService, ModalRef,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableSort, sortByColumn, toTableSort } from '../../shared/table-sort.utils';

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
const FLAG_DEFAULT_VALUE = 'default';

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
          @if (canConfigureCalendar()) {
            <!-- Saving goes through /api/hr/admin/parameters, which needs HR_ADMIN_ROLES. -->
            <daf-button
              [title]="'ADMIN.catalog.holidays.settings.open' | translate"
              variant="toggle"
              [options]="{ pill: true, size: 'sm', iconStart: 'settings' }"
              (onClick)="openSettings()" />
          }
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

    <!-- Calendar settings modal — edits a draft; the calendar only changes on Save. -->
    <ng-template #settingsTpl>
      <div class="modal-form">
        <p class="col-sub">{{ 'ADMIN.catalog.holidays.settings.subtitle' | translate:{ pays: paysLabel() } }}</p>

        <div class="field-row">
          <span class="preview-label">{{ 'ADMIN.catalog.holidays.settings.preview' | translate }}</span>
          <div class="badge-preview">
            <span class="preview-bar" [style.--hc-badge]="previewColor()" [style.--hc-badge-bg]="previewBg()">
              @if (previewFlagUri(); as uri) { <img class="preview-flag" [src]="uri" alt="" /> }
              <span class="preview-abbrev">{{ draft().abbrev || defaultAbbrev() }}</span>
            </span>
          </div>
        </div>

        <daf-toggle
          [options]="{ label: ('ADMIN.catalog.holidays.settings.showFlag' | translate) }"
          [checked]="draft().showFlag"
          (checkedChange)="patchDraft({ showFlag: $event })"
        />

        @if (draft().showFlag) {
          <div class="field-row">
            <daf-select
              [selected]="[draft().flagIsoCode ?? FLAG_DEFAULT_VALUE]"
              [options]="flagOptions()"
              [config]="{ label: ('ADMIN.catalog.holidays.settings.flag' | translate), searchable: true, fullWidth: true }"
              (selectedChange)="onFlagChange($event)"
            />
          </div>
        }

        <div class="field-row">
          <daf-form-field
            [options]="{
              label: ('ADMIN.catalog.holidays.settings.abbrev' | translate),
              placeholder: defaultAbbrev(),
              maxLength: ABBREV_MAX,
              hint: ('ADMIN.catalog.holidays.settings.abbrevHint' | translate:{ max: ABBREV_MAX, default: defaultAbbrev() }),
              fullWidth: true
            }"
            [value]="draft().abbrev ?? ''"
            (valueChange)="onAbbrevChange($any($event))"
          />
        </div>

        <div class="field-row">
          <span class="preview-label">{{ 'ADMIN.catalog.holidays.settings.color' | translate }}</span>
          <div class="color-row">
            <input type="color" class="color-input" [value]="previewColor()" (input)="onColorChange($any($event.target).value)" />
            <daf-button
              [label]="'ADMIN.catalog.holidays.settings.colorDefault' | translate"
              variant="secondary"
              [options]="{ size: 'sm', disabled: !draft().color }"
              (onClick)="patchDraft({ color: null })" />
          </div>
        </div>

        @if (!paysHasOtherParams() && calendarParamId() === null) {
          <div class="warning-banner" role="status">{{ 'ADMIN.catalog.holidays.settings.seedWarning' | translate }}</div>
        }
      </div>
      @if (settingsError()) { <div class="error-banner" role="alert">{{ settingsError() }}</div> }
      <div class="modal-footer">
        <daf-button class="footer-left" [label]="'ADMIN.catalog.holidays.settings.reset' | translate" variant="ghost" [options]="{ disabled: settingsSaving() }" (onClick)="resetDraft()" />
        <daf-button [label]="'ADMIN.catalog.holidays.settings.cancel' | translate" variant="secondary" [options]="{ disabled: settingsSaving() }" (onClick)="closeSettings()" />
        <daf-button
          [label]="'ADMIN.catalog.holidays.settings.save' | translate"
          variant="teal"
          [options]="{ disabled: settingsSaving(), loading: settingsSaving() }"
          (onClick)="saveSettings()" />
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
    .footer-left  { margin-right:auto }

    /* Settings modal — the preview reuses the calendar badge's own look and CSS variables. */
    .preview-label  { font-size:12px;font-weight:600;color:var(--color-text) }
    .badge-preview  { display:flex;align-items:center;justify-content:center;padding:14px;border-radius:10px;border:1px dashed var(--color-border);background:var(--color-bg-secondary) }
    .preview-bar    { display:inline-flex;align-items:center;gap:8px }
    .preview-flag   { width:24px;height:18px;object-fit:cover;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.08) }
    .preview-abbrev { font-size:13px;font-weight:700;letter-spacing:.03em;color:var(--hc-badge);background:var(--hc-badge-bg);padding:2px 8px;border-radius:6px }
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
  private calendarConfigSvc = inject(HolidayCalendarConfigService);

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

  /** Calendar badge settings for the current pays (flag, "JF" text, colour). */
  calendarConfig  = signal<HolidayCalendarConfig>(DEFAULT_HOLIDAY_CALENDAR_CONFIG);
  /** `parameter_sets` row holding that config — null until first saved. */
  calendarParamId = signal<number | null>(null);
  /** False → saving the config would block the backend's payroll parameter seed. */
  paysHasOtherParams = signal(true);

  // ── Calendar settings modal ───────────────────────────────────────────────
  readonly canConfigureCalendar = computed(() => this.userStore.permissions().includes('HR_ADMIN_ROLES'));
  readonly ABBREV_MAX = HOLIDAY_ABBREV_MAX_LENGTH;
  readonly FLAG_DEFAULT_VALUE = FLAG_DEFAULT_VALUE;

  /** Edited copy of calendarConfig — only copied back on a successful save. */
  draft          = signal<HolidayCalendarConfig>(DEFAULT_HOLIDAY_CALENDAR_CONFIG);
  settingsSaving = signal(false);
  settingsError  = signal<string | null>(null);
  private settingsRef?: ModalRef;
  settingsTpl = viewChild.required<TemplateRef<unknown>>('settingsTpl');

  readonly defaultAbbrev = computed(() => {
    this.translate.currentLang();
    return this.translate.instant('ADMIN.catalog.holidays.calendar.abbrev');
  });

  /**
   * Every country FLAG_SVGS can draw, named in the UI language by the browser's own
   * Intl.DisplayNames (no country-name table to ship), sorted by name. Codes the
   * browser has no name for (e.g. `xx`) are left out. First entry = "entity's pays".
   */
  readonly flagOptions = computed<SelectOption[]>(() => {
    const lang = this.translate.currentLang() ?? 'fr';
    let names: Intl.DisplayNames | null = null;
    try { names = new Intl.DisplayNames([lang], { type: 'region' }); } catch { /* old browser */ }
    const countries: SelectOption[] = [];
    for (const iso of Object.keys(FLAG_SVGS)) {
      let label: string | undefined;
      try { label = names?.of(iso.toUpperCase()); } catch { label = undefined; }
      if (!label || label.toUpperCase() === iso.toUpperCase()) continue;
      countries.push({ value: iso, label, imageUrl: flagDataUri(iso) });
    }
    countries.sort((a, b) => a.label.localeCompare(b.label, lang));
    return [
      {
        value: FLAG_DEFAULT_VALUE,
        label: this.translate.instant('ADMIN.catalog.holidays.settings.flagDefault'),
        imageUrl: flagDataUri(this.paysIsoCode()) || undefined,
      },
      ...countries,
    ];
  });

  readonly previewFlagUri = computed(() => {
    const d = this.draft();
    return d.showFlag ? flagDataUri(d.flagIsoCode ?? this.paysIsoCode()) : '';
  });
  readonly previewColor = computed(() => this.draft().color ?? DEFAULT_BADGE_COLOR);
  readonly previewBg = computed(() =>
    this.draft().color ? `color-mix(in srgb, ${this.draft().color} 12%, transparent)` : 'rgba(217,119,6,.12)');

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

  constructor() {
    if (this.isSuperAdmin()) {
      this.refData.getPaysTimezones().subscribe(list => this.availablePays.set(list));
    }
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
    this.loadCalendarConfig();
  }

  loadCalendarConfig() {
    this.calendarConfigSvc.load(this.paysId()).subscribe(res => {
      this.calendarConfig.set(res.config);
      this.calendarParamId.set(res.paramId);
      this.paysHasOtherParams.set(res.hasOtherParams);
    });
  }

  openSettings(): void {
    this.draft.set({ ...this.calendarConfig() });
    this.settingsError.set(null);
    this.settingsRef = this.modal.open({
      title: this.translate.instant('ADMIN.catalog.holidays.settings.title'),
      body: this.settingsTpl(),
      closeOnBackdrop: false,
    });
  }

  closeSettings(): void {
    this.settingsRef?.close();
  }

  patchDraft(patch: Partial<HolidayCalendarConfig>): void {
    this.draft.update(d => ({ ...d, ...patch }));
  }

  resetDraft(): void {
    this.draft.set({ ...DEFAULT_HOLIDAY_CALENDAR_CONFIG });
  }

  onFlagChange(value: string[]): void {
    const v = value[0];
    this.patchDraft({ flagIsoCode: !v || v === FLAG_DEFAULT_VALUE ? null : v });
  }

  onAbbrevChange(value: string): void {
    const v = (value ?? '').trim().slice(0, HOLIDAY_ABBREV_MAX_LENGTH);
    this.patchDraft({ abbrev: v || null });
  }

  onColorChange(value: string): void {
    this.patchDraft({ color: value || null });
  }

  saveSettings(): void {
    const config = this.calendarConfigSvc.normalize(this.draft());
    this.settingsSaving.set(true);
    this.settingsError.set(null);
    this.calendarConfigSvc.save(this.paysId(), config, this.calendarParamId()).subscribe({
      next: saved => {
        this.settingsSaving.set(false);
        this.calendarConfig.set(config);
        this.calendarParamId.set(saved.id);
        this.settingsRef?.close();
      },
      error: () => {
        this.settingsSaving.set(false);
        this.settingsError.set(this.translate.instant('ADMIN.catalog.holidays.settings.error'));
      },
    });
  }

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
