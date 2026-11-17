import {
  Component, OnChanges, SimpleChanges, TemplateRef, computed, inject, input, signal, untracked, viewChild,
} from '@angular/core';
import {
  ButtonComponent, CheckboxComponent, DafCellDirective, DataTableComponent,
  FormFieldComponent, SelectComponent, SelectOption, SortDirection, TableColumn, TableConfig, TableRow,
  PaginationComponent, ModalService, ModalRef, PermissionService, SearchToolbarComponent,
  MultiDatePickerComponent,
} from '@khalilrebhiitec/daf360';
import { RegimeService } from '../regime.service';
import { WorkingTimeRegime, RegimeRoleAssignmentResponse, AssignRegimeToRoleRequest, RoleRow } from '../regime.model';
import { RoleManagementService } from '../../roles/role-management.service';
import { RoleListItem } from '../../roles/role.model';
import { TableSort, searchRows, sortByColumn, toTableSort } from '../../../../shared/table-sort.utils';

/** What each column sorts on. A role with no assignment has no regime / dates → sorts last.
 *  The regime sorts on the label shown — see `sortAccessors`. */
const ROLE_ASSIGNMENT_SORT: Record<string, (r: RoleRow) => string | number | null> = {
  role:    r => r.roleName || null,
  effFrom: r => r.assignment?.effectiveFrom?.slice(0, 10) || null, // ISO: string order = date order
  effTo:   r => r.assignment?.effectiveTo?.slice(0, 10) || null,
  notes:   r => r.assignment?.notes || null,
};
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { adminLabel, roleLabel } from '../../../../shared/utils/admin-label.utils';
import { rememberAdminState } from '../../admin-section-state';
import { dateToIso, isoToDate } from '../regime-dates';

@Component({
  selector: 'app-regime-role-assignment',
  standalone: true,
  imports: [
    DataTableComponent, DafCellDirective,
    ButtonComponent, CheckboxComponent, FormFieldComponent, SelectComponent,
    PaginationComponent, SearchToolbarComponent, TranslatePipe, MultiDatePickerComponent,
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
  /** Same dates for daf-multi-date-picker — kept as fields so the picker gets a stable Date. */
  formEffFromDate: Date | null = null;
  formEffToDate:   Date | null = null;

  onEffFrom(v: Date | Date[] | null): void {
    this.formEffFrom = dateToIso(v);
    this.formEffFromDate = isoToDate(this.formEffFrom);
  }

  onEffTo(v: Date | Date[] | null): void {
    this.formEffTo = dateToIso(v);
    this.formEffToDate = isoToDate(this.formEffTo);
  }

  // Pagination — 5 per page
  readonly PAGE_SIZE = 5;
  currentPage = signal(0);
  /** Table header sort — applied to the whole filtered list, before paging (`manualSort`). */
  readonly sort = signal<TableSort | null>(null);
  /** Search over the roles (toolbar above the table). */
  searchQuery = signal('');

  // ── Mémoire de la section ──────────────────────────────────────────────────
  /** Recherche, tri et page gardés tant qu'on reste dans /rh/admin (voir `rememberAdminState`). */
  private readonly memory = rememberAdminState('regimes.role-assignment', {
    currentPage: this.currentPage, sort: this.sort, searchQuery: this.searchQuery,
  });

  /** The table (absent while loading) — fed to the toolbar's `[table]`. */
  readonly table = viewChild(DataTableComponent);

  /** New search → back to the first page (else one can sit on an empty page). */
  onSearch(value: string): void {
    if (value === this.searchQuery()) return;   // daf-search-toolbar re-emits on blur
    this.searchQuery.set(value);
    this.currentPage.set(0);
  }


  // Merge roles + assignments. The server lists, per role, the assignment in force today
  // and any scheduled one (V127: a change planned for next month no longer ends the
  // current one early). Row = the one in force (else the first scheduled), plus the next
  // scheduled change when there is one after it.
  allRolesWithAssignment = computed<RoleRow[]>(() => {
    const byRole = new Map<number, RegimeRoleAssignmentResponse[]>();
    for (const a of this.assignments()) {
      const list = byRole.get(a.roleId) ?? [];
      list.push(a);
      byRole.set(a.roleId, list);
    }
    return this.allRoles().map(r => {
      const list = [...(byRole.get(r.id) ?? [])]
        .sort((x, y) => x.effectiveFrom.localeCompare(y.effectiveFrom));
      const current  = [...list].reverse().find(a => !a.upcoming) ?? null;
      const upcoming = list.filter(a => a.upcoming);
      return {
        roleId: r.id,
        roleName: roleLabel(r, this.translate),
        assignment: current ?? upcoming[0] ?? null,
        upcoming: current ? (upcoming[0] ?? null) : (upcoming[1] ?? null),
      };
    });
  });

  /** Label of a regime by id, in the UI language. */
  regimeLabelOf(a: RegimeRoleAssignmentResponse | null | undefined): string | null {
    if (!a) return null;
    const r = this.regimes().find(x => x.id === a.regimeId);
    return r ? adminLabel(r, this.translate) : a.regimeLabelFr;
  }

  defaultRegimeName = computed(() => {
    const r = this.regimes().find(r => r.isDefault);
    return r ? adminLabel(r, this.translate) : null;
  });

  /**
   * The assigned regime in the UI language. The assignment DTO carries only the French label,
   * so the English one is looked up in the loaded catalog by id (French when not found).
   */
  regimeLabel(row: RoleRow): string | null {
    return this.regimeLabelOf(row.assignment);
  }

  private readonly sortAccessors: typeof ROLE_ASSIGNMENT_SORT = {
    ...ROLE_ASSIGNMENT_SORT,
    regime: r => this.regimeLabel(r) || null,
  };

  /** Searches what the row shows: role, regime (or the « Défaut (…) » fallback), dates, notes. */
  readonly filteredRoles = computed(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const fallback = `${t('ADMIN.regimes.roleAssign.defaultLabel')} (${this.defaultRegimeName() ?? t('ADMIN.regimes.roleAssign.notConfigured')})`;
    return searchRows(this.allRolesWithAssignment(), this.searchQuery(), row => [
      row.roleName,
      this.regimeLabel(row) || fallback,
      row.assignment ? this.formatDate(row.assignment.effectiveFrom) : null,
      row.assignment?.effectiveTo ? this.formatDate(row.assignment.effectiveTo) : null,
      row.assignment?.notes,
    ]);
  });

  affectedCount = computed(() => {
    const row = this.selectedRow();
    if (!row) return 0;
    // approximate: userCount from role (if available)
    const role = this.allRoles().find(r => r.id === row.roleId);
    return role?.userCount ?? 0;
  });

  // Seasonal regimes apply to the whole entity through their own window: the server refuses
  // them as a role assignment, so they are not offered.
  regimeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return this.regimes().filter(r => !r.seasonalFrom).map(r => ({
      value: String(r.id),
      label: `${adminLabel(r, this.translate)} ·${r.hoursPerWeek}${this.translate.instant('ADMIN.regimes.common.hoursPerWeekShort')}${r.isFlexible ? this.translate.instant('ADMIN.regimes.roles.flexibleSuffix') : ''}`,
    }));
  });

  formRegimeSelected(): string[] {
    return this.formRegimeId ? [String(this.formRegimeId)] : [];
  }

  onFormRegimeChange(value: string[]): void {
    this.formRegimeId = value[0] ? Number(value[0]) : 0;
  }

  // Computed so the headers follow a language switch.
  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'role', label: this.translate.instant('ADMIN.regimes.roles.columns.role'), sortable: true },
      { key: 'regime', label: this.translate.instant('ADMIN.regimes.roles.columns.regime'), sortable: true },
      { key: 'effFrom', label: this.translate.instant('ADMIN.regimes.roles.columns.effFrom'), sortable: true },
      { key: 'effTo', label: this.translate.instant('ADMIN.regimes.roles.columns.effTo'), sortable: true },
      { key: 'notes', label: this.translate.instant('ADMIN.regimes.roles.columns.notes'), sortable: true },
    ];
  });

  readonly totalElements = computed(() => this.filteredRoles().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / this.PAGE_SIZE));

  readonly pagedRoles = computed(() => {
    const start = this.currentPage() * this.PAGE_SIZE;
    return sortByColumn(this.filteredRoles(), this.sort(), this.sortAccessors)
      .slice(start, start + this.PAGE_SIZE);
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedRoles().map(row => ({
      role: row.roleName,
      regime: this.regimeLabel(row),
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
    if (changes['paysId']) {
      // Premier passage : on garde la page restaurée (`rememberAdminState`) ; seul un vrai
      // changement d'entité repart de la première page.
      if (!changes['paysId'].firstChange) this.currentPage.set(0);
      this.loadData();
    }
  }

  loadData(): void {
    this.loading.set(true);
    // Load regimes, assignments, and roles in parallel
    let pending = 3;
    const done = () => {
      if (--pending > 0) return;
      // Page restaurée (ou liste raccourcie) : on retombe sur la dernière page existante.
      this.currentPage.update(p => Math.min(p, Math.max(0, this.totalPages() - 1)));
      this.loading.set(false);
    };

    this.svc.getRegimes(this.paysId()).subscribe({ next: rs => { this.regimes.set(rs); done(); }, error: done });
    this.svc.getRoleAssignments(this.paysId()).subscribe({ next: as => { this.assignments.set(as); done(); }, error: done });
    this.roleSvc.getRoles().subscribe({ next: rs => { this.allRoles.set(rs); done(); }, error: done });
  }

  openAssignModal(row: RoleRow): void {
    this.selectedRow.set(row);
    const assignable = this.regimes().filter(r => !r.seasonalFrom);
    this.formRegimeId = row.assignment?.regimeId ?? (assignable[0]?.id ?? 0);
    // A change always creates a NEW assignment from this date (the current one keeps
    // applying until the day before) — so it starts today, not on the old start date,
    // which would rewrite the past.
    this.formEffFrom  = this.todayIso();
    this.formEffTo    = '';
    this.formEffFromDate = isoToDate(this.formEffFrom);
    this.formEffToDate   = null;
    this.formNotes    = row.assignment?.notes ?? '';
    this.noEndDate.set(true);
    this.errorMsg.set(null);
    this.modalRef = this.modal.open({
      minWidth:    '360px',
      minHeight:   '260px',
      resizable:   true,
      maximizable: true,
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
      next: () => {
        // The server may have ended or cancelled other rows of this role: reload them.
        this.isAssigning.set(false);
        this.modalRef?.close();
        this.reloadAssignments();
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
        this.modalRef?.close();
        this.reloadAssignments();
      },
      error: err => this.errorMsg.set(err?.error?.message ?? this.translate.instant('ADMIN.regimes.common.errorDelete')),
    });
  }

  private reloadAssignments(): void {
    this.svc.getRoleAssignments(this.paysId()).subscribe(as => this.assignments.set(as));
  }

  /** Today as YYYY-MM-DD in the browser's calendar (not UTC: toISOString shifts it near midnight). */
  private todayIso(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  formatDate(d: string): string {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
  }
}
