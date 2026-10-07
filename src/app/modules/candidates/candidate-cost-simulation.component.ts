import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CandidateDetail } from './candidate.model';
import {
  PayrollSimulationService,
  PayrollSimulationResult,
  SubmitCostApprovalRequest,
  CandidateCostApprovalDto,
} from './payroll-simulation.service';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { UserStore } from '../../core/user.store';
import { ButtonComponent } from '@khalilrebhiitec/daf360';
import { SectionCardComponent } from '../../shared/detail/section-card.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-candidate-cost-simulation',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, SectionCardComponent, TranslatePipe],
  template: `
    <!-- rh-section-card, not a bespoke bordered box with an rgba(0,193,173) header
         tint: one section shell on /rh/candidates/:id (UI-PLAYBOOK §10f). -->
    <rh-section-card [title]="'CANDIDATES.COST_SIM.TITLE' | translate" icon="calculate" accent="tertiary">
      <div class="space-y-5">
        <!-- Input row -->
        <div class="flex items-end gap-3">
          <div class="flex-1">
            <label class="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">
              {{ 'CANDIDATES.COST_SIM.NET_RH' | translate:{ currency: localCurrency() } }}
            </label>
            <input type="number" min="0" step="100"
                   class="w-full rounded-xl border border-outline-variant px-3.5 py-2.5 text-[14px]
                          focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-colors"
                   [ngModel]="salaireNetRh()"
                   (ngModelChange)="salaireNetRh.set($event)" />
          </div>
          <div class="shrink-0">
            <daf-button
              [label]="'CANDIDATES.COST_SIM.CALCULATE' | translate"
              [options]="{ variant: 'teal', pill: true, iconStart: 'calculate',
                           loading: calculating(), disabled: !salaireNetRh() || calculating() }"
              (onClick)="calculate()" />
          </div>
        </div>

        <!-- Candidate pretension (read-only display) -->
        @if (candidate.salaireNetCandidat) {
          <div class="flex items-center gap-2 text-[12.5px] text-on-surface-variant px-1">
            <span class="material-symbols-outlined text-[15px]">person</span>
            {{ 'CANDIDATES.COST_SIM.CANDIDATE_CLAIM' | translate }} <strong class="text-on-surface ml-1">
              {{ candidate.salaireNetCandidat | number:'1.0-0' }} {{ localCurrency() }}
            </strong>
          </div>
        }

        <!-- Error -->
        @if (calcError()) {
          <div class="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger">
            <span class="material-symbols-outlined text-[16px]" style="font-variation-settings:'FILL' 1">error</span>
            {{ calcError() }}
          </div>
        }

        <!-- Approval status banner – always shown when a prior record exists -->
        @if (latestApproval()) {
          <div class="flex items-start gap-2.5 rounded-xl px-4 py-3 text-[12.5px]"
               [ngStyle]="approvalBannerStyle(latestApproval()!.status)">
            <span class="material-symbols-outlined text-[17px] mt-0.5 shrink-0"
                  style="font-variation-settings:'FILL' 1">
              {{ approvalIcon(latestApproval()!.status) }}
            </span>
            <div class="flex-1 min-w-0">
              <span class="font-semibold">{{ approvalStatusLabel(latestApproval()!.status) }}</span>
              <span class="ml-2 text-[11px] opacity-60">{{ formatDate(latestApproval()!.submittedAt) }}</span>
              @if (latestApproval()!.approvalNotes) {
                <p class="mt-0.5 text-[11px] opacity-80">{{ latestApproval()!.approvalNotes }}</p>
              }
            </div>
          </div>
        }

        <!-- Results grid -->
        @if (result()) {
          <div class="rounded-xl border border-outline-variant/50 overflow-hidden">
            <div class="px-4 py-2.5 border-b border-outline-variant/40 bg-surface-container-low">
              <p class="text-[10px] font-bold uppercase tracking-widest text-outline">{{ 'CANDIDATES.COST_SIM.RESULT_TITLE' | translate }}</p>
            </div>
            <div class="grid grid-cols-2 divide-x divide-outline-variant/30">
              @for (row of resultRows(); track row.label) {
                <div class="px-4 py-3" [class.col-span-2]="row.highlight">
                  <p class="text-[10px] text-on-surface-variant uppercase tracking-wide mb-0.5">{{ row.label }}</p>
                  <p class="font-semibold"
                     [class.text-[15px]]="row.highlight"
                     [class.text-[13px]]="!row.highlight"
                     [class.text-teal]="row.highlight">
                    {{ row.value | number:'1.2-2' }} {{ localCurrency() }}
                    @if (row.eur) { <span class="text-[11px] text-on-surface-variant ml-1">(≈ {{ row.eur | number:'1.0-0' }} €)</span> }
                  </p>
                </div>
              }
            </div>
          </div>

          <!-- Convergence warning -->
          @if (!result()!.convergenceOk) {
            <div class="flex items-start gap-2 text-[12px] text-warning bg-warning/10 border border-warning/30 rounded-xl px-3.5 py-2.5">
              <span class="material-symbols-outlined text-[15px] mt-0.5">warning</span>
              {{ 'CANDIDATES.COST_SIM.NO_CONVERGENCE' | translate:{ iterations: result()!.iterationsUsed } }}
            </div>
          }

          <!-- Submit section -->
          <div class="border-t border-outline-variant/40 pt-4 flex items-center justify-between gap-3 flex-wrap">
            @if (latestApproval()?.status === 'PENDING') {
              <p class="text-[12px] text-on-surface-variant flex-1">
                {{ 'CANDIDATES.COST_SIM.PENDING_HINT' | translate }}
              </p>
            } @else {
              <p class="text-[12px] text-on-surface-variant flex-1">
                {{ 'CANDIDATES.COST_SIM.SUBMIT_HINT' | translate }}
              </p>
            }
            <daf-button
              [label]="'CANDIDATES.COST_SIM.SUBMIT' | translate"
              [options]="{ variant: 'ghost', pill: true, iconStart: 'send',
                           loading: submitting(), disabled: submitting() }"
              (onClick)="submitForApproval()" />
          </div>

          @if (submitError()) {
            <div class="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger">
              <span class="material-symbols-outlined text-[16px]" style="font-variation-settings:'FILL' 1">error</span>
              {{ submitError() }}
            </div>
          }
        }
      </div>
    </rh-section-card>
  `,
})
export class CandidateCostSimulationComponent implements OnInit {
  @Input({ required: true }) candidate!: CandidateDetail;

  private simulationSvc = inject(PayrollSimulationService);
  private listSvc       = inject(ConfigurableListService);
  private userStore     = inject(UserStore);
  private translate     = inject(TranslateService);

  salaireNetRh  = signal<number | null>(null);
  result        = signal<PayrollSimulationResult | null>(null);
  calculating   = signal(false);
  calcError     = signal<string | null>(null);
  submitting    = signal(false);
  submitError   = signal<string | null>(null);
  submitted     = signal(false);

  approvals     = signal<CandidateCostApprovalDto[]>([]);
  readonly latestApproval = computed(() =>
    this.approvals().length ? this.approvals()[0] : null
  );

  private contractCode = signal<string>('CDI');
  private fxRateEur    = signal<number | null>(null);

  readonly localCurrency = computed(() => this.result()?.localCurrency ?? 'TND');

  readonly resultRows = computed(() => {
    this.translate.currentLang();
    const r = this.result();
    if (!r) return [];
    const t = (k: string) => this.translate.instant('CANDIDATES.COST_SIM.' + k);
    return [
      { label: t('GROSS'),            value: r.gross,           highlight: false, eur: r.fxRateEur ? r.gross          / r.fxRateEur : null },
      { label: t('EMPLOYEE_CHARGES'), value: r.employeeCharges, highlight: false, eur: null },
      { label: t('IRPP'),             value: r.irppAmount,      highlight: false, eur: null },
      { label: t('EMPLOYER_CHARGES'), value: r.employerCharges, highlight: false, eur: null },
      { label: t('LOADED_COST'),      value: r.loadedCost,      highlight: true,  eur: r.loadedCostEur ?? null },
    ];
  });

  ngOnInit(): void {
    this.salaireNetRh.set(this.candidate.salaireNetRh ?? null);

    const paysId = this.candidate.paysId;
    this.listSvc.getListValues('CONTRACT_TYPE', paysId).subscribe(values => {
      const match = values.find(v => v.id === this.candidate.employmentTypeId);
      if (match?.payrollContractCode) {
        this.contractCode.set(match.payrollContractCode);
      }
    });

    this.loadApprovals();
  }

  private loadApprovals(): void {
    this.simulationSvc.getByCandidate(this.candidate.id).subscribe({
      next: list => this.approvals.set(list),
    });
  }

  calculate(): void {
    const net = this.salaireNetRh();
    if (!net || net <= 0) return;
    this.calculating.set(true);
    this.calcError.set(null);
    this.result.set(null);
    this.submitted.set(false);

    this.simulationSvc.simulateFromNet({
      paysId:       this.candidate.paysId,
      inputNet:     net,
      contractType: this.contractCode(),
    }).subscribe({
      next:  res  => { this.result.set(res); this.calculating.set(false); },
      error: err  => {
        this.calculating.set(false);
        const status = err?.status as number;
        const detail = err?.error?.detail as string | undefined;
        if (status === 500 || !detail) {
          this.calcError.set(this.translate.instant('CANDIDATES.COST_SIM.ERR_CALC'));
        } else {
          this.calcError.set(detail);
        }
      },
    });
  }

  approvalStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING':
      case 'APPROVED':
      case 'REJECTED': return this.translate.instant('CANDIDATES.COST_SIM.STATUS_' + status);
      default: return status;
    }
  }

  approvalIcon(status: string): string {
    switch (status) {
      case 'PENDING':  return 'hourglass_empty';
      case 'APPROVED': return 'check_circle';
      case 'REJECTED': return 'cancel';
      default: return 'info';
    }
  }

  approvalBannerStyle(status: string): Record<string, string> {
    switch (status) {
      case 'PENDING':
        return { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', color: '#b45309' };
      case 'APPROVED':
        return { background: 'rgba(0,193,173,0.08)', border: '1px solid rgba(0,193,173,0.3)', color: '#00877a' };
      case 'REJECTED':
        return { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#dc2626' };
      default:
        return {};
    }
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const locale = this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR';
    return new Date(dateStr).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  submitForApproval(): void {
    const r   = this.result();
    const net = this.salaireNetRh();
    if (!r || !net) return;

    this.submitting.set(true);
    this.submitError.set(null);

    const req: SubmitCostApprovalRequest = {
      candidateId:        this.candidate.id,
      paysId:             this.candidate.paysId,
      fiscalYear:         new Date().getFullYear(),
      salaireNetRh:       net,
      salaireNetCandidat: this.candidate.salaireNetCandidat ?? undefined,
      contractTypeCode:   this.contractCode(),
      simulationSnapshot: JSON.stringify(r),
    };

    this.simulationSvc.submitForApproval(req).subscribe({
      next:  () => { this.submitting.set(false); this.submitted.set(true); this.loadApprovals(); },
      error: err => {
        this.submitting.set(false);
        const status = err?.status as number;
        const detail = err?.error?.detail as string | undefined;
        this.submitError.set(
          (status === 500 || !detail)
            ? this.translate.instant('CANDIDATES.COST_SIM.ERR_SUBMIT')
            : detail
        );
      },
    });
  }
}
