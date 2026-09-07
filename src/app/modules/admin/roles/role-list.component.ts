import { Component, computed, inject, input, output, signal, effect } from '@angular/core';
import {
  PaginationComponent, ButtonComponent, FormFieldComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';
import { RoleListItem } from './role.model';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [
    PaginationComponent, ButtonComponent, FormFieldComponent,
    DataTableComponent, DafCellDirective,
    TranslatePipe,
  ],
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.scss',
})
export class RoleListComponent {
  private translate = inject(TranslateService);

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
  mobileSearchOpen = signal(false);

  pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  filteredRoles = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.roles();
    return this.roles().filter(r =>
      r.frenchName.toLowerCase().includes(q)
    );
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredRoles().length / this.pageSize())));

  pagedRoles = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredRoles().slice(start, start + this.pageSize());
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'name',    label: this.translate.instant('ADMIN.roles.list.COL_NAME') },
      { key: 'details', label: this.translate.instant('ADMIN.roles.list.COL_DETAILS') },
      { key: 'parent',  label: this.translate.instant('ADMIN.roles.list.COL_PARENT') },
    ];
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedRoles().map(r => ({
      name:    r.frenchName,
      parent:  r.parentRoleName ?? null,
      _source: r,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => ({
    hoverable: true,
    emptyMessage: this.translate.instant('ADMIN.roles.list.EMPTY'),
    actions: [{
      id: 'delete', icon: 'delete',
      tooltip: this.translate.instant('ADMIN.roles.list.DELETE_TOOLTIP'),
      disabled: (row: TableRow) => (row['_source'] as RoleListItem).userCount > 0,
      onClick: (row: TableRow) => this.deleteClicked.emit(row['_source'] as RoleListItem),
    }],
  }));

  private resetPageOnFilterChange = effect(() => {
    this.filteredRoles();
    this.currentPage.set(0);
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  /** `pageSizeChange` fires alone — go back to page 0 with the new size (same as /rh/profiles). */
  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
  }
}
