import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  BadgeCell,
  ButtonComponent,
  CardComponent,
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
} from '@khalilrebhiitec/daf360';
import { CandidateService } from './candidate.service';
import { RejectModalComponent } from './reject-modal.component';
import { UserStore } from '../../core/user.store';
import { PermissionDirective } from '../../shared/permission.directive';
import { statusBadge } from '../../shared/status-badge.utils';
import { KpiCardComponent } from '../../shared/kpi-card.component';
import { RhSearchBarComponent } from '../../shared/search-bar.component';
import {
  CandidateListItem,
  CandidateStats,
  CandidateStatus,
  CANDIDATE_STATUS_OPTIONS,
  PageResponse,
} from './candidate.model';

const PAGE_SIZE = 10;

/** Kanban pulls the whole (tenant-scoped) candidate set in one page and groups it client-side. */
const KANBAN_FETCH_SIZE = 500;

/** A kanban column groups one or more candidate statuses into a workflow stage. */
interface KanbanColumn {
  key: string;
  label: string;
  statuses: CandidateStatus[];
  dot: string;
  candidates: CandidateListItem[];
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
    KpiCardComponent,
    SelectComponent,
    StatusBadgeComponent,
    PaginationComponent,
    PermissionDirective,
    RejectModalComponent,
    RhSearchBarComponent,
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

  /** Kanban stages mirror the coded candidate workflow (PENDING → … → HIRED / REJECTED). */
  private readonly columnDefs: Omit<KanbanColumn, 'candidates'>[] = [
    { key: 'pending',  label: 'En attente',      statuses: ['PENDING'],                                            dot: 'bg-secondary' },
    { key: 'accepted', label: 'Acceptés',        statuses: ['ACCEPTED'],                                           dot: 'bg-teal' },
    { key: 'progress', label: 'IT & Onboarding', statuses: ['IT_IN_PROGRESS', 'EMAIL_RECEIVED', 'HR_IN_PROGRESS'], dot: 'bg-primary' },
    { key: 'hired',    label: 'Embauchés',       statuses: ['HIRED'],                                              dot: 'bg-tertiary' },
    { key: 'rejected', label: 'Rejetés',         statuses: ['REJECTED', 'ARCHIVED'],                               dot: 'bg-danger' },
  ];

  readonly kanbanColumns = computed<KanbanColumn[]>(() => {
    const all = this.kanbanItems();
    return this.columnDefs.map(def => ({
      ...def,
      candidates: all.filter(c => def.statuses.includes(c.status)),
    }));
  });

  // ── Mobile kanban: stage pills + card list instead of horizontal columns ────
  readonly mobileStageFilter = signal<string | null>(null);

  readonly mobileFilteredCandidates = computed(() => {
    const filter = this.mobileStageFilter();
    if (!filter) return this.kanbanItems();
    return this.kanbanColumns().find(c => c.key === filter)?.candidates ?? [];
  });

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

  // ── List view data table ─────────────────────────────────────────────────────
  readonly columns: TableColumn[] = [
    { key: 'candidat', label: 'Candidat', type: 'avatar' },
    { key: 'poste', label: 'Poste' },
    { key: 'status', label: 'Statut', type: 'badge' },
    { key: 'expectedStartDate', label: 'Début prévu' },
    { key: '_actions', label: 'Actions', align: 'right', clickable: true },
  ];

  readonly rows = computed<TableRow[]>(() =>
    this.candidates().map(c => ({
      candidat: {
        name: `${c.firstName} ${c.lastName}`,
        initials: this.initials(c.firstName, c.lastName),
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
      },
      error: () => this.kanbanLoading.set(false),
    });
  }

  setView(mode: 'list' | 'kanban'): void {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    this.notice.set(null);
    if (mode === 'kanban' && !this.kanbanLoaded()) {
      this.loadKanban();
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
        else this.notice.set('Seuls les candidats « En attente » peuvent être acceptés.');
        break;

      case 'rejected':
        if (status === 'PENDING') { this.rejectTarget.set(candidate); }
        else this.notice.set('Seuls les candidats « En attente » peuvent être rejetés.');
        break;

      case 'progress':
        if (status === 'ACCEPTED') {
          this.notice.set('Le provisioning IT (création du compte) se fait sur la page dédiée.');
          this.router.navigate(['/rh/it-provisioning']);
        } else {
          this.notice.set('Acceptez d’abord le candidat pour démarrer le provisioning IT.');
        }
        break;

      case 'hired':
        if (status === 'EMAIL_RECEIVED' || status === 'HR_IN_PROGRESS') {
          this.router.navigate(['/rh/onboarding', candidate.id]);
        } else {
          this.notice.set('Le candidat doit passer par le provisioning IT puis l’onboarding avant d’être embauché.');
        }
        break;

      default:
        this.notice.set('Déplacement non autorisé.');
    }
  }

  private dragAccept(c: CandidateListItem): void {
    this.actioningId.set(c.id);
    this.patchLocalStatus(c.id, 'ACCEPTED'); // optimistic — card jumps to Acceptés
    this.svc.accept(c.id).subscribe({
      next:  () => { this.actioningId.set(null); this.reload(); },
      error: err => {
        this.actioningId.set(null);
        this.actionError.set(err?.error?.detail ?? err?.error?.message ?? "Erreur lors de l'acceptation.");
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
