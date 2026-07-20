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
  ],
  template: `
    @if (loading()) {
      <div class="rd-loading-wrap"><app-spinner size="lg" /></div>
    } @else if (!req()) {
      <div class="rd-error-state">
        <span class="material-symbols-outlined rd-error-icon">search_off</span>
        <p>Demande introuvable.</p>
        <a routerLink="/requests" class="rd-btn-ghost">Retour aux demandes</a>
      </div>
    } @else {

      <div class="rd-page">

        <!-- ── Top bar ──────────────────────────────────────── -->
        <div class="rd-topbar">
          <div class="rd-nav">
            <nav class="rd-breadcrumb">
              <a routerLink="/requests" class="rd-bc-link">Demandes</a>
              <span class="material-symbols-outlined rd-bc-sep">chevron_right</span>
              <span class="rd-bc-current">Demande #{{ requestId }}</span>
            </nav>
            <a routerLink="/requests" class="rd-back">
              <span class="material-symbols-outlined">arrow_back</span>
              Retour aux demandes
            </a>
          </div>
          <div class="rd-topbar-actions">
            @if (req()!.status === 'SUBMITTED' && !isOfficer()) {
              <daf-button label="Annuler la demande" variant="ghost" [options]="{ size: 'sm' }" (onClick)="cancelRequest()" />
            }
            @if (canProcess()) {
              <daf-button label="Prendre en charge" variant="teal" [options]="{ size: 'sm', iconStart: 'task_alt' }" (onClick)="scrollToAction()" />
            }
          </div>
        </div>

        <!-- ── Page title ───────────────────────────────────── -->
        <div class="rd-title-area">
          <div class="rd-title-row">
            <h1 class="rd-title">
              {{ req()!.typeDisplayNameFr ?? 'Demande #' + req()!.requestTypeId }}
            </h1>
            <daf-badge [label]="statusLabel(req()!.status)" [options]="statusBadgeOptions(req()!.status)" />
          </div>
          <div class="rd-meta">
            <span class="rd-meta-chip">
              <span class="material-symbols-outlined">account_circle</span>
              {{ req()!.employeeName ?? ('Profil #' + req()!.employeeProfileId) }}
            </span>
            <span class="rd-meta-chip">
              <span class="material-symbols-outlined">calendar_today</span>
              Soumis le {{ fmtDate(req()!.submissionDate) }}
            </span>
            @if (req()!.assignedOfficerId) {
              <span class="rd-meta-chip">
                <span class="material-symbols-outlined">badge</span>
                Officier #{{ req()!.assignedOfficerId }}
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
                  Motif de la demande
                </h3>
              </div>
              <div class="rd-comment-box">
                <p class="rd-comment-text">
                  @if (req()!.closureComment) {
                    "{{ req()!.closureComment }}"
                  } @else {
                    Aucun commentaire renseigné.
                  }
                </p>
              </div>
            </daf-card>

            <!-- Documents joints -->
            @if (req()!.attachmentUrl) {
              <daf-card class="block" [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
                <h3 class="rd-section-title">
                  <span class="material-symbols-outlined">attachment</span>
                  Documents joints
                </h3>
                <div class="rd-doc-item">
                  <div class="rd-doc-icon">
                    <span class="material-symbols-outlined">picture_as_pdf</span>
                  </div>
                  <div class="rd-doc-meta">
                    <p class="rd-doc-name">Justificatif.pdf</p>
                    <p class="rd-doc-size">{{ fmtDate(req()!.submissionDate) }}</p>
                  </div>
                  <a [href]="req()!.attachmentUrl" target="_blank" download
                     class="rd-doc-download" title="Télécharger">
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
                  Documents générés
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
                          <p class="rd-doc-size">Code : {{ doc.verificationCode }}</p>
                        }
                      </div>
                      <!-- Stream via the Spring endpoint (blob). doc.fileUrl is a
                           server filesystem path, NOT a browser URL — using it as an
                           href downloaded the SPA's index.html as a .htm ("No file"). -->
                      <app-pdf-download-button
                        label="Télécharger"
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
                  Document officiel
                </h3>
                @if (generatedDoc()) {
                  <div class="rd-doc-ready">
                    <span class="material-symbols-outlined">check_circle</span>
                    <p>Document généré le {{ generatedDoc()!.generatedAt | slice:0:10 }}</p>
                    <app-pdf-download-button
                      label="Télécharger"
                      [docId]="generatedDoc()!.id"
                      [filename]="(req()!.typeCode ?? 'document').toLowerCase() + '.pdf'"
                      variant="outline"
                    />
                  </div>
                } @else {
                  <div class="rd-doc-warn">
                    <span class="material-symbols-outlined">warning</span>
                    <p>Le document n'a pas été généré automatiquement.</p>
                    <app-pdf-download-button
                      label="Générer maintenant"
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
              <h3 class="rd-section-title-plain">Historique</h3>
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
                          Délai estimé : {{ step.estimatedDelay }}
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </daf-card>

            <!-- Requérant glass card -->
            <daf-card class="block" [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
              <h3 class="rd-eyebrow">Requérant</h3>
              <div class="rd-requester-row">
                <div class="rd-requester-avatar">
                  <span class="material-symbols-outlined">account_circle</span>
                </div>
                <div>
                  <p class="rd-requester-name">{{ req()!.employeeName ?? ('Profil #' + req()!.employeeProfileId) }}</p>
                  <p class="rd-requester-sub">Employé</p>
                </div>
              </div>
              <div class="rd-requester-details">
                <div class="rd-detail-row">
                  <span class="rd-detail-key">Profil</span>
                  <span class="rd-detail-val">{{ req()!.employeeName ?? ('Profil #' + req()!.employeeProfileId) }}</span>
                </div>
                <div class="rd-detail-row">
                  <span class="rd-detail-key">Pays</span>
                  <span class="rd-detail-val">{{ req()!.paysName ?? ('#' + req()!.paysId) }}</span>
                </div>
              </div>
              @if (isOfficer()) {
                <a [routerLink]="['/profiles', req()!.employeeProfileId]"
                   class="rd-profile-link">
                  Voir le profil complet →
                </a>
              }
            </daf-card>

            <!-- Action panel (officer, processable) -->
            @if (canProcess()) {
              <daf-card class="block" [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }" id="rd-action-panel">
                <h3 class="rd-section-title-plain">Action de traitement</h3>
                <daf-form-field
                  [options]="{ label: 'Commentaire', required: true, type: 'textarea', rows: 3, placeholder: 'Préciser la décision…', fullWidth: true }"
                  [value]="actionComment"
                  (valueChange)="actionComment = $any($event) ?? ''" />
                <div class="rd-action-btns">
                  <daf-button
                    label="Approuver"
                    variant="teal"
                    [options]="{ iconStart: 'check_circle', disabled: !actionComment.trim() || saving(), loading: saving() }"
                    (onClick)="process('APPROVED')" />
                  <daf-button
                    label="Refuser"
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
                <h3 class="rd-section-title-plain">Génération de document</h3>
                <p class="rd-section-desc">
                  Générer le document officiel depuis le modèle défini.
                </p>
                <daf-button
                  label="Générer le document"
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
    const r = this.req();
    if (!r) return [];

    const steps: TimelineStep[] = [
      {
        label: 'Soumis',
        done: true,
        date: r.submissionDate,
        msg: 'La demande a été enregistrée dans notre système.',
      },
    ];

    if (r.status === 'CANCELLED') {
      steps.push({ label: 'Annulée', done: true, rejected: true, date: r.updatedAt ?? null, msg: r.closureComment ?? 'La demande a été annulée.' });
      return steps;
    }

    const inReviewDone = ['IN_REVIEW', 'PENDING_L2', 'APPROVED', 'REJECTED'].includes(r.status);
    steps.push({
      label: r.status === 'PENDING_L2' ? 'Attente validation L2' : 'En traitement',
      done: inReviewDone,
      date: null,
      msg: inReviewDone ? 'Demande prise en charge.' : null,
      estimatedDelay: !inReviewDone ? '24h' : undefined,
    });

    const finalDone = r.status === 'APPROVED' || r.status === 'REJECTED';
    steps.push({
      label: r.status === 'REJECTED' ? 'Refusée' : 'Décision finale',
      done: finalDone,
      rejected: r.status === 'REJECTED',
      date: r.resolutionDate ?? null,
      msg: finalDone
        ? (r.closureComment ?? (r.status === 'APPROVED' ? 'Demande approuvée.' : 'Demande refusée.'))
        : null,
    });

    return steps;
  });

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
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
      title: 'Annuler la demande',
      message: 'Annuler cette demande ?',
      confirmLabel: 'Annuler la demande', cancelLabel: 'Retour',
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
        this.errorMsg.set(err?.error?.message ?? 'Erreur lors du traitement');
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
