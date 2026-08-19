import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, FileUploadComponent, SelectComponent, SelectOption,
  SkeletonComponent, StatusBadgeComponent, UploadedFile,
} from '@khalilrebhiitec/daf360';

import { ProfileDocumentRow } from '../models/profile.model';
import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import { fmtDate } from './field-bridges';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'teal';

/** Literal variants — a runtime-built Tailwind class never survives the app's scan. */
const VERIFICATION_CONFIG: Record<string, { key: string; variant: BadgeVariant }> = {
  PENDING:  { key: 'PROFILES.DOCUMENTS.STATUS.PENDING',  variant: 'warning' },
  VERIFIED: { key: 'PROFILES.DOCUMENTS.STATUS.VERIFIED', variant: 'success' },
  REJECTED: { key: 'PROFILES.DOCUMENTS.STATUS.REJECTED', variant: 'danger'  },
};

/** Days before expiry at which the row starts warning. */
const EXPIRY_WARNING_DAYS = 30;

/**
 * Documents tab — the employee's dossier.
 *
 * Shows BOTH sources: uploaded pieces (`employee_documents`, verifiable and removable) and
 * generated attestations (`generated_documents`, produced by the drawer, read-only here).
 * They were previously invisible to each other, so the tab claimed a dossier was empty
 * while six attestations existed for it.
 *
 * Generation is still the drawer's job (`rh-documents-drawer`); this tab only lists.
 */
@Component({
  selector: 'rh-documents-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionCardComponent, ButtonComponent, FileUploadComponent, SelectComponent,
    SkeletonComponent, StatusBadgeComponent, TranslatePipe,
  ],
  host: { class: 'contents' },
  template: `
    <rh-section-card
      [title]="'PROFILES.SECTIONS.DOCUMENTS' | translate" icon="folder_open"
      tone="text-tertiary" accent="tertiary">

      <div sectionAction>
        <span class="text-[11px] text-outline">
          {{ 'PROFILES.DOCUMENTS.COUNT' | translate:{ count: rows().length } }}
        </span>
      </div>

      @if (canEdit()) {
        <!-- Type first, then the file: the type is what the upload is POSTed with, and a
             file dropped before a type was chosen used to be sent as whatever was default. -->
        <div class="mb-5 flex flex-col gap-3 rounded-xl border border-outline-variant
                    bg-surface-container-low p-4">
          <div class="grid gap-4 sm:grid-cols-[minmax(200px,260px)_1fr] sm:items-start">
            <daf-select [options]="docTypeOptions()"
              [config]="{ label: ('PROFILES.DOCUMENTS.TYPE_LABEL' | translate), searchable: true }"
              [selected]="[uploadType()]"
              (selectedChange)="onTypeChange($event)" />
            <daf-file-upload
              [config]="{ accept: '.pdf,.jpg,.jpeg,.png',
                          hint: ('PROFILES.DOCUMENTS.IMPORT_HINT' | translate) }"
              [files]="uploadFiles()"
              (filesChange)="filesChange.emit($event)" />
          </div>
          @if (uploading()) {
            <span class="text-[12px] text-teal">{{ 'PROFILES.DOCUMENTS.UPLOADING' | translate }}</span>
          }
        </div>
      }

      @if (loading()) {
        <div class="flex flex-col gap-2">
          @for (i of [0, 1, 2]; track i) {
            <daf-skeleton variant="block" radius="lg" width="100%" height="58px" />
          }
        </div>
      } @else {
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          @for (doc of rows(); track doc.source + '-' + doc.id) {
            <li class="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant px-3 py-2.5"
                [class.border-danger]="isExpired(doc)">
              <span class="material-symbols-outlined shrink-0 text-[20px]"
                    [class.text-tertiary]="doc.source === 'GENERATED'"
                    [class.text-on-surface-variant]="doc.source === 'UPLOADED'">
                {{ doc.source === 'GENERATED' ? 'auto_awesome' : 'description' }}
              </span>

              <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="truncate text-[13px] font-semibold text-on-surface">
                    {{ typeLabel(doc.documentType) }}
                  </span>
                  @if (doc.source === 'GENERATED') {
                    <daf-badge [label]="'PROFILES.DOCUMENTS.SOURCE_GENERATED' | translate"
                               [options]="{ variant: 'info', pill: true, size: 'sm' }" />
                  } @else if (doc.verificationStatus) {
                    <daf-badge [label]="statusLabel(doc.verificationStatus)"
                               [options]="{ variant: statusVariant(doc.verificationStatus), size: 'sm' }" />
                  }
                  @if (expiryState(doc) === 'EXPIRED') {
                    <daf-badge [label]="'PROFILES.DOCUMENTS.EXPIRED' | translate"
                               [options]="{ variant: 'danger', size: 'sm' }" />
                  } @else if (expiryState(doc) === 'SOON') {
                    <daf-badge [label]="'PROFILES.DOCUMENTS.EXPIRES_SOON' | translate:{ days: daysToExpiry(doc) }"
                               [options]="{ variant: 'warning', size: 'sm' }" />
                  }
                </div>

                @if (doc.fileName) {
                  <span class="truncate text-[12px] text-on-surface-variant">{{ doc.fileName }}</span>
                }

                <div class="flex flex-wrap gap-3 text-[11px] text-outline">
                  <span>{{ 'PROFILES.DOCUMENTS.ON_DATE' | translate:{ date: fmtDate(doc.date) } }}</span>
                  @if (doc.authorName) {
                    <span>{{ 'PROFILES.DOCUMENTS.BY' | translate:{ name: doc.authorName } }}</span>
                  }
                  @if (doc.fileSizeKb) {
                    <span>{{ 'PROFILES.DOCUMENTS.SIZE_KB' | translate:{ size: doc.fileSizeKb } }}</span>
                  }
                  @if (doc.expirationDate) {
                    <span>{{ 'PROFILES.DOCUMENTS.EXPIRES_ON' | translate:{ date: fmtDate(doc.expirationDate) } }}</span>
                  }
                  @if (doc.verificationCode) {
                    <span class="font-mono">{{ doc.verificationCode }}</span>
                  }
                </div>

                @if (doc.notes) {
                  <p class="m-0 text-[11px] italic text-on-surface-variant">{{ doc.notes }}</p>
                }
              </div>

              <div class="flex shrink-0 items-center gap-1">
                <daf-button
                  [options]="{ variant: 'ghost', size: 'sm', iconStart: 'open_in_new',
                               title: ('PROFILES.DOCUMENTS.OPEN' | translate) }"
                  (onClick)="open.emit(doc)" />

                <!-- Verification and removal only apply to uploaded pieces: a generated
                     attestation is produced by the system, so there is nothing to verify
                     and it is not RH's to withdraw. -->
                @if (canEdit() && doc.source === 'UPLOADED') {
                  @if (doc.verificationStatus !== 'VERIFIED') {
                    <daf-button
                      [options]="{ variant: 'ghost', size: 'sm', iconStart: 'check_circle',
                                   title: ('PROFILES.DOCUMENTS.VERIFY' | translate) }"
                      (onClick)="verify.emit({ doc, status: 'VERIFIED' })" />
                  }
                  @if (doc.verificationStatus !== 'REJECTED') {
                    <daf-button
                      [options]="{ variant: 'ghost', size: 'sm', iconStart: 'cancel',
                                   title: ('PROFILES.DOCUMENTS.REJECT' | translate) }"
                      (onClick)="verify.emit({ doc, status: 'REJECTED' })" />
                  }
                  <daf-button
                    [options]="{ variant: 'ghost', size: 'sm', iconStart: 'edit',
                                 title: ('PROFILES.DOCUMENTS.EDIT' | translate) }"
                    (onClick)="edit.emit(doc)" />
                  <daf-button
                    [options]="{ variant: 'ghost', size: 'sm', iconStart: 'delete',
                                 title: ('PROFILES.DOCUMENTS.DELETE' | translate) }"
                    (onClick)="remove.emit(doc)" />
                }
              </div>
            </li>
          } @empty {
            <div class="flex flex-col items-center gap-2 py-6 text-center">
              <span class="material-symbols-outlined text-[28px] text-outline">folder_off</span>
              <p class="m-0 text-[13px] text-on-surface-variant">
                {{ 'PROFILES.DOCUMENTS.NONE' | translate }}
              </p>
            </div>
          }
        </ul>
      }
    </rh-section-card>
  `,
})
export class DocumentsSectionComponent {
  private translate = inject(TranslateService);

  /** Already merged and sorted by the page — this component does not know the two services. */
  readonly rows           = input<ProfileDocumentRow[]>([]);
  readonly loading        = input(false);
  readonly uploading      = input(false);
  readonly canEdit        = input(false);
  readonly uploadType     = input('CONTRACT');
  readonly uploadFiles    = input<UploadedFile[]>([]);
  readonly docTypeOptions = input<SelectOption[]>([]);

  readonly uploadTypeChange = output<string>();
  readonly filesChange      = output<UploadedFile[]>();
  readonly open             = output<ProfileDocumentRow>();
  readonly verify           = output<{ doc: ProfileDocumentRow; status: 'VERIFIED' | 'REJECTED' }>();
  readonly edit             = output<ProfileDocumentRow>();
  readonly remove           = output<ProfileDocumentRow>();

  protected readonly fmtDate = fmtDate;

  /** Clearing the select yields an empty array despite the `string[]` type. */
  protected onTypeChange(values: string[]): void {
    if (values[0]) this.uploadTypeChange.emit(values[0]);
  }

  protected typeLabel(code: string): string {
    const key = 'PROFILES.DOC_TYPES.' + code;
    const label = this.translate.instant(key);
    // ngx-translate echoes the key back when it is missing. Historic rows can carry a code
    // that predates the catalogue — show the code, never a dotted path.
    return label === key ? code : label;
  }

  protected statusLabel(status: string): string {
    const cfg = VERIFICATION_CONFIG[status];
    return cfg ? this.translate.instant(cfg.key) : status;
  }

  protected statusVariant(status: string): BadgeVariant {
    return VERIFICATION_CONFIG[status]?.variant ?? 'neutral';
  }

  protected daysToExpiry(doc: ProfileDocumentRow): number | null {
    if (!doc.expirationDate) return null;
    const end = new Date(doc.expirationDate).getTime();
    if (isNaN(end)) return null;
    return Math.ceil((end - Date.now()) / 86_400_000);
  }

  /** null = no expiry tracked, which is the normal case for a contract or a RIB. */
  protected expiryState(doc: ProfileDocumentRow): 'EXPIRED' | 'SOON' | null {
    const days = this.daysToExpiry(doc);
    if (days === null) return null;
    if (days < 0) return 'EXPIRED';
    return days <= EXPIRY_WARNING_DAYS ? 'SOON' : null;
  }

  protected isExpired(doc: ProfileDocumentRow): boolean {
    return this.expiryState(doc) === 'EXPIRED';
  }
}
