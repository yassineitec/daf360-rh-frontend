import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  AccordionCardComponent, ButtonComponent, FileUploadComponent,
  SkeletonComponent, StatusBadgeComponent, UploadedFile,
} from '@khalilrebhiitec/daf360';

import { ProfileDocumentRow, RemoteDocument } from '../models/profile.model';
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
    SectionCardComponent, AccordionCardComponent, ButtonComponent, FileUploadComponent,
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

      @if (loading()) {
        <div class="flex flex-col gap-2">
          @for (i of [0, 1, 2]; track i) {
            <daf-skeleton variant="block" radius="lg" width="100%" height="58px" />
          }
        </div>
      } @else {
      <!-- One accordion section per document TYPE, not one flat list.
           The type is what decides the SharePoint folder, so grouping by it is what makes
           "where does this land" visible at all — and it puts the upload control next to the
           heading it files under, instead of a select that had to be set first and was easy to
           forget.
           Exclusive: opening one closes the rest, so sixteen types stay a readable list rather
           than a wall. The counts live in the header, which renders collapsed too, so nothing
           has to be opened to find out where the documents are. -->
      <div class="flex flex-col gap-2">
        @for (t of types(); track t.code) {
          <!-- variant: 'outlined', not the default glass: sixteen glass cards inside this
               panel's own glass card is a stack of blur, and every one of them would be another
               target for the lib's unconditional .glass-card:hover lift. Outlined reads as a
               list inside a panel, which is what this is. -->
          <daf-accordion-card
            [options]="{ title: t.label, icon: 'folder', variant: 'outlined', radius: 'lg' }"
            [open]="openType() === t.code"
            (openChange)="onSectionToggle(t.code, $event)">

            <!-- headerAction is projected whether the card is open or closed, which is what
                 makes an exclusive accordion usable: the counts stay readable on every
                 collapsed section, so you can see WHERE the documents are without opening
                 each one in turn. -->
            <span headerAction class="flex items-center gap-2">
              @if (rowsFor(t.code).length) {
                <daf-badge [label]="rowsFor(t.code).length + ''"
                           [options]="{ variant: 'neutral', pill: true, size: 'sm' }" />
              }
              @if (remoteExtraCount(t.code)) {
                <daf-badge [label]="'PROFILES.DOCUMENTS.IN_SHAREPOINT' | translate:{ count: remoteExtraCount(t.code) }"
                           [options]="{ variant: 'info', pill: true, size: 'sm' }" />
              }
            </span>

            <div class="flex flex-col gap-3">
              @if (canEdit()) {
                <daf-file-upload
                  [config]="{ accept: '.pdf,.jpg,.jpeg,.png',
                              hint: ('PROFILES.DOCUMENTS.IMPORT_HINT' | translate) }"
                  [files]="filesFor(t.code)"
                  (filesChange)="filesChange.emit({ type: t.code, files: $event })" />
                @if (uploadingType() === t.code) {
                  <span class="text-[12px] text-teal">
                    {{ 'PROFILES.DOCUMENTS.UPLOADING' | translate }}
                  </span>
                }
              }

              <ul class="m-0 flex list-none flex-col gap-2 p-0">
          @for (doc of rowsFor(t.code); track doc.source + '-' + doc.id) {
            <li class="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant px-3 py-2.5"
                [class.border-danger]="isExpired(doc)">
              <span class="material-symbols-outlined shrink-0 text-[20px]"
                    [class.text-tertiary]="doc.source === 'GENERATED'"
                    [class.text-on-surface-variant]="doc.source === 'UPLOADED'">
                {{ doc.source === 'GENERATED' ? 'auto_awesome' : 'description' }}
              </span>

              <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                <div class="flex flex-wrap items-center gap-2">
                  <!-- The file name is the title here: the section heading already says the
                       type, so repeating it would make every row inside a section read the
                       same. Generated attestations have no user-chosen name, so they fall back
                       to the type, which IS their name. -->
                  <span class="truncate text-[13px] font-semibold text-on-surface">
                    {{ doc.fileName || typeLabel(doc.documentType) }}
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
          }
              </ul>

              <!-- What is really in the SharePoint folder.
                   Fetched on expand, never on tab open: one Graph round trip per type per
                   profile view is how a page earns a 429. Files the app itself filed are
                   already above, so only the rest is listed — HR's own drops, which the tab
                   could not show at all before. -->
              @if (remoteLoading()[t.code]) {
                <daf-skeleton variant="block" radius="lg" width="100%" height="40px" />
              } @else if (remoteExtras(t.code).length) {
                <div class="flex flex-col gap-1.5">
                  <span class="text-[11px] font-semibold uppercase tracking-wider text-outline">
                    {{ 'PROFILES.DOCUMENTS.SHAREPOINT_ONLY' | translate }}
                  </span>
                  @for (f of remoteExtras(t.code); track f.name) {
                    <div class="flex flex-wrap items-center gap-3 rounded-lg border border-dashed
                                border-outline-variant px-3 py-2">
                      <span class="material-symbols-outlined shrink-0 text-[20px] text-info">
                        cloud
                      </span>
                      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span class="truncate text-[13px] text-on-surface">{{ f.name }}</span>
                        <div class="flex flex-wrap gap-3 text-[11px] text-outline">
                          @if (f.lastModified) {
                            <span>{{ 'PROFILES.DOCUMENTS.ON_DATE' | translate:{ date: fmtDate(f.lastModified) } }}</span>
                          }
                          @if (f.sizeBytes) {
                            <span>{{ 'PROFILES.DOCUMENTS.SIZE_KB' | translate:{ size: kb(f.sizeBytes) } }}</span>
                          }
                        </div>
                      </div>
                      <!-- Retrieval on click, never on render: the bytes come from Graph, so
                           listing a folder must not pull every file in it. -->
                      <daf-button
                        [options]="{ variant: 'ghost', size: 'sm', iconStart: 'download',
                                     title: ('PROFILES.DOCUMENTS.OPEN' | translate) }"
                        (onClick)="openRemote.emit({ type: t.code, file: f })" />
                    </div>
                  }
                </div>
              } @else if (!rowsFor(t.code).length) {
                <div class="flex flex-col items-center gap-2 py-4 text-center">
                  <span class="material-symbols-outlined text-[24px] text-outline">folder_off</span>
                  <p class="m-0 text-[12px] text-on-surface-variant">
                    {{ 'PROFILES.DOCUMENTS.NONE' | translate }}
                  </p>
                </div>
              }
            </div>
          </daf-accordion-card>
        }
      </div>
      }
    </rh-section-card>
  `,
})
export class DocumentsSectionComponent {
  private translate = inject(TranslateService);

  /** Already merged and sorted by the page — this component does not know the two services. */
  readonly rows           = input<ProfileDocumentRow[]>([]);
  readonly loading        = input(false);
  readonly canEdit        = input(false);

  /** The type sections to render, in the order the backend gave them. */
  readonly types          = input<{ code: string; label: string }[]>([]);

  /** SharePoint contents per type code — only for types that have been expanded. */
  readonly remote         = input<Record<string, RemoteDocument[]>>({});
  readonly remoteLoading  = input<Record<string, boolean>>({});

  /** Files staged in the upload control, per type: each section has its own. */
  readonly uploadFiles    = input<Record<string, UploadedFile[]>>({});

  /** Which type's upload is in flight, or null. One at a time is enough — the control is
   *  disabled by its own busy state and nobody uploads into two sections at once. */
  readonly uploadingType  = input<string | null>(null);

  readonly filesChange = output<{ type: string; files: UploadedFile[] }>();
  readonly expand      = output<string>();
  readonly openRemote  = output<{ type: string; file: RemoteDocument }>();
  readonly open        = output<ProfileDocumentRow>();
  readonly verify      = output<{ doc: ProfileDocumentRow; status: 'VERIFIED' | 'REJECTED' }>();
  readonly edit        = output<ProfileDocumentRow>();
  readonly remove      = output<ProfileDocumentRow>();

  protected readonly fmtDate = fmtDate;

  /**
   * The single open section, or null.
   *
   * One code rather than a set: this is an accordion, so opening a section closes the previous
   * one. Local UI state, not an input — the page has no reason to care which section is open,
   * and the one thing it does care about (fetch this type's SharePoint listing) is announced
   * through `expand`.
   */
  private readonly openedCode = signal<string | null>(null);

  /** Whether the user has picked a section yet — before that, the default below applies. */
  private readonly touched = signal(false);

  /**
   * The open section: the user's pick, or the first type that has documents.
   *
   * Defaulting to the first type WITH documents rather than the first type in the list: an
   * employee whose only file is a CV would otherwise land on an empty CONTRACT section, which
   * hides the one thing worth seeing. Null when the dossier is empty — nothing to open.
   */
  protected readonly openType = computed<string | null>(() => {
    if (this.touched()) return this.openedCode();
    return this.types().find(t => this.rowsFor(t.code).length > 0)?.code ?? null;
  });

  /**
   * `openChange` from one card. Exclusivity lives here: the accordion's `open` is a two-way
   * model, so the parent decides, and setting one code is what closes every other section.
   */
  protected onSectionToggle(code: string, open: boolean): void {
    this.touched.set(true);
    this.openedCode.set(open ? code : null);
    // Announce only on open, and let the page decide whether it already has the listing —
    // re-fetching on every collapse would turn a chevron into Graph traffic.
    if (open) this.expand.emit(code);
  }

  protected rowsFor(code: string): ProfileDocumentRow[] {
    return this.rows().filter(r => r.documentType === code);
  }

  protected filesFor(code: string): UploadedFile[] {
    return this.uploadFiles()[code] ?? [];
  }

  /**
   * SharePoint files that are NOT already listed above.
   *
   * `filedByApp` marks the ones the upload itself put there (the `{docId}_` prefix), and those
   * are the same documents the local rows describe — showing both would double every row that
   * mirrored successfully.
   */
  protected remoteExtras(code: string): RemoteDocument[] {
    return (this.remote()[code] ?? []).filter(f => !f.filedByApp);
  }

  /** For the header badge: how many SharePoint files this type has that the app does not know. */
  protected remoteExtraCount(code: string): number {
    return this.remoteExtras(code).length;
  }

  protected kb(bytes: number): number {
    return Math.max(1, Math.round(bytes / 1024));
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
