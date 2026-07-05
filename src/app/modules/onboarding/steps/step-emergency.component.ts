import { Component, OnInit, input, output, signal } from '@angular/core';
import { OnboardingProfileDto, OnboardingFormData } from '../onboarding.model';
import { FormFieldComponent } from '@khalilrebhiitec/daf360';

@Component({
  selector: 'app-step-emergency',
  standalone: true,
  imports: [FormFieldComponent],
  templateUrl: './step-emergency.component.html',
  styleUrl: './step-emergency.component.scss',
})
export class StepEmergencyComponent implements OnInit {
  data     = input<OnboardingProfileDto>({});
  formInfo = input<OnboardingFormData | null>(null);

  changed = output<Partial<OnboardingProfileDto>>();

  emergencyContactName     = signal('');
  emergencyContactRelation = signal('');
  emergencyContactPhone    = signal('');

  ngOnInit(): void {
    const d  = this.data();
    const fi = this.formInfo();
    this.emergencyContactName.set(d.emergencyContactName         ?? fi?.emergencyContactName     ?? '');
    this.emergencyContactRelation.set(d.emergencyContactRelation ?? fi?.emergencyContactRelation ?? '');
    this.emergencyContactPhone.set(d.emergencyContactPhone       ?? fi?.emergencyContactPhone    ?? '');
  }

  emit(): void {
    this.changed.emit({
      emergencyContactName:     this.emergencyContactName()     || null,
      emergencyContactRelation: this.emergencyContactRelation() || null,
      emergencyContactPhone:    this.emergencyContactPhone()    || null,
    });
  }
}
