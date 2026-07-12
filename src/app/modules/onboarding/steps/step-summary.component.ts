import { Component, input, output } from '@angular/core';
import { CardComponent } from '@khalilrebhiitec/daf360';
import { genderLabel } from '../../../shared/utils/gender.utils';

@Component({
  selector: 'app-step-summary',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './step-summary.component.html',
  styleUrl: './step-summary.component.scss',
})
export class StepSummaryComponent {
  data = input<any>({});
  formInfo = input<any>(null);
  editStep = output<number>();

  readonly genderLabel = genderLabel;

  val(v: any): string {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
    return String(v);
  }

  maskIban(iban: any): string {
    if (!iban) return '—';
    const s = String(iban);
    if (s.length <= 4) return s;
    return s.slice(0, 4) + '****';
  }
}
