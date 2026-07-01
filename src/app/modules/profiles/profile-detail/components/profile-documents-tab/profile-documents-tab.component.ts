import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { EmployeeDocument } from '../../../models/profile.model';

const DOC_TYPE_LABELS: Record<string, string> = {
  CONTRACT:            'Contrat',
  ID_CARD:             "Carte d'identité",
  DIPLOMA:             'Diplôme',
  MEDICAL_CERTIFICATE: 'Certificat médical',
  RIB:                 'RIB',
  RESIGNATION:         'Démission',
  OTHER:               'Autre',
};

const DOC_TYPES = Object.keys(DOC_TYPE_LABELS);

@Component({
  selector: 'rh-profile-documents-tab',
  standalone: true,
  imports: [FormsModule, StatusBadgeComponent],
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

        @if (canEdit()) {
          <label
            class="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold
                   border border-outline-variant text-on-surface hover:border-[#1b3a4b]
                   hover:text-[#1b3a4b] transition-colors cursor-pointer">
            <span class="material-symbols-outlined text-[16px]">upload_file</span>
            Ajouter
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              class="sr-only"
              (change)="onFileChange($event)" />
          </label>

          <!-- Upload type selector (shown after file is picked) -->
          @if (pendingFile()) {
            <div class="flex items-center gap-2 bg-blue-50 border border-blue-200
                        rounded-lg px-3 py-2 text-[13px]">
              <span class="material-symbols-outlined text-[16px] text-blue-600">attach_file</span>
              <span class="text-blue-800 font-medium truncate max-w-[120px]">
                {{ pendingFile()!.name }}
              </span>
              <select class="bg-white border border-blue-200 rounded-md px-2 py-1
                             text-[12px] text-blue-800 outline-none"
                      [(ngModel)]="uploadDocType">
                @for (t of docTypes; track t) {
                  <option [value]="t">{{ typeLabel(t) }}</option>
                }
              </select>
              <button
                class="px-3 py-1 rounded-md bg-[#1b3a4b] text-white text-[12px] font-semibold
                       hover:opacity-90 transition-opacity"
                (click)="confirmUpload()">
                Confirmer
              </button>
              <button
                class="p-1 rounded-md hover:bg-blue-100 transition-colors text-blue-600"
                (click)="cancelUpload()">
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          }
        }
      </div>

      <!-- Empty state -->
      @if (documents().length === 0) {
        <div class="flex flex-col items-center justify-center py-16 text-outline gap-3
                    bg-white border border-outline-variant rounded-xl">
          <span class="material-symbols-outlined text-[48px]">folder_open</span>
          <p class="text-[14px]">Aucun document uploadé</p>
        </div>
      }

      <!-- Documents list -->
      <div class="grid grid-cols-1 gap-3">
        @for (doc of documents(); track doc.id) {
          <div class="bg-white border border-outline-variant rounded-xl p-4
                      flex items-center gap-4 hover:shadow-sm transition-shadow">

            <!-- Type icon -->
            <div class="w-10 h-10 rounded-lg bg-surface-container-low flex items-center
                        justify-center shrink-0">
              <span class="material-symbols-outlined text-[20px] text-primary">
                {{ docTypeIcon(doc.documentType) }}
              </span>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="font-bold text-[14px] text-on-surface">
                {{ typeLabel(doc.documentType) }}
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

            <!-- Verification badge -->
            <daf-badge
              [label]="statusLabel(doc.verificationStatus)"
              [options]="statusBadge(doc.verificationStatus)" />

            <!-- Download -->
            <a
              [href]="doc.fileUrl"
              target="_blank"
              rel="noopener"
              class="p-2 rounded-lg hover:bg-surface-container transition-colors text-outline
                     hover:text-on-surface shrink-0"
              title="Télécharger">
              <span class="material-symbols-outlined text-[18px]">download</span>
            </a>
          </div>
        }
      </div>
    </div>
  `,
})
export class ProfileDocumentsTabComponent {
  documents = input.required<EmployeeDocument[]>();
  canEdit   = input(false);

  uploadFile = output<{ file: File; docType: string }>();

  readonly docTypes = DOC_TYPES;

  pendingFile   = signal<File | null>(null);
  uploadDocType = 'CONTRACT';

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (file) {
      this.pendingFile.set(file);
      this.uploadDocType = 'CONTRACT';
    }
  }

  confirmUpload(): void {
    const file = this.pendingFile();
    if (file) {
      this.uploadFile.emit({ file, docType: this.uploadDocType });
      this.pendingFile.set(null);
    }
  }

  cancelUpload(): void { this.pendingFile.set(null); }

  typeLabel(type: string): string { return DOC_TYPE_LABELS[type] ?? type; }

  docTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      CONTRACT:            'description',
      ID_CARD:             'badge',
      DIPLOMA:             'school',
      MEDICAL_CERTIFICATE: 'medical_information',
      RIB:                 'account_balance',
      RESIGNATION:         'exit_to_app',
      OTHER:               'attach_file',
    };
    return icons[type] ?? 'description';
  }

  statusLabel(status: string): string {
    return { VERIFIED: 'Vérifié', PENDING: 'En attente', REJECTED: 'Rejeté' }[status] ?? status;
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
