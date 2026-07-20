import { Component, ElementRef, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  BadgeCell,
  ButtonComponent,
  CardComponent,
  DafCellDirective,
  DataTableComponent,
  MetricCardComponent,
  MetricCardOptions,
  MetricDelta,
  PaginationComponent,
  SelectComponent,
  SelectConfig,
  SelectOption,
  TableColumn,
  TableConfig,
  TableRow,
} from '@khalilrebhiitec/daf360';
import { CandidateService } from './candidate.service';
import { RejectModalComponent } from './reject-modal.component';
import { UserStore } from '../../core/user.store';
import { DafHasPermissionDirective } from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { avatarUrl } from '../../shared/utils/avatar.utils';
import { RhSearchBarComponent } from '../../shared/search-bar.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  CandidateListItem,
  CandidateDashboardStats,
  CandidateStatus,
  PageResponse,
} from './candidate.model';
import { PipelineService, PipelineActivity, PipelineObjective } from '../pipeline/services/pipeline.service';
import { ConfirmService } from '../../core/confirm.service';

const PAGE_SIZE = 10;

/** Icon/colour per audit action, for the "Activités Récentes" feed. */
const ACTIVITY_META: Record<string, { icon: string; bg: string; color: string }> = {
  ACCEPT:                   { icon: 'verified',      bg: 'bg-teal-100',   color: 'text-teal-700'   },
  HIRE_CANDIDATE:           { icon: 'check_circle',  bg: 'bg-green-100',  color: 'text-green-600'  },
  REJECT:                   { icon: 'person_remove', bg: 'bg-red-100',    color: 'text-red-500'    },
  SEND_OFFER:               { icon: 'send',          bg: 'bg-amber-100',  color: 'text-amber-600'  },
  ACCEPT_OFFER:             { icon: 'handshake',     bg: 'bg-teal-100',   color: 'text-teal-700'   },
  REJECT_OFFER:             { icon: 'thumb_down',    bg: 'bg-red-100',    color: 'text-red-500'    },
  RENEGOTIATE_OFFER:        { icon: 'sync',          bg: 'bg-amber-100',  color: 'text-amber-600'  },
  CREATE:                   { icon: 'person_add',    bg: 'bg-blue-100',   color: 'text-blue-600'   },
  UPLOAD_CV:                { icon: 'upload_file',   bg: 'bg-teal-100',   color: 'text-teal-600'   },
  COMPLETE_IT_PROVISIONING: { icon: 'terminal',      bg: 'bg-teal-100',   color: 'text-teal-600'   },
  UPDATE:                   { icon: 'mail_outline',  bg: 'bg-orange-100', color: 'text-orange-600' },
};

/** Kanban pulls the whole (tenant-scoped) candidate set in one page and groups it client-side. */
const KANBAN_FETCH_SIZE = 500;

/** A kanban column groups one or more candidate statuses into a workflow stage. */
interface KanbanColumn {
  key: string;
  label: string;
  statuses: CandidateStatus[];
  /** Solid accent (dot, column left-border, pill text). */
  accent: string;
  /** Tinted background for the card status badge. */
  badgeBg: string;
  candidates: CandidateListItem[];
}

/** Static kanban column definition: label is resolved via i18n at render time. */
interface KanbanColumnDef extends Omit<KanbanColumn, 'candidates' | 'label'> {
  labelKey: string;
}

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
    DafCellDirective,
    DataTableComponent,
    MetricCardComponent,
    SelectComponent,
    PaginationComponent,
    DafHasPermissionDirective,
    RejectModalComponent,
    RhSearchBarComponent,
    TranslatePipe,
  ],
  styles: [`
    /* Thin, subtle scrollbar for the horizontal kanban board. */
    .custom-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: var(--color-outline-variant, #c4c5d5); border-radius: 10px; }
  `],
  templateUrl: './candidates.component.html',
})
export class CandidatesComponent implements OnInit {
  private svc         = inject(CandidateService);
  private confirm = inject(ConfirmService);
  private pipelineSvc = inject(PipelineService);
  private router      = inject(Router);
  readonly userStore  = inject(UserStore);
  private translate   = inject(TranslateService);

  /** Candidate status codes, in workflow order, for the status filter select. */
  private readonly STATUS_CODES = [
    'PENDING', 'ACCEPTED', 'OFFER_SENT', 'REJECTED', 'IT_IN_PROGRESS',
    'EMAIL_RECEIVED', 'HR_IN_PROGRESS', 'HIRED', 'ARCHIVED',
  ];

  // ── Recent activity + monthly objectives (pipeline data) ────────────────────
  readonly activities = signal<PipelineActivity[]>([]);
  readonly objectives = signal<PipelineObjective[]>([]);

  readonly recentActivities = computed(() => this.activities().slice(0, 5));

  readonly currentObjective = computed<PipelineObjective | null>(() => {
    const o = this.objectives();
    return o.length ? o[o.length - 1] : null;
  });

  readonly objectiveProgress = computed<number>(() => {
    const o = this.currentObjective();
    if (!o || o.target === 0) return 0;
    return Math.min(100, Math.round((o.actual / o.target) * 100));
  });

  activityMeta(action: string): { icon: string; bg: string; color: string } {
    return ACTIVITY_META[action] ?? { icon: 'info', bg: 'bg-surface-container', color: 'text-outline' };
  }

  readonly page          = signal<PageResponse<CandidateListItem> | null>(null);
  readonly dashStats     = signal<CandidateDashboardStats>({
    totalCandidates: 0, monthGrowthPct: null,
    avgRecruitmentDays: null, avgRecruitmentDaysDelta: null, urgentPositions: 0,
    activeCandidates: 0, hiredTotal: 0, offerAcceptanceRate: null,
  });
  readonly loading       = signal(false);
  readonly statsLoading  = signal(false);
  readonly search        = signal('');
  readonly statusFilter  = signal('');
  readonly currentPage   = signal(0);

  readonly candidates    = computed(() => this.page()?.content ?? []);
  readonly totalElements = computed(() => this.page()?.totalElements ?? 0);
  readonly totalPages    = computed(() => this.page()?.totalPages ?? 0);

  // ── KPI tiles (design: Total Candidats · Délai Recrutement Moyen · Postes Urgents) ──
  readonly kpiTotal = computed(() => this.dashStats().totalCandidates);
  readonly kpiGrowthText = computed(() => {
    const g = this.dashStats().monthGrowthPct;
    if (g == null) return null;
    const r = Math.round(g);
    return `${r >= 0 ? '+' : ''}${r}% ce mois`;
  });
  readonly kpiGrowthPositive = computed(() => (this.dashStats().monthGrowthPct ?? 0) >= 0);

  readonly kpiAvgDaysText = computed(() => {
    const a = this.dashStats().avgRecruitmentDays;
    return a == null ? '—' : `${Math.round(a)} jours`;
  });
  readonly kpiAvgDeltaText = computed(() => {
    const d = this.dashStats().avgRecruitmentDaysDelta;
    if (d == null) return null;
    const r = Math.round(d);
    if (r === 0) return 'stable';
    return `${r > 0 ? '+' : ''}${r}j vs période préc.`;
  });
  /** Fewer days = improvement → render the delta in a positive colour. */
  readonly kpiAvgDeltaPositive = computed(() => (this.dashStats().avgRecruitmentDaysDelta ?? 0) <= 0);

  readonly kpiUrgent = computed(() => this.dashStats().urgentPositions);

  // ── Funnel-health KPIs (Pipeline RH page: distinct from the Candidats page) ──
  readonly kpiActive     = computed(() => this.dashStats().activeCandidates);
  readonly kpiHired      = computed(() => this.dashStats().hiredTotal);
  readonly kpiAcceptance = computed(() => this.dashStats().offerAcceptanceRate);

  readonly activeMetricOpts:     MetricCardOptions = { icon: 'groups',      iconColor: 'text-primary', iconBg: 'bg-primary/10' };
  readonly acceptanceMetricOpts: MetricCardOptions = { icon: 'thumb_up',    iconColor: 'text-teal',    iconBg: 'bg-surface-container-low' };
  readonly hiredMetricOpts:      MetricCardOptions = { icon: 'how_to_reg',  iconColor: 'text-teal',    iconBg: 'bg-surface-container-low' };

  readonly activeMetricValue     = computed(() => this.kpiActive().toLocaleString('fr-FR'));
  readonly hiredMetricValue      = computed(() => this.kpiHired().toLocaleString('fr-FR'));
  readonly acceptanceMetricValue = computed(() => {
    const r = this.kpiAcceptance();
    return r == null ? '—' : `${Math.round(r)}%`;
  });

  // ── daf-metric-card bindings (value / delta / options) ──────────────────────
  readonly totalMetricOpts:  MetricCardOptions = { icon: 'group',         iconColor: 'text-primary', iconBg: 'bg-primary/10' };
  readonly delayMetricOpts:  MetricCardOptions = { icon: 'timer',         iconColor: 'text-teal',    iconBg: 'bg-surface-container-low' };
  readonly urgentMetricOpts: MetricCardOptions = { icon: 'priority_high', iconColor: 'text-danger',  iconBg: 'bg-danger/10' };

  readonly totalMetricValue = computed(() => this.kpiTotal().toLocaleString('fr-FR'));
  readonly totalMetricDelta = computed<MetricDelta | null>(() => {
    const t = this.kpiGrowthText();
    return t ? { value: t, direction: this.kpiGrowthPositive() ? 'up' : 'down' } : null;
  });
  readonly delayMetricDelta = computed<MetricDelta | null>(() => {
    const t = this.kpiAvgDeltaText();
    return t ? { value: t, direction: this.kpiAvgDeltaPositive() ? 'up' : 'down' } : null;
  });
  readonly urgentMetricDelta = computed<MetricDelta | null>(() =>
    this.kpiUrgent() > 0
      ? { value: 'Action requise', direction: 'down' }
      : { value: 'À jour', direction: 'neutral' });

  // ── Kanban board horizontal navigation map (bottom-right) ───────────────────
  readonly boardScroll = signal({ left: 0, client: 0, scroll: 0 });

  /** True when the board content overflows horizontally (the nav map is only useful then). */
  readonly boardHasOverflow = computed(() => {
    const b = this.boardScroll();
    return b.scroll > b.client + 4;
  });

  /** Position/size of the viewport indicator inside the nav map, as % of the board width. */
  readonly viewportStyle = computed(() => {
    const b = this.boardScroll();
    if (b.scroll <= 0) return { left: '0%', width: '100%' };
    return {
      left:  Math.max(0, (b.left / b.scroll) * 100) + '%',
      width: Math.min(100, (b.client / b.scroll) * 100) + '%',
    };
  });

  /** The horizontally-scrolling kanban board, for the left/right scroll buttons. */
  private readonly kanbanBoard = viewChild<ElementRef<HTMLDivElement>>('kanbanBoard');

  // ── View toggle (kanban is the default; list on demand) ─────────────────────
  readonly viewMode      = signal<'list' | 'kanban'>('kanban');
  readonly kanbanItems   = signal<CandidateListItem[]>([]);
  readonly kanbanLoading = signal(false);
  readonly kanbanLoaded  = signal(false);

  /** Transient info banner for guided/blocked drag moves. */
  readonly notice = signal<string | null>(null);

  // ── Native HTML5 drag & drop state (no CDK — avoids Native Federation secondary-entry issues) ──
  readonly draggedId   = signal<number | null>(null);
  readonly dragOverKey = signal<string | null>(null);
  private draggedCandidate: CandidateListItem | null = null;

  /**
   * Kanban stages mirror the coded candidate workflow (PENDING → … → HIRED / REJECTED).
   * Each column owns a colour used for its dot, left-border and the card status badge.
   */
  private readonly columnDefs: KanbanColumnDef[] = [
    { key: 'pending',  labelKey: 'CANDIDATES.KANBAN.COL_PENDING',  statuses: ['PENDING'],                                            accent: '#d97706', badgeBg: 'rgba(217,119,6,0.12)' },
    { key: 'accepted', labelKey: 'CANDIDATES.KANBAN.COL_ACCEPTED', statuses: ['ACCEPTED', 'OFFER_SENT'],                             accent: '#0d9488', badgeBg: 'rgba(13,148,136,0.12)' },
    { key: 'progress', labelKey: 'CANDIDATES.KANBAN.COL_PROGRESS', statuses: ['IT_IN_PROGRESS', 'EMAIL_RECEIVED', 'HR_IN_PROGRESS'], accent: '#1e40af', badgeBg: 'rgba(30,64,175,0.12)' },
    { key: 'hired',    labelKey: 'CANDIDATES.KANBAN.COL_HIRED',    statuses: ['HIRED'],                                              accent: '#047857', badgeBg: 'rgba(4,120,87,0.12)' },
    { key: 'rejected', labelKey: 'CANDIDATES.KANBAN.COL_REJECTED', statuses: ['REJECTED', 'ARCHIVED'],                               accent: '#ba1a1a', badgeBg: 'rgba(186,26,26,0.12)' },
  ];

  /** Highest fit score first; candidates without a score sink to the bottom. */
  private byFitScoreDesc(a: CandidateListItem, b: CandidateListItem): number {
    return (b.fitScore ?? -1) - (a.fitScore ?? -1);
  }

  readonly kanbanColumns = computed<KanbanColumn[]>(() => {
    this.translate.currentLang();
    const all = this.kanbanItems();
    return this.columnDefs.map(def => ({
      ...def,
      label: this.translate.instant(def.labelKey),
      candidates: all
        .filter(c => def.statuses.includes(c.status))
        .sort((a, b) => this.byFitScoreDesc(a, b)),
    }));
  });

  // ── Mobile kanban: stage pills + card list instead of horizontal columns ────
  readonly mobileStageFilter = signal<string | null>(null);

  readonly mobileFilteredCandidates = computed(() => {
    const filter = this.mobileStageFilter();
    if (!filter) return [...this.kanbanItems()].sort((a, b) => this.byFitScoreDesc(a, b));
    return this.kanbanColumns().find(c => c.key === filter)?.candidates ?? [];
  });

  // ── Reject modal state ─────────────────────────────────────────────────────
  readonly rejectTarget = signal<CandidateListItem | null>(null);
  readonly actioningId  = signal<number | null>(null);
  readonly actionError  = signal<string | null>(null);

  readonly canAcceptReject = computed(() =>
    this.userStore.hasPermission('ACCEPT_REJECT_CANDIDATE'),
  );

  readonly statusSelectOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return this.STATUS_CODES.map(code => ({
      value: code,
      label: this.translate.instant('CANDIDATES.STATUS.' + code),
    }));
  });

  readonly statusSelectConfig = computed<SelectConfig>(() => {
    this.translate.currentLang();
    return { placeholder: this.translate.instant('CANDIDATES.FILTERS.ALL_STATUSES') };
  });

  protected readonly statusBadge = statusBadge;

  // ── List view data table ─────────────────────────────────────────────────────
  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'candidat', label: t('CANDIDATES.LIST.COL_CANDIDATE'), type: 'avatar' },
      { key: 'poste', label: t('CANDIDATES.LIST.COL_POSITION') },
      { key: 'status', label: t('CANDIDATES.LIST.COL_STATUS'), type: 'badge' },
      { key: 'expectedStartDate', label: t('CANDIDATES.LIST.COL_START_DATE') },
      { key: '_actions', label: t('CANDIDATES.LIST.COL_ACTIONS'), align: 'right', clickable: true },
    ];
  });

  readonly rows = computed<TableRow[]>(() =>
    this.candidates().map(c => ({
      candidat: {
        name: `${c.firstName} ${c.lastName}`,
        initials: this.initials(c.firstName, c.lastName),
        avatar: this.avatarSrc(c.gender),
        subtitle: c.emailPersonal,
      },
      poste: c.appliedPosition ?? '—',
      status: { label: this.statusBadge(c.status).label, options: this.statusBadge(c.status).options } as BadgeCell,
      expectedStartDate: this.formatDate(c.expectedStartDate),
      _source: c,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => ({
    hoverable: true,
    loading: this.loading(),
  }));

  ngOnInit(): void {
    this.loadStats();
    this.loadKanban(); // kanban is the default view
    this.loadPipelineExtras();
  }

  /** Recent activity + monthly objectives, from the pipeline endpoints. */
  private loadPipelineExtras(): void {
    this.pipelineSvc.getActivity().subscribe({ next: a => this.activities.set(a), error: () => {} });
    this.pipelineSvc.getObjectives().subscribe({ next: o => this.objectives.set(o), error: () => {} });
  }

  private loadStats(): void {
    this.statsLoading.set(true);
    this.svc.getDashboardStats().subscribe({
      next:  s  => { this.dashStats.set(s); this.statsLoading.set(false); },
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

  private loadKanban(): void {
    this.kanbanLoading.set(true);
    this.svc.getCandidates({
      paysId: this.userStore.currentUser()?.paysId,
      search: this.search() || undefined,
      page:   0,
      size:   KANBAN_FETCH_SIZE,
    }).subscribe({
      next:  r  => {
        this.kanbanItems.set(r.content);
        this.kanbanLoaded.set(true);
        this.kanbanLoading.set(false);
        setTimeout(() => this.syncBoardMetrics()); // board is now in the DOM
      },
      error: () => this.kanbanLoading.set(false),
    });
  }

  /** Scroll a given column into view (nav-map click). */
  scrollToColumn(index: number): void {
    const el = this.kanbanBoard()?.nativeElement;
    if (!el) return;
    el.scrollTo({ left: index * 344, behavior: 'smooth' }); // 320px column + 24px gap
  }

  onBoardScroll(): void { this.syncBoardMetrics(); }

  @HostListener('window:resize')
  syncBoardMetrics(): void {
    const el = this.kanbanBoard()?.nativeElement;
    if (!el) return;
    this.boardScroll.set({ left: el.scrollLeft, client: el.clientWidth, scroll: el.scrollWidth });
  }

  setView(mode: 'list' | 'kanban'): void {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    this.notice.set(null);
    if (mode === 'kanban' && !this.kanbanLoaded()) {
      this.loadKanban();
    } else if (mode === 'kanban') {
      setTimeout(() => this.syncBoardMetrics()); // re-measure when returning to an already-loaded board
    } else if (mode === 'list' && !this.page()) {
      this.loadCandidates();
    }
  }

  onSearch(value: string | number | null): void {
    this.search.set((value as string) ?? '');
    this.currentPage.set(0);
    if (this.viewMode() === 'kanban') {
      this.loadKanban();
    } else {
      this.loadCandidates();
    }
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
  async quickAccept(c: CandidateListItem, event: Event): Promise<void> {
    event.stopPropagation();
    if (!(await this.confirm.ask({
      title: this.translate.instant('CANDIDATES.CONFIRM.ACCEPT_TITLE'),
      message: this.translate.instant('CANDIDATES.CONFIRM.ACCEPT_MESSAGE', { name: `${c.firstName} ${c.lastName}` }),
      confirmLabel: this.translate.instant('CANDIDATES.ACTIONS.ACCEPT'), icon: 'check_circle',
    }))) return;
    this.actioningId.set(c.id);
    this.actionError.set(null);
    this.svc.accept(c.id).subscribe({
      next:  () => { this.actioningId.set(null); this.reload(); },
      error: err => {
        this.actioningId.set(null);
        this.actionError.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('CANDIDATES.ERRORS.ACCEPT'));
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
    if (this.page()) this.loadCandidates();
    if (this.kanbanLoaded()) this.loadKanban();
  }

  // ── Drag & drop workflow ────────────────────────────────────────────────────
  onDragStart(c: CandidateListItem): void {
    this.draggedCandidate = c;
    this.draggedId.set(c.id);
  }

  onDragEnd(): void {
    this.draggedCandidate = null;
    this.draggedId.set(null);
    this.dragOverKey.set(null);
  }

  onDragOver(event: DragEvent, col: KanbanColumn): void {
    event.preventDefault(); // required so the column becomes a valid drop target
    if (this.dragOverKey() !== col.key) this.dragOverKey.set(col.key);
  }

  onDragLeave(col: KanbanColumn): void {
    if (this.dragOverKey() === col.key) this.dragOverKey.set(null);
  }

  onDrop(event: DragEvent, col: KanbanColumn): void {
    event.preventDefault();
    const candidate = this.draggedCandidate;
    this.onDragEnd();
    if (candidate) this.applyStageMove(candidate, col);
  }

  /**
   * Applies a card dropped onto another column. Each move maps to the REAL
   * coded transition — no blind status flips (which would skip provisioning /
   * contract creation). Immediate transitions call the guarded endpoints;
   * multi-step transitions route the user to the dedicated flow.
   */
  private applyStageMove(candidate: CandidateListItem, target: KanbanColumn): void {
    const status = candidate.status;
    if (target.statuses.includes(status)) return; // dropped in its own column, ignore
    this.notice.set(null);
    this.actionError.set(null);

    switch (target.key) {
      case 'accepted':
        if (status === 'PENDING') { this.dragAccept(candidate); }
        else this.notice.set(this.translate.instant('CANDIDATES.NOTICE.ONLY_PENDING_ACCEPT'));
        break;

      case 'rejected':
        if (status === 'PENDING') { this.rejectTarget.set(candidate); }
        else this.notice.set(this.translate.instant('CANDIDATES.NOTICE.ONLY_PENDING_REJECT'));
        break;

      case 'progress':
        if (status === 'ACCEPTED') {
          this.notice.set(this.translate.instant('CANDIDATES.NOTICE.IT_DEDICATED'));
          this.router.navigate(['/rh/it-provisioning']);
        } else {
          this.notice.set(this.translate.instant('CANDIDATES.NOTICE.ACCEPT_FIRST'));
        }
        break;

      case 'hired':
        if (status === 'EMAIL_RECEIVED' || status === 'HR_IN_PROGRESS') {
          this.router.navigate(['/rh/onboarding', candidate.id]);
        } else {
          this.notice.set(this.translate.instant('CANDIDATES.NOTICE.HIRE_FLOW'));
        }
        break;

      default:
        this.notice.set(this.translate.instant('CANDIDATES.NOTICE.MOVE_NOT_ALLOWED'));
    }
  }

  private dragAccept(c: CandidateListItem): void {
    this.actioningId.set(c.id);
    this.patchLocalStatus(c.id, 'ACCEPTED'); // optimistic — card jumps to Acceptés
    this.svc.accept(c.id).subscribe({
      next:  () => { this.actioningId.set(null); this.reload(); },
      error: err => {
        this.actioningId.set(null);
        this.actionError.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('CANDIDATES.ERRORS.ACCEPT'));
        this.loadKanban(); // revert optimistic move
      },
    });
  }

  /** Optimistically patch a candidate's status in the kanban set so the card regroups instantly. */
  private patchLocalStatus(id: number, status: CandidateStatus): void {
    this.kanbanItems.update(items =>
      items.map(c => (c.id === id ? { ...c, status } : c)),
    );
  }

  // ── Display helpers ─────────────────────────────────────────────────────────
  initials(fn: string, ln: string): string {
    return ((fn?.[0] ?? '') + (ln?.[0] ?? '')).toUpperCase();
  }

  /**
   * Gender-based avatar image URL, or null when gender is unknown so the card/row
   * falls back to initials. Keys off FEMALE via the shared avatar util.
   */
  avatarSrc(gender: string | null | undefined): string | undefined {
    const g = gender?.trim().toUpperCase();
    if (!g || g === 'UNSPECIFIED') return undefined;
    return avatarUrl(gender);
  }

  /** Column definition owning a given status (drives per-status card colour on mobile). */
  private columnForStatus(status: CandidateStatus): KanbanColumnDef | undefined {
    return this.columnDefs.find(d => d.statuses.includes(status));
  }

  colorForStatus(status: CandidateStatus): string {
    return this.columnForStatus(status)?.accent ?? '#64748b';
  }

  badgeBgForStatus(status: CandidateStatus): string {
    return this.columnForStatus(status)?.badgeBg ?? 'rgba(100,116,139,0.12)';
  }

  /** Compact "12 juil. · 14:00" label for a scheduled interview. */
  interviewDateText(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  }

  formatDate(d: string | null | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Colour class for the fit-score chip (teal ≥85, blue ≥65, muted below). */
  fitScoreClass(score: number | null | undefined): string {
    if (score == null) return 'text-outline';
    if (score >= 85) return 'text-teal';
    if (score >= 65) return 'text-primary';
    return 'text-error';
  }

  /** Whole days the candidate has been in the pipeline (since createdAt). */
  daysInPipeline(createdAt: string | null | undefined): number | null {
    if (!createdAt) return null;
    const dt = new Date(createdAt);
    if (isNaN(dt.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - dt.getTime()) / 86_400_000));
  }

  /** Phase-aware primary footer metric, driven by the candidate's status. */
  phaseMeta(c: CandidateListItem): { icon: string; text: string } {
    switch (c.status) {
      case 'HIRED':
        return { icon: 'login', text: c.expectedStartDate ? 'Début ' + this.formatDate(c.expectedStartDate) : 'Embauché' };
      case 'EMAIL_RECEIVED':
        return { icon: 'event', text: c.expectedStartDate ? 'Début ' + this.formatDate(c.expectedStartDate) : 'Offre envoyée' };
      case 'REJECTED':
      case 'ARCHIVED':
        return { icon: 'history', text: 'Clôturé' };
      default: {
        const d = this.daysInPipeline(c.createdAt);
        return { icon: 'schedule', text: d != null ? 'Depuis ' + d + ' j' : 'Nouveau' };
      }
    }
  }
}
