import { Component, OnInit, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent, StatusBadgeComponent, PaginationComponent,
  DataTableComponent, DafCellDirective, SortDirection, TableColumn, TableConfig, TableRow,
  PageComponent, PageHeaderComponent, BreadcrumbItem,
} from '@khalilrebhiitec/daf360';
import { NotificationEventTypeWithRule } from './notification-routing.model';
import { NotificationRoutingService } from './notification-routing.service';
import { RoutingRuleEditorComponent } from './routing-rule-editor.component';
import { RhSearchBarComponent } from '../../../shared/search-bar.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableSort, sortByColumn, toTableSort } from '../../../shared/table-sort.utils';

/** What each event-type column sorts on. "Canaux" sorts on how many channels are on. */
const EVENT_TYPE_SORT: Record<string, (t: NotificationEventTypeWithRule) => string | number | null> = {
  module:  t => t.module || null,
  labelFr: t => t.labelFr || null,
  badges:  t => (t.sendInapp ? 1 : 0) + (t.sendEmail ? 1 : 0),
};

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
  /** Table header sort — applied to the whole list, before paging (`manualSort`). */
  readonly sort = signal<TableSort | null>(null);

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
    return sortByColumn(this.filteredTypes(), this.sort(), EVENT_TYPE_SORT)
      .slice(start, start + this.pageSize());
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'module',  label: this.translate.instant('ADMIN.notifications.colModule'), sortable: true },
      { key: 'labelFr', label: this.translate.instant('ADMIN.notifications.colEvent'), sortable: true },
      { key: 'badges',  label: this.translate.instant('ADMIN.notifications.colChannels'), sortable: true },
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
    const tr = (k: string) => this.translate.instant(k);
    // A seed read once by the table — it re-mounts when the rule editor closes, and this
    // keeps the header arrow. Tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      showHeader: false,
      hoverable: true,
      loading: this.loadingTypes(),
      emptyMessage: this.translate.instant('ADMIN.notifications.emptyMessage'),
      // Stable row identity: row heights are keyed by it, not by render index.
      rowId: (row: TableRow) => (row['_source'] as NotificationEventTypeWithRule).id,
      resizableColumns:  true,
      resizableRows:     true,
      columnPicker:      true,
      columnPickerLabel: tr('REQUESTS.TABLE.COLUMN_PICKER'),
      showReset:         true,
      resetLabel:        tr('REQUESTS.TABLE.RESET'),
      sortLabel:         tr('REQUESTS.TABLE.SORT_BY'),
      // Rows are one client-side page; this component sorts the whole list (sortByColumn).
      manualSort:        true,
      ...(sort ? { defaultSort: sort } : {}),
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

  /** Header click (or the reset icon): a new order makes the current page meaningless. */
  onSortChange(key: string, dir: SortDirection): void {
    this.sort.set(toTableSort(key, dir));
    this.currentPage.set(0);
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
