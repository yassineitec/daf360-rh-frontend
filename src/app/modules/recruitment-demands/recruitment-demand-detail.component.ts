import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import {
  BreadcrumbItem,
  ButtonComponent,
  CardAccent,
  CardComponent,
  FormFieldComponent,
  PageComponent,
  PageHeaderBadge,
  PageHeaderComponent,
  StatusBadgeComponent,
} from '@khalilrebhiitec/daf360';

import { UserStore } from '../../core/user.store';
import { RecruitmentDemandService } from './recruitment-demand.service';
import { RecruitmentDemandDetail, RecruitmentDemandStatus } from './recruitment-demand.model';

/** Same traffic-light mapping used on /rh/recruitment-demands and its validation queue. */
const STATUS_VARIANT: Record<RecruitmentDemandStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  EN_ATTENTE: 'warning',
  APPROUVEE:  'success',
  REJETEE:    'danger',
  ANNULEE:    'neutral',
  CLOTUREE:   'info',
};

/** `daf-card`'s left accent stripe has no 'neutral'/'info' step — 'secondary'/'teal'
 *  are the closest tones already used for those meanings elsewhere on this page family. */
const STATUS_ACCENT: Record<RecruitmentDemandStatus, CardAccent> = {
  EN_ATTENTE: 'warning',
  APPROUVEE:  'success',
  REJETEE:    'danger',
  ANNULEE:    'secondary',
  CLOTUREE:   'teal',
};

/** Same icon language as the status KPI tiles on /rh/recruitment-demands, reused here for
 *  the "Décision" card so a reviewed demand reads the same way everywhere it appears. */
const STATUS_ICON: Record<RecruitmentDemandStatus, string> = {
  EN_ATTENTE: 'hourglass_empty',
  APPROUVEE:  'check_circle',
  REJETEE:    'cancel',
  ANNULEE:    'block',
  CLOTUREE:   'task_alt',
};

/** Whole literal class strings, never `` `text-${variant}` `` — a runtime-built class
 *  never appears as a literal in source, so Tailwind's scan never generates it and the
 *  icon renders uncoloured. Same icon-colour choices as STATUS_KPI on the historique page. */
const STATUS_ICON_COLOR: Record<RecruitmentDemandStatus, string> = {
  EN_ATTENTE: 'text-warning',
  APPROUVEE:  'text-success',
  REJETEE:    'text-danger',
  ANNULEE:    'text-outline',
  CLOTUREE:   'text-teal',
};

interface DetailField {
  key: string;
  label: string;
  value: string;
  icon: string;
  iconColor: string;
  iconBg: string;
}

/** One icon + tone per field, so the KPI-style cards read as illustrated tiles rather
 *  than a plain label/value list. */
const FIELD_ICON: Record<string, { icon: string; iconColor: string; iconBg: string }> = {
  EXACT_TITLE:        { icon: 'work',          iconColor: 'text-primary',   iconBg: 'bg-primary/10' },
  RECRUITMENT_REASON: { icon: 'swap_horiz',    iconColor: 'text-teal',      iconBg: 'bg-teal/10' },
  HEADCOUNT:          { icon: 'groups',        iconColor: 'text-secondary', iconBg: 'bg-secondary/10' },
  URGENCY:            { icon: 'priority_high', iconColor: 'text-warning',   iconBg: 'bg-warning/10' },
  CSP:                { icon: 'category',      iconColor: 'text-teal',      iconBg: 'bg-teal/10' },
  EXPERIENCE:         { icon: 'trending_up',   iconColor: 'text-primary',   iconBg: 'bg-primary/10' },
  EDUCATION:          { icon: 'school',        iconColor: 'text-secondary', iconBg: 'bg-secondary/10' },
  TARGET_START:       { icon: 'event',         iconColor: 'text-warning',   iconBg: 'bg-warning/10' },
  BUDGET:             { icon: 'payments',      iconColor: 'text-success',   iconBg: 'bg-success/10' },
  LINKED_CANDIDATES:  { icon: 'group_add',     iconColor: 'text-primary',   iconBg: 'bg-primary/10' },
};

@Component({
  selector: 'app-recruitment-demand-detail',
  standalone: true,
  imports: [
    ButtonComponent, CardComponent, FormFieldComponent, PageComponent, PageHeaderComponent,
    StatusBadgeComponent, DatePipe, TranslatePipe,
  ],
  template: `
    <!-- Same daf-page/daf-page-header scaffold as the other detail pages (candidates,
         profiles): breadcrumbs carry the "back to list" affordance, badges show status
         on the title line — no hand-rolled header markup. -->
    <daf-page [loading]="loading()" [kpis]="0" [breadcrumbs]="true">

      <daf-page-header
        [title]="demand()?.jobTitle ?? ('RECRUITMENT_DEMANDS.DETAIL.NOT_FOUND' | translate)"
        [subtitle]="demand()?.department ?? undefined"
        [badges]="headerBadges()"
        [breadcrumbs]="breadcrumbs()"
        [breadcrumbLabel]="'RECRUITMENT_DEMANDS.DETAIL.BREADCRUMB_ARIA' | translate" />

      @if (!demand()) {
        <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
          <div class="flex flex-col items-center gap-3 py-8 text-center">
            <span class="material-symbols-outlined text-[36px] text-outline-variant">search_off</span>
            <p class="m-0 text-[14px] font-semibold text-on-surface">
              {{ 'RECRUITMENT_DEMANDS.DETAIL.NOT_FOUND' | translate }}
            </p>
            <daf-button
              [options]="{ variant: 'ghost', size: 'sm', iconStart: 'arrow_back',
                           label: ('RECRUITMENT_DEMANDS.DETAIL.BACK' | translate) }"
              (onClick)="goBack()" />
          </div>
        </daf-card>
      } @else {
        <!-- Same scaffold as /rh/profiles/:id: a sticky reference card on the left (there,
             identity; here, job details) and everything else flowing in the right column. -->
        <div class="flex flex-col gap-6 lg:flex-row">

          <!-- ── Left: job details, plus the Approve/Reject panel right below it,
               always on screen ── -->
          <div class="lg:w-[32%] lg:shrink-0">
            <div class="flex flex-col gap-6 lg:sticky lg:top-6">
              <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="m-0 mb-4 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  {{ 'RECRUITMENT_DEMANDS.DETAIL.JOB_DETAILS' | translate }}
                </h3>
                <div class="flex flex-col gap-4">
                  @for (f of jobDetailFields(); track f.key) {
                    <div class="flex items-center gap-3">
                      <div [class]="'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ' + f.iconBg + ' ' + f.iconColor">
                        <span class="material-symbols-outlined text-[20px]">{{ f.icon }}</span>
                      </div>
                      <div class="min-w-0">
                        <p class="m-0 truncate text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">{{ f.label }}</p>
                        <p class="m-0 mt-0.5 truncate text-[14px] font-semibold text-on-surface">{{ f.value }}</p>
                      </div>
                    </div>
                  }
                </div>
              </daf-card>

              <!-- Approve / Reject — the one decision this page exists for, right under
                   the job details, so the buttons are large, full-width and
                   solid-coloured rather than sharing a row with anything else. -->
              @if (canApprove() && demand()!.statut === 'EN_ATTENTE') {
                <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                  <h3 class="m-0 mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    <span class="material-symbols-outlined text-[18px] text-warning">gavel</span>
                    {{ 'RECRUITMENT_DEMANDS.DETAIL.PROCESS' | translate }}
                  </h3>
                  <daf-form-field
                    [options]="{ type: 'textarea', rows: 3, fullWidth: true,
                                 label: ('RECRUITMENT_DEMANDS.DETAIL.COMMENT_OPTIONAL' | translate) }"
                    [value]="reviewComment"
                    (valueChange)="reviewComment = asText($event)" />
                  @if (reviewError()) {
                    <p class="m-0 mt-2 text-[12px] text-danger">{{ reviewError() }}</p>
                  }
                  <div class="mt-4 flex flex-col gap-2.5">
                    <daf-button
                      [options]="{ variant: 'teal', size: 'lg', fullWidth: true, iconStart: 'check_circle',
                                   disabled: reviewing(), loading: reviewing(),
                                   label: ('RECRUITMENT_DEMANDS.DETAIL.APPROVE' | translate) }"
                      (onClick)="doReview(true)" />
                    <daf-button
                      [options]="{ variant: 'danger', size: 'lg', fullWidth: true, iconStart: 'cancel',
                                   disabled: reviewing(), loading: reviewing(),
                                   label: ('RECRUITMENT_DEMANDS.DETAIL.REJECT' | translate) }"
                      (onClick)="doReview(false)" />
                  </div>
                </daf-card>
              }

              <!-- Cancel own demand — a distinct, quieter action from Approve/Reject
                   above (a different audience: the requester, not the approver), so it
                   stays ghost rather than competing for attention. -->
              @if (canCancel()) {
                <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                  <daf-button
                    [options]="{ variant: 'ghost', iconStart: 'cancel', disabled: reviewing(), loading: reviewing(), fullWidth: true,
                                 label: ('RECRUITMENT_DEMANDS.DETAIL.CANCEL_DEMAND' | translate) }"
                    (onClick)="doCancel()" />
                </daf-card>
              }
            </div>
          </div>

          <!-- ── Right: one flowing column — decision (if any), then the job's own
               description/profile/scope/skills/notes. ── -->
          <div class="flex min-w-0 flex-1 flex-col gap-6">
            @if (demand()!.reviewedAt) {
              <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl', accent: reviewAccent() }">
                <h3 class="m-0 mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <span class="material-symbols-outlined text-[18px]" [class]="statusIconColor()">{{ statusIcon() }}</span>
                  {{ 'RECRUITMENT_DEMANDS.DETAIL.DECISION' | translate }}
                </h3>
                <daf-badge [label]="('RECRUITMENT_DEMANDS.STATUS.' + demand()!.statut) | translate"
                           [options]="{ variant: statusVariant(demand()!.statut) }" />
                @if (demand()!.reviewComment) {
                  <p class="m-0 mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-on-surface">
                    {{ demand()!.reviewComment }}
                  </p>
                }
                <p class="m-0 mt-3 text-[12px] text-outline">
                  {{ demand()!.reviewedAt | date:'dd/MM/yyyy HH:mm' }}
                </p>
              </daf-card>
            }

            @if (demand()!.needDescription) {
              <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="m-0 mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <span class="material-symbols-outlined text-[18px] text-teal">description</span>
                  {{ 'RECRUITMENT_DEMANDS.DETAIL.NEED_DESC' | translate }}
                </h3>
                <p class="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-on-surface">{{ demand()!.needDescription }}</p>
              </daf-card>
            }

            <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
              <h3 class="m-0 mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                <span class="material-symbols-outlined text-[18px] text-teal">assignment_ind</span>
                {{ 'RECRUITMENT_DEMANDS.DETAIL.REQUIRED_PROFILE' | translate }}
              </h3>
              <p class="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-on-surface">{{ demand()!.requiredProfile }}</p>
            </daf-card>

            <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
              <h3 class="m-0 mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                <span class="material-symbols-outlined text-[18px] text-teal">map</span>
                {{ 'RECRUITMENT_DEMANDS.DETAIL.SCOPE' | translate }}
              </h3>
              <p class="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-on-surface">{{ demand()!.scopeOfWork }}</p>
            </daf-card>

            @if (demand()!.technicalSkills.length) {
              <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="m-0 mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <span class="material-symbols-outlined text-[18px] text-teal">code</span>
                  {{ 'RECRUITMENT_DEMANDS.DETAIL.TECH_SKILLS' | translate }}
                </h3>
                <div class="flex flex-wrap gap-1.5">
                  @for (s of demand()!.technicalSkills; track s) {
                    <daf-badge [label]="s" [options]="{ variant: 'info', pill: true }" />
                  }
                </div>
              </daf-card>
            }

            @if (demand()!.softSkills.length) {
              <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="m-0 mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <span class="material-symbols-outlined text-[18px] text-teal">psychology</span>
                  {{ 'RECRUITMENT_DEMANDS.DETAIL.SOFT_SKILLS' | translate }}
                </h3>
                <div class="flex flex-wrap gap-1.5">
                  @for (s of demand()!.softSkills; track s) {
                    <daf-badge [label]="s" [options]="{ variant: 'success', pill: true }" />
                  }
                </div>
              </daf-card>
            }

            @if (demand()!.additionalNotes) {
              <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="m-0 mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <span class="material-symbols-outlined text-[18px] text-teal">sticky_note_2</span>
                  {{ 'RECRUITMENT_DEMANDS.DETAIL.ADDITIONAL_NOTES' | translate }}
                </h3>
                <p class="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-on-surface">{{ demand()!.additionalNotes }}</p>
              </daf-card>
            }
          </div>

        </div>
      }
    </daf-page>
  `,
  styles: [`
    /* Airy, high-end feel: a very light grey canvas behind the white/glass cards, same
       margin-cancelling trick as /rh/admin so the page still bleeds to the shell's edges. */
    :host {
      display: block;
      background: var(--color-surface-container-low, #f2f4f6);
      margin: -2rem;
      padding: 2rem;
    }
    @media (max-width: 1024px) { :host { margin: -1.5rem; padding: 1.5rem; } }
    @media (max-width: 768px)  { :host { margin: -0.75rem -1rem; padding: 1rem; } }
    @media (max-width: 480px)  { :host { margin: -0.75rem; padding: 0.75rem; } }
  `],
})
export class RecruitmentDemandDetailComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private svc       = inject(RecruitmentDemandService);
  private userStore = inject(UserStore);
  private translate = inject(TranslateService);

  demand        = signal<RecruitmentDemandDetail | null>(null);
  loading       = signal(true);
  reviewing     = signal(false);
  reviewComment = '';
  reviewError   = signal<string | null>(null);

  readonly canApprove = () => this.userStore.hasPermission('RH_APPROVE_RECRUITMENT_DEMAND');
  readonly canCancel  = () => {
    const d = this.demand();
    const uid = this.userStore.currentUser()?.userId;
    return d?.statut === 'EN_ATTENTE' && d?.createdByUserId === uid;
  };

  readonly statusVariant = (s: RecruitmentDemandStatus) => STATUS_VARIANT[s];
  readonly reviewAccent  = computed<CardAccent>(() => {
    const d = this.demand();
    return d ? STATUS_ACCENT[d.statut] : 'none';
  });
  readonly statusIcon      = computed(() => {
    const d = this.demand();
    return d ? STATUS_ICON[d.statut] : 'task_alt';
  });
  readonly statusIconColor = computed(() => {
    const d = this.demand();
    return d ? STATUS_ICON_COLOR[d.statut] : 'text-outline';
  });

  readonly headerBadges = computed<PageHeaderBadge[]>(() => {
    this.translate.currentLang();
    const d = this.demand();
    if (!d) return [];
    return [{
      label: this.translate.instant('RECRUITMENT_DEMANDS.STATUS.' + d.statut),
      variant: STATUS_VARIANT[d.statut],
      pill: true,
    }];
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.translate.currentLang();
    const d = this.demand();
    return [
      { label: this.translate.instant('RECRUITMENT_DEMANDS.DETAIL.BREADCRUMB'), link: '/requests' },
      { label: d?.jobTitle ?? '' },
    ];
  });

  readonly jobDetailFields = computed<DetailField[]>(() => {
    this.translate.currentLang();
    const d = this.demand();
    if (!d) return [];
    const t = (k: string) => this.translate.instant('RECRUITMENT_DEMANDS.DETAIL.' + k);
    const field = (key: string, value: string): DetailField => ({ key, label: t(key), value, ...FIELD_ICON[key] });
    const fields: DetailField[] = [];
    if (d.jobExactTitle) fields.push(field('EXACT_TITLE', d.jobExactTitle));
    fields.push(field('RECRUITMENT_REASON',  d.recruitmentReasonLabel ?? '—'));
    fields.push(field('HEADCOUNT',           String(d.headcount)));
    fields.push(field('URGENCY',             d.urgencyLevelLabel ?? '—'));
    fields.push(field('CSP',                 d.cspCategoryLabel ?? '—'));
    fields.push(field('EXPERIENCE',          d.experienceLevelLabel ?? '—'));
    fields.push(field('EDUCATION',           d.educationLevelLabel ?? '—'));
    fields.push(field('TARGET_START',        d.targetStartDate ? this.formatDate(d.targetStartDate) : '—'));
    fields.push(field('BUDGET',              d.budgetRange ?? '—'));
    fields.push(field('LINKED_CANDIDATES',   String(d.candidateCount)));
    return fields;
  });

  /** `dd/MM/yyyy`, same format the old template's `date` pipe used — plain JS so this
   *  computed doesn't need `DatePipe` injected as a service. */
  private formatDate(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  goBack(): void {
    this.router.navigate(['/requests']);
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.getById(id).pipe(catchError(() => of(null))).subscribe(d => {
      this.demand.set(d);
      this.loading.set(false);
    });
  }

  doReview(approved: boolean): void {
    const d = this.demand();
    if (!d) return;
    this.reviewing.set(true);
    this.reviewError.set(null);
    this.svc.review(d.id, { approved, comment: this.reviewComment || null })
      .pipe(catchError(err => { this.reviewError.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('RECRUITMENT_DEMANDS.DETAIL.ERR')); this.reviewing.set(false); return of(null); }))
      .subscribe(updated => {
        if (updated) { this.demand.set(updated); }
        this.reviewing.set(false);
      });
  }

  doCancel(): void {
    const d = this.demand();
    if (!d) return;
    this.reviewing.set(true);
    this.svc.cancel(d.id)
      .pipe(catchError(() => { this.reviewing.set(false); return of(null); }))
      .subscribe(updated => {
        if (updated) { this.demand.set(updated); }
        this.reviewing.set(false);
      });
  }

  asText(v: string | number | null): string {
    return v == null ? '' : String(v);
  }
}
