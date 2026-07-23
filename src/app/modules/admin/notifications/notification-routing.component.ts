import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent, StatusBadgeComponent, PaginationComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';
import { NotificationEventTypeWithRule } from './notification-routing.model';
import { NotificationRoutingService } from './notification-routing.service';
import { RoutingRuleEditorComponent } from './routing-rule-editor.component';
import { ModalComponent } from '../../../shared/modal.component';
import { RhSearchBarComponent } from '../../../shared/search-bar.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-notification-routing',
  standalone: true,
  imports: [
    FormsModule, RoutingRuleEditorComponent, ButtonComponent,
    StatusBadgeComponent, PaginationComponent, ModalComponent,
    DataTableComponent, DafCellDirective, RhSearchBarComponent,
    TranslatePipe,
  ],
  templateUrl: './notification-routing.component.html',
  styleUrl: './notification-routing.component.scss',
})
export class NotificationRoutingComponent implements OnInit {
  private svc = inject(NotificationRoutingService);
  private translate = inject(TranslateService);

  eventTypes = signal<NotificationEventTypeWithRule[]>([]);
  selectedType = signal<NotificationEventTypeWithRule | null>(null);
  showModal = signal(false);
  loadingTypes = signal(true);
  error = signal<string | null>(null);
  searchQuery = signal('');
  mobileSearchOpen = signal(false);

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

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'module',  label: this.translate.instant('ADMIN.notifications.colModule') },
      { key: 'labelFr', label: this.translate.instant('ADMIN.notifications.colEvent') },
      { key: 'badges',  label: this.translate.instant('ADMIN.notifications.colChannels') },
    ];
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedTypes().map((t) => ({
      module:  t.module,
      labelFr: t.labelFr,
      _source: t,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      hoverable: true,
      loading: this.loadingTypes(),
      emptyMessage: this.translate.instant('ADMIN.notifications.emptyMessage'),
    };
  });

  ngOnInit(): void {
    this.svc.getEventTypes().subscribe({
      next: (types) => {
        this.eventTypes.set(types);
        this.loadingTypes.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? this.translate.instant('ADMIN.notifications.loadError'));
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
