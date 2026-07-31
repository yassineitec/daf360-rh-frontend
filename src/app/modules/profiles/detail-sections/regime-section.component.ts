import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent, SkeletonComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { EmployeeProfile } from '../models/profile.model';
import { ResolvedRegimeDto } from '../../admin/regimes/regime.model';
import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';
import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import { fmtDate } from './field-bridges';

type BadgeVariant = 'teal' | 'secondary' | 'neutral';

/**
 * Régime horaire — the collapsible card at the foot of the Emploi & poste tab,
 * as in `design/profile-detail.html`: three facts across (type d'horaire, jours
 * travaillés, pause déjeuner), closed by default.
 *
 * Below them, the employee's own assignment window — `regime_start_date`,
 * `regime_end_date`, `regime_reason` are columns on `employee_profiles` that the
 * old page never displayed.
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
          <!-- The design's three columns. -->
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
            @if (r.assignmentLevel === 'EMPLOYEE_OVERRIDE') {
              <daf-button variant="ghost"
                [options]="{ label: ('PROFILES.REGIME.REMOVE_OVERRIDE' | translate), iconStart: 'undo', size: 'sm' }"
                (onClick)="removeOverride.emit()" />
            }
          </div>
        } @else {
          <div class="flex items-center gap-2 text-warning">
            <span class="material-symbols-outlined text-[16px]">warning</span>
            <p class="m-0 text-[13px]">{{ 'PROFILES.REGIME.NONE_CONFIGURED' | translate }}</p>
          </div>
        }

        <!-- The employee's own assignment window, straight off the profile. -->
        <div class="mt-6 grid gap-x-6 gap-y-4 border-t border-outline-variant/40 pt-5
                    grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          <rh-profile-field
            [label]="'PROFILES.FIELDS.REGIME_START' | translate" [value]="fmtDate(profile().regimeStartDate)" />
          <rh-profile-field
            [label]="'PROFILES.FIELDS.REGIME_END' | translate" [value]="fmtDate(profile().regimeEndDate)" />
          <rh-profile-field
            [label]="'PROFILES.FIELDS.REGIME_REASON' | translate" [value]="profile().regimeReason" />
        </div>
      }

    </rh-section-card>
  `,
})
export class RegimeSectionComponent {
  private translate = inject(TranslateService);

  readonly profile = input.required<EmployeeProfile>();
  readonly regime  = input<ResolvedRegimeDto | null>(null);
  readonly loading = input(false);

  readonly removeOverride = output<void>();

  protected readonly fmtDate = fmtDate;

  /** "Standard — 40 h/sem." */
  protected readonly scheduleType = computed(() => {
    this.translate.currentLang();
    const r = this.regime();
    if (!r) return null;
    const hours = this.translate.instant('PROFILES.REGIME.HOURS_PER_WEEK', { hours: r.hoursPerWeek });
    return r.regimeLabelFr ? `${r.regimeLabelFr} — ${hours}` : hours;
  });

  /**
   * Day *count* plus the daily window. The regime carries `daysPerWeek`, not the
   * named days the mockup shows ("Lundi - Vendredi"), so this states what the
   * data actually says rather than implying a Mon–Fri week.
   */
  protected readonly workingDays = computed(() => {
    this.translate.currentLang();
    const r = this.regime();
    if (!r) return null;
    const days = this.translate.instant('PROFILES.REGIME.DAYS_COUNT', { days: r.daysPerWeek });
    return r.startTime && r.endTime ? `${days} · ${r.startTime} — ${r.endTime}` : days;
  });

  protected readonly lunchBreak = computed(() => {
    this.translate.currentLang();
    const r = this.regime();
    if (!r?.breakDurationMin) return null;
    const min = this.translate.instant('PROFILES.REGIME.MINUTES', { min: r.breakDurationMin });
    return r.isFlexible
      ? `${min} (${this.translate.instant('PROFILES.REGIME.FLEXIBLE')})`
      : min;
  });

  protected readonly levelLabel = computed(() => {
    switch (this.regime()?.assignmentLevel) {
      case 'EMPLOYEE_OVERRIDE': return 'PROFILES.REGIME.OVERRIDE';
      case 'ROLE_ASSIGNMENT':   return 'PROFILES.REGIME.ROLE_ASSIGNMENT';
      default:                  return 'PROFILES.REGIME.ENTITY_DEFAULT';
    }
  });

  protected readonly levelVariant = computed<BadgeVariant>(() => {
    switch (this.regime()?.assignmentLevel) {
      case 'EMPLOYEE_OVERRIDE': return 'teal';
      case 'ROLE_ASSIGNMENT':   return 'secondary';
      default:                  return 'neutral';
    }
  });
}
