import { Component, inject, input, output } from '@angular/core';
import { CardComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { genderLabel } from '../../../shared/utils/gender.utils';

@Component({
  selector: 'app-step-summary',
  standalone: true,
  imports: [CardComponent, TranslatePipe],
  templateUrl: './step-summary.component.html',
  styleUrl: './step-summary.component.scss',
})
export class StepSummaryComponent {
  data = input<any>({});
  formInfo = input<any>(null);
  editStep = output<number>();

  private translate = inject(TranslateService);

  readonly genderLabel = genderLabel;

  val(v: any): string {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return this.translate.instant(v ? 'ONBOARDING.STEP_SUMMARY.YES' : 'ONBOARDING.STEP_SUMMARY.NO');
    return String(v);
  }

  maskIban(iban: any): string {
    if (!iban) return '—';
    const s = String(iban);
    if (s.length <= 4) return s;
    return s.slice(0, 4) + '****';
  }

  /** Resolve the selected régime's label from the form's available regimes. */
  regimeLabel(): string {
    const id = this.data()?.regimeTemplateId;
    if (id == null) return '—';
    const match = (this.formInfo()?.availableRegimes ?? []).find((r: any) => r.id === id);
    return match?.labelFr ?? this.val(id);
  }
}
