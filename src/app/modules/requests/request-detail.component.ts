import {
  Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import {
  ButtonComponent, CardComponent, FormFieldComponent, StatusBadgeComponent, BadgeOptions,
} from '@khalilrebhiitec/daf360';

import { RequestsService }      from './requests.service';
import { EmployeeRequest, GeneratedDocument } from './models/request.model';
import { SpinnerComponent }          from '../../shared/spinner.component';
import { UserStore }                 from '../../core/user.store';
import { PdfDownloadButtonComponent } from '../../shared/pdf-download-button/pdf-download-button.component';
import { PdfDownloadService, GeneratedDocumentResponse } from '../../core/pdf/pdf-download.service';
import { ConfirmService } from '../../core/confirm.service';
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
    RouterLink, SlicePipe, SpinnerComponent, PdfDownloadButtonComponent,
    ButtonComponent, CardComponent, FormFieldComponent, StatusBadgeComponent,
    TranslatePipe,
  ],
  template: `
    @if (loading()) {
      <div class="rd-loading-wrap"><app-spinner size="lg" /></div>
    } @else if (!req()) {
      <div class="rd-error-state">
        <span class="material-symbols-outlined rd-error-icon">search_off</span>
        <p>{{ 'REQUESTS.DETAIL.NOT_FOUND' | translate }}</p>
        <a routerLink="/requests" class="rd-btn-ghost">{{ 'REQUESTS.DETAIL.BACK_TO_REQUESTS' | translate }}</a>
      </div>
    } @else {

      <div class="rd-page">

        <!-- ── Top bar ──────────────────────────────────────── -->
        <div class="rd-topbar">
          <div class="rd-nav">
            <nav class="rd-breadcrumb">
              <a routerLink="/requests" class="rd-bc-link">{{ 'REQUESTS.DETAIL.BREADCRUMB' | translate }}</a>
              <span class="material-symbols-outlined rd-bc-sep">chevron_right</span>
              <span class="rd-bc-current">{{ 'REQUESTS.COMMON.REQUEST_NUMBER' | translate:{ id: requestId } }}</span>
            </nav>
            <a routerLink="/requests" class="rd-back">
              <span class="material-symbols-outlined">arrow_back</span>
              {{ 'REQUESTS.DETAIL.BACK_TO_REQUESTS' | translate }}
            </a>
          </div>
          <div class="rd-topbar-actions">
            @if (req()!.status === 'SUBMITTED' && !isOfficer()) {
              <daf-button [label]="'REQUESTS.DETAIL.CANCEL_BTN' | translate" variant="ghost" [options]="{ size: 'sm' }" (onClick)="cancelRequest()" />
            }
            @if (canProcess()) {
              <daf-button [label]="'REQUESTS.DETAIL.TAKE_CHARGE' | translate" variant="teal" [options]="{ size: 'sm', iconStart: 'task_alt' }" (onClick)="scrollToAction()" />
            }
          </div>
        </div>

        <!-- ── Page title ───────────────────────────────────── -->
        <div class="rd-title-area">
          <div class="rd-title-row">
            <h1 class="rd-title">
              {{ req()!.typeDisplayNameFr ?? ('REQUESTS.COMMON.REQUEST_NUMBER' | translate:{ id: req()!.requestTypeId }) }}
            </h1>
            <daf-badge [label]="statusLabel(req()!.status)" [options]="statusBadgeOptions(req()!.status)" />
          </div>
          <div class="rd-meta">
            <span class="rd-meta-chip">
              <span class="material-symbols-outlined">account_circle</span>
              {{ req()!.employeeName ?? ('REQUESTS.COMMON.PROFILE_NUMBER' | translate:{ id: req()!.employeeProfileId }) }}
            </span>
            <span class="rd-meta-chip">
              <span class="material-symbols-outlined">calendar_today</span>
              {{ 'REQUESTS.DETAIL.SUBMITTED_ON' | translate:{ date: fmtDate(req()!.submissionDate) } }}
            </span>
            @if (req()!.assignedOfficerId) {
              <span class="rd-meta-chip">
                <span class="material-symbols-outlined">badge</span>
                {{ 'REQUESTS.DETAIL.OFFICER_NUMBER' | translate:{ id: req()!.assignedOfficerId } }}
              </span>
            }
          </div>
        </div>

        <!-- ── Grid ─────────────────────────────────────────── -->
        <div class="rd-grid">

          <!-- Left column -->
          <div class="rd-left">

            <!-- Motif de la demande -->
            <daf-card class="block" [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
              <div class="rd-card-hd">
                <h3 class="rd-section-title">
                  <span class="material-symbols-outlined">chat_bubble</span>
                  {{ 'REQUESTS.DETAIL.REASON_TITLE' | translate }}
                </h3>
              </div>
              <div class="rd-comment-box">
                <p class="rd-comment-text">
                  @if (req()!.closureComment) {
                    "{{ req()!.closureComment }}"
                  } @else {
                    {{ 'REQUESTS.DETAIL.NO_COMMENT' | translate }}
                  }
                </p>
              </div>
            </daf-card>

            <!-- Documents joints -->
            @if (req()!.attachmentUrl) {
              <daf-card class="block" [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="rd-section-title">
                  <span class="material-symbols-outlined">attachment</span>
                  {{ 'REQUESTS.DETAIL.ATTACHMENTS_TITLE' | translate }}
                </h3>
                <div class="rd-doc-item">
                  <div class="rd-doc-icon">
                    <span class="material-symbols-outlined">picture_as_pdf</span>
                  </div>
                  <div class="rd-doc-meta">
                    <p class="rd-doc-name">{{ 'REQUESTS.DETAIL.ATTACHMENT_NAME' | translate }}</p>
                    <p class="rd-doc-size">{{ fmtDate(req()!.submissionDate) }}</p>
                  </div>
                  <a [href]="req()!.attachmentUrl" target="_blank" download
                     class="rd-doc-download" [title]="'REQUESTS.DETAIL.DOWNLOAD' | translate">
                    <span class="material-symbols-outlined">download</span>
                  </a>
                </div>
              </daf-card>
            }

            <!-- Documents générés (after approval) -->
            @if (req()!.status === 'APPROVED' && documents().length > 0) {
              <daf-card class="block" [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="rd-section-title">
                  <span class="material-symbols-outlined">file_present</span>
                  {{ 'REQUESTS.DETAIL.GENERATED_DOCS_TITLE' | translate }}
                </h3>
                <div class="rd-docs-list">
                  @for (doc of documents(); track doc.id) {
                    <div class="rd-doc-item">
                      <div class="rd-doc-icon">
                        <span class="material-symbols-outlined">description</span>
                      </div>
                      <div class="rd-doc-meta">
                        <p class="rd-doc-name">{{ doc.documentType }}</p>
                        @if (doc.verificationCode) {
                          <p class="rd-doc-size">{{ 'REQUESTS.DETAIL.CODE' | translate:{ code: doc.verificationCode } }}</p>
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
              <daf-card class="block" [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="rd-section-title">
                  <span class="material-symbols-outlined">picture_as_pdf</span>
                  {{ 'REQUESTS.DETAIL.OFFICIAL_DOC_TITLE' | translate }}
                </h3>
                @if (generatedDoc()) {
                  <div class="rd-doc-ready">
                    <span class="material-symbols-outlined">check_circle</span>
                    <p>{{ 'REQUESTS.DETAIL.DOC_GENERATED_ON' | translate:{ date: (generatedDoc()!.generatedAt | slice:0:10) } }}</p>
                    <app-pdf-download-button
                      [label]="'REQUESTS.DETAIL.DOWNLOAD' | translate"
                      [docId]="generatedDoc()!.id"
                      [filename]="(req()!.typeCode ?? 'document').toLowerCase() + '.pdf'"
                      variant="outline"
                    />
                  </div>
                } @else {
                  <div class="rd-doc-warn">
                    <span class="material-symbols-outlined">warning</span>
                    <p>{{ 'REQUESTS.DETAIL.DOC_NOT_GENERATED' | translate }}</p>
                    <app-pdf-download-button
                      [label]="'REQUESTS.DETAIL.GENERATE_NOW' | translate"
                      [endpoint]="getDocEndpoint(req()!.typeCode ?? '')"
                      [body]="{ employeeProfileId: req()!.employeeProfileId, requestId: req()!.id }"
                      [filename]="(req()!.typeCode ?? 'document').toLowerCase() + '.pdf'"
                      variant="primary"
                    />
                  </div>
                }
              </daf-card>
            }

          </div><!-- /rd-left -->

          <!-- Right column -->
          <div class="rd-right">

            <!-- Timeline / Historique -->
            <daf-card class="block" [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
              <h3 class="rd-section-title-plain">{{ 'REQUESTS.DETAIL.HISTORY_TITLE' | translate }}</h3>
              <div class="rd-timeline">
                @for (step of timelineSteps(); track step.label; let last = $last) {
                  <div class="rd-tl-item" [class.rd-tl-item--last]="last">
                    <div class="rd-tl-dot-col">
                      <div class="rd-tl-dot"
                           [class.rd-tl-dot--done]="step.done && !step.rejected"
                           [class.rd-tl-dot--rejected]="step.rejected">
                        @if (step.done && !step.rejected) {
                          <span class="material-symbols-outlined">check</span>
                        } @else if (step.rejected) {
                          <span class="material-symbols-outlined">close</span>
                        } @else {
                          <div class="rd-tl-inner-dot"></div>
                        }
                      </div>
                      @if (!last) { <div class="rd-tl-line"></div> }
                    </div>
                    <div class="rd-tl-content">
                      <div class="rd-tl-header">
                        <span class="rd-tl-label" [class.rd-tl-label--pending]="!step.done">
                          {{ step.label }}
                        </span>
                        @if (step.date) {
                          <span class="rd-tl-date">{{ fmtDateTime(step.date) }}</span>
                        }
                      </div>
                      @if (step.msg) {
                        <div class="rd-tl-bubble">{{ step.msg }}</div>
                      }
                      @if (step.estimatedDelay) {
                        <div class="rd-tl-delay">
                          <span class="material-symbols-outlined">schedule</span>
                          {{ 'REQUESTS.DETAIL.ESTIMATED_DELAY' | translate:{ delay: step.estimatedDelay } }}
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </daf-card>

            <!-- Requérant glass card -->
            <daf-card class="block" [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
              <h3 class="rd-eyebrow">{{ 'REQUESTS.DETAIL.REQUESTER' | translate }}</h3>
              <div class="rd-requester-row">
                <div class="rd-requester-avatar">
                  <span class="material-symbols-outlined">account_circle</span>
                </div>
                <div>
                  <p class="rd-requester-name">{{ req()!.employeeName ?? ('REQUESTS.COMMON.PROFILE_NUMBER' | translate:{ id: req()!.employeeProfileId }) }}</p>
                  <p class="rd-requester-sub">{{ 'REQUESTS.DETAIL.EMPLOYEE' | translate }}</p>
                </div>
              </div>
              <div class="rd-requester-details">
                <div class="rd-detail-row">
                  <span class="rd-detail-key">{{ 'REQUESTS.DETAIL.PROFILE_KEY' | translate }}</span>
                  <span class="rd-detail-val">{{ req()!.employeeName ?? ('REQUESTS.COMMON.PROFILE_NUMBER' | translate:{ id: req()!.employeeProfileId }) }}</span>
                </div>
                <div class="rd-detail-row">
                  <span class="rd-detail-key">{{ 'REQUESTS.DETAIL.COUNTRY_KEY' | translate }}</span>
                  <span class="rd-detail-val">{{ req()!.paysName ?? ('#' + req()!.paysId) }}</span>
                </div>
              </div>
              @if (isOfficer()) {
                <a [routerLink]="['/profiles', req()!.employeeProfileId]"
                   class="rd-profile-link">
                  {{ 'REQUESTS.DETAIL.VIEW_FULL_PROFILE' | translate }}
                </a>
              }
            </daf-card>

            <!-- Action panel (officer, processable) -->
            @if (canProcess()) {
              <daf-card class="block" [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }" id="rd-action-panel">
                <h3 class="rd-section-title-plain">{{ 'REQUESTS.DETAIL.ACTION_TITLE' | translate }}</h3>
                <daf-form-field
                  [options]="{ label: ('REQUESTS.DETAIL.COMMENT_LABEL' | translate), required: true, type: 'textarea', rows: 3, placeholder: ('REQUESTS.DETAIL.COMMENT_PLACEHOLDER' | translate), fullWidth: true }"
                  [value]="actionComment"
                  (valueChange)="actionComment = $any($event) ?? ''" />
                <div class="rd-action-btns">
                  <daf-button
                    [label]="'REQUESTS.DETAIL.APPROVE' | translate"
                    variant="teal"
                    [options]="{ iconStart: 'check_circle', disabled: !actionComment.trim() || saving(), loading: saving() }"
                    (onClick)="process('APPROVED')" />
                  <daf-button
                    [label]="'REQUESTS.DETAIL.REJECT' | translate"
                    variant="danger"
                    [options]="{ iconStart: 'cancel', disabled: !actionComment.trim() || saving() }"
                    (onClick)="process('REJECTED')" />
                </div>
                @if (errorMsg()) {
                  <div class="rd-error-banner" role="alert">{{ errorMsg() }}</div>
                }
              </daf-card>
            }

            <!-- Generate document (officer + approved + document type) -->
            @if (isDocumentType() && req()!.status === 'APPROVED' && isOfficer()) {
              <daf-card class="block" [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="rd-section-title-plain">{{ 'REQUESTS.DETAIL.DOC_GEN_TITLE' | translate }}</h3>
                <p class="rd-section-desc">
                  {{ 'REQUESTS.DETAIL.DOC_GEN_DESC' | translate }}
                </p>
                <daf-button
                  [label]="'REQUESTS.DETAIL.GENERATE_DOC' | translate"
                  variant="teal"
                  [options]="{ iconStart: 'picture_as_pdf', disabled: generating(), loading: generating() }"
                  (onClick)="generateDocument()" />
              </daf-card>
            }

          </div><!-- /rd-right -->
        </div><!-- /rd-grid -->
      </div><!-- /rd-page -->

    }
  `,
  styleUrl: './request-detail.component.scss',
})
export class RequestDetailComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private confirm = inject(ConfirmService);
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
