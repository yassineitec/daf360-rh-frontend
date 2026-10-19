import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent, DrawerComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { SectionCardComponent } from '../../shared/detail/section-card.component';
import { ProfileFieldComponent } from '../../shared/detail/profile-field.component';
import { TimelineComponent, TimelineItem } from '../../shared/detail/timeline.component';
import { formatAmount, localeDate, localeDateTime, localeOf } from '../missions/mission-display';
import { CdiConversion, CdiDecisionAction } from './cdi-conversion.model';
import { cdiStatusKey, cdiStatusVariant } from './cdi-conversion-display';

export type CdiDrawerAction = CdiDecisionAction | 'CANCEL';

/**
 * One CIVP → CDI request: what was asked, what was retained, who did what (timeline), and
 * the buttons the caller may use — straight from the backend's can* flags, so a button
 * shown is a button the server accepts.
 *
 * NB: never a backtick inside this template literal — it ends the string.
 */
@Component({
  selector: 'rh-cdi-conversion-detail-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DrawerComponent, StatusBadgeComponent, ButtonComponent, SectionCardComponent,
    ProfileFieldComponent, TimelineComponent, RouterLink, TranslatePipe,
  ],
  template: `
    <daf-drawer
      [open]="open()"
      (openChange)="onOpenChange($event)"
      [config]="{
        title: request()?.employeeName ?? ('CDI_CONVERSION.DETAIL.TITLE' | translate),
        icon: 'workspace_premium',
        width: '520px',
        showToggle: false,
        closeLabel: ('CDI_CONVERSION.ACTIONS.CLOSE' | translate)
      }">

      @if (request(); as r) {
        <div class="flex flex-wrap items-center justify-between gap-2">
          <daf-badge [label]="statusKey(r) | translate" [options]="{ variant: statusVariant(r) }" />
          <a [routerLink]="['/rh/profiles', r.employeeProfileId]" [queryParams]="{ tab: 'historique' }"
             class="text-body-sm font-semibold text-teal hover:underline">
            {{ 'CDI_CONVERSION.DETAIL.OPEN_PROFILE' | translate }}
          </a>
        </div>

        @if (r.canDecide || r.canCancel) {
          <div class="flex flex-wrap gap-2">
            @if (r.canDecide) {
              <daf-button [options]="{ variant: 'teal', size: 'sm', iconStart: 'check_circle', label: ('CDI_CONVERSION.ACTIONS.APPROVE' | translate) }"
                (onClick)="act.emit('APPROVE')" />
              <daf-button [options]="{ variant: 'danger', size: 'sm', iconStart: 'cancel', label: ('CDI_CONVERSION.ACTIONS.REJECT' | translate) }"
                (onClick)="act.emit('REJECT')" />
            }
            @if (r.canEscalate) {
              <daf-button [options]="{ variant: 'secondary', size: 'sm', iconStart: 'trending_up', label: ('CDI_CONVERSION.ACTIONS.ESCALATE' | translate) }"
                (onClick)="act.emit('ESCALATE')" />
            }
            @if (r.canCancel) {
              <daf-button [options]="{ variant: 'ghost', size: 'sm', iconStart: 'block', label: ('CDI_CONVERSION.ACTIONS.CANCEL_REQUEST' | translate) }"
                (onClick)="act.emit('CANCEL')" />
            }
          </div>
        }

        @if (r.canConvert) {
          <div class="flex items-center gap-2 rounded-xl bg-info/10 px-4 py-3 text-body-sm text-on-surface">
            <span class="material-symbols-outlined text-[18px] text-info">info</span>
            {{ 'CDI_CONVERSION.DETAIL.TO_CONVERT' | translate }}
          </div>
        }

        <rh-section-card [title]="'CDI_CONVERSION.DETAIL.REQUEST' | translate" icon="assignment">
          <div class="grid grid-cols-1 gap-x-8 gap-y-5 min-[420px]:grid-cols-2">
            @for (row of requestRows(); track row.label) {
              <rh-profile-field [label]="row.label" [value]="row.value" variant="stacked" />
            }
          </div>
          <div class="mt-6">
            <rh-profile-field [label]="'CDI_CONVERSION.FIELDS.JUSTIFICATION' | translate"
                              [value]="r.justification" variant="stacked" />
          </div>
        </rh-section-card>

        @if (decisionRows().length) {
          <rh-section-card [title]="'CDI_CONVERSION.DETAIL.DECISION' | translate" icon="gavel">
            <div class="grid grid-cols-1 gap-x-8 gap-y-5 min-[420px]:grid-cols-2">
              @for (row of decisionRows(); track row.label) {
                <rh-profile-field [label]="row.label" [value]="row.value" variant="stacked" />
              }
            </div>
          </rh-section-card>
        }

        <rh-section-card [title]="'CDI_CONVERSION.DETAIL.HISTORY' | translate" icon="history">
          <rh-timeline [items]="timeline()" />
        </rh-section-card>
      }
    </daf-drawer>
  `,
})
export class CdiConversionDetailDrawerComponent {
  private translate = inject(TranslateService);

  readonly request = input<CdiConversion | null>(null);
  readonly open    = input(false);

  readonly closed = output<void>();
  readonly act    = output<CdiDrawerAction>();

  protected readonly statusKey = cdiStatusKey;
  protected readonly statusVariant = cdiStatusVariant;

  private readonly locale = computed(() => localeOf(this.translate.currentLang()));
  private date = (iso: string | null) => localeDate(iso, this.locale());
  private amount = (v: number | null) => formatAmount(v, null, this.locale());

  protected readonly requestRows = computed(() => {
    this.translate.currentLang();
    const r = this.request();
    if (!r) return [];
    const t = (k: string) => this.translate.instant(k);
    return [
      { label: t('CDI_CONVERSION.FIELDS.REQUESTED_BY'), value: r.requestedByName ?? '—' },
      { label: t('CDI_CONVERSION.FIELDS.REQUESTED_AT'), value: localeDateTime(r.requestedAt, this.locale()) },
      { label: t('CDI_CONVERSION.FIELDS.START_DATE'), value: this.date(r.requestedStartDate) },
      { label: t('CDI_CONVERSION.FIELDS.PROPOSED_SALARY'), value: this.amount(r.proposedNetSalary) },
      { label: t('CDI_CONVERSION.FIELDS.CIVP_PERIOD'),
        value: this.date(r.contractStartDate) + (r.contractEndDate ? ' → ' + this.date(r.contractEndDate) : '') },
    ];
  });

  protected readonly decisionRows = computed(() => {
    this.translate.currentLang();
    const r = this.request();
    if (!r || !r.decidedAt) return [];
    const t = (k: string) => this.translate.instant(k);
    const rows = [
      { label: t('CDI_CONVERSION.FIELDS.DECIDED_BY'), value: r.decidedByName ?? '—' },
      { label: t('CDI_CONVERSION.FIELDS.DECIDED_AT'), value: localeDateTime(r.decidedAt, this.locale()) },
    ];
    if (r.status === 'APPROVED') {
      rows.push(
        { label: t('CDI_CONVERSION.FIELDS.VALIDATED_START'), value: this.date(r.validatedStartDate) },
        { label: t('CDI_CONVERSION.FIELDS.VALIDATED_SALARY'), value: this.amount(r.validatedNetSalary) },
      );
    }
    if (r.convertedAt) {
      rows.push({ label: t('CDI_CONVERSION.FIELDS.CONVERTED_AT'), value: localeDateTime(r.convertedAt, this.locale()) });
    }
    return rows;
  });

  protected readonly timeline = computed<TimelineItem[]>(() => {
    this.translate.currentLang();
    const r = this.request();
    if (!r) return [];
    const t = (k: string) => this.translate.instant(k);
    const items: TimelineItem[] = r.steps.map(s => {
      const extra: string[] = [];
      if (s.netSalary != null && s.action !== 'CONVERT') extra.push(this.amount(s.netSalary));
      if (s.startDate) extra.push(this.date(s.startDate));
      if (s.comment) extra.push(s.comment);
      return {
        title: t('CDI_CONVERSION.STEP.' + s.action),
        meta: [s.actorName ?? '—', ...extra].join(' · '),
        date: localeDateTime(s.createdAt, this.locale()),
        state: 'done' as const,
      };
    });
    // What is still expected, as the last, pending milestone.
    const next = r.status === 'SUBMITTED' ? 'CDI_CONVERSION.NEXT.VALIDATION'
      : r.status === 'ESCALATED' ? 'CDI_CONVERSION.NEXT.ARBITRATION'
      : r.status === 'APPROVED' && r.convertedContractId == null ? 'CDI_CONVERSION.NEXT.CONVERSION'
      : null;
    if (next) items.push({ title: t(next), state: 'pending', icon: 'hourglass_top' });
    return items;
  });

  protected onOpenChange(open: boolean): void {
    if (!open) this.closed.emit();
  }
}
