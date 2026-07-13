import { Component, computed, input, output, signal, effect } from '@angular/core';
import { CardComponent, PaginationComponent, PaginationConfig, ButtonComponent, FormFieldComponent } from '@khalilrebhiitec/daf360';
import { RoleListItem } from './role.model';

const PAGE_SIZE = 5;

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [CardComponent, PaginationComponent, ButtonComponent, FormFieldComponent],
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
  currentPage = signal(0);

  readonly paginationConfig: PaginationConfig = {
    showFirstLast: true,
    showPrevNext:  true,
    maxVisible:    5,
    size:          'sm',
  };

  filteredRoles = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.roles();
    return this.roles().filter(r =>
      r.frenchName.toLowerCase().includes(q)
    );
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredRoles().length / PAGE_SIZE)));

  pagedRoles = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.filteredRoles().slice(start, start + PAGE_SIZE);
  });

  private resetPageOnFilterChange = effect(() => {
    this.filteredRoles();
    this.currentPage.set(0);
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }
}
