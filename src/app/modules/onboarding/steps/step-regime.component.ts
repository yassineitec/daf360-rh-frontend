import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OnboardingFormData, OnboardingProfileDto } from '../onboarding.model';
import { MultiDatePickerComponent } from '@khalilrebhiitec/daf360';
import { isoToDate, dateToIso } from '../../../shared/date-picker.utils';

@Component({
  selector: 'app-step-regime',
  standalone: true,
  imports: [FormsModule, MultiDatePickerComponent],
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

  selectedRegimeLabel = computed(() => {
    const regimes = this.formInfo()?.availableRegimes ?? [];
    const r = regimes.find(r => r.id === this.regimeTemplateId());
    return r ? r.labelFr + ' (' + r.hoursPerWeek + 'h/sem)' : null;
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
