import { Component, ElementRef, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import {
  BadgeCell,
  ButtonComponent,
  CardComponent,
  DafCellDirective,
  DataTableComponent,
  FormFieldComponent,
  FormFieldOptions,
  MetricCardComponent,
  MetricCardOptions,
  MultiDatePickerComponent,
  StatusBadgeComponent,
  TableColumn,
  TableConfig,
  TableRow,
} from '@khalilrebhiitec/daf360';
import { ModalComponent } from '../../shared/modal.component';
import { RhSearchBarComponent } from '../../shared/search-bar.component';
import { isoToDate, dateToIso } from '../../shared/date-picker.utils';
import {
  PipelineService,
  KanbanColumn,
  KanbanCandidate,
  PipelineStats,
} from './services/pipeline.service';
import { OfferService, CreateOfferRequest } from './services/offer.service';
import { getAvatarUrl } from '../../shared/utils/avatar.utils';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary' | 'neutral' | 'teal';

const BADGE_VARIANT: Record<string, BadgeVariant> = {
  urgent:      'danger',
  new:         'info',
  in_progress: 'teal',
  offer:       'warning',
  hired:       'success',
  rejected:    'neutral',
  top:         'success',
};

/** The four columns of the design board, in order. REJETE is intentionally omitted. */
const BOARD_STAGES: Array<{ key: string; labelKey: string; accent: string; badgeBg: string }> = [
  { key: 'SCREENING', labelKey: 'PIPELINE.STAGE.SCREENING', accent: '#3755c3', badgeBg: 'rgba(55,85,195,0.12)'  },
  { key: 'ENTRETIEN', labelKey: 'PIPELINE.STAGE.ENTRETIEN', accent: '#79D7BE', badgeBg: 'rgba(121,215,190,0.18)' },
  { key: 'OFFRE',     labelKey: 'PIPELINE.STAGE.OFFRE',      accent: '#F59E0B', badgeBg: 'rgba(245,158,11,0.14)' },
  { key: 'RECRUTE',   labelKey: 'PIPELINE.STAGE.RECRUTE',    accent: '#10B981', badgeBg: 'rgba(16,185,129,0.14)' },
];

interface BoardColumn {
  key: string;
  label: string;
  accent: string;
  badgeBg: string;
  count: number;
  candidates: KanbanCandidate[];
}

/**
 * Candidates landing page — the design Kanban board (Screening / Entretien /
 * Offre / Recruté), fed by /api/hr/pipeline/kanban. Cards render per-stage data
 * and the Offre stage drives the offer/negotiation actions.
 */
@Component({
  selector: 'rh-pipeline',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, CardComponent, DafCellDirective, DataTableComponent, FormFieldComponent, MetricCardComponent, MultiDatePickerComponent, RhSearchBarComponent, StatusBadgeComponent, TranslatePipe],
  templateUrl: './pipeline.component.html',
})
export class PipelineComponent implements OnInit {
  private pipelineService = inject(PipelineService);
  private offerService    = inject(OfferService);
  private router          = inject(Router);
  private translate       = inject(TranslateService);

  readonly kanbanColumns = signal<KanbanColumn[]>([]);
  readonly stats         = signal<PipelineStats | null>(null);
  readonly loading       = signal(true);
  readonly avatarFailed  = signal(new Set<number>());
  readonly notice        = signal<string | null>(null);
  readonly search        = signal('');
  readonly mobileSearchOpen = signal(false);
  readonly viewMode      = signal<'kanban' | 'list'>('kanban');

  /** The four design columns, populated from the pipeline kanban response. */
  readonly boardColumns = computed<BoardColumn[]>(() => {
    this.translate.currentLang();
    const cols = this.kanbanColumns();
    const term = this.search().trim().toLowerCase();

    // Free-text match over the fields shown on a card.
    const matches = (c: KanbanCandidate) =>
      !term ||
      [c.fullName, c.poste, c.email, c.location, ...(c.skills ?? [])]
        .some(v => (v ?? '').toString().toLowerCase().includes(term));

    const stageOf = (key: string) =>
      (cols.find(c => (c.stage ?? '').toUpperCase() === key)?.candidates ?? []).filter(matches);

    // Entretien is interview-driven: it holds every interview-phase candidate
    // (ACCEPTED/HR) PLUS any still-pending candidate who already has a planned
    // interview waiting. Those pending-with-interview cards leave Préqualification.
    const screening      = stageOf('SCREENING');
    const entretienStage = stageOf('ENTRETIEN');
    const prequalification = screening.filter(c => !c.nextEvent);
    const entretien        = [...entretienStage, ...screening.filter(c => !!c.nextEvent)];

    return BOARD_STAGES.map(s => {
      const candidates =
        s.key === 'SCREENING' ? prequalification :
        s.key === 'ENTRETIEN' ? entretien :
        stageOf(s.key);
      const { labelKey, ...rest } = s;
      return { ...rest, label: this.translate.instant(labelKey), count: candidates.length, candidates };
    });
  });

  // ── Horizontal board navigation minimap (bottom-right) ──────────────────────
  private readonly kanbanBoard = viewChild<ElementRef<HTMLDivElement>>('kanbanBoard');
  readonly boardScroll = signal({ left: 0, client: 0, scroll: 0 });

  readonly boardHasOverflow = computed(() => {
    const b = this.boardScroll();
    return b.scroll > b.client + 4;
  });

  readonly viewportStyle = computed(() => {
    const b = this.boardScroll();
    if (b.scroll <= 0) return { left: '0%', width: '100%' };
    return {
      left:  Math.max(0, (b.left / b.scroll) * 100) + '%',
      width: Math.min(100, (b.client / b.scroll) * 100) + '%',
    };
  });

  // ── Offer modal state ───────────────────────────────────────────────────
  readonly offerTarget     = signal<KanbanCandidate | null>(null);
  readonly offerMode       = signal<'send' | 'renegotiate'>('send');
  readonly offerSubmitting = signal(false);
  readonly offerError      = signal<string | null>(null);
  offerForm: CreateOfferRequest = {};

  // ── Reject-offer modal state ─────────────────────────────────────────────
  readonly rejectTarget    = signal<KanbanCandidate | null>(null);
  readonly rejectSubmitting = signal(false);
  rejectReason = '';

  readonly actioningId = signal<number | null>(null);

  // ── Lib form-field option presets ────────────────────────────────────────
  readonly salaryFieldOpts:  FormFieldOptions = { type: 'number', placeholder: '0', fullWidth: true };
  readonly noteFieldOpts:    FormFieldOptions = { type: 'text',   placeholder: this.translate.instant('PIPELINE.OFFER.NOTE_PLACEHOLDER'), fullWidth: true };
  readonly reasonFieldOpts:  FormFieldOptions = { type: 'textarea', placeholder: this.translate.instant('PIPELINE.OFFER.REASON_PLACEHOLDER'), rows: 3, fullWidth: true };

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      kanban: this.pipelineService.getKanban(),
      stats:  this.pipelineService.getStats(),
    }).subscribe({
      next: ({ kanban, stats }) => {
        this.kanbanColumns.set(kanban);
        this.stats.set(stats);
        this.loading.set(false);
        setTimeout(() => this.syncBoardMetrics()); // board now in DOM
      },
      error: () => this.loading.set(false),
    });
  }

  onNewCandidate(): void {
    this.router.navigate(['/rh/candidates', 'new']);
  }

  onCandidateClick(id: number): void {
    this.router.navigate(['/rh/candidates', id]);
  }

  onSearch(value: string): void {
    this.search.set(value ?? '');
  }

  setView(mode: 'kanban' | 'list'): void {
    this.viewMode.set(mode);
    if (mode === 'kanban') setTimeout(() => this.syncBoardMetrics());
  }

  // ── List view (flattens the filtered board into a table) ────────────────────
  readonly listColumns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'candidat', label: this.translate.instant('PIPELINE.COL_CANDIDATE'), type: 'avatar' },
      { key: 'poste',    label: this.translate.instant('PIPELINE.COL_POSITION') },
      { key: 'stage',    label: this.translate.instant('PIPELINE.COL_STAGE'), type: 'badge' },
      { key: 'fit',      label: this.translate.instant('PIPELINE.COL_FIT'), align: 'right' },
      { key: '_actions', label: '', align: 'right', clickable: true },
    ];
  });
  readonly listConfig: TableConfig = { hoverable: true };
  readonly listRows = computed<TableRow[]>(() =>
    this.boardColumns().flatMap(col => col.candidates).map(c => ({
      candidat: { name: c.fullName, initials: c.initials ?? this.initials(c.fullName), avatar: this.resolveAvatar(c), subtitle: c.poste },
      poste:    c.poste ?? '—',
      stage:    { label: c.stageLabel ?? c.stage, options: { variant: this.stageVariant(c.stage), size: 'sm' } } as BadgeCell,
      fit:      (c.fitScore ?? 0) + '%',
      _source:  c,
    })),
  );

  private stageVariant(stage: string | undefined): BadgeVariant {
    const s = (stage ?? '').toUpperCase();
    if (s === 'RECRUTE')   return 'success';
    if (s === 'OFFRE')     return 'warning';
    if (s === 'ENTRETIEN') return 'teal';
    return 'info';
  }

  // ── Board scroll / minimap ───────────────────────────────────────────────
  onBoardScroll(): void { this.syncBoardMetrics(); }

  @HostListener('window:resize')
  syncBoardMetrics(): void {
    const el = this.kanbanBoard()?.nativeElement;
    if (!el) return;
    this.boardScroll.set({ left: el.scrollLeft, client: el.clientWidth, scroll: el.scrollWidth });
  }

  scrollToColumn(index: number): void {
    const el = this.kanbanBoard()?.nativeElement;
    if (!el) return;
    el.scrollTo({ left: index * 384, behavior: 'smooth' }); // 360px column + 24px gap
  }

  isOfferPending(c: KanbanCandidate): boolean {
    return c.status === 'OFFER_SENT' || (c.offerStatus ?? '') === 'SENT';
  }

  canSendOffer(c: KanbanCandidate): boolean {
    return c.status === 'ACCEPTED';
  }

  // ── Offer actions ─────────────────────────────────────────────────────────
  openOfferModal(c: KanbanCandidate, mode: 'send' | 'renegotiate', event: Event): void {
    event.stopPropagation();
    this.offerError.set(null);
    this.offerMode.set(mode);
    this.offerForm = { askedSalary: null, proposedSalary: null, salaryNote: null, expectedHireDate: null, expiryDate: null };
    this.offerTarget.set(c);
    // Renegotiation: prefill the form with the current offer's values.
    if (mode === 'renegotiate') {
      this.offerService.getOffer(c.id).subscribe({
        next: o => {
          this.offerForm = {
            askedSalary: o.askedSalary, proposedSalary: o.proposedSalary, salaryNote: o.salaryNote,
            expectedHireDate: o.expectedHireDate, expiryDate: o.expiryDate,
          };
        },
        error: () => { /* keep blank form if the offer can't be loaded */ },
      });
    }
  }

  closeOfferModal(): void {
    this.offerTarget.set(null);
  }

  submitOffer(): void {
    const target = this.offerTarget();
    if (!target) return;
    this.offerSubmitting.set(true);
    this.offerError.set(null);
    const renegotiate = this.offerMode() === 'renegotiate';
    const call = renegotiate
      ? this.offerService.renegotiateOffer(target.id, this.offerForm)
      : this.offerService.sendOffer(target.id, this.offerForm);
    call.subscribe({
      next: () => {
        this.offerSubmitting.set(false);
        this.offerTarget.set(null);
        this.notice.set(this.translate.instant(renegotiate ? 'PIPELINE.NOTICE.RENEGOTIATED' : 'PIPELINE.NOTICE.SENT', { name: target.fullName }));
        this.load();
      },
      error: err => {
        this.offerSubmitting.set(false);
        this.offerError.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('PIPELINE.ERRORS.SEND'));
      },
    });
  }

  acceptOffer(c: KanbanCandidate, event: Event): void {
    event.stopPropagation();
    this.actioningId.set(c.id);
    this.notice.set(null);
    this.offerService.acceptOffer(c.id).subscribe({
      next: () => { this.actioningId.set(null); this.notice.set(this.translate.instant('PIPELINE.NOTICE.ACCEPTED', { name: c.fullName })); this.load(); },
      error: err => { this.actioningId.set(null); this.notice.set(err?.error?.detail ?? this.translate.instant('PIPELINE.ERRORS.ACCEPT')); },
    });
  }

  openRejectModal(c: KanbanCandidate, event: Event): void {
    event.stopPropagation();
    this.offerError.set(null);
    this.rejectReason = '';
    this.rejectTarget.set(c);
  }

  closeRejectModal(): void {
    this.rejectTarget.set(null);
  }

  submitReject(): void {
    const target = this.rejectTarget();
    if (!target || !this.rejectReason.trim()) return;
    this.rejectSubmitting.set(true);
    this.offerService.rejectOffer(target.id, this.rejectReason.trim()).subscribe({
      next: () => { this.rejectSubmitting.set(false); this.rejectTarget.set(null); this.notice.set(this.translate.instant('PIPELINE.NOTICE.REFUSED', { name: target.fullName })); this.load(); },
      error: err => { this.rejectSubmitting.set(false); this.offerError.set(err?.error?.detail ?? this.translate.instant('PIPELINE.ERRORS.REFUSE')); },
    });
  }

  // ── Form-field value handlers (daf-form-field emits valueChange) ─────────
  private asNum(v: string | number | null): number | null {
    if (v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return isNaN(n) ? null : n;
  }
  private asStr(v: string | number | null): string | null {
    return v === null || v === '' ? null : String(v);
  }
  onAskedChange(v: string | number | null):    void { this.offerForm.askedSalary = this.asNum(v); }
  onProposedChange(v: string | number | null): void { this.offerForm.proposedSalary = this.asNum(v); }
  onNoteChange(v: string | number | null):     void { this.offerForm.salaryNote = this.asStr(v); }
  onReasonChange(v: string | number | null):   void { this.rejectReason = typeof v === 'string' ? v : ''; }

  // Date fields use the lib multi-date-picker (single mode) ↔ ISO strings.
  getHireDate(): Date | null { return isoToDate(this.offerForm.expectedHireDate ?? null); }
  setHireDate(v: Date | Date[] | null): void { this.offerForm.expectedHireDate = dateToIso(v) || null; }
  getExpiryDate(): Date | null { return isoToDate(this.offerForm.expiryDate ?? null); }
  setExpiryDate(v: Date | Date[] | null): void { this.offerForm.expiryDate = dateToIso(v) || null; }

  // ── Display helpers ─────────────────────────────────────────────────────
  fitScoreClass(score: number): string {
    if (score >= 85) return 'text-[#79D7BE] font-bold text-sm';
    if (score >= 65) return 'text-primary font-bold text-sm';
    return 'text-outline font-bold text-sm';
  }

  badgeVariant(badgeType: string): BadgeVariant {
    return BADGE_VARIANT[badgeType] ?? 'neutral';
  }

  resolveAvatar(candidate: KanbanCandidate): string {
    return getAvatarUrl(candidate.id, candidate.photoUrl, candidate.gender);
  }

  onAvatarError(id: number): void {
    this.avatarFailed.update(s => new Set(s).add(id));
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
  }

  // ── KPI tiles (same daf-metric-card design as the Pipeline RH page) ─────────
  readonly kpiTotal  = computed(() => this.stats()?.totalCandidats ?? 0);
  readonly kpiDelay  = computed(() => this.stats()?.delaiMoyenJours ?? null);
  readonly kpiUrgent = computed(() => this.stats()?.urgents ?? 0);

  readonly totalMetricOpts:  MetricCardOptions = { icon: 'group',         iconColor: 'text-primary', iconBg: 'bg-primary/10' };
  readonly delayMetricOpts:  MetricCardOptions = { icon: 'timer',         iconColor: 'text-teal',    iconBg: 'bg-surface-container-low' };
  readonly urgentMetricOpts: MetricCardOptions = { icon: 'priority_high', iconColor: 'text-danger',  iconBg: 'bg-danger/10' };

  readonly totalMetricValue  = computed(() => this.kpiTotal().toLocaleString('fr-FR'));
  readonly delayMetricValue  = computed(() => {
    this.translate.currentLang();
    return this.kpiDelay() != null ? this.translate.instant('PIPELINE.DAYS', { count: this.kpiDelay() }) : '—';
  });
  readonly urgentMetricValue = computed(() => {
    this.translate.currentLang();
    return this.translate.instant('PIPELINE.URGENT_OPEN', { count: this.kpiUrgent() });
  });
}
