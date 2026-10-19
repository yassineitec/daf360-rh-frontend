import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OnboardingFormData, OnboardingProfileDto } from '../onboarding.model';
import { MultiDatePickerComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { adminLabel } from '../../../shared/utils/admin-label.utils';
import { RegimeSummary } from '../onboarding.model';
import { isoToDate, dateToIso } from '../../../shared/date-picker.utils';

@Component({
  selector: 'app-step-regime',
  standalone: true,
  imports: [FormsModule, MultiDatePickerComponent, TranslatePipe],
  templateUrl: './step-regime.component.html',
  styleUrl: './step-regime.component.scss',
})
export class StepRegimeComponent implements OnInit {
  data     = input<OnboardingProfileDto>({});
  formInfo = input<OnboardingFormData | null>(null);

  changed = output<Partial<OnboardingProfileDto>>();

  regimeTemplateId = signal<number | null>(null);
  regimeStartDate  = signal<string>('');

  protected readonly isoToDate = isoToDate;
  protected readonly dateToIso = dateToIso;

  private translate = inject(TranslateService);

  /** rh/admin régime label in the UI language — the radio list and the selection line. */
  regimeLabel(r: RegimeSummary): string {
    return adminLabel(r, this.translate);
  }

  selectedRegimeLabel = computed(() => {
    this.translate.currentLang();
    const regimes = this.formInfo()?.availableRegimes ?? [];
    const r = regimes.find(r => r.id === this.regimeTemplateId());
    return r
      ? `${adminLabel(r, this.translate)} (${this.translate.instant('ONBOARDING.STEP_REGIME.HOURS_PER_WEEK', { hours: r.hoursPerWeek })})`
      : null;
  });

  ngOnInit(): void {
    const d  = this.data();
    const fi = this.formInfo();

    this.regimeTemplateId.set(d.regimeTemplateId ?? fi?.selectedRegimeId ?? null);

    const startDate = d.regimeStartDate ?? fi?.expectedStartDate ?? '';
    this.regimeStartDate.set(startDate ?? '');
  }

  emit(): void {
    this.changed.emit({
      regimeTemplateId: this.regimeTemplateId(),
      regimeStartDate:  this.regimeStartDate() || null,
    });
  }
}
