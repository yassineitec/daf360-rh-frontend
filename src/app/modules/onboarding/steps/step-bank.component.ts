import { Component, OnInit, input, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OnboardingProfileDto, OnboardingFormData } from '../onboarding.model';
import { RefDataService } from '../../../core/ref/ref-data.service';
import { RefDataItem } from '../../../core/ref/ref-data.model';

@Component({
  selector: 'app-step-bank',
  standalone: true,
  imports: [FormsModule],
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

  ngOnInit(): void {
    const d      = this.data();
    const fi     = this.formInfo();
    const paysId = fi?.paysId ?? 179;

    this.bankId.set(d.bankId ?? null);
    this.rib.set(d.rib ?? fi?.rib ?? '');
    this.bankAccountNumber.set(d.bankAccountNumber ?? fi?.bankAccountNumber ?? '');
    this.iban.set(d.iban ?? fi?.iban ?? '');
    this.socialSecurityNumber.set(d.socialSecurityNumber ?? '');
    this.taxId.set(d.taxId ?? '');

    this.refSvc.getBanks(paysId).subscribe(r => this.banks.set(r));
  }

  emit(): void {
    this.changed.emit({
      bankId:               this.bankId(),
      rib:                  this.rib(),
      bankAccountNumber:    this.bankAccountNumber(),
      iban:                 this.iban(),
      socialSecurityNumber: this.socialSecurityNumber(),
      taxId:                this.taxId(),
    });
  }
}
