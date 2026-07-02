import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InterviewService } from '../candidates/interview.service';
import { InterviewType } from '../candidates/interview.model';

@Component({
  selector: 'app-interview-types-admin',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="ita-wrap">

      <!-- Header -->
      <div class="ita-header">
        <div>
          <h2 class="ita-title">Types d'entretiens</h2>
          <p class="ita-sub">{{ types().length }} type(s) configuré(s) pour cette entité</p>
        </div>
        @if (!showAdd()) {
          <button class="ita-add-btn" (click)="startAdd()" type="button">
            <span class="material-symbols-outlined" style="font-size:16px">add</span>
            Nouveau type
          </button>
        }
      </div>

      <!-- Global error -->
      @if (error()) {
        <div class="ita-error">{{ error() }}</div>
      }

      <!-- Add form -->
      @if (showAdd()) {
        <div class="ita-form-card">
          <p class="ita-form-title">Nouveau type d'entretien</p>
          <div class="ita-form-grid">
            <div>
              <label class="ita-label">Nom *</label>
              <input class="ita-input" [(ngModel)]="newName"
                     placeholder="Ex : Entretien Technique" maxlength="150" />
            </div>
            <div>
              <label class="ita-label">Ordre d'affichage</label>
              <input class="ita-input" type="number" [(ngModel)]="newOrder" min="0" />
            </div>
            <div style="grid-column:1/-1">
              <label class="ita-label">Description</label>
              <input class="ita-input" [(ngModel)]="newDesc"
                     placeholder="Description optionnelle" maxlength="500" />
            </div>
          </div>
          @if (addError()) {
            <p class="ita-field-error">{{ addError() }}</p>
          }
          <div class="ita-form-actions">
            <button class="ita-btn-ghost" (click)="cancelAdd()" type="button">Annuler</button>
            <button class="ita-btn-primary" (click)="submitAdd()"
                    [disabled]="addLoading()" type="button">
              {{ addLoading() ? 'Enregistrement...' : 'Ajouter' }}
            </button>
          </div>
        </div>
      }

      <!-- List -->
      @if (loading()) {
        <div class="ita-spinner-wrap">
          <span class="material-symbols-outlined ita-spin">progress_activity</span>
        </div>
      } @else {
        <div class="ita-list">
          @for (t of types(); track t.id) {
            @if (editingId() === t.id) {
              <!-- Edit row -->
              <div class="ita-edit-row">
                <div class="ita-form-grid">
                  <div>
                    <label class="ita-label">Nom *</label>
                    <input class="ita-input" [(ngModel)]="editName" maxlength="150" />
                  </div>
                  <div>
                    <label class="ita-label">Ordre</label>
                    <input class="ita-input" type="number" [(ngModel)]="editOrder" min="0" />
                  </div>
                  <div style="grid-column:1/-1">
                    <label class="ita-label">Description</label>
                    <input class="ita-input" [(ngModel)]="editDesc" maxlength="500" />
                  </div>
                </div>
                @if (editError()) {
                  <p class="ita-field-error">{{ editError() }}</p>
                }
                <div class="ita-form-actions" style="margin-top:10px">
                  <button class="ita-btn-ghost" (click)="cancelEdit()" type="button">Annuler</button>
                  <button class="ita-btn-primary" (click)="saveEdit(t.id)"
                          [disabled]="editLoading()" type="button">
                    {{ editLoading() ? 'Enregistrement...' : 'Sauvegarder' }}
                  </button>
                </div>
              </div>
            } @else {
              <!-- Normal row -->
              <div class="ita-row" [class.ita-row--inactive]="!t.isActive">
                <div class="ita-row-meta">
                  <span class="ita-order">{{ t.orderIndex }}</span>
                  <div>
                    <div class="ita-row-name">{{ t.name }}</div>
                    @if (t.description) {
                      <div class="ita-row-desc">{{ t.description }}</div>
                    }
                  </div>
                </div>
                <div class="ita-row-actions">
                  @if (!t.isActive) {
                    <span class="ita-badge-inactive">Inactif</span>
                  }
                  <button class="ita-icon-btn" title="Modifier"
                          (click)="startEdit(t)" type="button">
                    <span class="material-symbols-outlined" style="font-size:17px">edit</span>
                  </button>
                  <button class="ita-icon-btn"
                          [title]="t.isActive ? 'Désactiver' : 'Activer'"
                          (click)="toggleActive(t)" type="button"
                          [style.color]="t.isActive ? '#50717b' : '#9CA3AF'">
                    <span class="material-symbols-outlined" style="font-size:22px">
                      {{ t.isActive ? 'toggle_on' : 'toggle_off' }}
                    </span>
                  </button>
                </div>
              </div>
            }
          }
          @if (!types().length && !loading()) {
            <p class="ita-empty">Aucun type d'entretien configuré. Ajoutez-en un ci-dessus.</p>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .ita-wrap   { max-width:780px }
    .ita-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:20px }
    .ita-title  { font-size:15px;font-weight:600;color:var(--color-text,#1A1C1E);margin:0 }
    .ita-sub    { font-size:12px;color:var(--color-text-muted,#6B7280);margin:3px 0 0 }
    .ita-add-btn { display:flex;align-items:center;gap:6px;padding:8px 16px;background:var(--color-primary,#1C4E5C);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer }
    .ita-add-btn:hover { opacity:.9 }
    .ita-form-card  { background:#f8fafb;border:1px solid #E0E7E9;border-radius:10px;padding:16px;margin-bottom:16px }
    .ita-form-title { font-size:13px;font-weight:600;margin:0 0 12px;color:#1A1C1E }
    .ita-form-grid  { display:grid;grid-template-columns:1fr 120px;gap:10px }
    .ita-label  { display:block;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px }
    .ita-input  { width:100%;padding:8px 10px;border:1px solid #D1D5DB;border-radius:6px;font-size:13px;color:#1A1C1E;box-sizing:border-box }
    .ita-input:focus { outline:none;border-color:var(--color-primary,#1C4E5C) }
    .ita-field-error { font-size:12px;color:#BA1A1A;margin:6px 0 0 }
    .ita-form-actions { display:flex;justify-content:flex-end;gap:8px;margin-top:12px }
    .ita-btn-primary { padding:7px 16px;background:var(--color-primary,#1C4E5C);color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer }
    .ita-btn-primary:disabled { opacity:.6;cursor:not-allowed }
    .ita-btn-ghost  { padding:7px 14px;background:none;color:var(--color-text-muted,#6B7280);border:1px solid #D1D5DB;border-radius:7px;font-size:13px;cursor:pointer }
    .ita-error  { background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 14px;font-size:13px;color:#BA1A1A;margin-bottom:14px }
    .ita-spinner-wrap { display:flex;justify-content:center;padding:32px }
    .ita-spin   { font-size:28px;color:#9CA3AF;animation:spin 1s linear infinite }
    @keyframes spin { to { transform:rotate(360deg) } }
    .ita-list   { display:flex;flex-direction:column;gap:6px }
    .ita-row    { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:#fff;border:1px solid #E0E7E9;border-radius:8px }
    .ita-row--inactive { opacity:.55 }
    .ita-row-meta { display:flex;align-items:center;gap:12px;min-width:0 }
    .ita-order  { display:flex;align-items:center;justify-content:center;min-width:26px;height:26px;border-radius:6px;background:#f0f4f5;font-size:11px;font-weight:700;color:#50717b }
    .ita-row-name { font-size:13px;font-weight:600;color:#1A1C1E }
    .ita-row-desc { font-size:12px;color:#6B7280;margin-top:1px }
    .ita-row-actions { display:flex;align-items:center;gap:4px;flex-shrink:0 }
    .ita-badge-inactive { font-size:11px;font-weight:600;color:#9CA3AF;background:#F3F4F6;padding:2px 8px;border-radius:20px }
    .ita-icon-btn { display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:none;border-radius:6px;background:none;color:#6B7280;cursor:pointer }
    .ita-icon-btn:hover { background:#F3F4F6;color:#1A1C1E }
    .ita-edit-row { padding:12px;background:#f8fafb;border:1px solid #E0E7E9;border-radius:8px }
    .ita-empty  { font-size:13px;color:#9CA3AF;text-align:center;padding:24px }
  `],
})
export class InterviewTypesAdminComponent implements OnInit {
  @Input() paysId!: number;

  private svc = inject(InterviewService);

  types      = signal<InterviewType[]>([]);
  loading    = signal(false);
  error      = signal<string | null>(null);

  showAdd    = signal(false);
  addLoading = signal(false);
  addError   = signal<string | null>(null);
  newName    = '';
  newDesc    = '';
  newOrder   = 1;

  editingId  = signal<number | null>(null);
  editLoading = signal(false);
  editError  = signal<string | null>(null);
  editName   = '';
  editDesc   = '';
  editOrder  = 1;

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading.set(true);
    this.svc.getTypes().subscribe({
      next:  t  => { this.types.set(t); this.loading.set(false); },
      error: () => { this.error.set('Erreur lors du chargement des types.'); this.loading.set(false); },
    });
  }

  startAdd(): void {
    const maxOrder = this.types().reduce((m, t) => Math.max(m, t.orderIndex), 0);
    this.newName = ''; this.newDesc = ''; this.newOrder = maxOrder + 1;
    this.addError.set(null); this.showAdd.set(true);
  }

  cancelAdd(): void { this.showAdd.set(false); }

  submitAdd(): void {
    if (!this.newName.trim()) { this.addError.set('Le nom est obligatoire.'); return; }
    this.addLoading.set(true); this.addError.set(null);
    this.svc.createType({
      paysId: this.paysId,
      name: this.newName.trim(),
      description: this.newDesc.trim() || undefined,
      orderIndex: this.newOrder,
    }).subscribe({
      next:  () => { this.addLoading.set(false); this.showAdd.set(false); this.load(); },
      error: err => { this.addLoading.set(false); this.addError.set(err?.error?.detail ?? 'Erreur lors de la création.'); },
    });
  }

  startEdit(t: InterviewType): void {
    this.editingId.set(t.id);
    this.editName = t.name; this.editDesc = t.description ?? ''; this.editOrder = t.orderIndex;
    this.editError.set(null);
  }

  cancelEdit(): void { this.editingId.set(null); }

  saveEdit(id: number): void {
    if (!this.editName.trim()) { this.editError.set('Le nom est obligatoire.'); return; }
    this.editLoading.set(true); this.editError.set(null);
    this.svc.updateType(id, {
      name: this.editName.trim(),
      description: this.editDesc.trim() || undefined,
      orderIndex: this.editOrder,
    }).subscribe({
      next:  () => { this.editLoading.set(false); this.editingId.set(null); this.load(); },
      error: err => { this.editLoading.set(false); this.editError.set(err?.error?.detail ?? 'Erreur lors de la mise à jour.'); },
    });
  }

  toggleActive(t: InterviewType): void {
    this.error.set(null);
    const obs = t.isActive ? this.svc.deactivateType(t.id) : this.svc.activateType(t.id);
    obs.subscribe({
      next:  updated => this.types.update(list => list.map(x => x.id === updated.id ? updated : x)),
      error: err     => this.error.set(err?.error?.detail ?? 'Erreur lors du changement de statut.'),
    });
  }
}
