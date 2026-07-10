import { Component, computed, inject, input, OnChanges, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AdminService }     from './admin.service';
import { ParameterSet }     from './models/admin.model';
import { SpinnerComponent } from '../../shared/spinner.component';
import { ModalComponent } from '../../shared/modal.component';
import {
  FormFieldComponent, ButtonComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

@Component({
  selector: 'app-parameters-admin',
  standalone: true,
  imports: [SpinnerComponent, FormFieldComponent, ButtonComponent, DataTableComponent, DafCellDirective, ModalComponent],
  template: `
    <div class="section-header">
      <div>
        <h3 class="col-title">Paramètres de paie</h3>
        <p class="col-sub">Configuration CNSS, IRPP, CSS, devise par entité</p>
      </div>
      <div class="header-actions">
        <daf-button
          label="Initialiser par défaut"
          variant="ghost"
          [options]="{ disabled: seeding(), loading: seeding() }"
          (onClick)="seed()"
        />
        <daf-button label="+ Ajouter" variant="primary" (onClick)="startAdd()" />
      </div>
    </div>

    @if (loading()) { <div class="center"><app-spinner /></div> }
    @else if (params().length === 0) {
      <div class="empty-state">
        <p>Aucun paramètre configuré.</p>
        <daf-button label="Initialiser les valeurs par défaut" variant="ghost" (onClick)="seed()" />
      </div>
    } @else {
      <daf-data-table [columns]="columns" [rows]="rows()" [config]="tableConfig()">
        <ng-template dafCell="cle" let-row>
          <span class="key-cell">{{ row['_source'].cle }}</span>
        </ng-template>

        <ng-template dafCell="valeur" let-row>
          @if (editingId() === row['_source'].id) {
            <daf-form-field
              [options]="{ fullWidth: true }"
              [value]="editValeur"
              (valueChange)="editValeur = $any($event)"
            />
          } @else {
            <span class="valeur-cell" [title]="row['_source'].valeur">
              {{ row['_source'].valeur.length > 60 ? row['_source'].valeur.slice(0, 60) + '…' : row['_source'].valeur }}
            </span>
          }
        </ng-template>

        <ng-template dafCell="description" let-row>
          <span class="desc-cell">{{ row['_source'].description ?? '—' }}</span>
        </ng-template>

        <ng-template dafCell="updatedAt" let-row>
          <span class="date-cell">{{ fmtDate(row['_source'].updatedAt) }}</span>
        </ng-template>

        <ng-template dafCell="_actions" let-row>
          @if (editingId() === row['_source'].id) {
            <daf-button label="" variant="primary" [options]="{ size: 'sm', iconStart: 'check' }" (onClick)="saveEdit(row['_source'])" />
            <daf-button label="" variant="secondary" [options]="{ size: 'sm', iconStart: 'close' }" (onClick)="editingId.set(null)" />
          } @else {
            <daf-button label="Modifier" variant="ghost" [options]="{ size: 'sm', iconStart: 'edit' }" (onClick)="startEdit(row['_source'])" />
            <daf-button label="Suppr." variant="danger" [options]="{ size: 'sm', iconStart: 'delete' }" (onClick)="del(row['_source'])" />
          }
        </ng-template>
      </daf-data-table>
    }

    @if (error()) { <div class="error-banner" role="alert">{{ error() }}</div> }

    <!-- Add modal -->
    <app-modal
      title="Ajouter un paramètre"
      [visible]="addMode()"
      [hasFooter]="true"
      (closed)="addMode.set(false)"
    >
      <div class="modal-form">
        <daf-form-field
          [options]="{ label: 'Clé', placeholder: 'Ex: TAUX_CNSS_EMPLOYE', required: true, fullWidth: true }"
          [value]="newCle"
          (valueChange)="newCle = $any($event)"
        />
        <daf-form-field
          [options]="{ label: 'Valeur', required: true, fullWidth: true }"
          [value]="newValeur"
          (valueChange)="newValeur = $any($event)"
        />
        <daf-form-field
          [options]="{ label: 'Description', placeholder: '(optionnel)', fullWidth: true }"
          [value]="newDesc"
          (valueChange)="newDesc = $any($event)"
        />
      </div>
      <div slot="footer">
        <daf-button label="Annuler" variant="secondary" (onClick)="addMode.set(false)" />
        <daf-button label="Créer" variant="primary" [options]="{ disabled: !newCle.trim() || !newValeur.trim() }" (onClick)="add()" />
      </div>
    </app-modal>
  `,
  styles: [`
    .section-header  { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px }
    .col-title       { font-size:13px;font-weight:700;margin:0 }
    .col-sub         { font-size:12px;color:var(--color-text-muted);margin:2px 0 0 }
    .header-actions  { display:flex;gap:8px }
    .center          { display:flex;justify-content:center;padding:24px }
    .key-cell        { font-family:monospace;font-size:12px;font-weight:600;color:var(--color-primary);white-space:nowrap }
    .valeur-cell     { font-family:monospace;font-size:12px;color:var(--color-text-muted) }
    .desc-cell       { font-size:12px;color:var(--color-text-muted) }
    .date-cell       { font-size:11px;color:var(--color-text-muted);white-space:nowrap }
    .empty-state     { text-align:center;padding:36px;color:var(--color-text-muted);display:flex;flex-direction:column;align-items:center;gap:12px }
    .empty-state p   { margin:0;font-size:13px }
    .modal-form      { display:flex;flex-direction:column;gap:14px }
    .error-banner { margin-top:10px;padding:8px 12px;border-radius:8px;background:var(--color-error-container);color:var(--color-on-error-container);font-size:12px }
  `],
})
export class ParametersAdminComponent implements OnChanges {
  private svc  = inject(AdminService);

  paysId = input(179);

  loading  = signal(false);
  seeding  = signal(false);
  params   = signal<ParameterSet[]>([]);
  error    = signal<string | null>(null);

  editingId = signal<number | null>(null);
  editValeur = '';

  addMode  = signal(false);
  newCle   = '';
  newValeur = '';
  newDesc  = '';

  readonly columns: TableColumn[] = [
    { key: 'cle',         label: 'Clé' },
    { key: 'valeur',      label: 'Valeur' },
    { key: 'description', label: 'Description' },
    { key: 'updatedAt',   label: 'Modifié' },
    { key: '_actions',    label: '', align: 'right' },
  ];

  readonly rows = computed<TableRow[]>(() =>
    this.params().map(p => ({
      cle:         p.cle,
      valeur:      p.valeur,
      description: p.description,
      updatedAt:   p.updatedAt,
      _source:     p,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => ({
    hoverable: true,
  }));

  ngOnChanges() { this.load(); }

  private load() {
    this.loading.set(true);
    this.svc.listParameters(this.paysId()).pipe(catchError(() => of([]))).subscribe(ps => {
      this.params.set(ps);
      this.loading.set(false);
    });
  }

  startEdit(p: ParameterSet) { this.editingId.set(p.id); this.editValeur = p.valeur; }

  saveEdit(p: ParameterSet) {
    this.svc.updateParameter(p.id, { paysId: this.paysId(), cle: p.cle, valeur: this.editValeur, description: p.description ?? undefined })
      .pipe(catchError(err => { this.error.set(err?.error?.message ?? 'Erreur'); return of(null); }))
      .subscribe(updated => {
        if (updated) { this.params.update(ps => ps.map(x => x.id === updated.id ? updated : x)); this.editingId.set(null); }
      });
  }

  del(p: ParameterSet) {
    if (!confirm(`Supprimer "${p.cle}" ?`)) return;
    this.svc.deleteParameter(p.id).pipe(catchError(() => of(null))).subscribe(() => {
      this.params.update(ps => ps.filter(x => x.id !== p.id));
    });
  }

  startAdd() { this.addMode.set(true); this.newCle = ''; this.newValeur = ''; this.newDesc = ''; }

  add() {
    this.svc.createParameter({ paysId: this.paysId(), cle: this.newCle.toUpperCase(), valeur: this.newValeur, description: this.newDesc || undefined })
      .pipe(catchError(err => { this.error.set(err?.error?.message ?? 'Erreur'); return of(null); }))
      .subscribe(created => {
        if (created) { this.params.update(ps => [...ps, created]); this.addMode.set(false); }
      });
  }

  seed() {
    this.seeding.set(true);
    this.svc.seedParameters().pipe(catchError(() => of(null))).subscribe(() => { this.seeding.set(false); this.load(); });
  }

  fmtDate(iso: string): string {
    try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return iso; }
  }
}
