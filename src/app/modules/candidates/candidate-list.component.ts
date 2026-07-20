import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AvatarCell,
  BadgeCell,
  ButtonComponent,
  DafCellDirective,
  DataTableComponent,
  PaginationComponent,
  SelectComponent,
  SelectConfig,
  SelectOption,
  StatusBadgeComponent,
  TableColumn,
  TableConfig,
  TableRow,
  BadgeOptions,
  BadgeVariant,
} from '@khalilrebhiitec/daf360';
import { CandidateService } from './candidate.service';
import { RejectModalComponent } from './reject-modal.component';
import { UserStore } from '../../core/user.store';
import { DafHasPermissionDirective } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  CandidateListItem,
  CandidateStats,
  CandidateHistoryItem,
  PageResponse,
} from './candidate.model';
import { statusBadge } from '../../shared/status-badge.utils';
import { KpiCardComponent } from '../../shared/kpi-card.component';
import { RhSearchBarComponent } from '../../shared/search-bar.component';
import { ConfirmService } from '../../core/confirm.service';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING:        'neutral',
  ACCEPTED:       'success',
  REJECTED:       'danger',
  IT_IN_PROGRESS: 'info',
  EMAIL_RECEIVED: 'teal',
  HR_IN_PROGRESS: 'warning',
  HIRED:          'success',
  ARCHIVED:       'neutral',
};

@Component({
  selector: 'app-candidate-list',
  standalone: true,
  imports: [
    DafHasPermissionDirective,
    ButtonComponent,
    SelectComponent,
    KpiCardComponent,
    PaginationComponent,
    StatusBadgeComponent,
    DataTableComponent,
    DafCellDirective,
    RejectModalComponent,
    RhSearchBarComponent,
    TranslatePipe,
  ],
  templateUrl: './candidate-list.component.html',
})
export class CandidateListComponent implements OnInit {
  private svc       = inject(CandidateService);
  private confirm = inject(ConfirmService);
  protected router  = inject(Router);
  readonly userStore = inject(UserStore);
  private translate = inject(TranslateService);

  /** Candidate status codes, in workflow order, for the status filter select. */
  private readonly STATUS_CODES = [
    'PENDING', 'ACCEPTED', 'OFFER_SENT', 'REJECTED', 'IT_IN_PROGRESS',
    'EMAIL_RECEIVED', 'HR_IN_PROGRESS', 'HIRED', 'ARCHIVED',
  ];

  candidates    = signal<PageResponse<CandidateListItem> | null>(null);
  stats         = signal<CandidateStats>({ total: 0, pending: 0, accepted: 0, hired: 0 });
  history       = signal<CandidateHistoryItem[]>([]);
  selectedId    = signal<number | null>(null);

  isLoadingStats      = signal(true);
  isLoadingCandidates = signal(true);
  isLoadingHistory    = signal(false);
  showFilters         = signal(false);

  currentPage = signal(0);
  pageSize    = signal(10);

  // ── Filter signals bound to daf360 components ────────────────────────────
  searchValue    = signal<string | number | null>('');
  selectedStatus = signal<string[]>([]);

  // ── Reject modal state ────────────────────────────────────────────────────
  rejectTarget = signal<CandidateListItem | null>(null);
  isActioning  = signal(false);
  actionError  = signal<string | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly selectedCandidate = computed(() => {
    const id = this.selectedId();
    return this.candidates()?.content?.find(c => c.id === id) ?? null;
  });

  readonly canAcceptReject = computed(() =>
    this.userStore.hasPermission('ACCEPT_REJECT_CANDIDATE')
  );

  // ── daf360 options ────────────────────────────────────────────────────────
  readonly statusSelectConfig = computed<SelectConfig>(() => {
    this.translate.currentLang();
    return { placeholder: this.translate.instant('CANDIDATES.FILTERS.ALL_STATUSES') };
  });

  readonly statusSelectOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return this.STATUS_CODES.map(code => ({
      value: code,
      label: this.translate.instant('CANDIDATES.STATUS.' + code),
    }));
  });

  readonly skeletonRows = [1, 2, 3, 4, 5];

  protected readonly statusBadge = statusBadge;

  // ── daf-data-table setup ──────────────────────────────────────────────────
  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'candidat', label: t('CANDIDATES.LIST.COL_CANDIDATE'), type: 'avatar' },
      { key: 'appliedPosition', label: t('CANDIDATES.LIST.COL_POSITION') },
      { key: 'status', label: t('CANDIDATES.LIST.COL_STATUS'), type: 'badge' },
      { key: 'expectedStartDate', label: t('CANDIDATES.LIST.COL_START_DATE') },
      { key: '_actions', label: t('CANDIDATES.LIST.COL_ACTIONS'), align: 'right' },
    ];
  });

  readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return (this.candidates()?.content ?? []).map(c => ({
      candidat: {
        name: `${c.firstName} ${c.lastName}`,
        initials: this.getInitials(c.firstName, c.lastName),
        subtitle: c.emailPersonal,
      } as AvatarCell,
      appliedPosition: c.appliedPosition ?? '—',
      status: { label: this.getStatusLabel(c.status), options: this.getStatusBadgeOptions(c.status) } as BadgeCell,
      expectedStartDate: this.formatDateFr(c.expectedStartDate),
      _source: c,
    }));
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      hoverable: true,
      loading: this.isLoadingCandidates(),
      skeletonRows: this.skeletonRows.length,
      emptyMessage: this.translate.instant('CANDIDATES.LIST.EMPTY'),
    };
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadStats();
    this.loadCandidates();
  }

  loadStats(): void {
    this.isLoadingStats.set(true);
    this.svc.getStats().subscribe({
      next:  s  => { this.stats.set(s); this.isLoadingStats.set(false); },
      error: () => this.isLoadingStats.set(false),
    });
  }

  loadCandidates(): void {
    this.isLoadingCandidates.set(true);
    this.svc.getCandidates({
      paysId: this.userStore.currentUser()?.paysId,
      status: this.selectedStatus()[0] || undefined,
      search: (this.searchValue() as string) || undefined,
      page:   this.currentPage(),
      size:   this.pageSize(),
    }).subscribe({
      next:  r  => { this.candidates.set(r); this.isLoadingCandidates.set(false); },
      error: () => this.isLoadingCandidates.set(false),
    });
  }

  // ── Filter handlers ───────────────────────────────────────────────────────
  onSearch(value: string | number | null): void {
    this.searchValue.set(value);
    this.currentPage.set(0);
    this.loadCandidates();
  }

  onStatusChange(values: string[]): void {
    this.selectedStatus.set(values);
    this.currentPage.set(0);
    this.loadCandidates();
  }

  applyFilters(): void {
    this.currentPage.set(0);
    this.loadCandidates();
  }

  clearFilters(): void {
    this.searchValue.set('');
    this.selectedStatus.set([]);
    this.currentPage.set(0);
    this.loadCandidates();
  }

  toggleFilters(): void { this.showFilters.update(v => !v); }

  onPageChange(p: number): void { this.currentPage.set(p); this.loadCandidates(); }

  // ── Row selection ─────────────────────────────────────────────────────────
  onRowClick(candidateId: number): void {
    const same = this.selectedId() === candidateId;
    this.selectedId.set(same ? null : candidateId);
    if (same) return;
    this.isLoadingHistory.set(true);
    this.svc.getHistory(candidateId).subscribe({
      next:  h  => { this.history.set(h); this.isLoadingHistory.set(false); },
      error: () => this.isLoadingHistory.set(false),
    });
  }

  // ── Badge helper ──────────────────────────────────────────────────────────
  getStatusBadgeOptions(status: string): BadgeOptions {
    return { variant: STATUS_VARIANT[status] ?? 'neutral', size: 'sm', dot: true };
  }

  getStatusLabel(s: string): string {
    return this.translate.instant('CANDIDATES.STATUS.' + s);
  }

  // ── Timeline helpers ──────────────────────────────────────────────────────
  getTimelineDotStyle(action: string): object {
    const m: Record<string, { bg: string; color: string }> = {
      ACCEPT_CANDIDATE:            { bg: '#4648d4', color: '#fff' },
      ACCEPT:                      { bg: '#4648d4', color: '#fff' },
      REJECT_CANDIDATE:            { bg: '#ba1a1a', color: '#fff' },
      REJECT:                      { bg: '#ba1a1a', color: '#fff' },
      UPLOAD_CV:                   { bg: 'rgba(51,65,85,.1)', color: '#1d2b3e' },
      CREATE_CANDIDATE:            { bg: 'rgba(51,65,85,.1)', color: '#1d2b3e' },
      CREATE:                      { bg: 'rgba(51,65,85,.1)', color: '#1d2b3e' },
      SUBMIT_MS365_EMAIL:          { bg: '#004941', color: '#00c1ad' },
      COMPLETE_IT_PROVISIONING:    { bg: '#334155', color: '#9eadc5' },
      COMPLETE_ONBOARDING_PROFILE: { bg: '#4648d4', color: '#fff' },
    };
    const s = m[action] ?? { bg: 'rgba(51,65,85,.1)', color: '#1d2b3e' };
    return { 'background-color': s.bg, color: s.color };
  }

  getTimelineIcon(action: string): string {
    const m: Record<string, string> = {
      ACCEPT_CANDIDATE:            'check',
      ACCEPT:                      'check',
      REJECT_CANDIDATE:            'close',
      REJECT:                      'close',
      CREATE_CANDIDATE:            'person_add',
      CREATE:                      'person_add',
      UPLOAD_CV:                   'upload_file',
      UPDATE:                      'edit',
      UPDATE_CANDIDATE:            'edit',
      SUBMIT_MS365_EMAIL:          'computer',
      COMPLETE_IT_PROVISIONING:    'lan',
      COMPLETE_ONBOARDING_PROFILE: 'how_to_reg',
    };
    return m[action] ?? 'history';
  }

  // ── Misc helpers ──────────────────────────────────────────────────────────
  getInitials(fn: string, ln: string): string {
    return ((fn?.[0] ?? '') + (ln?.[0] ?? '')).toUpperCase();
  }

  formatDateFr(d: string | null | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    const mo = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    return `${dt.getDate()} ${mo[dt.getMonth()]} ${dt.getFullYear()}`;
  }

  formatTimestamp(ts: string | null): string {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
         + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Accept / Reject ───────────────────────────────────────────────────────
  async quickAccept(c: CandidateListItem, event: Event): Promise<void> {
    event.stopPropagation();
    if (!(await this.confirm.ask({
      title: this.translate.instant('CANDIDATES.CONFIRM.ACCEPT_TITLE'),
      message: this.translate.instant('CANDIDATES.CONFIRM.ACCEPT_MESSAGE', { name: `${c.firstName} ${c.lastName}` }),
      confirmLabel: this.translate.instant('CANDIDATES.ACTIONS.ACCEPT'), icon: 'check_circle',
    }))) return;
    this.isActioning.set(true);
    this.svc.accept(c.id).subscribe({
      next:  () => { this.isActioning.set(false); this.loadCandidates(); },
      error: err => { this.isActioning.set(false); this.actionError.set(err?.error?.message ?? this.translate.instant('CANDIDATES.ERRORS.GENERIC')); },
    });
  }

  openRejectModal(c: CandidateListItem, event: Event): void {
    event.stopPropagation();
    this.rejectTarget.set(c);
    this.actionError.set(null);
  }

  onRejected(): void {
    this.rejectTarget.set(null);
    this.loadCandidates();
  }
}
