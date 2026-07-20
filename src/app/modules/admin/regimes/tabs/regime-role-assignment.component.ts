import {
  Component, OnChanges, SimpleChanges, computed, inject, input, signal,
} from '@angular/core';
import {
  ButtonComponent, CheckboxComponent, DafCellDirective, DataTableComponent,
  FormFieldComponent, SelectComponent, SelectOption, TableColumn, TableConfig, TableRow,
  PaginationComponent,
} from '@khalilrebhiitec/daf360';
import { RegimeService } from '../regime.service';
import { WorkingTimeRegime, RegimeRoleAssignmentResponse, AssignRegimeToRoleRequest, RoleRow } from '../regime.model';
import { RoleManagementService } from '../../roles/role-management.service';
import { RoleListItem } from '../../roles/role.model';
import { DafHasPermissionDirective } from '@khalilrebhiitec/daf360';
import { ModalComponent } from '../../../../shared/modal.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-regime-role-assignment',
  standalone: true,
  imports: [
    DafHasPermissionDirective, DataTableComponent, DafCellDirective,
    ButtonComponent, CheckboxComponent, FormFieldComponent, SelectComponent, ModalComponent,
    PaginationComponent, TranslatePipe,
  ],
  templateUrl: './regime-role-assignment.component.html',
  styleUrl: './regime-role-assignment.component.scss',
})
export class RegimeRoleAssignmentComponent implements OnChanges {
  private svc      = inject(RegimeService);
  private roleSvc  = inject(RoleManagementService);
  private translate = inject(TranslateService);

  readonly paysId = input<number>(179);

  // ── State ──────────────────────────────────────────────────────────────────
  regimes        = signal<WorkingTimeRegime[]>([]);
  assignments    = signal<RegimeRoleAssignmentResponse[]>([]);
  allRoles       = signal<RoleListItem[]>([]);
  loading        = signal(true);
  isAssigning    = signal(false);
  showAssignModal = signal(false);
  showRemoveModal = signal(false);
  selectedRow    = signal<RoleRow | null>(null);
  errorMsg       = signal<string | null>(null);
  noEndDate      = signal(true);

  // form fields
  formRegimeId    = 0;
  formEffFrom     = '';
  formEffTo       = '';
  formNotes       = '';

  // Pagination — 5 per page
  readonly PAGE_SIZE = 5;
  currentPage = signal(0);

  // Merge roles + assignments
  allRolesWithAssignment = computed<RoleRow[]>(() => {
    const assignMap = new Map<number, RegimeRoleAssignmentResponse>();
    this.assignments().forEach(a => assignMap.set(a.roleId, a));
    return this.allRoles().map(r => ({
      roleId: r.id,
      roleName: r.frenchName,
      assignment: assignMap.get(r.id) ?? null,
    }));
  });

  defaultRegimeName = computed(() =>
    this.regimes().find(r => r.isDefault)?.labelFr ?? null
  );

  affectedCount = computed(() => {
    const row = this.selectedRow();
    if (!row) return 0;
    // approximate: userCount from role (if available)
    const role = this.allRoles().find(r => r.id === row.roleId);
    return role?.userCount ?? 0;
  });

  regimeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return this.regimes().map(r => ({
      value: String(r.id),
      label: `${r.labelFr} · ${r.hoursPerWeek}${this.translate.instant('ADMIN.regimes.common.hoursPerWeekShort')}${r.isFlexible ? this.translate.instant('ADMIN.regimes.roles.flexibleSuffix') : ''}`,
    }));
  });

  formRegimeSelected(): string[] {
    return this.formRegimeId ? [String(this.formRegimeId)] : [];
  }

  onFormRegimeChange(value: string[]): void {
    this.formRegimeId = value[0] ? Number(value[0]) : 0;
  }

  readonly columns: TableColumn[] = [
    { key: 'role', label: this.translate.instant('ADMIN.regimes.roles.columns.role') },
    { key: 'regime', label: this.translate.instant('ADMIN.regimes.roles.columns.regime') },
    { key: 'effFrom', label: this.translate.instant('ADMIN.regimes.roles.columns.effFrom') },
    { key: 'effTo', label: this.translate.instant('ADMIN.regimes.roles.columns.effTo') },
    { key: 'notes', label: this.translate.instant('ADMIN.regimes.roles.columns.notes') },
    { key: '_actions', label: this.translate.instant('ADMIN.regimes.roles.columns.actions'), align: 'right' },
  ];

  readonly totalElements = computed(() => this.allRolesWithAssignment().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / this.PAGE_SIZE));

  readonly pagedRoles = computed(() => {
    const start = this.currentPage() * this.PAGE_SIZE;
    return this.allRolesWithAssignment().slice(start, start + this.PAGE_SIZE);
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedRoles().map(row => ({
      role: row.roleName,
      regime: row.assignment?.regimeLabelFr ?? null,
      effFrom: row.assignment ? this.formatDate(row.assignment.effectiveFrom) : '—',
      effTo: row.assignment?.effectiveTo ? this.formatDate(row.assignment.effectiveTo) : '—',
      notes: row.assignment?.notes ?? '—',
      _source: row,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      hoverable: true,
      emptyMessage: this.translate.instant('ADMIN.regimes.roles.empty'),
    };
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['paysId']) { this.loadData(); }
  }

  loadData(): void {
    this.loading.set(true);
    this.currentPage.set(0);
    // Load regimes, assignments, and roles in parallel
    let pending = 3;
    const done = () => { if (--pending === 0) this.loading.set(false); };

    this.svc.getRegimes(this.paysId()).subscribe({ next: rs => { this.regimes.set(rs); done(); }, error: done });
    this.svc.getRoleAssignments(this.paysId()).subscribe({ next: as => { this.assignments.set(as); done(); }, error: done });
    this.roleSvc.getRoles().subscribe({ next: rs => { this.allRoles.set(rs); done(); }, error: done });
  }

  openAssignModal(row: RoleRow): void {
    this.selectedRow.set(row);
    this.formRegimeId = row.assignment?.regimeId ?? (this.regimes()[0]?.id ?? 0);
    this.formEffFrom  = row.assignment?.effectiveFrom ?? new Date().toISOString().split('T')[0];
    this.formEffTo    = row.assignment?.effectiveTo ?? '';
    this.formNotes    = row.assignment?.notes ?? '';
    this.noEndDate.set(!row.assignment?.effectiveTo);
    this.errorMsg.set(null);
    this.showAssignModal.set(true);
  }

  openRemoveModal(row: RoleRow): void {
    this.selectedRow.set(row);
    this.showRemoveModal.set(true);
  }

  confirmAssign(): void {
    const row = this.selectedRow();
    if (!row || !this.formRegimeId || !this.formEffFrom) return;
    this.isAssigning.set(true);
    const dto: AssignRegimeToRoleRequest = {
      regimeId: this.formRegimeId,
      roleId: row.roleId,
      paysId: this.paysId(),
      effectiveFrom: this.formEffFrom,
      effectiveTo: this.noEndDate() ? undefined : this.formEffTo || undefined,
      notes: this.formNotes || undefined,
    };
    this.svc.assignToRole(dto).subscribe({
      next: a => {
        this.assignments.update(as => {
          const filtered = as.filter(x => x.roleId !== a.roleId);
          return [...filtered, a];
        });
        this.isAssigning.set(false);
        this.showAssignModal.set(false);
      },
      error: err => {
        this.isAssigning.set(false);
        this.errorMsg.set(err?.error?.message ?? this.translate.instant('ADMIN.regimes.roles.errorAssign'));
      },
    });
  }

  confirmRemove(): void {
    const row = this.selectedRow();
    if (!row?.assignment) return;
    this.svc.removeRoleAssignment(row.assignment.id).subscribe({
      next: () => {
        this.assignments.update(as => as.filter(a => a.id !== row.assignment!.id));
        this.showRemoveModal.set(false);
      },
      error: err => this.errorMsg.set(err?.error?.message ?? this.translate.instant('ADMIN.regimes.common.errorDelete')),
    });
  }

  formatDate(d: string): string {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
  }
}
