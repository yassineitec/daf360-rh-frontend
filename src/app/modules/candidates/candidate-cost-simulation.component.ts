import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CandidateDetail } from './candidate.model';
import {
  PayrollSimulationService,
  PayrollSimulationResult,
  SimulationMode,
  SubmitCostApprovalRequest,
  CandidateCostApprovalDto,
} from './payroll-simulation.service';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { UserStore } from '../../core/user.store';
import { ButtonComponent } from '@khalilrebhiitec/daf360';
import { SectionCardComponent } from '../../shared/detail/section-card.component';

@Component({
  selector: 'app-candidate-cost-simulation',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, SectionCardComponent],
  template: `
    <!-- rh-section-card, not a bespoke bordered box with an rgba(0,193,173) header
         tint: one section shell on /rh/candidates/:id (UI-PLAYBOOK §10f). -->
    <rh-section-card title="Simulation de coût salarial" icon="calculate" accent="tertiary">
      <div class="space-y-5">
        <!-- Mode toggle -->
        <div class="flex rounded-xl border border-outline-variant overflow-hidden text-[12px] font-semibold">
          <button type="button"
                  class="flex-1 flex items-center justify-center gap-1 px-3 py-2 transition-colors"
                  [class.bg-teal]="simMode() === 'NET_TO_BRUT'"
                  [class.text-white]="simMode() === 'NET_TO_BRUT'"
                  [class.text-on-surface-variant]="simMode() !== 'NET_TO_BRUT'"
                  (click)="setSimMode('NET_TO_BRUT')">
            <span class="material-symbols-outlined text-[14px]">arrow_upward</span>
            Net → Brut
          </button>
          <button type="button"
                  class="flex-1 flex items-center justify-center gap-1 px-3 py-2 border-l border-outline-variant transition-colors"
                  [class.bg-teal]="simMode() === 'BRUT_TO_NET'"
                  [class.text-white]="simMode() === 'BRUT_TO_NET'"
                  [class.text-on-surface-variant]="simMode() !== 'BRUT_TO_NET'"
                  (click)="setSimMode('BRUT_TO_NET')">
            <span class="material-symbols-outlined text-[14px]">arrow_downward</span>
            Brut → Net
          </button>
        </div>

        <!-- Period toggle -->
        <div class="flex rounded-xl border border-outline-variant overflow-hidden text-[12px] font-semibold">
          <button type="button"
                  class="flex-1 flex items-center justify-center gap-1 px-3 py-2 transition-colors"
                  [class.bg-teal]="period() === 'MONTHLY'"
                  [class.text-white]="period() === 'MONTHLY'"
                  [class.text-on-surface-variant]="period() !== 'MONTHLY'"
                  (click)="setPeriod('MONTHLY')">
            <span class="material-symbols-outlined text-[14px]">calendar_view_month</span>
            Mensuel
          </button>
          <button type="button"
                  class="flex-1 flex items-center justify-center gap-1 px-3 py-2 border-l border-outline-variant transition-colors"
                  [class.bg-teal]="period() === 'YEARLY'"
                  [class.text-white]="period() === 'YEARLY'"
                  [class.text-on-surface-variant]="period() !== 'YEARLY'"
                  (click)="setPeriod('YEARLY')">
            <span class="material-symbols-outlined text-[14px]">calendar_month</span>
            Annuel
          </button>
        </div>

        <!-- Input row -->
        <div class="flex items-end gap-3">
          <div class="flex-1">
            @if (simMode() === 'NET_TO_BRUT') {
              <label class="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">
                Salaire net RH {{ period() === 'YEARLY' ? 'annuel' : 'mensuel' }} ({{ localCurrency() }})
              </label>
              <input type="number" min="0" step="100"
                     class="w-full rounded-xl border border-outline-variant px-3.5 py-2.5 text-[14px]
                            focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-colors"
                     [ngModel]="salaireNetRh()"
                     (ngModelChange)="salaireNetRh.set($event)" />
            } @else {
              <label class="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">
                Salaire brut {{ period() === 'YEARLY' ? 'annuel' : 'mensuel' }} ({{ localCurrency() }})
              </label>
              <input type="number" min="0" step="100"
                     class="w-full rounded-xl border border-outline-variant px-3.5 py-2.5 text-[14px]
                            focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-colors"
                     [ngModel]="inputGross()"
                     (ngModelChange)="inputGross.set($event)" />
            }
          </div>
          <div class="shrink-0">
            <daf-button
              label="Calculer"
              [options]="{ variant: 'teal', pill: true, iconStart: 'calculate',
                           loading: calculating(),
                           disabled: (simMode() === 'NET_TO_BRUT' ? !salaireNetRh() : !inputGross()) || calculating() }"
              (onClick)="calculate()" />
          </div>
        </div>

        <!-- Candidate pretension (read-only display) -->
        @if (candidate.salaireNetCandidat) {
          <div class="flex items-center gap-2 text-[12.5px] text-on-surface-variant px-1">
            <span class="material-symbols-outlined text-[15px]">person</span>
            Prétention candidat : <strong class="text-on-surface ml-1">
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
              <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Résultat de la simulation</p>
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
                  <p class="text-[10px] text-on-surface-variant/70 tabular-nums mt-0.5">
                    ≈ {{ row.annual | number:'1.0-0' }} {{ localCurrency() }} / an
                  </p>
                </div>
              }
            </div>

            <!-- Annual net / loaded cost summary -->
            <div class="rounded-xl border border-outline-variant/40 overflow-hidden">
              <div class="px-3 py-1.5 bg-surface-container-low border-b border-outline-variant/30 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[13px] text-outline" style="font-variation-settings:'FILL' 1">event_repeat</span>
                <p class="text-[9px] font-bold uppercase tracking-widest text-outline">Annuel (× 12)</p>
              </div>
              <div class="grid grid-cols-2 divide-x divide-outline-variant/30">
                <div class="px-4 py-2.5">
                  <p class="text-[9px] text-on-surface-variant uppercase tracking-wide mb-0.5">Net / an</p>
                  <p class="text-[13px] font-semibold tabular-nums">
                    {{ (result()!.gross - result()!.employeeCharges - result()!.irppAmount) * 12 | number:'1.0-0' }}
                    <span class="text-[11px] font-normal text-on-surface-variant">{{ localCurrency() }}</span>
                  </p>
                </div>
                <div class="px-4 py-2.5">
                  <p class="text-[9px] text-on-surface-variant uppercase tracking-wide mb-0.5">Coût chargé / an</p>
                  <p class="text-[14px] font-bold text-teal tabular-nums">
                    {{ result()!.loadedCost * 12 | number:'1.0-0' }}
                    <span class="text-[11px] font-normal text-on-surface-variant">{{ localCurrency() }}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Convergence warning -->
          @if (!result()!.convergenceOk) {
            <div class="flex items-start gap-2 text-[12px] text-warning bg-warning/10 border border-warning/30 rounded-xl px-3.5 py-2.5">
              <span class="material-symbols-outlined text-[15px] mt-0.5">warning</span>
              La simulation n'a pas convergé ({{ result()!.iterationsUsed }} itérations). Résultat approximatif.
            </div>
          }

          <!-- Submit section -->
          <div class="border-t border-outline-variant/40 pt-4 flex items-center justify-between gap-3 flex-wrap">
            @if (latestApproval()?.status === 'PENDING') {
              <p class="text-[12px] text-on-surface-variant flex-1">
                En attente d'approbation — vous pouvez soumettre une nouvelle simulation si nécessaire.
              </p>
            } @else {
              <p class="text-[12px] text-on-surface-variant flex-1">
                Soumettre cette simulation pour validation par le Directeur Pays.
              </p>
            }
            <daf-button
              label="Soumettre à approbation"
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

  salaireNetRh  = signal<number | null>(null);
  inputGross    = signal<number | null>(null);
  simMode       = signal<SimulationMode>('NET_TO_BRUT');
  period        = signal<'MONTHLY' | 'YEARLY'>('MONTHLY');
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
    const r = this.result();
    if (!r) return [];
    // Net in hand: always computed from reliable fields — r.inputNet is unreliable in BRUT_TO_NET mode
    const netMonthly = r.gross - r.employeeCharges - r.irppAmount;
    return [
      { label: 'Salaire brut',     value: r.gross,           annual: r.gross * 12,           highlight: false, eur: r.fxRateEur ? r.gross / r.fxRateEur : null },
      { label: 'Charges salarié',  value: r.employeeCharges, annual: r.employeeCharges * 12,  highlight: false, eur: null },
      { label: 'IRPP',             value: r.irppAmount,       annual: r.irppAmount * 12,       highlight: false, eur: null },
      { label: 'Salaire net',      value: netMonthly,         annual: netMonthly * 12,         highlight: true,  eur: r.fxRateEur ? netMonthly / r.fxRateEur : null },
      { label: 'Charges employeur',value: r.employerCharges,  annual: r.employerCharges * 12,  highlight: false, eur: null },
      { label: 'Coût chargé',      value: r.loadedCost,       annual: r.loadedCost * 12,       highlight: true,  eur: r.loadedCostEur ?? null },
    ];
  });

  ngOnInit(): void {
    this.salaireNetRh.set(this.candidate.salaireNetRh ?? null);

    const paysId = this.candidate.paysId;
    this.listSvc.getListValues('EMPLOYMENT_TYPE', paysId).subscribe(values => {
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

  setSimMode(m: SimulationMode): void {
    this.simMode.set(m);
    this.result.set(null);
    this.calcError.set(null);
  }

  setPeriod(p: 'MONTHLY' | 'YEARLY'): void {
    this.period.set(p);
    this.result.set(null);
    this.calcError.set(null);
  }

  calculate(): void {
    const mode  = this.simMode();
    const net   = this.salaireNetRh();
    const gross = this.inputGross();

    if (mode === 'NET_TO_BRUT' && (!net || net <= 0)) return;
    if (mode === 'BRUT_TO_NET' && (!gross || gross <= 0)) return;

    this.calculating.set(true);
    this.calcError.set(null);
    this.result.set(null);
    this.submitted.set(false);

    const divisor = this.period() === 'YEARLY' ? 12 : 1;
    this.simulationSvc.simulateFromNet({
      paysId:       this.candidate.paysId,
      mode,
      inputNet:     mode === 'NET_TO_BRUT' ? net!   / divisor : undefined,
      inputGross:   mode === 'BRUT_TO_NET' ? gross! / divisor : undefined,
      contractType: this.contractCode(),
    }).subscribe({
      next:  res  => { this.result.set(res); this.calculating.set(false); },
      error: err  => {
        this.calculating.set(false);
        const status = err?.status as number;
        const detail = err?.error?.detail as string | undefined;
        if (status === 500 || !detail) {
          this.calcError.set('Erreur lors du calcul. Vérifiez que les paramètres de paie sont configurés pour ce pays.');
        } else {
          this.calcError.set(detail);
        }
      },
    });
  }

  approvalStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING':  return "En attente d'approbation";
      case 'APPROVED': return 'Approuvé';
      case 'REJECTED': return 'Refusé';
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
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  submitForApproval(): void {
    const r = this.result();
    if (!r) return;

    this.submitting.set(true);
    this.submitError.set(null);

    // r.inputNet is always the actual net in hand regardless of simulation mode
    const req: SubmitCostApprovalRequest = {
      candidateId:        this.candidate.id,
      paysId:             this.candidate.paysId,
      fiscalYear:         new Date().getFullYear(),
      salaireNetRh:       r.inputNet,
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
            ? 'Erreur lors de la soumission. Veuillez réessayer.'
            : detail
        );
      },
    });
  }
}
