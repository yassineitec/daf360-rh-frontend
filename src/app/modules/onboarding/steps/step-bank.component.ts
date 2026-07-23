import { Component, OnInit, input, output, signal, inject, computed } from '@angular/core';
import { OnboardingProfileDto, OnboardingFormData } from '../onboarding.model';
import { RefDataService } from '../../../core/ref/ref-data.service';
import { RefDataItem } from '../../../core/ref/ref-data.model';
import { FormFieldComponent, SelectComponent, SelectOption } from '@khalilrebhiitec/daf360';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-step-bank',
  standalone: true,
  imports: [FormFieldComponent, SelectComponent, TranslatePipe],
  templateUrl: './step-bank.component.html',
  styleUrl: './step-bank.component.scss',
})
export class StepBankComponent implements OnInit {
  data     = input<OnboardingProfileDto>({});
  formInfo = input<OnboardingFormData | null>(null);

  changed = output<Partial<OnboardingProfileDto>>();

  private refSvc = inject(RefDataService);

  bankId               = signal<number | null>(null);
  banks                = signal<RefDataItem[]>([]);
  rib                  = signal('');
  bankAccountNumber    = signal('');
  iban                 = signal('');
  socialSecurityNumber = signal('');
  taxId                = signal('');

  readonly bankOptions = computed<SelectOption[]>(() =>
    this.banks().map(b => ({ value: String(b.id), label: b.labelFr })));

  ngOnInit(): void {
    const d  = this.data();
    const fi = this.formInfo();

    this.bankId.set(d.bankId ?? null);
    this.rib.set(d.rib ?? fi?.rib ?? '');
    this.bankAccountNumber.set(d.bankAccountNumber ?? fi?.bankAccountNumber ?? '');
    this.iban.set(d.iban ?? fi?.iban ?? '');
    this.socialSecurityNumber.set(d.socialSecurityNumber ?? '');
    this.taxId.set(d.taxId ?? '');

    // No paysId → all active banks (see step-contract rationale).
    this.refSvc.getBanks().subscribe(r => this.banks.set(r));
  }

  emit(): void {
    this.changed.emit({
      bankId:               this.bankId(),
      bankName:             this.banks().find(b => b.id === this.bankId())?.labelFr ?? undefined,
      rib:                  this.rib(),
      bankAccountNumber:    this.bankAccountNumber(),
      iban:                 this.iban(),
      socialSecurityNumber: this.socialSecurityNumber(),
      taxId:                this.taxId(),
    });
  }
}
