import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocumentService } from '../../core/services/document.service';
import { HrDocument, DocumentType } from '../../core/models/document.model';

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'CONTRACT',            label: 'Contract' },
  { value: 'ID_CARD',             label: 'ID Card' },
  { value: 'DIPLOMA',             label: 'Diploma' },
  { value: 'MEDICAL_CERTIFICATE', label: 'Medical Certificate' },
  { value: 'RESIDENCE_PERMIT',    label: 'Residence Permit' },
  { value: 'RIB',                 label: 'RIB' },
  { value: 'RESIGNATION',         label: 'Resignation' },
  { value: 'OTHER',               label: 'Other' },
];

@Component({
  selector: 'app-document-list',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <h2 class="page-title">Documents</h2>
    </div>

    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

    <!-- Employee selector -->
    <div class="search-bar">
      <input class="search-input" type="number" [(ngModel)]="employeeId"
             placeholder="Employee ID" style="max-width:160px"/>
      <button class="btn btn-secondary" (click)="load()" [disabled]="!employeeId || loading()">
        Load documents
      </button>
    </div>

    @if (docs().length > 0 || searched()) {
      <div class="card" style="margin-bottom:20px">

        <!-- Upload form -->
        <div class="card-header">
          <span class="text-strong">Upload document</span>
        </div>
        <div class="card-body" style="display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap">
          <div class="form-group" style="flex:0 0 auto">
            <label class="form-label">Type</label>
            <select class="form-control" [(ngModel)]="uploadType">
              @for (dt of docTypes; track dt.value) {
                <option [value]="dt.value">{{ dt.label }}</option>
              }
            </select>
          </div>
          <div class="form-group" style="flex:1; min-width:200px">
            <label class="form-label">File</label>
            <input class="form-control" type="file" (change)="onFile($event)"/>
          </div>
          <label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; color:var(--ink-600); padding-bottom:2px">
            <input type="checkbox" [(ngModel)]="confidential"/> Confidential
          </label>
          <button class="btn btn-primary" (click)="upload()" [disabled]="!selectedFile || uploading()">
            {{ uploading() ? 'Uploading…' : 'Upload' }}
          </button>
        </div>
      </div>

      <!-- Document list -->
      <div class="card">
        @if (docs().length === 0) {
          <div class="empty-state"><p>No documents for this employee.</p></div>
        } @else {
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>File name</th>
                  <th>Type</th>
                  <th>Version</th>
                  <th>Confidential</th>
                  <th>Uploaded by</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                @for (doc of docs(); track doc.id) {
                  <tr>
                    <td class="text-strong">{{ doc.fileName }}</td>
                    <td><span class="badge">{{ doc.documentType }}</span></td>
                    <td>v{{ doc.version }}</td>
                    <td>{{ doc.confidential ? '🔒 Yes' : 'No' }}</td>
                    <td class="text-muted">{{ doc.createdBy }}</td>
                    <td class="text-muted">{{ doc.createdAt.slice(0,10) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    }

    @if (loading()) {
      <div class="spinner-wrap"><div class="spinner"></div></div>
    }
  `,
})
export class DocumentListComponent {
  employeeId   = 0;
  uploadType: DocumentType = 'CONTRACT';
  confidential = false;
  selectedFile: File | null = null;

  docs      = signal<HrDocument[]>([]);
  loading   = signal(false);
  uploading = signal(false);
  error     = signal('');
  searched  = signal(false);

  readonly docTypes = DOC_TYPES;

  constructor(private documentService: DocumentService) {}

  load(): void {
    if (!this.employeeId) return;
    this.loading.set(true);
    this.error.set('');
    this.documentService.listForEmployee(this.employeeId).subscribe({
      next:  (d) => { this.docs.set(d); this.searched.set(true); this.loading.set(false); },
      error: (e) => { this.error.set(e.error?.message ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  upload(): void {
    if (!this.selectedFile || !this.employeeId) return;
    this.uploading.set(true);
    this.error.set('');
    this.documentService
      .upload(this.employeeId, this.uploadType, this.selectedFile, this.confidential)
      .subscribe({
        next: (doc) => {
          this.docs.update((list) => [doc, ...list]);
          this.selectedFile = null;
          this.uploading.set(false);
        },
        error: (e) => {
          this.error.set(e.error?.message ?? 'Upload failed');
          this.uploading.set(false);
        },
      });
  }
}
