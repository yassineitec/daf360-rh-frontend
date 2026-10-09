import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, SelectComponent, SelectOption } from '@khalilrebhiitec/daf360';
import {
  PermissionOption,
  RecipientDraft,
  RecipientItem,
  RecipientMode,
  RoleOption,
} from './notification-routing.model';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

/**
 * Recipient tags for one channel (in-app, or one of TO / CC / BCC).
 *
 * A recipient is one of three kinds, and the picker changes shape accordingly:
 *  - « Tous »    → every holder of a role
 *  - « Manager » → holders of the role ABOVE that role
 *  - « Droit »   → every holder of a permission, whatever their role
 *
 * The third exists because the hardcoded producers targeted permissions, not roles — an
 * offboarding laptop alert goes to whoever holds the IT stage right. Migrating them onto the
 * routing engine without this mode would have widened every one of those audiences.
 */
@Component({
  selector: 'app-recipient-tags',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, TranslatePipe],
  templateUrl: './recipient-tags.component.html',
  styleUrl: './recipient-tags.component.scss',
})
export class RecipientTagsComponent {
  private readonly translate = inject(TranslateService);

  recipients      = input<RecipientItem[]>([]);
  availableRoles   = input<RoleOption[]>([]);
  availablePerms   = input<PermissionOption[]>([]);
  sectionTitle     = input('');
  field            = input<string>('');

  addRecipient    = output<RecipientDraft>();
  removeRecipient = output<number>();

  showDropdown   = signal(false);
  mode           = signal<RecipientMode>('ALL');
  selectedRoleId = signal<number | null>(null);
  selectedPerm   = signal<string | null>(null);

  readonly modeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('ADMIN.notifications.' + k);
    return [
      { value: 'ALL',                label: t('recipientModeAll') },
      { value: 'MANAGER',            label: t('recipientModeManager') },
      { value: 'PERMISSION',         label: t('recipientModePermission') },
      { value: 'SUBJECT',            label: t('recipientModeSubject') },
      { value: 'MANAGER_OF_SUBJECT', label: t('recipientModeManagerOfSubject') },
    ];
  });

  readonly isPermissionMode = computed(() => this.mode() === 'PERMISSION');

  /**
   * SUBJECT and MANAGER_OF_SUBJECT need no second field at all: they resolve from the event,
   * not from configuration. Asking for a role would imply the choice matters — it does not.
   */
  readonly isContextMode = computed(() =>
    this.mode() === 'SUBJECT' || this.mode() === 'MANAGER_OF_SUBJECT');

  /**
   * Roles not already used IN THE SAME MODE. The same role can legitimately appear twice —
   * once as « Tous » and once as « Manager » — so filtering on role alone would block a valid
   * combination.
   */
  readonly roleOptions = computed<SelectOption[]>(() => {
    const taken = this.recipients()
      .filter(r => (r.recipientMode ?? 'ALL') === this.mode())
      .map(r => r.roleId);
    return this.availableRoles()
      .filter(r => !taken.includes(r.id))
      .map(r => ({ value: String(r.id), label: r.frenchName }));
  });

  readonly permOptions = computed<SelectOption[]>(() => {
    const taken = this.recipients().map(r => r.permissionCode).filter(Boolean);
    return this.availablePerms()
      .filter(p => !taken.includes(p.code))
      .map(p => ({ value: p.code, label: `${p.group} — ${p.code}` }));
  });

  readonly selectedRoleValue = computed(() =>
    this.selectedRoleId() != null ? [String(this.selectedRoleId())] : []);
  readonly selectedPermValue = computed(() =>
    this.selectedPerm() ? [this.selectedPerm()!] : []);
  readonly modeValue = computed(() => [this.mode()]);

  /** True once the current draft is complete enough to send. */
  readonly canAdd = computed(() => {
    if (this.isContextMode()) return true;              // nothing left to pick
    return this.isPermissionMode() ? !!this.selectedPerm() : this.selectedRoleId() != null;
  });

  // ── Tag labels ─────────────────────────────────────────────────────────────

  /** A PERMISSION recipient has no role, so it is labelled by its code. */
  tagLabel(r: RecipientItem): string {
    switch (r.recipientMode ?? 'ALL') {
      case 'PERMISSION':         return r.permissionCode ?? '—';
      case 'SUBJECT':            return this.t('tagSubject');
      case 'MANAGER_OF_SUBJECT': return this.t('tagManagerOfSubject');
      default:                   return r.roleName ?? '—';
    }
  }

  /** Suffix that makes the targeting visible on the tag itself. */
  tagSuffix(r: RecipientItem): string {
    switch (r.recipientMode ?? 'ALL') {
      case 'MANAGER':            return this.t('tagSuffixManager');
      case 'PERMISSION':         return this.t('tagSuffixPermission');
      case 'SUBJECT':            return this.t('tagSuffixAuto');
      case 'MANAGER_OF_SUBJECT': return this.t('tagSuffixAuto');
      default:                   return this.t('tagSuffixAll');
    }
  }

  private t(key: string): string {
    return this.translate.instant('ADMIN.notifications.' + key);
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  onModeChange(value: string): void {
    this.mode.set((value as RecipientMode) ?? 'ALL');
    // Clear the other kind's selection so a mode switch can never submit a stale target.
    this.selectedRoleId.set(null);
    this.selectedPerm.set(null);
  }

  onSelectRole(value: string): void {
    this.selectedRoleId.set(value ? Number(value) : null);
  }

  onSelectPerm(value: string): void {
    this.selectedPerm.set(value || null);
  }

  onAdd(): void {
    if (!this.canAdd()) return;
    // A context mode sends the mode alone: there is deliberately nothing else to send.
    if (this.isContextMode()) {
      this.addRecipient.emit({ mode: this.mode() });
    } else if (this.isPermissionMode()) {
      this.addRecipient.emit({ mode: 'PERMISSION', permissionCode: this.selectedPerm()! });
    } else {
      this.addRecipient.emit({ mode: this.mode(), roleId: this.selectedRoleId()! });
    }
    this.reset();
  }

  onRemove(id: number): void {
    this.removeRecipient.emit(id);
  }

  reset(): void {
    this.selectedRoleId.set(null);
    this.selectedPerm.set(null);
    this.mode.set('ALL');
    this.showDropdown.set(false);
  }
}
