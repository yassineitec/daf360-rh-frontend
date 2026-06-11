import { Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoleManagementService } from '../role-management.service';
import { PermissionGroup, RoleListItem } from '../role.model';

@Component({
  selector: 'app-role-permissions-tab',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './role-permissions-tab.component.html',
  styleUrl: './role-permissions-tab.component.scss',
})
export class RolePermissionsTabComponent implements OnInit {
  role = input.required<RoleListItem>();
  permissionsUpdated = output<RoleListItem>();

  private svc = inject(RoleManagementService);

  catalog        = signal<PermissionGroup[]>([]);
  loadingCatalog = signal(true);
  checkedSet     = signal<Set<string>>(new Set());
  pendingCodes   = signal<Set<string>>(new Set());
  saving         = signal(false);
  error          = signal<string | null>(null);
  success        = signal<string | null>(null);
  expandedGroups = signal<Set<string>>(new Set());

  totalPermissions = computed(() =>
    this.catalog().reduce((acc, g) => acc + g.permissions.length, 0),
  );
  checkedCount = computed(() => this.checkedSet().size);

  // Track role ID so we only re-initialise checkedSet when switching roles,
  // NOT on every permission update emitted back from this component.
  private readonly _roleId = computed(() => this.role().id);

  constructor() {
    // Load permission catalog once (cached in the service)
    this.svc.getPermissionCatalog().subscribe(groups => {
      this.catalog.set(groups);
      this.loadingCatalog.set(false);
      this.expandedGroups.set(new Set(groups.map(g => g.groupName)));
    });

    // Re-initialise checkedSet ONLY when a DIFFERENT role is selected (ID changes).
    effect(() => {
      this._roleId(); // tracked — fires only when role ID changes
      untracked(() => {
        this.checkedSet.set(new Set(this.role().permissions));
        this.error.set(null);
        this.success.set(null);
      });
    });
  }

  ngOnInit(): void {
    // Synchronous init — populate checkedSet immediately from the role's current
    // permissions so it's never empty on first render (effects run asynchronously).
    this.checkedSet.set(new Set(this.role().permissions));
  }

  toggleGroup(groupName: string): void {
    const s = new Set(this.expandedGroups());
    if (s.has(groupName)) s.delete(groupName); else s.add(groupName);
    this.expandedGroups.set(s);
  }

  isExpanded(groupName: string): boolean { return this.expandedGroups().has(groupName); }
  isChecked(code: string): boolean { return this.checkedSet().has(code); }
  isPending(code: string): boolean { return this.pendingCodes().has(code); }

  groupCheckedCount(group: PermissionGroup): number {
    return group.permissions.filter(p => this.isChecked(p.code)).length;
  }

  toggle(code: string): void {
    const was = this.isChecked(code);

    // Optimistic local update — do NOT emit to parent (avoids resetting checkedSet via effect)
    const next = new Set(this.checkedSet());
    if (was) next.delete(code); else next.add(code);
    this.checkedSet.set(next);

    const pending = new Set(this.pendingCodes());
    pending.add(code);
    this.pendingCodes.set(pending);

    const call$ = was
      ? this.svc.removePermission(this.role().id, code)
      : this.svc.addPermission(this.role().id, code);

    call$.subscribe({
      next: () => {
        const p = new Set(this.pendingCodes());
        p.delete(code);
        this.pendingCodes.set(p);
        // Permission saved — no parent emit needed here; saveAll() will sync when user is done.
      },
      error: () => {
        // Revert optimistic update
        const revert = new Set(this.checkedSet());
        if (was) revert.add(code); else revert.delete(code);
        this.checkedSet.set(revert);

        const p = new Set(this.pendingCodes());
        p.delete(code);
        this.pendingCodes.set(p);

        this.error.set('Impossible de modifier la permission — réessayez');
      },
    });
  }

  selectAll(): void {
    const allCodes = this.catalog().flatMap(g => g.permissions.map(p => p.code));
    this.checkedSet.set(new Set(allCodes));
  }

  clearAll(): void { this.checkedSet.set(new Set()); }

  saveAll(): void {
    // Snapshot current checkedSet BEFORE any async operation
    const codes = [...this.checkedSet()];
    this.saving.set(true);
    this.error.set(null);

    this.svc.updateAllPermissions(this.role().id, codes).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set('Permissions mises à jour avec succès.');
        // Emit using LOCAL codes (what we just saved) — not the server response,
        // which avoids any risk of the parent resetting checkedSet via the effect.
        this.permissionsUpdated.emit({
          ...this.role(),
          permissions: codes,
          permissionCount: codes.length,
        });
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Erreur lors de la sauvegarde.');
      },
    });
  }
}
