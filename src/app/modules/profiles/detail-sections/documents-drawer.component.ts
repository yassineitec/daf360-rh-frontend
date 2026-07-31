import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DrawerComponent, DrawerConfig } from '@khalilrebhiitec/daf360';

import { EmployeeProfile } from '../models/profile.model';
import { GeneratedDocumentResponse } from '../../../core/pdf/pdf-download.service';
import { PdfDownloadButtonComponent } from '../../../shared/pdf-download-button/pdf-download-button.component';

/**
 * Document-generation drawer — the five HR attestations plus what has already
 * been generated for this employee.
 *
 * Generation only. The uploaded dossier is a tab (`rh-documents-section`): these
 * were two differently-shaped blocks on the old page (a collapsible section and a
 * bare `<section>` with its own `h2`), and only the generators belong behind an
 * edge tab — they are an occasional action, not a part of the record.
 */
@Component({
  selector: 'rh-documents-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerComponent, PdfDownloadButtonComponent, TranslatePipe],
  template: `
    <daf-drawer [config]="drawerConfig()">

      @if (generatedDocs().length) {
        <section>
          <h3 class="mb-3 text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
            {{ 'PROFILES.HR_DOCS.GENERATED' | translate }}
          </h3>
          <div class="flex flex-col gap-2">
            @for (doc of generatedDocs(); track doc.id) {
              <div class="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2">
                <span class="flex-1 text-[12px] font-semibold text-on-surface">
                  {{ doc.documentType.replace('_', ' ') }}
                </span>
                <code class="rounded bg-surface-container px-1.5 py-0.5 text-[10px] text-on-surface-variant">
                  {{ doc.verificationCode }}
                </code>
                <app-pdf-download-button
                  [label]="'PROFILES.HR_DOCS.DOWNLOAD' | translate"
                  [endpoint]="'/api/hr/documents/download/' + doc.id"
                  [body]="null"
                  [filename]="doc.documentType.toLowerCase() + '.pdf'"
                  variant="outline" />
              </div>
            }
          </div>
        </section>
      }

      <section>
        <h3 class="mb-3 text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
          {{ 'PROFILES.HR_DOCS.GENERATE_TITLE' | translate }}
        </h3>
        <div class="flex flex-col gap-2">
          @for (gen of generators(); track gen.endpoint) {
            <div class="flex flex-col gap-2 rounded-xl border border-outline-variant p-3">
              <div>
                <p class="m-0 text-[13px] font-semibold text-on-surface">{{ gen.title }}</p>
                <p class="m-0 text-[11px] text-on-surface-variant">{{ gen.description }}</p>
              </div>
              <app-pdf-download-button
                [label]="'PROFILES.HR_DOCS.GENERATE' | translate"
                [endpoint]="gen.endpoint"
                [body]="{ employeeProfileId: profile().id }"
                [filename]="gen.filename"
                variant="outline"
                [disabled]="gen.disabled"
                [disabledTooltip]="gen.disabledTooltip ?? ''" />
            </div>
          }
        </div>
      </section>

    </daf-drawer>
  `,
})
export class DocumentsDrawerComponent {
  private translate = inject(TranslateService);

  readonly profile       = input.required<EmployeeProfile>();
  readonly generatedDocs = input<GeneratedDocumentResponse[]>([]);

  protected readonly drawerConfig = computed<DrawerConfig>(() => {
    this.translate.currentLang();
    return {
      title:      this.translate.instant('PROFILES.HR_DOCS.TITLE'),
      icon:       'note_add',
      width:      '420px',
      closeLabel: this.translate.instant('PROFILES.HR_DOCS.DRAWER_CLOSE'),
      // Drawers in this app are dismissed deliberately: a stray click outside must
      // not discard a half-finished generation. 4.12.0 pulses the ✕ on a backdrop
      // click so the way out stays obvious.
      closeOnBackdrop: false,
    };
  });

  /**
   * The five attestations. Two are conditional on data the profile may not have —
   * the same rules the old grid encoded, in one place instead of across five cards.
   */
  protected readonly generators = computed(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k) as string;
    const profile = this.profile();
    return [
      {
        endpoint: '/api/hr/documents/attestation-travail',
        filename: 'attestation-travail.pdf',
        title: t('PROFILES.HR_DOCS.ATT_WORK_TITLE'),
        description: t('PROFILES.HR_DOCS.ATT_WORK_DESC'),
        disabled: false,
        disabledTooltip: null as string | null,
      },
      {
        endpoint: '/api/hr/documents/attestation-salaire',
        filename: 'attestation-salaire.pdf',
        title: t('PROFILES.HR_DOCS.ATT_SALARY_TITLE'),
        description: t('PROFILES.HR_DOCS.ATT_SALARY_DESC'),
        disabled: false,
        disabledTooltip: null as string | null,
      },
      {
        endpoint: '/api/hr/documents/attestation-non-benefice-pret',
        filename: 'attestation-pret.pdf',
        title: t('PROFILES.HR_DOCS.ATT_LOAN_TITLE'),
        description: t('PROFILES.HR_DOCS.ATT_LOAN_DESC'),
        disabled: false,
        disabledTooltip: null as string | null,
      },
      {
        endpoint: '/api/hr/documents/attestation-titularisation',
        filename: 'attestation-titularisation.pdf',
        title: t('PROFILES.HR_DOCS.ATT_TENURE_TITLE'),
        description: t('PROFILES.HR_DOCS.ATT_TENURE_DESC'),
        disabled: profile.contractType !== 'PERMANENT',
        disabledTooltip: t('PROFILES.HR_DOCS.ATT_TENURE_DISABLED'),
      },
      {
        endpoint: '/api/hr/documents/attestation-domiciliation-salaire',
        filename: 'attestation-domiciliation.pdf',
        title: t('PROFILES.HR_DOCS.ATT_DOMICIL_TITLE'),
        description: t('PROFILES.HR_DOCS.ATT_DOMICIL_DESC'),
        disabled: !profile.rib && !profile.bankName,
        disabledTooltip: t('PROFILES.HR_DOCS.ATT_DOMICIL_DISABLED'),
      },
    ];
  });
}
