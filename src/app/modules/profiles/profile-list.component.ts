import {
  Component, OnInit, computed, inject, signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  Subject, forkJoin, catchError, of, debounceTime, distinctUntilChanged,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BulkActionBarComponent, BulkAction,
  PaginationComponent, PaginationConfig,
} from '@khalilrebhiitec/daf360';

import { ProfileListService, FilterOptions } from './services/profile-list.service';
import { EmployeeListItem } from './models/profile.model';
import { ProfileGridCardComponent } from './components/profile-grid-card/profile-grid-card.component';
import { ProfileListCardComponent } from './components/profile-list-card/profile-list-card.component';
import { ProfileSearchBarComponent } from './components/profile-search-bar/profile-search-bar.component';

const PAGE_SIZE = 15;

@Component({
  selector: 'app-profile-list',
  standalone: true,
  imports: [
    RouterLink,
    ProfileGridCardComponent,
    ProfileListCardComponent,
    ProfileSearchBarComponent,
    BulkActionBarComponent,
    PaginationComponent,
  ],
  templateUrl: './profile-list.component.html',
})
export class ProfileListComponent implements OnInit {
  private svc    = inject(ProfileListService);
  private router = inject(Router);

  employees      = signal<EmployeeListItem[]>([]);
  loading        = signal(true);
  error          = signal(false);
  viewMode       = signal<'grid' | 'list'>('grid');
  searchQuery    = signal('');
  activeFilters  = signal<Record<string, string>>({});
  currentPage    = signal(0);
  totalPages     = signal(0);
  totalElements  = signal(0);
  filterOptions  = signal<FilterOptions>({ departments: [], grades: [], pays: [] });

  /* ── Selection ──────────────────────────────────────────────────────────── */
  selectedIds = signal<Set<number>>(new Set());

  selectedCount = computed(() => this.selectedIds().size);

  isAllSelected = computed(() => {
    const withProfile = this.employees().filter(e => e.profileId !== null);
    return withProfile.length > 0 &&
           withProfile.every(e => this.selectedIds().has(e.profileId!));
  });

  /* ── Derived ────────────────────────────────────────────────────────────── */
  activeFilterTags = computed(() =>
    Object.entries(this.activeFilters())
      .filter(([, v]) => !!v)
      .map(([k, v]) => ({ key: k, value: v }))
  );

  pageNumbers = computed(() => {
    const total   = this.totalPages();
    const current = this.currentPage();
    const window  = 5;
    const start   = Math.max(0, Math.min(current - 2, total - window));
    const end     = Math.min(total, start + window);
    return Array.from({ length: end - start }, (_, i) => start + i);
  });

  private search$ = new Subject<string>();

  constructor() {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(query => {
      this.searchQuery.set(query);
      this.currentPage.set(0);
      this.clearSelection();
      this.loadEmployees();
    });
  }

  ngOnInit(): void {
    forkJoin({
      list: this.svc.getEmployees({ page: 0, size: PAGE_SIZE }).pipe(catchError(() => of(null))),
      opts: this.svc.getFilterOptions(),
    }).subscribe(({ list, opts }) => {
      this.loading.set(false);
      if (list) {
        this.employees.set(list.content);
        this.totalElements.set(list.totalElements);
        this.totalPages.set(list.totalPages);
      } else {
        this.error.set(true);
      }
      this.filterOptions.set(opts);
    });
  }

  loadEmployees(): void {
    this.loading.set(true);
    this.error.set(false);
    const f = this.activeFilters();
    this.svc.getEmployees({
      page:       this.currentPage(),
      size:       PAGE_SIZE,
      search:     this.searchQuery() || undefined,
      department: f['department'],
      pays:       f['pays'],
      grade:      f['grade'],
    }).pipe(catchError(() => of(null)))
    .subscribe(res => {
      this.loading.set(false);
      if (res) {
        this.employees.set(res.content);
        this.totalElements.set(res.totalElements);
        this.totalPages.set(res.totalPages);
      } else {
        this.error.set(true);
      }
    });
  }

  onSearch(query: string): void {
    this.search$.next(query);
  }

  onFilterChange(key: string, value: string): void {
    this.activeFilters.update(f => ({ ...f, [key]: value }));
    this.currentPage.set(0);
    this.clearSelection();
    this.loadEmployees();
  }

  removeFilter(key: string): void {
    this.activeFilters.update(f => {
      const copy = { ...f };
      delete copy[key];
      return copy;
    });
    this.currentPage.set(0);
    this.loadEmployees();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.activeFilters.set({});
    this.currentPage.set(0);
    this.clearSelection();
    this.loadEmployees();
  }

  onPageChange(page: number): void {
    this.clearSelection();
    this.currentPage.set(page);
    this.loadEmployees();
  }

  /* ── Selection methods ──────────────────────────────────────────────────── */
  toggleSelect(profileId: number, checked: boolean): void {
    console.log(profileId);
    
    this.selectedIds.update(set => {
      const next = new Set(set);
      checked ? next.add(profileId) : next.delete(profileId);
      return next;
    });
    console.log(this.selectedIds);
    
  }

  selectAll(): void {
    this.selectedIds.update(() =>
      new Set(
        this.employees()
          .map(e => e.userId)
          .filter((id): id is number => id !== null),
      )
    );
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  /* ── Bulk actions ───────────────────────────────────────────────────────── */
  readonly bulkActions: BulkAction[] = [
    { id: 'export', label: 'Exporter Excel',   icon: 'download'    },
    { id: 'email',  label: 'Email Collectif',   icon: 'mail'        },
    { id: 'status', label: 'Modifier Statut',   icon: 'edit_square' },
    { id: 'delete', label: 'Supprimer',          icon: 'delete', variant: 'danger' },
  ];

  readonly paginationConfig: PaginationConfig = {
    showFirstLast: true,
    showPrevNext:  true,
    maxVisible:    5,
    size:          'md',
  };

  onBulkActionClick(actionId: string): void {
    switch (actionId) {
      case 'export': this.onBulkExport(); break;
      case 'email':  this.onBulkEmail();  break;
      case 'status': console.log('Modifier statut:', [...this.selectedIds()]); break;
      case 'delete': this.onBulkDelete(); break;
    }
  }

  onBulkExport(): void {
    console.log('Export:', [...this.selectedIds()]);
  }

  onBulkEmail(): void {
    console.log('Email:', [...this.selectedIds()]);
  }

  onBulkDelete(): void {
    console.log('Delete:', [...this.selectedIds()]);
  }

  /* ── Navigation ─────────────────────────────────────────────────────────── */
  onViewProfile(profileId: number | null): void {
    if (profileId != null) {
      this.router.navigate(['/profiles', profileId]);
    }
  }

  onEdit(profileId: number): void {
    this.router.navigate(['/profiles', profileId, 'edit']);
  }

  onDelete(profileId: number): void {
    console.log('Delete profile:', profileId);
  }

  toggleViewMode(): void {
    this.viewMode.update(m => m === 'grid' ? 'list' : 'grid');
  }
}
