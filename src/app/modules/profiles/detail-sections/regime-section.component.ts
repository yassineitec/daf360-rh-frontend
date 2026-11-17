import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent, SkeletonComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { EmployeeProfile } from '../models/profile.model';
import { EmployeeRegimeAssignment, ResolvedRegimeDto } from '../../admin/regimes/regime.model';
import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';
import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import { fmtDate } from './field-bridges';

type BadgeVariant = 'teal' | 'secondary' | 'neutral' | 'warning';

/**
 * Régime horaire — the collapsible card at the foot of the Emploi & poste tab: three facts
 * across (type d'horaire, jours travaillés, pause déjeuner) and where the regime comes from.
 *
 * Below them, the employee's personal regimes (V127 dated assignments): for RH the full
 * list of current and scheduled ones, each removable; for anyone else the one in force
 * (or next) as the profile response carries it.
 *
 * "Not allowed" and "could not load" are no longer shown as « aucun régime configuré ».
 */
@Component({
  selector: 'rh-regime-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionCardComponent, ProfileFieldComponent, ButtonComponent,
    SkeletonComponent, StatusBadgeComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <rh-section-card
      [title]="'PROFILES.SECTIONS.REGIME' | translate" icon="schedule" [collapsible]="true">

      @if (loading()) {
        <div class="flex flex-col gap-2">
          <daf-skeleton variant="text" width="160px" height="16px" />
          <daf-skeleton variant="text" width="220px" height="13px" />
        </div>
      } @else {

        @if (regime(); as r) {
          <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
            <rh-profile-field
              [label]="'PROFILES.REGIME.SCHEDULE_TYPE' | translate" [value]="scheduleType()" />
            <rh-profile-field
              [label]="'PROFILES.REGIME.WORKING_DAYS' | translate" [value]="workingDays()" />
            <rh-profile-field
              [label]="'PROFILES.REGIME.LUNCH_BREAK' | translate" [value]="lunchBreak()" />
          </div>

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <daf-badge [label]="levelLabel() | translate" [options]="{ variant: levelVariant(), pill: true }" />
            @if (r.effectiveTo) {
              <span class="text-[12px] text-on-surface-variant">
                {{ 'PROFILES.REGIME.UNTIL' | translate:{ date: fmtDate(r.effectiveTo) } }}
              </span>
            }
          </div>
        } @else {
          <div class="flex items-center gap-2 text-warning">
            <span class="material-symbols-outlined text-[16px]">warning</span>
            <p class="m-0 text-[13px]">{{ statusMessage() | translate }}</p>
          </div>
        }

        <div class="mt-6 border-t border-outline-variant/40 pt-5">
          @if (canManage()) {
            <!-- RH: every personal regime in force or scheduled, each removable. -->
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p class="m-0 text-[13px] font-semibold">{{ 'PROFILES.REGIME.PERSONAL_TITLE' | translate }}</p>
              @if (assignments().length > 1) {
                <daf-button variant="ghost"
                  [options]="{ label: ('PROFILES.REGIME.REMOVE_ALL' | translate), iconStart: 'undo', size: 'sm' }"
                  (onClick)="removeOverride.emit()" />
              }
            </div>
            @if (assignments().length === 0) {
              <p class="m-0 text-[13px] text-on-surface-variant">{{ 'PROFILES.REGIME.PERSONAL_NONE' | translate }}</p>
            } @else {
              <ul class="m-0 flex list-none flex-col gap-2 p-0">
                @for (a of assignments(); track a.id) {
                  <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant/40 px-3 py-2">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-[13px] font-medium">{{ assignmentLabel(a) }}</span>
                      <span class="text-[12px] text-on-surface-variant">
                        {{ windowLabel(a) }}
                        @if (a.reason) { · {{ a.reason }} }
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <daf-badge
                        [label]="(a.inForce ? 'PROFILES.REGIME.IN_FORCE' : 'PROFILES.REGIME.SCHEDULED') | translate"
                        [options]="{ variant: a.inForce ? 'teal' : 'secondary', pill: true }" />
                      <daf-button variant="ghost"
                        [options]="{ label: ('PROFILES.REGIME.REMOVE_ONE' | translate), iconStart: 'undo', size: 'sm' }"
                        (onClick)="endAssignment.emit(a.id)" />
                    </div>
                  </li>
                }
              </ul>
            }
          } @else {
            <!-- Read-only: the personal window as the profile response carries it. -->
            <div class="grid gap-x-6 gap-y-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
              <rh-profile-field
                [label]="'PROFILES.FIELDS.REGIME_START' | translate" [value]="fmtDate(profile().regimeStartDate)" />
              <rh-profile-field
                [label]="'PROFILES.FIELDS.REGIME_END' | translate" [value]="fmtDate(profile().regimeEndDate)" />
              <rh-profile-field
                [label]="'PROFILES.FIELDS.REGIME_REASON' | translate" [value]="profile().regimeReason" />
            </div>
          }
        </div>
      }

    </rh-section-card>
  `,
})
export class RegimeSectionComponent {
  private translate = inject(TranslateService);

  readonly profile     = input.required<EmployeeProfile>();
  readonly regime      = input<ResolvedRegimeDto | null>(null);
  readonly loading     = input(false);
  /** ok | none | forbidden | error — what to say when there is no regime to show. */
  readonly status      = input<'ok' | 'none' | 'forbidden' | 'error'>('none');
  readonly assignments = input<EmployeeRegimeAssignment[]>([]);
  readonly canManage   = input(false);

  /** End every current and upcoming personal regime. */
  readonly removeOverride = output<void>();
  /** End / cancel one personal regime (its id). */
  readonly endAssignment  = output<number>();

  protected readonly fmtDate = fmtDate;

  protected readonly statusMessage = computed(() => {
    switch (this.status()) {
      case 'forbidden': return 'PROFILES.REGIME.FORBIDDEN';
      case 'error':     return 'PROFILES.REGIME.LOAD_ERROR';
      default:          return 'PROFILES.REGIME.NONE_CONFIGURED';
    }
  });

  /** "Standard — 40 h/sem." */
  protected readonly scheduleType = computed(() => {
    this.translate.currentLang();
    const r = this.regime();
    if (!r) return null;
    const hours = this.translate.instant('PROFILES.REGIME.HOURS_PER_WEEK', { hours: r.hoursPerWeek });
    const label = this.isEnglish() && r.regimeLabelEn ? r.regimeLabelEn : r.regimeLabelFr;
    return label ? label + ' — ' + hours : hours;
  });

  /**
   * The real working days (the entity's weekend decides them, not days_per_week) plus the
   * daily window. Falls back to the day count when the server sent no labels.
   */
  protected readonly workingDays = computed(() => {
    this.translate.currentLang();
    const r = this.regime();
    if (!r) return null;
    const days = r.joursOuvrables && r.joursOuvrables.length
      ? r.joursOuvrables.join(', ')
      : this.translate.instant('PROFILES.REGIME.DAYS_COUNT', { days: r.daysPerWeek });
    return r.startTime && r.endTime ? days + ' · ' + r.startTime + ' — ' + r.endTime : days;
  });

  protected readonly lunchBreak = computed(() => {
    this.translate.currentLang();
    const r = this.regime();
    if (!r?.breakDurationMin) return null;
    const min = this.translate.instant('PROFILES.REGIME.MINUTES', { min: r.breakDurationMin });
    return r.isFlexible
      ? min + ' (' + this.translate.instant('PROFILES.REGIME.FLEXIBLE') + ')'
      : min;
  });

  protected readonly levelLabel = computed(() => {
    switch (this.regime()?.assignmentLevel) {
      case 'SEASONAL':          return 'PROFILES.REGIME.SEASONAL';
      case 'EMPLOYEE_OVERRIDE': return 'PROFILES.REGIME.OVERRIDE';
      case 'ROLE_ASSIGNMENT':   return 'PROFILES.REGIME.ROLE_ASSIGNMENT';
      default:                  return 'PROFILES.REGIME.ENTITY_DEFAULT';
    }
  });

  protected readonly levelVariant = computed<BadgeVariant>(() => {
    switch (this.regime()?.assignmentLevel) {
      case 'SEASONAL':          return 'warning';
      case 'EMPLOYEE_OVERRIDE': return 'teal';
      case 'ROLE_ASSIGNMENT':   return 'secondary';
      default:                  return 'neutral';
    }
  });

  protected assignmentLabel(a: EmployeeRegimeAssignment): string {
    return this.isEnglish() && a.regimeLabelEn ? a.regimeLabelEn : a.regimeLabelFr;
  }

  protected windowLabel(a: EmployeeRegimeAssignment): string {
    return a.effectiveTo
      ? this.translate.instant('PROFILES.REGIME.WINDOW_BOUNDED', { from: fmtDate(a.effectiveFrom), to: fmtDate(a.effectiveTo) })
      : this.translate.instant('PROFILES.REGIME.WINDOW_OPEN', { from: fmtDate(a.effectiveFrom) });
  }

  private isEnglish(): boolean {
    return (this.translate.currentLang() ?? '').startsWith('en');
  }
}
