import { Component, input, output, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { OnboardingProfileDto, OnboardingFormData } from '../onboarding.model';
import { ConfigurableListService } from '../../../core/lists/configurable-list.service';

@Component({
  selector: 'app-step-personal',
  standalone: true,
  imports: [FormsModule, AsyncPipe],
  templateUrl: './step-personal.component.html',
  styleUrl: './step-personal.component.scss',
})
export class StepPersonalComponent implements OnInit {
  data     = input<OnboardingProfileDto>({});
  formInfo = input<OnboardingFormData | null>(null);

  changed = output<Partial<OnboardingProfileDto>>();

  private listService = inject(ConfigurableListService);
  readonly maritalOptions$ = this.listService.getListValues('MARITAL_STATUS');
  readonly emptyList: never[] = [];

  cnssNumber          = signal('');
  cnssAffiliationDate = signal('');
  maritalStatus       = signal('');
  numberOfChildren    = signal<number | null>(null);
  personalAddress         = signal('');
  phone               = signal('');

  ngOnInit(): void {
    const d  = this.data();
    const fi = this.formInfo();

    this.cnssNumber.set(d.cnssNumber ?? fi?.cnssNumber ?? '');
    this.cnssAffiliationDate.set(d.cnssAffiliationDate ?? fi?.cnssAffiliationDate ?? '');
    this.maritalStatus.set(d.maritalStatus ?? fi?.maritalStatus ?? '');
    this.numberOfChildren.set(d.numberOfChildren ?? fi?.numberOfChildren ?? null);
    this.personalAddress.set(d.personalAddress ?? fi?.personalAddress ?? '');
    this.phone.set(d.phone ?? fi?.phone ?? '');
  }

  emit(): void {
    this.changed.emit({
      cnssNumber:          this.cnssNumber() || undefined,
      cnssAffiliationDate: this.cnssAffiliationDate() || null,
      maritalStatus:       this.maritalStatus() || null,
      numberOfChildren:    this.numberOfChildren(),
      personalAddress:         this.personalAddress() || null,
      phone:               this.phone() || null,
    });
  }
}
