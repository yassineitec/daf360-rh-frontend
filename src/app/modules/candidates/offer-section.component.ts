import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import {
  ButtonComponent,
  FormFieldComponent,
  FormFieldOptions,
  MultiDatePickerComponent,
  StatusBadgeComponent,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalComponent } from '../../shared/modal.component';
import { OfferService, OfferResponse, CreateOfferRequest } from '../pipeline/services/offer.service';
import { isoToDate, dateToIso } from '../../shared/date-picker.utils';

/**
 * Offer / salary-negotiation panel for the candidate detail page. Shows the
 * current offer (if any) and drives the lifecycle: send (from ACCEPTED),
 * renegotiate / accept / refuse while the offer is SENT.
 */
@Component({
  selector: 'app-offer-section',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, FormFieldComponent, MultiDatePickerComponent, StatusBadgeComponent, TranslatePipe],
  templateUrl: './offer-section.component.html',
})
export class OfferSectionComponent {
  private offerService = inject(OfferService);

  readonly candidateId   = input.required<number>();
  readonly status        = input.required<string>();
  readonly candidateName  = input<string>('');
  readonly changed        = output<void>();

  readonly offer     = signal<OfferResponse | null>(null);
  readonly loading   = signal(true);
  readonly actionError = signal<string | null>(null);

  // ── Modal state ───────────────────────────────────────────────────────────
  readonly showOfferModal   = signal(false);
  readonly offerMode        = signal<'send' | 'renegotiate'>('send');
  readonly offerSubmitting  = signal(false);
  offerForm: CreateOfferRequest = {};

  readonly showRejectModal  = signal(false);
  readonly rejectSubmitting = signal(false);
  rejectReason = '';

  readonly actioning = signal(false);

  readonly salaryFieldOpts: FormFieldOptions = { type: 'number', placeholder: '0', fullWidth: true };
  readonly noteFieldOpts:   FormFieldOptions = { type: 'text', placeholder: 'Avantages, prime, devise…', fullWidth: true };
  readonly reasonFieldOpts: FormFieldOptions = { type: 'textarea', placeholder: 'Motif du refus…', rows: 3, fullWidth: true };

  constructor() {
    // Reload the offer whenever the candidate changes.
    effect(() => {
      const id = this.candidateId();
      if (id) this.load(id);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.offerService.getOffer(id).subscribe({
      next: o  => { this.offer.set(o); this.loading.set(false); },
      error: () => { this.offer.set(null); this.loading.set(false); }, // 404 = no offer yet
    });
  }

  /** ACCEPTED candidate with no offer → can extend one. */
  get canSend(): boolean {
    return this.status() === 'ACCEPTED' && this.offer() === null;
  }

  /** Offer still open (awaiting the candidate's decision). */
  get isPending(): boolean {
    return this.offer()?.status === 'SENT';
  }

  // ── Send / renegotiate ─────────────────────────────────────────────────────
  openOfferModal(mode: 'send' | 'renegotiate'): void {
    this.actionError.set(null);
    this.offerMode.set(mode);
    const o = this.offer();
    this.offerForm = mode === 'renegotiate' && o
      ? { askedSalary: o.askedSalary, proposedSalary: o.proposedSalary, salaryNote: o.salaryNote,
          expectedHireDate: o.expectedHireDate, expiryDate: o.expiryDate }
      : { askedSalary: null, proposedSalary: null, salaryNote: null, expectedHireDate: null, expiryDate: null };
    this.showOfferModal.set(true);
  }

  submitOffer(): void {
    const id = this.candidateId();
    this.offerSubmitting.set(true);
    this.actionError.set(null);
    const renegotiate = this.offerMode() === 'renegotiate';
    const call = renegotiate
      ? this.offerService.renegotiateOffer(id, this.offerForm)
      : this.offerService.sendOffer(id, this.offerForm);
    call.subscribe({
      next: () => { this.offerSubmitting.set(false); this.showOfferModal.set(false); this.load(id); this.changed.emit(); },
      error: err => { this.offerSubmitting.set(false); this.actionError.set(err?.error?.detail ?? err?.error?.message ?? "Erreur lors de l'envoi de l'offre."); },
    });
  }

  acceptOffer(): void {
    const id = this.candidateId();
    this.actioning.set(true);
    this.actionError.set(null);
    this.offerService.acceptOffer(id).subscribe({
      next: () => { this.actioning.set(false); this.load(id); this.changed.emit(); },
      error: err => { this.actioning.set(false); this.actionError.set(err?.error?.detail ?? "Erreur lors de l'acceptation."); },
    });
  }

  // ── Refuse ─────────────────────────────────────────────────────────────────
  openRejectModal(): void {
    this.actionError.set(null);
    this.rejectReason = '';
    this.showRejectModal.set(true);
  }

  submitReject(): void {
    if (!this.rejectReason.trim()) return;
    const id = this.candidateId();
    this.rejectSubmitting.set(true);
    this.offerService.rejectOffer(id, this.rejectReason.trim()).subscribe({
      next: () => { this.rejectSubmitting.set(false); this.showRejectModal.set(false); this.load(id); this.changed.emit(); },
      error: err => { this.rejectSubmitting.set(false); this.actionError.set(err?.error?.detail ?? "Erreur lors du refus."); },
    });
  }

  // ── Field handlers ──────────────────────────────────────────────────────────
  private asNum(v: string | number | null): number | null {
    if (v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return isNaN(n) ? null : n;
  }
  private asStr(v: string | number | null): string | null {
    return v === null || v === '' ? null : String(v);
  }
  onAskedChange(v: string | number | null):    void { this.offerForm.askedSalary = this.asNum(v); }
  onProposedChange(v: string | number | null): void { this.offerForm.proposedSalary = this.asNum(v); }
  onNoteChange(v: string | number | null):     void { this.offerForm.salaryNote = this.asStr(v); }
  onReasonChange(v: string | number | null):   void { this.rejectReason = typeof v === 'string' ? v : ''; }

  // Date fields use the lib multi-date-picker (single mode) ↔ ISO strings.
  getHireDate(): Date | null { return isoToDate(this.offerForm.expectedHireDate ?? null); }
  setHireDate(v: Date | Date[] | null): void { this.offerForm.expectedHireDate = dateToIso(v) || null; }
  getExpiryDate(): Date | null { return isoToDate(this.offerForm.expiryDate ?? null); }
  setExpiryDate(v: Date | Date[] | null): void { this.offerForm.expiryDate = dateToIso(v) || null; }

  // ── Display ──────────────────────────────────────────────────────────────────
  formatSalary(v: number | null): string {
    if (v == null) return '—';
    return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' DT';
  }
  formatDate(d: string | null): string {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
