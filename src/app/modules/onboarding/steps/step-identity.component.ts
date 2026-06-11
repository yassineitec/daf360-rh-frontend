import { Component, OnInit, input, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { OnboardingProfileDto, OnboardingFormData } from '../onboarding.model';
import { ConfigurableListService } from '../../../core/lists/configurable-list.service';
import { RefDataService } from '../../../core/ref/ref-data.service';
import { RefDataItem } from '../../../core/ref/ref-data.model';

@Component({
  selector: 'app-step-identity',
  standalone: true,
  imports: [FormsModule, AsyncPipe],
  templateUrl: './step-identity.component.html',
  styleUrl: './step-identity.component.scss',
})
export class StepIdentityComponent implements OnInit {
  data     = input<OnboardingProfileDto>({});
  formInfo = input<OnboardingFormData | null>(null);

  changed = output<Partial<OnboardingProfileDto>>();

  private listService = inject(ConfigurableListService);
  private refSvc      = inject(RefDataService);
  readonly genderOptions$ = this.listService.getListValues('GENDER');
  readonly emptyList: never[] = [];

  firstName      = signal('');
  lastName       = signal('');
  dateOfBirth    = signal('');
  gender         = signal('');
  nationalityId  = signal<number | null>(null);
  nationalId     = signal('');
  passportNumber = signal('');
  nationalities  = signal<RefDataItem[]>([]);

  ngOnInit(): void {
    const d  = this.data();
    const fi = this.formInfo();

    this.firstName.set(d.firstName      ?? fi?.firstName   ?? '');
    this.lastName.set(d.lastName        ?? fi?.lastName    ?? '');
    this.dateOfBirth.set(d.dateOfBirth  ?? fi?.dateOfBirth ?? '');
    this.gender.set(d.gender            ?? '');
    this.nationalityId.set(d.nationalityId ?? null);
    this.nationalId.set(d.nationalId    ?? fi?.nationalId  ?? '');
    this.passportNumber.set(d.passportNumber ?? '');

    this.refSvc.getNationalities().subscribe(r => this.nationalities.set(r));
  }

  emit(): void {
    this.changed.emit({
      firstName:      this.firstName(),
      lastName:       this.lastName(),
      dateOfBirth:    this.dateOfBirth() || null,
      gender:         this.gender()      || null,
      nationalityId:  this.nationalityId(),
      nationalId:     this.nationalId()  || null,
      passportNumber: this.passportNumber() || null,
    });
  }
}
