import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';
import {
  BadgeCell,
  BadgeOptions,
  ButtonComponent,
  DafHasPermissionDirective,
  FilterField,
  FilterResult,
  MetricCardComponent,
  PageComponent,
  PageHeaderComponent,
  PaginationComponent,
  SearchToolbarComponent,
  SearchToolbarFilterConfig,
} from '@khalilrebhiitec/daf360';

import { ConfirmService } from '../../core/confirm.service';
import { UserStore } from '../../core/user.store';
import { statusBadge } from '../../shared/status-badge.utils';
import { CandidateService } from './candidate.service';
import { RejectModalComponent } from './reject-modal.component';
import {
  CandidateHistoryItem,
  CandidateListItem,
  CandidateStats,
  CandidateStatus,
  PageResponse,
} from './candidate.model';
import { CandidatesTableSectionComponent } from './sections/candidates-table-section.component';
import { CandidateDossierPanelComponent } from './sections/candidate-dossier-panel.component';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Candidate status codes, in workflow order, for the status filter. */
const STATUS_CODES: CandidateStatus[] = [
  'PENDING', 'ACCEPTED', 'OFFER_SENT', 'REJECTED', 'IT_IN_PROGRESS',
  'EMAIL_RECEIVED', 'HR_IN_PROGRESS', 'HIRED', 'ARCHIVED',
];

/**
 * /rh/candidates/list — the flat, server-paginated candidate register.
 *
 * Architecture follows UI-PLAYBOOK §1 + §8b: `daf-page` + `daf-page-header` +
 * the KPI row + `daf-search-toolbar` + `rh-candidates-table-section` +
 * `daf-pagination`, with the per-candidate decision history and the MS365
 * automation explainer moved into `rh-candidate-dossier-panel`, a right-edge
 * `daf-drawer` (§10e). All state lives here; both sections are stateless.
 *
 * The table is the **same component** /rh/recrutement's list view uses — the two
 * were byte-for-byte identical `daf-data-table` blocks maintained separately.
 */
@Component({
  selector: 'app-candidate-list',
  standalone: true,
  imports: [
    ButtonComponent,
    DafHasPermissionDirective,
    MetricCardComponent,
    PageComponent,
    PageHeaderComponent,
    PaginationComponent,
    SearchToolbarComponent,
    CandidatesTableSectionComponent,
    CandidateDossierPanelComponent,
    RejectModalComponent,
    TranslatePipe,
  ],
  templateUrl: './candidate-list.component.html',
})
export class CandidateListComponent implements OnInit {
  private svc       = inject(CandidateService);
  private confirm   = inject(ConfirmService);
  private router    = inject(Router);
  private translate = inject(TranslateService);
  readonly userStore = inject(UserStore);

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly page  = signal<PageResponse<CandidateListItem> | null>(null);
  readonly stats = signal<CandidateStats>({ total: 0, pending: 0, accepted: 0, hired: 0 });

  readonly candidates    = computed(() => this.page()?.content ?? []);
  readonly totalElements = computed(() => this.page()?.totalElements ?? 0);
  readonly totalPages    = computed(() => this.page()?.totalPages ?? 0);

  /** Whole-page skeleton — first load only (UI-PLAYBOOK §5). */
  readonly firstLoad = signal(true);
  /** Every subsequent fetch — skeleton rows inside the table only. */
  readonly loading   = signal(false);

  // ── View state ─────────────────────────────────────────────────────────────
  readonly search       = signal('');
  readonly statusFilter = signal('');
  readonly currentPage  = signal(0);
  readonly pageSize     = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  // ── Dossier drawer ─────────────────────────────────────────────────────────
  readonly selectedId       = signal<number | null>(null);
  readonly dossierOpen      = signal(false);
  readonly history        = signal<CandidateHistoryItem[]>([]);
  readonly historyLoading = signal(false);

  readonly selectedCandidate = computed(() =>
    this.candidates().find(c => c.id === this.selectedId()) ?? null,
  );

  // ── Actions ────────────────────────────────────────────────────────────────
  readonly rejectTarget = signal<CandidateListItem | null>(null);
  readonly actioningId  = signal<number | null>(null);
  readonly actionError  = signal<string | null>(null);

  readonly canAcceptReject = computed(() => this.userStore.hasPermission('ACCEPT_REJECT_CANDIDATE'));

  // ── Toolbar ────────────────────────────────────────────────────────────────
  /** The status dropdown belongs *inside* the filter panel, not loose in a toggled row. */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    return [{
      name: 'status',
      label: this.translate.instant('CANDIDATES.LIST.COL_STATUS'),
      type: 'select',
      placeholder: this.translate.instant('CANDIDATES.FILTERS.ALL_STATUSES'),
      options: STATUS_CODES.map(code => ({
        value: code,
        label: this.translate.instant('CANDIDATES.STATUS.' + code),
      })),
    }];
  });

  /**
   * `initialValues` is a seed read once on first open, and a `select` needs the
   * panel's internal shape — a `string[]`, not a bare string (§10b).
   */
  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      title:        t('CANDIDATES.FILTERS.TITLE'),
      applyLabel:   t('CANDIDATES.FILTERS.APPLY'),
      cancelLabel:  t('CANDIDATES.FILTERS.CANCEL'),
      resetLabel:   t('CANDIDATES.FILTERS.RESET'),
      triggerLabel: t('CANDIDATES.FILTERS.TRIGGER'),
      align:        'right',
      initialValues: { status: this.statusFilter() ? [this.statusFilter()] : [] },
    };
  });

  // ── Presentation callbacks handed to the sections ──────────────────────────
  readonly statusLabel = computed(() => {
    this.translate.currentLang();
    return (status: string) => this.translate.instant('CANDIDATES.STATUS.' + status);
  });

  /** Translated label + the shared badge variant, for the table's badge column. */
  readonly statusBadgeCell = computed(() => {
    this.translate.currentLang();
    return (status: string): BadgeCell => ({
      label:   this.translate.instant('CANDIDATES.STATUS.' + status),
      options: statusBadge(status).options as BadgeOptions,
    });
  });

  // ── KPI tiles ──────────────────────────────────────────────────────────────
  readonly totalMetricValue   = computed(() => this.stats().total.toLocaleString('fr-FR'));
  readonly pendingMetricValue = computed(() => this.stats().pending.toLocaleString('fr-FR'));
  readonly hiredMetricValue   = computed(() => this.stats().hired.toLocaleString('fr-FR'));

  // ── Load ───────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    forkJoin({
      stats: this.svc.getStats().pipe(catchError(() => of(null))),
      page:  this.svc.getCandidates(this.query()).pipe(catchError(() => of(null))),
    }).subscribe(({ stats, page }) => {
      if (stats) this.stats.set(stats);
      if (page)  this.page.set(page);
      this.firstLoad.set(false);
    });
  }

  private query() {
    return {
      paysId: this.userStore.currentUser()?.paysId,
      status: this.statusFilter() || undefined,
      search: this.search()       || undefined,
      page:   this.currentPage(),
      size:   this.pageSize(),
    };
  }

  private loadCandidates(): void {
    this.loading.set(true);
    this.svc.getCandidates(this.query()).subscribe({
      next:  r  => { this.page.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadStats(): void {
    this.svc.getStats().subscribe({ next: s => this.stats.set(s), error: () => {} });
  }

  // ── Toolbar handlers ───────────────────────────────────────────────────────
  onSearch(value: string): void {
    if (value === this.search()) return; // daf-search-toolbar re-emits on blur
    this.search.set(value ?? '');
    this.currentPage.set(0);
    this.loadCandidates();
  }

  applyFilters(result: FilterResult): void {
    this.statusFilter.set(typeof result['status'] === 'string' ? result['status'] : '');
    this.currentPage.set(0);
    this.loadCandidates();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadCandidates();
  }

  /** `pageSizeChange` fires alone — the page decides to go back to page 0 (§7). */
  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
    this.loadCandidates();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  onNewCandidate(): void { this.router.navigate(['/rh/candidates', 'new']); }
  onView(id: number): void { this.router.navigate(['/rh/candidates', id]); }

  // ── Dossier drawer ─────────────────────────────────────────────────────────
  /** A row click opens the dossier; the row's "Voir" button opens the candidate. */
  openDossier(candidateId: number): void {
    this.dossierOpen.set(true);
    if (this.selectedId() === candidateId) return; // already loaded
    this.selectedId.set(candidateId);
    this.historyLoading.set(true);
    this.history.set([]);
    this.svc.getHistory(candidateId).subscribe({
      next:  h  => { this.history.set(h); this.historyLoading.set(false); },
      error: () => this.historyLoading.set(false),
    });
  }

  // ── Accept / reject (PENDING candidates only) ──────────────────────────────
  async quickAccept({ candidate, event }: { candidate: CandidateListItem; event: Event }): Promise<void> {
    event.stopPropagation();
    if (!(await this.confirm.ask({
      title:   this.translate.instant('CANDIDATES.CONFIRM.ACCEPT_TITLE'),
      message: this.translate.instant('CANDIDATES.CONFIRM.ACCEPT_MESSAGE', { name: `${candidate.firstName} ${candidate.lastName}` }),
      confirmLabel: this.translate.instant('CANDIDATES.ACTIONS.ACCEPT'), icon: 'check_circle',
    }))) return;

    this.actioningId.set(candidate.id);
    this.actionError.set(null);
    this.svc.accept(candidate.id).subscribe({
      next:  () => { this.actioningId.set(null); this.reload(); },
      error: err => {
        this.actioningId.set(null);
        this.actionError.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('CANDIDATES.ERRORS.GENERIC'));
      },
    });
  }

  openRejectModal({ candidate, event }: { candidate: CandidateListItem; event: Event }): void {
    event.stopPropagation();
    this.actionError.set(null);
    this.rejectTarget.set(candidate);
  }

  onRejected(): void {
    this.rejectTarget.set(null);
    this.reload();
  }

  /** After an action: the list, the KPIs and — if it's open — the dossier history. */
  private reload(): void {
    this.loadCandidates();
    this.loadStats();
    const id = this.selectedId();
    if (id != null) {
      this.historyLoading.set(true);
      this.svc.getHistory(id).subscribe({
        next:  h  => { this.history.set(h); this.historyLoading.set(false); },
        error: () => this.historyLoading.set(false),
      });
    }
  }
}
