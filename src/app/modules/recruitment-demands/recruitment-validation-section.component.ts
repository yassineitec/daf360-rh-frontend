import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  AvatarComponent, ButtonComponent, CardComponent, PaginationComponent,
  FormFieldComponent, StatusBadgeComponent, SearchToolbarComponent,
  type FilterField, type FilterResult, type SearchToolbarFilterConfig,
} from '@khalilrebhiitec/daf360';

import { ModalComponent } from '../../shared/modal.component';
import { NotificationService } from '../../core/notification.service';
import { UserStore } from '../../core/user.store';
import { RecruitmentDemandService } from './recruitment-demand.service';
import { RecruitmentDemandSummary, RecruitmentDemandStatus } from './recruitment-demand.model';

/** The permission that owns this queue — the same code the review endpoint enforces. */
export const RECRUITMENT_APPROVE_PERMISSION = 'RH_APPROVE_RECRUITMENT_DEMAND';

/** Same traffic-light mapping used on /rh/recruitment-demands. */
const STATUS_VARIANT: Record<RecruitmentDemandStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  EN_ATTENTE: 'warning',
  APPROUVEE:  'success',
  REJETEE:    'danger',
  ANNULEE:    'neutral',
  CLOTUREE:   'info',
};

/** Card-ready view model — same shape as the Historique page's own "Recrutement" cards. */
interface DemandCard {
  id: number;
  poste: string;
  subtitle: string;
  status: { label: string; options: { variant: 'success' | 'warning' | 'danger' | 'neutral' | 'info' } };
  urgencyLabel: string | null;
  submittedAt: string;
  source: RecruitmentDemandSummary;
}

/**
 * Recruitment validation queue — a section of the RH Demandes page.
 *
 * Only rendered for holders of RH_APPROVE_RECRUITMENT_DEMAND (V31 grants it to Directeur /
 * DRH / Administrateur), which is the same code `POST /recruitment-demands/{id}/review`
 * enforces — so nothing here is ever a dead end for whoever can see it.
 *
 * Managers raise these from the shell's self-service catalogue; approving one is what lets a
 * candidate be attached to it in the recruitment pipeline. The parent page's own tabs cover
 * `employee_requests`, an unrelated table — hence a section of its own rather than a third
 * tab, which would have implied the two share a workflow.
 *
 * Only EN_ATTENTE demands ever show here — the "en cours" queue that still needs a decision.
 * One a manager has decided (approuvée/rejetée/annulée/clôturée), it moves to the
 * /rh/recruitment-demands historique instead, same split as the "Demande" tab next to it.
 */
@Component({
  selector: 'app-recruitment-validation-section',
  standalone: true,
  imports: [
    AvatarComponent, ButtonComponent, CardComponent, PaginationComponent,
    FormFieldComponent, StatusBadgeComponent, SearchToolbarComponent, ModalComponent,
    DatePipe, TranslatePipe,
  ],
  template: `
    <!-- flex-col + gap-8: same 32px rhythm as daf-page's own — this section sits inside the
         Demandes page's daf-page but isn't a direct child of it, so it needs its own gap
         between the header, KPI row, search toolbar and card list. -->
    <div class="flex flex-col gap-8">

    <!-- ── Section header — title only. -->
    <div class="flex items-center gap-2.5">
      <span class="material-symbols-outlined text-tertiary">how_to_reg</span>
      <h2 class="text-[18px] font-bold text-on-surface">
        {{ 'RECRUITMENT_VALIDATION.TITLE' | translate }}
      </h2>
    </div>

    @if (error()) {
      <p class="m-0 mt-2 text-[12px] text-danger">{{ error() }}</p>
    }

    <!-- No KPI row here: the parent Demandes page renders one shared KPI row above both
         tabs (reading total() / demandKpis() off this component via viewChild) so the
         cards stay mounted across a tab switch and only their values change. -->

    <!-- No status filter: every card here is already EN_ATTENTE by construction. The
         "Filtres" panel narrows by the same two signals as the KPI row instead — sourcing
         progress and age. -->
    <daf-search-toolbar
      [placeholder]="'RECRUITMENT_VALIDATION.SEARCH_PLACEHOLDER' | translate"
      [(value)]="searchQuery"
      [debounce]="200"
      [filterFields]="filterFields()"
      [filterConfig]="filterConfig()"
      (filterApply)="onFilterApply($event)" />

    <!-- Same daf-card recipe as the Historique page's "Recrutement" tab — icon box, title/
         subtitle, status + urgency badges, date, actions. One design for a recruitment
         demand everywhere it appears. -->
    @if (demandCards().length === 0 && !loading()) {
      <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
        <div class="flex flex-col items-center gap-2 py-8 text-center">
          <span class="material-symbols-outlined text-[36px] text-outline-variant">task_alt</span>
          <p class="m-0 text-[14px] font-semibold text-on-surface">
            {{ 'RECRUITMENT_VALIDATION.EMPTY' | translate }}
          </p>
        </div>
      </daf-card>
    } @else {
      <div class="flex flex-col gap-3">
        @for (card of demandCards(); track card.id) {
          <daf-card class="block" [options]="{ variant: 'glass', padding: 'md', radius: 'xl', hoverable: true }">
            <div class="flex flex-wrap items-center gap-4">
              <!-- Same daf-avatar rendering as the "Demande" card lists — no photo for a
                   recruitment demand, so it falls back to initials derived from the poste. -->
              <daf-avatar [data]="{ name: card.poste }" size="md" badgeBg="bg-teal" />

              <div class="min-w-[180px] flex-1">
                <p class="m-0 text-[15px] font-semibold text-on-surface">{{ card.poste }}</p>
                <div class="mt-1 flex items-center gap-1.5 text-[13px] text-on-surface-variant">
                  <span class="material-symbols-outlined text-[16px] text-teal">description</span>
                  <span>{{ card.subtitle }}</span>
                </div>
              </div>

              <div class="flex flex-col items-start gap-1.5 sm:items-end">
                <daf-badge [label]="card.status.label" [options]="card.status.options" />
                @if (card.urgencyLabel) {
                  <daf-badge [label]="card.urgencyLabel" [options]="{ variant: 'warning', pill: true, size: 'sm' }" />
                }
              </div>

              <div class="text-[12px] text-outline sm:w-32 sm:text-right">
                {{ card.submittedAt | date:'dd/MM/yyyy' }}
              </div>

              <div class="flex items-center gap-2">
                <!-- Real daf-button icon buttons, same convention as /rh/admin's own
                     edit/delete action icons. Approve/Reject always show — every card
                     here is EN_ATTENTE. -->
                <daf-button
                  variant="ghost"
                  [title]="'RECRUITMENT_VALIDATION.OPEN' | translate"
                  [options]="{ iconStart: 'visibility', size: 'sm' }"
                  (onClick)="openDemand(card.id)" />
                <daf-button
                  variant="ghost"
                  [title]="'RECRUITMENT_VALIDATION.APPROVE' | translate"
                  [options]="{ iconStart: 'check_circle', size: 'sm' }"
                  (onClick)="askVerdict(card.source, true)" />
                <daf-button
                  variant="danger"
                  [title]="'RECRUITMENT_VALIDATION.REJECT' | translate"
                  [options]="{ iconStart: 'cancel', size: 'sm' }"
                  (onClick)="askVerdict(card.source, false)" />
              </div>
            </div>
          </daf-card>
        }
      </div>
    }

    <!-- Same daf-pagination configuration as /rh/profiles — page-size selector + "1–20 sur
         137" summary, always shown, same as the other three sections on these two pages. -->
    <daf-pagination
      [currentPage]="page()"
      [totalPages]="totalPages()"
      [totalElements]="total()"
      [pageSize]="pageSize()"
      [pageSizeOptions]="pageSizeOptions"
      [perPageLabel]="'PROFILES.LIST.PER_PAGE' | translate"
      [summaryLabel]="'PROFILES.LIST.RANGE_SUMMARY' | translate"
      (pageChange)="changePage($event)"
      (pageSizeChange)="onPageSizeChange($event)" />

    </div>

    <!-- ── Verdict modal ──────────────────────────────────────────────── -->
    <app-modal
      [title]="(approving() ? 'RECRUITMENT_VALIDATION.APPROVE_TITLE' : 'RECRUITMENT_VALIDATION.REJECT_TITLE') | translate"
      [visible]="target() !== null"
      [hasFooter]="true"
      (closed)="closeVerdict()">
      @if (target(); as d) {
        <p class="mb-3 text-[13px] text-on-surface">
          <strong>{{ d.jobTitle }}</strong>
          @if (d.headcount > 1) {
            · {{ 'RECRUITMENT_VALIDATION.POSITIONS' | translate: { n: d.headcount } }}
          }
        </p>
        <daf-form-field
          [options]="{
            label: ((approving() ? 'RECRUITMENT_VALIDATION.COMMENT_OPTIONAL' : 'RECRUITMENT_VALIDATION.COMMENT_REQUIRED') | translate),
            type: 'textarea', rows: 3, fullWidth: true,
            required: !approving(),
            error: commentError()
          }"
          [value]="comment"
          (valueChange)="comment = asText($event); commentError.set('')" />
      }
      <div slot="footer">
        <daf-button [options]="{ variant: 'secondary', label: ('RECRUITMENT_VALIDATION.CANCEL' | translate) }"
                    (onClick)="closeVerdict()" />
        <daf-button
          [options]="{
            variant: approving() ? 'teal' : 'danger',
            label: submitting()
              ? ('RECRUITMENT_VALIDATION.SAVING' | translate)
              : ((approving() ? 'RECRUITMENT_VALIDATION.APPROVE' : 'RECRUITMENT_VALIDATION.REJECT') | translate),
            disabled: submitting(), loading: submitting()
          }"
          (onClick)="submitVerdict()" />
      </div>
    </app-modal>
  `,
})
export class RecruitmentValidationSectionComponent implements OnInit {
  private svc          = inject(RecruitmentDemandService);
  private userStore    = inject(UserStore);
  private router       = inject(Router);
  private translate    = inject(TranslateService);
  private notification = inject(NotificationService);

  readonly demands = signal<RecruitmentDemandSummary[]>([]);
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);

  readonly page       = signal(0);
  readonly totalPages = signal(0);
  readonly total      = signal(0);
  readonly pageSize   = signal(100);
  readonly pageSizeOptions = [20, 50, 100];

  readonly searchQuery   = signal('');
  /** The two filter dimensions that match the KPI row — status has nothing left to
   *  break down since every card here is already EN_ATTENTE. */
  readonly candidateFilter = signal<'all' | 'none' | 'some'>('all');
  readonly ageFilter       = signal<'all' | 'old'>('all');

  readonly statusVariant = (s: RecruitmentDemandStatus) => STATUS_VARIANT[s];

  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('RECRUITMENT_VALIDATION.FILTERS.' + k);
    return [
      {
        name: 'candidates',
        label: t('CANDIDATES_LABEL'),
        type: 'select',
        options: [
          { value: 'all',  label: t('CANDIDATES_ALL') },
          { value: 'none', label: this.translate.instant('RECRUITMENT_VALIDATION.KPI_NO_CANDIDATES') },
          { value: 'some', label: t('CANDIDATES_SOME') },
        ],
      },
      {
        name: 'age',
        label: t('AGE_LABEL'),
        type: 'select',
        options: [
          { value: 'all', label: t('AGE_ALL') },
          { value: 'old', label: this.translate.instant('RECRUITMENT_VALIDATION.KPI_OLD') },
        ],
      },
    ];
  });

  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('RECRUITMENT_VALIDATION.FILTERS.' + k);
    return {
      title:        t('TITLE'),
      triggerLabel: t('TRIGGER'),
      applyLabel:   t('APPLY'),
      cancelLabel:  t('CANCEL'),
      resetLabel:   t('RESET'),
      align:        'right',
      initialValues: { candidates: [this.candidateFilter()], age: [this.ageFilter()] },
    };
  });

  onFilterApply(result: FilterResult): void {
    const candidates = result['candidates'];
    if (candidates === 'all' || candidates === 'none' || candidates === 'some') {
      this.candidateFilter.set(candidates);
    }
    const age = result['age'];
    if (age === 'all' || age === 'old') {
      this.ageFilter.set(age);
    }
  }

  readonly target     = signal<RecruitmentDemandSummary | null>(null);
  readonly approving  = signal(true);
  readonly submitting = signal(false);
  comment = '';
  readonly commentError = signal('');

  /** Candidate/age filters, then the search — the fetch itself is already scoped to
   *  EN_ATTENTE (see `load`), so status never needs a pass here. */
  readonly visibleDemands = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const candidates = this.candidateFilter();
    const age = this.ageFilter();
    const now = Date.now();
    return this.demands().filter(d => {
      if (candidates === 'none' && (d.candidateCount || 0) !== 0) return false;
      if (candidates === 'some' && (d.candidateCount || 0) === 0) return false;
      if (age === 'old' && !((now - new Date(d.submittedAt).getTime()) / 86400000 > 7)) return false;
      if (!q) return true;
      return (d.jobExactTitle ?? d.jobTitle).toLowerCase().includes(q)
        || (d.department ?? '').toLowerCase().includes(q);
    });
  });

  /**
   * Counted from the fetched batch (like the Historique page's own KPI tiles), not the
   * search-narrowed `visibleDemands` — the row describes the whole pending queue.
   * "Sans candidat" and "> 7 jours" stand in for a status/SLA breakdown: every demand here
   * is already EN_ATTENTE, so those don't apply, but sourcing progress and age do say
   * which ones need attention first.
   */
  readonly demandKpis = computed(() => {
    const items = this.demands();
    const now = Date.now();
    return {
      headcount:    items.reduce((sum, d) => sum + (d.headcount || 0), 0),
      noCandidates: items.filter(d => (d.candidateCount || 0) === 0).length,
      old:          items.filter(d => (now - new Date(d.submittedAt).getTime()) / 86400000 > 7).length,
    };
  });

  readonly demandCards = computed<DemandCard[]>(() => {
    this.translate.currentLang();
    return this.visibleDemands().map(d => ({
      id: d.id,
      poste: d.jobTitle,
      subtitle: [d.department, d.recruitmentReasonLabel].filter(Boolean).join(' • ') || '—',
      status: {
        label: this.translate.instant('RECRUITMENT_DEMANDS.STATUS.' + d.statut),
        options: { variant: this.statusVariant(d.statut) },
      },
      urgencyLabel: d.urgencyLevelLabel ?? null,
      submittedAt: d.submittedAt,
      source: d,
    }));
  });

  ngOnInit(): void {
    this.load();
  }

  /** Public so the parent Demandes page can refresh this queue after creating a new
   *  recruitment demand from its own "Nouvelle demande" button. */
  load(): void {
    const paysId = this.userStore.currentUser()?.paysId;
    if (!paysId) {
      // Admins and show-all roles have no pays of their own; without one the endpoint has
      // nothing to scope to, so say so rather than render a permanently empty queue.
      this.loading.set(false);
      this.error.set(this.translate.instant('RECRUITMENT_VALIDATION.ERR_NO_PAYS'));
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    // Filtered server-side to EN_ATTENTE — the backend takes one exact status, and that's
    // exactly what this queue needs, so page/total/totalPages are all real counts here,
    // unlike the client-side approximation the multi-status "Demande" tabs fall back to.
    this.svc.listByPays(paysId, 'EN_ATTENTE', this.page(), this.pageSize())
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        this.loading.set(false);
        if (!res) {
          this.error.set(this.translate.instant('RECRUITMENT_VALIDATION.ERR_LOAD'));
          return;
        }
        this.demands.set(res.content ?? []);
        this.total.set(res.totalElements);
        this.totalPages.set(res.totalPages);
      });
  }

  changePage(p: number): void {
    this.page.set(p);
    this.load();
  }

  /** `pageSizeChange` fires alone — go back to page 0 with the new size (same as /rh/profiles). */
  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(0);
    this.load();
  }

  askVerdict(d: RecruitmentDemandSummary, approve: boolean): void {
    this.approving.set(approve);
    this.target.set(d);
    this.comment = '';
    this.commentError.set('');
  }

  closeVerdict(): void {
    this.target.set(null);
    this.comment = '';
    this.commentError.set('');
  }

  submitVerdict(): void {
    const d = this.target();
    if (!d || this.submitting()) return;

    // A rejection without a reason leaves the manager with no idea what to change, so the
    // comment is required there and optional on approval.
    if (!this.approving() && !this.comment.trim()) {
      this.commentError.set(this.translate.instant('RECRUITMENT_VALIDATION.ERR_COMMENT_REQUIRED'));
      return;
    }

    this.submitting.set(true);
    this.svc.review(d.id, {
      approved: this.approving(),
      comment: this.comment.trim() || undefined,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        // Removed rather than updated in place: a decided demand no longer belongs to this
        // "en cours" queue — it moves to the /rh/recruitment-demands historique instead.
        this.demands.update(list => list.filter(x => x.id !== d.id));
        this.total.update(n => Math.max(0, n - 1));
        this.notification.success(
          this.translate.instant(this.approving()
            ? 'RECRUITMENT_VALIDATION.APPROVE_SUCCESS'
            : 'RECRUITMENT_VALIDATION.REJECT_SUCCESS'),
          this.translate.instant('RECRUITMENT_VALIDATION.SUCCESS_TITLE'));
        this.closeVerdict();
      },
      error: (err) => {
        this.submitting.set(false);
        this.commentError.set(err?.error?.detail ?? err?.error?.message
          ?? this.translate.instant('RECRUITMENT_VALIDATION.ERR_REVIEW'));
      },
    });
  }

  openDemand(id: number): void {
    this.router.navigate(['/rh/recruitment-demands', id]);
  }

  asText(v: string | number | null): string {
    return v == null ? '' : String(v);
  }
}
