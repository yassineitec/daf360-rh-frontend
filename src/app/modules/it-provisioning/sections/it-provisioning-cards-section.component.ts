import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCardComponent, EntityCardOptions, SkeletonComponent } from '@khalilrebhiitec/daf360';

import { ProvisioningListItem } from '../it-provisioning.model';
import { initialsOf, isOverdue, licCount, overdueDays } from '../it-provisioning-display';

/** One card's options plus the id its click needs. */
interface ProvisioningCard {
  id: number;
  options: EntityCardOptions;
}

/**
 * Card view of `/rh/it-provisioning`, on the library's `daf-entity-card`
 * (UI-PLAYBOOK §6). Replaces a hand-built `daf-card` that re-implemented the
 * avatar, the status pill, two hand-rolled progress bars and a footer button.
 *
 * The options are built in a `computed()`, not inline in the template, so they're
 * memoised per data change rather than per change-detection cycle, and the labels
 * are translated in one place (§6).
 *
 * Three constraints of the component shaped this mapping:
 * - **One status slot**, and it only has three looks (`active` green, `pending`
 *   warning, `inactive` grey). So the four provisioning statuses collapse onto two
 *   of them and the precision lives in `statusLabel`.
 * - **No content slot**, so the hardware/licence progress *bars* cannot go inside.
 *   They become `x/6` and `x/5` metrics — §6's "free-text footer info becomes a
 *   metric". The bars are still on the table view, which can project a cell.
 * - **No danger badge.** An overdue file therefore swaps its "Début" metric for a
 *   "Retard" one and turns the avatar tile red, which is the only urgency cue the
 *   card can carry.
 */
@Component({
  selector: 'rh-it-provisioning-cards-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EntityCardComponent, SkeletonComponent, TranslatePipe],
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
            <p class="text-[13px]">{{ 'IT_PROVISIONING.LIST.EMPTY' | translate }}</p>
          </div>
        }
      </div>
    }
  `,
})
export class ItProvisioningCardsSectionComponent {
  private translate = inject(TranslateService);

  readonly items   = input.required<ProvisioningListItem[]>();
  readonly loading = input(false);

  readonly open = output<number>();

  protected readonly cards = computed<ProvisioningCard[]>(() => {
    // Read the language inside the computed so the cards re-translate on change (§6).
    this.translate.currentLang();
    const t = (k: string, p?: object) => this.translate.instant(k, p);

    return this.items().map(item => {
      const late = isOverdue(item);
      return {
        id: item.id,
        options: {
          variant: 'glass',
          clickable: true,
          image: {
            initials: initialsOf(item.candidateFullName),
            // Complete literal classes — a runtime-assembled one is never emitted (§3).
            badgeBg: late ? 'bg-danger' : 'bg-gradient-to-br from-primary to-secondary',
          },
          metadata: {
            title:    item.candidateFullName,
            subtitle: item.appliedPosition ?? t('IT_PROVISIONING.LIST.POSITION_UNSPECIFIED'),
            status:   item.status === 'COMPLETED' ? 'active' : 'pending',
            statusLabel: t('IT_PROVISIONING.STATUS.' + item.status),
          },
          metricsColumns: 2,
          metrics: [
            {
              label: t('IT_PROVISIONING.LIST.EMAIL_LABEL'),
              value: item.ms365Email ?? t('IT_PROVISIONING.LIST.EMAIL_PENDING'),
            },
            late
              ? { label: t('IT_PROVISIONING.LIST.OVERDUE_LABEL'),
                  value: t('IT_PROVISIONING.LIST.OVERDUE_METRIC', { days: overdueDays(item) }) }
              : { label: t('IT_PROVISIONING.LIST.START_LABEL'),
                  value: item.expectedStartDate ?? '—' },
            { label: t('IT_PROVISIONING.LIST.HARDWARE_LABEL'), value: `${item.assetsProvided ?? 0}/6` },
            { label: t('IT_PROVISIONING.LIST.LICENSES_LABEL'), value: `${licCount(item)}/5` },
          ],
          // The card appends its own arrow, so the label carries none (§6).
          viewLabel: t(item.status === 'COMPLETED'
            ? 'IT_PROVISIONING.LIST.VIEW'
            : 'IT_PROVISIONING.LIST.COMPLETE'),
        } satisfies EntityCardOptions,
      };
    });
  });
}
