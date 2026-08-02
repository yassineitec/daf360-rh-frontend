import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EntityCardComponent, EntityCardOptions, SkeletonComponent } from '@khalilrebhiitec/daf360';

import { OffboardingWorkflowInstance } from '../models/offboarding.model';
import {
  cardStatus, hasTasks, initialsOf, isOverdue, localeDate, progressPct,
} from '../offboarding-display';

/** One card's options plus the workflow id its click needs. */
interface OffboardingCard {
  id: number;
  options: EntityCardOptions;
}

/**
 * Card view of `/rh/offboarding`, on the library's `daf-entity-card` (§6). The
 * page had no card view at all before — only a table — so this is new surface
 * rather than a rebuild.
 *
 * `daf-entity-card` carries **one status slot and no danger badge**, so the two
 * alarm signals this domain has are encoded the way the other RH lists encode
 * theirs: `slaBreachFlag` turns the avatar tile red and lands in the SLA metric,
 * and a merely-overdue next task shows as a warning value in that same metric.
 */
@Component({
  selector: 'rh-offboarding-cards-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EntityCardComponent, SkeletonComponent],
  host: { class: 'block' },
  template: `
    @if (loading()) {
      <div class="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 xl:grid-cols-3">
        @for (i of [0, 1, 2, 3, 4, 5]; track i) {
          <daf-skeleton variant="block" radius="xl" width="100%" height="208px" />
        }
      </div>
    } @else {
      <div class="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 xl:grid-cols-3">
        @for (card of cards(); track card.id) {
          <daf-entity-card
            [options]="card.options"
            (cardClick)="open.emit(card.id)"
            (viewClick)="open.emit(card.id)" />
        } @empty {
          <div class="col-span-full flex flex-col items-center gap-2 py-16 text-center text-outline">
            <span class="material-symbols-outlined text-[40px] opacity-30">inbox</span>
            <p class="text-[13px]">{{ emptyMessage() }}</p>
          </div>
        }
      </div>
    }
  `,
})
export class OffboardingCardsSectionComponent {
  private translate = inject(TranslateService);

  readonly items        = input.required<OffboardingWorkflowInstance[]>();
  readonly loading      = input(false);
  readonly emptyMessage = input('');

  readonly open = output<number>();

  protected readonly cards = computed<OffboardingCard[]>(() => {
    // Read the language inside the computed so the cards re-translate on change (§6).
    this.translate.currentLang();
    const t = (k: string, p?: object) => this.translate.instant(k, p);
    const locale = this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR';

    return this.items().map(item => {
      const late = item.slaBreachFlag;
      const overdue = !late && isOverdue(item);
      return {
        id: item.id,
        options: {
          variant: 'glass',
          clickable: true,
          image: {
            initials: initialsOf(item.employeeFullName),
            // Complete literal classes — a runtime-assembled one is never emitted (§3).
            badgeBg: late ? 'bg-danger' : 'bg-gradient-to-br from-primary to-secondary',
          },
          metadata: {
            title:       item.employeeFullName ?? t('OFFBOARDING.LIST.PROFILE_PREFIX', { id: item.employeeProfileId }),
            subtitle:    t('OFFBOARDING.REASON.' + item.departureReason),
            status:      cardStatus(item.status),
            statusLabel: t('OFFBOARDING.STATUS.' + item.status),
          },
          metricsColumns: 2,
          metrics: [
            { label: t('OFFBOARDING.LIST.COL_TRIGGER'),  value: localeDate(item.triggerDate, locale) },
            { label: t('OFFBOARDING.LIST.COL_LAST_DAY'), value: localeDate(item.lastWorkingDay, locale) },
            {
              label: t('OFFBOARDING.LIST.COL_PROGRESS'),
              value: hasTasks(item) ? `${progressPct(item)}%` : '—',
            },
            {
              label: t('OFFBOARDING.LIST.COL_SLA'),
              value: late    ? t('OFFBOARDING.BADGE.SLA_BREACHED')
                   : overdue ? t('OFFBOARDING.BADGE.OVERDUE')
                             : '—',
            },
          ],
          // The card appends its own arrow, so the label carries none (§6).
          viewLabel: t('OFFBOARDING.LIST.OPEN'),
        } satisfies EntityCardOptions,
      };
    });
  });
}
