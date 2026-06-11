import {
  Component, OnChanges, SimpleChanges, computed, inject, input, signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegimeService } from '../regime.service';
import {
  RegimeOverviewStats, EmployeeRegimeOverview, WorkingTimeRegime,
  AssignEmployeeOverrideRequest,
} from '../regime.model';
import { PermissionDirective } from '../../../../shared/permission.directive';

type SourceFilter = 'ALL' | 'EMPLOYEE_OVERRIDE' | 'ROLE_ASSIGNMENT' | 'DEFAULT' | 'UNCONFIGURED';

@Component({
  selector: 'app-regime-overview',
  standalone: true,
  imports: [NgClass, FormsModule, PermissionDirective],
  templateUrl: './regime-overview.component.html',
  styleUrl: './regime-overview.component.scss',
})
export class RegimeOverviewComponent implements OnChanges {
  private svc = inject(RegimeService);

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

  skeletonRows = [1,2,3,4,5];

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
    if (!confirm('Supprimer l\'override et revenir au régime du rôle ?')) return;
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
}
