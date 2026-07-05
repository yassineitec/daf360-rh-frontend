import { Component, OnInit, computed, input, output, signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { OnboardingProfileDto, OnboardingFormData } from '../onboarding.model';
import { ConfigurableListService } from '../../../core/lists/configurable-list.service';
import { RefDataService } from '../../../core/ref/ref-data.service';
import { RefDataItem } from '../../../core/ref/ref-data.model';
import {
  FormFieldComponent,
  SelectComponent,
  MultiDatePickerComponent,
  SelectOption,
} from '@khalilrebhiitec/daf360';
import { isoToDate, dateToIso } from '../../../shared/date-picker.utils';

@Component({
  selector: 'app-step-identity',
  standalone: true,
  imports: [FormFieldComponent, SelectComponent, MultiDatePickerComponent],
  templateUrl: './step-identity.component.html',
  styleUrl: './step-identity.component.scss',
})
export class StepIdentityComponent implements OnInit {
  data     = input<OnboardingProfileDto>({});
  formInfo = input<OnboardingFormData | null>(null);

  changed = output<Partial<OnboardingProfileDto>>();

  private listService = inject(ConfigurableListService);
  private refSvc      = inject(RefDataService);

  private genderList   = toSignal(this.listService.getListValues('GENDER'), { initialValue: [] });
  nationalities        = signal<RefDataItem[]>([]);

  readonly genderOptions = computed<SelectOption[]>(() =>
    this.genderList().map(v => ({ value: v.valueCode, label: v.labelFr })));
  readonly nationalityOptions = computed<SelectOption[]>(() =>
    this.nationalities().map(n => ({ value: String(n.id), label: n.labelFr })));

  firstName      = signal('');
  lastName       = signal('');
  dateOfBirth    = signal('');
  gender         = signal('');
  nationalityId  = signal<number | null>(null);
  nationalId     = signal('');
  passportNumber = signal('');

  // Expose the date <-> ISO helpers to the template for daf-multi-date-picker.
  protected readonly isoToDate = isoToDate;
  protected readonly dateToIso = dateToIso;

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
