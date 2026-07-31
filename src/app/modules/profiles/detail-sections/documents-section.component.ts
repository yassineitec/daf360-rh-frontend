import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  FileUploadComponent, SelectComponent, SelectOption,
  SkeletonComponent, StatusBadgeComponent, UploadedFile,
} from '@khalilrebhiitec/daf360';

import { EmployeeDocument } from '../models/profile.model';
import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import { statusBadge } from '../../../shared/status-badge.utils';

/**
 * Documents tab — the employee's uploaded dossier.
 *
 * Generation of HR attestations is **not** here: it lives in the drawer
 * (`rh-documents-drawer`), which is what the drawer is for on this page.
 */
@Component({
  selector: 'rh-documents-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionCardComponent, FileUploadComponent, SelectComponent, SkeletonComponent,
    StatusBadgeComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <rh-section-card [title]="'PROFILES.SECTIONS.DOCUMENTS' | translate" icon="folder_open">

      @if (canEdit()) {
        <!-- daf-select is full-width by default, so a grid track constrains it
             instead of it pushing the uploader onto its own line. -->
        <div class="mb-5 grid gap-4 sm:grid-cols-[minmax(200px,260px)_1fr] sm:items-start">
          <daf-select [options]="docTypeOptions()"
            [config]="{ label: ('PROFILES.DOCUMENTS.TYPE_LABEL' | translate), searchable: true }"
            [selected]="[uploadType()]"
            (selectedChange)="uploadTypeChange.emit($event[0])" />
          <daf-file-upload
            [config]="{ accept: '.pdf,.jpg,.jpeg,.png', hint: ('PROFILES.DOCUMENTS.IMPORT_HINT' | translate) }"
            [files]="uploadFiles()"
            (filesChange)="filesChange.emit($event)" />
        </div>
      }

      @if (loading()) {
        <div class="flex flex-col gap-2">
          @for (i of [0, 1, 2]; track i) {
            <daf-skeleton variant="block" radius="lg" width="100%" height="46px" />
          }
        </div>
      } @else {
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          @for (doc of documents(); track doc.id) {
            <li class="flex items-center gap-2.5 rounded-lg border border-outline-variant px-3 py-2.5">
              <span class="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant">description</span>
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-[13px] font-medium text-on-surface">{{ doc.fileName ?? doc.documentType }}</span>
                @if (doc.fileSizeKb) {
                  <span class="text-[11px] text-on-surface-variant">
                    {{ 'PROFILES.DOCUMENTS.SIZE_KB' | translate:{ size: doc.fileSizeKb } }}
                  </span>
                }
              </div>
              <daf-badge [label]="badge(doc.verificationStatus).label"
                         [options]="badge(doc.verificationStatus).options" />
            </li>
          } @empty {
            <p class="m-0 text-[13px] text-on-surface-variant">{{ 'PROFILES.DOCUMENTS.NONE' | translate }}</p>
          }
        </ul>
      }
    </rh-section-card>
  `,
})
export class DocumentsSectionComponent {
  readonly documents      = input<EmployeeDocument[]>([]);
  readonly loading        = input(false);
  readonly canEdit        = input(false);
  readonly uploadType     = input('CONTRACT');
  readonly uploadFiles    = input<UploadedFile[]>([]);
  readonly docTypeOptions = input<SelectOption[]>([]);

  readonly uploadTypeChange = output<string>();
  readonly filesChange      = output<UploadedFile[]>();

  protected readonly badge = statusBadge;
}
