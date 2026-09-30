import {
  Component, OnChanges, SimpleChanges, TemplateRef, computed, inject, input, signal, untracked, viewChild,
} from '@angular/core';
import {
  ButtonComponent, CheckboxComponent, DafCellDirective, DataTableComponent,
  FormFieldComponent, SelectComponent, SelectOption, SortDirection, TableColumn, TableConfig, TableRow,
  PaginationComponent, ModalService, ModalRef, PermissionService,
} from '@khalilrebhiitec/daf360';
import { RegimeService } from '../regime.service';
import { WorkingTimeRegime, RegimeRoleAssignmentResponse, AssignRegimeToRoleRequest, RoleRow } from '../regime.model';
import { RoleManagementService } from '../../roles/role-management.service';
import { RoleListItem } from '../../roles/role.model';
import { TableSort, sortByColumn, toTableSort } from '../../../../shared/table-sort.utils';

/** What each column sorts on. A role with no assignment has no regime / dates → sorts last. */
const ROLE_ASSIGNMENT_SORT: Record<string, (r: RoleRow) => string | number | null> = {
  role:    r => r.roleName || null,
  regime:  r => r.assignment?.regimeLabelFr || null,
  effFrom: r => r.assignment?.effectiveFrom?.slice(0, 10) || null, // ISO: string order = date order
  effTo:   r => r.assignment?.effectiveTo?.slice(0, 10) || null,
  notes:   r => r.assignment?.notes || null,
};
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-regime-role-assignment',
  standalone: true,
  imports: [
    DataTableComponent, DafCellDirective,
    ButtonComponent, CheckboxComponent, FormFieldComponent, SelectComponent,
    PaginationComponent, TranslatePipe,
  ],
  templateUrl: './regime-role-assignment.component.html',
  styleUrl: './regime-role-assignment.component.scss',
})
export class RegimeRoleAssignmentComponent implements OnChanges {
  private svc      = inject(RegimeService);
  private roleSvc  = inject(RoleManagementService);
  private translate = inject(TranslateService);
  private modal    = inject(ModalService);
  private perms    = inject(PermissionService);
  private modalRef?: ModalRef;
  bodyTplAssign = viewChild.required<TemplateRef<unknown>>('bodyTplAssign');
  bodyTplRemove = viewChild.required<TemplateRef<unknown>>('bodyTplRemove');

  readonly paysId = input<number>(179);

  // ── State ──────────────────────────────────────────────────────────────────
  regimes        = signal<WorkingTimeRegime[]>([]);
  assignments    = signal<RegimeRoleAssignmentResponse[]>([]);
  allRoles       = signal<RoleListItem[]>([]);
  loading        = signal(true);
  isAssigning    = signal(false);
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
  /** Table header sort — applied to the whole list, before paging (`manualSort`). */
  readonly sort = signal<TableSort | null>(null);


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
    { key: 'role', label: this.translate.instant('ADMIN.regimes.roles.columns.role'), sortable: true },
    { key: 'regime', label: this.translate.instant('ADMIN.regimes.roles.columns.regime'), sortable: true },
    { key: 'effFrom', label: this.translate.instant('ADMIN.regimes.roles.columns.effFrom'), sortable: true },
    { key: 'effTo', label: this.translate.instant('ADMIN.regimes.roles.columns.effTo'), sortable: true },
    { key: 'notes', label: this.translate.instant('ADMIN.regimes.roles.columns.notes'), sortable: true },
  ];

  readonly totalElements = computed(() => this.allRolesWithAssignment().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / this.PAGE_SIZE));

  readonly pagedRoles = computed(() => {
    const start = this.currentPage() * this.PAGE_SIZE;
    return sortByColumn(this.allRolesWithAssignment(), this.sort(), ROLE_ASSIGNMENT_SORT)
      .slice(start, start + this.PAGE_SIZE);
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
    const hasPerm = () => this.perms.has('ADMIN_REGIMES');
    const tr = (k: string) => this.translate.instant(k);
    // A seed read once by the table — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      showHeader: false,
      hoverable: true,
      emptyMessage: this.translate.instant('ADMIN.regimes.roles.empty'),
      // Stable row identity: row heights are keyed by it, not by render index.
      rowId: (row: TableRow) => (row['_source'] as RoleRow).roleId,
      resizableColumns:  true,
      resizableRows:     true,
      columnPicker:      true,
      columnPickerLabel: tr('REQUESTS.TABLE.COLUMN_PICKER'),
      showReset:         true,
      resetLabel:        tr('REQUESTS.TABLE.RESET'),
      sortLabel:         tr('REQUESTS.TABLE.SORT_BY'),
      // Rows are one client-side page; this component sorts the whole list (sortByColumn).
      manualSort:        true,
      ...(sort ? { defaultSort: sort } : {}),
      actions: [
        {
          id: 'assign', icon: 'add',
          tooltip: this.translate.instant('ADMIN.regimes.roleAssign.assign'),
          hidden: (row: TableRow) => !hasPerm() || !!(row['_source'] as RoleRow).assignment,
          onClick: (row: TableRow) => this.openAssignModal(row['_source'] as RoleRow),
        },
        {
          id: 'edit', icon: 'edit',
          tooltip: this.translate.instant('ADMIN.regimes.common.edit'),
          hidden: (row: TableRow) => !hasPerm() || !(row['_source'] as RoleRow).assignment,
          onClick: (row: TableRow) => this.openAssignModal(row['_source'] as RoleRow),
        },
        {
          id: 'delete', icon: 'delete', variant: 'danger',
          tooltip: this.translate.instant('ADMIN.regimes.common.delete'),
          hidden: (row: TableRow) => !hasPerm() || !(row['_source'] as RoleRow).assignment,
          onClick: (row: TableRow) => this.openRemoveModal(row['_source'] as RoleRow),
        },
      ],
    };
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  /** Header click (or the reset icon): a new order makes the current page meaningless. */
  onSortChange(key: string, dir: SortDirection): void {
    this.sort.set(toTableSort(key, dir));
    this.currentPage.set(0);
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
    this.modalRef = this.modal.open({
      title: this.translate.instant('ADMIN.regimes.roleAssign.assignModalTitle'),
      body: this.bodyTplAssign(),
      closeOnBackdrop: false,
    });
  }

  openRemoveModal(row: RoleRow): void {
    this.selectedRow.set(row);
    this.errorMsg.set(null);
    this.modalRef = this.modal.open({
      title: this.translate.instant('ADMIN.regimes.roleAssign.removeModalTitle'),
      body: this.bodyTplRemove(),
      closeOnBackdrop: false,
    });
  }

  cancel(): void {
    this.modalRef?.close();
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
        this.modalRef?.close();
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
        this.modalRef?.close();
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
