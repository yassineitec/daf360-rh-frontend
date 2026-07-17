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

type SourceFilter = 'ALL' | 'EMPLOYEE_OVERRIDE' | 'ROLE_ASSIGNMENT' | 'DEFAULT' | 'UNCONFIGURED';

@Component({
  selector: 'app-regime-overview',
  standalone: true,
  imports: [
    NgClass, DafHasPermissionDirective, DataTableComponent, DafCellDirective,
    ButtonComponent, CardComponent, CheckboxComponent, FormFieldComponent, SelectComponent, ModalComponent,
    PaginationComponent, RhSearchBarComponent,
  ],
  templateUrl: './regime-overview.component.html',
  styleUrl: './regime-overview.component.scss',
})
export class RegimeOverviewComponent implements OnChanges {
  private svc   = inject(RegimeService);
  private modal = inject(ModalService);

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

  regimeOptions = computed<SelectOption[]>(() =>
    this.regimes().map(r => ({ value: String(r.id), label: `${r.labelFr} · ${r.hoursPerWeek}h/sem` }))
  );

  overrideRegimeSelected(): string[] {
    return this.overrideRegimeId ? [String(this.overrideRegimeId)] : [];
  }

  onOverrideRegimeChange(value: string[]): void {
    this.overrideRegimeId = value[0] ? Number(value[0]) : 0;
  }

  sourceFilters: { value: SourceFilter; label: string }[] = [
    { value: 'ALL',              label: 'Tous'            },
    { value: 'EMPLOYEE_OVERRIDE', label: 'Override'       },
    { value: 'ROLE_ASSIGNMENT',  label: 'Par rôle'        },
    { value: 'DEFAULT',          label: 'Défaut'          },
    { value: 'UNCONFIGURED',     label: 'Non configuré'   },
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
    { key: 'employe', label: 'Employé', type: 'avatar' },
    { key: 'role', label: 'Rôle' },
    { key: 'regime', label: 'Régime appliqué' },
    { key: 'source', label: 'Source', type: 'badge' },
    { key: '_actions', label: 'Action', align: 'right' },
  ];

  readonly totalElements = computed(() => this.filteredEmployees().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / this.PAGE_SIZE));

  readonly pagedEmployees = computed(() => {
    const start = this.currentPage() * this.PAGE_SIZE;
    return this.filteredEmployees().slice(start, start + this.PAGE_SIZE);
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedEmployees().map(e => ({
      employe: { name: e.fullName, initials: this.getInitials(e.fullName) } as AvatarCell,
      role: e.roleName ?? '—',
      regime: e.resolvedRegimeLabelFr,
      source: { label: this.getSourceLabel(e.assignmentLevel), options: this.sourceBadgeOptions(e.assignmentLevel) } as BadgeCell,
      _source: e,
    })),
  );

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  readonly tableConfig = computed<TableConfig>(() => ({
    hoverable: true,
    loading: this.isLoadingTable(),
    skeletonRows: 5,
    emptyMessage: 'Aucun employé trouvé',
  }));

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
        this.panelError.set(err?.error?.message ?? 'Erreur lors de l\'assignation.');
      },
    });
  }

  removeOverride(): void {
    const emp = this.selectedEmployee();
    if (!emp) return;
    this.modal.open({
      title: 'Supprimer l\'override',
      body:  'Supprimer l\'override et revenir au régime du rôle ?',
      buttons: [
        { label: 'Annuler',   variant: 'secondary', action: r => r.close() },
        { label: 'Supprimer', variant: 'primary',   action: r => { this.doRemoveOverride(emp); r.close(); } },
      ],
    });
  }

  private doRemoveOverride(emp: EmployeeRegimeOverview): void {
    this.svc.removeEmployeeOverride(emp.employeeProfileId).subscribe({
      next: () => { this.showEmployeePanel.set(false); this.loadAll(); },
      error: err => this.panelError.set(err?.error?.message ?? 'Erreur.'),
    });
  }

  getSourceLabel(level: string | null | undefined): string {
    const m: Record<string, string> = {
      EMPLOYEE_OVERRIDE: 'Override', ROLE_ASSIGNMENT: 'Par rôle',
      DEFAULT: 'Défaut',
    };
    return level ? (m[level] ?? level) : 'Non configuré';
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
