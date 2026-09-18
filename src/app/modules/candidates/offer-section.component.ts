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
import { SectionCardComponent } from '../../shared/detail/section-card.component';
import { OfferService, OfferResponse, CreateOfferRequest } from '../pipeline/services/offer.service';
import {
  CandidateCostApprovalDto, PayrollSimulationResult, PayrollSimulationService,
} from './payroll-simulation.service';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { isoToDate, dateToIso } from '../../shared/date-picker.utils';

/**
 * Offer / salary-negotiation panel for the candidate detail page.
 *
 * <p>Drives the whole round lifecycle (V98):
 *
 * <pre>
 *   Chiffrer   → simulate the employer cost, save → a DRAFT round + a pending finance decision
 *   (finance approves, in /finance/cost/approval)
 *   Envoyer    → the approved round goes to the candidate
 *   Renégocier → a NEW round, superseding this one, back through the same gate
 * </pre>
 *
 * <p>The salary fields are no longer free text that goes straight to the candidate: a round
 * cannot be saved without a simulation, and cannot be sent without an approval on that exact
 * figure. Every round survives as its own row, so the panel can show the negotiation history
 * instead of only its last state.
 */
@Component({
  selector: 'app-offer-section',
  standalone: true,
  imports: [
    ModalComponent, SectionCardComponent, ButtonComponent, FormFieldComponent,
    MultiDatePickerComponent, StatusBadgeComponent, TranslatePipe,
  ],
  templateUrl: './offer-section.component.html',
})
export class OfferSectionComponent {
  private offerService   = inject(OfferService);
  private simulationSvc  = inject(PayrollSimulationService);
  private listSvc        = inject(ConfigurableListService);

  readonly candidateId   = input.required<number>();
  readonly status        = input.required<string>();
  readonly candidateName  = input<string>('');
  /** Needed by the payroll engine — the parameter set is per entity. */
  readonly paysId         = input.required<number>();
  /** Resolves to the engine's contract code via the EMPLOYMENT_TYPE list. */
  readonly employmentTypeId = input<number | null>(null);
  readonly changed        = output<void>();

  readonly offer     = signal<OfferResponse | null>(null);
  readonly rounds    = signal<OfferResponse[]>([]);
  readonly approvals = signal<CandidateCostApprovalDto[]>([]);
  readonly loading   = signal(true);
  readonly actionError = signal<string | null>(null);

  // ── Modal state ───────────────────────────────────────────────────────────
  readonly showOfferModal   = signal(false);
  readonly offerMode        = signal<'send' | 'renegotiate'>('send');
  readonly offerSubmitting  = signal(false);
  offerForm: CreateOfferRequest = { simulationSnapshot: '' };

  // ── Simulation, inside the modal ──────────────────────────────────────────
  readonly simulating   = signal(false);
  readonly simResult     = signal<PayrollSimulationResult | null>(null);
  readonly simError      = signal<string | null>(null);
  /** The engine's code for this candidate's employment type; CDI until the list lands. */
  private readonly contractCode = signal<string>('CDI');

  /** Saving is refused without a costing — the same rule the backend enforces. */
  readonly canSave = computed(() =>
    this.simResult() !== null && (this.offerForm.proposedSalary ?? null) !== null);

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
    // The payroll engine speaks contract CODES (CDI/CDD/…), the candidate carries an
    // EMPLOYMENT_TYPE list id. Same resolution the cost-simulation panel does.
    effect(() => {
      const pays = this.paysId();
      const typeId = this.employmentTypeId();
      if (!pays || typeId == null) return;
      this.listSvc.getListValues('EMPLOYMENT_TYPE', pays).subscribe(values => {
        const match = values.find(v => v.id === typeId);
        if (match?.payrollContractCode) this.contractCode.set(match.payrollContractCode);
      });
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.offerService.getOffer(id).subscribe({
      next: o  => { this.offer.set(o); this.loading.set(false); },
      error: () => { this.offer.set(null); this.loading.set(false); }, // 404 = no round yet
    });
    // Rounds and approvals degrade to empty rather than blocking the panel: they are
    // history and status, not the offer itself.
    this.offerService.getRounds(id).subscribe({
      next: r => this.rounds.set(r), error: () => this.rounds.set([]),
    });
    this.simulationSvc.getByCandidate(id).subscribe({
      next: a => this.approvals.set(a), error: () => this.approvals.set([]),
    });
  }

  /** ACCEPTED candidate with no round yet → can prepare a first offer. */
  get canSend(): boolean {
    return this.status() === 'ACCEPTED' && this.offer() === null;
  }

  /** Offer with the candidate, awaiting their decision. */
  get isPending(): boolean {
    return this.offer()?.status === 'SENT';
  }

  /** Costed and waiting on finance — or waiting on RH to send it once approved. */
  get isDraft(): boolean {
    return this.offer()?.status === 'DRAFT';
  }

  /** The finance decision on the CURRENT round, or null when none was recorded. */
  readonly currentApproval = computed<CandidateCostApprovalDto | null>(() => {
    const o = this.offer();
    if (!o) return null;
    return this.approvals().find(a => a.jobOfferId === o.id) ?? null;
  });

  /** PENDING | APPROVED | REJECTED for the current round; null when it has no approval. */
  readonly approvalStatus = computed(() => this.currentApproval()?.status ?? null);

  /** The gate: only an approved DRAFT round may be extended to the candidate. */
  readonly canSendToCandidate = computed(() =>
    this.isDraft && this.approvalStatus() === 'APPROVED');

  // ── Draft / renegotiate a round ────────────────────────────────────────────
  openOfferModal(mode: 'send' | 'renegotiate'): void {
    this.actionError.set(null);
    this.simError.set(null);
    this.simResult.set(null);
    this.offerMode.set(mode);
    const o = this.offer();
    /*
     * A renegotiation starts from the round it replaces — including a counter-proposal, if
     * finance made one: that figure is what they said they WOULD approve, so it is the most
     * useful number to open on. Falls back to the previous round's own proposal.
     */
    const counter = this.currentApproval()?.contrePropSalaire ?? null;
    this.offerForm = mode === 'renegotiate' && o
      ? { askedSalary: o.askedSalary, proposedSalary: counter ?? o.proposedSalary,
          salaryNote: o.salaryNote, noticePeriodDays: o.noticePeriodDays,
          noticePeriodNote: o.noticePeriodNote,
          expectedHireDate: o.expectedHireDate, expiryDate: o.expiryDate,
          simulationSnapshot: '' }
      : { askedSalary: null, proposedSalary: null, salaryNote: null,
          expectedHireDate: null, expiryDate: null, simulationSnapshot: '' };
    this.showOfferModal.set(true);
  }

  /**
   * Costs the proposed salary through the payroll engine.
   *
   * Must run before saving: the result is what finance approves, and the backend refuses a
   * round without it. Changing the salary afterwards clears the result (see
   * `onProposedChange`) so a stale costing can never be attached to a different figure.
   */
  simulate(): void {
    const net = this.offerForm.proposedSalary;
    if (net == null || net <= 0) return;
    this.simulating.set(true);
    this.simError.set(null);
    this.simResult.set(null);
    this.simulationSvc.simulateFromNet({
      paysId:       this.paysId(),
      inputNet:     net,
      contractType: this.contractCode(),
    }).subscribe({
      next: res => { this.simResult.set(res); this.simulating.set(false); },
      error: err => {
        this.simulating.set(false);
        const detail = err?.error?.detail as string | undefined;
        this.simError.set(detail
          ?? 'Erreur lors du calcul. Vérifiez que les paramètres de paie sont configurés pour ce pays.');
      },
    });
  }

  /** Saves the round and sends its costing to the finance queue. Nothing reaches the candidate. */
  submitOffer(): void {
    const sim = this.simResult();
    if (!sim) return;
    const id = this.candidateId();
    this.offerSubmitting.set(true);
    this.actionError.set(null);

    const body: CreateOfferRequest = {
      ...this.offerForm,
      simulationSnapshot: JSON.stringify(sim),
      fiscalYear: new Date().getFullYear(),
    };
    // Both verbs hit the same backend method — a renegotiation IS a new round.
    const call = this.offerMode() === 'renegotiate'
      ? this.offerService.renegotiateOffer(id, body)
      : this.offerService.draftOffer(id, body);
    call.subscribe({
      next: () => { this.offerSubmitting.set(false); this.showOfferModal.set(false); this.load(id); this.changed.emit(); },
      error: err => { this.offerSubmitting.set(false); this.actionError.set(err?.error?.detail ?? err?.error?.message ?? "Erreur lors de l'enregistrement de l'offre."); },
    });
  }

  /** Extends the approved round to the candidate. */
  sendToCandidate(): void {
    const id = this.candidateId();
    this.actioning.set(true);
    this.actionError.set(null);
    this.offerService.sendOffer(id).subscribe({
      next: () => { this.actioning.set(false); this.load(id); this.changed.emit(); },
      error: err => { this.actioning.set(false); this.actionError.set(err?.error?.detail ?? "Erreur lors de l'envoi au candidat."); },
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
  /**
   * Changing the figure DISCARDS the costing. The simulation answers a question about one
   * exact salary, and letting a result from 2 400 DT ride along with a 2 900 DT offer would
   * send finance a cost that does not belong to what they are approving.
   */
  onProposedChange(v: string | number | null): void {
    this.offerForm.proposedSalary = this.asNum(v);
    this.simResult.set(null);
    this.simError.set(null);
  }
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
