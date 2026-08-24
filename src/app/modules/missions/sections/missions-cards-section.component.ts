import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  EntityCardAction, EntityCardComponent, EntityCardOptions, SkeletonComponent,
} from '@khalilrebhiitec/daf360';

import { Mission } from '../mission.model';
import {
  cardBadgeBg, cardStatus, daysUntil, destination, formatAmount, initialsOf, isLate,
  localeDate, localeOf, statusKey,
} from '../mission-display';

/** One card's options plus the mission its actions act on. */
interface MissionCard {
  id: number;
  mission: Mission;
  options: EntityCardOptions;
}

/** What a card can ask the page to do. `cancel` is only offered while RH has not answered. */
export type MissionCardAction = 'view' | 'cancel';

/**
 * Card view of `/rh/missions`, on `daf-entity-card` (UI-PLAYBOOK §6) — the same shape as
 * `rh-it-provisioning-cards-section`, so the two RH list pages read alike.
 *
 * Stateless: missions in, `(open)`/`(act)` out. Options are built in a `computed()` so
 * they are memoised per data change rather than per change-detection cycle, and the labels
 * are translated in one place.
 *
 * Three constraints of the component shaped the mapping:
 * - **One status slot with three looks**, so the six mission statuses collapse onto
 *   active/pending/inactive (`cardStatus`) and the precision lives in `statusLabel`.
 * - **No danger variant**, so a refused mission — or one with an employee ask waiting —
 *   turns its avatar tile red (`cardBadgeBg`), the same cue it-provisioning uses for an
 *   overdue file.
 * - **No content slot**, so the destination and the cost become metrics rather than the
 *   richer two-line block the table can project.
 */
@Component({
  selector: 'rh-missions-cards-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EntityCardComponent, SkeletonComponent],
  host: { class: 'block' },
  template: `
    @if (loading()) {
      <div class="grid grid-cols-1 gap-6 min-[420px]:grid-cols-2 xl:grid-cols-3">
        @for (i of skeletonSlots(); track i) {
          <daf-skeleton variant="block" radius="xl" width="100%" height="232px" />
        }
      </div>
    } @else {
      <div class="grid grid-cols-1 gap-6 min-[420px]:grid-cols-2 xl:grid-cols-3">
        @for (card of cards(); track card.id) {
          <daf-entity-card
            [options]="card.options"
            (cardClick)="open.emit(card.id)"
            (viewClick)="open.emit(card.id)"
            (actionClick)="act.emit({ mission: card.mission, action: $any($event.id) })" />
        } @empty {
          <div class="col-span-full flex flex-col items-center gap-2 rounded-xl
                      border border-dashed border-outline-variant/50 px-6 py-14
                      text-center text-on-surface-variant">
            <span class="material-symbols-outlined text-[40px] text-outline-variant">flight_takeoff</span>
            <p class="text-body-md">{{ emptyMessage() }}</p>
          </div>
        }
      </div>
    }
  `,
})
export class MissionsCardsSectionComponent {
  private translate = inject(TranslateService);

  readonly items        = input.required<Mission[]>();
  readonly loading      = input(false);
  readonly emptyMessage = input('');
  readonly skeletonCount = input(6);
  /** Off on the billeterie queue, where cancelling is not RH's action to take here. */
  readonly allowCancel  = input(true);

  readonly open = output<number>();
  readonly act  = output<{ mission: Mission; action: MissionCardAction }>();

  protected readonly skeletonSlots = computed(() =>
    Array.from({ length: Math.max(1, this.skeletonCount()) }, (_, i) => i));

  /**
   * Dates and amounts follow the UI language. Without it the card printed "14 sept. 2026"
   * next to an English label: the formatters default to fr-FR and nothing passed a locale.
   */
  private readonly locale = computed(() => localeOf(this.translate.currentLang()));

  protected readonly cards = computed<MissionCard[]>(() => {
    // Read inside the computed so the cards re-translate on a language switch (§6).
    this.translate.currentLang();
    const t = (k: string, p?: object) => this.translate.instant(k, p);
    const loc = this.locale();

    return this.items().map(m => ({
      id: m.id,
      mission: m,
      options: {
        variant: 'glass',
        clickable: true,
        image: {
          initials: initialsOf(m.employeeName),
          // Complete literal classes only — a runtime-assembled one is never emitted (§3).
          badgeBg: cardBadgeBg(m),
        },
        metadata: {
          title: m.employeeName ?? t('MISSIONS.LIST.EMPLOYEE_UNKNOWN'),
          // The subject leads the second line: two missions for the same person are told
          // apart by what they are, not by where they go.
          subtitle: m.title,
          status: cardStatus(m.status),
          statusLabel: t(statusKey(m.status)),
        },
        metricsColumns: 2,
        metrics: [
          { label: t('MISSIONS.LIST.COL_DESTINATION'), value: destination(m) },
          { label: t('MISSIONS.CARD.PERIOD'),
            value: `${localeDate(m.startDate, loc)} → ${localeDate(m.endDate, loc)}` },
          // A late mission trades its countdown for the delay, which is the only urgency
          // the card can express beyond the red tile.
          isLate(m)
            ? { label: t('MISSIONS.CARD.LATE'),
                value: t('MISSIONS.CARD.LATE_DAYS', { days: Math.abs(daysUntil(m.startDate)) }) }
            : { label: t('MISSIONS.CARD.DURATION'),
                value: t('MISSIONS.FORM.DURATION', { days: m.durationDays }) },
          { label: t('MISSIONS.CARD.COST'),
            value: m.expenses
              ? formatAmount(m.expenses.totalEstimatedCost, m.expenses.currency, loc)
              : t('BILLETERIE.NOT_PRICED') },
        ],
        actions: this.actionsFor(m, t),
        // The card appends its own arrow, so the label carries none (§6).
        viewLabel: t('MISSIONS.LIST.VIEW'),
      } satisfies EntityCardOptions,
    }));
  });

  /**
   * Cancelling is offered on PENDING_HR only — past that point the money is committed and
   * the route is RH, which is exactly what `MissionService#cancelByManager` enforces.
   */
  private actionsFor(m: Mission, t: (k: string) => string): EntityCardAction[] {
    if (!this.allowCancel() || m.status !== 'PENDING_HR') return [];
    return [{
      id: 'cancel',
      icon: 'cancel',
      tooltip: t('MISSIONS.LIST.CANCEL'),
      variant: 'danger',
    }];
  }
}
