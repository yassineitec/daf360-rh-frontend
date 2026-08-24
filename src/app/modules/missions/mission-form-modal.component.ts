import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, FormFieldComponent, MultiDatePickerComponent, SelectComponent,
} from '@khalilrebhiitec/daf360';
import type { SelectOption } from '@khalilrebhiitec/daf360';

import { ModalComponent } from '../../shared/modal.component';
import { dateToIso, isoToDate } from '../../shared/date-picker.utils';
import { Mission, MissionEligibleEmployee, MissionPayload, MissionScope } from './mission.model';
import { durationDays } from './mission-display';

/**
 * Plan a mission (manager) — and the very same form RH reopens to adjust one, which is why
 * it takes an optional `mission` to preload instead of being create-only.
 *
 * Owns the **form only**: the page keeps the request, the in-flight flag and the error, so
 * a 409 on an overlapping period leaves everything the user typed on the screen.
 *
 * The employee list comes from the page (`/eligible-employees`) rather than being fetched
 * here — it is the manager's own team, the same list the backend validates against, and
 * the responsable picker reuses it plus the manager themselves.
 */
@Component({
  selector: 'rh-mission-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalComponent, ButtonComponent, FormFieldComponent, MultiDatePickerComponent,
    SelectComponent, TranslatePipe,
  ],
  template: `
    <app-modal
      [title]="(mission() ? 'MISSIONS.FORM.TITLE_EDIT' : 'MISSIONS.FORM.TITLE_NEW') | translate"
      [visible]="visible()"
      [hasFooter]="true"
      (closed)="closed.emit()">

      <!-- One gap-5 column for the whole body — the error banner is a sibling of the
           fields, not a block carrying its own mb-*. -->
      <div class="flex flex-col gap-5">

        <!-- House error banner, identical on every page and dialog (§1). -->
        @if (error()) {
          <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            <span class="material-symbols-outlined text-[18px]">error</span>
            {{ error() }}
          </div>
        }

        <!-- Who. Locked once the mission exists: moving a mission to another person is a
             different mission, and the expense sheet RH may already have priced is tied
             to this one. -->
        <daf-select
          [options]="employeeOptions()"
          [config]="{
            label: ('MISSIONS.FORM.EMPLOYEE' | translate),
            placeholder: ('MISSIONS.FORM.EMPLOYEE_PLACEHOLDER' | translate),
            searchable: true, required: true, disabled: !!mission()
          }"
          [selected]="selectedEmployee()"
          (selectedChange)="onEmployeeChange($event)" />

        <daf-form-field
          [value]="form().title"
          [options]="{
            label: ('MISSIONS.FORM.SUBJECT' | translate),
            placeholder: ('MISSIONS.FORM.SUBJECT_PLACEHOLDER' | translate),
            required: true, maxLength: 255, fullWidth: true
          }"
          (valueChange)="patch({ title: asText($event) ?? '' })" />

        <!-- When. Two single pickers rather than a range: the end date is often decided
             after the start one, and a range picker forces both in one gesture. -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <daf-multi-date-picker
            [value]="startDate()"
            [config]="{
              label: ('MISSIONS.FORM.START_DATE' | translate),
              placeholder: ('MISSIONS.COMMON.SELECT' | translate),
              required: true, selectionMode: 'single'
            }"
            (valueChange)="patch({ startDate: dateToIso($event) })" />
          <daf-multi-date-picker
            [value]="endDate()"
            [config]="{
              label: ('MISSIONS.FORM.END_DATE' | translate),
              placeholder: ('MISSIONS.COMMON.SELECT' | translate),
              required: true, selectionMode: 'single'
            }"
            (valueChange)="patch({ endDate: dateToIso($event) })" />
        </div>

        @if (duration() > 0) {
          <p class="-mt-3 text-body-sm text-on-surface-variant">
            {{ 'MISSIONS.FORM.DURATION' | translate:{ days: duration() } }}
          </p>
        }

        <!-- National / international. Drives whether a destination country is required —
             the backend refuses an international mission without one. -->
        <daf-select
          [options]="scopeOptions()"
          [config]="{
            label: ('MISSIONS.FORM.SCOPE' | translate),
            placeholder: ('MISSIONS.COMMON.SELECT' | translate),
            required: true
          }"
          [selected]="[form().scope]"
          (selectedChange)="onScopeChange($event)" />

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <daf-form-field
            [value]="form().city"
            [options]="{
              label: ('MISSIONS.FORM.CITY' | translate),
              placeholder: ('MISSIONS.FORM.CITY_PLACEHOLDER' | translate),
              required: true, maxLength: 120, fullWidth: true
            }"
            (valueChange)="patch({ city: asText($event) ?? '' })" />
          <!-- Free text and not a pays picker: an international mission usually goes to a
               country where the group has no entity, so a list of our own pays would be
               the wrong list. destinationPaysId stays for the ones that are ours. -->
          <daf-form-field
            [value]="form().countryLabel"
            [options]="{
              label: ('MISSIONS.FORM.COUNTRY' | translate),
              placeholder: ('MISSIONS.FORM.COUNTRY_PLACEHOLDER' | translate),
              required: form().scope === 'INTERNATIONAL', maxLength: 120, fullWidth: true
            }"
            (valueChange)="patch({ countryLabel: asText($event) })" />
        </div>

        <daf-form-field
          [value]="form().address"
          [options]="{
            label: ('MISSIONS.FORM.ADDRESS' | translate),
            placeholder: ('MISSIONS.FORM.ADDRESS_PLACEHOLDER' | translate),
            maxLength: 500, fullWidth: true
          }"
          (valueChange)="patch({ address: asText($event) })" />

        <!-- Responsable: a colleague from the same list, or a free-text external contact.
             One of the two is required, which the footer button enforces. -->
        <daf-select
          [options]="responsableOptions()"
          [config]="{
            label: ('MISSIONS.FORM.RESPONSABLE' | translate),
            placeholder: ('MISSIONS.FORM.RESPONSABLE_PLACEHOLDER' | translate),
            searchable: true
          }"
          [selected]="selectedResponsable()"
          (selectedChange)="patch({ responsableUserId: toId($event) })" />

        @if (!form().responsableUserId) {
          <daf-form-field
            [value]="form().responsableName"
            [options]="{
              label: ('MISSIONS.FORM.RESPONSABLE_EXTERNAL' | translate),
              placeholder: ('MISSIONS.FORM.RESPONSABLE_EXTERNAL_PLACEHOLDER' | translate),
              hint: ('MISSIONS.FORM.RESPONSABLE_HINT' | translate),
              maxLength: 255, fullWidth: true
            }"
            (valueChange)="patch({ responsableName: asText($event) })" />
        }

        <daf-form-field
          [value]="form().details"
          [options]="{
            type: 'textarea', rows: 4, fullWidth: true,
            label: ('MISSIONS.FORM.DETAILS' | translate),
            placeholder: ('MISSIONS.FORM.DETAILS_PLACEHOLDER' | translate)
          }"
          (valueChange)="patch({ details: asText($event) })" />
      </div>

      <div slot="footer">
        <daf-button
          [options]="{ variant: 'secondary', label: ('MISSIONS.COMMON.CANCEL' | translate) }"
          (onClick)="closed.emit()" />
        <daf-button
          [options]="{
            variant: 'teal', iconStart: 'flight_takeoff',
            label: ((mission() ? 'MISSIONS.FORM.SAVE' : 'MISSIONS.FORM.SUBMIT') | translate),
            loading: submitting(), disabled: submitting() || !isComplete()
          }"
          (onClick)="submit.emit(form())" />
      </div>
    </app-modal>
  `,
})
export class MissionFormModalComponent {
  private translate = inject(TranslateService);

  readonly visible    = input(false);
  readonly employees  = input<MissionEligibleEmployee[]>([]);
  /** Set to reopen an existing mission (RH adjustment); null to plan a new one. */
  readonly mission    = input<Mission | null>(null);
  readonly submitting = input(false);
  readonly error      = input<string | null>(null);

  readonly closed = output<void>();
  readonly submit = output<MissionPayload>();

  protected readonly form = signal<MissionPayload>(emptyForm());

  constructor() {
    // Reseed on every open — from the mission when adjusting, empty when planning. A
    // cancelled attempt must never leak into the next one.
    effect(() => {
      this.visible();
      const existing = this.mission();
      this.form.set(existing ? fromMission(existing) : emptyForm());
    });
  }

  protected readonly dateToIso = dateToIso;

  protected readonly startDate = computed(() => isoToDate(this.form().startDate));
  protected readonly endDate   = computed(() => isoToDate(this.form().endDate));

  protected readonly duration = computed(() => {
    const { startDate, endDate } = this.form();
    return startDate && endDate ? durationDays(startDate, endDate) : 0;
  });

  protected readonly employeeOptions = computed<SelectOption[]>(() =>
    this.employees().map(e => ({
      value: String(e.id),
      // The role is what tells two namesakes apart, and it is the axis the team is
      // built on — so it belongs in the option, not in a tooltip.
      label: e.roleName ? `${e.fullName} — ${e.roleName}` : e.fullName,
    })));

  /**
   * The responsable can be anyone on the team. Not filtered to exclude the traveller: a
   * one-person mission where the traveller IS the responsable is legitimate.
   */
  protected readonly responsableOptions = computed<SelectOption[]>(() => this.employeeOptions());

  protected readonly scopeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return (['NATIONAL', 'INTERNATIONAL'] as MissionScope[]).map(s => ({
      value: s,
      label: this.translate.instant(`MISSIONS.SCOPE.${s}`),
    }));
  });

  protected readonly selectedEmployee = computed(() =>
    this.form().employeeUserId ? [String(this.form().employeeUserId)] : []);

  protected readonly selectedResponsable = computed(() =>
    this.form().responsableUserId ? [String(this.form().responsableUserId)] : []);

  /**
   * Mirrors what the backend refuses, so the button never submits a request that comes
   * straight back as a 400: a person, a subject, both dates, a city, a responsable of one
   * kind or the other, and a country when the mission leaves the country.
   */
  protected readonly isComplete = computed(() => {
    const f = this.form();
    const hasResponsable = !!f.responsableUserId || !!f.responsableName?.trim();
    const hasCountry = f.scope !== 'INTERNATIONAL' || !!f.countryLabel?.trim() || !!f.destinationPaysId;
    return !!f.employeeUserId && !!f.title.trim() && !!f.startDate && !!f.endDate
        && !!f.city.trim() && hasResponsable && hasCountry
        && f.endDate >= f.startDate;
  });

  protected patch(change: Partial<MissionPayload>): void {
    this.form.update(f => ({ ...f, ...change }));
  }

  /**
   * Clearing the country when going back to NATIONAL: leaving "France" behind on a mission
   * to Sfax would print a wrong destination everywhere the label is shown.
   */
  protected onScopeChange(values: string[]): void {
    const scope = (values[0] as MissionScope) ?? 'NATIONAL';
    this.patch(scope === 'NATIONAL'
      ? { scope, countryLabel: null, destinationPaysId: null }
      : { scope });
  }

  /**
   * 0 and not null when the selection is cleared: `employeeUserId` is non-nullable on the
   * payload, and 0 is the "nothing chosen" value `isComplete` already rejects.
   */
  protected onEmployeeChange(values: string[]): void {
    this.patch({ employeeUserId: this.toId(values) ?? 0 });
  }

  protected toId(values: string[]): number | null {
    const raw = values[0];
    return raw ? Number(raw) : null;
  }

  protected asText(value: unknown): string | null {
    const text = typeof value === 'string' ? value.trim() : '';
    return text.length ? text : null;
  }
}

function emptyForm(): MissionPayload {
  return {
    employeeUserId: 0,
    responsableUserId: null,
    responsableName: null,
    title: '',
    details: null,
    startDate: '',
    endDate: '',
    scope: 'NATIONAL',
    destinationPaysId: null,
    countryLabel: null,
    city: '',
    address: null,
  };
}

function fromMission(m: Mission): MissionPayload {
  return {
    employeeUserId: m.employeeUserId,
    responsableUserId: m.responsableUserId,
    // Only the free-text contact belongs here: when a colleague is set, the display name
    // is theirs, and copying it into responsableName would create a second, stale spelling.
    responsableName: m.responsableUserId ? null : m.responsableDisplayName,
    title: m.title,
    details: m.details,
    startDate: m.startDate,
    endDate: m.endDate,
    scope: m.scope,
    destinationPaysId: m.destinationPaysId,
    countryLabel: m.countryLabel,
    city: m.city,
    address: m.address,
  };
}
