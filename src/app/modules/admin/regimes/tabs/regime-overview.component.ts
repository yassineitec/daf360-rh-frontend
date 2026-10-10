import {
  Component, OnChanges, SimpleChanges, TemplateRef, computed, inject, input, signal, untracked, viewChild,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  AvatarCell, BadgeCell, BadgeOptions, ButtonComponent, CardComponent, CheckboxComponent,
  DafCellDirective, DataTableComponent, FormFieldComponent, SelectComponent, SelectOption,
  SortDirection, TableColumn, TableConfig, TableRow, PaginationComponent, ModalService, ModalRef,
  PermissionService, SearchToolbarComponent,
} from '@khalilrebhiitec/daf360';
import { RegimeService } from '../regime.service';
import { TableSort, rankIn, searchRows, sortByColumn, toTableSort } from '../../../../shared/table-sort.utils';
import {
  RegimeOverviewStats, EmployeeRegimeOverview, WorkingTimeRegime,
  AssignEmployeeOverrideRequest,
} from '../regime.model';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { adminLabel } from '../../../../shared/utils/admin-label.utils';

type SourceFilter = 'ALL' | 'EMPLOYEE_OVERRIDE' | 'ROLE_ASSIGNMENT' | 'DEFAULT' | 'UNCONFIGURED';

@Component({
  selector: 'app-regime-overview',
  standalone: true,
  imports: [
    NgClass, DataTableComponent, DafCellDirective,
    ButtonComponent, CardComponent, CheckboxComponent, FormFieldComponent, SelectComponent,
    PaginationComponent, SearchToolbarComponent, TranslatePipe,
  ],
  templateUrl: './regime-overview.component.html',
  styleUrl: './regime-overview.component.scss',
})
export class RegimeOverviewComponent implements OnChanges {
  private svc   = inject(RegimeService);
  private modal = inject(ModalService);
  private translate = inject(TranslateService);
  private perms = inject(PermissionService);
  private modalRef?: ModalRef;
  bodyTpl = viewChild.required<TemplateRef<unknown>>('bodyTpl');

  readonly paysId = input<number>(179);

  // ── State ──────────────────────────────────────────────────────────────────
  stats          = signal<RegimeOverviewStats | null>(null);
  employees      = signal<EmployeeRegimeOverview[]>([]);
  regimes        = signal<WorkingTimeRegime[]>([]);
  isLoadingStats = signal(true);
  isLoadingTable = signal(true);

  // Filters
  searchTerm    = signal('');
  activeFilter  = signal<SourceFilter>('ALL');

  // Pagination — 5 per page, client-side over the filtered list
  readonly PAGE_SIZE = 5;
  currentPage = signal(0);
  /** Table header sort — applied to the whole filtered list, before paging (`manualSort`). */
  readonly sort = signal<TableSort | null>(null);

  /** Which rule gave an employee their regime — in the order they override each other. */
  private static readonly SOURCE_ORDER = ['SEASONAL', 'EMPLOYEE_OVERRIDE', 'ROLE_ASSIGNMENT', 'DEFAULT'] as const;

  /** What each overview column sorts on. "Non configuré" (no source) always sorts last. */
  private readonly sortValues: Record<string, (e: EmployeeRegimeOverview) => string | number | null> = {
    employe: e => e.fullName || null,
    role:    e => e.roleName || null,
    regime:  e => this.regimeLabel(e) || null,
    source:  e => (e.assignmentLevel
      ? rankIn(RegimeOverviewComponent.SOURCE_ORDER as readonly string[], e.assignmentLevel) : null),
  };

  /** New search → back to the first page (else one can sit on an empty page). */
  onSearch(value: string): void {
    if (value === this.searchTerm()) return;   // daf-search-toolbar re-emits on blur
    this.searchTerm.set(value);
    this.currentPage.set(0);
  }

  onFilterChange(value: SourceFilter): void {
    this.activeFilter.set(value);
    this.currentPage.set(0);
  }

  // Employee panel
  showOverrideForm  = signal(false);
  selectedEmployee  = signal<EmployeeRegimeOverview | null>(null);

  // Override form fields
  overrideRegimeId  = 0;
  overrideEffFrom   = '';
  overrideEffTo     = '';
  overrideReason    = '';
  noEndDate         = signal(true);
  isSaving          = signal(false);
  panelError        = signal<string | null>(null);

  /**
   * The employee's regime in the UI language. The overview DTO carries only the French label,
   * so the English one is looked up in the loaded catalog by id (French when not found).
   */
  regimeLabel(e: EmployeeRegimeOverview | null | undefined): string | null {
    if (!e) return null;
    const r = this.regimes().find(r => r.id === e.resolvedRegimeId);
    return r ? adminLabel(r, this.translate) : e.resolvedRegimeLabelFr;
  }

  regimeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return this.regimes().map(r => ({ value: String(r.id), label: `${adminLabel(r, this.translate)} ·${r.hoursPerWeek}${this.translate.instant('ADMIN.regimes.common.hoursPerWeekShort')}` }));
  });

  overrideRegimeSelected(): string[] {
    return this.overrideRegimeId ? [String(this.overrideRegimeId)] : [];
  }

  onOverrideRegimeChange(value: string[]): void {
    this.overrideRegimeId = value[0] ? Number(value[0]) : 0;
  }

  // Computed (not a field): re-labelled when the user switches language.
  readonly sourceFilters = computed<{ value: SourceFilter; label: string }[]>(() => {
    this.translate.currentLang();
    return [
      { value: 'ALL',              label: this.translate.instant('ADMIN.regimes.overview.filters.ALL')          },
      { value: 'EMPLOYEE_OVERRIDE', label: this.translate.instant('ADMIN.regimes.overview.filters.OVERRIDE')    },
      { value: 'ROLE_ASSIGNMENT',  label: this.translate.instant('ADMIN.regimes.overview.filters.BY_ROLE')      },
      { value: 'DEFAULT',          label: this.translate.instant('ADMIN.regimes.overview.filters.DEFAULT')      },
      { value: 'UNCONFIGURED',     label: this.translate.instant('ADMIN.regimes.overview.filters.UNCONFIGURED') },
    ];
  });

  filteredEmployees = computed(() => {
    this.translate.currentLang();
    // Searches what the row shows: name, role, regime (or « Aucun ») and the source badge.
    let list = searchRows(this.employees(), this.searchTerm(), e => [
      e.fullName, e.roleName,
      this.regimeLabel(e) || this.translate.instant('ADMIN.regimes.overview.regimeNone'),
      this.getSourceLabel(e.assignmentLevel),
    ]);
    const f = this.activeFilter();
    if (f !== 'ALL') {
      if (f === 'UNCONFIGURED') list = list.filter(e => !e.assignmentLevel);
      else list = list.filter(e => e.assignmentLevel === f);
    }
    return list;
  });

  // `manualSort`: no sortAccessor — this component sorts (sortByColumn + sortValues).
  // Computed so the headers follow a language switch.
  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'employe', label: this.translate.instant('ADMIN.regimes.overview.columns.employee'), type: 'avatar', sortable: true },
      { key: 'role', label: this.translate.instant('ADMIN.regimes.overview.columns.role'), sortable: true },
      { key: 'regime', label: this.translate.instant('ADMIN.regimes.overview.columns.regime'), sortable: true },
      { key: 'source', label: this.translate.instant('ADMIN.regimes.overview.columns.source'), type: 'badge', sortable: true },
    ];
  });

  readonly totalElements = computed(() => this.filteredEmployees().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / this.PAGE_SIZE));

  readonly pagedEmployees = computed(() => {
    const start = this.currentPage() * this.PAGE_SIZE;
    return sortByColumn(this.filteredEmployees(), this.sort(), this.sortValues)
      .slice(start, start + this.PAGE_SIZE);
  });

  readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.pagedEmployees().map(e => ({
      employe: { name: e.fullName, initials: this.getInitials(e.fullName) } as AvatarCell,
      role: e.roleName ?? '—',
      regime: this.regimeLabel(e),
      source: { label: this.getSourceLabel(e.assignmentLevel), options: this.sourceBadgeOptions(e.assignmentLevel) } as BadgeCell,
      _source: e,
    }));
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  /** Header click (or the reset icon): a new order makes the current page meaningless. */
  onSortChange(key: string, dir: SortDirection): void {
    this.sort.set(toTableSort(key, dir));
    this.currentPage.set(0);
  }

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // A seed read once by the table — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      showHeader: false,
      hoverable: true,
      loading: this.isLoadingTable(),
      skeletonRows: 5,
      emptyMessage: this.translate.instant('ADMIN.regimes.overview.empty'),
      // Stable row identity: row heights are keyed by it, not by render index.
      rowId: (row: TableRow) => (row['_source'] as EmployeeRegimeOverview).userId,
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
      actions: [{
        id: 'edit', icon: 'edit',
        tooltip: this.translate.instant('ADMIN.regimes.common.edit'),
        hidden: () => !this.perms.has('ADMIN_REGIMES'),
        onClick: (row: TableRow) => this.openEmployeePanel(row['_source'] as EmployeeRegimeOverview),
      }],
    };
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['paysId']) { this.loadAll(); }
  }

  loadAll(): void {
    this.isLoadingStats.set(true);
    this.isLoadingTable.set(true);
    this.svc.getOverviewStats(this.paysId()).subscribe({
      next: s => { this.stats.set(s); this.isLoadingStats.set(false); },
      error: () => this.isLoadingStats.set(false),
    });
    this.svc.getOverviewEmployees(this.paysId()).subscribe({
      next: es => { this.employees.set(es); this.isLoadingTable.set(false); },
      error: () => this.isLoadingTable.set(false),
    });
    this.svc.getRegimes(this.paysId()).subscribe({ next: rs => this.regimes.set(rs) });
  }

  openEmployeePanel(emp: EmployeeRegimeOverview): void {
    this.selectedEmployee.set(emp);
    this.showOverrideForm.set(false);
    this.panelError.set(null);
    this.overrideRegimeId = emp.resolvedRegimeId ?? (this.regimes()[0]?.id ?? 0);
    this.overrideEffFrom  = new Date().toISOString().split('T')[0];
    this.overrideEffTo    = '';
    this.overrideReason   = '';
    this.noEndDate.set(true);
    this.modalRef = this.modal.open({
      title: emp.fullName ?? '',
      body: this.bodyTpl(),
      closeOnBackdrop: false,
    });
  }

  confirmOverride(): void {
    const emp = this.selectedEmployee();
    if (!emp || !this.overrideRegimeId || !this.overrideEffFrom || !this.overrideReason) return;
    this.isSaving.set(true);
    const dto: AssignEmployeeOverrideRequest = {
      regimeId: this.overrideRegimeId,
      effectiveFrom: this.overrideEffFrom,
      effectiveTo: this.noEndDate() ? undefined : this.overrideEffTo || undefined,
      reason: this.overrideReason,
    };
    this.svc.assignEmployeeOverride(emp.employeeProfileId, dto).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.modalRef?.close();
        this.loadAll();
      },
      error: err => {
        this.isSaving.set(false);
        this.panelError.set(err?.error?.message ?? this.translate.instant('ADMIN.regimes.overview.errorAssign'));
      },
    });
  }

  removeOverride(): void {
    const emp = this.selectedEmployee();
    if (!emp) return;
    this.modal.open({
      title: this.translate.instant('ADMIN.regimes.overview.removeOverrideTitle'),
      body:  this.translate.instant('ADMIN.regimes.overview.removeOverrideBody'),
      buttons: [
        { label: this.translate.instant('ADMIN.regimes.common.cancel'),   variant: 'secondary', action: r => r.close() },
        { label: this.translate.instant('ADMIN.regimes.common.delete'), variant: 'primary',   action: r => { this.doRemoveOverride(emp); r.close(); } },
      ],
    });
  }

  private doRemoveOverride(emp: EmployeeRegimeOverview): void {
    this.svc.removeEmployeeOverride(emp.employeeProfileId).subscribe({
      next: () => { this.modalRef?.close(); this.loadAll(); },
      error: err => this.panelError.set(err?.error?.message ?? this.translate.instant('ADMIN.regimes.overview.errorGeneric')),
    });
  }

  getSourceLabel(level: string | null | undefined): string {
    const m: Record<string, string> = {
      EMPLOYEE_OVERRIDE: this.translate.instant('ADMIN.regimes.overview.source.OVERRIDE'),
      ROLE_ASSIGNMENT: this.translate.instant('ADMIN.regimes.overview.source.BY_ROLE'),
      DEFAULT: this.translate.instant('ADMIN.regimes.overview.source.DEFAULT'),
    };
    return level ? (m[level] ?? level) : this.translate.instant('ADMIN.regimes.overview.source.UNCONFIGURED');
  }

  getSourceClass(level: string | null | undefined): object {
    return {
      'source-override': level === 'EMPLOYEE_OVERRIDE',
      'source-role':     level === 'ROLE_ASSIGNMENT',
      'source-default':  level === 'DEFAULT',
      'source-none':     !level,
    };
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }

  sourceBadgeOptions(level: string | null | undefined): BadgeOptions {
    switch (level) {
      case 'EMPLOYEE_OVERRIDE': return { variant: 'teal' };
      case 'ROLE_ASSIGNMENT':   return { variant: 'secondary' };
      case 'DEFAULT':           return { variant: 'neutral' };
      default:                  return { variant: 'danger' };
    }
  }
}
