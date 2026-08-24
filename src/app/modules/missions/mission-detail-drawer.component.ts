import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DrawerComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { SectionCardComponent } from '../../shared/detail/section-card.component';
import { ProfileFieldComponent } from '../../shared/detail/profile-field.component';
import { TimelineComponent, TimelineItem } from '../../shared/detail/timeline.component';
import { Mission } from './mission.model';
import {
  destination, formatAmount, localeDate, localeDateTime, localeOf, statusKey, statusVariant,
} from './mission-display';

/** One read-only line. Rows with no value are dropped rather than printing a dash. */
interface DetailRow {
  label: string;
  value: string;
}

/**
 * Read-only detail of one mission — the plan, the billeterie sheet, the employee's open
 * ask and the trail of who stamped what.
 *
 * A drawer and not a page: every screen that shows missions is a queue, and a route change
 * would lose the queue's filters, page and scroll position on the way back (§10e).
 *
 * Every panel is an `rh-section-card` and every value an `rh-profile-field`, the same
 * shells `/rh/profiles/:id` and `/rh/candidates/:id` use — never a hand-rolled
 * `rounded-xl border p-3` (§10f). The history is `rh-timeline`, which is what that
 * component is for: events that already happened, not a position in a flow.
 */
@Component({
  selector: 'rh-mission-detail-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DrawerComponent, StatusBadgeComponent, SectionCardComponent, ProfileFieldComponent,
    TimelineComponent, TranslatePipe,
  ],
  template: `
    <daf-drawer
      [open]="open()"
      (openChange)="onOpenChange($event)"
      [config]="{
        title: mission()?.title ?? ('MISSIONS.DETAIL.TITLE' | translate),
        icon: 'flight_takeoff',
        width: '520px',
        showToggle: false,
        closeLabel: ('MISSIONS.COMMON.CLOSE' | translate)
      }">

      <!-- The body is projected straight into daf-drawer's own flex-col gap-6 layout:
           no wrapper and no gap of our own, the sections ARE the children (§10e).
           NB: never a backtick inside this template literal — it ends the string (§10f). -->
      @if (mission(); as m) {

        <!-- Identity line: the status, and the ask flag when one is open. The drawer
             header already carries the title, so this is not a second heading. -->
        <div class="flex flex-wrap items-center gap-2">
          <daf-badge
            [label]="statusKey(m.status) | translate"
            [options]="{ variant: statusVariant(m.status) }" />
          @if (m.pendingChangeRequest) {
            <daf-badge
              [label]="'MISSIONS.LIST.CHANGE_REQUESTED' | translate"
              [options]="{ variant: 'warning', size: 'sm', dot: true }" />
          }
        </div>

        <rh-section-card
          [title]="'MISSIONS.DETAIL.PLAN' | translate"
          icon="event_note">
          <div class="grid grid-cols-1 gap-x-8 gap-y-5 min-[420px]:grid-cols-2">
            @for (row of planRows(); track row.label) {
              <rh-profile-field [label]="row.label" [value]="row.value" variant="stacked" />
            }
          </div>
          <!-- Outside the grid, so no [wide]: that input spans two columns of a stacked
               field grid and means nothing here. -->
          @if (m.details) {
            <div class="mt-6">
              <rh-profile-field
                [label]="'MISSIONS.DETAIL.DETAILS' | translate"
                [value]="m.details"
                variant="stacked" />
            </div>
          }
        </rh-section-card>

        <rh-section-card
          [title]="'MISSIONS.DETAIL.EXPENSES' | translate"
          icon="receipt_long">
          @if (m.expenses) {
            <div class="grid grid-cols-1 gap-x-8 gap-y-5 min-[420px]:grid-cols-2">
              @for (row of expenseRows(); track row.label) {
                <rh-profile-field [label]="row.label" [value]="row.value" variant="stacked" />
              }
            </div>
            <!-- The total is the figure finance decides on, so it gets its own emphasised
                 row rather than sitting as one field among twenty. -->
            <div class="mt-6 flex items-center justify-between gap-4 rounded-xl bg-teal/10 px-4 py-3">
              <span class="text-label-caps text-outline">{{ 'MISSIONS.EXPENSES.TOTAL' | translate }}</span>
              <span class="text-title-md font-semibold text-teal">
                {{ formatAmount(m.expenses.totalEstimatedCost, m.expenses.currency) }}
              </span>
            </div>
            @if (m.expenses.hrNotes) {
              <p class="mt-3 whitespace-pre-line text-body-sm text-on-surface-variant">
                {{ m.expenses.hrNotes }}
              </p>
            }
          } @else {
            <p class="text-body-md text-on-surface-variant">
              {{ 'MISSIONS.DETAIL.NO_EXPENSES' | translate }}
            </p>
          }
        </rh-section-card>

        @if (m.pendingChangeRequest; as req) {
          <!-- accent is a token name, not a class: the lib offers no free-form input
               because a runtime-assembled bg-* compiles to nothing downstream (§3). -->
          <rh-section-card
            [title]="('MISSIONS.CHANGE.TYPE.' + req.requestType) | translate"
            icon="edit_calendar"
            accent="warning">
            <div class="flex flex-col gap-4">
              @if (req.requestedStartDate) {
                <rh-profile-field
                  [label]="'MISSIONS.CHANGE.REQUESTED_PERIOD' | translate"
                  [value]="localeDate(req.requestedStartDate) + ' → ' + localeDate(req.requestedEndDate)"
                  variant="row" />
              }
              <rh-profile-field
                [label]="'BILLETERIE.COL_REASON' | translate"
                [value]="req.reason"
                variant="stacked" />
              <rh-profile-field
                [label]="'MISSIONS.CHANGE.REQUESTED_BY' | translate"
                [value]="(req.requestedByName ?? '—') + ' · ' + localeDate(req.createdAt)"
                variant="row" />
            </div>
          </rh-section-card>
        }

        @if (timeline().length) {
          <rh-section-card
            [title]="'MISSIONS.DETAIL.HISTORY' | translate"
            icon="history">
            <rh-timeline [items]="timeline()" />
          </rh-section-card>
        }
      }
    </daf-drawer>
  `,
})
export class MissionDetailDrawerComponent {
  private translate = inject(TranslateService);

  readonly mission = input<Mission | null>(null);
  readonly open    = input(false);
  readonly closed  = output<void>();

  private readonly locale = computed(() => localeOf(this.translate.currentLang()));

  protected readonly statusKey = statusKey;
  protected readonly statusVariant = statusVariant;

  /**
   * Bound so the template keeps its short call sites while the locale follows the UI
   * language. The bare helpers default to fr-FR, which printed French dates and number
   * groupings under English labels — visible on the finance detail modal.
   */
  protected readonly localeDate = (iso: string | null) => localeDate(iso, this.locale());
  protected readonly localeDateTime = (iso: string | null) => localeDateTime(iso, this.locale());
  protected readonly formatAmount = (v: number | null | undefined, c: string | null) =>
    formatAmount(v, c, this.locale());

  /**
   * `daf-drawer.open` is a two-way model, but the parent owns the selection here (the
   * drawer is open iff a mission is selected), so only the close is forwarded.
   */
  protected onOpenChange(open: boolean): void {
    if (!open) this.closed.emit();
  }

  private t(key: string, params?: object): string {
    this.translate.currentLang();
    return this.translate.instant(key, params);
  }

  protected readonly planRows = computed<DetailRow[]>(() => {
    const m = this.mission();
    if (!m) return [];
    return dropEmpty([
      { label: this.t('MISSIONS.DETAIL.EMPLOYEE'), value: m.employeeName },
      { label: this.t('MISSIONS.DETAIL.ROLE'), value: m.employeeRoleName },
      { label: this.t('MISSIONS.DETAIL.PERIOD'),
        value: `${this.localeDate(m.startDate)} → ${this.localeDate(m.endDate)}` },
      { label: this.t('MISSIONS.DETAIL.DURATION'),
        value: this.t('MISSIONS.FORM.DURATION', { days: m.durationDays }) },
      // Resolved here, not piped in the template: rh-profile-field prints the value raw,
      // and a `| translate` on a city name would render as a missing key.
      { label: this.t('MISSIONS.DETAIL.SCOPE'), value: this.t(`MISSIONS.SCOPE.${m.scope}`) },
      { label: this.t('MISSIONS.DETAIL.DESTINATION'), value: destination(m) },
      { label: this.t('MISSIONS.DETAIL.ADDRESS'), value: m.address },
      { label: this.t('MISSIONS.DETAIL.RESPONSABLE'), value: m.responsableDisplayName },
      { label: this.t('MISSIONS.DETAIL.PLANNED_BY'), value: m.createdByName },
    ]);
  });

  protected readonly expenseRows = computed<DetailRow[]>(() => {
    const e = this.mission()?.expenses;
    if (!e) return [];
    const money = (v: number | null) => (v === null ? null : this.formatAmount(v, e.currency));
    return dropEmpty([
      { label: this.t('MISSIONS.EXPENSES.ALLOWANCE'), value: money(e.missionAllowance) },
      { label: this.t('MISSIONS.EXPENSES.LODGING'), value: money(e.lodgingCost) },
      { label: this.t('MISSIONS.EXPENSES.HOTEL'), value: e.hotelName },
      { label: this.t('MISSIONS.EXPENSES.NIGHTS'), value: e.nights === null ? null : String(e.nights) },
      { label: this.t('MISSIONS.EXPENSES.RESERVATION'), value: e.reservationNumber },
      { label: this.t('MISSIONS.EXPENSES.TRANSPORT_MODE'),
        value: e.transportMode ? this.t(`MISSIONS.TRANSPORT.${e.transportMode}`) : null },
      { label: this.t('MISSIONS.EXPENSES.CARRIER'), value: e.transportCarrier },
      { label: this.t('MISSIONS.EXPENSES.TICKET_REF'), value: e.ticketReference },
      { label: this.t('MISSIONS.EXPENSES.TICKET_COST'), value: money(e.ticketCost) },
      { label: this.t('MISSIONS.EXPENSES.OUTBOUND'),
        value: e.outboundAt ? this.localeDateTime(e.outboundAt) : null },
      { label: this.t('MISSIONS.EXPENSES.RETURN'),
        value: e.returnAt ? this.localeDateTime(e.returnAt) : null },
      { label: this.t('MISSIONS.EXPENSES.VISA'), value: money(e.visaFees) },
      { label: this.t('MISSIONS.EXPENSES.INSURANCE'), value: money(e.insuranceFees) },
      { label: this.t('MISSIONS.EXPENSES.OTHER'), value: money(e.otherFees) },
      { label: this.t('MISSIONS.EXPENSES.ADVANCE'), value: money(e.advanceAmount) },
      { label: this.t('MISSIONS.EXPENSES.PAYMENT_METHOD'),
        value: e.paymentMethod ? this.t(`MISSIONS.PAYMENT.${e.paymentMethod}`) : null },
      { label: this.t('MISSIONS.EXPENSES.CASH_PICKUP'),
        value: e.cashPickupDate ? this.localeDate(e.cashPickupDate) : null },
      { label: this.t('MISSIONS.EXPENSES.DOC_PICKUP'),
        value: e.documentPickupDate ? this.localeDate(e.documentPickupDate) : null },
    ]);
  });

  /**
   * The audit trail as timeline milestones. Every entry is `done` except the last one on a
   * mission still in flight, which is where the file currently sits.
   */
  protected readonly timeline = computed<TimelineItem[]>(() => {
    const m = this.mission();
    const history = m?.history ?? [];
    if (!history.length) return [];
    const lastIndex = history.length - 1;
    const stillMoving = m!.status === 'PENDING_HR' || m!.status === 'PENDING_FINANCE';
    return history.map((entry, i) => ({
      title: this.t(statusKey(entry.toStatus)),
      meta: entry.notes ?? entry.actorName,
      date: `${entry.actorName ?? '—'} · ${this.localeDateTime(entry.createdAt)}`,
      state: i === lastIndex && stillMoving ? 'active' : 'done',
    }));
  });
}

/** An absent value is a line that should not exist, not a line printing a dash. */
function dropEmpty(rows: { label: string; value: string | null | undefined }[]): DetailRow[] {
  return rows
    .filter(r => r.value !== null && r.value !== undefined && r.value !== '')
    .map(r => ({ label: r.label, value: r.value as string }));
}
