import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCardComponent, EntityCardOptions, SkeletonComponent } from '@khalilrebhiitec/daf360';

import { OnboardingListItem } from '../onboarding.model';
import { initialsOf, isoDate, lastUpdated } from '../onboarding-display';

/** One card's options plus the candidate id its click needs. */
interface OnboardingCard {
  candidateId: number;
  options: EntityCardOptions;
}

/**
 * Card view of `/rh/onboarding`, on the library's `daf-entity-card`
 * (UI-PLAYBOOK §6). Replaces a hand-built `daf-card` that re-implemented the
 * avatar, two badges, a 2×2 label/value grid and a footer button.
 *
 * The options are built in a `computed()` so they're memoised per data change
 * rather than per change-detection cycle, and the labels are translated in one
 * place (§6).
 *
 * `daf-entity-card` has **one status slot** and no danger/second badge, so the
 * draft flag — which used to be a second `daf-badge` next to the status — is
 * carried by two cues instead: the avatar tile turns `warning`, and the last
 * metric's label switches from "MàJ" to "Brouillon". Same treatment as the
 * overdue file on `/rh/it-provisioning`, so the two pages read alike.
 */
@Component({
  selector: 'rh-onboarding-cards-section',
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
        @for (card of cards(); track card.candidateId) {
          <daf-entity-card
            [options]="card.options"
            (cardClick)="open.emit(card.candidateId)"
            (viewClick)="open.emit(card.candidateId)" />
        } @empty {
          <div class="col-span-full flex flex-col items-center gap-2 py-16 text-center text-outline">
            <span class="material-symbols-outlined text-[40px] opacity-30">assignment_turned_in</span>
            <p class="text-body-lg font-semibold text-on-surface">{{ 'ONBOARDING.LIST.EMPTY_TITLE' | translate }}</p>
            <p class="text-[13px]">{{ 'ONBOARDING.LIST.EMPTY_SUB' | translate }}</p>
          </div>
        }
      </div>
    }
  `,
})
export class OnboardingCardsSectionComponent {
  private translate = inject(TranslateService);

  readonly items   = input.required<OnboardingListItem[]>();
  readonly loading = input(false);

  readonly open = output<number>();

  protected readonly cards = computed<OnboardingCard[]>(() => {
    // Read the language inside the computed so the cards re-translate on change (§6).
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);

    return this.items().map(item => ({
      candidateId: item.candidateId,
      options: {
        variant: 'glass',
        clickable: true,
        image: {
          initials: initialsOf(item.candidateFullName),
          // Complete literal classes — a runtime-assembled one is never emitted (§3).
          badgeBg: item.hasDraft ? 'bg-warning' : 'bg-gradient-to-br from-primary to-secondary',
        },
        metadata: {
          title:    item.candidateFullName,
          subtitle: item.appliedPosition ?? t('ONBOARDING.LIST.POSITION_UNSPECIFIED'),
          status:   'pending',
          // Candidate statuses come from CANDIDATES.STATUS.*, which is translated —
          // the shared `statusBadge` map is hardcoded French and display-only.
          statusLabel: t('CANDIDATES.STATUS.' + item.candidateStatus),
        },
        metricsColumns: 2,
        metrics: [
          { label: t('ONBOARDING.LIST.COL_EMAIL'),     value: item.ms365Email || '—' },
          { label: t('ONBOARDING.LIST.COL_IT_STATUS'), value: t('IT_PROVISIONING.STATUS.' + item.itProvisioningStatus) },
          { label: t('ONBOARDING.LIST.COL_START'),     value: isoDate(item.expectedStartDate) },
          {
            label: item.hasDraft ? t('ONBOARDING.LIST.BADGE_DRAFT') : t('ONBOARDING.LIST.COL_UPDATED'),
            value: lastUpdated(item),
          },
        ],
        // The card appends its own arrow, so the label carries none (§6).
        viewLabel: t('ONBOARDING.LIST.COMPLETE'),
      } satisfies EntityCardOptions,
    }));
  });
}
