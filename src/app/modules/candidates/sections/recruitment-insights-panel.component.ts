import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DrawerComponent, DrawerConfig, SkeletonComponent } from '@khalilrebhiitec/daf360';

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

/**
 * Right-edge insights drawer for /rh/recrutement — "Activités Récentes" and
 * "Objectifs du Mois", which used to sit in a two-column grid at the bottom of
 * the page where they competed with the kanban board for attention.
 *
 * Content only: `daf-drawer` (4.11.0) owns the backdrop, the sliding panel, the
 * edge toggle tab, focus handling and Escape. This component supplies the two
 * blocks and the translated config, and nothing else — the layered
 * implementation it used to carry is now the lib's.
 *
 * The two sections are direct children of the drawer's body, which is already a
 * `flex flex-col gap-6`, so they must not add a wrapper or a gap of their own.
 */
@Component({
  selector: 'rh-recruitment-insights-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerComponent, SkeletonComponent, TranslatePipe],
  template: `
    <daf-drawer [config]="drawerConfig()">

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

    </daf-drawer>
  `,
})
export class RecruitmentInsightsPanelComponent {
  private translate = inject(TranslateService);

  readonly activities = input<PipelineActivity[]>([]);
  readonly objective  = input<PipelineObjective | null>(null);
  readonly progress   = input(0);
  readonly loading    = input(false);

  /**
   * `closeLabel` names the header close button *and* the toggle tab in both
   * states — the lib deliberately exposes one label, so it has to read sensibly
   * whichever way the tab is pointing.
   */
  readonly drawerConfig = computed<DrawerConfig>(() => {
    this.translate.currentLang();
    return {
      title:      this.translate.instant('CANDIDATES.INSIGHTS.TITLE'),
      icon:       'insights',
      closeLabel: this.translate.instant('CANDIDATES.INSIGHTS.CLOSE'),
      // Drawers in this app are dismissed deliberately, never by a stray click on
      // the page behind them. 4.12.0 pulses the ✕ so the way out stays obvious.
      closeOnBackdrop: false,
    };
  });

  protected meta(action: string): { icon: string; bg: string; color: string } {
    return ACTIVITY_META[action] ?? FALLBACK_META;
  }
}
