import { Component, inject, input, OnChanges, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AdminService }        from './admin.service';
import { RequestTypeCatalog }  from './models/admin.model';
import { SpinnerComponent }    from '../../shared/spinner.component';
import { ModalComponent }      from '../../shared/modal.component';
import {
  SelectComponent, SelectOption,
  FormFieldComponent,
  ButtonComponent,
} from '@khalilrebhiitec/daf360';

const CATEGORIES = ['DOCUMENT','PERSONAL_DATA_CHANGE','BANK_DETAILS','CAREER','OTHER'];

@Component({
  selector: 'app-request-types-admin',
  standalone: true,
  imports: [SpinnerComponent, ModalComponent, SelectComponent, FormFieldComponent, ButtonComponent],
  template: `
    <div class="section-header">
      <div>
        <h3 class="col-title">Types de demandes RH</h3>
        <p class="col-sub">Catalogue par entité</p>
      </div>
      <div class="header-actions">
        <daf-button
          label="Initialiser par défaut"
          variant="ghost"
          [options]="{ disabled: seeding(), loading: seeding() }"
          (onClick)="seed()"
        />
        <daf-button label="+ Ajouter" variant="primary" (onClick)="openAdd()" />
      </div>
    </div>

    @if (loading()) { <div class="center"><app-spinner /></div> }
    @else if (types().length === 0) {
      <div class="empty-state">
        <p>Aucun type configuré.</p>
        <daf-button label="Initialiser les 15 types par défaut" variant="ghost" (onClick)="seed()" />
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
                <daf-button label="Modifier" variant="ghost" [options]="{ size: 'sm' }" (onClick)="openEdit(t)" />
                @if (t.isActive) {
                  <daf-button label="Désactiver" variant="danger" [options]="{ size: 'sm' }" (onClick)="deactivate(t)" />
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
        <div class="field-row">
          <daf-form-field
            [options]="{ label: 'Code', placeholder: 'EX: ATTESTATION_TRAVAIL', required: true, disabled: !!editTarget(), fullWidth: true }"
            [value]="form.typeCode"
            (valueChange)="form.typeCode = $any($event).toUpperCase()"
          />
        </div>
        <div class="field-row">
          <daf-form-field
            [options]="{ label: 'Libellé français', required: true, fullWidth: true }"
            [value]="form.displayNameFr"
            (valueChange)="form.displayNameFr = $any($event)"
          />
        </div>
        <div class="field-row">
          <daf-form-field
            [options]="{ label: 'Libellé anglais', required: true, fullWidth: true }"
            [value]="form.displayNameEn"
            (valueChange)="form.displayNameEn = $any($event)"
          />
        </div>
        <div class="form-row">
          <div class="field-row">
            <daf-select
              [selected]="[form.category]"
              [options]="categoryOptions"
              [config]="{ label: 'Catégorie', required: true, fullWidth: true }"
              (selectedChange)="form.category = $event[0]"
            />
          </div>
          <div class="field-row">
            <daf-select
              [selected]="[form.approvalLevel]"
              [options]="approvalLevelOptions"
              [config]="{ label: 'Niveau approbation', fullWidth: true }"
              (selectedChange)="onApprovalLevelChange($event[0])"
            />
          </div>
          <div class="field-row">
            <daf-form-field
              [options]="{ label: 'SLA (jours)', type: 'number', fullWidth: true }"
              [value]="form.defaultSlaDays"
              (valueChange)="form.defaultSlaDays = $any($event)"
            />
          </div>
        </div>
        <div class="field-row">
          <daf-form-field
            [options]="{ label: 'Description', type: 'textarea', rows: 2, fullWidth: true }"
            [value]="form.description"
            (valueChange)="form.description = $any($event)"
          />
        </div>
      </div>
      @if (modalError()) { <div class="error-banner" role="alert">{{ modalError() }}</div> }
      <div slot="footer">
        <daf-button label="Annuler" variant="secondary" (onClick)="showModal.set(false)" />
        <daf-button
          [label]="editTarget() ? 'Enregistrer' : 'Créer'"
          variant="teal"
          [options]="{ disabled: !form.typeCode || !form.displayNameFr || saving(), loading: saving() }"
          (onClick)="save()"
        />
      </div>
    </app-modal>
  `,
  styles: [`
    .section-header { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px }
    .col-title { font-size:13px;font-weight:700;margin:0 }
    .col-sub   { font-size:12px;color:var(--color-text-muted);margin:2px 0 0 }
    .header-actions { display:flex;gap:8px;align-items:center }
    .center   { display:flex;justify-content:center;padding:24px }
    .data-table { width:100%;border-collapse:collapse;font-size:13px }
    .data-table th { padding:8px 12px;background:var(--color-bg-secondary);border-bottom:1px solid var(--color-border);text-align:left;font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:var(--color-text-muted);white-space:nowrap }
    .data-table td { padding:9px 12px;border-bottom:1px solid var(--color-border) }
    .data-table tr:last-child td { border-bottom:none }
    .inactive  { opacity:.5 }
    .code-cell { font-family:monospace;font-size:11px;color:var(--color-primary);font-weight:600 }
    .cat-badge { display:inline-block;padding:1px 7px;border-radius:999px;background:var(--color-bg-secondary);font-size:10px;font-weight:600;color:var(--color-text-muted) }
    .level-badge { display:inline-block;padding:1px 7px;border-radius:999px;background:#dcfce7;color:var(--color-success);font-size:10px;font-weight:700 }
    .level-badge.l2 { background:#fef3c7;color:var(--color-warning) }
    .cell-center { text-align:center;color:var(--color-text-muted);font-size:13px }
    .actions-cell { display:flex;gap:6px }
    .empty-state { text-align:center;padding:36px;color:var(--color-text-muted);display:flex;flex-direction:column;align-items:center;gap:12px }
    .empty-state p { margin:0;font-size:13px }
    .modal-form { display:flex;flex-direction:column;gap:12px }
    .form-row   { display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px }
    .field-row  { display:flex;flex-direction:column;gap:4px }
    .error-banner { margin-top:8px;padding:8px 12px;border-radius:8px;background:var(--color-error-container);color:var(--color-on-error-container);font-size:12px }
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
  readonly categoryOptions: SelectOption[] = CATEGORIES.map(c => ({ value: c, label: c }));
  readonly approvalLevelOptions: SelectOption[] = [
    { value: 'L1', label: 'L1 (simple)' },
    { value: 'L2', label: 'L2 (double)' },
  ];

  form = { typeCode:'', displayNameFr:'', displayNameEn:'', description:'', category:'DOCUMENT', approvalLevel:'L1' as 'L1'|'L2', defaultSlaDays:2 };

  ngOnChanges() { this.load(); }

  private load() {
    this.loading.set(true);
    this.svc.listRequestTypes(this.paysId()).pipe(catchError(() => of([]))).subscribe(ts => {
      this.types.set(ts);
      this.loading.set(false);
    });
  }

  onApprovalLevelChange(value: string): void {
    this.form.approvalLevel = (value === 'L2' ? 'L2' : 'L1');
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
