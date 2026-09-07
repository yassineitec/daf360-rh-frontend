import { Component, OnInit, computed, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent, StatusBadgeComponent, PaginationComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
  PageComponent, PageHeaderComponent, BreadcrumbItem,
} from '@khalilrebhiitec/daf360';
import { NotificationEventTypeWithRule } from './notification-routing.model';
import { NotificationRoutingService } from './notification-routing.service';
import { RoutingRuleEditorComponent } from './routing-rule-editor.component';
import { RhSearchBarComponent } from '../../../shared/search-bar.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-notification-routing',
  standalone: true,
  imports: [
    FormsModule, RoutingRuleEditorComponent, ButtonComponent,
    StatusBadgeComponent, PaginationComponent, PageComponent, PageHeaderComponent,
    DataTableComponent, DafCellDirective, RhSearchBarComponent,
    TranslatePipe,
  ],
  templateUrl: './notification-routing.component.html',
  styleUrl: './notification-routing.component.scss',
})
export class NotificationRoutingComponent implements OnInit {
  private svc = inject(NotificationRoutingService);
  private translate = inject(TranslateService);

  // Lets the admin shell's own "Administration" breadcrumb crumb jump back to its module grid.
  backToAdmin = output<void>();

  // Tells the admin shell to hide its own "Administration › Notifications & Emails" breadcrumb
  // while a rule is open — our own 3-level breadcrumb already includes both those crumbs.
  detailOpen = output<boolean>();

  eventTypes = signal<NotificationEventTypeWithRule[]>([]);
  selectedType = signal<NotificationEventTypeWithRule | null>(null);
  loadingTypes = signal(true);
  error = signal<string | null>(null);
  searchQuery = signal('');
  mobileSearchOpen = signal(false);

  currentPage = signal(0);
  pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  constructor() {
    effect(() => this.detailOpen.emit(!!this.selectedType()));
  }

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
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / this.pageSize()));

  readonly pagedTypes = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredTypes().slice(start, start + this.pageSize());
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

  /** `pageSizeChange` fires alone — go back to page 0 with the new size (same as /rh/profiles). */
  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
  }

  selectType(type: NotificationEventTypeWithRule): void {
    this.selectedType.set(type);
  }

  /** The "Notifications & Emails" crumb goes back to the list; "Administration" goes up to the module grid. */
  onBreadcrumbNavigate(crumb: BreadcrumbItem): void {
    if (crumb.label === this.translate.instant('ADMIN.shell.tabs.notifications')) {
      this.selectedType.set(null);
    } else {
      this.backToAdmin.emit();
    }
  }
}
