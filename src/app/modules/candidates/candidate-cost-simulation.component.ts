import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CandidateDetail } from './candidate.model';
import {
  PayrollSimulationService,
  PayrollSimulationResult,
  SubmitCostApprovalRequest,
} from './payroll-simulation.service';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { UserStore } from '../../core/user.store';
import { ButtonComponent } from '@khalilrebhiitec/daf360';

@Component({
  selector: 'app-candidate-cost-simulation',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  template: `
    <div class="border border-outline-variant/40 rounded-2xl overflow-hidden">
      <!-- Header -->
      <div class="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/40"
           style="background:rgba(0,193,173,0.05)">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
             style="background:rgba(0,193,173,0.12); color:#00c1ad">
          <span class="material-symbols-outlined text-[18px]">calculate</span>
        </div>
        <div>
          <h3 class="text-[13px] font-semibold text-on-surface">Simulation de coût salarial</h3>
          <p class="text-[11px] text-on-surface-variant">Calculer le coût chargé à partir du salaire net</p>
        </div>
      </div>

      <div class="p-5 space-y-5">
        <!-- Input row -->
        <div class="flex items-end gap-3">
          <div class="flex-1">
            <label class="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">
              Salaire net RH ({{ localCurrency() }})
            </label>
            <input type="number" min="0" step="100"
                   class="w-full rounded-xl border border-outline-variant px-3.5 py-2.5 text-[14px]
                          focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-colors"
                   [ngModel]="salaireNetRh()"
                   (ngModelChange)="salaireNetRh.set($event)" />
          </div>
          <div class="shrink-0">
            <daf-button
              label="Calculer"
              [options]="{ variant: 'teal', pill: true, iconStart: 'calculate',
                           loading: calculating(), disabled: !salaireNetRh() || calculating() }"
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
          <div class="flex items-center gap-2 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error">
            <span class="material-symbols-outlined text-[16px]" style="font-variation-settings:'FILL' 1">error</span>
            {{ calcError() }}
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
                </div>
              }
            </div>
          </div>

          <!-- Convergence warning -->
          @if (!result()!.convergenceOk) {
            <div class="flex items-start gap-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
              <span class="material-symbols-outlined text-[15px] mt-0.5">warning</span>
              La simulation n'a pas convergé ({{ result()!.iterationsUsed }} itérations). Résultat approximatif.
            </div>
          }

          <!-- Submit section -->
          <div class="border-t border-outline-variant/40 pt-4 flex items-center justify-between gap-3 flex-wrap">
            @if (submitted()) {
              <div class="flex items-center gap-2 text-[13px] text-teal">
                <span class="material-symbols-outlined text-[17px]" style="font-variation-settings:'FILL' 1">check_circle</span>
                Soumis au Directeur Pays pour approbation
              </div>
            } @else {
              <p class="text-[12px] text-on-surface-variant flex-1">Soumettre cette simulation pour validation par le Directeur Pays.</p>
              <daf-button
                label="Soumettre à approbation"
                [options]="{ variant: 'ghost', pill: true, iconStart: 'send',
                             loading: submitting(), disabled: submitting() }"
                (onClick)="submitForApproval()" />
            }
          </div>

          @if (submitError()) {
            <div class="flex items-center gap-2 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error">
              <span class="material-symbols-outlined text-[16px]" style="font-variation-settings:'FILL' 1">error</span>
              {{ submitError() }}
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class CandidateCostSimulationComponent implements OnInit {
  @Input({ required: true }) candidate!: CandidateDetail;

  private simulationSvc = inject(PayrollSimulationService);
  private listSvc       = inject(ConfigurableListService);
  private userStore     = inject(UserStore);

  salaireNetRh  = signal<number | null>(null);
  result        = signal<PayrollSimulationResult | null>(null);
  calculating   = signal(false);
  calcError     = signal<string | null>(null);
  submitting    = signal(false);
  submitError   = signal<string | null>(null);
  submitted     = signal(false);

  private contractCode = signal<string>('CDI');
  private fxRateEur    = signal<number | null>(null);

  readonly localCurrency = computed(() => this.result()?.localCurrency ?? 'TND');

  readonly resultRows = computed(() => {
    const r = this.result();
    if (!r) return [];
    return [
      { label: 'Salaire brut',     value: r.gross,           highlight: false, eur: r.fxRateEur ? r.gross          / r.fxRateEur : null },
      { label: 'Charges salarié',  value: r.employeeCharges, highlight: false, eur: null },
      { label: 'IRPP',             value: r.irppAmount,      highlight: false, eur: null },
      { label: 'Charges employeur',value: r.employerCharges, highlight: false, eur: null },
      { label: 'Coût chargé',      value: r.loadedCost,      highlight: true,  eur: r.loadedCostEur ?? null },
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
        this.calcError.set(err?.error?.detail ?? err?.error?.message ?? 'Erreur de simulation.');
      },
    });
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
      next:  () => { this.submitting.set(false); this.submitted.set(true); },
      error: err => {
        this.submitting.set(false);
        this.submitError.set(err?.error?.detail ?? err?.error?.message ?? 'Erreur lors de la soumission.');
      },
    });
  }
}
