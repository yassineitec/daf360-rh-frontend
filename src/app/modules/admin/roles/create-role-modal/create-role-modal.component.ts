import { Component, computed, inject, input, output, signal } from '@angular/core';
import {
  FormFieldComponent,
  SelectComponent, SelectOption,
  ToggleComponent,
  ButtonComponent,
} from '@khalilrebhiitec/daf360';
import { ModalComponent } from '../../../../shared/modal.component';
import { RoleManagementService } from '../role-management.service';
import { RoleListItem } from '../role.model';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-create-role-modal',
  standalone: true,
  imports: [ModalComponent, FormFieldComponent, SelectComponent, ToggleComponent, ButtonComponent, TranslatePipe],
  templateUrl: './create-role-modal.component.html',
  styleUrl: './create-role-modal.component.scss',
})
export class CreateRoleModalComponent {
  visible  = input(false);
  allRoles = input<RoleListItem[]>([]);

  closed      = output<void>();
  roleCreated = output<RoleListItem>();

  private svc = inject(RoleManagementService);
  private translate = inject(TranslateService);

  frenchName   = signal('');
  parentRoleId = signal<number | null>(null);
  showAll      = signal(false);
  saving       = signal(false);
  error        = signal<string | null>(null);

  parentOptions = computed<SelectOption[]>(() =>
    this.allRoles().map(r => ({ value: String(r.id), label: r.frenchName }))
  );

  parentSelected = computed(() =>
    this.parentRoleId() != null ? [String(this.parentRoleId())] : []
  );

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
          this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.roles.create.CREATE_ERROR'));
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
