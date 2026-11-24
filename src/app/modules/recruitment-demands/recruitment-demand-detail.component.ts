import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PageGuideComponent } from '../../shared/guide/page-guide.component';
import { GuideStep } from '../../shared/guide/page-guide.types';
import { Observable, catchError, of } from 'rxjs';
import {
  BadgeCell,
  BreadcrumbItem,
  ButtonComponent,
  CardAccent,
  CardComponent,
  DataTableComponent,
  DrawerComponent,
  DrawerConfig,
  FormFieldComponent,
  MetricCardComponent,
  MetricDelta,
  PageComponent,
  PageHeaderBadge,
  PageHeaderComponent,
  ProgressBarComponent,
  SkeletonComponent,
  StatusBadgeComponent,
  TableColumn,
  TableConfig,
  TableRow,
} from '@khalilrebhiitec/daf360';
import { ConfirmService } from '../../core/confirm.service';

import { UserStore } from '../../core/user.store';
import { RecruitmentDemandService } from './recruitment-demand.service';
import {
  DemandCandidate, DemandHistoryEvent, DemandHistoryType, RecruitmentDemandDetail, RecruitmentDemandStatus,
} from './recruitment-demand.model';
import { statusBadge } from '../../shared/status-badge.utils';
import { candidateAvatar } from '../candidates/candidate-display';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { ListValue } from '../../core/lists/configurable-list.model';
import { RefDataService } from '../../core/ref/ref-data.service';
import { RefDataItem } from '../../core/ref/ref-data.model';
import { adminLabel } from '../../shared/utils/admin-label.utils';

/** Same traffic-light mapping used on /rh/requests-history and its validation queue. */
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

/** Same icon language as the status KPI tiles on /rh/requests-history, reused here for
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

/** Steps of the page guide, started from « Aide & guides » on a hiring request. */
const GUIDE_STEPS: GuideStep[] = [
  { icon: 'waving_hand', titleKey: 'REQUESTS_GUIDE.DEMAND.WELCOME.TITLE', textKey: 'REQUESTS_GUIDE.DEMAND.WELCOME.TEXT' },
  { icon: 'work', titleKey: 'REQUESTS_GUIDE.DEMAND.HEADER.TITLE', textKey: 'REQUESTS_GUIDE.DEMAND.HEADER.TEXT', target: 'header' },
  { icon: 'gavel', titleKey: 'REQUESTS_GUIDE.DEMAND.DECIDE.TITLE', textKey: 'REQUESTS_GUIDE.DEMAND.DECIDE.TEXT' },
  { icon: 'help', titleKey: 'REQUESTS_GUIDE.DEMAND.END.TITLE', textKey: 'REQUESTS_GUIDE.DEMAND.END.TEXT' },
];

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
    ProgressBarComponent, StatusBadgeComponent, MetricCardComponent, DataTableComponent, DrawerComponent,
    SkeletonComponent, DatePipe, TranslatePipe,
    PageGuideComponent,
  ],
  template: `
    <!-- Same daf-page/daf-page-header scaffold as the other detail pages (candidates,
         profiles): breadcrumbs carry the "back to list" affordance, badges show status
         on the title line — no hand-rolled header markup. -->
    <daf-page [loading]="loading()" [kpis]="4" [breadcrumbs]="true">

      <daf-page-header data-guide="header"
        [title]="demand()?.jobTitle ?? ('RECRUITMENT_DEMANDS.DETAIL.NOT_FOUND' | translate)"
        [subtitle]="departmentLabel()"
        [badges]="headerBadges()"
        [breadcrumbs]="breadcrumbs()"
        [breadcrumbLabel]="'RECRUITMENT_DEMANDS.DETAIL.BREADCRUMB_ARIA' | translate">
        <!-- Static root (the @if lives inside): content nested in an @if is never matched
             by the header's ng-content select. -->
        <div pageActions>
          @if (demand()) {
            <daf-button
              [options]="{ variant: 'secondary', iconStart: 'history', label: ('RECRUITMENT_DEMANDS.HISTORY.OPEN' | translate) }"
              (onClick)="openHistory()" />
          }
        </div>
      </daf-page-header>

      <!-- KPIs under the header (UI-PLAYBOOK §1 scale): where the vacancy stands at a glance —
           posts filled, candidatures still running, recruited, closed. -->
      @if (demand()) {
        <section class="grid gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4
                        max-sm:grid-flow-col max-sm:auto-cols-[80%] max-sm:overflow-x-auto
                        max-sm:snap-x max-sm:snap-mandatory max-sm:pb-1 max-sm:[scrollbar-width:none]">
          @for (k of kpis(); track k.key) {
            <daf-metric-card class="snap-start" [label]="k.label" [value]="k.value" [delta]="k.delta"
                             [options]="{ icon: k.icon, iconColor: k.iconColor, iconBg: k.iconBg }" />
          }
        </section>
      }

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

              <!-- Posts (V137): how many are filled, and — once approved — closing, reopening
                   and resizing the vacancy. A post is filled when its offer is agreed. -->
              @if (showPositions()) {
                <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                  <h3 class="m-0 mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    <span class="material-symbols-outlined text-[18px] text-secondary">groups</span>
                    {{ 'RECRUITMENT_DEMANDS.POSITIONS.TITLE' | translate }}
                  </h3>
                  <p class="m-0 text-[22px] font-bold text-on-surface">
                    {{ demand()!.positionsFilled ?? 0 }} / {{ demand()!.headcount }}
                    <span class="text-[13px] font-medium text-on-surface-variant">{{ 'RECRUITMENT_DEMANDS.POSITIONS.FILLED' | translate }}</span>
                  </p>
                  <div class="mt-2">
                    <daf-progress-bar
                      [value]="demand()!.positionsFilled ?? 0"
                      [options]="{ max: demand()!.headcount || 1, size: 'sm', rounded: true,
                                   variant: (demand()!.remainingPositions ?? 0) === 0 ? 'teal' : 'secondary' }" />
                  </div>
                  <p class="m-0 mt-2 text-[12px] text-on-surface-variant">
                    {{ 'RECRUITMENT_DEMANDS.POSITIONS.DETAIL' | translate:{ hired: demand()!.hiredCount ?? 0, remaining: demand()!.remainingPositions ?? 0 } }}
                  </p>

                  @if (demand()!.statut === 'CLOTUREE' && demand()!.closedReason) {
                    <p class="m-0 mt-3 flex items-start gap-1.5 rounded-lg bg-surface-container px-3 py-2 text-[12px] text-on-surface">
                      <span class="material-symbols-outlined text-[16px] text-teal">task_alt</span>
                      <span>
                        {{ ('RECRUITMENT_DEMANDS.POSITIONS.CLOSED_' + demand()!.closedReason) | translate:{ date: (demand()!.closedAt | date:'dd/MM/yyyy'), name: demand()!.closedByName || '—' } }}
                      </span>
                    </p>
                  }

                  @if (canResize()) {
                    <div class="mt-4 flex items-end gap-2">
                      <div class="min-w-0 flex-1">
                        <daf-form-field
                          [options]="{ type: 'number', label: ('RECRUITMENT_DEMANDS.POSITIONS.HEADCOUNT' | translate),
                                       fullWidth: true, error: headcountError() ?? '' }"
                          [value]="headcountDraft()"
                          (valueChange)="headcountDraft.set(toInt($event))" />
                      </div>
                      <daf-button
                        [options]="{ variant: 'secondary', iconStart: 'save', disabled: positionsBusy() || headcountDraft() === demand()!.headcount,
                                     loading: positionsBusy(), label: ('RECRUITMENT_DEMANDS.POSITIONS.SAVE' | translate) }"
                        (onClick)="saveHeadcount()" />
                    </div>
                  }

                  @if (positionsError()) {
                    <p class="m-0 mt-2 text-[12px] text-danger">{{ positionsError() }}</p>
                  }

                  <div class="mt-4 flex flex-col gap-2">
                    @if (canClose()) {
                      <daf-form-field
                        [options]="{ type: 'textarea', rows: 2, fullWidth: true,
                                     label: ('RECRUITMENT_DEMANDS.POSITIONS.CLOSE_NOTE' | translate) }"
                        [value]="closeNote"
                        (valueChange)="closeNote = asText($event)" />
                      <daf-button
                        [options]="{ variant: 'ghost', iconStart: 'lock', fullWidth: true, disabled: positionsBusy(),
                                     label: ('RECRUITMENT_DEMANDS.POSITIONS.CLOSE' | translate) }"
                        (onClick)="doClose()" />
                    }
                    @if (canReopen()) {
                      <daf-button
                        [options]="{ variant: 'secondary', iconStart: 'lock_open', fullWidth: true, disabled: positionsBusy(),
                                     label: ('RECRUITMENT_DEMANDS.POSITIONS.REOPEN' | translate) }"
                        (onClick)="doReopen()" />
                    }
                  </div>
                </daf-card>
              }

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
            <!-- Who applied to this vacancy: every candidature, with where it stands — still
                 running, counting down to its archive (posts filled), recruited, or closed. -->
            @if (showCandidates()) {
              <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="m-0 mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <span class="material-symbols-outlined text-[18px] text-teal">group</span>
                  {{ 'RECRUITMENT_DEMANDS.CANDIDATES.TITLE' | translate:{ count: candidates().length } }}
                </h3>
                @if (candidatesError()) {
                  <p class="m-0 text-[13px] text-danger">{{ candidatesError() }}</p>
                } @else {
                  <daf-data-table
                    [columns]="candidateColumns()"
                    [rows]="candidateRows()"
                    [config]="candidateTableConfig()"
                    (rowClick)="openCandidate($any($event)['_id'])" />
                }
              </daf-card>
            }

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

    <!-- « Historique » — at the page root: the panel is position: fixed, and an ancestor with
         a transform (daf-page's enter animation, a glass card) would become its containing
         block. Opened from the header button only (no edge tab). -->
    <daf-drawer [(open)]="historyOpen" [config]="historyDrawerConfig()">
      @if (historyLoading()) {
        <div class="flex flex-col gap-3">
          @for (i of [0, 1, 2, 3, 4]; track i) {
            <daf-skeleton variant="block" radius="lg" width="100%" height="56px" />
          }
        </div>
      } @else if (historyError()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>
          <span class="flex-1">{{ historyError() }}</span>
        </div>
      } @else if (!historyItems().length) {
        <p class="m-0 text-[13px] text-on-surface-variant">{{ 'RECRUITMENT_DEMANDS.HISTORY.EMPTY' | translate }}</p>
      } @else {
        <ol class="m-0 flex list-none flex-col p-0">
          @for (h of historyItems(); track $index; let last = $last) {
            <li class="flex gap-3">
              <!-- Rail: the event's icon, a line down to the next one. -->
              <div class="flex flex-col items-center">
                <span [class]="'flex h-8 w-8 shrink-0 items-center justify-center rounded-full ' + h.tone">
                  <span class="material-symbols-outlined text-[17px]">{{ h.icon }}</span>
                </span>
                @if (!last) { <span class="my-1 w-px flex-1 bg-outline-variant"></span> }
              </div>
              <div class="min-w-0 flex-1 pb-5">
                <p class="m-0 text-[13px] font-semibold leading-snug text-on-surface">
                  {{ h.title }}
                  @if (h.candidateId) {
                    <button type="button" class="ml-0.5 font-semibold text-teal hover:underline"
                            (click)="openCandidate(h.candidateId)">{{ h.candidateName }}</button>
                  }
                </p>
                @if (h.detail) {
                  <p class="m-0 mt-0.5 text-[12px] leading-snug text-on-surface-variant">{{ h.detail }}</p>
                }
                <p class="m-0 mt-1 text-[11px] text-outline">{{ h.when }}@if (h.actor) { · {{ h.actor }} }</p>
              </div>
            </li>
          }
        </ol>
      }
    </daf-drawer>

    <rh-page-guide storageKey="recruitment-demand" [steps]="guideSteps" />
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
  readonly guideSteps = GUIDE_STEPS;

  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private svc       = inject(RecruitmentDemandService);
  private userStore = inject(UserStore);
  private translate = inject(TranslateService);
  private listSvc   = inject(ConfigurableListService);
  private refSvc    = inject(RefDataService);

  // rh/admin lists behind the demand's fields. The DTO carries their ids plus the French
  // label only; the ids are resolved here so the page follows the UI language.
  private readonly urgencyLevels    = signal<ListValue[]>([]);
  private readonly cspCategories    = signal<ListValue[]>([]);
  private readonly experienceLevels = signal<ListValue[]>([]);
  private readonly educationLevels  = signal<ListValue[]>([]);
  private readonly departments      = signal<RefDataItem[]>([]);

  private loadAdminLists(paysId: number): void {
    const list = (code: string, target: ReturnType<typeof signal<ListValue[]>>) =>
      this.listSvc.getListValues(code, paysId)
        .pipe(catchError(() => of([] as ListValue[])))
        .subscribe(v => target.set(v));
    list('URGENCY_LEVEL',    this.urgencyLevels);
    list('CSP_CATEGORY',     this.cspCategories);
    list('EXPERIENCE_LEVEL', this.experienceLevels);
    list('EDUCATION_LEVEL',  this.educationLevels);
    this.refSvc.getDepartments(paysId).subscribe(r => this.departments.set(r));
  }

  /** rh/admin label by id, in the UI language; an id the list no longer holds keeps the DTO label. */
  private labelById(items: { id: number; labelFr: string; labelEn: string }[],
                    id: number | null | undefined, fallback: string | null): string {
    const item = id != null ? items.find(i => i.id === id) : undefined;
    return item ? adminLabel(item, this.translate) : (fallback ?? '—');
  }

  /** Department in the UI language — the page subtitle. */
  readonly departmentLabel = computed(() => {
    const d = this.demand();
    if (!d) return undefined;
    return this.labelById(this.departments(), d.departmentId, d.department) || undefined;
  });

  /** Recruitment reason — an enum, translated with the same keys as the create form. */
  private reasonLabel(d: RecruitmentDemandDetail): string {
    if (!d.recruitmentReason) return d.recruitmentReasonLabel ?? '—';
    const key = `RECRUITMENT_DEMANDS.FORM.REASON.${d.recruitmentReason}_LABEL`;
    const text = this.translate.instant(key);
    return text !== key ? text : (d.recruitmentReasonLabel ?? '—');
  }

  demand        = signal<RecruitmentDemandDetail | null>(null);
  loading       = signal(true);
  reviewing     = signal(false);
  reviewComment = '';
  reviewError   = signal<string | null>(null);

  /** Never on one's own request — the backend refuses it (four-eyes), so the buttons would only fail. */
  readonly canApprove = () =>
    this.userStore.hasPermission('RH_APPROVE_RECRUITMENT_DEMAND')
    && this.demand()?.createdByUserId !== this.userStore.currentUser()?.userId;
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

  /**
   * Ouverte depuis l'onglet « Demande de recrutement » de `/rh/requests` (`?from=requests`) :
   * le retour y ramène. Sinon elle vient de l'Historique, qui est la liste de ces demandes.
   *
   * Le retour pointait auparavant vers `/requests`, chemin qui n'existe pas une fois l'app
   * montée dans le shell (sous `/rh`) : le fil d'Ariane et « Retour » menaient à la page 404.
   */
  private readonly fromRequests = this.route.snapshot.queryParamMap.get('from') === 'requests';
  private readonly backLink = this.fromRequests ? '/rh/requests' : '/rh/requests-history';

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.translate.currentLang();
    const d = this.demand();
    return [
      this.fromRequests
        ? { label: this.translate.instant('RECRUITMENT_DEMANDS.DETAIL.BREADCRUMB'), link: this.backLink }
        : { label: this.translate.instant('RECRUITMENT_DEMANDS.LIST.TITLE'), link: this.backLink },
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
    fields.push(field('RECRUITMENT_REASON',  this.reasonLabel(d)));
    fields.push(field('HEADCOUNT',           String(d.headcount)));
    fields.push(field('URGENCY',    this.labelById(this.urgencyLevels(),    d.urgencyLevelId,    d.urgencyLevelLabel)));
    fields.push(field('CSP',        this.labelById(this.cspCategories(),    d.cspCategoryId,     d.cspCategoryLabel)));
    fields.push(field('EXPERIENCE', this.labelById(this.experienceLevels(), d.experienceLevelId, d.experienceLevelLabel)));
    fields.push(field('EDUCATION',  this.labelById(this.educationLevels(),  d.educationLevelId,  d.educationLevelLabel)));
    fields.push(field('TARGET_START',        d.targetStartDate ? this.formatDate(d.targetStartDate) : '—'));
    fields.push(field('BUDGET',              d.budgetRange ?? '—'));
    fields.push(field('LINKED_CANDIDATES',   String(d.candidateCount ?? 0)));
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
    this.router.navigate([this.backLink]);
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.getById(id).pipe(catchError(() => of(null))).subscribe(d => {
      this.demand.set(d);
      if (d) {
        this.headcountDraft.set(d.headcount);
        this.loadAdminLists(d.paysId);
        this.loadCandidates(d.id);
      }
      this.loading.set(false);
    });
  }

  // ── Candidates + KPIs ──────────────────────────────────────────────────────

  /** Every candidature of the demand (`/{id}/candidates`), newest first. */
  readonly candidates        = signal<DemandCandidate[]>([]);
  readonly candidatesLoading = signal(true);
  readonly candidatesError   = signal<string | null>(null);

  /** Candidatures exist only once a demand is approved — before that the section is noise. */
  readonly showCandidates = computed(() => {
    const s = this.demand()?.statut;
    return s === 'APPROUVEE' || s === 'CLOTUREE' || this.candidates().length > 0;
  });

  private loadCandidates(demandId: number): void {
    this.candidatesLoading.set(true);
    this.candidatesError.set(null);
    this.svc.getCandidates(demandId).subscribe({
      next: list => { this.candidates.set(list ?? []); this.candidatesLoading.set(false); },
      error: err => {
        this.candidatesLoading.set(false);
        this.candidatesError.set(err?.error?.detail ?? err?.error?.message
          ?? this.translate.instant('RECRUITMENT_DEMANDS.CANDIDATES.ERR_LOAD'));
      },
    });
  }

  /** Still in recruitment (interviews, accepted, offer sent). */
  private static readonly RUNNING = ['PENDING', 'ACCEPTED', 'OFFER_SENT'];
  /** The offer is agreed: onboarding / IT under way, or hired — these hold a post. */
  private static readonly RECRUITED = ['IT_IN_PROGRESS', 'EMAIL_RECEIVED', 'HR_IN_PROGRESS', 'HIRED'];

  /** Days left before a candidature on a filled demand is archived; null when none is planned. */
  private daysLeft(c: DemandCandidate): number | null {
    if (!c.archiveDueDate) return null;
    const [y, m, d] = c.archiveDueDate.split('-').map(Number);
    const now = new Date();
    const diff = Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round(diff / 86_400_000));
  }

  /**
   * The vacancy at a glance: posts filled (of the headcount), candidatures still running (and
   * how many of them count down to the archive), recruited, and closed ones (archived /
   * refused).
   */
  readonly kpis = computed(() => {
    this.translate.currentLang();
    const d = this.demand();
    if (!d) return [];
    const t = (k: string, p?: Record<string, unknown>) => this.translate.instant('RECRUITMENT_DEMANDS.KPI.' + k, p);
    const list = this.candidates();
    const running   = list.filter(c => RecruitmentDemandDetailComponent.RUNNING.includes(c.status));
    const counting  = running.filter(c => c.archiveDueDate).length;
    const recruited = list.filter(c => RecruitmentDemandDetailComponent.RECRUITED.includes(c.status)).length;
    const archived  = list.filter(c => c.status === 'ARCHIVED').length;
    const rejected  = list.filter(c => c.status === 'REJECTED').length;
    const filled    = d.positionsFilled ?? 0;
    const remaining = d.remainingPositions ?? Math.max(0, d.headcount - filled);
    const kpi = (key: string, label: string, value: string, delta: MetricDelta | null,
                 icon: string, iconColor: string, iconBg: string) => ({ key, label, value, delta, icon, iconColor, iconBg });
    return [
      kpi('POSTS', t('POSTS'), filled + ' / ' + d.headcount,
          { value: remaining === 0 ? t('POSTS_FULL') : t('POSTS_LEFT', { count: remaining }),
            direction: remaining === 0 ? 'up' : 'neutral' },
          'groups', 'text-secondary', 'bg-secondary/10'),
      kpi('RUNNING', t('RUNNING'), String(running.length),
          counting ? { value: t('RUNNING_COUNTDOWN', { count: counting }), direction: 'down' } : null,
          'hourglass_top', 'text-warning', 'bg-warning/10'),
      kpi('RECRUITED', t('RECRUITED'), String(recruited),
          d.hiredCount ? { value: t('RECRUITED_HIRED', { count: d.hiredCount }), direction: 'up' } : null,
          'how_to_reg', 'text-success', 'bg-success/10'),
      kpi('CLOSED', t('CLOSED'), String(archived + rejected),
          (archived + rejected) ? { value: t('CLOSED_DETAIL', { archived, rejected }), direction: 'neutral' } : null,
          'inventory_2', 'text-outline', 'bg-surface-container-high'),
    ];
  });

  readonly candidateColumns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('RECRUITMENT_DEMANDS.CANDIDATES.' + k);
    return [
      { key: 'candidate', label: t('COL_CANDIDATE'), type: 'avatar', mobile: 'primary' },
      { key: 'status',    label: t('COL_STATUS'), type: 'badge' },
      { key: 'created',   label: t('COL_APPLIED'), mobile: 'hidden' },
      { key: 'followUp',  label: t('COL_FOLLOW_UP') },
    ];
  });

  readonly candidateRows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    const t = (k: string, p?: Record<string, unknown>) => this.translate.instant('RECRUITMENT_DEMANDS.CANDIDATES.' + k, p);
    return this.candidates().map(c => {
      const badge = statusBadge(c.status, this.translate);
      const days = this.daysLeft(c);
      let followUp = '—';
      if (days !== null) {
        followUp = days === 0 ? t('ARCHIVE_TODAY') : t('ARCHIVE_IN', { days });
      } else if (c.status === 'ARCHIVED') {
        const reason = this.translate.instant('CANDIDATES.LIFECYCLE.ARCHIVE_REASON.' + (c.archiveReason ?? 'UNKNOWN'));
        followUp = c.archivedAt ? reason + ' · ' + this.formatDate(c.archivedAt) : reason;
      } else if (c.status === 'REJECTED') {
        followUp = c.rejectionReason || '—';
      }
      const initials = (c.fullName || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
      return {
        _id: c.id,
        candidate: { name: c.fullName || '—', initials, avatar: candidateAvatar(c.gender) || undefined, subtitle: c.email ?? '' },
        status: { label: badge.label, options: { variant: badge.options.variant } } as BadgeCell,
        created: c.createdAt ? this.formatDate(c.createdAt) : '—',
        followUp,
      };
    });
  });

  readonly candidateTableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      hoverable: true,
      loading: this.candidatesLoading(),
      skeletonRows: 3,
      emptyMessage: this.translate.instant('RECRUITMENT_DEMANDS.CANDIDATES.EMPTY'),
      rowId: (row) => String(row['_id']),
    };
  });

  openCandidate(id: number | null | undefined): void {
    if (id != null) this.router.navigate(['/rh/candidates', id]);
  }

  // ── Historique (drawer) ────────────────────────────────────────────────────

  readonly historyOpen    = signal(false);
  readonly history        = signal<DemandHistoryEvent[]>([]);
  readonly historyLoading = signal(false);
  readonly historyError   = signal<string | null>(null);

  readonly historyDrawerConfig = computed<DrawerConfig>(() => {
    this.translate.currentLang();
    return {
      title: this.translate.instant('RECRUITMENT_DEMANDS.HISTORY.TITLE'),
      icon: 'history',
      width: '440px',
      showToggle: false,
      closeLabel: this.translate.instant('RECRUITMENT_DEMANDS.HISTORY.CLOSE'),
    };
  });

  /** Fetched on every opening: the drawer is where you look for what just changed. */
  openHistory(): void {
    const d = this.demand();
    if (!d) return;
    this.historyOpen.set(true);
    this.historyLoading.set(true);
    this.historyError.set(null);
    this.svc.getHistory(d.id).subscribe({
      next: list => { this.history.set(list ?? []); this.historyLoading.set(false); },
      error: err => {
        this.historyLoading.set(false);
        this.historyError.set(err?.error?.detail ?? err?.error?.message
          ?? this.translate.instant('RECRUITMENT_DEMANDS.HISTORY.ERR_LOAD'));
      },
    });
  }

  /** Icon + tone per event. Whole literal class strings — a class built at runtime is never
   *  generated by Tailwind (UI-PLAYBOOK §3). */
  private static readonly HISTORY_LOOK: Record<DemandHistoryType, { icon: string; tone: string }> = {
    CREATED:            { icon: 'add_circle',     tone: 'bg-primary/10 text-primary' },
    REQUESTED_AGAIN:    { icon: 'history',        tone: 'bg-secondary/10 text-secondary' },
    REQUESTED_LATER:    { icon: 'content_copy',   tone: 'bg-secondary/10 text-secondary' },
    APPROVED:           { icon: 'check_circle',   tone: 'bg-success/10 text-success' },
    REJECTED:           { icon: 'cancel',         tone: 'bg-danger/10 text-danger' },
    CANCELLED:          { icon: 'block',          tone: 'bg-surface-container-high text-on-surface-variant' },
    HEADCOUNT_CHANGED:  { icon: 'groups',         tone: 'bg-secondary/10 text-secondary' },
    CLOSED_MANUAL:      { icon: 'lock',           tone: 'bg-surface-container-high text-on-surface-variant' },
    CLOSED_FILLED:      { icon: 'task_alt',       tone: 'bg-teal/10 text-teal' },
    REOPENED:           { icon: 'lock_open',      tone: 'bg-warning/10 text-warning' },
    REOPENED_AUTO:      { icon: 'lock_open',      tone: 'bg-warning/10 text-warning' },
    CANDIDATE_ADDED:    { icon: 'person_add',     tone: 'bg-primary/10 text-primary' },
    CANDIDATE_REUSED:   { icon: 'content_copy',   tone: 'bg-teal/10 text-teal' },
    OFFER_ACCEPTED:     { icon: 'how_to_reg',     tone: 'bg-success/10 text-success' },
    CANDIDATE_ARCHIVED: { icon: 'inventory_2',    tone: 'bg-surface-container-high text-on-surface-variant' },
    CANDIDATE_REJECTED: { icon: 'person_remove',  tone: 'bg-danger/10 text-danger' },
  };

  readonly historyItems = computed(() => {
    const lang = this.translate.currentLang();
    const locale = lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar-TN' : 'fr-FR';
    const t = (k: string, p?: Record<string, unknown>) => this.translate.instant('RECRUITMENT_DEMANDS.HISTORY.' + k, p);
    const day = (iso: string | undefined) => {
      if (!iso) return '';
      const x = new Date(iso);
      return isNaN(x.getTime()) ? iso : x.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
    };
    return this.history().map(h => {
      const look = RecruitmentDemandDetailComponent.HISTORY_LOOK[h.type]
        ?? { icon: 'radio_button_checked', tone: 'bg-surface-container-high text-on-surface-variant' };
      const d = h.details ?? {};
      let detail: string | null = null;
      switch (h.type) {
        case 'REQUESTED_AGAIN':
          detail = t('DETAIL.REQUESTED_AGAIN', { demandId: d['demandId'], date: day(d['date']) }); break;
        case 'REQUESTED_LATER':
          detail = t('DETAIL.REQUESTED_LATER', {
            demandId: d['demandId'],
            status: d['status'] ? this.translate.instant('RECRUITMENT_DEMANDS.STATUS.' + d['status']) : '' }); break;
        case 'APPROVED':
        case 'REJECTED':
          detail = d['comment'] || null; break;
        case 'CLOSED_MANUAL':
          detail = [d['note'], d['archived'] ? t('DETAIL.ARCHIVED_COUNT', { count: d['archived'] }) : null]
            .filter(Boolean).join(' · ') || null; break;
        case 'CLOSED_FILLED':
        case 'REOPENED':
        case 'REOPENED_AUTO':
          detail = d['filled'] ? t('DETAIL.FILLED', { filled: d['filled'] }) : null; break;
        case 'CANDIDATE_REUSED':
          detail = d['fromName'] ? t('DETAIL.REUSED_FROM', { name: d['fromName'] }) : null; break;
        case 'CANDIDATE_ARCHIVED':
          detail = this.translate.instant('CANDIDATES.LIFECYCLE.ARCHIVE_REASON.' + (d['reason'] || 'UNKNOWN')); break;
        case 'CANDIDATE_REJECTED':
          detail = d['reason'] || null; break;
      }
      const when = new Date(h.at);
      return {
        icon: look.icon,
        tone: look.tone,
        title: t('TYPE.' + h.type, { count: d['count'], from: d['from'], to: d['to'] }),
        detail,
        candidateId: h.candidateId,
        candidateName: h.candidateName,
        actor: h.actorName ?? (h.type === 'CLOSED_FILLED' || h.type === 'REOPENED_AUTO'
          || (h.type === 'CANDIDATE_ARCHIVED' && d['reason'] === 'POSITION_FILLED') ? t('SYSTEM') : null),
        when: isNaN(when.getTime()) ? h.at
          : when.toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      };
    });
  });

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

  // ── Posts (V137) ───────────────────────────────────────────────────────────
  private confirm = inject(ConfirmService);

  readonly positionsBusy  = signal(false);
  readonly positionsError = signal<string | null>(null);
  readonly headcountDraft = signal<number>(1);
  closeNote = '';

  /** Approved or closed: the vacancy exists, so its posts mean something. */
  readonly showPositions = () => {
    const s = this.demand()?.statut;
    return s === 'APPROUVEE' || s === 'CLOTUREE';
  };
  /** The recruitment team runs the vacancy; the approvers decided it — both may close it. */
  readonly canClose = () => this.demand()?.statut === 'APPROUVEE'
    && (this.userStore.hasPermission('RH_APPROVE_RECRUITMENT_DEMAND') || this.userStore.hasPermission('CREATE_CANDIDATE'));
  /** Reopening or resizing restarts / widens the recruitment: an approver's call. */
  readonly canReopen = () => this.demand()?.statut === 'CLOTUREE'
    && this.userStore.hasPermission('RH_APPROVE_RECRUITMENT_DEMAND');
  readonly canResize = () => this.showPositions() && this.userStore.hasPermission('RH_APPROVE_RECRUITMENT_DEMAND');

  /** Never below the posts already filled — the server refuses it too. */
  readonly headcountError = computed<string | null>(() => {
    this.translate.currentLang();
    const n = this.headcountDraft();
    const filled = this.demand()?.positionsFilled ?? 0;
    if (!Number.isInteger(n) || n < 1 || n > 50) return this.translate.instant('RECRUITMENT_DEMANDS.POSITIONS.ERR_RANGE');
    if (n < filled) return this.translate.instant('RECRUITMENT_DEMANDS.POSITIONS.ERR_BELOW_FILLED', { filled });
    return null;
  });

  private setDemand(d: RecruitmentDemandDetail): void {
    this.demand.set(d);
    this.headcountDraft.set(d.headcount);
  }

  toInt(v: string | number | null): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }

  saveHeadcount(): void {
    const d = this.demand();
    if (!d || this.headcountError()) return;
    this.runPositions(this.svc.changeHeadcount(d.id, this.headcountDraft()));
  }

  async doClose(): Promise<void> {
    const d = this.demand();
    if (!d) return;
    const ok = await this.confirm.ask({
      title:   this.translate.instant('RECRUITMENT_DEMANDS.POSITIONS.CLOSE_CONFIRM_TITLE'),
      message: this.translate.instant('RECRUITMENT_DEMANDS.POSITIONS.CLOSE_CONFIRM_MSG'),
      confirmLabel: this.translate.instant('RECRUITMENT_DEMANDS.POSITIONS.CLOSE'),
      cancelLabel:  this.translate.instant('RECRUITMENT_DEMANDS.POSITIONS.CANCEL'),
      icon: 'lock',
    });
    if (!ok) return;
    this.runPositions(this.svc.close(d.id, this.closeNote.trim() || null), () => { this.closeNote = ''; });
  }

  doReopen(): void {
    const d = this.demand();
    if (!d) return;
    this.runPositions(this.svc.reopen(d.id));
  }

  private runPositions(call: Observable<RecruitmentDemandDetail>, after?: () => void): void {
    this.positionsBusy.set(true);
    this.positionsError.set(null);
    call.subscribe({
      next: updated => {
        this.setDemand(updated);
        this.positionsBusy.set(false);
        // Closing archives candidatures, resizing / reopening ends their countdown.
        this.loadCandidates(updated.id);
        after?.();
      },
      error: err => {
        this.positionsBusy.set(false);
        this.positionsError.set(err?.error?.detail ?? err?.error?.message
          ?? this.translate.instant('RECRUITMENT_DEMANDS.DETAIL.ERR'));
      },
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
