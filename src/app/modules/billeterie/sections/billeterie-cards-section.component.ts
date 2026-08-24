import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
  EntityCardAction, EntityCardComponent, EntityCardOptions, SkeletonComponent,
} from '@khalilrebhiitec/daf360';
import { TranslateService } from '@ngx-translate/core';

import { Mission } from '../../missions/mission.model';
import {
  cardBadgeBg, cardStatus, daysUntil, destination, formatAmount, initialsOf, isLate,
  localeDate, localeOf,
} from '../../missions/mission-display';

/** What RH can do to a mission from the queue. */
export type BilleterieAction = 'view' | 'price' | 'validate' | 'reject';

/**
 * Card view of the billeterie queue — `daf-entity-card` per pending mission, the same
 * grid and the same mapping rules as `rh-missions-cards-section` and
 * `app-approval-cards-section` on the finance side.
 *
 * `clickable: false`, unlike the missions list: every affordance here is a decision, so a
 * whole-card click would be ambiguous about which one it means. Opening the detail is the
 * explicit `view` action.
 *
 * Stateless: missions in, `(act)` out — the page owns every call and every dialog.
 */
@Component({
  selector: 'rh-billeterie-cards-section',
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
            (actionClick)="act.emit({ mission: card.mission, action: $any($event.id) })" />
        } @empty {
          <div class="col-span-full flex flex-col items-center gap-2 rounded-xl
                      border border-dashed border-outline-variant/50 px-6 py-14
                      text-center text-on-surface-variant">
            <span class="material-symbols-outlined text-[40px] text-outline-variant">pending_actions</span>
            <p class="text-body-md">{{ emptyMessage() }}</p>
          </div>
        }
      </div>
    }
  `,
})
export class BilleterieCardsSectionComponent {
  private translate = inject(TranslateService);

  readonly items         = input.required<Mission[]>();
  readonly loading       = input(false);
  readonly emptyMessage  = input('');
  readonly skeletonCount = input(6);

  readonly act = output<{ mission: Mission; action: BilleterieAction }>();

  protected readonly skeletonSlots = computed(() =>
    Array.from({ length: Math.max(1, this.skeletonCount()) }, (_, i) => i));

  /** Dates and amounts follow the UI language, not a hard-wired fr-FR. */
  private readonly locale = computed(() => localeOf(this.translate.currentLang()));

  protected readonly cards = computed(() => {
    this.translate.currentLang();
    const t = (k: string, p?: object) => this.translate.instant(k, p);
    const loc = this.locale();

    return this.items().map(m => ({
      id: m.id,
      mission: m,
      options: {
        variant: 'glass',
        clickable: false,
        image: {
          initials: initialsOf(m.employeeName),
          badgeBg: cardBadgeBg(m),
        },
        metadata: {
          title: m.employeeName ?? t('MISSIONS.LIST.EMPLOYEE_UNKNOWN'),
          subtitle: m.title,
          status: cardStatus(m.status),
          // Not the status label here but the pricing state: on this queue every row is
          // PENDING_HR, so repeating it in every card would say nothing.
          statusLabel: m.expenses ? t('BILLETERIE.PRICED') : t('BILLETERIE.NOT_PRICED'),
        },
        metricsColumns: 2,
        metrics: [
          { label: t('MISSIONS.LIST.COL_DESTINATION'), value: destination(m) },
          { label: t('MISSIONS.CARD.PERIOD'),
            value: `${localeDate(m.startDate, loc)} → ${localeDate(m.endDate, loc)}` },
          isLate(m)
            ? { label: t('MISSIONS.CARD.LATE'),
                value: t('MISSIONS.CARD.LATE_DAYS', { days: Math.abs(daysUntil(m.startDate)) }) }
            : { label: t('MISSIONS.CARD.DEPARTURE'),
                value: t('MISSIONS.CARD.IN_DAYS', { days: daysUntil(m.startDate) }) },
          { label: t('BILLETERIE.COL_TOTAL'),
            value: m.expenses
              ? formatAmount(m.expenses.totalEstimatedCost, m.expenses.currency, loc)
              : '—' },
        ],
        actions: this.actionsFor(m, t),
      } satisfies EntityCardOptions,
    }));
  });

  /**
   * Validating is offered only once the sheet exists: RH cannot hand finance a mission
   * with no cost, which is what `MISSION_EXPENSES_MISSING` refuses server-side. The card
   * has no disabled-action state, so the action is absent rather than inert.
   */
  private actionsFor(m: Mission, t: (k: string) => string): EntityCardAction[] {
    const actions: EntityCardAction[] = [
      { id: 'view',  icon: 'visibility',  tooltip: t('MISSIONS.LIST.VIEW') },
      { id: 'price', icon: 'receipt_long', tooltip: t('BILLETERIE.PRICE') },
    ];
    if (m.expenses) {
      actions.push({ id: 'validate', icon: 'check_circle', tooltip: t('BILLETERIE.VALIDATE') });
    }
    actions.push({ id: 'reject', icon: 'block', tooltip: t('BILLETERIE.REJECT'), variant: 'danger' });
    return actions;
  }
}
