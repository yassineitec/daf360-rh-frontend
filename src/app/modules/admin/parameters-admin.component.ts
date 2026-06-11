import { Component, inject, input, OnChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { AdminService }     from './admin.service';
import { ParameterSet }     from './models/admin.model';
import { SpinnerComponent } from '../../shared/spinner.component';

@Component({
  selector: 'app-parameters-admin',
  standalone: true,
  imports: [FormsModule, SpinnerComponent],
  template: `
    <div class="section-header">
      <div>
        <h3 class="col-title">Paramètres de paie</h3>
        <p class="col-sub">Configuration CNSS, IRPP, CSS, devise par entité</p>
      </div>
      <div class="header-actions">
        <button class="btn-seed" (click)="seed()" [disabled]="seeding()" type="button">
          @if (seeding()) { <app-spinner size="sm" /> }
          Initialiser par défaut
        </button>
        <button class="btn-add" (click)="startAdd()" type="button">+ Ajouter</button>
      </div>
    </div>

    @if (loading()) { <div class="center"><app-spinner /></div> }
    @else if (params().length === 0) {
      <div class="empty-state">
        <p>Aucun paramètre configuré.</p>
        <button class="btn-seed" (click)="seed()" type="button">Initialiser les valeurs par défaut</button>
      </div>
    } @else {
      <table class="data-table">
        <thead>
          <tr><th>Clé</th><th>Valeur</th><th>Description</th><th>Modifié</th><th></th></tr>
        </thead>
        <tbody>
          @for (p of params(); track p.id) {
            <tr>
              <td class="key-cell">{{ p.cle }}</td>
              <td>
                @if (editingId() === p.id) {
                  <input class="inline-input" type="text" [(ngModel)]="editValeur" (keydown.enter)="saveEdit(p)" />
                } @else {
                  <span class="valeur-cell" title="{{ p.valeur }}">
                    {{ p.valeur.length > 60 ? p.valeur.slice(0, 60) + '…' : p.valeur }}
                  </span>
                }
              </td>
              <td class="desc-cell">{{ p.description ?? '—' }}</td>
              <td class="date-cell">{{ fmtDate(p.updatedAt) }}</td>
              <td class="actions-cell">
                @if (editingId() === p.id) {
                  <button class="btn-ok"     (click)="saveEdit(p)" type="button">✓</button>
                  <button class="btn-cancel" (click)="editingId.set(null)" type="button">✕</button>
                } @else {
                  <button class="btn-edit"   (click)="startEdit(p)" type="button">Modifier</button>
                  <button class="btn-delete" (click)="del(p)" type="button">Suppr.</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    }

    <!-- Add row -->
    @if (addMode()) {
      <div class="add-row">
        <input class="form-input" type="text" [(ngModel)]="newCle"     placeholder="Clé (ex: TAUX_CNSS_EMPLOYE)" />
        <input class="form-input" type="text" [(ngModel)]="newValeur"  placeholder="Valeur" />
        <input class="form-input" type="text" [(ngModel)]="newDesc"    placeholder="Description (opt.)" />
        <button class="btn-ok" (click)="add()" [disabled]="!newCle.trim() || !newValeur.trim()" type="button">Créer</button>
        <button class="btn-cancel" (click)="addMode.set(false)" type="button">Annuler</button>
      </div>
    }

    @if (error()) { <div class="error-banner" role="alert">{{ error() }}</div> }
  `,
  styles: [`
    .section-header  { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px }
    .col-title       { font-size:13px;font-weight:700;margin:0 }
    .col-sub         { font-size:12px;color:var(--color-text-muted);margin:2px 0 0 }
    .header-actions  { display:flex;gap:8px }
    .center          { display:flex;justify-content:center;padding:24px }
    .data-table      { width:100%;border-collapse:collapse;font-size:13px }
    .data-table th   { padding:8px 12px;background:var(--color-bg-secondary,#EEF2F5);border-bottom:1px solid var(--color-border);text-align:left;font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:var(--color-text-muted);white-space:nowrap }
    .data-table td   { padding:9px 12px;border-bottom:1px solid var(--color-border);vertical-align:middle }
    .data-table tr:last-child td { border-bottom:none }
    .key-cell        { font-family:monospace;font-size:12px;font-weight:600;color:var(--color-primary,#1C4E5C);white-space:nowrap }
    .valeur-cell     { font-family:monospace;font-size:12px;color:var(--color-text-muted) }
    .desc-cell       { font-size:12px;color:var(--color-text-muted) }
    .date-cell       { font-size:11px;color:var(--color-text-muted);white-space:nowrap }
    .actions-cell    { display:flex;gap:6px;white-space:nowrap }
    .inline-input    { padding:4px 8px;border:1px solid var(--color-primary);border-radius:4px;font-size:12px;font-family:monospace;width:200px;outline:none }
    .empty-state     { text-align:center;padding:36px;color:var(--color-text-muted);display:flex;flex-direction:column;align-items:center;gap:12px }
    .empty-state p   { margin:0;font-size:13px }
    .add-row         { display:flex;gap:8px;align-items:center;margin-top:12px;padding:12px;background:var(--color-bg-secondary,#EEF2F5);border-radius:8px;flex-wrap:wrap }
    .form-input      { padding:7px 10px;border:1px solid var(--color-border);border-radius:6px;font-size:13px;background:#fff;outline:none;min-width:140px;flex:1 }
    .btn-add    { padding:6px 14px;background:var(--color-primary,#1C4E5C);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer }
    .btn-seed   { display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border:1px solid var(--color-border);background:none;border-radius:6px;font-size:12px;cursor:pointer;color:var(--color-text-muted) }
    .btn-seed:disabled { opacity:.5;cursor:not-allowed }
    .btn-edit   { padding:3px 8px;background:none;border:1px solid var(--color-border);border-radius:4px;font-size:11px;cursor:pointer;color:var(--color-primary,#1C4E5C) }
    .btn-delete { padding:3px 8px;background:none;border:1px solid #fca5a5;border-radius:4px;font-size:11px;cursor:pointer;color:#DC2626 }
    .btn-ok     { padding:4px 10px;background:#16A34A;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer }
    .btn-ok:disabled { opacity:.5;cursor:not-allowed }
    .btn-cancel { padding:4px 10px;background:#DC2626;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer }
    .error-banner { margin-top:10px;padding:8px 12px;border-radius:8px;background:#fee2e2;color:#991b1b;font-size:12px }
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
