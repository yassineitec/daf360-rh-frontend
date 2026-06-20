import { Component, input } from '@angular/core';
import { StatusBadgeComponent, DataTableComponent } from '@khalilrebhiitec/daf360';
import type { TableColumn, TableRow, BadgeCell } from '@khalilrebhiitec/daf360';
import { EmployeeProfile } from '../../../models/profile.model';
import { ContractHistoryDto } from '../../../contract-history/contract-history.model';

@Component({
  selector: 'rh-profile-contract-tab',
  standalone: true,
  imports: [StatusBadgeComponent, DataTableComponent],
  template: `
    <div class="space-y-6">

      <!-- Summary cards -->
      <div class="grid grid-cols-3 gap-4">

        <!-- Contrat actuel -->
        <div class="bg-white border border-outline-variant rounded-xl p-5">
          <p class="text-[12px] font-semibold uppercase tracking-wider text-outline mb-2">
            Contrat actuel
          </p>
          @if (profile().contractType) {
            <daf-badge
              [label]="profile().contractType!"
              [options]="{ variant: 'primary' }" />
          } @else {
            <p class="text-on-surface font-semibold">—</p>
          }
          <p class="text-[12px] text-outline mt-2">
            @if (profile().hireDate) {
              Depuis {{ fmt(profile().hireDate) }}
            }
            @if (profile().contractEndDate) {
              → {{ fmt(profile().contractEndDate) }}
            } @else if (profile().contractType === 'CDI') {
              → CDI
            }
          </p>
        </div>

        <!-- Salaire RH -->
        <div class="bg-white border border-outline-variant rounded-xl p-5">
          <p class="text-[12px] font-semibold uppercase tracking-wider text-outline mb-2">
            Salaire RH
          </p>
          @if (profile().salaireNetRh != null) {
            <p class="text-[24px] font-bold" style="color:#1b3a4b">
              {{ formatSalaire(profile().salaireNetRh!) }}
            </p>
          } @else {
            <p class="text-[20px] font-bold text-outline">—</p>
          }
          @if (profile().salaireNetCandidat != null) {
            <p class="text-[12px] text-outline mt-1">
              Prétention: {{ formatSalaire(profile().salaireNetCandidat!) }}
            </p>
          }
        </div>

        <!-- Probation -->
        <div class="bg-white border border-outline-variant rounded-xl p-5">
          <p class="text-[12px] font-semibold uppercase tracking-wider text-outline mb-2">
            Période d'essai
          </p>
          @if (profile().isOnProbation) {
            <daf-badge label="En période d'essai" [options]="{ variant: 'warning' }" />
            @if (profile().probationEndDate) {
              <p class="text-[12px] text-outline mt-2">
                Fin: {{ fmt(profile().probationEndDate) }}
              </p>
            }
          } @else {
            <daf-badge label="Terminée" [options]="{ variant: 'success' }" />
          }
        </div>
      </div>

      <!-- Contract history table -->
      <div class="bg-white border border-outline-variant rounded-xl p-6">
        <h3 class="font-bold text-[16px] text-on-surface mb-4">Historique des contrats</h3>
        @if (contracts().length === 0) {
          <div class="flex flex-col items-center justify-center py-10 text-outline gap-2">
            <span class="material-symbols-outlined text-[40px]">description</span>
            <p class="text-[14px]">Aucun contrat enregistré</p>
          </div>
        } @else {
          <daf-data-table [columns]="contractColumns" [rows]="contractRows()" />
        }
      </div>
    </div>
  `,
})
export class ProfileContractTabComponent {
  profile   = input.required<EmployeeProfile>();
  contracts = input.required<ContractHistoryDto[]>();

  readonly contractColumns: TableColumn[] = [
    { key: 'type',       label: 'Type',        type: 'badge' },
    { key: 'document',   label: 'Document',    type: 'badge' },
    { key: 'dateEffet',  label: 'Date effet',  type: 'text' },
    { key: 'dateFin',    label: 'Date fin',    type: 'text' },
    { key: 'salaire',    label: 'Salaire net', type: 'text' },
    { key: 'statut',     label: 'Statut',      type: 'badge' },
  ];

  contractRows(): TableRow[] {
    return this.contracts().map(c => ({
      type: {
        label:   c.typeContratLabelFr,
        options: { variant: c.typeDocument === 'CONTRAT_INITIAL' ? 'primary' : 'neutral' },
      } satisfies BadgeCell,
      document: {
        label:   c.typeDocument === 'CONTRAT_INITIAL' ? 'Contrat initial' : 'Avenant',
        options: { variant: c.typeDocument === 'CONTRAT_INITIAL' ? 'info' : 'neutral', size: 'sm' },
      } satisfies BadgeCell,
      dateEffet: this.fmt(c.dateEffet),
      dateFin:   c.dateFin ? this.fmt(c.dateFin) : 'CDI',
      salaire:   c.salaireNet ? this.formatSalaire(c.salaireNet) : '—',
      statut: {
        label:   c.isActive ? 'Actif' : 'Terminé',
        options: { variant: c.isActive ? 'success' : 'neutral', size: 'sm' },
      } satisfies BadgeCell,
    }));
  }

  formatSalaire(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: 'TND', minimumFractionDigits: 0,
    }).format(amount);
  }

  fmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }
}
