import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { KanbanCardShellComponent } from '../../../shared/kanban-card-shell.component';
import { statusBadge } from '../../../shared/status-badge.utils';
import { KanbanCandidate } from '../services/pipeline.service';
import { BOARD_STAGES, BoardStageKey, archiveDaysLeft, canSendOffer, isOfferPending, stepDetail } from '../board.model';
import { candidateAvatar, candidateInitials, fitScoreClass } from '../pipeline-display';
import { interviewDateText } from '../../candidates/candidate-display';
import { interviewTypeLabel } from '../../candidates/interview.model';

/**
 * One candidature card — the single implementation used by BOTH the desktop board and the
 * mobile stage list.
 *
 * It says two things up top, the two questions asked of a candidature at a glance:
 *   - its STATUS (En attente / Accepté / Offre envoyée), the candidate's own status badge;
 *   - its STEP — the column it sits in (Entretiens / Validation RH / Offre) and where it
 *     stands inside it (« 1/2 PV déposé(s) », « Tour 2 — chez la DAF »…), the very words of
 *     the rail on the candidate page.
 *
 * Purely presentational: it owns no state beyond "this avatar 404'd", does no navigation and
 * never calls a service. Every action leaves as an output with the original DOM event.
 *
 * `stage` is an input rather than derived here: the board owns the grouping, and the card
 * renders the column it was put in.
 */
@Component({
  selector: 'rh-pipeline-kanban-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KanbanCardShellComponent, StatusBadgeComponent, TranslatePipe],
  template: `
    <rh-kanban-card-shell
      class="min-h-64"
      [surface]="'white'"
      (click)="open.emit()">

      <!-- Candidature status + fit score -->
      <div class="flex items-center justify-between gap-2 mb-2">
        <daf-badge [label]="status().label" [options]="{ variant: status().options.variant, size: 'sm' }" />
        @if (candidate().fitScore != null) {
          <span class="text-sm font-bold shrink-0" [class]="fitClass()">
            {{ 'PIPELINE.FIT_SCORE' | translate:{ score: candidate().fitScore } }}
          </span>
        }
      </div>

      <!-- Current step: the column's step, and how far along it the candidature is -->
      <div class="flex items-center gap-1.5 mb-3 rounded-lg px-2 py-1.5 text-[11px] min-w-0"
           [style.background]="stageDef().badgeBg" [style.color]="stageDef().accent">
        <span class="material-symbols-outlined text-[15px] shrink-0">{{ stageDef().icon }}</span>
        <span class="font-bold shrink-0">{{ stageDef().labelKey | translate }}</span>
        @if (detail(); as d) {
          <span class="truncate text-on-surface-variant" [title]="d">· {{ d }}</span>
        }
      </div>

      <!-- Every post of the demand is filled: this candidature can no longer be hired and
           leaves for the archive on its creation date + 30 days. -->
      @if (archiveLabel(); as label) {
        <div class="flex items-center gap-1.5 mb-3 rounded-lg px-2 py-1.5 text-[11px] font-semibold
                    bg-warning/10 text-warning" [title]="archiveTooltip()">
          <span class="material-symbols-outlined text-[15px] shrink-0">schedule</span>
          <span class="truncate">{{ label }}</span>
        </div>
      }

      <!-- Identity -->
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-outline-variant
                      bg-surface-container-high flex items-center justify-center">
            @if (!avatarFailed()) {
              <img [src]="avatar()" [alt]="candidate().fullName"
                   class="w-full h-full object-cover" (error)="avatarFailed.set(true)" />
            } @else {
              <span class="text-[14px] font-bold text-on-surface-variant">{{ initials() }}</span>
            }
          </div>
          <div class="min-w-0">
            <h4 class="font-bold text-on-surface truncate">{{ candidate().fullName }}</h4>
            <p class="text-xs text-outline truncate">{{ candidate().poste || '—' }}</p>
            <!-- Which vacancy this candidature answers; a spontaneous one is shown as such. -->
            @if (candidate().demandTitle) {
              <p class="mt-1 flex items-center gap-1 text-[11px] text-tertiary truncate"
                 [title]="candidate().demandTitle!">
                <span class="material-symbols-outlined text-[13px] shrink-0">work_history</span>
                <span class="truncate">{{ candidate().demandTitle }}</span>
              </p>
            } @else {
              <p class="mt-1 text-[11px] italic text-outline/70">
                {{ 'PIPELINE.CARD.SPONTANEOUS' | translate }}
              </p>
            }
          </div>
        </div>
        @if (showChevron()) {
          <span class="material-symbols-outlined text-outline shrink-0">chevron_right</span>
        }
      </div>

      <!-- Présélection / Entretiens: skill chips -->
      @if ((stage() === 'PRESELECTION' || stage() === 'INTERVIEWS') && candidate().skills.length) {
        <div class="flex flex-wrap gap-1.5 mb-3">
          @for (skill of candidate().skills.slice(0, 3); track skill) {
            <span class="bg-surface-container-low text-on-surface-variant text-[10px] px-2 py-0.5 rounded">
              {{ skill }}
            </span>
          }
        </div>
      }

      <!-- Offre: where the round stands -->
      @if (stage() === 'OFFER') {
        <div class="bg-surface-container-low p-2 rounded-lg mb-3 text-xs">
          <p class="text-on-surface-variant italic">
            @if (offerPending()) {
              {{ 'PIPELINE.CARD.PENDING_SIGNATURE' | translate }}@if (candidate().offerExpiry) {
                {{ 'PIPELINE.CARD.EXPIRES' | translate:{ date: candidate().offerExpiry } }}
              }
            } @else {
              {{ candidate().note || ('PIPELINE.CARD.OFFER_IN_PREP' | translate) }}
            }
          </p>
        </div>
      }

      <!-- Footer: one meta item left, one meta item (or the actions) right -->
      <div class="mt-auto pt-3 border-t border-outline-variant flex items-center justify-between gap-2
                  text-on-surface-variant text-[11px]">
        @switch (stage()) {

          @case ('PRESELECTION') {
            <span class="flex items-center gap-1 min-w-0">
              <span class="material-symbols-outlined text-[14px] shrink-0">inbox</span>
              <span class="truncate">
                {{ 'PIPELINE.CARD.APPLIED_ON' | translate:{ date: candidate().applicationDate || '—' } }}
              </span>
            </span>
            <span class="flex items-center gap-1 min-w-0 shrink-0">
              <span class="material-symbols-outlined text-[14px] shrink-0">location_on</span>
              <span class="truncate max-w-[90px]">{{ candidate().location || '—' }}</span>
            </span>
          }

          @case ('HIRED') {
            <span class="flex items-center gap-1 min-w-0">
              <span class="material-symbols-outlined text-[14px] shrink-0">badge</span>
              <span class="truncate">{{ candidate().contractType || '—' }}</span>
            </span>
            @if (candidate().status !== 'HIRED' && candidate().progressPercent != null) {
              <span class="flex items-center gap-1 min-w-0 shrink-0">
                <span class="material-symbols-outlined text-[14px] shrink-0">progress_activity</span>
                <span>{{ candidate().progressPercent }} %</span>
              </span>
            }
          }

          @case ('INTERVIEWS') {
            <span class="flex items-center gap-1 min-w-0">
              <span class="material-symbols-outlined text-[14px] shrink-0">calendar_month</span>
              <span class="truncate">
                {{ nextEventLabel() || ('PIPELINE.CARD.INTERVIEW_TO_SCHEDULE' | translate) }}
              </span>
            </span>
            @if (candidate().interviewLocation) {
              <span class="flex items-center gap-1 min-w-0 shrink-0">
                <span class="material-symbols-outlined text-[14px] shrink-0">location_on</span>
                <span class="truncate max-w-[90px]">{{ candidate().interviewLocation }}</span>
              </span>
            }
          }

          @case ('OFFER') {
            <span class="flex items-center gap-1 min-w-0">
              <span class="material-symbols-outlined text-[14px] shrink-0">payments</span>
              <span class="truncate">{{ candidate().askedSalary || '—' }} ~ {{ candidate().proposedSalary || '—' }}</span>
            </span>
            @if (offerSendable()) {
              <button type="button" [title]="'PIPELINE.CARD.SEND_OFFER_TITLE' | translate"
                class="shrink-0 p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container
                       hover:text-on-surface transition-colors"
                (click)="sendOffer.emit($event)">
                <span class="material-symbols-outlined text-[18px]">send</span>
              </button>
            } @else if (offerPending()) {
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" [title]="'PIPELINE.CARD.ACCEPT_OFFER_TITLE' | translate" [disabled]="actioning()"
                  class="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface
                         transition-colors disabled:opacity-40"
                  (click)="acceptOffer.emit($event)">
                  <span class="material-symbols-outlined text-[18px]">check_circle</span>
                </button>
                <button type="button" [title]="'PIPELINE.CARD.RENEGOTIATE_TITLE' | translate"
                  class="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface
                         transition-colors"
                  (click)="renegotiate.emit($event)">
                  <span class="material-symbols-outlined text-[18px]">sync</span>
                </button>
                <button type="button" [title]="'PIPELINE.CARD.REFUSE_OFFER_TITLE' | translate" [disabled]="actioning()"
                  class="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface
                         transition-colors disabled:opacity-40"
                  (click)="refuse.emit($event)">
                  <span class="material-symbols-outlined text-[18px]">cancel</span>
                </button>
              </div>
            }
          }
        }
      </div>
    </rh-kanban-card-shell>
  `,
})
export class PipelineKanbanCardComponent {
  private translate = inject(TranslateService);

  readonly candidate = input.required<KanbanCandidate>();
  /** Board column (recruitment step) this card is rendered under — drives the step line and footer. */
  readonly stage     = input.required<BoardStageKey>();
  /** Mobile list affordance: the card is a row, so it gets a chevron. */
  readonly showChevron = input(false);
  /** An accept / refuse call is in flight for this candidate. */
  readonly actioning   = input(false);

  readonly open        = output<void>();
  readonly sendOffer   = output<Event>();
  readonly acceptOffer = output<Event>();
  readonly renegotiate = output<Event>();
  readonly refuse      = output<Event>();

  /** Local only: the photo endpoint 404'd, fall back to initials. */
  protected readonly avatarFailed = signal(false);

  /** The candidature status badge — label in the UI language, shared variant. */
  protected readonly status = computed(() => {
    this.translate.currentLang();
    return statusBadge(this.candidate().status ?? 'PENDING', this.translate);
  });

  /** The step definition of the column (label key, icon, colours). */
  protected readonly stageDef = computed(() =>
    BOARD_STAGES.find(s => s.key === this.stage()) ?? BOARD_STAGES[0]);

  /** « 1/2 PV déposé(s) », « Tour 2 — chez la DAF »… — the rail's subtitle for this step. */
  protected readonly detail = computed(() => {
    this.translate.currentLang();
    const d = stepDetail(this.candidate());
    return d ? this.translate.instant(d.key, d.params) : null;
  });

  protected readonly avatar        = computed(() => candidateAvatar(this.candidate()));
  protected readonly initials      = computed(() => this.candidate().initials || candidateInitials(this.candidate().fullName));
  protected readonly fitClass      = computed(() => fitScoreClass(this.candidate().fitScore));
  /**
   * Every post of the demand is filled (V137): days left before this candidature is archived,
   * null while a post is open. The offer actions go away with it — the server refuses them.
   */
  protected readonly archiveDays   = computed(() => archiveDaysLeft(this.candidate()));
  protected readonly archiveLabel  = computed(() => {
    this.translate.currentLang();
    const days = this.archiveDays();
    if (days === null) return null;
    return days === 0
      ? this.translate.instant('PIPELINE.CARD.ARCHIVE_TODAY')
      : this.translate.instant('PIPELINE.CARD.ARCHIVE_IN', { days });
  });
  protected readonly archiveTooltip = computed(() => {
    this.translate.currentLang();
    const due = this.candidate().archiveDueDate;
    return due ? this.translate.instant('PIPELINE.CARD.ARCHIVE_TOOLTIP', { date: due.split('-').reverse().join('/') }) : '';
  });
  protected readonly offerPending  = computed(() => isOfferPending(this.candidate()) && this.archiveDays() === null);
  protected readonly offerSendable = computed(() => canSendOffer(this.candidate()) && this.archiveDays() === null);

  /** "Type · 12 juil. · 14:00" in the UI language; falls back to the server's French label. */
  protected readonly nextEventLabel = computed(() => {
    const c = this.candidate();
    const lang = this.translate.currentLang();
    const when = interviewDateText(c.nextInterviewAt, lang === 'en' ? 'en-GB' : 'fr-FR');
    if (!when) return c.nextEvent ?? '';
    const type = c.nextInterviewType ? interviewTypeLabel(c.nextInterviewType, c.nextInterviewTypeEn, lang) : '';
    return type ? `${type} · ${when}` : when;
  });
}
