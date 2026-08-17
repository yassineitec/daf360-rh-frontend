import { Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ButtonComponent, CheckboxComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { RoleManagementService } from '../role-management.service';
import { PermissionGroup, RoleListItem } from '../role.model';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-role-permissions-tab',
  standalone: true,
  imports: [ButtonComponent, CheckboxComponent, StatusBadgeComponent, TranslatePipe],
  templateUrl: './role-permissions-tab.component.html',
  styleUrl: './role-permissions-tab.component.scss',
})
export class RolePermissionsTabComponent implements OnInit {
  role = input.required<RoleListItem>();
  permissionsUpdated = output<RoleListItem>();

  private svc = inject(RoleManagementService);
  private translate = inject(TranslateService);

  catalog        = signal<PermissionGroup[]>([]);
  loadingCatalog = signal(true);
  checkedSet     = signal<Set<string>>(new Set());
  pendingCodes   = signal<Set<string>>(new Set());
  saving         = signal(false);
  error          = signal<string | null>(null);
  success        = signal<string | null>(null);
  expandedGroups = signal<Set<string>>(new Set());

  /** Every code the RH catalog knows about. */
  private catalogCodes = computed(
    () => new Set(this.catalog().flatMap(g => g.permissions.map(p => p.code))),
  );

  /**
   * Codes this role actually holds that the catalog does NOT return, shown in their own
   * group so the tab stops hiding part of the role's real permissions.
   *
   * GET /api/hr/admin/permissions/catalog only serves RH's own PermissionCatalog.GROUPS.
   * The other modules keep their codes in their own catalogs — 26 FACT_* in
   * FactPermissionCatalog and 2 POINTAGE_* in pointage — yet all of them are stored in the
   * same RolePermissions table and are perfectly valid grants. Without this group a role
   * holding them showed a checked count higher than the total, with the extra codes
   * nowhere on screen.
   */
  extraGroup = computed<PermissionGroup | null>(() => {
    const known = this.catalogCodes();
    if (known.size === 0) return null; // catalog still loading — do not flag everything
    const extras = [...new Set([...this.role().permissions, ...this.checkedSet()])]
      .filter(code => !known.has(code))
      .sort();
    if (extras.length === 0) return null;
    return {
      groupName: this.translate.instant('ADMIN.roles.permissions.OTHER_MODULES_GROUP'),
      permissions: extras.map(code => ({ code, label: this.describeExternal(code) })),
    };
  });

  /** Catalog groups plus the out-of-catalog group, which is what the template renders. */
  displayGroups = computed<PermissionGroup[]>(() => {
    const extra = this.extraGroup();
    return extra ? [...this.catalog(), extra] : this.catalog();
  });

  totalPermissions = computed(() =>
    this.displayGroups().reduce((acc, g) => acc + g.permissions.length, 0),
  );
  checkedCount = computed(() => this.checkedSet().size);

  /** No label is available for another module's code, so name the owning module instead. */
  private describeExternal(code: string): string {
    const key = code.startsWith('FACT_')     ? 'OTHER_MODULES_FACT'
              : code.startsWith('POINTAGE_') ? 'OTHER_MODULES_POINTAGE'
              : code.startsWith('PAYROLL_')  ? 'OTHER_MODULES_PAYROLL'
              :                                'OTHER_MODULES_UNKNOWN';
    return this.translate.instant(`ADMIN.roles.permissions.${key}`);
  }

  /** True for codes that saveAll() cannot remove — see clearAll(). */
  isExternal(code: string): boolean {
    const known = this.catalogCodes();
    return known.size > 0 && !known.has(code);
  }

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

        this.error.set(this.translate.instant('ADMIN.roles.permissions.TOGGLE_ERROR'));
      },
    });
  }

  selectAll(): void {
    // Union, not replace: dropping the out-of-catalog codes here would show them unchecked
    // while they are still granted in the DB, since saveAll() cannot remove them.
    this.checkedSet.set(new Set([
      ...this.checkedSet(),
      ...this.catalog().flatMap(g => g.permissions.map(p => p.code)),
    ]));
  }

  /**
   * Clears only what saveAll() is able to remove. PATCH /permissions deliberately deletes
   * just this module's codes and preserves other modules' grants, so clearing an external
   * code here would leave the UI claiming it is gone while the row survives. Those are
   * unchecked one at a time instead — the per-code DELETE does remove them.
   */
  clearAll(): void {
    this.checkedSet.set(new Set(
      [...this.checkedSet()].filter(code => this.isExternal(code)),
    ));
  }

  saveAll(): void {
    // Snapshot current checkedSet BEFORE any async operation
    const codes = [...this.checkedSet()];
    this.saving.set(true);
    this.error.set(null);

    this.svc.updateAllPermissions(this.role().id, codes).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(this.translate.instant('ADMIN.roles.permissions.SAVE_SUCCESS'));
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
        // ProblemDetail puts the message in `detail`; `message` is always undefined here.
        this.error.set(
          err?.error?.detail
            ?? err?.error?.message
            ?? this.translate.instant('ADMIN.roles.permissions.SAVE_ERROR'),
        );
      },
    });
  }
}
