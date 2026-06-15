import { Component, input } from '@angular/core';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { EmployeeDocument } from '../../../models/profile.model';

const DOC_TYPE_LABELS: Record<string, string> = {
  CONTRACT:            'Contrat',
  ID_CARD:             'Carte d\'identité',
  DIPLOMA:             'Diplôme',
  MEDICAL_CERTIFICATE: 'Certificat médical',
  RIB:                 'RIB',
  RESIGNATION:         'Démission',
  OTHER:               'Autre',
};

@Component({
  selector: 'rh-profile-documents-tab',
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    <div class="space-y-4">

      <!-- Header -->
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-2">
          <h3 class="font-bold text-[18px] text-on-surface">Documents</h3>
          <span class="bg-surface-container-highest px-2 py-0.5 rounded text-xs font-semibold">
            {{ documents().length }}
          </span>
        </div>
        <button class="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold
                       border border-outline-variant text-on-surface hover:border-[#1b3a4b]
                       transition-colors">
          <span class="material-symbols-outlined text-[16px]">add</span>
          Ajouter
        </button>
      </div>

      <!-- Empty state -->
      @if (documents().length === 0) {
        <div class="flex flex-col items-center justify-center py-16 text-outline gap-3
                    bg-white border border-outline-variant rounded-xl">
          <span class="material-symbols-outlined text-[48px]">folder_open</span>
          <p class="text-[14px]">Aucun document uploadé</p>
        </div>
      }

      <!-- Documents grid -->
      <div class="grid grid-cols-1 gap-3">
        @for (doc of documents(); track doc.id) {
          <div class="bg-white border border-outline-variant rounded-xl p-4
                      flex items-center gap-4 hover:shadow-sm transition-shadow">

            <!-- Icon -->
            <div class="w-10 h-10 rounded-lg bg-surface-container-low flex items-center
                        justify-center flex-shrink-0">
              <span class="material-symbols-outlined text-[20px] text-primary">description</span>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="font-bold text-[14px] text-on-surface">
                {{ docTypeLabel(doc.documentType) }}
              </p>
              <p class="text-[12px] text-outline truncate">
                {{ doc.fileName ?? 'Sans nom' }}
                @if (doc.fileSizeKb) {
                  <span class="ml-1">— {{ doc.fileSizeKb }} KB</span>
                }
              </p>
              <p class="text-[11px] text-outline mt-0.5">
                Ajouté le {{ fmt(doc.uploadedAt) }}
              </p>
            </div>

            <!-- Status badge -->
            <daf-badge
              [label]="statusLabel(doc.verificationStatus)"
              [options]="statusBadge(doc.verificationStatus)" />

            <!-- Download button -->
            <button class="p-2 rounded-lg hover:bg-surface-container transition-colors text-outline
                           hover:text-on-surface flex-shrink-0">
              <span class="material-symbols-outlined text-[18px]">download</span>
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class ProfileDocumentsTabComponent {
  documents = input.required<EmployeeDocument[]>();

  docTypeLabel(type: string): string {
    return DOC_TYPE_LABELS[type] ?? type;
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      VERIFIED: 'Vérifié',
      PENDING:  'En attente',
      REJECTED: 'Rejeté',
    };
    return map[status] ?? status;
  }

  statusBadge(status: string) {
    const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
      VERIFIED: { variant: 'success' },
      PENDING:  { variant: 'warning' },
      REJECTED: { variant: 'danger' },
    };
    return map[status] ?? { variant: 'neutral' };
  }

  fmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }
}
