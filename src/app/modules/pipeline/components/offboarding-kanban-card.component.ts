import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { KanbanCardShellComponent } from '../../../shared/kanban-card-shell.component';
import { OffboardingWorkflowInstance } from '../../offboarding/models/offboarding.model';
import { OFFBOARDING_ACCENT } from '../board.model';
import { candidateInitials } from '../pipeline-display';
import { stageProgressOf } from '../../offboarding/offboarding-display';
import { employeeAvatar } from '../../../shared/utils/avatar.utils';

/**
 * One offboarding file, as shown in the board's read-only Offboarding column, in the
 * dedicated `/rh/offboarding` board and in both mobile lists.
 *
 * Deliberately the SAME anatomy as `rh-candidate-kanban-card`, region for region — tinted
 * status pill + right-aligned signal, then the avatar/name/subtitle identity row, then the
 * grey tag chips, then a bordered footer — so the two boards read as one system. Only the
 * data differs: a stage instead of a fit score, a departure reason instead of a position,
 * a last working day instead of an interview.
 *
 * Purely presentational: no state, no navigation, no service. Offboarding is not
 * drag-and-drop (status is derived from the workflow), so unlike the candidate card there
 * is no drag plumbing here.
 */
@Component({
  selector: 'rh-offboarding-kanban-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KanbanCardShellComponent, TranslatePipe],
  template: `
    <rh-kanban-card-shell
      [surface]="'white'"
      (click)="open.emit()">

      <!-- Stage pill (column colour) + lateness signal — the candidate card's
           "status badge + fit score" row. -->
      <div class="flex items-center justify-between gap-2 mb-3">
        <span class="text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider"
              [style.background]="badgeBg()" [style.color]="accent()">
          {{ stage().titleKey | translate }}
        </span>
        @if (item().slaBreachFlag) {
          <span class="flex items-center gap-1 text-[11px] font-bold text-danger shrink-0">
            <span class="material-symbols-outlined text-[14px]">warning</span>
            {{ 'PIPELINE.OFFBOARDING.SLA' | translate }}
          </span>
        }
      </div>

      <!-- Identity -->
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-3 min-w-0">
          @if (avatar() && !imageFailed()) {
            <img [src]="avatar()!" [alt]="item().employeeFullName ?? ''" (error)="imageFailed.set(true)"
                 class="w-12 h-12 rounded-lg object-cover border border-outline-variant shrink-0" />
          } @else {
            <div class="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                 [style.background]="accent()">
              {{ initials() }}
            </div>
          }
          <div class="min-w-0">
            <h4 class="font-bold text-on-surface truncate">{{ item().employeeFullName || '—' }}</h4>
            <p class="text-xs text-outline truncate">
              {{ 'OFFBOARDING.REASON.' + item().departureReason | translate }}
            </p>
          </div>
        </div>
        @if (showChevron()) {
          <span class="material-symbols-outlined text-outline shrink-0">chevron_right</span>
        }
      </div>

      <!-- Tags: how far along, and the workflow status. -->
      <div class="flex flex-wrap gap-1.5 mb-1">
        <span class="bg-surface-container-low text-on-surface-variant text-[10px] px-2 py-0.5 rounded">
          {{ 'OFFBOARDING.LIST.STEP_OF' | translate:{ step: stage().step, total: stage().total } }}
        </span>
        <span class="bg-surface-container-low text-on-surface-variant text-[10px] px-2 py-0.5 rounded">
          {{ 'OFFBOARDING.STATUS.' + item().status | translate }}
        </span>
        @if (stage().blocked) {
          <span class="bg-danger/10 text-danger text-[10px] px-2 py-0.5 rounded font-semibold">
            {{ 'OFFBOARDING.STATUS.BLOCKED' | translate }}
          </span>
        }
      </div>

      <!-- Footer: last working day + who is taking over. -->
      <div class="flex items-center gap-2 pt-3 mt-3 border-t border-outline-variant text-outline text-[11px]">
        <span class="flex items-center gap-1 shrink-0"
              [class.italic]="!item().lastWorkingDay"
              [class.opacity-70]="!item().lastWorkingDay">
          <span class="material-symbols-outlined text-[14px]">event</span>
          {{ lastDayText() }}
        </span>
        <span class="flex items-center gap-1 ml-auto shrink-0 min-w-0"
              [class.italic]="!item().handoverManagerName"
              [class.opacity-70]="!item().handoverManagerName">
          <span class="material-symbols-outlined text-[14px]">handshake</span>
          <span class="truncate max-w-[120px]">
            {{ item().handoverManagerName || ('OFFBOARDING.LIST.NO_HANDOVER' | translate) }}
          </span>
        </span>
      </div>
    </rh-kanban-card-shell>
  `,
})
export class OffboardingKanbanCardComponent {
  private translate = inject(TranslateService);

  readonly item = input.required<OffboardingWorkflowInstance>();
  /**
   * Solid column colour — avatar fallback background and pill text. Defaults to the
   * neutral slate the recruitment board uses for its read-only Offboarding column.
   */
  readonly accent = input<string>(OFFBOARDING_ACCENT);
  /** Tinted column colour behind the stage pill. */
  readonly badgeBg = input<string>('rgba(100,116,139,0.12)');
  readonly showChevron = input(false);

  readonly open = output<void>();

  /** Set when the photo/avatar URL fails to load, so the initials tile takes over. */
  protected readonly imageFailed = signal(false);

  /** photo → gendered avatar → undefined (initials). One rule, shared app-wide. */
  protected readonly avatar = computed(() =>
    employeeAvatar(this.item().employeeProfileId, this.item().employeePhotoUrl,
                   this.item().employeeGender));

  /**
   * '?' rather than an empty tile when the name is missing — which happens when a profile
   * has neither a linked candidate nor a portal user.
   */
  protected readonly initials = computed(() =>
    candidateInitials(this.item().employeeFullName) || '?');

  /** Which stage the file is waiting on — same resolver as the case page. */
  protected readonly stage = computed(() => stageProgressOf(this.item()));

  protected readonly lastDayText = computed(() => {
    this.translate.currentLang();
    const iso = this.item().lastWorkingDay;
    if (!iso) return this.translate.instant('OFFBOARDING.LIST.NO_LAST_DAY');
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const locale = this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR';
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  });
}
