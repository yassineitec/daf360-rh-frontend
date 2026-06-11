import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoleListItem } from './role.model';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.scss',
})
export class RoleListComponent {
  // Inputs
  roles          = input<RoleListItem[]>([]);
  selectedRoleId = input<number | null>(null);
  loading        = input(false);

  // Outputs
  roleSelected   = output<RoleListItem>();
  createClicked  = output<void>();
  deleteClicked  = output<RoleListItem>();

  // State
  searchQuery = signal('');

  filteredRoles = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.roles();
    return this.roles().filter(r =>
      r.frenchName.toLowerCase().includes(q)
    );
  });
}
