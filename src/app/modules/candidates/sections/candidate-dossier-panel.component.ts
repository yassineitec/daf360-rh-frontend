import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  DrawerComponent, DrawerConfig, SkeletonComponent, StatusBadgeComponent,
} from '@khalilrebhiitec/daf360';

import { statusBadge } from '../../../shared/status-badge.utils';
import { CandidateHistoryItem, CandidateListItem } from '../candidate.model';
import { formatDate } from '../candidate-display';

/**
 * Icon + colour per audit action for the decision timeline.
 *
 * Every value is a **lib token class** (UI-PLAYBOOK §4). The page used to build
 * this as an inline `[style]` object of raw hexes (`#4648d4`, `#ba1a1a`,
 * `#004941`, `#334155`, `rgba(51,65,85,.1)`) — five palettes that matched no
 * token and could not follow a theme change.
 */
const ACTION_META: Record<string, { icon: string; bg: string; color: string }> = {
  CREATE:                      { icon: 'person_add',  bg: 'bg-primary/10',        color: 'text-primary'            },
  CREATE_CANDIDATE:            { icon: 'person_add',  bg: 'bg-primary/10',        color: 'text-primary'            },
  UPLOAD_CV:                   { icon: 'upload_file', bg: 'bg-tertiary/10',       color: 'text-teal'               },
  UPDATE:                      { icon: 'edit',        bg: 'bg-surface-container', color: 'text-on-surface-variant' },
  UPDATE_CANDIDATE:            { icon: 'edit',        bg: 'bg-surface-container', color: 'text-on-surface-variant' },
  ACCEPT:                      { icon: 'check',       bg: 'bg-success/10',        color: 'text-success'            },
  ACCEPT_CANDIDATE:            { icon: 'check',       bg: 'bg-success/10',        color: 'text-success'            },
  REJECT:                      { icon: 'close',       bg: 'bg-danger/10',         color: 'text-danger'             },
  REJECT_CANDIDATE:            { icon: 'close',       bg: 'bg-danger/10',         color: 'text-danger'             },
  SUBMIT_MS365_EMAIL:          { icon: 'computer',    bg: 'bg-tertiary/10',       color: 'text-teal'               },
  COMPLETE_IT_PROVISIONING:    { icon: 'lan',         bg: 'bg-tertiary/10',       color: 'text-teal'               },
  COMPLETE_ONBOARDING_PROFILE: { icon: 'how_to_reg',  bg: 'bg-primary/10',        color: 'text-primary'            },
};

const FALLBACK_META = { icon: 'history', bg: 'bg-surface-container', color: 'text-outline' };

/** Statuses that mean the MS365 provisioning mail has gone out. */
const EMAIL_SENT_STATUSES = ['ACCEPTED', 'IT_IN_PROGRESS', 'EMAIL_RECEIVED', 'HR_IN_PROGRESS', 'HIRED'];

/**
 * Right-edge drawer for /rh/candidates/list — the decision history of the
 * selected candidate plus the MS365 automation explainer. Both used to sit in a
 * two-column grid *below* the table, so the page was three screens tall and the
 * history block was empty most of the time (it needs a selected row).
 *
 * Content only: `daf-drawer` (4.11.0) owns the backdrop, the sliding panel, the
 * edge tab, focus handling and Escape. `open` is a `model()` so the page can
 * open it from a row click; the tab stays available so the panel is reachable
 * with nothing selected too.
 */
@Component({
  selector: 'rh-candidate-dossier-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerComponent, SkeletonComponent, StatusBadgeComponent, TranslatePipe],
  template: `
    <daf-drawer [(open)]="open" [config]="drawerConfig()">

      <!-- ── Historique des décisions ── -->
      <section>
        <div class="flex items-center gap-2 mb-1">
          <span class="material-symbols-outlined text-[18px] text-primary">history</span>
          <h3 class="text-[14px] font-bold text-on-surface">
            {{ 'CANDIDATES.HISTORY.TITLE' | translate }}
            @if (candidate(); as c) {
              <span class="text-primary"> — {{ c.firstName }} {{ c.lastName }}</span>
            }
          </h3>
        </div>
        <p class="text-[11px] text-outline mb-4">{{ 'CANDIDATES.HISTORY.SUB' | translate }}</p>

        @if (!candidate()) {
          <div class="flex flex-col items-center justify-center py-10 gap-2 text-outline text-center">
            <span class="material-symbols-outlined text-[40px] opacity-30">history</span>
            <p class="text-[13px] text-on-surface">{{ 'CANDIDATES.HISTORY.SELECT_PROMPT' | translate }}</p>
            <p class="text-[11px]">{{ 'CANDIDATES.HISTORY.SELECT_HINT' | translate }}</p>
          </div>
        } @else if (loading()) {
          <div class="flex flex-col gap-3">
            @for (i of [0, 1, 2, 3]; track i) {
              <daf-skeleton variant="block" radius="lg" width="100%" height="64px" />
            }
          </div>
        } @else {
          <div class="relative flex flex-col gap-4 pl-11">
            @for (item of history(); track item.id) {
              <div class="relative">
                <div class="absolute -left-11 top-0.5 w-8 h-8 rounded-full flex items-center justify-center
                            border-2 border-surface shadow-sm"
                     [class]="meta(item.action).bg">
                  <span class="material-symbols-outlined text-[15px]"
                        [class]="meta(item.action).color">{{ meta(item.action).icon }}</span>
                </div>
                <div class="bg-surface-container-low rounded-xl p-3 border border-outline-variant/50">
                  <div class="flex items-start justify-between gap-2 mb-1">
                    <span class="text-[13px] font-semibold text-on-surface">{{ item.actionLabel || item.action }}</span>
                    <span class="text-[11px] text-outline shrink-0 whitespace-nowrap">{{ timestamp(item.timestamp) }}</span>
                  </div>
                  @if (item.performedByName) {
                    <div class="text-[11px] text-outline mb-1">
                      <span class="material-symbols-outlined text-[13px] align-middle">person</span>
                      {{ item.performedByName }}
                    </div>
                  }
                  @if (item.resultingStatus) {
                    <div class="mt-1">
                      <daf-badge [label]="statusLabel()(item.resultingStatus)"
                                 [options]="statusOptions(item.resultingStatus)" />
                    </div>
                  }
                  @if (item.comment) {
                    <p class="text-[11px] text-on-surface mt-2 px-3 py-2 bg-surface rounded-lg
                              border-l-2 border-primary/30 italic">{{ item.comment }}</p>
                  }
                </div>
              </div>
            } @empty {
              <div class="flex flex-col items-center justify-center py-8 gap-2 text-outline -ml-11">
                <span class="material-symbols-outlined text-[32px] opacity-35">event_note</span>
                <span class="text-[13px]">{{ 'CANDIDATES.HISTORY.EMPTY' | translate }}</span>
              </div>
            }
          </div>
        }
      </section>

      <!-- ── Automatisation MS365 ── -->
      <section>
        <div class="flex items-center gap-3 mb-4">
          <span class="bg-primary rounded-xl p-2 flex text-white">
            <span class="material-symbols-outlined text-[18px]">auto_awesome</span>
          </span>
          <div>
            <h3 class="text-[14px] font-bold text-on-surface">{{ 'CANDIDATES.WORKFLOW.TITLE' | translate }}</h3>
            <p class="text-[11px] text-outline">{{ 'CANDIDATES.WORKFLOW.SUB' | translate }}</p>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 p-3 bg-surface-container-low rounded-xl
                    border border-outline-variant/50">
          <div class="flex items-center gap-2 min-w-0">
            <span class="material-symbols-outlined text-[20px] text-teal">task_alt</span>
            <div class="min-w-0">
              <p class="text-[13px] font-semibold text-on-surface truncate">{{ 'CANDIDATES.WORKFLOW.STEP1' | translate }}</p>
              <p class="text-[11px] text-outline truncate">{{ 'CANDIDATES.WORKFLOW.TRIGGER' | translate }}</p>
            </div>
          </div>
          <span class="material-symbols-outlined text-[18px] text-primary shrink-0">arrow_downward</span>
        </div>

        <!-- The generated notification, as it reaches IT -->
        <div class="bg-on-surface rounded-xl p-4 mt-3">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] font-bold uppercase tracking-widest text-outline-variant">
              {{ 'CANDIDATES.WORKFLOW.NOTIF_TITLE' | translate }}
            </span>
            <span class="material-symbols-outlined text-[18px] text-outline-variant">lan</span>
          </div>
          <div class="font-mono text-[11px] leading-relaxed text-surface opacity-90">
            <div>
              <span class="text-outline-variant">{{ 'CANDIDATES.WORKFLOW.EMAIL_SUBJECT_LABEL' | translate }}</span>
              {{ 'CANDIDATES.WORKFLOW.EMAIL_SUBJECT' | translate }}
            </div>
            <div>
              <span class="text-outline-variant">{{ 'CANDIDATES.WORKFLOW.EMAIL_NAME_LABEL' | translate }}</span>
              @if (candidate(); as c) { {{ c.firstName }} {{ c.lastName }} }
              @else { {{ 'CANDIDATES.WORKFLOW.EMAIL_NO_CANDIDATE' | translate }} }
            </div>
            <div>
              <span class="text-outline-variant">{{ 'CANDIDATES.WORKFLOW.EMAIL_POSITION_LABEL' | translate }}</span>
              {{ candidate()?.appliedPosition ?? '—' }}
            </div>
            <div>
              <span class="text-outline-variant">{{ 'CANDIDATES.WORKFLOW.EMAIL_START_LABEL' | translate }}</span>
              {{ startDate() }}
            </div>
            <div class="mt-2 pt-2 border-t border-surface/15 text-[10px]">
              {{ 'CANDIDATES.WORKFLOW.EMAIL_ACTION' | translate }}
            </div>
          </div>
          <div class="mt-3 flex justify-end">
            @if (emailSent()) {
              <span class="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded
                           text-tertiary bg-tertiary/15">{{ 'CANDIDATES.WORKFLOW.SENT' | translate }}</span>
            } @else {
              <span class="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded
                           text-outline-variant bg-surface/10">{{ 'CANDIDATES.WORKFLOW.PENDING' | translate }}</span>
            }
          </div>
        </div>

        <div class="flex gap-2 mt-4 text-outline">
          <span class="material-symbols-outlined text-[16px] shrink-0 mt-0.5">info</span>
          <p class="text-[11px] leading-relaxed">{{ 'CANDIDATES.WORKFLOW.FOOTER' | translate }}</p>
        </div>
      </section>

    </daf-drawer>
  `,
})
export class CandidateDossierPanelComponent {
  private translate = inject(TranslateService);

  /** Two-way so a row click in the page can open the panel. */
  readonly open = model(false);

  readonly candidate = input<CandidateListItem | null>(null);
  readonly history   = input<CandidateHistoryItem[]>([]);
  readonly loading   = input(false);
  /** Status → translated label. The page owns i18n; the panel only renders. */
  readonly statusLabel = input.required<(status: string) => string>();

  readonly drawerConfig = computed<DrawerConfig>(() => {
    this.translate.currentLang();
    return {
      title:      this.translate.instant('CANDIDATES.DOSSIER.TITLE'),
      icon:       'fact_check',
      closeLabel: this.translate.instant('CANDIDATES.DOSSIER.CLOSE'),
      width:      '420px',
      // Drawers in this app are dismissed deliberately, never by a stray click.
      closeOnBackdrop: false,
    };
  });

  protected readonly startDate = computed(() => formatDate(this.candidate()?.expectedStartDate));

  protected readonly emailSent = computed(() =>
    EMAIL_SENT_STATUSES.includes(this.candidate()?.status ?? ''),
  );

  protected meta(action: string): { icon: string; bg: string; color: string } {
    return ACTION_META[action] ?? FALLBACK_META;
  }

  /** Variant comes from the shared status map, so every page badges a status alike. */
  protected statusOptions(status: string) {
    return { ...statusBadge(status).options, size: 'sm' as const, dot: true };
  }

  protected timestamp(ts: string | null): string {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    const locale = this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR';
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
         + ' ' + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
}
