import { ChangeDetectionStrategy, Component, HostListener, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonComponent } from '@khalilrebhiitec/daf360';

import { PipelineActivity, PipelineObjective } from '../../pipeline/services/pipeline.service';

/**
 * Icon + colour per audit action for the activity feed.
 *
 * Every class here is a **lib token** (UI-PLAYBOOK §4). The previous map used
 * `bg-teal-100` / `text-teal-700` — names rh-frontend only sets in `:root`, so
 * they resolve against Tailwind's default palette (or, for `teal-100`, the grey
 * the `:root` override points at) and never the brand colour — plus a mix of
 * `green-100` / `red-100` / `amber-100` / `blue-100` / `orange-100`, which are
 * off-palette even when they do render.
 */
const ACTIVITY_META: Record<string, { icon: string; bg: string; color: string }> = {
  ACCEPT:                   { icon: 'verified',      bg: 'bg-tertiary/10',      color: 'text-teal'              },
  HIRE_CANDIDATE:           { icon: 'check_circle',  bg: 'bg-success/10',       color: 'text-success'           },
  REJECT:                   { icon: 'person_remove', bg: 'bg-danger/10',        color: 'text-danger'            },
  SEND_OFFER:               { icon: 'send',          bg: 'bg-warning/10',       color: 'text-warning'           },
  ACCEPT_OFFER:             { icon: 'handshake',     bg: 'bg-success/10',       color: 'text-success'           },
  REJECT_OFFER:             { icon: 'thumb_down',    bg: 'bg-danger/10',        color: 'text-danger'            },
  RENEGOTIATE_OFFER:        { icon: 'sync',          bg: 'bg-warning/10',       color: 'text-warning'           },
  CREATE:                   { icon: 'person_add',    bg: 'bg-primary/10',       color: 'text-primary'           },
  UPDATE:                   { icon: 'edit',          bg: 'bg-surface-container', color: 'text-on-surface-variant' },
  UPLOAD_CV:                { icon: 'upload_file',   bg: 'bg-tertiary/10',      color: 'text-teal'              },
  COMPLETE_IT_PROVISIONING: { icon: 'terminal',      bg: 'bg-tertiary/10',      color: 'text-teal'              },
};

const FALLBACK_META = { icon: 'info', bg: 'bg-surface-container', color: 'text-outline' };

/** Panel width; mirrored in the toggle's `right` offset so the two move together. */
const PANEL_WIDTH = 'min(380px, 88vw)';

/**
 * Right-edge insights drawer for /rh/recrutement — "Activités Récentes" and
 * "Objectifs du Mois", which used to sit in a two-column grid at the bottom of
 * the page where they competed with the kanban board for attention.
 *
 * Three fixed layers, each with its own stacking level:
 *   - backdrop `z-60` — blurs the page behind it, click-to-close;
 *   - panel `z-70` — slides in on `translate-x`, so it animates in *and* out
 *     (an `@if` would unmount it and the closing animation would never play);
 *   - toggle `z-71` — vertically centred on the right edge, icon-only, and its
 *     `right` offset animates with the panel so it always sits on the drawer's
 *     leading edge.
 *
 * It stays below `app-modal`'s `z-1000` overlay on purpose: an offer/reject
 * dialog opened from a card must still cover the drawer.
 */
@Component({
  selector: 'rh-recruitment-insights-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent, TranslatePipe],
  template: `
    <!-- ── Backdrop: kept mounted so the blur fades both ways ── -->
    <div
      class="fixed inset-0 z-[60] bg-on-surface/25 backdrop-blur-[3px] transition-opacity duration-300"
      [class]="open() ? 'opacity-100' : 'opacity-0 pointer-events-none'"
      aria-hidden="true"
      (click)="close()"></div>

    <!-- ── Toggle: vertically centred on the right edge, icon only ── -->
    <button type="button"
      class="fixed top-1/2 -translate-y-1/2 z-[71] flex items-center justify-center
             w-9 h-16 rounded-l-xl bg-primary text-white shadow-lg
             transition-[right,background-color] duration-300 ease-out
             hover:bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary"
      [style.right]="open() ? panelWidth : '0px'"
      [attr.aria-expanded]="open()"
      aria-controls="recruitment-insights"
      [title]="(open() ? 'CANDIDATES.INSIGHTS.HIDE' : 'CANDIDATES.INSIGHTS.SHOW') | translate"
      (click)="toggle()">
      <span class="material-symbols-outlined text-[22px]">{{ open() ? 'chevron_right' : 'chevron_left' }}</span>
    </button>

    <!-- ── Panel ── -->
    <aside
      id="recruitment-insights"
      role="dialog"
      [attr.aria-hidden]="!open()"
      [attr.aria-label]="'CANDIDATES.INSIGHTS.TITLE' | translate"
      class="fixed top-0 right-0 z-[70] h-full w-[380px] max-w-[88vw]
             flex flex-col bg-surface-container-lowest border-l border-outline-variant
             shadow-[0_0_40px_rgba(0,0,0,0.12)]
             transition-transform duration-300 ease-out"
      [class]="open() ? 'translate-x-0' : 'translate-x-full'">

      <header class="flex items-center gap-2 px-5 py-4 border-b border-outline-variant shrink-0">
        <span class="material-symbols-outlined text-[20px] text-primary" style="font-variation-settings:'FILL' 1">insights</span>
        <h2 class="flex-1 text-[15px] font-bold text-on-surface">{{ 'CANDIDATES.INSIGHTS.TITLE' | translate }}</h2>
        <button type="button"
          class="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          [title]="'CANDIDATES.INSIGHTS.HIDE' | translate"
          (click)="close()">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </header>

      <!-- Only the body scrolls: header stays pinned, and min-h-0 is what lets a
           flex child shrink below its content instead of overflowing the panel. -->
      <div class="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-6">

        <!-- ── Activités Récentes ── -->
        <section>
          <div class="flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined text-[18px] text-primary" style="font-variation-settings:'FILL' 1">bolt</span>
            <h3 class="text-[14px] font-bold text-on-surface">{{ 'CANDIDATES.PIPELINE_RH.RECENT_ACTIVITY' | translate }}</h3>
          </div>

          @if (loading()) {
            <div class="flex flex-col gap-3">
              @for (i of [0, 1, 2, 3, 4]; track i) {
                <daf-skeleton variant="block" radius="lg" width="100%" height="44px" />
              }
            </div>
          } @else {
            <div class="flex flex-col gap-3">
              @for (activity of activities(); track activity.id) {
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                       [class]="meta(activity.action).bg">
                    <span class="material-symbols-outlined text-[18px]"
                          [class]="meta(activity.action).color">{{ meta(activity.action).icon }}</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[13px] text-on-surface truncate">
                      {{ activity.actionLabel }}
                      @if (activity.candidateName) { — <b>{{ activity.candidateName }}</b> }
                    </p>
                    <p class="text-[11px] text-outline">{{ activity.timestamp }}</p>
                  </div>
                </div>
              } @empty {
                <p class="text-[13px] text-outline text-center py-6">
                  {{ 'CANDIDATES.PIPELINE_RH.NO_RECENT_ACTIVITY' | translate }}
                </p>
              }
            </div>
          }
        </section>

        <!-- ── Objectifs du Mois ── -->
        <section class="rounded-xl p-5 text-white flex flex-col gap-5" style="background-color:#50717B">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]" style="color:#79D7BE;font-variation-settings:'FILL' 1">flag</span>
            <h3 class="text-[14px] font-bold">{{ 'CANDIDATES.PIPELINE_RH.MONTHLY_GOALS' | translate }}</h3>
          </div>
          @if (objective(); as obj) {
            <div>
              <div class="flex justify-between items-baseline text-[13px] mb-2">
                <span style="color:rgba(255,255,255,0.85)">
                  {{ 'CANDIDATES.PIPELINE_RH.RECRUITMENTS_MONTH' | translate:{ month: obj.monthLabel } }}
                </span>
                <span class="text-[20px] font-bold">
                  {{ obj.actual }}<span class="text-[13px] font-normal" style="color:rgba(255,255,255,0.6)">/{{ obj.target }}</span>
                </span>
              </div>
              <div class="w-full bg-white/20 h-2.5 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500"
                     style="background-color:#79D7BE" [style.width.%]="progress()"></div>
              </div>
              <p class="text-[11px] mt-2" style="color:rgba(255,255,255,0.7)">
                @if (obj.target > 0) {
                  {{ 'CANDIDATES.PIPELINE_RH.GOAL_PROGRESS' | translate:{ pct: progress() } }}
                } @else {
                  {{ 'CANDIDATES.PIPELINE_RH.NO_TARGET_SET' | translate }}
                }
              </p>
            </div>
          } @else {
            <p class="text-[13px]" style="color:rgba(255,255,255,0.7)">{{ 'CANDIDATES.PIPELINE_RH.NO_GOAL' | translate }}</p>
          }
        </section>

      </div>
    </aside>
  `,
})
export class RecruitmentInsightsPanelComponent {
  readonly activities = input<PipelineActivity[]>([]);
  readonly objective  = input<PipelineObjective | null>(null);
  readonly progress   = input(0);
  readonly loading    = input(false);

  readonly open = signal(false);

  protected readonly panelWidth = PANEL_WIDTH;

  toggle(): void { this.open.update(v => !v); }
  close():  void { this.open.set(false); }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.close();
  }

  protected meta(action: string): { icon: string; bg: string; color: string } {
    return ACTIVITY_META[action] ?? FALLBACK_META;
  }
}
