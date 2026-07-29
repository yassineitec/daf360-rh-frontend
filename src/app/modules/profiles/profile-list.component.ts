import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, catchError, of } from 'rxjs';
import {
  BulkActionBarComponent, BulkAction,
  PageComponent, PageHeaderComponent,
  PaginationComponent,
  SearchToolbarComponent, SearchToolbarFilterConfig,
  FilterField, FilterResult,
  ToolbarToggleOption,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ProfileListService, FilterOptions } from './services/profile-list.service';
import { NotificationService } from '../../core/notification.service';
import { ConfirmService } from '../../core/confirm.service';
import { EmployeeListItem } from './models/profile.model';
import { ProfilesCardsSectionComponent } from './sections/profiles-cards-section.component';
import { ProfilesTableSectionComponent } from './sections/profiles-table-section.component';
import { CONTRACT_CODES, LIFECYCLE_CODES, contractLabel, lifecycleLabel } from './profile-labels';

const DEFAULT_PAGE_SIZE = 12;
const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

type ViewMode = 'grid' | 'list';

/** The filter panel's field names, which are also the query-param names. */
type FilterKey = 'pays' | 'department' | 'grade' | 'status' | 'contract' | 'hireDate';

const EMPTY_OPTIONS: FilterOptions = {
  departments: [], grades: [], pays: [], contractTypes: [],
};

/**
 * /rh/profiles — the employee directory.
 *
 * Architecture mirrors the dashboard (UI-PLAYBOOK §8b): the template is only
 * `daf-page` + `daf-page-header` + the toolbar + one section component per view
 * + pagination, and every section is a stateless input/output shell.
 *
 * **All view state lives here** — `searchText`, `filters`, `selectedIds`,
 * `currentPage`, `pageSize`. `viewMode` only picks which section renders; it
 * never touches that state and never triggers a re-fetch, which is what makes
 * flipping between cards and table lossless.
 */
@Component({
  selector: 'app-profile-list',
  standalone: true,
  imports: [
    PageComponent,
    PageHeaderComponent,
    SearchToolbarComponent,
    PaginationComponent,
    BulkActionBarComponent,
    ProfilesCardsSectionComponent,
    ProfilesTableSectionComponent,
    TranslatePipe,
  ],
  templateUrl: './profile-list.component.html',
})
export class ProfileListComponent implements OnInit {
  private svc       = inject(ProfileListService);
  private confirm   = inject(ConfirmService);
  private router    = inject(Router);
  private notify    = inject(NotificationService);
  private translate = inject(TranslateService);

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly employees     = signal<EmployeeListItem[]>([]);
  readonly filterOptions = signal<FilterOptions>(EMPTY_OPTIONS);
  readonly error         = signal<string | null>(null);

  /** Whole-page skeleton — first load only (§5). */
  readonly firstLoad = signal(true);
  /** Every subsequent fetch — skeletons inside the section, header stays put. */
  readonly loading   = signal(false);

  // ── View state (survives a view-mode switch) ───────────────────────────────
  readonly viewMode    = signal<ViewMode>('grid');
  readonly searchText  = signal('');
  readonly filters     = signal<Partial<Record<FilterKey, string>>>({});
  readonly selectedIds = signal<Set<number>>(new Set());

  // ── Paging ─────────────────────────────────────────────────────────────────
  readonly currentPage   = signal(0);
  readonly pageSize      = signal(DEFAULT_PAGE_SIZE);
  readonly totalPages    = signal(0);
  readonly totalElements = signal(0);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly selectedCount = computed(() => this.selectedIds().size);

  // ── Filter panel ───────────────────────────────────────────────────────────
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    const t   = (k: string) => this.translate.instant(k);
    const opt = this.filterOptions();
    return [
      {
        name: 'pays', label: t('PROFILES.FILTERS.PAYS'), type: 'select',
        placeholder: t('PROFILES.FILTERS.ALL'), searchable: true,
        options: opt.pays,
      },
      {
        name: 'department', label: t('PROFILES.FILTERS.DEPARTMENT'), type: 'select',
        placeholder: t('PROFILES.FILTERS.ALL'), searchable: true,
        options: opt.departments,
      },
      {
        name: 'grade', label: t('PROFILES.FILTERS.GRADE'), type: 'select',
        placeholder: t('PROFILES.FILTERS.ALL'), searchable: true,
        options: opt.grades,
      },
      {
        name: 'status', label: t('PROFILES.FILTERS.STATUS'), type: 'select',
        placeholder: t('PROFILES.FILTERS.ALL'),
        options: LIFECYCLE_CODES.map(code => ({
          value: code, label: lifecycleLabel(code, this.translate),
        })),
      },
      {
        name: 'contract', label: t('PROFILES.FILTERS.CONTRACT'), type: 'select',
        placeholder: t('PROFILES.FILTERS.ALL'),
        // Codes come from the DB (a free varchar), so the list is whatever exists
        // rather than the enum; unmapped codes show as themselves.
        options: opt.contractTypes.map(code => ({
          value: code, label: contractLabel(code, this.translate),
        })),
      },
      {
        name: 'hireDate', label: t('PROFILES.FILTERS.HIRE_DATE'), type: 'daterange',
        hint: t('PROFILES.FILTERS.HIRE_DATE_HINT'),
      },
    ];
  });

  /**
   * Seeds the panel from the applied filters.
   *
   * Two things about `daf-filter` this has to respect:
   * - `initialValues` is read **once**, on first open (`ensureSeed` short-circuits
   *   after that). It is a seed, not a binding — the panel then owns its own
   *   `applied` snapshot. That snapshot survives a view switch because the toolbar
   *   sits in the page template, outside the per-view `@if`, so it is never torn
   *   down; the seed here is what covers a genuine remount.
   * - Values must be in the panel's **internal** shape, which for a `select` is a
   *   `string[]` (it normalises down to a scalar only when emitting). A bare
   *   string would read back as empty and silently show a blank control.
   */
  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => {
    this.translate.currentLang();
    const f = this.filters();
    const sel = (v: string | undefined) => (v ? [v] : []);
    return {
      title:        this.translate.instant('PROFILES.FILTERS.TITLE'),
      applyLabel:   this.translate.instant('PROFILES.FILTERS.APPLY'),
      cancelLabel:  this.translate.instant('PROFILES.FILTERS.CANCEL'),
      resetLabel:   this.translate.instant('PROFILES.FILTERS.RESET'),
      triggerLabel: this.translate.instant('PROFILES.LIST.ADVANCED_FILTERS'),
      align:        'right',
      panelWidth:   340,
      initialValues: {
        pays:       sel(f.pays),
        department: sel(f.department),
        grade:      sel(f.grade),
        status:     sel(f.status),
        contract:   sel(f.contract),
        hireDate:   this.hireDateRangeValue(f),
      },
    };
  });

  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'grid', icon: 'grid_view', tooltip: this.translate.instant('PROFILES.LIST.GRID_TOOLTIP') },
      { id: 'list', icon: 'view_list', tooltip: this.translate.instant('PROFILES.LIST.LIST_TOOLTIP') },
    ];
  });

  readonly bulkActions = computed<BulkAction[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'export', label: this.translate.instant('PROFILES.BULK.EXPORT'), icon: 'download'    },
      { id: 'email',  label: this.translate.instant('PROFILES.BULK.EMAIL'),  icon: 'mail'        },
      { id: 'status', label: this.translate.instant('PROFILES.BULK.STATUS'), icon: 'edit_square' },
      { id: 'delete', label: this.translate.instant('PROFILES.BULK.DELETE'), icon: 'delete', variant: 'danger' },
    ];
  });

  // ── Load ───────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    forkJoin({
      list: this.svc.getEmployees(this.queryParams()).pipe(catchError(() => of(null))),
      opts: this.svc.getFilterOptions(),
    }).subscribe(({ list, opts }) => {
      this.applyPage(list);
      this.filterOptions.set(opts);
      this.firstLoad.set(false);
    });
  }

  loadEmployees(): void {
    this.loading.set(true);
    this.svc.getEmployees(this.queryParams())
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        this.applyPage(res);
        this.loading.set(false);
      });
  }

  private applyPage(res: { content: EmployeeListItem[]; totalElements: number; totalPages: number } | null): void {
    if (!res) {
      this.error.set(this.translate.instant('PROFILES.LIST.LOAD_ERROR'));
      return;
    }
    this.error.set(null);
    this.employees.set(res.content);
    this.totalElements.set(res.totalElements);
    this.totalPages.set(res.totalPages);
  }

  private queryParams() {
    const f = this.filters();
    return {
      page:         this.currentPage(),
      size:         this.pageSize(),
      search:       this.searchText() || undefined,
      pays:         f.pays,
      department:   f.department,
      grade:        f.grade,
      status:       f.status,
      contract:     f.contract,
      hireDateFrom: f.hireDate ? f.hireDate.split('..')[0] || undefined : undefined,
      hireDateTo:   f.hireDate ? f.hireDate.split('..')[1] || undefined : undefined,
    };
  }

  // ── Toolbar handlers ───────────────────────────────────────────────────────
  /**
   * A new result set invalidates the page index and the selection (the selected
   * rows may no longer be in it), but never the search text or the filters.
   */
  private resetToFirstPage(): void {
    this.currentPage.set(0);
    this.clearSelection();
    this.loadEmployees();
  }

  onSearchChange(text: string): void {
    if (text === this.searchText()) return;   // daf-search-toolbar re-emits on blur
    this.searchText.set(text);
    this.resetToFirstPage();
  }

  applyFilters(result: FilterResult): void {
    this.filters.set({
      pays:       this.asString(result['pays']),
      department: this.asString(result['department']),
      grade:      this.asString(result['grade']),
      status:     this.asString(result['status']),
      contract:   this.asString(result['contract']),
      hireDate:   this.asDateRange(result['hireDate']),
    });
    this.resetToFirstPage();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.clearSelection();
    this.loadEmployees();
  }

  /** `pageSizeChange` fires alone — the page decides to go back to page 0 (§7). */
  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.resetToFirstPage();
  }

  // ── Selection ──────────────────────────────────────────────────────────────
  toggleSelect({ userId, checked }: { userId: number; checked: boolean }): void {
    this.selectedIds.update(set => {
      const next = new Set(set);
      if (checked) next.add(userId); else next.delete(userId);
      return next;
    });
  }

  /**
   * `daf-bulk-action-bar` only *asks*; the parent owns the state. This selects
   * the loaded page — the bar's `totalCount` is therefore the page length, not
   * `totalElements`, because selecting rows we haven't fetched would let the
   * bulk actions operate on data the page doesn't have (§7b).
   */
  selectAll(): void {
    this.selectedIds.set(new Set(this.employees().map(e => e.userId)));
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────
  onBulkAction(actionId: string): void {
    switch (actionId) {
      case 'export': this.onBulkExport();       break;
      case 'email':  this.onBulkEmail();        break;
      case 'status': this.onBulkStatusChange(); break;
      case 'delete': this.onBulkDelete();       break;
    }
  }

  private selectedEmployees(): EmployeeListItem[] {
    const ids = this.selectedIds();
    return this.employees().filter(e => ids.has(e.userId));
  }

  private onBulkExport(): void {
    const header = this.translate.instant('PROFILES.BULK.CSV_HEADER');
    const rows = this.selectedEmployees().map(e => [
      `"${e.fullName}"`,
      `"${e.email ?? ''}"`,
      `"${e.paysLabel ?? ''}"`,
      `"${e.lifecycleStatus ?? ''}"`,
      `"${e.hireDate ?? ''}"`,
    ].join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `profils-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.clearSelection();
  }

  private onBulkEmail(): void {
    const emails = this.selectedEmployees()
      .map(e => e.email)
      .filter((m): m is string => !!m)
      .join(',');
    if (emails) window.open(`mailto:${emails}`, '_blank');
    this.clearSelection();
  }

  private onBulkStatusChange(): void {
    this.notify.info(this.translate.instant('PROFILES.BULK.STATUS_SOON'));
  }

  private async onBulkDelete(): Promise<void> {
    const count = this.selectedCount();
    if (!(await this.confirm.ask({
      title:        this.translate.instant('PROFILES.BULK.DELETE_TITLE'),
      message:      this.translate.instant('PROFILES.BULK.DELETE_MESSAGE', { count }),
      confirmLabel: this.translate.instant('PROFILES.BULK.DELETE'),
      icon:         'delete',
    }))) return;
    this.notify.info(this.translate.instant('PROFILES.BULK.DELETE_SOON'));
    this.clearSelection();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  onViewProfile(profileId: number | null): void {
    if (profileId != null) this.router.navigate(['/rh/profiles', profileId]);
  }

  onEdit(profileId: number): void {
    this.router.navigate(['/rh/profiles', profileId], { queryParams: { edit: 'true' } });
  }

  onDelete(profileId: number): void {
    this.notify.info(this.translate.instant('PROFILES.BULK.DELETE_SOON'));
  }

  // ── FilterResult coercion ──────────────────────────────────────────────────
  /** A `select` field yields `string | null`; '' means "no choice". */
  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value !== '' ? value : undefined;
  }

  /**
   * A `daterange` field yields `Date[] | Date | null` — a single `Date` while only
   * the start of the range has been picked. Collapsed to `from..to` with ISO
   * `yyyy-MM-dd` halves (either side may be empty) so the whole filter set stays a
   * flat string record, which is what lets `initialValues` be rebuilt from it.
   */
  private asDateRange(value: unknown): string | undefined {
    const dates = Array.isArray(value) ? value : value instanceof Date ? [value] : [];
    if (!dates.length) return undefined;
    const [from, to] = dates;
    const range = `${this.isoDate(from)}..${this.isoDate(to)}`;
    return range === '..' ? undefined : range;
  }

  /**
   * Local-calendar `yyyy-MM-dd`. Deliberately NOT `toISOString()`: the picker hands
   * back local midnight, and in any positive-offset zone (Tunisia is UTC+1) that
   * converts to 23:00 the *previous* day — so the sent date would be off by one.
   */
  private isoDate(d: unknown): string {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Inverse of `asDateRange`, back into the picker's `Date[]`. */
  private hireDateRangeValue(f: Partial<Record<FilterKey, string>>): Date[] | null {
    if (!f.hireDate) return null;
    const dates = f.hireDate.split('..')
      .filter(Boolean)
      // `yyyy-MM-dd` parses as UTC midnight; split the parts so the Date lands on
      // the same calendar day the user picked rather than possibly the day before.
      .map(s => {
        const [y, m, day] = s.split('-').map(Number);
        return new Date(y, (m ?? 1) - 1, day ?? 1);
      })
      .filter(d => !Number.isNaN(d.getTime()));
    return dates.length ? dates : null;
  }
}
