import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  ButtonComponent, FormFieldComponent, SelectComponent, SelectOption,
} from '@khalilrebhiitec/daf360';
import { PaysOption, PaysScopeMode, RoleListItem, UpdateRoleRequest } from '../role.model';
import { RoleManagementService } from '../role-management.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-role-info-tab',
  standalone: true,
  imports: [ButtonComponent, FormFieldComponent, SelectComponent, TranslatePipe],
  templateUrl: './role-info-tab.component.html',
  styleUrl: './role-info-tab.component.scss',
})
export class RoleInfoTabComponent {
  role = input.required<RoleListItem>();
  allRoles = input<RoleListItem[]>([]);
  roleUpdated = output<RoleListItem>();
  roleDeleted = output<number>();

  private svc = inject(RoleManagementService);
  private translate = inject(TranslateService);

  frenchName        = signal('');
  parentRoleId      = signal<number | null>(null);
  paysScopeMode     = signal<PaysScopeMode>('OWN');
  paysScope         = signal<number[]>([]);
  paysOptions       = signal<PaysOption[]>([]);
  saving            = signal(false);
  deleting          = signal(false);
  error             = signal<string | null>(null);
  success           = signal<string | null>(null);
  showDeleteConfirm = signal(false);
  /** Set when the backend refuses a rename because users are still assigned (422). */
  renameConflict    = signal(false);

  otherRoles = computed(() => this.allRoles().filter(r => r.id !== this.role().id));

  parentRoleOptions = computed<SelectOption[]>(() =>
    this.otherRoles().map(r => ({ value: String(r.id), label: r.frenchName })),
  );

  scopeModeOptions = computed<SelectOption[]>(() => [
    { value: 'OWN',  label: this.translate.instant('ADMIN.roles.info.SCOPE_MODE_OWN') },
    { value: 'LIST', label: this.translate.instant('ADMIN.roles.info.SCOPE_MODE_LIST') },
    { value: 'ALL',  label: this.translate.instant('ADMIN.roles.info.SCOPE_MODE_ALL') },
  ]);

  paysSelectOptions = computed<SelectOption[]>(() =>
    this.paysOptions().map(p => ({
      value: String(p.id),
      label: p.frenchLabel ?? p.isoCode ?? String(p.id),
    })),
  );

  /** The country list only means anything in LIST mode — see PaysScopeMode. */
  showCountryPicker = computed(() => this.paysScopeMode() === 'LIST');

  /** Hint text under the mode select, so the OWN/LIST distinction is explicit in the UI. */
  scopeModeHint = computed(() =>
    this.translate.instant(`ADMIN.roles.info.SCOPE_HINT_${this.paysScopeMode()}`),
  );

  parentRoleSelected(): string[] {
    const id = this.parentRoleId();
    return id ? [String(id)] : [];
  }

  onParentRoleChange(value: string[]): void {
    this.parentRoleId.set(value[0] ? Number(value[0]) : null);
  }

  scopeModeSelected(): string[] { return [this.paysScopeMode()]; }

  onScopeModeChange(value: string[]): void {
    const mode = (value[0] ?? 'OWN') as PaysScopeMode;
    this.paysScopeMode.set(mode);
    // Leaving stale ids selected while switching to OWN/ALL would send a list the backend
    // rejects (a list is only valid in LIST mode), so clear the picker with the mode.
    if (mode !== 'LIST') this.paysScope.set([]);
  }

  paysScopeSelected(): string[] { return this.paysScope().map(String); }

  onPaysScopeChange(value: string[]): void {
    this.paysScope.set(value.map(Number).filter(n => !Number.isNaN(n)));
  }

  constructor() {
    this.svc.getPaysOptions().subscribe(list => this.paysOptions.set(list));

    effect(() => {
      const r = this.role();
      this.frenchName.set(r.frenchName);
      this.parentRoleId.set(r.parentRoleId ?? null);
      // Tolerate a backend that predates V74 (no mode in the payload).
      this.paysScopeMode.set(r.paysScopeMode ?? (r.showAll ? 'ALL' : 'OWN'));
      this.paysScope.set(r.paysScope ?? []);
      this.error.set(null);
      this.success.set(null);
      this.showDeleteConfirm.set(false);
      this.renameConflict.set(false);
    });
  }

  save(force = false): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    const dto: UpdateRoleRequest = {
      frenchName:    this.frenchName(),
      parentRoleId:  this.parentRoleId(),
      paysScopeMode: this.paysScopeMode(),
      // showAll is derived server-side from the mode, but the older payload shape is still
      // sent so a backend without V74 keeps behaving as before.
      showAll:       this.paysScopeMode() === 'ALL',
      // Only send the list in LIST mode: anywhere else the backend rejects a non-empty list,
      // and [] would wipe a list the admin may want back when switching modes again.
      ...(this.paysScopeMode() === 'LIST' ? { paysScope: this.paysScope() } : {}),
      ...(force ? { forceRename: true } : {}),
    };

    this.svc.updateRole(this.role().id, dto).subscribe({
      next: updated => {
        this.saving.set(false);
        this.renameConflict.set(false);
        this.success.set(this.translate.instant('ADMIN.roles.info.SAVE_SUCCESS'));
        this.roleUpdated.emit(updated);
      },
      error: err => {
        this.saving.set(false);
        // Renaming a role that still has users assigned is refused with 422 /
        // INVALID_TRANSITION until forceRename is set. Surface it as a confirmation rather
        // than a dead end — the previous version showed a generic message and left the
        // admin with no way to proceed.
        if (this.isRenameConflict(err)) {
          this.renameConflict.set(true);
          return;
        }
        this.error.set(this.extractError(err, 'ADMIN.roles.info.SAVE_ERROR'));
      },
    });
  }

  confirmRename(): void {
    this.renameConflict.set(false);
    this.save(true);
  }

  cancelRename(): void {
    this.renameConflict.set(false);
    this.frenchName.set(this.role().frenchName);
  }

  private isRenameConflict(err: unknown): boolean {
    const e = err as { status?: number; error?: { code?: string } };
    return e?.status === 422 && e?.error?.code === 'INVALID_TRANSITION';
  }

  /**
   * The API returns RFC 7807 ProblemDetail — the human message is in `detail`, not
   * `message`. Reading only `message` is why every backend error rendered as the generic
   * fallback text.
   */
  private extractError(err: unknown, fallbackKey: string): string {
    const e = err as { error?: { detail?: string; message?: string } };
    return e?.error?.detail ?? e?.error?.message ?? this.translate.instant(fallbackKey);
  }

  confirmDelete(): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.error.set(null);

    this.svc.deleteRole(this.role().id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.roleDeleted.emit(this.role().id);
      },
      error: err => {
        this.deleting.set(false);
        this.showDeleteConfirm.set(false);
        this.error.set(this.extractError(err, 'ADMIN.roles.info.DELETE_ERROR'));
      },
    });
  }
}
