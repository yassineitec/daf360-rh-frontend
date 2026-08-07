import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';
import {
  ButtonComponent,
  DafHasPermissionDirective,
  FilterField,
  FilterResult,
  MetricCardComponent,
  MetricDelta,
  PageComponent,
  PageHeaderComponent,
  SearchToolbarComponent,
  SearchToolbarFilterConfig,
  ToolbarToggleOption,
} from '@khalilrebhiitec/daf360';

import { UserStore } from '../../core/user.store';
import { OffboardingService } from '../offboarding/offboarding.service';
import { OffboardingWorkflowInstance, isTerminal } from '../offboarding/models/offboarding.model';
import {
  BOARD_STAGES,
  BoardColumn,
  BoardStageKey,
  OFFBOARDING_KEY,
  byFitScoreDesc,
} from './board.model';
import { OfferModalComponent, OfferMode } from './components/offer-modal.component';
import { RefuseOfferModalComponent } from './components/refuse-offer-modal.component';
import { PipelineBoardSectionComponent } from './sections/pipeline-board-section.component';
import { PipelineMobileSectionComponent, MobilePipelineItem } from './sections/pipeline-mobile-section.component';
import { PipelineTableSectionComponent } from './sections/pipeline-table-section.component';
import { CreateOfferRequest, OfferService } from './services/offer.service';
import { KanbanCandidate, KanbanColumn, PipelineService, PipelineStats } from './services/pipeline.service';

/** Board or flat list. The choice survives search, filtering and a re-fetch. */
type ViewMode = 'kanban' | 'list';

/**
 * /rh/candidates — the recruitment board (Préqualification / Entretien / Offre /
 * Recruté), fed by `/api/hr/pipeline/kanban`, plus a read-only Offboarding
 * column for employees in an active offboarding workflow.
 *
 * Architecture follows UI-PLAYBOOK §1 + §8b: the template is `daf-page` +
 * `daf-page-header` + the KPI row + `daf-search-toolbar` + one section component
 * per view, and every section is a stateless input/output shell. **All view state
 * lives here** — `search`, `stageFilter`, `viewMode`, the per-column sort, the
 * modal targets — which is what makes flipping between board and list lossless.
 *
 * The kanban endpoint returns the whole tenant-scoped set in one call, so search
 * and the stage filter are applied client-side and the list view is a flattened
 * projection of the same columns. That is also why there is no `daf-pagination`
 * here: there is no second page to fetch.
 */
@Component({
  selector: 'rh-pipeline',
  standalone: true,
  imports: [
    ButtonComponent,
    DafHasPermissionDirective,
    MetricCardComponent,
    PageComponent,
    PageHeaderComponent,
    SearchToolbarComponent,
    PipelineBoardSectionComponent,
    PipelineTableSectionComponent,
    PipelineMobileSectionComponent,
    OfferModalComponent,
    RefuseOfferModalComponent,
    TranslatePipe,
  ],
  templateUrl: './pipeline.component.html',
})
export class PipelineComponent implements OnInit {
  private pipelineService = inject(PipelineService);
  private offerService    = inject(OfferService);
  private offboardingSvc    = inject(OffboardingService);
  private userStore       = inject(UserStore);
  private router          = inject(Router);
  private translate       = inject(TranslateService);

  // ── Data ───────────────────────────────────────────────────────────────────
  private readonly rawColumns = signal<KanbanColumn[]>([]);
  readonly stats              = signal<PipelineStats | null>(null);
  private readonly offboardingItems = signal<OffboardingWorkflowInstance[]>([]);

  /** Whole-page skeleton — first load only (UI-PLAYBOOK §5). */
  readonly firstLoad = signal(true);
  /** Every subsequent fetch — skeletons inside the affected section only. */
  readonly loading   = signal(false);

  // ── View state (survives a view-mode switch) ───────────────────────────────
  readonly viewMode          = signal<ViewMode>('kanban');
  readonly search            = signal('');
  readonly stageFilter       = signal('');
  readonly mobileStageFilter = signal<string | null>(null);
  readonly columnSortDirs    = signal<Record<string, 'asc' | 'desc'>>({});

  // ── Feedback ───────────────────────────────────────────────────────────────
  readonly notice      = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actioningId = signal<number | null>(null);

  // ── Offboarding (display-only, separate HR workflow) ───────────────────────
  readonly canViewOffboarding = computed(() => this.userStore.hasPermission('RH_MANAGE_OFFBOARDING'));

  /** Active (non-terminal) offboarding files only. */
  readonly offboardingActive = computed(() =>
    this.offboardingItems().filter(o => !isTerminal(o.status)),
  );

  // ── Board ──────────────────────────────────────────────────────────────────
  /**
   * The four design columns, populated from the kanban response.
   *
   * Entretien is interview-driven: it holds every interview-phase candidate PLUS
   * any still-pending candidate who already has a planned interview waiting.
   * Those pending-with-interview cards leave Préqualification.
   */
  readonly boardColumns = computed<BoardColumn[]>(() => {
    this.translate.currentLang();
    const cols  = this.rawColumns();
    const term  = this.search().trim().toLowerCase();
    const stage = this.stageFilter();
    const dirs  = this.columnSortDirs();

    // Free-text match over the fields a card actually shows.
    const matches = (c: KanbanCandidate) =>
      !term ||
      [c.fullName, c.poste, c.email, c.location, ...(c.skills ?? [])]
        .some(v => (v ?? '').toString().toLowerCase().includes(term));

    const stageOf = (key: string) =>
      (cols.find(c => (c.stage ?? '').toUpperCase() === key)?.candidates ?? []).filter(matches);

    const screening        = stageOf('SCREENING');
    const entretienStage   = stageOf('ENTRETIEN');
    const prequalification = screening.filter(c => !c.nextEvent);
    const entretien        = [...entretienStage, ...screening.filter(c => !!c.nextEvent)];

    return BOARD_STAGES.map(s => {
      const dir = dirs[s.key] ?? 'desc';
      const candidates =
        stage && stage !== s.key ? [] :
        s.key === 'SCREENING'    ? prequalification :
        s.key === 'ENTRETIEN'    ? entretien :
        stageOf(s.key);
      const { labelKey, ...rest } = s;
      return {
        ...rest,
        label:   this.translate.instant(labelKey),
        sortDir: dir,
        candidates: [...candidates].sort((a, b) => (dir === 'asc' ? -byFitScoreDesc(a, b) : byFitScoreDesc(a, b))),
      };
    });
  });

  readonly visibleCount = computed(() =>
    this.boardColumns().reduce((sum, col) => sum + col.candidates.length, 0),
  );

  toggleColumnSort(key: string): void {
    this.columnSortDirs.update(dirs => ({ ...dirs, [key]: dirs[key] === 'asc' ? 'desc' : 'asc' }));
  }

  // ── Mobile list ────────────────────────────────────────────────────────────
  /**
   * The mobile list carries the stage each candidate was grouped into, because
   * the card footer is stage-driven and the board's grouping (not the raw
   * status) is what the user is looking at.
   */
  readonly mobileItems = computed<MobilePipelineItem[]>(() => {
    const key  = this.mobileStageFilter();
    const cols = this.boardColumns();
    if (key === OFFBOARDING_KEY) return [];
    const picked = key ? cols.filter(c => c.key === key) : cols;
    const items = picked.flatMap(col =>
      col.candidates.map(candidate => ({ candidate, stage: col.key as BoardStageKey })),
    );
    return key ? items : items.sort((a, b) => byFitScoreDesc(a.candidate, b.candidate));
  });

  // ── Toolbar ────────────────────────────────────────────────────────────────
  /** The stage dropdown belongs *inside* the filter panel, not loose beside the search. */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    return [{
      name: 'stage',
      label: this.translate.instant('PIPELINE.COL_STAGE'),
      type: 'select',
      placeholder: this.translate.instant('PIPELINE.FILTERS.ALL_STAGES'),
      options: BOARD_STAGES.map(s => ({ value: s.key, label: this.translate.instant(s.labelKey) })),
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
      title:        t('PIPELINE.FILTERS.TITLE'),
      applyLabel:   t('PIPELINE.FILTERS.APPLY'),
      cancelLabel:  t('PIPELINE.FILTERS.CANCEL'),
      resetLabel:   t('PIPELINE.FILTERS.RESET'),
      triggerLabel: t('PIPELINE.FILTERS.TRIGGER'),
      align:        'right',
      initialValues: { stage: this.stageFilter() ? [this.stageFilter()] : [] },
    };
  });

  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'kanban', icon: 'view_kanban', tooltip: this.translate.instant('PIPELINE.VIEW_KANBAN') },
      { id: 'list',   icon: 'view_list',   tooltip: this.translate.instant('PIPELINE.VIEW_LIST')   },
    ];
  });

  onSearch(value: string): void {
    if (value === this.search()) return; // daf-search-toolbar re-emits on blur
    this.search.set(value ?? '');
  }

  applyFilters(result: FilterResult): void {
    this.stageFilter.set(typeof result['stage'] === 'string' ? result['stage'] : '');
  }

  setView(mode: string): void {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode as ViewMode);
    this.notice.set(null);
  }

  // ── KPI tiles ──────────────────────────────────────────────────────────────
  readonly kpiTotal  = computed(() => this.stats()?.totalCandidats ?? 0);
  readonly kpiDelay  = computed(() => this.stats()?.delaiMoyenJours ?? null);
  readonly kpiUrgent = computed(() => this.stats()?.urgents ?? 0);

  readonly totalMetricValue = computed(() => this.kpiTotal().toLocaleString('fr-FR'));
  readonly delayMetricValue = computed(() => {
    this.translate.currentLang();
    const d = this.kpiDelay();
    return d != null ? this.translate.instant('PIPELINE.DAYS', { count: d }) : '—';
  });
  readonly urgentMetricValue = computed(() => {
    this.translate.currentLang();
    return this.translate.instant('PIPELINE.URGENT_OPEN', { count: this.kpiUrgent() });
  });

  /** Deltas are translated — they used to be hardcoded English on a French page. */
  readonly totalDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const s = this.stats();
    if (!s) return null;
    const rate = s.totalCandidats > 0 ? Math.round((s.recrutementsClos / s.totalCandidats) * 100) : 0;
    return {
      value: this.translate.instant('PIPELINE.DELTA.CLOSURE_RATE', { pct: rate }),
      direction: rate >= 50 ? 'up' : rate >= 30 ? 'neutral' : 'down',
    };
  });

  readonly delayDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const d = this.kpiDelay();
    if (d == null) return null;
    return d > 30 ? { value: this.translate.instant('PIPELINE.DELTA.DELAY_OVER'),  direction: 'down'    }
         : d > 15 ? { value: this.translate.instant('PIPELINE.DELTA.DELAY_OK'),    direction: 'neutral' }
                  : { value: this.translate.instant('PIPELINE.DELTA.DELAY_GOOD'),  direction: 'up'      };
  });

  readonly urgentDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const urgent = this.kpiUrgent();
    if (urgent === 0) return null;
    return {
      value: this.translate.instant('PIPELINE.DELTA.URGENT', { count: urgent }),
      direction: 'down',
    };
  });

  // ── Load ───────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    forkJoin({
      kanban:      this.pipelineService.getKanban().pipe(catchError(() => of(null))),
      stats:       this.pipelineService.getStats().pipe(catchError(() => of(null))),
      offboarding: this.canViewOffboarding()
        ? this.offboardingSvc.listOffboarding().pipe(catchError(() => of([] as OffboardingWorkflowInstance[])))
        : of([] as OffboardingWorkflowInstance[]),
    }).subscribe(({ kanban, stats, offboarding }) => {
      if (kanban) this.rawColumns.set(kanban);
      if (stats)  this.stats.set(stats);
      this.offboardingItems.set(offboarding ?? []);
      this.firstLoad.set(false);
    });
  }

  /** Re-fetch after an action — section-level skeletons, header and KPIs stay put. */
  private reload(): void {
    this.loading.set(true);
    forkJoin({
      kanban: this.pipelineService.getKanban().pipe(catchError(() => of(null))),
      stats:  this.pipelineService.getStats().pipe(catchError(() => of(null))),
    }).subscribe(({ kanban, stats }) => {
      if (kanban) this.rawColumns.set(kanban);
      if (stats)  this.stats.set(stats);
      this.loading.set(false);
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  onNewCandidate(): void { this.router.navigate(['/rh/candidates', 'new']); }
  onView(id: number): void { this.router.navigate(['/rh/candidates', id]); }
  onViewOffboarding(id: number): void { this.router.navigate(['/rh/offboarding', id]); }

  // ── Offer modal ────────────────────────────────────────────────────────────
  readonly offerTarget     = signal<KanbanCandidate | null>(null);
  readonly offerMode       = signal<OfferMode>('send');
  readonly offerInitial    = signal<CreateOfferRequest | null>(null);
  readonly offerSubmitting = signal(false);
  readonly offerError      = signal<string | null>(null);

  openOfferModal({ candidate, event }: { candidate: KanbanCandidate; event: Event }, mode: OfferMode): void {
    event.stopPropagation();
    this.offerError.set(null);
    this.offerMode.set(mode);
    this.offerInitial.set(null);
    this.offerTarget.set(candidate);
    // Renegotiation: seed the form with the current offer once it lands.
    if (mode === 'renegotiate') {
      this.offerService.getOffer(candidate.id).subscribe({
        next: o => this.offerInitial.set({
          askedSalary: o.askedSalary, proposedSalary: o.proposedSalary, salaryNote: o.salaryNote,
          noticePeriodDays: o.noticePeriodDays, noticePeriodNote: o.noticePeriodNote,
          expectedHireDate: o.expectedHireDate, expiryDate: o.expiryDate,
        }),
        error: () => { /* keep the blank form if the offer can't be loaded */ },
      });
    }
  }

  closeOfferModal(): void {
    this.offerTarget.set(null);
    this.offerInitial.set(null);
  }

  submitOffer(body: CreateOfferRequest): void {
    const target = this.offerTarget();
    if (!target) return;
    const renegotiate = this.offerMode() === 'renegotiate';
    this.offerSubmitting.set(true);
    this.offerError.set(null);
    const call = renegotiate
      ? this.offerService.renegotiateOffer(target.id, body)
      : this.offerService.sendOffer(target.id, body);
    call.subscribe({
      next: () => {
        this.offerSubmitting.set(false);
        this.closeOfferModal();
        this.notice.set(this.translate.instant(
          renegotiate ? 'PIPELINE.NOTICE.RENEGOTIATED' : 'PIPELINE.NOTICE.SENT',
          { name: target.fullName },
        ));
        this.reload();
      },
      error: err => {
        this.offerSubmitting.set(false);
        this.offerError.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('PIPELINE.ERRORS.SEND'));
      },
    });
  }

  // ── Accept ─────────────────────────────────────────────────────────────────
  acceptOffer({ candidate, event }: { candidate: KanbanCandidate; event: Event }): void {
    event.stopPropagation();
    this.actioningId.set(candidate.id);
    this.notice.set(null);
    this.actionError.set(null);
    this.offerService.acceptOffer(candidate.id).subscribe({
      next: () => {
        this.actioningId.set(null);
        this.notice.set(this.translate.instant('PIPELINE.NOTICE.ACCEPTED', { name: candidate.fullName }));
        this.reload();
      },
      error: err => {
        this.actioningId.set(null);
        this.actionError.set(err?.error?.detail ?? this.translate.instant('PIPELINE.ERRORS.ACCEPT'));
      },
    });
  }

  // ── Refuse modal ───────────────────────────────────────────────────────────
  readonly refuseTarget     = signal<KanbanCandidate | null>(null);
  readonly refuseSubmitting = signal(false);
  readonly refuseError      = signal<string | null>(null);

  openRefuseModal({ candidate, event }: { candidate: KanbanCandidate; event: Event }): void {
    event.stopPropagation();
    this.refuseError.set(null);
    this.refuseTarget.set(candidate);
  }

  closeRefuseModal(): void {
    this.refuseTarget.set(null);
  }

  submitRefuse(reason: string): void {
    const target = this.refuseTarget();
    if (!target || !reason) return;
    this.refuseSubmitting.set(true);
    this.refuseError.set(null);
    this.offerService.rejectOffer(target.id, reason).subscribe({
      next: () => {
        this.refuseSubmitting.set(false);
        this.refuseTarget.set(null);
        this.notice.set(this.translate.instant('PIPELINE.NOTICE.REFUSED', { name: target.fullName }));
        this.reload();
      },
      error: err => {
        this.refuseSubmitting.set(false);
        this.refuseError.set(err?.error?.detail ?? this.translate.instant('PIPELINE.ERRORS.REFUSE'));
      },
    });
  }
}
