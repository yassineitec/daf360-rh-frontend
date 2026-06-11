import {
  Component, OnChanges, SimpleChanges, computed, inject, input, signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegimeService } from '../regime.service';
import { WorkingTimeRegime, RegimeRoleAssignmentResponse, AssignRegimeToRoleRequest, RoleRow } from '../regime.model';
import { RoleManagementService } from '../../roles/role-management.service';
import { RoleListItem } from '../../roles/role.model';
import { PermissionDirective } from '../../../../shared/permission.directive';

@Component({
  selector: 'app-regime-role-assignment',
  standalone: true,
  imports: [NgClass, FormsModule, PermissionDirective],
  templateUrl: './regime-role-assignment.component.html',
  styleUrl: './regime-role-assignment.component.scss',
})
export class RegimeRoleAssignmentComponent implements OnChanges {
  private svc      = inject(RegimeService);
  private roleSvc  = inject(RoleManagementService);

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

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['paysId']) { this.loadData(); }
  }

  loadData(): void {
    this.loading.set(true);
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
        this.errorMsg.set(err?.error?.message ?? 'Erreur lors de l\'assignation.');
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
      error: err => this.errorMsg.set(err?.error?.message ?? 'Erreur lors de la suppression.'),
    });
  }

  formatDate(d: string): string {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
  }
}
