import { Component, input } from '@angular/core';
import { MetricCardComponent, DataTableComponent } from '@khalilrebhiitec/daf360';
import type { TableColumn, TableRow, BadgeCell, MetricDelta } from '@khalilrebhiitec/daf360';
import { LeaveBalanceDto, LeaveHistoryDto } from '../../../services/profile-detail.service';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CONGE:    'Congés Annuels',
  MALADIE:  'Congé Maladie',
  RTT:      'RTT',
  MATERNITE:'Maternité',
  PATERNITE:'Paternité',
  SANS_SOLDE:'Sans Solde',
  EXCEPTIONNEL:'Exceptionnel',
};

const ETAT_LABELS: Record<string, string> = {
  VALIDE:    'Validé',
  EN_ATTENTE:'En attente',
  REFUSE:    'Refusé',
};

@Component({
  selector: 'rh-profile-leaves-tab',
  standalone: true,
  imports: [MetricCardComponent, DataTableComponent],
  template: `
    <div class="space-y-6">

      <!-- Balance cards -->
      @if (balances().length > 0) {
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          @for (b of balances(); track b.leaveType) {
            <daf-metric-card
              [value]="b.joursRestants.toString()"
              [label]="leaveTypeLabel(b.leaveType)"
              [delta]="balanceDelta(b)" />
          }
        </div>
      } @else {
        <div class="flex flex-col items-center justify-center py-10
                    bg-white border border-outline-variant rounded-xl text-outline gap-2">
          <span class="material-symbols-outlined text-[36px]">beach_access</span>
          <p class="text-[14px]">Aucun solde disponible</p>
        </div>
      }

      <!-- History table -->
      <div class="bg-white border border-outline-variant rounded-xl p-6">
        <h3 class="font-bold text-[16px] text-on-surface mb-4">
          Historique des demandes
        </h3>
        @if (history().length === 0) {
          <div class="flex flex-col items-center justify-center py-10 text-outline gap-2">
            <span class="material-symbols-outlined text-[36px]">history</span>
            <p class="text-[14px]">Aucune demande enregistrée</p>
          </div>
        } @else {
          <daf-data-table [columns]="historyColumns" [rows]="historyRows()" />
        }
      </div>
    </div>
  `,
})
export class ProfileLeavesTabComponent {
  balances = input.required<LeaveBalanceDto[]>();
  history  = input.required<LeaveHistoryDto[]>();

  readonly historyColumns: TableColumn[] = [
    { key: 'type',    label: 'Type',       type: 'text' },
    { key: 'debut',   label: 'Début',      type: 'text' },
    { key: 'fin',     label: 'Fin',        type: 'text' },
    { key: 'jours',   label: 'Jours',      type: 'number', align: 'center' },
    { key: 'statut',  label: 'Statut',     type: 'badge' },
    { key: 'comment', label: 'Commentaire',type: 'text' },
  ];

  leaveTypeLabel(type: string): string {
    return LEAVE_TYPE_LABELS[type] ?? type;
  }

  balanceDelta(b: LeaveBalanceDto): MetricDelta {
    return {
      value:     `${b.joursPris}j pris / ${b.joursAcquis}j acquis`,
      direction: 'neutral',
    } as MetricDelta;
  }

  historyRows(): TableRow[] {
    return this.history().map(h => ({
      type:    this.leaveTypeLabel(h.leaveType),
      debut:   this.fmt(h.startDate),
      fin:     this.fmt(h.endDate),
      jours:   h.totalJours,
      statut:  {
        label:   ETAT_LABELS[h.etatDemande] ?? h.etatDemande,
        options: {
          variant: h.etatDemande === 'VALIDE'
            ? 'success'
            : h.etatDemande === 'EN_ATTENTE'
              ? 'warning'
              : 'danger',
          size: 'sm',
        },
      } satisfies BadgeCell,
      comment: h.comment ?? '—',
    }));
  }

  fmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }
}
