import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { ButtonComponent, FormFieldComponent, ToggleComponent } from '@khalilrebhiitec/daf360';
import { ModalComponent } from '../../shared/modal.component';
import { InterviewService } from '../candidates/interview.service';
import { InterviewType } from '../candidates/interview.model';

@Component({
  selector: 'app-interview-types-admin',
  standalone: true,
  imports: [ButtonComponent, FormFieldComponent, ToggleComponent, ModalComponent],
  template: `
    <div class="ita-wrap">

      <!-- Header -->
      <div class="ita-header">
        <div>
          <h2 class="ita-title">Types d'entretiens</h2>
          <p class="ita-sub">{{ types().length }} type(s) configuré(s) pour cette entité</p>
        </div>
        <daf-button
          label="Nouveau type"
          variant="teal"
          [options]="{ iconStart: 'add' }"
          (onClick)="startAdd()" />
      </div>

      <!-- Global error -->
      @if (error()) {
        <div class="ita-error">{{ error() }}</div>
      }

      <!-- Add modal -->
      <app-modal
        title="Nouveau type d'entretien"
        [visible]="showAdd()"
        [hasFooter]="true"
        (closed)="cancelAdd()"
      >
        <div class="ita-form-grid">
          <daf-form-field
            [options]="{ label: 'Nom *', placeholder: 'Ex : Entretien Technique', maxLength: 150, fullWidth: true }"
            [value]="newName"
            (valueChange)="newName = $any($event) ?? ''" />
          <daf-form-field
            [options]="{ label: 'Ordre d\\'affichage', type: 'number', fullWidth: true }"
            [value]="newOrder"
            (valueChange)="newOrder = $event === null || $event === '' ? 0 : +$event" />
          <div style="grid-column:1/-1">
            <daf-form-field
              [options]="{ label: 'Description', placeholder: 'Description optionnelle', maxLength: 500, fullWidth: true }"
              [value]="newDesc"
              (valueChange)="newDesc = $any($event) ?? ''" />
          </div>
        </div>
        @if (addError()) {
          <p class="ita-field-error">{{ addError() }}</p>
        }
        <div slot="footer">
          <daf-button label="Annuler" variant="secondary" (onClick)="cancelAdd()" />
          <daf-button
            [label]="addLoading() ? 'Enregistrement...' : 'Ajouter'"
            variant="teal"
            [options]="{ disabled: addLoading(), loading: addLoading() }"
            (onClick)="submitAdd()" />
        </div>
      </app-modal>

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
                  <daf-form-field
                    [options]="{ label: 'Nom *', maxLength: 150, fullWidth: true }"
                    [value]="editName"
                    (valueChange)="editName = $any($event) ?? ''" />
                  <daf-form-field
                    [options]="{ label: 'Ordre', type: 'number', fullWidth: true }"
                    [value]="editOrder"
                    (valueChange)="editOrder = $event === null || $event === '' ? 0 : +$event" />
                  <div style="grid-column:1/-1">
                    <daf-form-field
                      [options]="{ label: 'Description', maxLength: 500, fullWidth: true }"
                      [value]="editDesc"
                      (valueChange)="editDesc = $any($event) ?? ''" />
                  </div>
                </div>
                @if (editError()) {
                  <p class="ita-field-error">{{ editError() }}</p>
                }
                <div class="ita-form-actions" style="margin-top:10px">
                  <daf-button label="Annuler" variant="secondary" (onClick)="cancelEdit()" />
                  <daf-button
                    [label]="editLoading() ? 'Enregistrement...' : 'Sauvegarder'"
                    variant="teal"
                    [options]="{ disabled: editLoading(), loading: editLoading() }"
                    (onClick)="saveEdit(t.id)" />
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
                  <daf-button
                    variant="ghost"
                    [options]="{ iconStart: 'edit', size: 'sm' }"
                    (onClick)="startEdit(t)" />
                  <daf-toggle
                    [options]="{ hint: t.isActive ? 'Désactiver' : 'Activer' }"
                    [checked]="t.isActive"
                    (checkedChange)="toggleActive(t)" />
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
    .ita-title  { font-size:var(--text-headline-md,15px);font-weight:600;color:var(--color-text,#1A1C1E);margin:0 }
    .ita-sub    { font-size:var(--text-body-sm,12px);color:var(--color-text-muted,#6B7280);margin:3px 0 0 }
    .ita-form-grid  { display:grid;grid-template-columns:1fr 120px;gap:10px }
    .ita-field-error { font-size:var(--text-body-sm,12px);color:var(--color-danger,#BA1A1A);margin:6px 0 0 }
    .ita-form-actions { display:flex;justify-content:flex-end;gap:8px;margin-top:12px }
    .ita-error  { background:var(--color-error-container,#FEF2F2);border:1px solid var(--color-error-container,#FECACA);border-radius:8px;padding:10px 14px;font-size:var(--text-body-sm,13px);color:var(--color-on-error-container,#BA1A1A);margin-bottom:14px }
    .ita-spinner-wrap { display:flex;justify-content:center;padding:32px }
    .ita-spin   { font-size:28px;color:var(--color-outline,#9CA3AF);animation:spin 1s linear infinite }
    @keyframes spin { to { transform:rotate(360deg) } }
    .ita-list   { display:flex;flex-direction:column;gap:6px }
    .ita-row    { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:var(--color-surface,#fff);border:1px solid var(--color-outline-variant,#E0E7E9);border-radius:8px }
    .ita-row--inactive { opacity:.55 }
    .ita-row-meta { display:flex;align-items:center;gap:12px;min-width:0 }
    .ita-order  { display:flex;align-items:center;justify-content:center;min-width:26px;height:26px;border-radius:6px;background:var(--color-surface-container,#f0f4f5);font-size:var(--text-label-sm,11px);font-weight:700;color:var(--color-teal,#50717b) }
    .ita-row-name { font-size:var(--text-body-sm,13px);font-weight:600;color:var(--color-on-surface,#1A1C1E) }
    .ita-row-desc { font-size:var(--text-body-sm,12px);color:var(--color-on-surface-variant,#6B7280);margin-top:1px }
    .ita-row-actions { display:flex;align-items:center;gap:4px;flex-shrink:0 }
    .ita-badge-inactive { font-size:var(--text-label-sm,11px);font-weight:600;color:var(--color-outline,#9CA3AF);background:var(--color-surface-container,#F3F4F6);padding:2px 8px;border-radius:20px }
    .ita-edit-row { padding:12px;background:var(--color-surface-container-low,#f8fafb);border:1px solid var(--color-outline-variant,#E0E7E9);border-radius:8px }
    .ita-empty  { font-size:var(--text-body-sm,13px);color:var(--color-outline,#9CA3AF);text-align:center;padding:24px }
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
