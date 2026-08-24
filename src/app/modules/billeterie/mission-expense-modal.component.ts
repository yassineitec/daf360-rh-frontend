import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, FormFieldComponent, MultiDatePickerComponent, SectionCardComponent,
  SelectComponent,
} from '@khalilrebhiitec/daf360';
import type { SelectOption } from '@khalilrebhiitec/daf360';

import { ModalComponent } from '../../shared/modal.component';
import { dateToIso, isoToDate } from '../../shared/date-picker.utils';
import {
  Mission, MissionExpense, MissionExpensePayload, MissionPaymentMethod,
  MissionTransportMode, PAYMENT_METHODS, TRANSPORT_MODES,
} from '../missions/mission.model';
import {
  destination, estimatedTotal, formatAmount, localeDate, localeOf,
} from '../missions/mission-display';

/** The currencies the group actually pays its missions in. */
const CURRENCIES = ['TND', 'EUR', 'USD', 'EGP'];

/** Matches the DEFAULT on mission_expenses.currency (V78), so the two cannot drift. */
const DEFAULT_CURRENCY = 'TND';

/**
 * The billeterie sheet — RH prices a mission.
 *
 * Saving and validating are two distinct acts, and this modal only does the first: RH fills
 * the sheet over several sittings (the agency answers on Monday, the hotel on Wednesday),
 * and validating hands the file to finance for good. So the footer saves; the queue's own
 * "Valider" button is what moves the mission on.
 *
 * The total shown at the bottom is computed locally with the SAME rule the server applies
 * (`estimatedTotal` mirrors `MissionExpense#recomputeTotal`) — the advance excluded, being
 * a share of the total, not an extra cost. The server's figure always wins on reload.
 */
@Component({
  selector: 'rh-mission-expense-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalComponent, ButtonComponent, FormFieldComponent, MultiDatePickerComponent,
    SectionCardComponent, SelectComponent, TranslatePipe,
  ],
  template: `
    <app-modal
      [title]="'MISSIONS.EXPENSES.TITLE' | translate"
      [visible]="visible()"
      [hasFooter]="true"
      (closed)="closed.emit()">

      <!-- One rhythm for the whole body: the context block, the error banner and the
           sections are siblings in a single gap-5 column, instead of each carrying its own
           mb-*. That is the same reasoning daf-page applies to a page (§1). -->
      <div class="flex flex-col gap-5">

        @if (mission(); as m) {
          <!-- What is being priced, restated: RH opens this from a queue and the row is
               behind the modal. -->
          <div class="flex flex-col gap-0.5 rounded-xl bg-surface-container-low px-4 py-3">
            <span class="text-body-md font-semibold text-on-surface">{{ m.title }}</span>
            <span class="text-body-sm text-on-surface-variant">
              {{ m.employeeName }} · {{ destination(m) }} ·
              {{ localeDate(m.startDate) }} → {{ localeDate(m.endDate) }}
              ({{ 'MISSIONS.FORM.DURATION' | translate:{ days: m.durationDays } }})
            </span>
          </div>
        }

        <!-- House error banner — same markup on every page and dialog (§1). -->
        @if (error()) {
          <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            <span class="material-symbols-outlined text-[18px]">error</span>
            {{ error() }}
          </div>
        }

        <daf-select
          [options]="currencyOptions()"
          [config]="{
            label: ('MISSIONS.EXPENSES.CURRENCY' | translate),
            placeholder: ('MISSIONS.COMMON.SELECT' | translate), required: true
          }"
          [selected]="[form().currency ?? DEFAULT_CURRENCY]"
          (selectedChange)="onCurrencyChange($event)" />

        <!-- ── Frais de mission ───────────────────────────────── -->
        <daf-section-card
          [title]="'MISSIONS.EXPENSES.SECTION_ALLOWANCE' | translate"
          [hint]="'MISSIONS.EXPENSES.SECTION_ALLOWANCE_HINT' | translate">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <daf-form-field
              [value]="form().allowanceDailyRate"
              [options]="amountOpts('MISSIONS.EXPENSES.DAILY_RATE')"
              (valueChange)="patch({ allowanceDailyRate: asNumber($event) })" />
            <daf-form-field
              [value]="form().missionAllowance"
              [options]="amountOpts('MISSIONS.EXPENSES.ALLOWANCE')"
              (valueChange)="patch({ missionAllowance: asNumber($event) })" />
          </div>
          <!-- Offered, never applied silently: the per-diem rule differs per country, and
               overwriting a figure RH typed would be worse than a button they can ignore. -->
          @if (suggestedAllowance() !== null) {
            <daf-button class="mt-2"
              [options]="{
                variant: 'ghost', size: 'sm', iconStart: 'calculate',
                label: ('MISSIONS.EXPENSES.APPLY_SUGGESTION' | translate:{
                  amount: formatAmount(suggestedAllowance(), form().currency)
                })
              }"
              (onClick)="patch({ missionAllowance: suggestedAllowance() })" />
          }
        </daf-section-card>

        <!-- ── Logement ───────────────────────────────────────── -->
        <daf-section-card [title]="'MISSIONS.EXPENSES.SECTION_LODGING' | translate">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <daf-form-field
              [value]="form().lodgingCost"
              [options]="amountOpts('MISSIONS.EXPENSES.LODGING')"
              (valueChange)="patch({ lodgingCost: asNumber($event) })" />
            <daf-form-field
              [value]="form().nights"
              [options]="{
                type: 'number', fullWidth: true, align: 'end',
                label: ('MISSIONS.EXPENSES.NIGHTS' | translate)
              }"
              (valueChange)="patch({ nights: asNumber($event) })" />
            <daf-form-field
              [value]="form().hotelName"
              [options]="{
                fullWidth: true, maxLength: 255,
                label: ('MISSIONS.EXPENSES.HOTEL' | translate)
              }"
              (valueChange)="patch({ hotelName: asText($event) })" />
            <daf-form-field
              [value]="form().reservationNumber"
              [options]="{
                fullWidth: true, maxLength: 100, prefixIcon: 'confirmation_number',
                label: ('MISSIONS.EXPENSES.RESERVATION' | translate)
              }"
              (valueChange)="patch({ reservationNumber: asText($event) })" />
          </div>
        </daf-section-card>

        <!-- ── Transport ──────────────────────────────────────── -->
        <daf-section-card [title]="'MISSIONS.EXPENSES.SECTION_TRANSPORT' | translate">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <daf-select
              [options]="transportOptions()"
              [config]="{
                label: ('MISSIONS.EXPENSES.TRANSPORT_MODE' | translate),
                placeholder: ('MISSIONS.COMMON.SELECT' | translate)
              }"
              [selected]="form().transportMode ? [form().transportMode!] : []"
              (selectedChange)="onTransportChange($event)" />
            <daf-form-field
              [value]="form().transportCarrier"
              [options]="{
                fullWidth: true, maxLength: 120,
                label: ('MISSIONS.EXPENSES.CARRIER' | translate)
              }"
              (valueChange)="patch({ transportCarrier: asText($event) })" />
            <daf-form-field
              [value]="form().ticketReference"
              [options]="{
                fullWidth: true, maxLength: 100, prefixIcon: 'airplane_ticket',
                label: ('MISSIONS.EXPENSES.TICKET_REF' | translate)
              }"
              (valueChange)="patch({ ticketReference: asText($event) })" />
            <daf-form-field
              [value]="form().ticketCost"
              [options]="amountOpts('MISSIONS.EXPENSES.TICKET_COST')"
              (valueChange)="patch({ ticketCost: asNumber($event) })" />
          </div>

          <!-- The only hours in the process. Date + time, so a 06:00 flight the day before
               the mission's first day is expressible. -->
          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <daf-multi-date-picker
              [value]="outboundDate()"
              [config]="{
                label: ('MISSIONS.EXPENSES.OUTBOUND' | translate),
                placeholder: ('MISSIONS.COMMON.SELECT' | translate), selectionMode: 'single'
              }"
              (valueChange)="patch({ outboundAt: toIsoDateTime($event, form().outboundAt) })" />
            <daf-form-field
              [value]="timeOf(form().outboundAt)"
              [options]="{ type: 'time', fullWidth: true, label: ('MISSIONS.EXPENSES.OUTBOUND_TIME' | translate) }"
              (valueChange)="patch({ outboundAt: withTime(form().outboundAt, $event) })" />
            <daf-multi-date-picker
              [value]="returnDate()"
              [config]="{
                label: ('MISSIONS.EXPENSES.RETURN' | translate),
                placeholder: ('MISSIONS.COMMON.SELECT' | translate), selectionMode: 'single'
              }"
              (valueChange)="patch({ returnAt: toIsoDateTime($event, form().returnAt) })" />
            <daf-form-field
              [value]="timeOf(form().returnAt)"
              [options]="{ type: 'time', fullWidth: true, label: ('MISSIONS.EXPENSES.RETURN_TIME' | translate) }"
              (valueChange)="patch({ returnAt: withTime(form().returnAt, $event) })" />
          </div>
        </daf-section-card>

        <!-- ── Frais annexes ──────────────────────────────────── -->
        <daf-section-card [title]="'MISSIONS.EXPENSES.SECTION_OTHER' | translate">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <!-- Visa only makes sense abroad; hidden rather than disabled, so the sheet of
                 a national mission does not carry a field that can never apply. -->
            @if (isInternational()) {
              <daf-form-field
                [value]="form().visaFees"
                [options]="amountOpts('MISSIONS.EXPENSES.VISA')"
                (valueChange)="patch({ visaFees: asNumber($event) })" />
            }
            <daf-form-field
              [value]="form().insuranceFees"
              [options]="amountOpts('MISSIONS.EXPENSES.INSURANCE')"
              (valueChange)="patch({ insuranceFees: asNumber($event) })" />
            <daf-form-field
              [value]="form().otherFees"
              [options]="amountOpts('MISSIONS.EXPENSES.OTHER')"
              (valueChange)="patch({ otherFees: asNumber($event) })" />
            <daf-form-field
              [value]="form().otherFeesLabel"
              [options]="{
                fullWidth: true, maxLength: 255,
                label: ('MISSIONS.EXPENSES.OTHER_LABEL' | translate)
              }"
              (valueChange)="patch({ otherFeesLabel: asText($event) })" />
          </div>
        </daf-section-card>

        <!-- ── Remise à l'employé ─────────────────────────────── -->
        <daf-section-card
          [title]="'MISSIONS.EXPENSES.SECTION_HANDOVER' | translate"
          [hint]="'MISSIONS.EXPENSES.SECTION_HANDOVER_HINT' | translate">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <daf-form-field
              [value]="form().advanceAmount"
              [options]="amountOpts('MISSIONS.EXPENSES.ADVANCE')"
              (valueChange)="patch({ advanceAmount: asNumber($event) })" />
            <daf-select
              [options]="paymentOptions()"
              [config]="{
                label: ('MISSIONS.EXPENSES.PAYMENT_METHOD' | translate),
                placeholder: ('MISSIONS.COMMON.SELECT' | translate)
              }"
              [selected]="form().paymentMethod ? [form().paymentMethod!] : []"
              (selectedChange)="onPaymentChange($event)" />
            <!-- Two dates and not one: the cash and the papers are almost never picked up
                 on the same day. -->
            <daf-multi-date-picker
              [value]="cashPickup()"
              [config]="{
                label: ('MISSIONS.EXPENSES.CASH_PICKUP' | translate),
                placeholder: ('MISSIONS.COMMON.SELECT' | translate), selectionMode: 'single'
              }"
              (valueChange)="patch({ cashPickupDate: dateToIso($event) || null })" />
            <daf-multi-date-picker
              [value]="docPickup()"
              [config]="{
                label: ('MISSIONS.EXPENSES.DOC_PICKUP' | translate),
                placeholder: ('MISSIONS.COMMON.SELECT' | translate), selectionMode: 'single'
              }"
              (valueChange)="patch({ documentPickupDate: dateToIso($event) || null })" />
          </div>
        </daf-section-card>

        <daf-form-field
          [value]="form().hrNotes"
          [options]="{
            type: 'textarea', rows: 3, fullWidth: true, maxLength: 2000,
            label: ('MISSIONS.EXPENSES.HR_NOTES' | translate),
            placeholder: ('MISSIONS.EXPENSES.HR_NOTES_PLACEHOLDER' | translate)
          }"
          (valueChange)="patch({ hrNotes: asText($event) })" />

        <!-- Same emphasised total row as the detail drawer and the finance queue, so the
             figure looks like the same figure on all three screens. -->
        <div class="flex items-center justify-between gap-4 rounded-xl bg-teal/10 px-4 py-3">
          <span class="text-label-caps text-outline">
            {{ 'MISSIONS.EXPENSES.TOTAL' | translate }}
          </span>
          <span class="text-title-md font-semibold text-teal">
            {{ formatAmount(total(), form().currency) }}
          </span>
        </div>
      </div>

      <div slot="footer">
        <daf-button
          [options]="{ variant: 'secondary', label: ('MISSIONS.COMMON.CANCEL' | translate) }"
          (onClick)="closed.emit()" />
        <daf-button
          [options]="{
            variant: 'teal', iconStart: 'save',
            label: ('MISSIONS.EXPENSES.SAVE' | translate),
            loading: submitting(), disabled: submitting()
          }"
          (onClick)="submit.emit(form())" />
      </div>
    </app-modal>
  `,
})
export class MissionExpenseModalComponent {
  private translate = inject(TranslateService);

  readonly visible    = input(false);
  readonly mission    = input<Mission | null>(null);
  readonly submitting = input(false);
  readonly error      = input<string | null>(null);

  readonly closed = output<void>();
  readonly submit = output<MissionExpensePayload>();

  protected readonly form = signal<MissionExpensePayload>(emptySheet());

  constructor() {
    // Reseed from the mission on every open — RH comes back to the same sheet across
    // sittings, so what the server holds is the starting point, never a blank form.
    effect(() => {
      this.visible();
      const m = this.mission();
      this.form.set(m?.expenses ? fromExpense(m.expenses) : emptySheet());
    });
  }

  private readonly locale = computed(() => localeOf(this.translate.currentLang()));

  /**
   * Bound so the template keeps its short call sites while the locale follows the UI
   * language. The bare helpers default to fr-FR, which printed French dates and number
   * groupings under English labels.
   */
  protected readonly destination = destination;
  protected readonly localeDate = (iso: string | null) => localeDate(iso, this.locale());
  protected readonly formatAmount = (v: number | null | undefined, c: string | null) =>
    formatAmount(v, c, this.locale());
  protected readonly dateToIso = dateToIso;

  protected readonly total = computed(() => estimatedTotal(this.form()));

  protected readonly isInternational = computed(() => this.mission()?.scope === 'INTERNATIONAL');

  /**
   * Day rate × days, offered as a one-click fill. Null when there is no rate to multiply —
   * suggesting zero would be noise.
   */
  protected readonly suggestedAllowance = computed(() => {
    const rate = this.form().allowanceDailyRate;
    const days = this.mission()?.durationDays ?? 0;
    return rate && days ? Number((rate * days).toFixed(3)) : null;
  });

  protected readonly outboundDate = computed(() => isoToDate(this.form().outboundAt));
  protected readonly returnDate   = computed(() => isoToDate(this.form().returnAt));
  protected readonly cashPickup   = computed(() => isoToDate(this.form().cashPickupDate));
  protected readonly docPickup    = computed(() => isoToDate(this.form().documentPickupDate));

  protected readonly currencyOptions = computed<SelectOption[]>(() =>
    CURRENCIES.map(c => ({ value: c, label: c })));

  protected readonly transportOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return TRANSPORT_MODES.map(m => ({
      value: m, label: this.translate.instant(`MISSIONS.TRANSPORT.${m}`),
    }));
  });

  protected readonly paymentOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return PAYMENT_METHODS.map(m => ({
      value: m, label: this.translate.instant(`MISSIONS.PAYMENT.${m}`),
    }));
  });

  /** Every amount field is the same field — a right-aligned number carrying the currency. */
  protected amountOpts(labelKey: string) {
    this.translate.currentLang();
    return {
      type: 'number' as const,
      fullWidth: true,
      align: 'end' as const,
      suffixText: this.form().currency ?? DEFAULT_CURRENCY,
      label: this.translate.instant(labelKey),
    };
  }

  protected patch(change: Partial<MissionExpensePayload>): void {
    this.form.update(f => ({ ...f, ...change }));
  }

  protected asText(value: unknown): string | null {
    const text = typeof value === 'string' ? value.trim() : '';
    return text.length ? text : null;
  }

  /** An emptied amount field must clear the value, not send 0 — 0 is a priced zero. */
  protected asNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return isNaN(n) ? null : n;
  }

  // ── Date + time, kept in one ISO string ─────────────────────────────────
  //
  // The travel times are a datetime, but the lib has a date picker and a time field, not a
  // datetime one. So the two controls edit the two halves of the same value, and the hour
  // already chosen survives a change of date (and vice versa).

  protected timeOf(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  protected toIsoDateTime(value: Date | Date[] | null, current: string | null): string | null {
    const dateIso = dateToIso(value);
    if (!dateIso) return null;
    return combine(dateIso, this.timeOf(current) || '00:00');
  }

  protected withTime(current: string | null, time: unknown): string | null {
    const hhmm = typeof time === 'string' ? time : '';
    if (!current) {
      // A time with no date yet is not a moment — ignore it rather than inventing today.
      return null;
    }
    return combine(current.slice(0, 10), hhmm || '00:00');
  }

  protected readonly DEFAULT_CURRENCY = DEFAULT_CURRENCY;

  /** An emptied select must not blank the currency — every amount is quoted in one. */
  protected onCurrencyChange(values: string[]): void {
    this.patch({ currency: values[0] || DEFAULT_CURRENCY });
  }

  // The two selects hand back `string[]`; narrowing to the union belongs in TypeScript,
  // not in a template cast (templates have no `as`).
  protected onTransportChange(values: string[]): void {
    this.patch({ transportMode: (values[0] as MissionTransportMode) ?? null });
  }

  protected onPaymentChange(values: string[]): void {
    this.patch({ paymentMethod: (values[0] as MissionPaymentMethod) ?? null });
  }
}

/**
 * Local date + time as an offset ISO string. Built from a real `Date` so the offset is the
 * browser's own — the backend column is DATETIMEOFFSET and stores what it is given.
 */
function combine(dateIso: string, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = dateIso.split('-').map(Number);
  const dt = new Date(y, mo - 1, d, h || 0, m || 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMin = -dt.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
       + `T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`
       + `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function emptySheet(): MissionExpensePayload {
  return {
    currency: DEFAULT_CURRENCY,
    allowanceDailyRate: null,
    missionAllowance: null,
    lodgingCost: null,
    hotelName: null,
    nights: null,
    reservationNumber: null,
    transportMode: null,
    transportCarrier: null,
    ticketReference: null,
    ticketCost: null,
    outboundAt: null,
    returnAt: null,
    visaFees: null,
    insuranceFees: null,
    otherFees: null,
    otherFeesLabel: null,
    advanceAmount: null,
    paymentMethod: null,
    cashPickupDate: null,
    documentPickupDate: null,
    hrNotes: null,
  };
}

/**
 * Field by field rather than a spread: the server's `MissionExpense` also carries the
 * read-only total and the stamp, and spreading those into the payload would send back a
 * total the server is about to recompute anyway.
 */
function fromExpense(e: MissionExpense): MissionExpensePayload {
  return {
    currency: e.currency ?? DEFAULT_CURRENCY,
    allowanceDailyRate: e.allowanceDailyRate,
    missionAllowance: e.missionAllowance,
    lodgingCost: e.lodgingCost,
    hotelName: e.hotelName,
    nights: e.nights,
    reservationNumber: e.reservationNumber,
    transportMode: e.transportMode,
    transportCarrier: e.transportCarrier,
    ticketReference: e.ticketReference,
    ticketCost: e.ticketCost,
    outboundAt: e.outboundAt,
    returnAt: e.returnAt,
    visaFees: e.visaFees,
    insuranceFees: e.insuranceFees,
    otherFees: e.otherFees,
    otherFeesLabel: e.otherFeesLabel,
    advanceAmount: e.advanceAmount,
    paymentMethod: e.paymentMethod,
    cashPickupDate: e.cashPickupDate,
    documentPickupDate: e.documentPickupDate,
    hrNotes: e.hrNotes,
  };
}
