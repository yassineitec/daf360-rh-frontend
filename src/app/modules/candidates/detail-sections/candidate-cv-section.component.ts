import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent } from '@khalilrebhiitec/daf360';

import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import { CandidateDetail } from '../candidate.model';

/**
 * "CV" tab of `/rh/candidates/:id` — the uploaded CV, its download and its
 * replacement. Mirrors the Documents tab on `/rh/profiles/:id`.
 *
 * The file input is triggered programmatically from a `daf-button` rather than
 * wrapped in a `<label>`: a `<button>` inside a label swallows the click, so label
 * activation never reaches the input — the same bug the profile page's photo FAB hit.
 */
@Component({
  selector: 'rh-candidate-cv-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionCardComponent, ButtonComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-section-card
      [title]="'CANDIDATES.DETAIL.CV' | translate"
      icon="description">

      @if (candidate().cvOriginalName) {
        <div class="flex items-center justify-between gap-4 rounded-xl border border-outline-variant
                    bg-surface-container-low p-4">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tertiary-container">
              <span class="material-symbols-outlined text-[20px] text-on-tertiary-container"
                    style="font-variation-settings:'FILL' 1">picture_as_pdf</span>
            </span>
            <div class="min-w-0">
              <p class="truncate text-[13px] font-medium text-on-surface">{{ candidate().cvOriginalName }}</p>
              @if (candidate().cvUploadedAt) {
                <p class="text-[11px] text-outline">
                  {{ 'CANDIDATES.DETAIL.CV_UPLOADED_ON' | translate:{ date: uploadedOn() } }}
                </p>
              }
            </div>
          </div>
          <div class="flex shrink-0 gap-2">
            <daf-button
              [options]="{ variant: 'ghost', size: 'sm', iconStart: 'download',
                           label: ('CANDIDATES.DETAIL.DOWNLOAD' | translate) }"
              (onClick)="download.emit()" />
            <daf-button
              [options]="{
                variant: 'secondary', size: 'sm', iconStart: 'upload_file',
                label: (uploading() ? 'CANDIDATES.COMMON.SENDING' : 'CANDIDATES.DETAIL.REPLACE') | translate,
                disabled: uploading(), loading: uploading()
              }"
              (onClick)="picker.click()" />
          </div>
        </div>
      } @else {
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed
                    border-outline-variant bg-surface-container-low p-4">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-[22px] text-outline">upload_file</span>
            <p class="text-[13px] text-outline">{{ 'CANDIDATES.DETAIL.NO_CV_HINT' | translate }}</p>
          </div>
          <daf-button
            [options]="{
              variant: 'secondary', size: 'sm', iconStart: 'upload',
              label: (uploading() ? 'CANDIDATES.COMMON.SENDING' : 'CANDIDATES.DETAIL.ADD_CV') | translate,
              disabled: uploading(), loading: uploading()
            }"
            (onClick)="picker.click()" />
        </div>
      }

      <input #picker type="file" accept=".pdf,.doc,.docx" hidden
             [disabled]="uploading()" (change)="fileSelected.emit($event)" />

      @if (error()) {
        <p class="mt-3 flex items-center gap-1.5 text-[12px] text-danger">
          <span class="material-symbols-outlined text-[15px]">error</span>
          {{ error() }}
        </p>
      }
      @if (success()) {
        <p class="mt-3 flex items-center gap-1.5 text-[12px] text-teal">
          <span class="material-symbols-outlined text-[15px]"
                style="font-variation-settings:'FILL' 1">check_circle</span>
          {{ success() }}
        </p>
      }
    </rh-section-card>
  `,
})
export class CandidateCvSectionComponent {
  readonly candidate = input.required<CandidateDetail>();
  readonly uploading = input(false);
  readonly error     = input<string | null>(null);
  readonly success   = input<string | null>(null);

  readonly fileSelected = output<Event>();
  readonly download     = output<void>();

  protected uploadedOn(): string {
    return this.candidate().cvUploadedAt?.slice(0, 10) ?? '—';
  }
}
