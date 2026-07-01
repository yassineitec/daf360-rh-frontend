import { Component, input, output } from '@angular/core';
import {
  StatusBadgeComponent,
  DataTableComponent,
  CardComponent,
  SectionCardComponent,
  ButtonComponent,
} from '@khalilrebhiitec/daf360';
import type { TableColumn, TableRow, BadgeCell } from '@khalilrebhiitec/daf360';
import { EmployeeProfile } from '../../../models/profile.model';
import { ContractHistoryDto } from '../../../contract-history/contract-history.model';
import {
  ContractListDto,
  STATUS_CONFIG,
  CONTRACT_TYPE_CONFIG,
} from '../../../lifecycle/contract-lifecycle.model';

@Component({
  selector: 'rh-profile-contract-tab',
  standalone: true,
  imports: [
    StatusBadgeComponent,
    DataTableComponent,
    CardComponent,
    SectionCardComponent,
    ButtonComponent,
  ],
  template: `
    <div class="space-y-8">
      <!-- Summary cards -->
      <div class="grid grid-cols-3 gap-4">
        <!-- Contrat actuel -->
        <daf-card>
          <p class="text-[12px] font-semibold uppercase tracking-wider text-outline mb-2">
            Contrat actuel
          </p>
          @if (profile().contractType) {
            <daf-badge [label]="profile().contractType!" [options]="{ variant: 'primary' }" />
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
        </daf-card>

        <!-- Salaire RH -->
        <daf-card>
          <p class="text-[12px] font-semibold uppercase tracking-wider text-outline mb-2">
            Salaire RH
          </p>
          @if (profile().salaireNetRh != null) {
            <p class="text-[24px] font-bold text-primary">
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
        </daf-card>

        <!-- Probation -->
        <daf-card>
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
        </daf-card>
      </div>

      <div class="flex flex-col gap-4">
        <!-- Contract history table -->
        <daf-card [options]="{ variant: 'outlined', padding: 'lg' }">
          <h3 class="font-bold text-[16px] text-on-surface mb-4">Historique des contrats</h3>
          @if (contracts().length === 0) {
            <div class="flex flex-col items-center justify-center py-10 text-outline gap-2">
              <span class="material-symbols-outlined text-[40px]">description</span>
              <p class="text-[14px]">Aucun contrat enregistré</p>
            </div>
          } @else {
            <daf-data-table [columns]="contractColumns" [rows]="contractRows()" />
          }
        </daf-card>

        <!-- Contract Lifecycle Engine -->
        <daf-card [options]="{ variant: 'outlined', padding: 'lg' }">
          <div class="flex items-center justify-between mb-5">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px] text-primary">
                manage_accounts
              </span>
              <h3 class="font-bold text-[16px] text-on-surface">Gestion des contrats</h3>
              @if (lcContracts().length > 0) {
                <span
                  class="bg-surface-container-highest text-[12px] font-semibold
                           px-2 py-0.5 rounded-full"
                >
                  {{ lcContracts().length }}
                </span>
              }
            </div>
            @if (canEdit()) {
              <daf-button
                [options]="{
                  variant: 'primary',
                  label: 'Nouveau contrat',
                  iconStart: 'add',
                  size: 'sm',
                }"
                (onClick)="newContractClick.emit()"
              />
            }
          </div>

          @if (lcLoading()) {
            <div class="flex justify-center py-8">
              <span
                class="material-symbols-outlined text-[32px] text-outline"
                style="animation:spin 1s linear infinite"
                >progress_activity</span
              >
            </div>
          } @else if (lcContracts().length === 0) {
            <div
              class="flex flex-col items-center justify-center py-10 text-outline gap-2
                      border-2 border-dashed border-outline-variant rounded-xl"
            >
              <span class="material-symbols-outlined text-[36px]">folder_open</span>
              <p class="text-[14px]">Aucun contrat lifecycle enregistré</p>
              @if (canEdit()) {
                <button
                  class="mt-2 text-[13px] font-semibold text-[#1b3a4b] hover:underline"
                  (click)="newContractClick.emit()"
                >
                  + Créer le premier contrat
                </button>
              }
            </div>
          } @else {
            <div class="space-y-3">
              @for (c of lcContracts(); track c.id) {
                <daf-card [options]="{ variant: 'outlined', padding: 'md', hoverable: true }">
                  <div class="flex items-start justify-between gap-4">
                    <!-- Contract info -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap mb-2">
                        <!-- Type badge -->
                        <span
                          class="px-2.5 py-0.5 rounded-full text-[12px] font-semibold border"
                          [style.background]="'#eff6ff'"
                          [style.color]="'#1e40af'"
                          [style.border-color]="'#bfdbfe'"
                        >
                          {{ typeCfg(c.contractTypeCode).label }}
                        </span>
                        <!-- Status badge -->
                        <span
                          class="px-2.5 py-0.5 rounded-full text-[12px] font-semibold"
                          [style.background]="statusCfg(c.currentStatusCode).bg"
                          [style.color]="statusCfg(c.currentStatusCode).color"
                        >
                          {{ statusCfg(c.currentStatusCode).label }}
                        </span>
                        @if (c.isActive) {
                          <span
                            class="w-2 h-2 rounded-full bg-green-400 inline-block"
                            title="Actif"
                          ></span>
                        }
                      </div>

                      <div class="flex items-center gap-4 text-[13px] text-outline flex-wrap">
                        <span class="flex items-center gap-1">
                          <span class="material-symbols-outlined text-[14px]">calendar_today</span>
                          Début: {{ fmt(c.dateDebut) }}
                        </span>
                        @if (c.dateFinPrevue) {
                          <span class="flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">event</span>
                            Fin prévue: {{ fmt(c.dateFinPrevue) }}
                            @if (daysUntil(c.dateFinPrevue); as d) {
                              <span
                                [class]="
                                  d <= 30
                                    ? 'text-red-500 font-semibold'
                                    : d <= 60
                                      ? 'text-orange-500 font-semibold'
                                      : ''
                                "
                              >
                                ({{ d > 0 ? d + 'j' : 'Expiré' }})
                              </span>
                            }
                          </span>
                        }
                        @if (c.dateFinPeriodeEssai) {
                          <span class="flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">timer</span>
                            Essai: {{ fmt(c.dateFinPeriodeEssai) }}
                          </span>
                        }
                        @if (c.referenceContrat) {
                          <span
                            class="font-mono text-[12px] bg-surface-container px-1.5 py-0.5 rounded"
                          >
                            {{ c.referenceContrat }}
                          </span>
                        }
                      </div>
                    </div>

                    <!-- Action buttons -->
                    @if (canEdit()) {
                      <div class="flex items-center gap-2 shrink-0">
                        @if (c.currentStatusCode === 'PERIODE_ESSAI') {
                          <daf-button
                            [options]="{
                              variant: 'ghost',
                              label: 'Valider essai',
                              iconStart: 'task_alt',
                              size: 'sm',
                            }"
                            (onClick)="validateTrialClick.emit(c.id)"
                          />
                        }
                        @if (
                          c.contractTypeCode === 'CDD' &&
                          (c.currentStatusCode === 'ACTIF' ||
                            c.currentStatusCode === 'ACTIF_CONFIRME')
                        ) {
                          <daf-button
                            [options]="{
                              variant: 'ghost',
                              label: 'Renouveler',
                              iconStart: 'autorenew',
                              size: 'sm',
                            }"
                            (onClick)="renewCDDClick.emit(c.id)"
                          />
                          <daf-button
                            [options]="{
                              variant: 'ghost',
                              label: 'Convertir CDI',
                              iconStart: 'upgrade',
                              size: 'sm',
                            }"
                            (onClick)="convertCDIClick.emit(c.id)"
                          />
                        }
                      </div>
                    }
                  </div>
                </daf-card>
              }
            </div>
          }
        </daf-card>
      </div>
    </div>
    <style>
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    </style>
  `,
})
export class ProfileContractTabComponent {
  profile = input.required<EmployeeProfile>();
  contracts = input.required<ContractHistoryDto[]>();
  lcContracts = input<ContractListDto[]>([]);
  lcLoading = input(false);
  canEdit = input(false);

  newContractClick = output<void>();
  validateTrialClick = output<number>();
  renewCDDClick = output<number>();
  convertCDIClick = output<number>();

  readonly contractColumns: TableColumn[] = [
    { key: 'type', label: 'Type', type: 'badge' },
    { key: 'document', label: 'Document', type: 'badge' },
    { key: 'dateEffet', label: 'Date effet', type: 'text' },
    { key: 'dateFin', label: 'Date fin', type: 'text' },
    { key: 'salaire', label: 'Salaire net', type: 'text' },
    { key: 'statut', label: 'Statut', type: 'badge' },
  ];

  contractRows(): TableRow[] {
    return this.contracts().map((c) => ({
      type: {
        label: c.typeContratLabelFr,
        options: { variant: c.typeDocument === 'CONTRAT_INITIAL' ? 'primary' : 'neutral' },
      } satisfies BadgeCell,
      document: {
        label: c.typeDocument === 'CONTRAT_INITIAL' ? 'Contrat initial' : 'Avenant',
        options: { variant: c.typeDocument === 'CONTRAT_INITIAL' ? 'info' : 'neutral', size: 'sm' },
      } satisfies BadgeCell,
      dateEffet: this.fmt(c.dateEffet),
      dateFin: c.dateFin ? this.fmt(c.dateFin) : 'CDI',
      salaire: c.salaireNet ? this.formatSalaire(c.salaireNet) : '—',
      statut: {
        label: c.isActive ? 'Actif' : 'Terminé',
        options: { variant: c.isActive ? 'success' : 'neutral', size: 'sm' },
      } satisfies BadgeCell,
    }));
  }

  statusCfg(code: string) {
    return (
      STATUS_CONFIG[code as keyof typeof STATUS_CONFIG] ?? {
        label: code,
        bg: '#f1f5f9',
        color: '#475569',
      }
    );
  }

  typeCfg(code: string) {
    return (
      CONTRACT_TYPE_CONFIG[code as keyof typeof CONTRACT_TYPE_CONFIG] ?? {
        label: code,
        needsEndDate: false,
        hasTrial: false,
      }
    );
  }

  daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  }

  formatSalaire(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  fmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR');
    } catch {
      return iso;
    }
  }
}
