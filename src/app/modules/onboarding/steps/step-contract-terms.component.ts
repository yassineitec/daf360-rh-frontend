import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  FormFieldComponent, FileUploadComponent, type UploadedFile,
} from '@khalilrebhiitec/daf360';

import { OnboardingFormData, OnboardingProfileDto } from '../onboarding.model';
import { OnboardingService } from '../onboarding.service';
import { NotificationService } from '../../../core/notification.service';

/**
 * Step 3 — Contrat.
 *
 * Two halves that must stay visually distinct, because they carry different authority:
 *
 *  - LEFT, read-only: what recruitment already agreed — the offer's salary and préavis, the
 *    Finance cost approvals (including a counter-proposal), the candidate's own declared
 *    salary, and the interview notes. This is evidence, not input.
 *  - RIGHT, editable: what RH confirms. Prefilled from that evidence so the common case is
 *    one glance and Next, not retyping figures from three tables nobody reopened.
 *
 * The préavis is editable HERE AND NOWHERE ELSE. Completion freezes it on the contract; a
 * different figure later means a new contract. That is why the field carries an explicit
 * warning rather than being a quiet number in a form.
 *
 * The signed PDF uploads immediately (against the candidate — no profile exists yet) rather
 * than being held in memory like the RIB attestation: it is the contract, and losing it to a
 * failed completion would be worse than an orphan file on disk.
 */
@Component({
  selector: 'app-step-contract-terms',
  standalone: true,
  imports: [FormFieldComponent, FileUploadComponent, TranslatePipe, DecimalPipe],
  templateUrl: './step-contract-terms.component.html',
  styleUrl: './step-contract-terms.component.scss',
})
export class StepContractTermsComponent implements OnInit {
  data     = input<OnboardingProfileDto>({});
  formInfo = input<OnboardingFormData | null>(null);
  /** The candidate being onboarded — the upload is scoped to them. */
  candidateId = input<number | null>(null);

  changed = output<Partial<OnboardingProfileDto>>();

  private svc       = inject(OnboardingService);
  private notify    = inject(NotificationService);
  private translate = inject(TranslateService);

  noticePeriodDays = signal<number | null>(null);
  agreedNetSalary  = signal<number | null>(null);

  contractDocumentUrl  = signal<string | null>(null);
  contractDocumentName = signal<string | null>(null);
  readonly contractFiles = signal<UploadedFile[]>([]);
  readonly uploading     = signal(false);

  /** The read-only recruitment evidence. Null for a direct hire with no recruitment trail. */
  readonly recruitment = computed(() => this.formInfo()?.recruitment ?? null);
  readonly offer       = computed(() => this.recruitment()?.offer ?? null);
  readonly approvals   = computed(() => this.recruitment()?.costApprovals ?? []);
  readonly interviews  = computed(() => this.recruitment()?.interviewNotes ?? []);

  readonly gradeDefault = computed<number | null>(
    () => this.recruitment()?.gradeNoticePeriodDays ?? null);

  /**
   * True when the confirmed préavis differs from what the offer said. Legitimate — RH has the
   * last word — but it must be visible, because the offer is what the candidate signed up to.
   */
  readonly divergesFromOffer = computed(() => {
    const offered = this.offer()?.noticePeriodDays;
    const v = this.noticePeriodDays();
    return offered !== null && offered !== undefined && v !== null && v !== offered;
  });

  /** Same, for the salary: silently hiring someone at another figure is the bug to prevent. */
  readonly salaryDivergesFromOffer = computed(() => {
    const offered = this.offer()?.proposedSalary;
    const v = this.agreedNetSalary();
    return offered !== null && offered !== undefined && v !== null && Number(v) !== Number(offered);
  });

  /** The most recent Finance counter-proposal, if any — the figure RH must not contradict blindly. */
  readonly counterProposal = computed<number | null>(() => {
    const rejected = this.approvals().find(a => a.contrePropSalaire !== null
                                             && a.contrePropSalaire !== undefined);
    return rejected?.contrePropSalaire ?? null;
  });

  ngOnInit(): void {
    const d  = this.data();
    const fi = this.formInfo();

    // Draft value first, then the backend's prefill (offer → grade default). `?? null` and not
    // `||` throughout: 0 is a real préavis ("aucun préavis dû") and must survive.
    this.noticePeriodDays.set(d.noticePeriodDays ?? fi?.noticePeriodDays ?? null);
    this.agreedNetSalary.set(d.agreedNetSalary ?? fi?.agreedNetSalary ?? null);
    this.contractDocumentUrl.set(d.contractDocumentUrl ?? fi?.contractDocumentUrl ?? null);
    this.contractDocumentName.set(d.contractDocumentName ?? fi?.contractDocumentName ?? null);

    this.emit();
  }

  onContractFiles(files: UploadedFile[]): void {
    this.contractFiles.set(files);
    const valid = files.find(f => !f.error);
    const cid = this.candidateId();
    if (!valid || cid == null) return;

    this.uploading.set(true);
    this.svc.uploadContractDocument(cid, valid.file).subscribe({
      next: res => {
        this.uploading.set(false);
        this.contractDocumentUrl.set(res.url);
        this.contractDocumentName.set(res.name);
        this.emit();
        this.notify.success(this.translate.instant('ONBOARDING.STEP_CONTRACT_TERMS.UPLOAD_OK'));
      },
      error: () => {
        this.uploading.set(false);
        // Clear the reference rather than leaving a filename that points at nothing.
        this.contractDocumentUrl.set(null);
        this.contractDocumentName.set(null);
        this.emit();
        this.notify.error(this.translate.instant('ONBOARDING.STEP_CONTRACT_TERMS.UPLOAD_ERR'));
      },
    });
  }

  removeContractDocument(): void {
    this.contractFiles.set([]);
    this.contractDocumentUrl.set(null);
    this.contractDocumentName.set(null);
    this.emit();
  }

  emit(): void {
    this.changed.emit({
      noticePeriodDays:     this.noticePeriodDays(),
      agreedNetSalary:      this.agreedNetSalary(),
      contractDocumentUrl:  this.contractDocumentUrl(),
      contractDocumentName: this.contractDocumentName(),
    });
  }

  /** '' → null so clearing the field means "not confirmed", not 0. */
  protected asNum(v: string | number | null): number | null {
    if (v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return isNaN(n) ? null : n;
  }
}
