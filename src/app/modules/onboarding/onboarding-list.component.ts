import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { OnboardingService }    from './onboarding.service';
import { OnboardingKpiStats, OnboardingListItem } from './onboarding.model';
import {
  BadgeCell,
  CardComponent,
  DafCellDirective,
  DataTableComponent,
  StatusBadgeComponent,
  TableColumn,
  TableConfig,
  TableRow,
  ToolbarComponent,
  ToolbarToggleOption,
} from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { KpiCardComponent } from '../../shared/kpi-card.component';

@Component({
  selector: 'app-onboarding-list',
  standalone: true,
  imports: [CardComponent, KpiCardComponent, StatusBadgeComponent, DataTableComponent, DafCellDirective, ToolbarComponent],
  templateUrl: './onboarding-list.component.html',
  styleUrl:    './onboarding-list.component.scss',
})
export class OnboardingListComponent implements OnInit {
  private service = inject(OnboardingService);
  private router  = inject(Router);
  private route   = inject(ActivatedRoute);

  items    = signal<OnboardingListItem[]>([]);
  loading  = signal(true);
  error    = signal<string | null>(null);
  kpiStats = signal<OnboardingKpiStats | null>(null);

  search   = signal('');
  viewMode = signal<'grid' | 'list'>('list');

  readonly viewToggleOptions: ToolbarToggleOption[] = [
    { id: 'grid', icon: 'grid_view', tooltip: 'Vue grille' },
    { id: 'list', icon: 'view_list', tooltip: 'Vue liste' },
  ];

  protected readonly statusBadge = statusBadge;

  readonly filteredItems = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.items();
    return this.items().filter(r =>
      r.candidateFullName.toLowerCase().includes(term)
      || (r.ms365Email ?? '').toLowerCase().includes(term),
    );
  });

  readonly rows = computed<TableRow[]>(() =>
    this.filteredItems().map(r => ({
      employe:           { name: r.candidateFullName, initials: this.initials(r.candidateFullName), subtitle: r.appliedPosition ?? '' },
      ms365Email:        r.ms365Email,
      entite:            '#' + r.paysId,
      expectedStartDate: this.formatDate(r.expectedStartDate),
      status:            { label: this.statusBadge(r.candidateStatus).label, options: this.statusBadge(r.candidateStatus).options } as BadgeCell,
      hasDraft:          r.hasDraft,
      maj:               r.draftSavedAt
                            ? this.formatDate(r.draftSavedAt)
                            : r.ms365EmailCreatedAt
                              ? this.formatDate(r.ms365EmailCreatedAt)
                              : '—',
      _source:           r,
    })),
  );

  readonly columns: TableColumn[] = [
    { key: 'employe', label: 'Employé', type: 'avatar' },
    { key: 'ms365Email', label: 'Email MS365' },
    { key: 'entite', label: 'Entité' },
    { key: 'expectedStartDate', label: 'Début prévu' },
    { key: 'status', label: 'Statut' },
    { key: 'maj', label: 'MàJ' },
    { key: '_actions', label: 'Actions', align: 'center' },
  ];

  readonly tableConfig = computed<TableConfig>(() => ({
    hoverable: true,
  }));

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.getKpiStats().pipe(catchError(() => of(null))).subscribe(stats => {
      this.kpiStats.set(stats);
    });

    this.service.getPendingList().subscribe({
      next:  (data) => { this.items.set(data); this.loading.set(false); },
      error: ()     => { this.error.set('Erreur lors du chargement des dossiers.'); this.loading.set(false); },
    });
  }

  navigate(id: number): void {
    this.router.navigate([id], { relativeTo: this.route });
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  onViewToggle(id: string): void {
    if (id === 'grid' || id === 'list') this.viewMode.set(id);
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    return value.slice(0, 10);
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
}
