import {
  Component, DestroyRef, TemplateRef, ViewChild, computed, effect, inject, input, output, signal, untracked,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { ButtonComponent, ModalRef, ModalService } from '@khalilrebhiitec/daf360';

import { CandidateService } from './candidate.service';

/**
 * « Prévisualiser le CV » — the candidate's CV in a resizable, maximizable window, at full
 * size, with Télécharger and (for whoever may edit the record) Remplacer.
 *
 * Replaces the inline preview of the left column and the CV tab: the page keeps its space
 * for the record, and the CV opens big enough to read.
 *
 * The file is fetched as a blob through HttpClient (the endpoint wants the rh Bearer token,
 * which only the interceptor adds) and re-typed application/pdf so the browser renders it
 * instead of offering a download. Only a PDF can be previewed; DOC / DOCX get a message and
 * the download. A replaced file (new upload date) is refetched while the window is open.
 *
 * Mounted once at the page root, opened with `open()`.
 */
@Component({
  selector: 'app-candidate-cv-modal',
  standalone: true,
  imports: [TranslatePipe, ButtonComponent],
  template: `
    <ng-template #tpl>
      <div class="cvm">
        <div class="cvm-bar">
          <div class="cvm-file">
            <span class="material-symbols-outlined cvm-file-icon">{{ isPdf() ? 'picture_as_pdf' : 'article' }}</span>
            <div class="cvm-file-text">
              <span class="cvm-name">{{ fileName() || ('CANDIDATES.CV_MODAL.NO_FILE' | translate) }}</span>
              @if (uploadedAt()) {
                <span class="cvm-date">{{ 'CANDIDATES.DETAIL.CV_UPLOADED_ON' | translate:{ date: uploadedOn() } }}</span>
              }
            </div>
          </div>
          <div class="cvm-actions">
            @if (fileName()) {
              <daf-button
                [options]="{ variant: 'secondary', size: 'sm', iconStart: 'download',
                             label: ('CANDIDATES.DETAIL.DOWNLOAD' | translate) }"
                (onClick)="download.emit()" />
            }
            @if (canReplace()) {
              <input #cvInput type="file" class="cvm-hidden"
                     accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                     (change)="fileSelected.emit($event)" />
              <daf-button
                [options]="{ variant: 'teal', size: 'sm', iconStart: 'upload_file',
                             label: ((fileName() ? 'CANDIDATES.CV_MODAL.REPLACE' : 'CANDIDATES.CV_MODAL.UPLOAD') | translate),
                             loading: uploading(), disabled: uploading() }"
                (onClick)="cvInput.click()" />
            }
          </div>
        </div>

        @if (error()) {
          <div class="cvm-msg cvm-msg--error">{{ error() }}</div>
        } @else if (success()) {
          <div class="cvm-msg cvm-msg--ok">{{ success() }}</div>
        }

        <div class="cvm-view">
          @if (!fileName()) {
            <p class="cvm-empty">{{ 'CANDIDATES.DETAIL.NO_CV_HINT' | translate }}</p>
          } @else if (!isPdf()) {
            <p class="cvm-empty">{{ 'CANDIDATES.DETAIL.CV_PREVIEW_PDF_ONLY' | translate }}</p>
          } @else if (loading()) {
            <p class="cvm-empty">{{ 'CANDIDATES.DETAIL.CV_PREVIEW_LOADING' | translate }}</p>
          } @else if (failed()) {
            <p class="cvm-empty cvm-empty--error">{{ 'CANDIDATES.DETAIL.CV_PREVIEW_ERROR' | translate }}</p>
          } @else if (safeUrl(); as src) {
            <iframe class="cvm-frame" [src]="src" [title]="fileName()"></iframe>
          }
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .cvm        { display:flex; flex-direction:column; gap:12px; height:100%; min-height:60vh; }
    .cvm-bar    { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
    .cvm-file   { display:flex; align-items:center; gap:10px; min-width:0; }
    .cvm-file-icon { font-size:22px; color:var(--color-on-tertiary-container); background:var(--color-tertiary-container);
                     border-radius:10px; padding:8px; font-variation-settings:'FILL' 1; }
    .cvm-file-text { display:flex; flex-direction:column; min-width:0; }
    .cvm-name   { font-size:13px; font-weight:600; color:var(--color-on-surface); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cvm-date   { font-size:11px; color:var(--color-outline); }
    .cvm-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .cvm-hidden { display:none; }
    .cvm-msg    { padding:8px 12px; border-radius:8px; font-size:12.5px; }
    .cvm-msg--error { color:var(--color-danger); background:color-mix(in srgb, var(--color-danger) 10%, transparent); }
    .cvm-msg--ok    { color:var(--color-success); background:color-mix(in srgb, var(--color-success) 10%, transparent); }
    .cvm-view   { flex:1 1 auto; display:flex; min-height:0; border:1px solid var(--color-outline-variant);
                  border-radius:12px; overflow:hidden; background:var(--color-surface-container-low); }
    .cvm-frame  { flex:1 1 auto; width:100%; min-height:60vh; border:0; background:var(--color-surface); }
    .cvm-empty  { margin:auto; padding:24px; text-align:center; font-size:13px; color:var(--color-on-surface-variant); }
    .cvm-empty--error { color:var(--color-danger); }
  `],
})
export class CandidateCvModalComponent {
  @ViewChild('tpl', { static: true }) private tpl!: TemplateRef<unknown>;

  private readonly modal            = inject(ModalService);
  private readonly translate        = inject(TranslateService);
  private readonly candidateService = inject(CandidateService);
  private readonly sanitizer        = inject(DomSanitizer);

  readonly candidateId = input.required<number>();
  readonly fileName    = input<string | null>(null);
  readonly uploadedAt  = input<string | null>(null);
  /** Remplacer is offered only to whoever may edit the record. */
  readonly canReplace  = input(false);
  /** Upload state, owned by the page (it holds the upload call and the refreshed record). */
  readonly uploading   = input(false);
  readonly error       = input<string | null>(null);
  readonly success     = input<string | null>(null);

  readonly download     = output<void>();
  readonly fileSelected = output<Event>();

  private modalRef: ModalRef | null = null;
  private readonly isOpen = signal(false);

  protected readonly loading   = signal(false);
  protected readonly failed    = signal(false);
  private readonly objectUrl   = signal<string | null>(null);
  private sub?: Subscription;

  protected readonly isPdf = computed(() => (this.fileName() ?? '').toLowerCase().endsWith('.pdf'));
  protected readonly safeUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.objectUrl();
    // Full width page, the viewer's own toolbar kept (zoom, pages, print).
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url + '#view=FitH') : null;
  });

  constructor() {
    // Fetch while open, and again when the file is replaced (new upload date).
    effect(() => {
      const open = this.isOpen();
      const id = this.candidateId();
      const pdf = this.isPdf();
      this.uploadedAt();
      untracked(() => (open ? this.load(id, pdf) : this.release()));
    });
    inject(DestroyRef).onDestroy(() => { this.modalRef?.close(); this.release(); });
  }

  open(): void {
    if (this.modalRef) return;
    this.modalRef = this.modal.open({
      title: this.translate.instant('CANDIDATES.CV_MODAL.TITLE'),
      icon: 'description',
      body: this.tpl,
      width: 'min(1100px, 90vw)',
      height: '88vh',
      closeOnBackdrop: true,
      minWidth: '360px',
      minHeight: '320px',
      resizable: true,
      maximizable: true,
    });
    // ✕, backdrop and close() all end in _destroy(): free the blob there.
    const destroy = this.modalRef._destroy.bind(this.modalRef);
    this.modalRef._destroy = () => {
      destroy();
      this.modalRef = null;
      this.isOpen.set(false);
    };
    this.isOpen.set(true);
  }

  protected uploadedOn(): string {
    return this.uploadedAt()?.slice(0, 10) ?? '—';
  }

  private load(id: number, pdf: boolean): void {
    this.release();
    this.failed.set(false);
    if (!pdf || !this.fileName()) { this.loading.set(false); return; }
    this.loading.set(true);
    this.sub = this.candidateService.getCvBlob(id).subscribe({
      next: blob => {
        this.objectUrl.set(URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })));
        this.loading.set(false);
      },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }

  private release(): void {
    this.sub?.unsubscribe();
    const url = this.objectUrl();
    if (url) URL.revokeObjectURL(url);
    this.objectUrl.set(null);
  }
}
