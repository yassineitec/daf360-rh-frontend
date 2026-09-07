import {
  Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import {
  AvatarComponent, BadgeOptions, BreadcrumbItem, ButtonComponent, CardComponent,
  FormFieldComponent, PageComponent, PageHeaderBadge, PageHeaderComponent,
} from '@khalilrebhiitec/daf360';

import { RequestsService }      from './requests.service';
import { EmployeeRequest, GeneratedDocument } from './models/request.model';
import { PdfDownloadButtonComponent } from '../../shared/pdf-download-button/pdf-download-button.component';
import { PdfDownloadService, GeneratedDocumentResponse } from '../../core/pdf/pdf-download.service';
import { UserStore }       from '../../core/user.store';
import { ConfirmService }  from '../../core/confirm.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const STATUS_VARIANTS: Record<string, BadgeOptions['variant']> = {
  SUBMITTED:  'info',
  IN_REVIEW:  'warning',
  PENDING_L2: 'warning',
  APPROVED:   'success',
  REJECTED:   'danger',
  CANCELLED:  'neutral',
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED:  'Soumis',
  IN_REVIEW:  'En traitement',
  PENDING_L2: 'Attente L2',
  APPROVED:   'Approuvée',
  REJECTED:   'Refusée',
  CANCELLED:  'Annulée',
};

interface TimelineStep {
  label: string;
  done: boolean;
  rejected?: boolean;
  date: string | null;
  msg: string | null;
  estimatedDelay?: string;
}

@Component({
  selector: 'app-request-detail',
  standalone: true,
  imports: [
    RouterLink, SlicePipe, PdfDownloadButtonComponent,
    AvatarComponent, ButtonComponent, CardComponent, FormFieldComponent, PageComponent,
    PageHeaderComponent, TranslatePipe,
  ],
  template: `
    <!-- Same daf-page/daf-page-header scaffold as the other detail pages (candidates,
         profiles, recruitment demand): breadcrumbs carry the "back to list" affordance,
         badges show status on the title line — no hand-rolled header markup. -->
    <daf-page [loading]="loading()" [kpis]="0" [breadcrumbs]="true">

      <daf-page-header
        [title]="requestTypeLabel() || ('REQUESTS.DETAIL.NOT_FOUND' | translate)"
        [subtitle]="headerSubtitle()"
        [badges]="headerBadges()"
        [breadcrumbs]="breadcrumbs()"
        [breadcrumbLabel]="'REQUESTS.DETAIL.BREADCRUMB' | translate">
        <ng-container pageActions>
          @if (req()?.status === 'SUBMITTED' && !isOfficer()) {
            <daf-button
              [options]="{ variant: 'ghost', size: 'sm', label: ('REQUESTS.DETAIL.CANCEL_BTN' | translate) }"
              (onClick)="cancelRequest()" />
          }
          @if (canProcess()) {
            <daf-button
              [options]="{ variant: 'teal', size: 'sm', iconStart: 'task_alt',
                           label: ('REQUESTS.DETAIL.TAKE_CHARGE' | translate) }"
              (onClick)="scrollToAction()" />
          }
        </ng-container>
      </daf-page-header>

      @if (!req()) {
        <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
          <div class="flex flex-col items-center gap-3 py-8 text-center">
            <span class="material-symbols-outlined text-[36px] text-outline-variant">search_off</span>
            <p class="m-0 text-[14px] font-semibold text-on-surface">
              {{ 'REQUESTS.DETAIL.NOT_FOUND' | translate }}
            </p>
            <daf-button
              [options]="{ variant: 'ghost', size: 'sm', iconStart: 'arrow_back',
                           label: ('REQUESTS.DETAIL.BACK_TO_REQUESTS' | translate) }"
              (onClick)="goBack()" />
          </div>
        </daf-card>
      } @else {
        <!-- Same scaffold as /rh/profiles/:id and /rh/recruitment-demands/:id: a sticky
             reference card on the left (there, identity/job details; here, the requester)
             and everything else flowing in the right column. -->
        <div class="flex flex-col gap-6 lg:flex-row">

          <!-- ── Left: who this request is about, plus the officer's action panel right
               below it, always on screen ── -->
          <div class="lg:w-[32%] lg:shrink-0">
            <div class="flex flex-col gap-6 lg:sticky lg:top-6">
              <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="m-0 mb-3 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  {{ 'REQUESTS.DETAIL.REQUESTER' | translate }}
                </h3>
                <div class="flex items-center gap-3">
                  <!-- Real photo, same daf-avatar + endpoint as /rh/profiles and the
                       request card lists — falls back to initials on its own if it 404s. -->
                  <daf-avatar [data]="{ name: employeeLabel(), avatarUrl: employeeAvatarUrl() }" size="lg" />
                  <div class="min-w-0">
                    <p class="m-0 truncate text-[14px] font-semibold text-on-surface">{{ employeeLabel() }}</p>
                    <p class="m-0 text-[12px] text-on-surface-variant">{{ 'REQUESTS.DETAIL.EMPLOYEE' | translate }}</p>
                  </div>
                </div>
                <div class="mt-4 flex flex-col gap-2 border-t border-outline-variant/30 pt-4">
                  <div class="flex items-center justify-between gap-3 text-[13px]">
                    <span class="text-on-surface-variant">{{ 'REQUESTS.DETAIL.PROFILE_KEY' | translate }}</span>
                    <span class="truncate font-medium text-on-surface">{{ employeeLabel() }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-3 text-[13px]">
                    <span class="text-on-surface-variant">{{ 'REQUESTS.DETAIL.COUNTRY_KEY' | translate }}</span>
                    <span class="font-medium text-on-surface">{{ req()!.paysName ?? ('#' + req()!.paysId) }}</span>
                  </div>
                  @if (req()!.assignedOfficerId) {
                    <div class="flex items-center justify-between gap-3 text-[13px]">
                      <span class="text-on-surface-variant">{{ 'REQUESTS.DETAIL.OFFICER_KEY' | translate }}</span>
                      <span class="font-medium text-on-surface">
                        {{ 'REQUESTS.DETAIL.OFFICER_NUMBER' | translate:{ id: req()!.assignedOfficerId } }}
                      </span>
                    </div>
                  }
                </div>
                @if (isOfficer()) {
                  <a [routerLink]="['/profiles', req()!.employeeProfileId]"
                     class="mt-4 inline-block w-fit cursor-pointer text-[13px] font-medium text-tertiary underline underline-offset-2 hover:text-teal">
                    {{ 'REQUESTS.DETAIL.VIEW_FULL_PROFILE' | translate }}
                  </a>
                }
                <!-- Extra bottom space — the card otherwise ends right at the last row,
                     which read as too short next to the tall right column. -->
                <div class="h-8"></div>
              </daf-card>

              <!-- Action panel (officer, processable) — right under the Requérant card. -->
              @if (canProcess()) {
                <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }" id="rd-action-panel">
                  <h3 class="m-0 mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    <span class="material-symbols-outlined text-[18px] text-warning">gavel</span>
                    {{ 'REQUESTS.DETAIL.ACTION_TITLE' | translate }}
                  </h3>
                  <daf-form-field
                    [options]="{ label: ('REQUESTS.DETAIL.COMMENT_LABEL' | translate), required: true, type: 'textarea', rows: 3,
                                 placeholder: ('REQUESTS.DETAIL.COMMENT_PLACEHOLDER' | translate), fullWidth: true }"
                    [value]="actionComment"
                    (valueChange)="actionComment = $any($event) ?? ''" />
                  @if (errorMsg()) {
                    <p class="m-0 mt-2 text-[12px] text-danger">{{ errorMsg() }}</p>
                  }
                  <div class="mt-4 flex flex-col gap-2.5">
                    <daf-button
                      [options]="{ variant: 'teal', size: 'lg', fullWidth: true, iconStart: 'check_circle',
                                   disabled: !actionComment.trim() || saving(), loading: saving(),
                                   label: ('REQUESTS.DETAIL.APPROVE' | translate) }"
                      (onClick)="process('APPROVED')" />
                    <daf-button
                      [options]="{ variant: 'danger', size: 'lg', fullWidth: true, iconStart: 'cancel',
                                   disabled: !actionComment.trim() || saving(),
                                   label: ('REQUESTS.DETAIL.REJECT' | translate) }"
                      (onClick)="process('REJECTED')" />
                  </div>
                </daf-card>
              }
            </div>
          </div>

          <!-- ── Right: reason, documents, timeline. ── -->
          <div class="flex min-w-0 flex-1 flex-col gap-6">

            <!-- Motif de la demande -->
            <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
              <h3 class="m-0 mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                <span class="material-symbols-outlined text-[18px] text-teal">chat_bubble</span>
                {{ 'REQUESTS.DETAIL.REASON_TITLE' | translate }}
              </h3>
              <p class="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-on-surface">
                @if (req()!.closureComment) {
                  "{{ req()!.closureComment }}"
                } @else {
                  {{ 'REQUESTS.DETAIL.NO_COMMENT' | translate }}
                }
              </p>
            </daf-card>

            <!-- Documents joints -->
            @if (req()!.attachmentUrl) {
              <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="m-0 mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <span class="material-symbols-outlined text-[18px] text-teal">attachment</span>
                  {{ 'REQUESTS.DETAIL.ATTACHMENTS_TITLE' | translate }}
                </h3>
                <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal">
                    <span class="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="m-0 truncate text-[14px] font-medium text-on-surface">{{ 'REQUESTS.DETAIL.ATTACHMENT_NAME' | translate }}</p>
                    <p class="m-0 text-[12px] text-outline">{{ fmtDate(req()!.submissionDate) }}</p>
                  </div>
                  <a [href]="req()!.attachmentUrl" target="_blank" download
                     class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                     [title]="'REQUESTS.DETAIL.DOWNLOAD' | translate">
                    <span class="material-symbols-outlined text-[20px]">download</span>
                  </a>
                </div>
              </daf-card>
            }

            <!-- Documents générés (after approval) -->
            @if (req()!.status === 'APPROVED' && documents().length > 0) {
              <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="m-0 mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <span class="material-symbols-outlined text-[18px] text-teal">file_present</span>
                  {{ 'REQUESTS.DETAIL.GENERATED_DOCS_TITLE' | translate }}
                </h3>
                <div class="flex flex-col gap-3">
                  @for (doc of documents(); track doc.id) {
                    <div class="flex items-center gap-3">
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal">
                        <span class="material-symbols-outlined text-[20px]">description</span>
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="m-0 truncate text-[14px] font-medium text-on-surface">{{ doc.documentType }}</p>
                        @if (doc.verificationCode) {
                          <p class="m-0 text-[12px] text-outline">{{ 'REQUESTS.DETAIL.CODE' | translate:{ code: doc.verificationCode } }}</p>
                        }
                      </div>
                      <!-- Stream via the Spring endpoint (blob). doc.fileUrl is a
                           server filesystem path, NOT a browser URL — using it as an
                           href downloaded the SPA's index.html as a .htm ("No file"). -->
                      <app-pdf-download-button
                        [label]="'REQUESTS.DETAIL.DOWNLOAD' | translate"
                        [docId]="doc.id"
                        [filename]="(doc.documentType || 'document').toLowerCase() + '.pdf'"
                        variant="icon" />
                    </div>
                  }
                </div>
              </daf-card>
            }

            <!-- PDF doc section (document-type requests, approved) -->
            @if (isDocumentRequest() && req()!.status === 'APPROVED') {
              <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="m-0 mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <span class="material-symbols-outlined text-[18px] text-teal">picture_as_pdf</span>
                  {{ 'REQUESTS.DETAIL.OFFICIAL_DOC_TITLE' | translate }}
                </h3>
                @if (generatedDoc()) {
                  <div class="flex flex-wrap items-center gap-3">
                    <span class="material-symbols-outlined text-[20px] text-success">check_circle</span>
                    <p class="m-0 flex-1 text-[14px] text-on-surface">
                      {{ 'REQUESTS.DETAIL.DOC_GENERATED_ON' | translate:{ date: (generatedDoc()!.generatedAt | slice:0:10) } }}
                    </p>
                    <app-pdf-download-button
                      [label]="'REQUESTS.DETAIL.DOWNLOAD' | translate"
                      [docId]="generatedDoc()!.id"
                      [filename]="(req()!.typeCode ?? 'document').toLowerCase() + '.pdf'"
                      variant="outline" />
                  </div>
                } @else {
                  <div class="flex flex-wrap items-center gap-3">
                    <span class="material-symbols-outlined text-[20px] text-warning">warning</span>
                    <p class="m-0 flex-1 text-[14px] text-on-surface">{{ 'REQUESTS.DETAIL.DOC_NOT_GENERATED' | translate }}</p>
                    <app-pdf-download-button
                      [label]="'REQUESTS.DETAIL.GENERATE_NOW' | translate"
                      [endpoint]="getDocEndpoint(req()!.typeCode ?? '')"
                      [body]="{ employeeProfileId: req()!.employeeProfileId, requestId: req()!.id }"
                      [filename]="(req()!.typeCode ?? 'document').toLowerCase() + '.pdf'"
                      variant="primary" />
                  </div>
                }
              </daf-card>
            }

            <!-- Historique -->
            <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
              <h3 class="m-0 mb-4 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                <span class="material-symbols-outlined text-[18px] text-teal">history</span>
                {{ 'REQUESTS.DETAIL.HISTORY_TITLE' | translate }}
              </h3>
              <div class="flex flex-col">
                @for (step of timelineSteps(); track step.label; let last = $last) {
                  <div class="flex gap-3">
                    <div class="flex flex-col items-center">
                      <div [class]="'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] ' +
                                    (step.rejected ? 'bg-danger text-on-primary' : step.done ? 'bg-teal text-on-primary' : 'bg-surface-container text-outline')">
                        @if (step.done && !step.rejected) {
                          <span class="material-symbols-outlined text-[16px]">check</span>
                        } @else if (step.rejected) {
                          <span class="material-symbols-outlined text-[16px]">close</span>
                        } @else {
                          <div class="h-2 w-2 rounded-full bg-outline-variant"></div>
                        }
                      </div>
                      @if (!last) { <div class="my-1 w-px flex-1 bg-outline-variant/50"></div> }
                    </div>
                    <div class="min-w-0 flex-1 pb-5">
                      <div class="flex flex-wrap items-baseline justify-between gap-2">
                        <span [class]="'text-[14px] font-semibold ' + (step.done ? 'text-on-surface' : 'text-outline')">
                          {{ step.label }}
                        </span>
                        @if (step.date) {
                          <span class="text-[12px] text-outline">{{ fmtDateTime(step.date) }}</span>
                        }
                      </div>
                      @if (step.msg) {
                        <p class="m-0 mt-1 rounded-lg bg-surface-container-low px-3 py-2 text-[13px] text-on-surface-variant">
                          {{ step.msg }}
                        </p>
                      }
                      @if (step.estimatedDelay) {
                        <p class="m-0 mt-1 flex items-center gap-1.5 text-[12px] text-warning">
                          <span class="material-symbols-outlined text-[14px]">schedule</span>
                          {{ 'REQUESTS.DETAIL.ESTIMATED_DELAY' | translate:{ delay: step.estimatedDelay } }}
                        </p>
                      }
                    </div>
                  </div>
                }
              </div>
            </daf-card>

            <!-- Generate document (officer + approved + document type) -->
            @if (isDocumentType() && req()!.status === 'APPROVED' && isOfficer()) {
              <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="m-0 mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <span class="material-symbols-outlined text-[18px] text-teal">picture_as_pdf</span>
                  {{ 'REQUESTS.DETAIL.DOC_GEN_TITLE' | translate }}
                </h3>
                <p class="m-0 mb-3 text-[13px] text-on-surface-variant">
                  {{ 'REQUESTS.DETAIL.DOC_GEN_DESC' | translate }}
                </p>
                <daf-button
                  [options]="{ variant: 'teal', iconStart: 'picture_as_pdf', disabled: generating(), loading: generating(),
                               label: ('REQUESTS.DETAIL.GENERATE_DOC' | translate) }"
                  (onClick)="generateDocument()" />
              </daf-card>
            }

          </div>

        </div>
      }
    </daf-page>
  `,
})
export class RequestDetailComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private confirm   = inject(ConfirmService);
  private svc       = inject(RequestsService);
  private userStore = inject(UserStore);
  private pdfSvc    = inject(PdfDownloadService);
  private translate = inject(TranslateService);

  requestId    = 0;
  loading      = signal(true);
  saving       = signal(false);
  generating   = signal(false);
  req          = signal<EmployeeRequest | null>(null);
  documents    = signal<GeneratedDocument[]>([]);
  errorMsg     = signal<string | null>(null);
  generatedDoc = signal<GeneratedDocumentResponse | null>(null);
  actionComment = '';

  readonly DOCUMENT_TYPES = [
    'ATTESTATION_TRAVAIL',
    'ATTESTATION_SALAIRE',
    'ATTESTATION_NON_BENEFICE_PRET',
    'ATTESTATION_TITULARISATION',
    'ATTESTATION_DOMICILIATION_SALAIRE',
  ];

  isOfficer  = computed(() => this.userStore.isHrManager() || this.userStore.isAdmin());
  canProcess = computed(() => {
    const s = this.req()?.status;
    return this.isOfficer() && (s === 'SUBMITTED' || s === 'IN_REVIEW' || s === 'PENDING_L2');
  });
  isDocumentType    = computed(() => false);
  isDocumentRequest = computed(() => {
    const r = this.req();
    return r ? this.DOCUMENT_TYPES.includes(r.typeCode ?? '') : false;
  });

  private currentProfileId = computed(() => {
    const u = this.userStore.currentUser();
    if (!u) return 0;
    const fromEmployee = parseInt(u.employeeId ?? '', 10);
    return isNaN(fromEmployee) ? u.userId : fromEmployee;
  });

  private officerId = computed(() => this.userStore.currentUser()?.userId ?? 0);

  /** Falls back to "Profil #N" until the backend enriches `employeeName`. */
  readonly employeeLabel = computed(() => {
    const r = this.req();
    if (!r) return '';
    return r.employeeName
      ?? this.translate.instant('REQUESTS.COMMON.PROFILE_NUMBER', { id: r.employeeProfileId });
  });

  /** Same photo endpoint as /rh/profiles and the request card lists — daf-avatar falls
   *  back to initials on its own if it 404s. */
  readonly employeeAvatarUrl = computed(() => {
    const r = this.req();
    return r ? `/api/hr/profiles/${r.employeeProfileId}/photo` : '';
  });

  /** Falls back to "Demande #N" until the backend enriches `typeDisplayNameFr` — doubles
   *  as the page title and the current breadcrumb, so the two never drift. */
  readonly requestTypeLabel = computed(() => {
    this.translate.currentLang();
    const r = this.req();
    if (!r) return '';
    return r.typeDisplayNameFr
      ?? this.translate.instant('REQUESTS.COMMON.REQUEST_NUMBER', { id: r.requestTypeId });
  });

  readonly headerSubtitle = computed(() => {
    this.translate.currentLang();
    const r = this.req();
    return r ? this.translate.instant('REQUESTS.DETAIL.SUBMITTED_ON', { date: this.fmtDate(r.submissionDate) }) : undefined;
  });

  readonly headerBadges = computed<PageHeaderBadge[]>(() => {
    this.translate.currentLang();
    const r = this.req();
    if (!r) return [];
    return [{ label: this.statusLabel(r.status), variant: this.statusBadgeOptions(r.status).variant, pill: true }];
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.translate.currentLang();
    return [
      { label: this.translate.instant('REQUESTS.DETAIL.BREADCRUMB'), link: '/requests' },
      { label: this.requestTypeLabel() },
    ];
  });

  timelineSteps = computed((): TimelineStep[] => {
    this.translate.currentLang();
    const r = this.req();
    if (!r) return [];

    const steps: TimelineStep[] = [
      {
        label: this.translate.instant('REQUESTS.TIMELINE.SUBMITTED_LABEL'),
        done: true,
        date: r.submissionDate,
        msg: this.translate.instant('REQUESTS.TIMELINE.SUBMITTED_MSG'),
      },
    ];

    if (r.status === 'CANCELLED') {
      steps.push({ label: this.translate.instant('REQUESTS.TIMELINE.CANCELLED_LABEL'), done: true, rejected: true, date: r.updatedAt ?? null, msg: r.closureComment ?? this.translate.instant('REQUESTS.TIMELINE.CANCELLED_MSG') });
      return steps;
    }

    const inReviewDone = ['IN_REVIEW', 'PENDING_L2', 'APPROVED', 'REJECTED'].includes(r.status);
    steps.push({
      label: r.status === 'PENDING_L2' ? this.translate.instant('REQUESTS.TIMELINE.PENDING_L2_LABEL') : this.translate.instant('REQUESTS.TIMELINE.IN_REVIEW_LABEL'),
      done: inReviewDone,
      date: null,
      msg: inReviewDone ? this.translate.instant('REQUESTS.TIMELINE.IN_REVIEW_MSG') : null,
      estimatedDelay: !inReviewDone ? '24h' : undefined,
    });

    const finalDone = r.status === 'APPROVED' || r.status === 'REJECTED';
    steps.push({
      label: r.status === 'REJECTED' ? this.translate.instant('REQUESTS.TIMELINE.REJECTED_LABEL') : this.translate.instant('REQUESTS.TIMELINE.FINAL_LABEL'),
      done: finalDone,
      rejected: r.status === 'REJECTED',
      date: r.resolutionDate ?? null,
      msg: finalDone
        ? (r.closureComment ?? (r.status === 'APPROVED' ? this.translate.instant('REQUESTS.TIMELINE.APPROVED_MSG') : this.translate.instant('REQUESTS.TIMELINE.REJECTED_MSG')))
        : null,
    });

    return steps;
  });

  statusLabel(status: string): string {
    this.translate.currentLang();
    return STATUS_LABELS[status] ? this.translate.instant('REQUESTS.STATUS.' + status) : status;
  }

  statusBadgeOptions(status: string): BadgeOptions {
    return { variant: STATUS_VARIANTS[status] ?? 'neutral' };
  }

  getDocEndpoint(typeCode: string): string {
    const map: Record<string, string> = {
      'ATTESTATION_TRAVAIL':               '/api/hr/documents/attestation-travail',
      'ATTESTATION_SALAIRE':               '/api/hr/documents/attestation-salaire',
      'ATTESTATION_NON_BENEFICE_PRET':     '/api/hr/documents/attestation-non-benefice-pret',
      'ATTESTATION_TITULARISATION':        '/api/hr/documents/attestation-titularisation',
      'ATTESTATION_DOMICILIATION_SALAIRE': '/api/hr/documents/attestation-domiciliation-salaire',
    };
    return map[typeCode] ?? '/api/hr/documents/generate';
  }

  goBack(): void {
    this.router.navigate(['/requests']);
  }

  ngOnInit() {
    this.requestId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadRequest();
  }

  private loadRequest() {
    this.loading.set(true);
    this.svc.getRequest(this.requestId).pipe(catchError(() => of(null)))
      .subscribe(r => {
        this.loading.set(false);
        this.req.set(r);
        if (r?.status === 'APPROVED') {
          this.loadDocuments();
          if (this.isDocumentRequest()) {
            this.pdfSvc.generateDocument('/api/hr/documents/by-request/' + r.id, null)
              .subscribe({
                next: doc => this.generatedDoc.set(doc as GeneratedDocumentResponse),
                error: ()  => this.generatedDoc.set(null),
              });
          }
        }
      });
  }

  private loadDocuments() {
    this.svc.listDocuments(this.requestId).pipe(catchError(() => of([])))
      .subscribe(docs => this.documents.set(docs));
  }

  async cancelRequest() {
    if (!(await this.confirm.ask({
      title: this.translate.instant('REQUESTS.CANCEL.TITLE'),
      message: this.translate.instant('REQUESTS.CANCEL.MESSAGE'),
      confirmLabel: this.translate.instant('REQUESTS.CANCEL.CONFIRM'),
      cancelLabel: this.translate.instant('REQUESTS.CANCEL.BACK'),
    }))) return;
    this.svc.cancelRequest(this.requestId, this.currentProfileId())
      .pipe(catchError(() => of(null)))
      .subscribe(updated => { if (updated) this.req.set(updated); });
  }

  process(decision: 'APPROVED' | 'REJECTED') {
    if (!this.actionComment.trim()) return;
    this.saving.set(true);
    this.errorMsg.set(null);
    this.svc.processRequest(this.requestId, this.officerId(), decision, this.actionComment)
      .pipe(catchError(err => {
        this.errorMsg.set(err?.error?.message ?? this.translate.instant('REQUESTS.DETAIL.ERROR_PROCESSING'));
        this.saving.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.saving.set(false);
        if (updated) { this.req.set(updated); this.actionComment = ''; }
      });
  }

  generateDocument() {
    this.generating.set(true);
    this.svc.generateDocument(this.requestId).pipe(catchError(() => of(null)))
      .subscribe(docs => {
        this.generating.set(false);
        if (docs) this.documents.set(docs);
      });
  }

  scrollToAction() {
    document.getElementById('rd-action-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }

  fmtDateTime(iso: string | null): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }
}
