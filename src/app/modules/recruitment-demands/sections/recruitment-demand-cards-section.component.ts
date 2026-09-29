import { ChangeDetectionStrategy, Component, computed, inject, input, LOCALE_ID, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { EntityCardAction, EntityCardComponent, EntityCardOptions, SkeletonComponent } from '@khalilrebhiitec/daf360';

import { RecruitmentDemandStatus, RecruitmentDemandSummary } from '../recruitment-demand.model';
import { initialsOf } from '../../it-provisioning/it-provisioning-display';

export type RecruitmentDemandAction = 'view' | 'approve' | 'reject';

/** Still EN_ATTENTE after a week — the same "> 7 jours" rule as the validation KPI row. */
export function isStaleDemand(d: RecruitmentDemandSummary): boolean {
  return d.statut === 'EN_ATTENTE' && (Date.now() - new Date(d.submittedAt).getTime()) / 86400000 > 7;
}

/** `daf-entity-card` has three status looks: green, warning, grey. */
const CARD_STATUS: Record<RecruitmentDemandStatus, 'active' | 'pending' | 'inactive'> = {
  EN_ATTENTE: 'pending',
  APPROUVEE:  'active',
  CLOTUREE:   'active',
  REJETEE:    'inactive',
  ANNULEE:    'inactive',
};

/**
 * Card view of a recruitment-demand list, on `daf-entity-card` — same recipe as
 * `rh-it-provisioning-cards-section`. Used by the validation queue on /rh/requests
 * (`decisions` on: approve / reject) and the historique on /rh/requests-history (view only).
 *
 * No person to show on a demand, so the initials come from the poste; a demand waiting
 * for more than 7 days turns that tile red — the card's only urgency cue.
 */
@Component({
  selector: 'app-recruitment-demand-cards-section',
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
            (cardClick)="action.emit({ action: 'view', demand: card.demand })"
            (viewClick)="action.emit({ action: 'view', demand: card.demand })"
            (actionClick)="onAction($event.id, card.demand)" />
        } @empty {
          <div class="col-span-full flex flex-col items-center gap-2 py-16 text-center text-outline">
            <span class="material-symbols-outlined text-[40px] opacity-30">{{ emptyIcon() }}</span>
            <p class="m-0 text-[14px] font-semibold text-on-surface">{{ emptyMessage() }}</p>
          </div>
        }
      </div>
    }
  `,
})
export class RecruitmentDemandCardsSectionComponent {
  private translate = inject(TranslateService);
  private date = new DatePipe(inject(LOCALE_ID));

  readonly items = input.required<RecruitmentDemandSummary[]>();
  readonly loading = input(false);
  /** Approve / reject actions — the validation queue only. */
  readonly decisions = input(false);
  readonly emptyIcon = input('task_alt');
  readonly emptyMessage = input('');

  readonly action = output<{ action: RecruitmentDemandAction; demand: RecruitmentDemandSummary }>();

  protected readonly cards = computed(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);

    return this.items().map((d) => {
      const poste = d.jobExactTitle ?? d.jobTitle;
      const actions: EntityCardAction[] = this.decisions()
        ? [
            { id: 'approve', icon: 'check_circle', tooltip: t('RECRUITMENT_VALIDATION.APPROVE'), iconColor: 'text-success' },
            { id: 'reject',  icon: 'cancel',       tooltip: t('RECRUITMENT_VALIDATION.REJECT'),  variant: 'danger' },
          ]
        : [];

      return {
        id: d.id,
        demand: d,
        options: {
          variant: 'glass',
          clickable: true,
          image: {
            initials: initialsOf(poste),
            // Complete literal classes — a runtime-assembled one is never emitted.
            badgeBg: isStaleDemand(d) ? 'bg-danger' : 'bg-gradient-to-br from-primary to-secondary',
          },
          metadata: {
            title: poste,
            subtitle: [d.department, d.recruitmentReasonLabel].filter(Boolean).join(' • ') || '—',
            status: CARD_STATUS[d.statut],
            statusLabel: t('RECRUITMENT_DEMANDS.STATUS.' + d.statut),
          },
          metricsColumns: 2,
          metrics: [
            { label: t('RECRUITMENT_DEMANDS.LIST.COL_HEADCOUNT'),  value: String(d.headcount ?? 0) },
            { label: t('RECRUITMENT_DEMANDS.LIST.COL_CANDIDATES'), value: String(d.candidateCount ?? 0) },
            { label: t('RECRUITMENT_DEMANDS.LIST.COL_URGENCY'),    value: d.urgencyLevelLabel ?? '—' },
            { label: t('RECRUITMENT_DEMANDS.LIST.COL_SUBMITTED'),  value: this.date.transform(d.submittedAt, 'dd/MM/yyyy') ?? '—' },
          ],
          actions,
          // The card appends its own arrow, so the label carries none.
          viewLabel: t(this.decisions() ? 'RECRUITMENT_VALIDATION.OPEN' : 'RECRUITMENT_DEMANDS.LIST.VIEW'),
        } satisfies EntityCardOptions,
      };
    });
  });

  protected onAction(id: string, demand: RecruitmentDemandSummary): void {
    if (id === 'approve' || id === 'reject') this.action.emit({ action: id, demand });
  }
}
