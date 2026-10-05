import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EntityCardAction, EntityCardComponent, EntityCardOptions, SkeletonComponent } from '@khalilrebhiitec/daf360';

import { EmployeeRequest } from './models/request.model';
import { SlaLevel } from '../../shared/sla-countdown.pipe';
import { RelativeDatePipe } from '../../shared/relative-date.pipe';
import { statusBadge } from '../../shared/status-badge.utils';
import { initialsOf } from '../it-provisioning/it-provisioning-display';

/** What one card needs from the page's row view model. */
export interface RequestCardItem {
  id: number;
  ref: string;
  employeeLabel: string;
  type: string;
  categoryLabel: string;
  status: ReturnType<typeof statusBadge>;
  isActive: boolean;
  sla: { level: SlaLevel } | null;
  slaLabel: string;
  slaVariant: 'success' | 'warning' | 'danger' | 'neutral';
  submissionDate: string;
  cancelDisabledReason: string | null;
  source: EmployeeRequest;
}

export type RequestCardAction = 'view' | 'approve' | 'cancel';

/** `REQ-2026-000123` — display-only reference built from the submission year and the id. */
export function requestRef(r: Pick<EmployeeRequest, 'id' | 'submissionDate'>): string {
  const year = r.submissionDate ? new Date(r.submissionDate).getFullYear() : new Date().getFullYear();
  return `REQ-${year}-${String(r.id).padStart(6, '0')}`;
}

/** When a decided request was decided — cancelling never sets `resolutionDate`, `updatedAt` is when it happened. */
export function decisionDate(r: EmployeeRequest): string | null {
  return r.resolutionDate ?? r.updatedAt ?? null;
}

/**
 * Card view of `/rh/requests`, on the library's `daf-entity-card` — the same recipe as
 * `rh-it-provisioning-cards-section`, so the two pages' grids read as one design.
 *
 * Mapping, given the card's fixed slots:
 * - **Status slot**: `pending` (warning) while "en cours", `active` (green) once approved,
 *   `inactive` otherwise; the exact status is in `statusLabel`.
 * - **Urgency**: no danger badge on the card, so an overdue SLA turns the initials tile red
 *   — the same cue IT provisioning uses for a late file.
 * - **Avatar**: initials, not the photo endpoint — the card's `<img>` has no 404 fallback.
 * - **Actions**: approve only for officers on an active request; cancel only when it is
 *   still allowed (the card has no disabled state to carry `cancelDisabledReason`).
 */
@Component({
  selector: 'app-request-cards-section',
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
            (cardClick)="action.emit({ action: 'view', item: card.item })"
            (viewClick)="action.emit({ action: 'view', item: card.item })"
            (actionClick)="onAction($event.id, card.item)" />
        } @empty {
          <div class="col-span-full flex flex-col items-center gap-2 py-16 text-center text-outline">
            <span class="material-symbols-outlined text-[40px] opacity-30">{{ emptyIcon() }}</span>
            <p class="m-0 text-[14px] font-semibold text-on-surface">{{ emptyMessage() }}</p>
            <p class="m-0 text-[12px]">{{ emptyHint() }}</p>
          </div>
        }
      </div>
    }
  `,
})
export class RequestCardsSectionComponent {
  private translate = inject(TranslateService);
  private relativeDate = new RelativeDatePipe();

  readonly items = input.required<RequestCardItem[]>();
  readonly loading = input(false);
  readonly canApprove = input(false);
  readonly emptyIcon = input('task_alt');
  readonly emptyMessage = input('');
  readonly emptyHint = input('');
  /** Historique (/rh/requests-history): decided requests — no cancel action, and the
   *  decision date takes the urgency slot, since a decided request has no SLA left. */
  readonly history = input(false);

  readonly action = output<{ action: RequestCardAction; item: RequestCardItem }>();

  protected readonly cards = computed(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);

    return this.items().map((item) => {
      const s = item.source.status;
      const actions: EntityCardAction[] = [];
      if (this.canApprove() && item.isActive) {
        actions.push({ id: 'approve', icon: 'check_circle', tooltip: t('REQUESTS.DETAIL.APPROVE_BTN'), iconColor: 'text-success' });
      }
      if (!this.history() && !item.cancelDisabledReason) {
        actions.push({ id: 'cancel', icon: 'cancel', tooltip: t('REQUESTS.DETAIL.CANCEL_BTN'), variant: 'danger' });
      }

      return {
        id: item.id,
        item,
        options: {
          variant: 'glass',
          clickable: true,
          image: {
            initials: initialsOf(item.employeeLabel),
            // Complete literal classes — a runtime-assembled one is never emitted.
            badgeBg: item.sla?.level === 'critical' ? 'bg-danger' : 'bg-gradient-to-br from-primary to-secondary',
          },
          metadata: {
            title: item.employeeLabel,
            subtitle: item.type,
            status: s === 'APPROVED' ? 'active' : item.isActive ? 'pending' : 'inactive',
            statusLabel: item.status.label,
          },
          metricsColumns: 2,
          metrics: [
            { label: t('REQUESTS.CARDS.REF_LABEL'), value: item.ref },
            { label: t('REQUESTS.CARDS.CATEGORY_LABEL'), value: item.categoryLabel || '—' },
            { label: t('REQUESTS.LIST.COL_SUBMITTED'), value: this.relativeDate.transform(item.submissionDate) || '—' },
            this.history()
              ? { label: t('REQUESTS.CARDS.DECIDED_LABEL'),
                  value: this.relativeDate.transform(decisionDate(item.source)) || '—' }
              : { label: t('REQUESTS.CARDS.URGENCY_LABEL'), value: item.isActive && item.slaLabel ? item.slaLabel : '—' },
          ],
          actions,
          // The card appends its own arrow, so the label carries none.
          viewLabel: t('REQUESTS.CARDS.VIEW'),
        } satisfies EntityCardOptions,
      };
    });
  });

  protected onAction(id: string, item: RequestCardItem): void {
    if (id === 'approve' || id === 'cancel') this.action.emit({ action: id, item });
  }
}
