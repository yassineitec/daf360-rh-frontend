import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ButtonComponent,
  CardComponent,
  MetricCardComponent,
  PaginationComponent,
  SelectComponent,
  SelectConfig,
  SelectOption,
  StatusBadgeComponent,
  ToolbarComponent,
} from '@khalilrebhiitec/daf360';
import { CandidateService } from './candidate.service';
import { RejectModalComponent } from './reject-modal.component';
import { UserStore } from '../../core/user.store';
import { PermissionDirective } from '../../shared/permission.directive';
import { statusBadge } from '../../shared/status-badge.utils';
import {
  CandidateListItem,
  CandidateStats,
  CANDIDATE_STATUS_OPTIONS,
  PageResponse,
} from './candidate.model';

const PAGE_SIZE = 10;

/**
 * Candidates landing page — the single, canonical candidate list.
 *
 * Backed entirely by the candidate backend (`/api/hr/candidates`,
 * CandidateController). It intentionally does NOT use the recruitment
 * pipeline endpoints (`/api/hr/pipeline/*`); statuses come straight from
 * CandidateStatus so the list, filters and KPIs all reflect the same source.
 */
@Component({
  selector: 'rh-candidates',
  standalone: true,
  imports: [
    ButtonComponent,
    CardComponent,
    MetricCardComponent,
    SelectComponent,
    StatusBadgeComponent,
    ToolbarComponent,
    PaginationComponent,
    PermissionDirective,
    RejectModalComponent,
  ],
  templateUrl: './candidates.component.html',
})
export class CandidatesComponent implements OnInit {
  private svc        = inject(CandidateService);
  private router     = inject(Router);
  readonly userStore = inject(UserStore);

  readonly page          = signal<PageResponse<CandidateListItem> | null>(null);
  readonly stats         = signal<CandidateStats>({ total: 0, pending: 0, accepted: 0, hired: 0 });
  readonly loading       = signal(false);
  readonly statsLoading  = signal(false);
  readonly search        = signal('');
  readonly statusFilter  = signal('');
  readonly currentPage   = signal(0);

  readonly candidates    = computed(() => this.page()?.content ?? []);
  readonly totalElements = computed(() => this.page()?.totalElements ?? 0);
  readonly totalPages    = computed(() => this.page()?.totalPages ?? 0);

  // ── Reject modal state ─────────────────────────────────────────────────────
  readonly rejectTarget = signal<CandidateListItem | null>(null);
  readonly actioningId  = signal<number | null>(null);
  readonly actionError  = signal<string | null>(null);

  readonly canAcceptReject = computed(() =>
    this.userStore.hasPermission('ACCEPT_REJECT_CANDIDATE'),
  );

  readonly statusSelectOptions: SelectOption[] = CANDIDATE_STATUS_OPTIONS
    .filter(o => o.value !== '')
    .map(o => ({ value: o.value, label: o.label }));

  readonly statusSelectConfig: SelectConfig = {
    placeholder: 'Tous les statuts',
  };

  protected readonly statusBadge = statusBadge;

  ngOnInit(): void {
    this.loadStats();
    this.loadCandidates();
  }

  private loadStats(): void {
    this.statsLoading.set(true);
    this.svc.getStats(this.userStore.currentUser()?.paysId).subscribe({
      next:  s  => { this.stats.set(s); this.statsLoading.set(false); },
      error: () => this.statsLoading.set(false),
    });
  }

  private loadCandidates(): void {
    this.loading.set(true);
    this.svc.getCandidates({
      paysId: this.userStore.currentUser()?.paysId,
      status: this.statusFilter() || undefined,
      search: this.search()       || undefined,
      page:   this.currentPage(),
      size:   PAGE_SIZE,
    }).subscribe({
      next:  r  => { this.page.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(value: string | number | null): void {
    this.search.set((value as string) ?? '');
    this.currentPage.set(0);
    this.loadCandidates();
  }

  onStatusChange(values: string[]): void {
    this.statusFilter.set(values[0] ?? '');
    this.currentPage.set(0);
    this.loadCandidates();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadCandidates();
  }

  onNewCandidate(): void {
    this.router.navigate(['/rh/candidates', 'new']);
  }

  onView(id: number): void {
    this.router.navigate(['/rh/candidates', id]);
  }

  // ── Accept / Reject workflow (PENDING candidates only) ──────────────────────
  quickAccept(c: CandidateListItem, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Accepter le candidat ${c.firstName} ${c.lastName} ?`)) return;
    this.actioningId.set(c.id);
    this.actionError.set(null);
    this.svc.accept(c.id).subscribe({
      next:  () => { this.actioningId.set(null); this.reload(); },
      error: err => {
        this.actioningId.set(null);
        this.actionError.set(err?.error?.detail ?? err?.error?.message ?? "Erreur lors de l'acceptation.");
      },
    });
  }

  openRejectModal(c: CandidateListItem, event: Event): void {
    event.stopPropagation();
    this.actionError.set(null);
    this.rejectTarget.set(c);
  }

  onRejected(): void {
    this.rejectTarget.set(null);
    this.reload();
  }

  private reload(): void {
    this.loadStats();
    this.loadCandidates();
  }

  // ── Display helpers ─────────────────────────────────────────────────────────
  initials(fn: string, ln: string): string {
    return ((fn?.[0] ?? '') + (ln?.[0] ?? '')).toUpperCase();
  }

  formatDate(d: string | null | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
