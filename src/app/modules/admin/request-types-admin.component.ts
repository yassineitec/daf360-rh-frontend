import { Component, inject, input, OnChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { AdminService }        from './admin.service';
import { RequestTypeCatalog }  from './models/admin.model';
import { SpinnerComponent }    from '../../shared/spinner.component';
import { ModalComponent }      from '../../shared/modal.component';

const CATEGORIES = ['DOCUMENT','PERSONAL_DATA_CHANGE','BANK_DETAILS','CAREER','OTHER'];

@Component({
  selector: 'app-request-types-admin',
  standalone: true,
  imports: [FormsModule, SpinnerComponent, ModalComponent],
  template: `
    <div class="section-header">
      <div>
        <h3 class="col-title">Types de demandes RH</h3>
        <p class="col-sub">Catalogue par entité</p>
      </div>
      <div class="header-actions">
        <button class="btn-ghost" (click)="seed()" [disabled]="seeding()" type="button">
          @if (seeding()) { <app-spinner size="sm" /> } Initialiser par défaut
        </button>
        <button class="btn-add" (click)="openAdd()" type="button">+ Ajouter</button>
      </div>
    </div>

    @if (loading()) { <div class="center"><app-spinner /></div> }
    @else if (types().length === 0) {
      <div class="empty-state">
        <p>Aucun type configuré.</p>
        <button class="btn-ghost" (click)="seed()" type="button">Initialiser les 15 types par défaut</button>
      </div>
    } @else {
      <table class="data-table">
        <thead>
          <tr><th>Code</th><th>Libellé</th><th>Catégorie</th><th>Approbation</th><th>SLA</th><th>Actif</th><th></th></tr>
        </thead>
        <tbody>
          @for (t of types(); track t.id) {
            <tr [class.inactive]="!t.isActive">
              <td class="code-cell">{{ t.typeCode }}</td>
              <td>{{ t.displayNameFr }}</td>
              <td><span class="cat-badge">{{ t.category }}</span></td>
              <td><span class="level-badge" [class.l2]="t.approvalLevel === 'L2'">{{ t.approvalLevel }}</span></td>
              <td class="cell-center">{{ t.defaultSlaDays }}j</td>
              <td class="cell-center">{{ t.isActive ? '✓' : '—' }}</td>
              <td class="actions-cell">
                <button class="btn-edit"   (click)="openEdit(t)" type="button">Modifier</button>
                @if (t.isActive) {
                  <button class="btn-delete" (click)="deactivate(t)" type="button">Désactiver</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    }

    <!-- Add/Edit Modal -->
    <app-modal
      [title]="editTarget() ? 'Modifier le type' : 'Nouveau type de demande'"
      [visible]="showModal()"
      [hasFooter]="true"
      (closed)="showModal.set(false)"
    >
      <div class="modal-form">
        <div class="field-row"><label class="form-label">Code *</label>
          <input class="form-input" type="text" [(ngModel)]="form.typeCode" [disabled]="!!editTarget()"
                 placeholder="EX: ATTESTATION_TRAVAIL" style="text-transform:uppercase" /></div>
        <div class="field-row"><label class="form-label">Libellé français *</label>
          <input class="form-input" type="text" [(ngModel)]="form.displayNameFr" /></div>
        <div class="field-row"><label class="form-label">Libellé anglais *</label>
          <input class="form-input" type="text" [(ngModel)]="form.displayNameEn" /></div>
        <div class="form-row">
          <div class="field-row"><label class="form-label">Catégorie *</label>
            <select class="form-input" [(ngModel)]="form.category">
              @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
            </select></div>
          <div class="field-row"><label class="form-label">Niveau approbation</label>
            <select class="form-input" [(ngModel)]="form.approvalLevel">
              <option value="L1">L1 (simple)</option>
              <option value="L2">L2 (double)</option>
            </select></div>
          <div class="field-row"><label class="form-label">SLA (jours)</label>
            <input class="form-input" type="number" [(ngModel)]="form.defaultSlaDays" min="1" max="30" /></div>
        </div>
        <div class="field-row"><label class="form-label">Description</label>
          <textarea class="form-input" rows="2" [(ngModel)]="form.description"></textarea></div>
      </div>
      @if (modalError()) { <div class="error-banner" role="alert">{{ modalError() }}</div> }
      <div slot="footer">
        <button class="btn-ghost" (click)="showModal.set(false)" type="button">Annuler</button>
        <button class="btn-save" [disabled]="!form.typeCode || !form.displayNameFr || saving()" (click)="save()" type="button">
          @if (saving()) { <app-spinner size="sm" /> }
          {{ editTarget() ? 'Enregistrer' : 'Créer' }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    .section-header { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px }
    .col-title { font-size:13px;font-weight:700;margin:0 }
    .col-sub   { font-size:12px;color:var(--color-text-muted);margin:2px 0 0 }
    .header-actions { display:flex;gap:8px;align-items:center }
    .btn-add  { padding:6px 14px;background:var(--color-primary,#1C4E5C);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer }
    .btn-ghost{ display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border:1px solid var(--color-border);background:none;border-radius:6px;font-size:12px;cursor:pointer;color:var(--color-text-muted) }
    .btn-ghost:disabled { opacity:.5;cursor:not-allowed }
    .center   { display:flex;justify-content:center;padding:24px }
    .data-table { width:100%;border-collapse:collapse;font-size:13px }
    .data-table th { padding:8px 12px;background:var(--color-bg-secondary,#EEF2F5);border-bottom:1px solid var(--color-border);text-align:left;font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:var(--color-text-muted);white-space:nowrap }
    .data-table td { padding:9px 12px;border-bottom:1px solid var(--color-border) }
    .data-table tr:last-child td { border-bottom:none }
    .inactive  { opacity:.5 }
    .code-cell { font-family:monospace;font-size:11px;color:var(--color-primary);font-weight:600 }
    .cat-badge { display:inline-block;padding:1px 7px;border-radius:999px;background:var(--color-bg-secondary);font-size:10px;font-weight:600;color:var(--color-text-muted) }
    .level-badge { display:inline-block;padding:1px 7px;border-radius:999px;background:#dcfce7;color:#16A34A;font-size:10px;font-weight:700 }
    .level-badge.l2 { background:#fef3c7;color:#D97706 }
    .cell-center { text-align:center;color:var(--color-text-muted);font-size:13px }
    .actions-cell { display:flex;gap:6px }
    .btn-edit   { padding:3px 8px;background:none;border:1px solid var(--color-border);border-radius:4px;font-size:11px;cursor:pointer;color:var(--color-primary) }
    .btn-delete { padding:3px 8px;background:none;border:1px solid #fca5a5;border-radius:4px;font-size:11px;cursor:pointer;color:#DC2626 }
    .empty-state { text-align:center;padding:36px;color:var(--color-text-muted);display:flex;flex-direction:column;align-items:center;gap:12px }
    .empty-state p { margin:0;font-size:13px }
    .modal-form { display:flex;flex-direction:column;gap:12px }
    .form-row   { display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px }
    .field-row  { display:flex;flex-direction:column;gap:4px }
    .form-label { font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-muted) }
    .form-input { padding:8px 12px;border:1px solid var(--color-border);border-radius:8px;font-size:13px;font-family:inherit;outline:none;width:100%;background:#fff;resize:vertical }
    .form-input:focus { border-color:var(--color-primary) }
    .error-banner { margin-top:8px;padding:8px 12px;border-radius:8px;background:#fee2e2;color:#991b1b;font-size:12px }
    .btn-save { display:inline-flex;align-items:center;gap:5px;padding:7px 16px;background:var(--color-primary,#1C4E5C);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer }
    .btn-save:disabled { opacity:.5;cursor:not-allowed }
  `],
})
export class RequestTypesAdminComponent implements OnChanges {
  private svc = inject(AdminService);

  paysId = input(179);

  loading    = signal(false);
  seeding    = signal(false);
  saving     = signal(false);
  types      = signal<RequestTypeCatalog[]>([]);
  showModal  = signal(false);
  editTarget = signal<RequestTypeCatalog | null>(null);
  modalError = signal<string | null>(null);

  readonly categories = CATEGORIES;

  form = { typeCode:'', displayNameFr:'', displayNameEn:'', description:'', category:'DOCUMENT', approvalLevel:'L1' as 'L1'|'L2', defaultSlaDays:2 };

  ngOnChanges() { this.load(); }

  private load() {
    this.loading.set(true);
    this.svc.listRequestTypes(this.paysId()).pipe(catchError(() => of([]))).subscribe(ts => {
      this.types.set(ts);
      this.loading.set(false);
    });
  }

  openAdd()  { this.editTarget.set(null); this.form = { typeCode:'', displayNameFr:'', displayNameEn:'', description:'', category:'DOCUMENT', approvalLevel:'L1', defaultSlaDays:2 }; this.showModal.set(true); this.modalError.set(null); }
  openEdit(t: RequestTypeCatalog) { this.editTarget.set(t); this.form = { typeCode:t.typeCode, displayNameFr:t.displayNameFr, displayNameEn:t.displayNameEn, description:t.description??'', category:t.category, approvalLevel:t.approvalLevel, defaultSlaDays:t.defaultSlaDays }; this.showModal.set(true); this.modalError.set(null); }

  save() {
    this.saving.set(true);
    const dto = { paysId:this.paysId(), ...this.form };
    const obs = this.editTarget() ? this.svc.updateRequestType(this.editTarget()!.id, dto) : this.svc.createRequestType(dto);
    obs.pipe(catchError(err => { this.modalError.set(err?.error?.message ?? 'Erreur'); this.saving.set(false); return of(null); }))
       .subscribe(r => { this.saving.set(false); if (r) { this.showModal.set(false); this.load(); } });
  }

  deactivate(t: RequestTypeCatalog) {
    if (!confirm(`Désactiver "${t.displayNameFr}" ?`)) return;
    this.svc.deactivateRequestType(t.id).pipe(catchError(() => of(null))).subscribe(() => this.load());
  }

  seed() {
    this.seeding.set(true);
    this.svc.seedRequestTypes().pipe(catchError(() => of(null))).subscribe(() => { this.seeding.set(false); this.load(); });
  }
}
