import { Component, OnChanges, SimpleChanges, computed, inject, input, signal, viewChild } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ButtonComponent, FormFieldComponent, ToggleComponent, StatusBadgeComponent,
  ModalService, SelectComponent, SelectOption,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
  PermissionService, SearchToolbarComponent,
  TimePickerComponent, TimePickerValue, formatTimePickerValue, parseTimePickerValue,
  MultiDatePickerComponent,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { RegimeService } from '../regime.service';
import { WorkingTimeRegime, RegimeDetail, CreateRegimeRequest } from '../regime.model';
import { RefDataService } from '../../../../core/ref/ref-data.service';
import { PaysTimezone, TimezoneOption } from '../../../../core/ref/ref-data.model';
import { NotificationService } from '../../../../core/notification.service';
import { ModalComponent } from '../../../../shared/modal.component';
import { searchRows } from '../../../../shared/table-sort.utils';
import { adminLabel } from '../../../../shared/utils/admin-label.utils';
import { rememberAdminState } from '../../admin-section-state';
import { dateToIso, isoToDate } from '../regime-dates';

/** What the create / edit modal holds. Numbers stay `number | string | null`: a cleared input gives ''. */
interface RegimeForm {
  code: string;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  descriptionEn: string;
  hoursPerWeek: number | string | null;
  daysPerWeek: number | string | null;
  startTime: string;
  endTime: string;
  breakDurationMin: number | string | null;
  maxHoursPerDay: number | string | null;
  isFlexible: boolean;
  overtimeAllowed: boolean;
  isDefault: boolean;
  seasonalFrom: string;
  seasonalTo: string;
  timezone: string;
}

const EMPTY_FORM: RegimeForm = {
  code: '', labelFr: '', labelEn: '', descriptionFr: '', descriptionEn: '',
  hoursPerWeek: 40, daysPerWeek: 5, startTime: '08:00', endTime: '17:00',
  breakDurationMin: 60, maxHoursPerDay: null,
  isFlexible: false, overtimeAllowed: false, isDefault: false,
  seasonalFrom: '', seasonalTo: '', timezone: '',
};

/**
 * Administration → Régimes horaires → Catalogue, for the entity picked in the admin header.
 *
 * Same shape as the other admin catalogues (Télétravail, Pauses): one full-width table, row
 * actions, and ONE modal for both create and edit that carries every field. The old screen
 * split list / editor side by side and its create modal had no hours at all — a régime made
 * there (e.g. a new default) reached pointage without start/end time, so nobody following it
 * had a schedule.
 *
 * The banner above the table answers the question the screen is mostly opened for: which
 * régime applies to someone with no seasonal, personal or role régime — and whether it can
 * actually drive pointage.
 */
@Component({
  selector: 'app-regime-catalog',
  standalone: true,
  imports: [
    ButtonComponent, FormFieldComponent, ToggleComponent, StatusBadgeComponent, SelectComponent,
    DataTableComponent, DafCellDirective, SearchToolbarComponent, ModalComponent, TranslatePipe,
    TimePickerComponent, MultiDatePickerComponent,
  ],
  templateUrl: './regime-catalog.component.html',
  styleUrl: './regime-catalog.component.scss',
})
export class RegimeCatalogComponent implements OnChanges {
  private readonly svc       = inject(RegimeService);
  private readonly modal     = inject(ModalService);
  private readonly translate = inject(TranslateService);
  private readonly refData   = inject(RefDataService);
  private readonly notify    = inject(NotificationService);
  protected readonly perms   = inject(PermissionService);

  readonly paysId    = input<number>(179);
  /** Entity name from the admin header picker, shown in the banner and the confirmations. */
  readonly paysLabel = input<string>('');

  // ── State ──────────────────────────────────────────────────────────────────
  readonly regimes  = signal<WorkingTimeRegime[]>([]);
  /** Usage per régime id (roles / employees pointing to it); missing = not loaded. */
  readonly usage    = signal<Record<number, RegimeDetail>>({});
  readonly loading  = signal(true);
  readonly searchQuery = signal('');

  private readonly memory = rememberAdminState('regimes.catalog', { searchQuery: this.searchQuery });

  readonly table = viewChild(DataTableComponent);

  // ── Modal ──────────────────────────────────────────────────────────────────
  readonly showModal = signal(false);
  /** null = creating. */
  readonly editingId = signal<number | null>(null);
  readonly form      = signal<RegimeForm>({ ...EMPTY_FORM });
  readonly submitted = signal(false);
  readonly saving    = signal(false);
  readonly modalError = signal<string | null>(null);

  // ── Timezone context ───────────────────────────────────────────────────────
  readonly paysTimezone = signal<PaysTimezone | null>(null);
  private readonly timezones = signal<TimezoneOption[]>([]);

  readonly canManage = computed(() => this.perms.has('ADMIN_REGIMES'));

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['paysId']) {
      this.load();
      this.refData.getPaysTimezones().subscribe(list =>
        this.paysTimezone.set(list.find(p => p.id === this.paysId()) ?? null));
    }
  }

  constructor() {
    this.refData.getTimezones().subscribe(tzs => this.timezones.set(tzs));
  }

  load(): void {
    this.loading.set(true);
    this.svc.invalidateCache();
    this.svc.getRegimes(this.paysId()).subscribe({
      next: rs => {
        this.regimes.set(rs);
        this.loading.set(false);
        this.loadUsage(rs);
      },
      error: () => { this.regimes.set([]); this.loading.set(false); },
    });
  }

  /** Small fixed list (a handful per entity): one detail call each, failures just show « — ». */
  private loadUsage(rs: WorkingTimeRegime[]): void {
    if (!rs.length) { this.usage.set({}); return; }
    forkJoin(rs.map(r => this.svc.getRegimeDetail(r.id).pipe(catchError(() => of(null)))))
      .subscribe(details => {
        const map: Record<number, RegimeDetail> = {};
        details.forEach(d => { if (d) map[d.id] = d; });
        this.usage.set(map);
      });
  }

  // ── Derived: default / seasonal banner ─────────────────────────────────────
  readonly defaultRegime = computed(() => this.regimes().find(r => r.isDefault && r.isActive) ?? null);

  readonly activeSeasonal = computed(() => this.regimes().find(r => this.isSeasonalActive(r)) ?? null);

  readonly defaultHasNoTimes = computed(() => {
    const d = this.defaultRegime();
    return !!d && !d.isFlexible && (!d.startTime || !d.endTime);
  });

  readonly entityName = computed(() => this.paysLabel() || this.paysTimezone()?.frenchLabel || '—');

  // ── Table ──────────────────────────────────────────────────────────────────
  regimeName(r: WorkingTimeRegime): string {
    return adminLabel(r, this.translate);
  }

  readonly filteredRegimes = computed(() => {
    this.translate.currentLang();
    return searchRows(this.regimes(), this.searchQuery(), r => [
      this.regimeName(r), r.code, this.timesLabel(r),
      r.isDefault ? this.translate.instant('ADMIN.regimes.catalog.badgeDefault') : null,
      r.seasonalFrom ? this.translate.instant('ADMIN.regimes.catalog.badgeSeasonal') : null,
      r.isFlexible ? this.translate.instant('ADMIN.regimes.catalog.badgeFlexible') : null,
    ]);
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('ADMIN.regimes.catalog.' + k);
    const src = (row: TableRow) => row['_source'] as WorkingTimeRegime;
    return [
      { key: 'name',     label: t('colName'), sortable: true, sortAccessor: row => this.regimeName(src(row)) || null },
      { key: 'times',    label: t('colTimes'), sortable: true, sortAccessor: row => src(row).startTime ?? null },
      { key: 'volume',   label: t('colVolume'), sortable: true,
        sortAccessor: row => src(row).hoursPerWeek * 10 + src(row).daysPerWeek },
      { key: 'pause',    label: t('colBreak'), sortable: true, sortAccessor: row => src(row).breakDurationMin ?? null },
      { key: 'timezone', label: t('colTimezone') },
      { key: 'usage',    label: t('colUsage') },
      { key: 'status',   label: t('colStatus') },
    ];
  });

  readonly rows = computed<TableRow[]>(() =>
    this.filteredRegimes().map(r => ({
      id: r.id,
      name: this.regimeName(r),
      times: this.timesLabel(r),
      volume: `${r.hoursPerWeek} h · ${r.daysPerWeek} j`,
      pause: r.breakDurationMin ? `${r.breakDurationMin} min` : '—',
      _source: r,
    })));

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const src = (row: TableRow) => row['_source'] as WorkingTimeRegime;
    return {
      loading: this.loading(),
      skeletonRows: 4,
      hoverable: true,
      rowId: (row: TableRow) => src(row).id,
      resizableColumns: true,
      columnPicker: true,
      columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
      showReset: true,
      resetLabel: t('REQUESTS.TABLE.RESET'),
      sortLabel: t('REQUESTS.TABLE.SORT_BY'),
      emptyMessage: t('ADMIN.regimes.catalog.emptyList'),
      actions: [
        { id: 'edit', icon: 'edit', tooltip: t('ADMIN.regimes.common.edit'),
          onClick: (row: TableRow) => this.openEdit(src(row)) },
        { id: 'default', icon: 'star', tooltip: t('ADMIN.regimes.catalog.makeDefault'),
          hidden: (row: TableRow) => !this.canManage() || src(row).isDefault || !!src(row).seasonalFrom,
          onClick: (row: TableRow) => this.confirmMakeDefault(src(row)) },
        // Never a mute greyed-out icon: the default has no delete at all (another régime must
        // become the default first), any other régime says on click what still uses it.
        { id: 'delete', icon: 'delete', variant: 'danger', tooltip: t('ADMIN.regimes.common.delete'),
          hidden: (row: TableRow) => !this.canManage() || src(row).isDefault,
          onClick: (row: TableRow) => this.confirmDelete(src(row)) },
      ],
    };
  });

  onSearch(value: string): void {
    if (value !== this.searchQuery()) this.searchQuery.set(value);
  }

  timesLabel(r: WorkingTimeRegime): string {
    if (!r.startTime || !r.endTime) return '';
    return `${this.hhmm(r.startTime)} – ${this.hhmm(r.endTime)}`;
  }

  timezoneLabel(r: WorkingTimeRegime): string {
    return r.timezone || this.translate.instant('ADMIN.regimes.catalog.tzInherited');
  }

  usageOf(r: WorkingTimeRegime): RegimeDetail | null {
    return this.usage()[r.id] ?? null;
  }

  /** The seasonal window covers today: this régime currently replaces every other one of the entity. */
  isSeasonalActive(r: WorkingTimeRegime): boolean {
    if (!r.seasonalFrom) return false;
    const today = new Date().toISOString().slice(0, 10);
    return r.seasonalFrom <= today && (!r.seasonalTo || r.seasonalTo >= today);
  }

  hhmm(t: string | null | undefined): string {
    return t ? t.slice(0, 5) : '';
  }

  // ── Modal: create / edit ───────────────────────────────────────────────────
  readonly timezoneOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    const zone = this.paysTimezone()?.timezone;
    const inherit = zone
      ? this.translate.instant('ADMIN.regimes.catalog.tzInheritFrom', { zone })
      : this.translate.instant('ADMIN.regimes.catalog.tzInheritUnset');
    return [{ value: '', label: inherit }, ...this.timezones().map(t => ({ value: t.id, label: t.label }))];
  });

  readonly timezoneSelected = computed(() => [this.form().timezone ?? '']);

  readonly modalTitle = computed(() => this.translate.instant(
    this.editingId() === null ? 'ADMIN.regimes.catalog.createModalTitle' : 'ADMIN.regimes.catalog.editModalTitle'));

  readonly editingUsage = computed(() => {
    const id = this.editingId();
    return id === null ? null : this.usage()[id] ?? null;
  });

  /** The default currently held by ANOTHER régime — what ticking « Par défaut » replaces. */
  readonly otherDefault = computed(() => {
    const d = this.defaultRegime();
    return d && d.id !== this.editingId() ? d : null;
  });

  readonly hasSeasonalDates = computed(() => !!this.form().seasonalFrom || !!this.form().seasonalTo);

  readonly errors = computed(() => {
    const f = this.form();
    const t = (k: string) => this.translate.instant('ADMIN.regimes.catalog.' + k);
    const e: Partial<Record<keyof RegimeForm, string>> = {};
    if (!f.code.trim() || f.code.length > 50) e.code = t('errorCode');
    if (!f.labelFr.trim()) e.labelFr = t('errorLabelFr');
    const h = this.num(f.hoursPerWeek);
    if (h === null || h < 1 || h > 60) e.hoursPerWeek = t('errorHours');
    const d = this.num(f.daysPerWeek);
    if (d === null || d < 1 || d > 7) e.daysPerWeek = t('errorDays');
    if (!f.isFlexible && (!f.startTime || !f.endTime)) {
      if (!f.startTime) e.startTime = t('errorTimes');
      if (!f.endTime) e.endTime = t('errorTimes');
    }
    if (f.startTime && f.endTime && f.endTime <= f.startTime) e.endTime = t('errorTimeOrder');
    if (f.seasonalTo && !f.seasonalFrom) e.seasonalFrom = t('errorSeasonalFrom');
    if (f.seasonalFrom && f.seasonalTo && f.seasonalTo < f.seasonalFrom) e.seasonalTo = t('errorSeasonalOrder');
    if (f.isDefault && (f.seasonalFrom || f.seasonalTo)) e.isDefault = t('errorSeasonalDefault');
    return e;
  });

  readonly invalid = computed(() => Object.keys(this.errors()).length > 0);

  err(key: keyof RegimeForm): string | undefined {
    return this.submitted() ? this.errors()[key] : undefined;
  }

  patch<K extends keyof RegimeForm>(key: K, value: RegimeForm[K]): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.set({ ...EMPTY_FORM, isDefault: !this.defaultRegime() });
    this.submitted.set(false);
    this.modalError.set(null);
    this.showModal.set(true);
  }

  openEdit(r: WorkingTimeRegime): void {
    this.editingId.set(r.id);
    this.form.set(this.regimeToForm(r));
    this.submitted.set(false);
    this.modalError.set(null);
    this.showModal.set(true);
  }

  closeModal(): void {
    if (!this.saving()) this.showModal.set(false);
  }

  save(): void {
    this.submitted.set(true);
    if (this.invalid() || !this.canManage()) return;
    this.saving.set(true);
    this.modalError.set(null);

    const dto = this.toRequest(this.form());
    const id = this.editingId();
    const call = id === null ? this.svc.createRegime(dto) : this.svc.updateRegime(id, dto);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.notify.success(this.translate.instant(
          id === null ? 'ADMIN.regimes.catalog.created' : 'ADMIN.regimes.catalog.updateSuccess'));
        // Reload, not a local patch: ticking « Par défaut » also took the flag off another row.
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.modalError.set(err?.error?.message ?? this.translate.instant(
          id === null ? 'ADMIN.regimes.common.errorCreate' : 'ADMIN.regimes.catalog.errorSave'));
      },
    });
  }

  /**
   * The full payload, also for an edit: the server's PATCH writes the seasonal window and the
   * timezone even when absent (null = cleared), so a partial body would wipe them.
   */
  private toRequest(f: RegimeForm): CreateRegimeRequest {
    return {
      code: f.code.trim(),
      labelFr: f.labelFr.trim(),
      labelEn: f.labelEn.trim(),
      descriptionFr: f.descriptionFr.trim(),
      descriptionEn: f.descriptionEn.trim(),
      hoursPerWeek: this.num(f.hoursPerWeek)!,
      daysPerWeek: this.num(f.daysPerWeek)!,
      startTime: f.startTime || undefined,
      endTime: f.endTime || undefined,
      breakDurationMin: this.num(f.breakDurationMin) ?? 0,
      maxHoursPerDay: this.num(f.maxHoursPerDay) ?? undefined,
      isFlexible: f.isFlexible,
      overtimeAllowed: f.overtimeAllowed,
      isDefault: f.isDefault,
      seasonalFrom: f.seasonalFrom || null,
      seasonalTo: f.seasonalTo || null,
      timezone: f.timezone || null,
      paysId: this.paysId(),
    };
  }

  private regimeToForm(r: WorkingTimeRegime): RegimeForm {
    return {
      code: r.code ?? '', labelFr: r.labelFr ?? '', labelEn: r.labelEn ?? '',
      descriptionFr: r.descriptionFr ?? '', descriptionEn: r.descriptionEn ?? '',
      hoursPerWeek: r.hoursPerWeek, daysPerWeek: r.daysPerWeek,
      startTime: this.hhmm(r.startTime), endTime: this.hhmm(r.endTime),
      breakDurationMin: r.breakDurationMin ?? 0, maxHoursPerDay: r.maxHoursPerDay ?? null,
      isFlexible: !!r.isFlexible, overtimeAllowed: !!r.overtimeAllowed, isDefault: !!r.isDefault,
      seasonalFrom: r.seasonalFrom ?? '', seasonalTo: r.seasonalTo ?? '',
      timezone: r.timezone ?? '',
    };
  }

  // ── Row actions ────────────────────────────────────────────────────────────
  confirmMakeDefault(r: WorkingTimeRegime): void {
    const prev = this.defaultRegime();
    const t = (k: string, p?: object) => this.translate.instant('ADMIN.regimes.catalog.' + k, p);
    const body = t('makeDefaultBody', { next: this.regimeName(r), pays: this.entityName() })
      + (prev ? ' ' + t('makeDefaultReplaces', { prev: this.regimeName(prev) }) : '')
      + (!r.isFlexible && (!r.startTime || !r.endTime) ? ' ' + t('makeDefaultNoTimes') : '');
    this.modal.open({
      title: t('makeDefaultTitle'),
      body,
      buttons: [
        { label: this.translate.instant('ADMIN.regimes.common.cancel'), variant: 'secondary', action: m => m.close() },
        { label: t('makeDefault'), variant: 'primary', action: m => { m.close(); this.makeDefault(r); } },
      ],
    });
  }

  private makeDefault(r: WorkingTimeRegime): void {
    const dto = this.toRequest({ ...this.regimeToForm(r), isDefault: true });
    this.svc.updateRegime(r.id, dto).subscribe({
      next: () => {
        this.notify.success(this.translate.instant('ADMIN.regimes.catalog.defaultSet'));
        this.load();
      },
      error: err => this.notify.error(err?.error?.message
        ?? this.translate.instant('ADMIN.regimes.catalog.errorSave')),
    });
  }

  confirmDelete(r: WorkingTimeRegime): void {
    // Known to be in use: say by whom instead of offering a delete the server will refuse.
    // Usage not loaded (a failed detail call): fall through, the server checks and answers.
    const u = this.usageOf(r);
    if (u && (u.roleCount > 0 || u.employeeCount > 0)) {
      this.modal.open({
        title: this.translate.instant('ADMIN.regimes.catalog.deleteTitle'),
        body: this.translate.instant('ADMIN.regimes.catalog.deleteInUseBody', {
          name: this.regimeName(r), roles: u.roleCount, employees: u.employeeCount,
        }),
        buttons: [
          { label: this.translate.instant('ADMIN.regimes.catalog.understood'), variant: 'primary', action: m => m.close() },
        ],
      });
      return;
    }
    this.modal.open({
      title: this.translate.instant('ADMIN.regimes.catalog.deleteTitle'),
      body: this.translate.instant('ADMIN.regimes.catalog.deleteBodyNamed', { name: this.regimeName(r) }),
      buttons: [
        { label: this.translate.instant('ADMIN.regimes.common.cancel'), variant: 'secondary', action: m => m.close() },
        { label: this.translate.instant('ADMIN.regimes.common.delete'), variant: 'primary',
          action: m => { m.close(); this.doDelete(r); } },
      ],
    });
  }

  private doDelete(r: WorkingTimeRegime): void {
    this.svc.deleteRegime(r.id).subscribe({
      next: () => {
        this.notify.success(this.translate.instant('ADMIN.regimes.catalog.deleted'));
        this.load();
      },
      error: err => this.notify.error(err?.error?.message
        ?? this.translate.instant('ADMIN.regimes.common.errorDelete')),
    });
  }

  // ── Library pickers ↔ form strings ─────────────────────────────────────────
  // The form keeps 'HH:mm' and 'YYYY-MM-DD' (what the API takes); daf-time-picker works on
  // {hours, minutes, seconds} and daf-multi-date-picker on Date.

  // Computed (not method calls in the template): a picker gets a NEW object on every change
  // detection otherwise, and a model input re-set mid-pick loses the user's selection.
  readonly startTimeValue    = computed(() => parseTimePickerValue(this.form().startTime));
  readonly endTimeValue      = computed(() => parseTimePickerValue(this.form().endTime));
  readonly seasonalFromValue = computed(() => isoToDate(this.form().seasonalFrom));
  readonly seasonalToValue   = computed(() => isoToDate(this.form().seasonalTo));

  setTime(key: 'startTime' | 'endTime', v: TimePickerValue | null): void {
    this.patch(key, v ? formatTimePickerValue(v) : '');
  }

  setDate(key: 'seasonalFrom' | 'seasonalTo', v: Date | Date[] | null): void {
    this.patch(key, dateToIso(v));
  }

  /** '' and null are « empty »; Number('') would be 0. */
  num(v: number | string | null | undefined): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
