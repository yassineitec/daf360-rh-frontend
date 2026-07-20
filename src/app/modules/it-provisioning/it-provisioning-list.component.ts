import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';

import { ItProvisioningService } from './it-provisioning.service';
import { ProvisioningListItem } from './it-provisioning.model';
import { statusBadge } from '../../shared/status-badge.utils';
import { KpiCardComponent } from '../../shared/kpi-card.component';
import { RhSearchBarComponent } from '../../shared/search-bar.component';
import { BadgeCell, ButtonComponent, CardComponent, DafCellDirective, DataTableComponent, PaginationComponent, SelectComponent, SelectConfig, SelectOption, StatusBadgeComponent, TableColumn, TableConfig, TableRow, ProgressBarComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const PAGE_SIZE = 10;

@Component({
  imports: [DataTableComponent, DafCellDirective, SelectComponent, KpiCardComponent, CardComponent, StatusBadgeComponent, PaginationComponent, NgTemplateOutlet, RhSearchBarComponent, ButtonComponent, ProgressBarComponent, TranslatePipe],
  standalone: true,
  templateUrl: './it-provisioning-list.component.html',
})
export class ItProvisioningListComponent implements OnInit {
  private service = inject(ItProvisioningService);
  private router  = inject(Router);
  private translate = inject(TranslateService);

  items   = signal<ProvisioningListItem[]>([]);
  loading = signal(true);
  error   = signal<string | null>(null);

  search           = signal('');
  mobileSearchOpen = signal(false);
  statusFilter     = signal('');
  viewMode         = signal<'grid' | 'list'>('grid');

  readonly statusSelectOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [
      { value: 'PENDING',       label: this.translate.instant('IT_PROVISIONING.STATUS.PENDING') },
      { value: 'IN_PROGRESS',   label: this.translate.instant('IT_PROVISIONING.STATUS.IN_PROGRESS') },
      { value: 'EMAIL_CREATED', label: this.translate.instant('IT_PROVISIONING.STATUS.EMAIL_CREATED') },
      { value: 'COMPLETED',     label: this.translate.instant('IT_PROVISIONING.STATUS.COMPLETED') },
    ];
  });
  readonly statusSelectConfig = computed<SelectConfig>(() => {
    this.translate.currentLang();
    return { placeholder: this.translate.instant('IT_PROVISIONING.LIST.FILTER_ALL') };
  });

  protected readonly statusBadge = statusBadge;

  readonly filteredItems = computed(() => {
    const term   = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.items().filter(r => {
      const matchesTerm = !term
        || r.candidateFullName.toLowerCase().includes(term)
        || (r.ms365Email ?? '').toLowerCase().includes(term);
      const matchesStatus = !status || r.status === status;
      return matchesTerm && matchesStatus;
    });
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
      candidat:   { name: r.candidateFullName, initials: this.initials(r.candidateFullName), subtitle: r.appliedPosition ?? '' },
      ms365Email: r.ms365Email,
      status:     { label: this.statusBadge(r.status).label, options: this.statusBadge(r.status).options } as BadgeCell,
      expectedStartDate: r.expectedStartDate,
      overdue:    this.isOverdue(r),
      hwCount:    r.assetsProvided ?? 0,
      hwDone:     this.hwProgress(r) === '6/6',
      hwLabel:    this.hwProgress(r),
      licCount:   this.licCount(r),
      licDone:    this.licProgress(r) === '5/5',
      licLabel:   this.licProgress(r),
      adDone:     r.status === 'EMAIL_CREATED' || r.status === 'COMPLETED',
      isCompleted: r.status === 'COMPLETED',
      _source:     r,
    })),
  );

  readonly stats = computed(() => {
    const openList = this.items().filter(r => r.status !== 'COMPLETED');
    return {
      pending:      openList.length,
      overdue:      openList.filter(r => this.isOverdue(r)).length,
      hwIncomplete: openList.filter(r => this.hwProgress(r) !== '6/6').length,
      licIncomplete: openList.filter(r => this.licProgress(r) !== '5/5').length,
    };
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'candidat', label: this.translate.instant('IT_PROVISIONING.LIST.COL_CANDIDATE'), type: 'avatar', sortable: true },
      { key: 'ms365Email', label: this.translate.instant('IT_PROVISIONING.LIST.COL_EMAIL') },
      { key: 'status', label: this.translate.instant('IT_PROVISIONING.LIST.COL_STATUS'), type: 'badge' },
      { key: 'expectedStartDate', label: this.translate.instant('IT_PROVISIONING.LIST.COL_START') },
      { key: 'hwLabel', label: this.translate.instant('IT_PROVISIONING.LIST.COL_HARDWARE') },
      { key: 'licLabel', label: this.translate.instant('IT_PROVISIONING.LIST.COL_LICENSES') },
      { key: '_actions', label: this.translate.instant('IT_PROVISIONING.LIST.COL_ACTIONS') },
    ];
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      hoverable: true,
      loading: this.loading(),
      emptyMessage: this.translate.instant('IT_PROVISIONING.LIST.TABLE_EMPTY'),
    };
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getAllList().subscribe({
      next:  (data) => { this.items.set(data); this.loading.set(false); },
      error: ()     => { this.error.set(this.translate.instant('IT_PROVISIONING.LIST.LOAD_ERROR')); this.loading.set(false); },
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.currentPage.set(0);
  }

  onStatusChange(values: string[]): void {
    this.statusFilter.set(values[0] ?? '');
    this.currentPage.set(0);
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  isOverdue(r: ProvisioningListItem): boolean {
    if (!r.expectedStartDate || r.status === 'COMPLETED') return false;
    return new Date(r.expectedStartDate).getTime() < Date.now();
  }

  overdueDays(r: TableRow): number {
    const source = r['_source'] as ProvisioningListItem;
    if (!source.expectedStartDate) return 0;
    const diffMs = Date.now() - new Date(source.expectedStartDate).getTime();
    return Math.max(0, Math.floor(diffMs / 86_400_000));
  }

  hwProgress(r: ProvisioningListItem): string {
    return (r.assetsProvided ?? 0) + '/6';
  }

  licCount(r: ProvisioningListItem): number {
    return [
      r.licenseOffice365,
      r.licenseAutocad,
      r.licenseRevit,
      r.licenseAutodesk,
      r.licenseKaspersky,
    ].filter(Boolean).length;
  }

  licProgress(r: ProvisioningListItem): string {
    return this.licCount(r) + '/5';
  }

  navigate(id: number): void {
    this.router.navigate(['/rh/it-provisioning', id]);
  }
}
