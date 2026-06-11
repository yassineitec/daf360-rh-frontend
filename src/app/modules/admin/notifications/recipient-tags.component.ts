import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RecipientItem, RoleOption } from './notification-routing.model';

@Component({
  selector: 'app-recipient-tags',
  standalone: true,
  imports: [FormsModule],
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
