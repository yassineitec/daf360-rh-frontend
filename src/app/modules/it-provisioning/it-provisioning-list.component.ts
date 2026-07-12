import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import {
  BadgeCell,
  CardComponent,
  DafCellDirective,
  DataTableComponent,
  FormFieldComponent,
  PaginationComponent,
  SelectComponent,
  SelectConfig,
  SelectOption,
  StatusBadgeComponent,
  TableColumn,
  TableConfig,
  TableRow,
} from '@khalilrebhiitec/daf360';
import { ItProvisioningService } from './it-provisioning.service';
import { ProvisioningListItem } from './it-provisioning.model';
import { statusBadge } from '../../shared/status-badge.utils';
import { KpiCardComponent } from '../../shared/kpi-card.component';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'PENDING',       label: 'En attente' },
  { value: 'IN_PROGRESS',   label: 'En cours' },
  { value: 'EMAIL_CREATED', label: 'Email créé' },
  { value: 'COMPLETED',     label: 'Complété' },
];

const PAGE_SIZE = 10;

@Component({
  selector: 'app-it-provisioning-list',
  standalone: true,
  imports: [DataTableComponent, DafCellDirective, SelectComponent, KpiCardComponent, CardComponent, StatusBadgeComponent, FormFieldComponent, PaginationComponent, NgTemplateOutlet],
  templateUrl: './it-provisioning-list.component.html',
})
export class ItProvisioningListComponent implements OnInit {
  private service = inject(ItProvisioningService);
  private router  = inject(Router);

  items   = signal<ProvisioningListItem[]>([]);
  loading = signal(true);
  error   = signal<string | null>(null);

  search           = signal('');
  mobileSearchOpen = signal(false);
  statusFilter     = signal('');
  viewMode         = signal<'grid' | 'list'>('list');

  readonly statusSelectOptions = STATUS_OPTIONS;
  readonly statusSelectConfig: SelectConfig = { placeholder: 'Tous les statuts' };

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
      _source:    r,
    })),
  );

  readonly stats = computed(() => {
    const list = this.items();
    return {
      pending:      list.length,
      overdue:      list.filter(r => this.isOverdue(r)).length,
      hwIncomplete: list.filter(r => this.hwProgress(r) !== '6/6').length,
      licIncomplete: list.filter(r => this.licProgress(r) !== '5/5').length,
    };
  });

  readonly columns: TableColumn[] = [
    { key: 'candidat', label: 'Candidat', type: 'avatar', sortable: true },
    { key: 'ms365Email', label: 'Email MS365' },
    { key: 'status', label: 'Statut', type: 'badge' },
    { key: 'expectedStartDate', label: 'Début & Urgence' },
    { key: 'hwLabel', label: 'Matériel' },
    { key: 'licLabel', label: 'Licences' },
    { key: 'adDone', label: 'AD Sync' },
    { key: '_actions', label: 'Actions' },
  ];

  readonly tableConfig = computed<TableConfig>(() => ({
    hoverable: true,
    loading: this.loading(),
    emptyMessage: 'Aucun dossier en attente de provisioning.',
  }));

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getPendingList().subscribe({
      next:  (data) => { this.items.set(data); this.loading.set(false); },
      error: ()     => { this.error.set('Erreur lors du chargement.'); this.loading.set(false); },
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
