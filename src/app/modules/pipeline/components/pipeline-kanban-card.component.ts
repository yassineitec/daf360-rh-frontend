import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { KanbanCardShellComponent } from '../../../shared/kanban-card-shell.component';
import { KanbanCandidate } from '../services/pipeline.service';
import { BoardStageKey, canSendOffer, isOfferPending } from '../board.model';
import { badgeVariant, candidateAvatar, candidateInitials, fitScoreClass } from '../pipeline-display';

/**
 * One pipeline candidate card — the single implementation used by BOTH the
 * desktop board and the mobile stage list. The two used to be one 120-line block
 * inlined in `pipeline.component.html` that mobile simply could not render
 * (85vw columns in a horizontal scroller).
 *
 * Purely presentational: it owns no state beyond "this avatar 404'd", does no
 * navigation and never calls a service. Every action leaves as an output with
 * the original DOM event, so the page keeps deciding what a click means.
 *
 * The footer is stage-driven — Préqualification shows contact, Entretien the
 * next interview, Offre the salary bracket + the offer actions, Recruté the
 * contract — which is why `stage` is an input rather than derived from the
 * candidate: the board owns the grouping (a pending candidate with a planned
 * interview is shown under Entretien, not under its own status).
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

      <!-- Badge (backend-supplied) + fit score -->
      <div class="flex items-center justify-between gap-2 mb-3">
        <daf-badge [label]="candidate().badge" [options]="{ variant: badge(), size: 'sm' }" />
        @if (candidate().fitScore != null) {
          <span class="text-sm font-bold shrink-0" [class]="fitClass()">
            {{ 'PIPELINE.FIT_SCORE' | translate:{ score: candidate().fitScore } }}
          </span>
        }
      </div>

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
          </div>
        </div>
        @if (showChevron()) {
          <span class="material-symbols-outlined text-outline shrink-0">chevron_right</span>
        }
      </div>

      <!-- Préqualification: skill chips -->
      @if (stage() === 'SCREENING' && candidate().skills.length) {
        <div class="flex flex-wrap gap-1.5 mb-3">
          @for (skill of candidate().skills.slice(0, 3); track skill) {
            <span class="bg-surface-container-low text-on-surface-variant text-[10px] px-2 py-0.5 rounded">
              {{ skill }}
            </span>
          }
        </div>
      }

      <!-- Offre: signature / preparation state -->
      @if (stage() === 'OFFRE') {
        <div class="bg-surface-container-low p-2 rounded-lg mb-3 text-xs">
          <p class="text-on-surface-variant italic">
            @if (offerPending()) {
              {{ 'PIPELINE.CARD.PENDING_SIGNATURE' | translate }}@if (candidate().offerExpiry) {
                {{ 'PIPELINE.CARD.EXPIRES' | translate:{ date: candidate().offerExpiry } }}
              }
            } @else if (candidate().offerStatus === 'ACCEPTED') {
              {{ 'PIPELINE.CARD.OFFER_ACCEPTED' | translate }}
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

          @case ('SCREENING') {
            <span class="flex items-center gap-1 min-w-0 max-w-[55%]">
              <span class="material-symbols-outlined text-[14px] shrink-0">mail</span>
              <span class="truncate">{{ candidate().email || '—' }}</span>
            </span>
            <span class="flex items-center gap-1 min-w-0 shrink-0">
              <span class="material-symbols-outlined text-[14px] shrink-0">location_on</span>
              <span class="truncate">{{ candidate().location || '—' }}</span>
            </span>
          }

          @case ('ENTRETIEN') {
            <span class="flex items-center gap-1 min-w-0">
              <span class="material-symbols-outlined text-[14px] shrink-0">calendar_month</span>
              <span class="truncate">
                {{ candidate().nextEvent || ('PIPELINE.CARD.INTERVIEW_TO_SCHEDULE' | translate) }}
              </span>
            </span>
            <div class="flex items-center gap-2 shrink-0 min-w-0">
              @if (candidate().interviewLocation) {
                <span class="flex items-center gap-1 min-w-0">
                  <span class="material-symbols-outlined text-[14px] shrink-0">location_on</span>
                  <span class="truncate max-w-[90px]">{{ candidate().interviewLocation }}</span>
                </span>
              }
              @if (offerSendable()) {
                <button type="button" [title]="'PIPELINE.CARD.SEND_OFFER_TITLE' | translate"
                  class="shrink-0 p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container
                         hover:text-on-surface transition-colors"
                  (click)="sendOffer.emit($event)">
                  <span class="material-symbols-outlined text-[18px]">send</span>
                </button>
              }
            </div>
          }

          @case ('OFFRE') {
            <span class="flex items-center gap-1 min-w-0">
              <span class="material-symbols-outlined text-[14px] shrink-0">payments</span>
              <span class="truncate">{{ candidate().askedSalary || '—' }} ~ {{ candidate().proposedSalary || '—' }}</span>
            </span>
            @if (offerPending()) {
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
            } @else if (candidate().offerStatus === 'ACCEPTED') {
              <span class="shrink-0 text-outline">{{ 'PIPELINE.CARD.OFFER_ACCEPTED_SHORT' | translate }}</span>
            }
          }

          @case ('RECRUTE') {
            <span class="flex items-center gap-1 min-w-0 max-w-[55%]">
              <span class="material-symbols-outlined text-[14px] shrink-0">badge</span>
              <span class="truncate">{{ candidate().contractType || '—' }}</span>
            </span>
            <span class="flex items-center gap-1 min-w-0 shrink-0">
              <span class="material-symbols-outlined text-[14px] shrink-0">login</span>
              <span class="truncate">{{ candidate().location || '—' }}</span>
            </span>
          }
        }
      </div>
    </rh-kanban-card-shell>
  `,
})
export class PipelineKanbanCardComponent {
  readonly candidate = input.required<KanbanCandidate>();
  /** Board stage this card is rendered under — drives the footer and the extras. */
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

  protected readonly badge         = computed(() => badgeVariant(this.candidate().badgeType));
  protected readonly avatar        = computed(() => candidateAvatar(this.candidate()));
  protected readonly initials      = computed(() => this.candidate().initials || candidateInitials(this.candidate().fullName));
  protected readonly fitClass      = computed(() => fitScoreClass(this.candidate().fitScore));
  protected readonly offerPending  = computed(() => isOfferPending(this.candidate()));
  protected readonly offerSendable = computed(() => canSendOffer(this.candidate()));
}
