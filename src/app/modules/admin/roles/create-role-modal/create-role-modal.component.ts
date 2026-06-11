import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/modal.component';
import { RoleManagementService } from '../role-management.service';
import { RoleListItem } from '../role.model';

@Component({
  selector: 'app-create-role-modal',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: './create-role-modal.component.html',
  styleUrl: './create-role-modal.component.scss',
})
export class CreateRoleModalComponent {
  visible  = input(false);
  allRoles = input<RoleListItem[]>([]);

  closed      = output<void>();
  roleCreated = output<RoleListItem>();

  private svc = inject(RoleManagementService);

  frenchName   = signal('');
  parentRoleId = signal<number | null>(null);
  showAll      = signal(false);
  saving       = signal(false);
  error        = signal<string | null>(null);

  create(): void {
    if (!this.frenchName().trim()) return;
    this.saving.set(true);
    this.error.set(null);

    this.svc
      .createRole({
        frenchName:   this.frenchName().trim(),
        parentRoleId: this.parentRoleId(),
        showAll:      this.showAll(),
      })
      .subscribe({
        next: (role) => {
          this.saving.set(false);
          this.roleCreated.emit(role);
          this.reset();
          this.closed.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'Erreur lors de la création.');
        },
      });
  }

  reset(): void {
    this.frenchName.set('');
    this.parentRoleId.set(null);
    this.showAll.set(false);
    this.error.set(null);
  }

  onParentChange(value: string): void {
    this.parentRoleId.set(value ? Number(value) : null);
  }
}
