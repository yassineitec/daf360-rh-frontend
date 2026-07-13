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
  ToolbarAction, ToolbarToggleOption,
  CheckboxComponent,
  ButtonComponent,
  CardComponent,
} from '@khalilrebhiitec/daf360';

import { ProfileListService, FilterOptions } from './services/profile-list.service';
import { EmployeeListItem } from './models/profile.model';
import { ProfileGridCardComponent } from './components/profile-grid-card/profile-grid-card.component';
import { ProfileListCardComponent } from './components/profile-list-card/profile-list-card.component';
import { RhSearchBarComponent } from '../../shared/search-bar.component';

const PAGE_SIZE = 15;

@Component({
  selector: 'app-profile-list',
  standalone: true,
  imports: [
    ProfileGridCardComponent,
    ProfileListCardComponent,
    BulkActionBarComponent,
    PaginationComponent,
    CheckboxComponent,
    ButtonComponent,
    CardComponent,
    RhSearchBarComponent,
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
  mobileSearchOpen = signal(false);
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
    const withProfile = this.employees().filter(e => e.userId !== null);
    return withProfile.length > 0 &&
           withProfile.every(e => this.selectedIds().has(e.userId!));
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
      console.log(res?.content);
      
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
  toggleSelect(userId: number, checked: boolean): void {     
    this.selectedIds.update(set => {
      const next = new Set(set);
      checked ? next.add(userId) : next.delete(userId);
      return next;
    });   
     
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

  readonly toolbarActions: ToolbarAction[] = [
    { id: 'filters', label: 'Filtres avancés', icon: 'tune', position: 'left' },
  ];

  readonly viewToggleOptions: ToolbarToggleOption[] = [
    { id: 'grid', icon: 'grid_view', tooltip: 'Grille' },
    { id: 'list', icon: 'view_list', tooltip: 'Liste' },
  ];

  onToolbarAction(_actionId: string): void {}

  onBulkActionClick(actionId: string): void {
    switch (actionId) {
      case 'export': this.onBulkExport();       break;
      case 'email':  this.onBulkEmail();        break;
      case 'status': this.onBulkStatusChange(); break;
      case 'delete': this.onBulkDelete();       break;
    }
  }

  onBulkExport(): void {
    const selected = this.employees().filter(e => this.selectedIds().has(e.userId));
    const header = 'Nom,Email,Pays,Statut,Date embauche';
    const rows = selected.map(e =>
      [
        `"${e.fullName}"`,
        `"${e.email ?? ''}"`,
        `"${e.paysLabel ?? ''}"`,
        `"${e.lifecycleStatus ?? ''}"`,
        `"${e.hireDate ?? ''}"`,
      ].join(',')
    );
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `profils-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.clearSelection();
  }

  onBulkEmail(): void {
    const emails = this.employees()
      .filter(e => this.selectedIds().has(e.userId) && e.email)
      .map(e => e.email)
      .join(',');
    if (emails) window.open(`mailto:${emails}`, '_blank');
    this.clearSelection();
  }

  onBulkStatusChange(): void {
    alert('Modification de statut en lot — fonctionnalité à venir.');
  }

  onBulkDelete(): void {
    const count = this.selectedCount();
    if (!window.confirm(
      `Supprimer ${count} profil(s) sélectionné(s) ?\nCette action est irréversible.`
    )) return;
    alert('Suppression en lot — fonctionnalité backend en cours.');
    this.clearSelection();
  }

  /* ── Navigation ─────────────────────────────────────────────────────────── */
  onViewProfile(profileId: number | null): void {  
    console.log(profileId);
      
    if (profileId != null) {
      this.router.navigate(['/rh/profiles', profileId]);
    }
  }

  onEdit(profileId: number): void {
    this.router.navigate(['/rh/profiles', profileId], { queryParams: { edit: 'true' } });
  }

  onDelete(profileId: number): void {
    console.log('Delete profile:', profileId);
  }

  toggleViewMode(): void {
    this.viewMode.update(m => m === 'grid' ? 'list' : 'grid');
  }
}
