import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  PayrollSimulationService,
  CandidateCostApprovalDto,
  PayrollSimulationResult,
} from './payroll-simulation.service';
import { UserStore } from '../../core/user.store';
import { ButtonComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

@Component({
  selector: 'app-hiring-approval-inbox',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, StatusBadgeComponent],
  template: `
    <div class="px-4 sm:px-8 pb-8">
      <!-- Header -->
      <div class="mb-6">
        <nav class="flex items-center gap-2 text-[13px] text-on-surface-variant mb-2">
          <button type="button" class="hover:text-teal transition-colors font-medium"
                  (click)="router.navigate(['/candidates'])">
            Recrutement
          </button>
          <span class="material-symbols-outlined text-[16px]">chevron_right</span>
          <span class="font-medium" style="color:#50717b">Approbations de coût</span>
        </nav>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-[22px] sm:text-[28px] font-bold text-on-surface">Approbations de coût salarial</h1>
            <p class="text-[13px] text-on-surface-variant mt-1">Simulations soumises par les RH en attente de votre validation</p>
          </div>
          <div class="shrink-0 text-[13px] font-semibold px-3 py-1.5 rounded-full"
               style="background:rgba(0,193,173,0.1); color:#00c1ad">
            {{ pending().length }} en attente
          </div>
        </div>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="flex items-center justify-center h-40 text-on-surface-variant">
          <span class="material-symbols-outlined animate-spin text-[32px]">progress_activity</span>
        </div>
      }

      <!-- Error -->
      @if (loadError()) {
        <div class="flex items-center gap-3 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error mb-6">
          <span class="material-symbols-outlined text-[16px]" style="font-variation-settings:'FILL' 1">error</span>
          {{ loadError() }}
        </div>
      }

      <!-- Empty state -->
      @if (!loading() && !loadError() && pending().length === 0) {
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
               style="background:rgba(0,193,173,0.1)">
            <span class="material-symbols-outlined text-[32px]" style="color:#00c1ad">check_circle</span>
          </div>
          <h3 class="text-[16px] font-semibold text-on-surface mb-1">Aucune demande en attente</h3>
          <p class="text-[13px] text-on-surface-variant">Toutes les simulations ont été traitées.</p>
        </div>
      }

      <!-- Cards -->
      <div class="space-y-4">
        @for (item of pending(); track item.id) {
          <div class="bg-surface rounded-2xl border border-outline-variant overflow-hidden">
            <!-- Card header -->
            <div class="flex items-center justify-between gap-4 px-5 py-4 border-b border-outline-variant/40"
                 style="background:rgba(0,193,173,0.04)">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-semibold text-[13px]"
                     style="background:rgba(0,193,173,0.15); color:#00c1ad">
                  {{ initials(item) }}
                </div>
                <div class="min-w-0">
                  <p class="text-[14px] font-semibold text-on-surface truncate">
                    {{ item.candidateFirstName }} {{ item.candidateLastName }}
                  </p>
                  <p class="text-[11px] text-on-surface-variant">
                    Contrat : <strong>{{ item.contractTypeCode }}</strong> &nbsp;·&nbsp;
                    Année fiscale : {{ item.fiscalYear }} &nbsp;·&nbsp;
                    Soumis le {{ formatDate(item.submittedAt) }}
                  </p>
                </div>
              </div>
              <button class="text-[12px] text-teal hover:underline shrink-0"
                      (click)="router.navigate(['/candidates', item.candidateId])">
                Voir candidat
              </button>
            </div>

            <!-- Simulation breakdown -->
            <div class="px-5 py-4">
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                @for (kv of parseSnapshot(item.simulationSnapshot); track kv.label) {
                  <div class="rounded-xl border border-outline-variant/40 px-3.5 py-3"
                       [class.border-teal]="kv.highlight"
                       [class.bg-teal-50]="kv.highlight">
                    <p class="text-[10px] text-on-surface-variant uppercase tracking-wide mb-0.5">{{ kv.label }}</p>
                    <p class="text-[14px] font-semibold" [class.text-teal]="kv.highlight">
                      {{ kv.value | number:'1.0-0' }}
                    </p>
                  </div>
                }
              </div>

              <!-- Salary comparison -->
              <div class="flex flex-wrap gap-4 text-[12.5px] text-on-surface-variant border-t border-outline-variant/30 pt-3">
                <span>
                  Budget RH (net) : <strong class="text-on-surface">{{ item.salaireNetRh | number:'1.0-0' }}</strong>
                </span>
                @if (item.salaireNetCandidat) {
                  <span>
                    Prétention candidat : <strong class="text-on-surface">{{ item.salaireNetCandidat | number:'1.0-0' }}</strong>
                  </span>
                }
              </div>
            </div>

            <!-- Action footer -->
            <div class="flex items-end gap-3 px-5 py-4 border-t border-outline-variant/40 bg-surface-container-low flex-wrap">
              <div class="flex-1 min-w-[180px]">
                <label class="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1">
                  Note (optionnelle)
                </label>
                <input type="text" placeholder="Commentaire…"
                       class="w-full rounded-xl border border-outline-variant px-3 py-2 text-[13px]
                              focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                       [(ngModel)]="notes[item.id]" />
              </div>
              <div class="flex gap-2 shrink-0">
                <daf-button
                  label="Rejeter"
                  [options]="{ variant: 'outlined', pill: true, size: 'sm', iconStart: 'close',
                               loading: processing()[item.id] === 'reject',
                               disabled: !!processing()[item.id] }"
                  (onClick)="reject(item)" />
                <daf-button
                  label="Approuver"
                  [options]="{ variant: 'teal', pill: true, size: 'sm', iconStart: 'check',
                               loading: processing()[item.id] === 'approve',
                               disabled: !!processing()[item.id] }"
                  (onClick)="approve(item)" />
              </div>
            </div>

            @if (actionError()[item.id]) {
              <div class="px-5 pb-3 text-[12px] text-error flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[14px]">error</span>
                {{ actionError()[item.id] }}
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class HiringApprovalInboxComponent implements OnInit {
  protected readonly router = inject(Router);
  private simulationSvc    = inject(PayrollSimulationService);
  private userStore        = inject(UserStore);

  pending    = signal<CandidateCostApprovalDto[]>([]);
  loading    = signal(true);
  loadError  = signal<string | null>(null);

  notes      : Record<number, string> = {};
  processing = signal<Record<number, 'approve' | 'reject' | null>>({});
  actionError= signal<Record<number, string | null>>({});

  ngOnInit(): void {
    const paysId = this.userStore.currentUser()?.paysId;
    if (!paysId) { this.loading.set(false); return; }

    this.simulationSvc.getPendingByPays(paysId).subscribe({
      next:  data => { this.pending.set(data); this.loading.set(false); },
      error: err  => { this.loadError.set(err?.error?.message ?? 'Erreur de chargement.'); this.loading.set(false); },
    });
  }

  approve(item: CandidateCostApprovalDto): void {
    this.setProcessing(item.id, 'approve');
    this.simulationSvc.approve(item.id, this.notes[item.id]).subscribe({
      next:  () => this.removeItem(item.id),
      error: err => { this.setProcessing(item.id, null); this.setError(item.id, err?.error?.message ?? 'Erreur.'); },
    });
  }

  reject(item: CandidateCostApprovalDto): void {
    this.setProcessing(item.id, 'reject');
    this.simulationSvc.reject(item.id, this.notes[item.id]).subscribe({
      next:  () => this.removeItem(item.id),
      error: err => { this.setProcessing(item.id, null); this.setError(item.id, err?.error?.message ?? 'Erreur.'); },
    });
  }

  parseSnapshot(json: string): { label: string; value: number; highlight: boolean }[] {
    try {
      const r: PayrollSimulationResult = JSON.parse(json);
      return [
        { label: 'Net (cible)',      value: r.inputNet,        highlight: false },
        { label: 'Brut',            value: r.gross,           highlight: false },
        { label: 'Charges salarié', value: r.employeeCharges, highlight: false },
        { label: 'Coût chargé',     value: r.loadedCost,      highlight: true  },
      ];
    } catch {
      return [];
    }
  }

  initials(item: CandidateCostApprovalDto): string {
    return ((item.candidateFirstName?.[0] ?? '') + (item.candidateLastName?.[0] ?? '')).toUpperCase() || '?';
  }

  formatDate(d: string): string {
    try {
      return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
  }

  private removeItem(id: number): void {
    this.setProcessing(id, null);
    this.pending.update(list => list.filter(i => i.id !== id));
  }

  private setProcessing(id: number, v: 'approve' | 'reject' | null): void {
    this.processing.update(m => ({ ...m, [id]: v }));
  }

  private setError(id: number, msg: string | null): void {
    this.actionError.update(m => ({ ...m, [id]: msg }));
  }
}
