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
  ButtonComponent, FormFieldComponent, SelectComponent, SelectOption, ToggleComponent,
} from '@khalilrebhiitec/daf360';
import { RoleListItem } from '../role.model';
import { RoleManagementService } from '../role-management.service';

@Component({
  selector: 'app-role-info-tab',
  standalone: true,
  imports: [ButtonComponent, FormFieldComponent, SelectComponent, ToggleComponent],
  templateUrl: './role-info-tab.component.html',
  styleUrl: './role-info-tab.component.scss',
})
export class RoleInfoTabComponent {
  role = input.required<RoleListItem>();
  allRoles = input<RoleListItem[]>([]);
  roleUpdated = output<RoleListItem>();
  roleDeleted = output<number>();

  private svc = inject(RoleManagementService);

  frenchName        = signal('');
  parentRoleId      = signal<number | null>(null);
  showAll           = signal(false);
  saving            = signal(false);
  deleting          = signal(false);
  error             = signal<string | null>(null);
  success           = signal<string | null>(null);
  showDeleteConfirm = signal(false);

  otherRoles = computed(() => this.allRoles().filter(r => r.id !== this.role().id));

  parentRoleOptions = computed<SelectOption[]>(() =>
    this.otherRoles().map(r => ({ value: String(r.id), label: r.frenchName })),
  );

  parentRoleSelected(): string[] {
    const id = this.parentRoleId();
    return id ? [String(id)] : [];
  }

  onParentRoleChange(value: string[]): void {
    this.parentRoleId.set(value[0] ? Number(value[0]) : null);
  }

  constructor() {
    effect(() => {
      const r = this.role();
      this.frenchName.set(r.frenchName);
      this.parentRoleId.set(r.parentRoleId ?? null);
      this.showAll.set(r.showAll ?? false);
      this.error.set(null);
      this.success.set(null);
      this.showDeleteConfirm.set(false);
    });
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    this.svc
      .updateRole(this.role().id, {
        frenchName:   this.frenchName(),
        parentRoleId: this.parentRoleId(),
        showAll:      this.showAll(),
      })
      .subscribe({
        next: updated => {
          this.saving.set(false);
          this.success.set('Modifications enregistrees.');
          this.roleUpdated.emit(updated);
        },
        error: err => {
          this.saving.set(false);
          this.error.set(
            err?.error?.message ?? 'Une erreur est survenue lors de la sauvegarde.',
          );
        },
      });
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
        this.error.set(
          err?.error?.message ?? 'Impossible de supprimer ce role.',
        );
      },
    });
  }
}
