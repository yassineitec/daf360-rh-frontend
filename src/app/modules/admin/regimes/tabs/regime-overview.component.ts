import {
  Component, OnChanges, SimpleChanges, computed, inject, input, signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  AvatarCell, BadgeCell, BadgeOptions, ButtonComponent, CardComponent, CheckboxComponent,
  DafCellDirective, DataTableComponent, FormFieldComponent, SelectComponent, SelectOption,
  TableColumn, TableConfig, TableRow, PaginationComponent, ModalService,
} from '@khalilrebhiitec/daf360';
import { RegimeService } from '../regime.service';
import {
  RegimeOverviewStats, EmployeeRegimeOverview, WorkingTimeRegime,
  AssignEmployeeOverrideRequest,
} from '../regime.model';
import { DafHasPermissionDirective } from '@khalilrebhiitec/daf360';
import { ModalComponent } from '../../../../shared/modal.component';
import { RhSearchBarComponent } from '../../../../shared/search-bar.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

type SourceFilter = 'ALL' | 'EMPLOYEE_OVERRIDE' | 'ROLE_ASSIGNMENT' | 'DEFAULT' | 'UNCONFIGURED';

@Component({
  selector: 'app-regime-overview',
  standalone: true,
  imports: [
    NgClass, DafHasPermissionDirective, DataTableComponent, DafCellDirective,
    ButtonComponent, CardComponent, CheckboxComponent, FormFieldComponent, SelectComponent, ModalComponent,
    PaginationComponent, RhSearchBarComponent, TranslatePipe,
  ],
  templateUrl: './regime-overview.component.html',
  styleUrl: './regime-overview.component.scss',
})
export class RegimeOverviewComponent implements OnChanges {
  private svc   = inject(RegimeService);
  private modal = inject(ModalService);
  private translate = inject(TranslateService);

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

  onSearch(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(0);
  }

  onFilterChange(value: SourceFilter): void {
    this.activeFilter.set(value);
    this.currentPage.set(0);
  }

  // Employee panel
  showEmployeePanel = signal(false);
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

  regimeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return this.regimes().map(r => ({ value: String(r.id), label: `${r.labelFr} · ${r.hoursPerWeek}${this.translate.instant('ADMIN.regimes.common.hoursPerWeekShort')}` }));
  });

  overrideRegimeSelected(): string[] {
    return this.overrideRegimeId ? [String(this.overrideRegimeId)] : [];
  }

  onOverrideRegimeChange(value: string[]): void {
    this.overrideRegimeId = value[0] ? Number(value[0]) : 0;
  }

  sourceFilters: { value: SourceFilter; label: string }[] = [
    { value: 'ALL',              label: this.translate.instant('ADMIN.regimes.overview.filters.ALL')          },
    { value: 'EMPLOYEE_OVERRIDE', label: this.translate.instant('ADMIN.regimes.overview.filters.OVERRIDE')    },
    { value: 'ROLE_ASSIGNMENT',  label: this.translate.instant('ADMIN.regimes.overview.filters.BY_ROLE')      },
    { value: 'DEFAULT',          label: this.translate.instant('ADMIN.regimes.overview.filters.DEFAULT')      },
    { value: 'UNCONFIGURED',     label: this.translate.instant('ADMIN.regimes.overview.filters.UNCONFIGURED') },
  ];

  filteredEmployees = computed(() => {
    let list = this.employees();
    const q = this.searchTerm().toLowerCase();
    if (q) list = list.filter(e => e.fullName?.toLowerCase().includes(q) || e.roleName?.toLowerCase().includes(q));
    const f = this.activeFilter();
    if (f !== 'ALL') {
      if (f === 'UNCONFIGURED') list = list.filter(e => !e.assignmentLevel);
      else list = list.filter(e => e.assignmentLevel === f);
    }
    return list;
  });

  readonly columns: TableColumn[] = [
    { key: 'employe', label: this.translate.instant('ADMIN.regimes.overview.columns.employee'), type: 'avatar' },
    { key: 'role', label: this.translate.instant('ADMIN.regimes.overview.columns.role') },
    { key: 'regime', label: this.translate.instant('ADMIN.regimes.overview.columns.regime') },
    { key: 'source', label: this.translate.instant('ADMIN.regimes.overview.columns.source'), type: 'badge' },
    { key: '_actions', label: this.translate.instant('ADMIN.regimes.common.action'), align: 'right' },
  ];

  readonly totalElements = computed(() => this.filteredEmployees().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / this.PAGE_SIZE));

  readonly pagedEmployees = computed(() => {
    const start = this.currentPage() * this.PAGE_SIZE;
    return this.filteredEmployees().slice(start, start + this.PAGE_SIZE);
  });

  readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.pagedEmployees().map(e => ({
      employe: { name: e.fullName, initials: this.getInitials(e.fullName) } as AvatarCell,
      role: e.roleName ?? '—',
      regime: e.resolvedRegimeLabelFr,
      source: { label: this.getSourceLabel(e.assignmentLevel), options: this.sourceBadgeOptions(e.assignmentLevel) } as BadgeCell,
      _source: e,
    }));
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      hoverable: true,
      loading: this.isLoadingTable(),
      skeletonRows: 5,
      emptyMessage: this.translate.instant('ADMIN.regimes.overview.empty'),
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
    this.showEmployeePanel.set(true);
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
        this.showEmployeePanel.set(false);
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
      next: () => { this.showEmployeePanel.set(false); this.loadAll(); },
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
