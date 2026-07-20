import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, SelectComponent, SelectOption } from '@khalilrebhiitec/daf360';
import { RecipientItem, RoleOption } from './notification-routing.model';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-recipient-tags',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, TranslatePipe],
  templateUrl: './recipient-tags.component.html',
  styleUrl: './recipient-tags.component.scss',
})
export class RecipientTagsComponent {
  recipients     = input<RecipientItem[]>([]);
  availableRoles = input<RoleOption[]>([]);
  sectionTitle   = input('');
  field          = input<string>('');

  addRecipient    = output<number>();
  removeRecipient = output<number>();

  showDropdown  = signal(false);
  selectedRoleId = signal<number | null>(null);

  unassignedRoles = computed(() =>
    this.availableRoles().filter(r =>
      !this.recipients().some(recip => recip.roleId === r.id)
    )
  );

  roleOptions = computed<SelectOption[]>(() =>
    this.unassignedRoles().map(r => ({ value: String(r.id), label: r.frenchName }))
  );

  selectedRoleValue = computed(() =>
    this.selectedRoleId() != null ? [String(this.selectedRoleId())] : []
  );

  onSelectRole(value: string): void {
    this.selectedRoleId.set(value ? Number(value) : null);
  }

  onAdd(): void {
    const id = this.selectedRoleId();
    if (id !== null) {
      this.addRecipient.emit(id);
      this.selectedRoleId.set(null);
      this.showDropdown.set(false);
    }
  }

  onRemove(id: number): void {
    this.removeRecipient.emit(id);
  }
}
