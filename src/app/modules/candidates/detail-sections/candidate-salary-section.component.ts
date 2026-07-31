import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent, FormFieldComponent, FormFieldOptions } from '@khalilrebhiitec/daf360';

import { SectionCardComponent } from '../../../shared/detail/section-card.component';

/**
 * "Rémunération" — the two negotiated net-salary figures, inline-editable.
 *
 * The page owns the values and the request; this section only renders and emits.
 * The inputs are `daf-form-field`s: they used to be raw `<input type="number">`
 * with hand-written border/focus classes and hardcoded French labels.
 */
@Component({
  selector: 'rh-candidate-salary-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionCardComponent, FormFieldComponent, ButtonComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-section-card
      [title]="'CANDIDATES.DETAIL.SALARY' | translate"
      icon="payments">

      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <daf-form-field
          [value]="netRh()"
          [options]="rhFieldOptions()"
          (valueChange)="netRhChange.emit(asNumber($event))" />
        <daf-form-field
          [value]="netCandidate()"
          [options]="candidateFieldOptions()"
          (valueChange)="netCandidateChange.emit(asNumber($event))" />
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <daf-button
          [options]="{
            variant: 'teal', pill: true, iconStart: 'save',
            label: ('CANDIDATES.DETAIL.SALARY_SAVE' | translate),
            loading: saving(), disabled: saving()
          }"
          (onClick)="save.emit()" />

        @if (success()) {
          <span class="flex items-center gap-1.5 text-[12.5px] text-teal">
            <span class="material-symbols-outlined text-[15px]"
                  style="font-variation-settings:'FILL' 1">check_circle</span>
            {{ success() }}
          </span>
        }
        @if (error()) {
          <span class="flex items-center gap-1.5 text-[12.5px] text-danger">
            <span class="material-symbols-outlined text-[15px]">error</span>
            {{ error() }}
          </span>
        }
      </div>
    </rh-section-card>
  `,
})
export class CandidateSalarySectionComponent {
  private translate = inject(TranslateService);

  readonly netRh        = input<number | null>(null);
  readonly netCandidate = input<number | null>(null);
  readonly saving       = input(false);
  readonly error        = input<string | null>(null);
  readonly success      = input<string | null>(null);

  readonly netRhChange        = output<number | null>();
  readonly netCandidateChange = output<number | null>();
  readonly save               = output<void>();

  protected readonly rhFieldOptions = computed<FormFieldOptions>(() => {
    this.translate.currentLang();
    return {
      type: 'number',
      label: this.translate.instant('CANDIDATES.DETAIL.SALARY_NET_RH'),
      placeholder: '0',
      fullWidth: true,
    };
  });

  protected readonly candidateFieldOptions = computed<FormFieldOptions>(() => {
    this.translate.currentLang();
    return {
      type: 'number',
      label: this.translate.instant('CANDIDATES.DETAIL.SALARY_NET_CANDIDATE'),
      placeholder: '0',
      fullWidth: true,
    };
  });

  /** Empty clears the figure — `0` would read as "we offer nothing". */
  protected asNumber(value: string | number | null): number | null {
    if (value === null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return isNaN(n) ? null : n;
  }
}
