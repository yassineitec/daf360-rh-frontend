import {
  Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { catchError, of } from 'rxjs';

import { RequestsService }      from './requests.service';
import { EmployeeRequest, GeneratedDocument } from './models/request.model';
import { ApprovalTimelineComponent } from '../../shared/approval-timeline.component';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { SpinnerComponent }          from '../../shared/spinner.component';
import { UserStore }                 from '../../core/user.store';
import { PdfDownloadButtonComponent } from '../../shared/pdf-download-button/pdf-download-button.component';
import { PdfDownloadService, GeneratedDocumentResponse } from '../../core/pdf/pdf-download.service';

@Component({
  selector: 'app-request-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, SlicePipe, ApprovalTimelineComponent, StatusBadgeComponent, SpinnerComponent, PdfDownloadButtonComponent],
  template: `
    <nav class="breadcrumb">
      <a routerLink="/requests" class="bc-link">Demandes</a>
      <span class="bc-sep">›</span>
      <span class="bc-current">Demande #{{ requestId }}</span>
    </nav>

    @if (loading()) {
      <div class="center-spinner"><app-spinner size="lg" /></div>
    } @else if (!req()) {
      <div class="error-state">
        <p>Demande introuvable.</p>
        <a routerLink="/requests" class="btn-ghost">Retour</a>
      </div>
    } @else {

      <div class="detail-layout">

        <!-- ── Left col: request info + timeline ─────────────── -->
        <div class="left-col">

          <!-- Header -->
          <div class="req-header card">
            <div class="req-title-row">
              <h1 class="req-title">{{ req()!.typeDisplayNameFr ?? 'Demande #' + req()!.requestTypeId }}</h1>
              <daf-badge [label]="statusBadge(req()!.status).label" [options]="statusBadge(req()!.status).options" />
            </div>
            <div class="req-meta">
              <span class="meta-chip">Profil #{{ req()!.employeeProfileId }}</span>
              <span class="meta-chip">Soumis le {{ fmtDate(req()!.submissionDate) }}</span>
              @if (req()!.assignedOfficerId) {
                <span class="meta-chip">Officier #{{ req()!.assignedOfficerId }}</span>
              }
            </div>
            @if (req()!.closureComment) {
              <div class="closure-comment">
                <span class="comment-label">Commentaire de clôture</span>
                <p>"{{ req()!.closureComment }}"</p>
              </div>
            }
          </div>

          <!-- Approval timeline -->
          <div class="card timeline-card">
            <h2 class="section-title">Historique</h2>
            <app-approval-timeline [request]="req()!" />
          </div>

          <!-- Documents -->
          @if (req()!.status === 'APPROVED' && documents().length > 0) {
            <div class="card docs-card">
              <h2 class="section-title">Document{{ documents().length > 1 ? 's' : '' }} générés</h2>
              <ul class="doc-list">
                @for (doc of documents(); track doc.id) {
                  <li class="doc-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <div class="doc-meta">
                      <span class="doc-name">{{ doc.documentType }}</span>
                      <span class="doc-code">Code de vérification: {{ doc.verificationCode ?? '—' }}</span>
                    </div>
                    <a [href]="doc.fileUrl" target="_blank" download class="download-btn">Télécharger</a>
                  </li>
                }
              </ul>
            </div>
          }
        </div>

        <!-- ── Right col: officer action panel (HR only) ──────── -->
        @if (isOfficer()) {
          <div class="right-col">

            <!-- Profile summary card -->
            <div class="card profile-summary">
              <h2 class="section-title">Employé</h2>
              <div class="profile-line">
                <span class="profile-label">Profil ID</span>
                <span>{{ req()!.employeeProfileId }}</span>
              </div>
              <a [routerLink]="['/profiles', req()!.employeeProfileId]"
                 class="profile-link">Voir le profil complet →</a>
            </div>

            <!-- Action panel -->
            @if (canProcess()) {
              <div class="card action-panel">
                <h2 class="section-title">Action de traitement</h2>

                <label class="form-label">Commentaire *</label>
                <textarea
                  class="form-input"
                  [(ngModel)]="actionComment"
                  placeholder="Préciser la décision…"
                  rows="3"
                ></textarea>

                <div class="action-btns">
                  <button
                    class="btn-approve" type="button"
                    [disabled]="!actionComment.trim() || saving()"
                    (click)="process('APPROVED')"
                  >
                    @if (saving()) { <app-spinner size="sm" /> }
                    ✓ Approuver
                  </button>
                  <button
                    class="btn-reject" type="button"
                    [disabled]="!actionComment.trim() || saving()"
                    (click)="process('REJECTED')"
                  >
                    ✕ Refuser
                  </button>
                </div>

                @if (errorMsg()) {
                  <div class="error-banner" role="alert">{{ errorMsg() }}</div>
                }
              </div>
            }

            <!-- Generate document button (DOCUMENT category, after approval) -->
            @if (isDocumentType() && req()!.status === 'APPROVED' && isOfficer()) {
              <div class="card action-panel">
                <h2 class="section-title">Génération de document</h2>
                <p class="section-desc">Générer le document officiel depuis le modèle défini.</p>
                <button
                  class="btn-generate" type="button"
                  [disabled]="generating()"
                  (click)="generateDocument()"
                >
                  @if (generating()) { <app-spinner size="sm" /> }
                  Générer le document
                </button>
              </div>
            }

          </div>
        }

        <!-- ── Doc section (left col, document requests only) ──────── -->
        @if (isDocumentRequest() && req()!.status === 'APPROVED') {
          <div class="left-col" style="margin-top:0">
            <div class="doc-section card">
              <h3 class="doc-section-title">Document genere</h3>
              @if (generatedDoc()) {
                <div class="doc-card doc-card-ready">
                  <p>Document genere automatiquement le {{ generatedDoc()!.generatedAt | slice:0:10 }}</p>
                  <app-pdf-download-button
                    label="Telecharger"
                    [endpoint]="'/api/hr/documents/download/' + generatedDoc()!.id"
                    [body]="null"
                    [filename]="(req()!.typeCode ?? 'document').toLowerCase() + '.pdf'"
                    variant="outline"
                  />
                </div>
              } @else {
                <div class="doc-card doc-card-warn">
                  <p>Le document n'a pas ete genere automatiquement.</p>
                  <app-pdf-download-button
                    label="Generer maintenant"
                    [endpoint]="getDocEndpoint(req()!.typeCode ?? '')"
                    [body]="{ employeeProfileId: req()!.employeeProfileId, requestId: req()!.id }"
                    [filename]="(req()!.typeCode ?? 'document').toLowerCase() + '.pdf'"
                    variant="primary"
                  />
                </div>
              }
            </div>
          </div>
        }

      </div>
    }
  `,
  styles: [`
    .breadcrumb { display:flex;align-items:center;gap:6px;padding:16px 24px 0;font-size:12px }
    .bc-link    { color:var(--color-primary,#1C4E5C);text-decoration:none }
    .bc-link:hover { text-decoration:underline }
    .bc-sep,.bc-current { color:var(--color-text-muted,#6B7280) }
    .center-spinner { display:flex;justify-content:center;padding:64px }
    .error-state    { text-align:center;padding:48px;color:var(--color-text-muted) }
    .detail-layout  { display:grid;grid-template-columns:1fr 320px;gap:16px;padding:16px 24px 24px }
    @media(max-width:900px) { .detail-layout { grid-template-columns:1fr } }
    .left-col,.right-col { display:flex;flex-direction:column;gap:12px }
    .card { background:var(--color-surface,#fff);border:1px solid var(--color-border,#E0E7E9);border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.08) }
    .section-title  { font-size:13px;font-weight:700;color:var(--color-text,#1A1C1E);margin:0 0 14px }
    .section-desc   { font-size:12px;color:var(--color-text-muted);margin:0 0 12px }
    .req-title-row  { display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px }
    .req-title      { font-family:var(--font-display,'DM Serif Display',serif);font-size:19px;font-weight:400;margin:0 }
    .req-meta       { display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px }
    .meta-chip      { display:inline-block;padding:2px 10px;border-radius:999px;background:var(--color-bg-secondary,#EEF2F5);font-size:12px;color:var(--color-text-muted,#6B7280) }
    .closure-comment { margin-top:12px;padding-top:12px;border-top:1px solid var(--color-border) }
    .comment-label  { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-muted);display:block;margin-bottom:4px }
    .closure-comment p { font-size:13px;color:var(--color-text-muted);font-style:italic;margin:0 }
    .timeline-card  { padding:20px }
    .doc-list       { list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px }
    .doc-item       { display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--color-border);border-radius:8px }
    .doc-meta       { flex:1;display:flex;flex-direction:column }
    .doc-name       { font-size:13px;font-weight:500 }
    .doc-code       { font-size:11px;color:var(--color-text-muted);font-family:monospace }
    .download-btn   { padding:4px 10px;border:1px solid var(--color-primary);border-radius:6px;color:var(--color-primary);text-decoration:none;font-size:12px;font-weight:600 }
    .download-btn:hover { background:var(--color-teal-50) }
    .profile-summary {}
    .profile-line   { display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--color-border) }
    .profile-label  { font-weight:600;color:var(--color-text-muted) }
    .profile-link   { display:block;margin-top:12px;font-size:13px;color:var(--color-primary);text-decoration:none;font-weight:500 }
    .profile-link:hover { text-decoration:underline }
    .action-panel   {}
    .form-label     { font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-muted);display:block;margin-bottom:6px }
    .form-input     { padding:8px 12px;border:1px solid var(--color-border);border-radius:8px;font-size:13px;font-family:inherit;background:var(--color-surface);color:var(--color-text);outline:none;width:100%;resize:vertical }
    .form-input:focus { border-color:var(--color-primary) }
    .action-btns    { display:flex;gap:8px;margin-top:12px }
    .btn-approve { flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;background:#16A34A;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer }
    .btn-approve:disabled { opacity:.5;cursor:not-allowed }
    .btn-reject  { flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;background:#DC2626;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer }
    .btn-reject:disabled  { opacity:.5;cursor:not-allowed }
    .btn-generate { width:100%;padding:10px;background:var(--color-primary,#1C4E5C);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px }
    .btn-generate:disabled { opacity:.5;cursor:not-allowed }
    .error-banner { margin-top:10px;padding:10px 14px;border-radius:8px;background:#fee2e2;color:#991b1b;font-size:12px }
    .btn-ghost    { padding:7px 14px;border:1px solid var(--color-border);border-radius:8px;background:none;font-size:13px;cursor:pointer;color:var(--color-text-muted);text-decoration:none }
    .doc-section  { }
    .doc-section-title { font-size:13px;font-weight:700;color:var(--color-text);margin:0 0 12px }
    .doc-card     { border-radius:8px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap }
    .doc-card p   { font-size:12px;margin:0;flex:1 }
    .doc-card-ready { background:#f0fdf4;border:1px solid #bbf7d0 }
    .doc-card-ready p { color:#15803d }
    .doc-card-warn  { background:#fffbeb;border:1px solid #fde68a }
    .doc-card-warn p { color:#92400e }
  `],
})
export class RequestDetailComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private svc       = inject(RequestsService);
  private userStore = inject(UserStore);
  private pdfSvc    = inject(PdfDownloadService);

  requestId  = 0;
  loading    = signal(true);
  saving     = signal(false);
  generating = signal(false);
  req        = signal<EmployeeRequest | null>(null);
  documents  = signal<GeneratedDocument[]>([]);
  errorMsg   = signal<string | null>(null);
  generatedDoc = signal<GeneratedDocumentResponse | null>(null);
  actionComment = '';
  protected readonly statusBadge = statusBadge;

  readonly DOCUMENT_TYPES = [
    'ATTESTATION_TRAVAIL',
    'ATTESTATION_SALAIRE',
    'ATTESTATION_NON_BENEFICE_PRET',
    'ATTESTATION_TITULARISATION',
    'ATTESTATION_DOMICILIATION_SALAIRE',
  ];

  isOfficer      = computed(() => this.userStore.isHrManager() || this.userStore.isAdmin());
  canProcess     = computed(() => {
    const s = this.req()?.status;
    return this.isOfficer() && (s === 'SUBMITTED' || s === 'IN_REVIEW' || s === 'PENDING_L2');
  });
  isDocumentType = computed(() => false); // Would check type category; placeholder
  isDocumentRequest = computed(() => {
    const r = this.req();
    return r ? this.DOCUMENT_TYPES.includes(r.typeCode ?? '') : false;
  });

  private officerId = computed(() => this.userStore.currentUser()?.userId ?? 0);

  getDocEndpoint(typeCode: string): string {
    const map: Record<string, string> = {
      'ATTESTATION_TRAVAIL':                '/api/hr/documents/attestation-travail',
      'ATTESTATION_SALAIRE':                '/api/hr/documents/attestation-salaire',
      'ATTESTATION_NON_BENEFICE_PRET':      '/api/hr/documents/attestation-non-benefice-pret',
      'ATTESTATION_TITULARISATION':         '/api/hr/documents/attestation-titularisation',
      'ATTESTATION_DOMICILIATION_SALAIRE':  '/api/hr/documents/attestation-domiciliation-salaire',
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
              .subscribe({ next: doc => this.generatedDoc.set(doc as GeneratedDocumentResponse), error: () => this.generatedDoc.set(null) });
          }
        }
      });
  }

  private loadDocuments() {
    this.svc.listDocuments(this.requestId).pipe(catchError(() => of([])))
      .subscribe(docs => this.documents.set(docs));
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

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }
}
