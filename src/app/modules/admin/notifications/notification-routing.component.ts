import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  StatusBadgeComponent, PaginationComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';
import { NotificationEventTypeWithRule } from './notification-routing.model';
import { NotificationRoutingService } from './notification-routing.service';
import { RoutingRuleEditorComponent } from './routing-rule-editor.component';
import { ModalComponent } from '../../../shared/modal.component';
import { RhSearchBarComponent } from '../../../shared/search-bar.component';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-notification-routing',
  standalone: true,
  imports: [
    FormsModule, RoutingRuleEditorComponent,
    StatusBadgeComponent, PaginationComponent, ModalComponent,
    DataTableComponent, DafCellDirective, RhSearchBarComponent,
  ],
  templateUrl: './notification-routing.component.html',
  styleUrl: './notification-routing.component.scss',
})
export class NotificationRoutingComponent implements OnInit {
  private svc = inject(NotificationRoutingService);

  eventTypes = signal<NotificationEventTypeWithRule[]>([]);
  selectedType = signal<NotificationEventTypeWithRule | null>(null);
  showModal = signal(false);
  loadingTypes = signal(true);
  error = signal<string | null>(null);
  searchQuery = signal('');

  readonly PAGE_SIZE = PAGE_SIZE;
  currentPage = signal(0);

  filteredTypes = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.eventTypes().filter(
      (t) =>
        !q ||
        t.labelFr.toLowerCase().includes(q) ||
        t.module.toLowerCase().includes(q)
    );
  });

  readonly totalElements = computed(() => this.filteredTypes().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / PAGE_SIZE));

  readonly pagedTypes = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.filteredTypes().slice(start, start + PAGE_SIZE);
  });

  readonly columns: TableColumn[] = [
    { key: 'module',  label: 'Module' },
    { key: 'labelFr', label: 'Événement' },
    { key: 'badges',  label: 'Canaux' },
  ];

  readonly rows = computed<TableRow[]>(() =>
    this.pagedTypes().map((t) => ({
      module:  t.module,
      labelFr: t.labelFr,
      _source: t,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => ({
    hoverable: true,
    loading: this.loadingTypes(),
    emptyMessage: 'Aucun événement trouvé.',
  }));

  ngOnInit(): void {
    this.svc.getEventTypes().subscribe({
      next: (types) => {
        this.eventTypes.set(types);
        this.loadingTypes.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Erreur lors du chargement des événements');
        this.loadingTypes.set(false);
      },
    });
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(0);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  selectType(type: NotificationEventTypeWithRule): void {
    this.selectedType.set(type);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }
}
