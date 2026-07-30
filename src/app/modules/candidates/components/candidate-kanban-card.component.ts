import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@khalilrebhiitec/daf360';

import { KanbanCardShellComponent } from '../../../shared/kanban-card-shell.component';
import { CandidateListItem } from '../candidate.model';
import { candidateAvatar, candidateInitials, fitScoreClass, interviewDateText } from '../candidate-display';

/**
 * One candidate card — the single implementation used by BOTH the desktop
 * kanban board and the mobile stage list. Before this component the two
 * templates were copy-pasted and had already drifted (the mobile one hardcoded
 * "ans exp." and "Lieu à définir" in French, and never showed the grade tag).
 *
 * Purely presentational: it owns no state, does no navigation and never calls a
 * service. Drag is native HTML5 — the host carries `draggable` and re-emits
 * `dragstart`/`dragend` so the board keeps owning the drag process.
 */
@Component({
  selector: 'rh-candidate-kanban-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KanbanCardShellComponent, ButtonComponent, TranslatePipe],
  template: `
    <rh-kanban-card-shell
      [surface]="'white'"
      [dragging]="dragging()"
      [class.opacity-40]="dragging()"
      [attr.draggable]="draggable() ? 'true' : null"
      (dragstart)="dragStart.emit()"
      (dragend)="dragEnd.emit()"
      (click)="open.emit()">

      <!-- Status badge (stage colour) + fit score -->
      <div class="flex items-center justify-between gap-2 mb-3">
        <span class="text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider"
              [style.background]="badgeBg()" [style.color]="accent()">
          {{ statusLabel() }}
        </span>
        @if (candidate().fitScore != null) {
          <span class="text-sm font-bold shrink-0" [class]="fitClass()">
            {{ candidate().fitScore }}{{ 'CANDIDATES.KANBAN.FIT_SUFFIX' | translate }}
          </span>
        }
      </div>

      <!-- Identity -->
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-3 min-w-0">
          @if (avatar(); as src) {
            <img [src]="src" [alt]="fullName()"
                 class="w-12 h-12 rounded-lg object-cover border border-outline-variant shrink-0" />
          } @else {
            <div class="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                 [style.background]="accent()">
              {{ initials() }}
            </div>
          }
          <div class="min-w-0">
            <h4 class="font-bold text-on-surface truncate">{{ fullName() }}</h4>
            <p class="text-xs text-outline truncate">{{ candidate().appliedPosition ?? '—' }}</p>
          </div>
        </div>
        @if (showChevron() && !showQuickActions()) {
          <span class="material-symbols-outlined text-outline shrink-0">chevron_right</span>
        }
      </div>

      <!-- Tags -->
      @if (candidate().experienceYears != null || candidate().contractType || candidate().appliedGrade) {
        <div class="flex flex-wrap gap-1.5 mb-1">
          @if (candidate().experienceYears != null) {
            <span class="bg-surface-container-low text-on-surface-variant text-[10px] px-2 py-0.5 rounded">
              {{ 'CANDIDATES.KANBAN.YEARS_EXP' | translate:{ years: candidate().experienceYears } }}
            </span>
          }
          @if (candidate().contractType) {
            <span class="bg-surface-container-low text-on-surface-variant text-[10px] px-2 py-0.5 rounded">
              {{ candidate().contractType }}
            </span>
          }
          @if (candidate().appliedGrade) {
            <span class="bg-surface-container-low text-on-surface-variant text-[10px] px-2 py-0.5 rounded">
              {{ candidate().appliedGrade }}
            </span>
          }
        </div>
      }

      <!-- Footer: next planned interview -->
      <div class="flex items-center gap-2 pt-3 mt-3 border-t border-outline-variant text-outline text-[11px]">
        @if (candidate().nextInterviewAt) {
          <span class="flex items-center gap-1 shrink-0">
            <span class="material-symbols-outlined text-[14px]">event</span>
            {{ interviewText() }}
          </span>
          <span class="flex items-center gap-1 ml-auto shrink-0 min-w-0"
                [class.italic]="!candidate().nextInterviewLocation"
                [class.opacity-70]="!candidate().nextInterviewLocation">
            <span class="material-symbols-outlined text-[14px]">location_on</span>
            <span class="truncate">
              {{ candidate().nextInterviewLocation || ('CANDIDATES.KANBAN.LOCATION_TBD' | translate) }}
            </span>
          </span>
        } @else {
          <span class="flex items-center gap-1 italic opacity-70">
            <span class="material-symbols-outlined text-[14px]">event_busy</span>
            {{ 'CANDIDATES.KANBAN.NO_INTERVIEW' | translate }}
          </span>
        }
      </div>

      <!-- Accept / reject, PENDING candidates only -->
      @if (showQuickActions()) {
        <div class="flex items-center gap-2 mt-3 pt-3 border-t border-outline-variant"
             (click)="$event.stopPropagation()">
          <daf-button
            class="flex-1"
            [label]="'CANDIDATES.ACTIONS.ACCEPT' | translate"
            variant="ghost"
            [options]="{ iconStart: 'check_circle', size: 'sm', loading: actioning() }"
            (onClick)="accept.emit($event)" />
          <daf-button
            class="flex-1"
            [label]="'CANDIDATES.ACTIONS.REJECT' | translate"
            variant="danger"
            [options]="{ iconStart: 'cancel', size: 'sm' }"
            (onClick)="reject.emit($event)" />
        </div>
      }
    </rh-kanban-card-shell>
  `,
})
export class CandidateKanbanCardComponent {
  private translate = inject(TranslateService);

  readonly candidate   = input.required<CandidateListItem>();
  /** Solid stage colour — avatar fallback background and badge text. */
  readonly accent      = input<string>('#64748b');
  /** Tinted stage colour behind the status badge. */
  readonly badgeBg     = input<string>('rgba(100,116,139,0.12)');
  /** Translated status label (the page owns i18n; the card only renders). */
  readonly statusLabel = input<string>('');

  readonly draggable        = input(false);
  readonly dragging         = input(false);
  readonly showChevron      = input(false);
  readonly showQuickActions = input(false);
  readonly actioning        = input(false);

  readonly open      = output<void>();
  readonly dragStart = output<void>();
  readonly dragEnd   = output<void>();
  readonly accept    = output<Event>();
  readonly reject    = output<Event>();

  readonly fullName  = computed(() => `${this.candidate().firstName} ${this.candidate().lastName}`);
  readonly initials  = computed(() => candidateInitials(this.candidate().firstName, this.candidate().lastName));
  readonly avatar    = computed(() => candidateAvatar(this.candidate().gender));
  readonly fitClass  = computed(() => fitScoreClass(this.candidate().fitScore));
  readonly interviewText = computed(() =>
    interviewDateText(this.candidate().nextInterviewAt, this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR'),
  );
}
