import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { OnboardingService }    from './onboarding.service';
import { OnboardingKpiStats, OnboardingListItem } from './onboarding.model';
import {
  BadgeCell,
  ButtonComponent,
  CardComponent,
  DafCellDirective,
  DataTableComponent,
  PaginationComponent,
  StatusBadgeComponent,
  TableColumn,
  TableConfig,
  TableRow,
} from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { KpiCardComponent } from '../../shared/kpi-card.component';
import { RhSearchBarComponent } from '../../shared/search-bar.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-onboarding-list',
  standalone: true,
  imports: [CardComponent, KpiCardComponent, StatusBadgeComponent, DataTableComponent, DafCellDirective, PaginationComponent, NgTemplateOutlet, RhSearchBarComponent, ButtonComponent, TranslatePipe],
  templateUrl: './onboarding-list.component.html',
  styleUrl:    './onboarding-list.component.scss',
})
export class OnboardingListComponent implements OnInit {
  private service = inject(OnboardingService);
  private router  = inject(Router);
  private route   = inject(ActivatedRoute);
  private translate = inject(TranslateService);

  items    = signal<OnboardingListItem[]>([]);
  loading  = signal(true);
  error    = signal<string | null>(null);
  kpiStats = signal<OnboardingKpiStats | null>(null);

  search   = signal('');
  mobileSearchOpen = signal(false);
  viewMode = signal<'grid' | 'list'>('grid');

  protected readonly statusBadge = statusBadge;

  readonly filteredItems = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.items();
    return this.items().filter(r =>
      r.candidateFullName.toLowerCase().includes(term)
      || (r.ms365Email ?? '').toLowerCase().includes(term),
    );
  });

  currentPage = signal(0);
  readonly totalPages = computed(() => Math.ceil(this.filteredItems().length / PAGE_SIZE));

  readonly pagedItems = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.filteredItems().slice(start, start + PAGE_SIZE);
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  readonly rows = computed<TableRow[]>(() =>
    this.pagedItems().map(r => ({
      employe:           { name: r.candidateFullName, initials: this.initials(r.candidateFullName), subtitle: r.appliedPosition ?? '' },
      ms365Email:        r.ms365Email,
      itStatus:          { label: this.statusBadge(r.itProvisioningStatus).label, options: this.statusBadge(r.itProvisioningStatus).options } as BadgeCell,
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

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'employe', label: t('ONBOARDING.LIST.COL_EMPLOYEE'), type: 'avatar' },
      { key: 'ms365Email', label: t('ONBOARDING.LIST.COL_EMAIL') },
      { key: 'itStatus', label: t('ONBOARDING.LIST.COL_IT_STATUS') },
      { key: 'expectedStartDate', label: t('ONBOARDING.LIST.COL_START') },
      { key: 'status', label: t('ONBOARDING.LIST.COL_STATUS') },
      { key: 'maj', label: t('ONBOARDING.LIST.COL_UPDATED') },
      { key: '_actions', label: t('ONBOARDING.LIST.COL_ACTIONS') },
    ];
  });

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
      error: ()     => { this.error.set(this.translate.instant('ONBOARDING.LIST.ERROR_LOAD')); this.loading.set(false); },
    });
  }

  navigate(id: number): void {
    this.router.navigate([id], { relativeTo: this.route });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.currentPage.set(0);
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
