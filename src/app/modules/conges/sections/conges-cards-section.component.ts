import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  EntityCardAction, EntityCardComponent, EntityCardOptions, SkeletonComponent,
} from '@khalilrebhiitec/daf360';

import { CongeRow } from '../models/conge.model';
import {
  avatarFor, cardBadgeBg, cardStatus, formatDays, initialsOf, localeOf, periodOf, stateKey,
} from '../conge-display';
import { CongeRowAction } from './conges-table-section.component';

/** One card's options plus the request its actions act on. */
interface CongeCard {
  id: number;
  row: CongeRow;
  options: EntityCardOptions;
}

/**
 * Card view of the congé lists, on `daf-entity-card` (UI-PLAYBOOK §6) — the same shape the
 * missions and it-provisioning lists use, so the RH list pages read alike.
 *
 * Stateless: rows in, `(open)` / `(act)` out.
 *
 * Three constraints of the component shaped the mapping, and they are worth stating because
 * they are why this view carries less than the table:
 * - **One status slot with three looks**, so the four states collapse onto
 *   active/pending/inactive (`cardStatus`) and the precision lives in `statusLabel`.
 * - **No danger variant**, so a refused request turns its avatar tile red (`cardBadgeBg`),
 *   the same cue the other RH card lists use.
 * - **No content slot**, so the reason becomes the subtitle rather than a block of its own.
 */
@Component({
  selector: 'rh-conges-cards-section',
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
            (cardClick)="open.emit(card.row)"
            (viewClick)="open.emit(card.row)"
            (actionClick)="act.emit({ row: card.row, action: $any($event.id) })" />
        } @empty {
          <div class="col-span-full flex flex-col items-center gap-2 rounded-xl
                      border border-dashed border-outline-variant/50 px-6 py-14
                      text-center text-on-surface-variant">
            <span class="material-symbols-outlined text-[40px] text-outline-variant">beach_access</span>
            <p class="text-body-md">{{ emptyMessage() }}</p>
          </div>
        }
      </div>
    }
  `,
})
export class CongesCardsSectionComponent {
  private translate = inject(TranslateService);

  readonly items         = input.required<CongeRow[]>();
  readonly loading       = input(false);
  readonly emptyMessage  = input('');
  readonly skeletonCount = input(6);
  readonly allowDecide   = input(false);
  readonly allowArchive  = input(false);
  readonly showFiledBy   = input(false);

  readonly open = output<CongeRow>();
  readonly act  = output<{ row: CongeRow; action: CongeRowAction }>();

  protected readonly skeletonSlots = computed(() =>
    Array.from({ length: Math.max(1, this.skeletonCount()) }, (_, i) => i));

  private readonly locale = computed(() => localeOf(this.translate.currentLang()));

  protected readonly cards = computed<CongeCard[]>(() => {
    // Read inside the computed so the cards re-translate on a language switch (§6).
    this.translate.currentLang();
    const t = (k: string, p?: object) => this.translate.instant(k, p);
    const loc = this.locale();

    return this.items().map((r) => {
      const metrics = [
        { label: t('CONGES.COL.TYPE'), value: r.typeLabel },
        { label: t('CONGES.COL.PERIOD'), value: periodOf(r, loc) },
        { label: t('CONGES.COL.DAYS'), value: formatDays(r.totalJours, loc) },
        this.showFiledBy()
          ? { label: t('CONGES.COL.FILED_BY'), value: r.createdByName ?? '—' }
          : { label: t('CONGES.COL.APPROVER'), value: r.responsableName ?? '—' },
      ];

      return {
        id: r.id,
        row: r,
        options: {
          variant: 'glass',
          clickable: true,
          image: {
            // `avatar` wins over `initials` in daf-entity-card, and the initials remain as
            // the fallback for an employee with no photo.
            avatar: avatarFor(r),
            initials: initialsOf(r.collaborateurName),
            // Complete literal classes only — a runtime-assembled one is never emitted (§3).
            badgeBg: cardBadgeBg(r.etatDemande),
          },
          metadata: {
            title: r.collaborateurName ?? t('CONGES.UNKNOWN'),
            // The reason leads the second line: two congés for the same person are told
            // apart by why they were asked for, not by the dates the metrics already carry.
            subtitle: r.reason ?? '',
            status: cardStatus(r.etatDemande),
            statusLabel: t(stateKey(r.etatDemande)),
          },
          metricsColumns: 2,
          metrics,
          actions: this.actionsFor(r, t),
          // The card appends its own arrow, so the label carries none (§6).
          viewLabel: t('CONGES.VIEW'),
        } satisfies EntityCardOptions,
      };
    });
  });

  /** Deciding is offered on a pending row only — the same test the table and server apply. */
  private actionsFor(r: CongeRow, t: (k: string) => string): EntityCardAction[] {
    const actions: EntityCardAction[] = [];
    if (this.allowDecide() && r.etatDemande === 'EN_ATTENTE') {
      actions.push(
        { id: 'approve', icon: 'check_circle', tooltip: t('CONGES.INBOX.APPROVE') },
        { id: 'refuse', icon: 'cancel', tooltip: t('CONGES.INBOX.REFUSE'), variant: 'danger' },
      );
    }
    if (this.allowArchive() && r.etatDemande !== 'ARCHIVE') {
      actions.push({ id: 'archive', icon: 'archive', tooltip: t('CONGES.ARCHIVE'), variant: 'danger' });
    }
    return actions;
  }
}
