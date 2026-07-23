import {
  Component, computed, inject, input, OnInit, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { catchError, of } from 'rxjs';

import { AdminService } from './admin.service';
import {
  CONTRACT_TYPES, OffboardingCatalogTask, SaveCatalogTaskRequest,
} from './models/admin.model';
import { ButtonComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  CDI:      'CDI',
  CDD:      'CDD',
  STAGE:    'Stage',
  FREELANCE:'Freelance',
  CIVP:     'CIVP',
};

@Component({
  selector: 'app-offboarding-catalog-admin',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, ButtonComponent, StatusBadgeComponent],
  template: `
    <div class="cat-header">
      <div>
        <h3 class="section-title">Catalogue des tâches d'offboarding</h3>
        <p class="section-sub">Définissez les tâches par type de contrat pour les dossiers d'offboarding.</p>
      </div>
      <daf-button class="desktop-only" label="Ajouter une tâche" variant="teal" [options]="{ iconStart: 'add' }" (onClick)="openAdd()" />
      <daf-button class="icon-btn-toggle mobile-only" title="Ajouter une tâche" variant="teal" [options]="{ iconStart: 'add', size: 'sm' }" (onClick)="openAdd()" />
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <select class="filter-select" [(ngModel)]="filterContractType" (ngModelChange)="load()">
        <option value="">Tous les types de contrat</option>
        @for (ct of CONTRACT_TYPES; track ct) {
          <option [value]="ct">{{ contractTypeLabel(ct) }}</option>
        }
      </select>
      @if (filterContractType) {
        <daf-button label="Réinitialiser" variant="ghost"
          [options]="{ size: 'sm', iconStart: 'close' }"
          (onClick)="filterContractType = ''; load()" />
      }
    </div>

    <!-- Loading / empty state -->
    @if (loading()) {
      <div class="skeleton-wrap">
        @for (_ of [1,2,3,4,5]; track $index) { <div class="skeleton-row"></div> }
      </div>
    } @else if (rows().length === 0) {
      <div class="empty-state">
        <span class="material-symbols-outlined">list_alt</span>
        <p>Aucune tâche configurée{{ filterContractType ? ' pour ce type de contrat' : '' }}.</p>
      </div>
    } @else {

      <!-- Group by contract type when showing all -->
      @if (!filterContractType) {
        @for (group of groupedRows(); track group.contractType) {
          <div class="group-header">
            <span class="group-label">{{ contractTypeLabel(group.contractType) }}</span>
            <span class="group-count">{{ group.tasks.length }} tâche{{ group.tasks.length !== 1 ? 's' : '' }}</span>
          </div>
          <ng-container *ngTemplateOutlet="taskTable; context: { $implicit: group.tasks }" />
        }
      } @else {
        <ng-container *ngTemplateOutlet="taskTable; context: { $implicit: rows() }" />
      }
    }

    <!-- Task table template -->
    <ng-template #taskTable let-tasks>
      <div class="cat-table">
        <div class="cat-table-head">
          <span class="col-order">#</span>
          <span class="col-label">Tâche</span>
          <span class="col-code">Code</span>
          <span class="col-role">Responsable</span>
          <span class="col-sla">SLA (jours)</span>
          <span class="col-flags">Options</span>
          <span class="col-status">Statut</span>
          <span class="col-actions"></span>
        </div>
        @for (task of tasks; track task.id) {
          <div class="cat-row" [class.inactive]="!task.isActive">
            <span class="col-order">{{ task.orderIndex }}</span>
            <span class="col-label">{{ task.taskLabel }}</span>
            <span class="col-code">
              <code class="code-chip">{{ task.taskCode }}</code>
            </span>
            <span class="col-role">{{ task.ownerRole }}</span>
            <span class="col-sla">{{ task.slaWorkingDays }}</span>
            <span class="col-flags">
              @if (task.isMandatory) {
                <span class="flag-chip mandatory">Obligatoire</span>
              }
              @if (task.isBlocking) {
                <span class="flag-chip blocking">Bloquant</span>
              }
            </span>
            <span class="col-status">
              <daf-badge
                [label]="task.isActive ? 'Actif' : 'Inactif'"
                [options]="{ variant: task.isActive ? 'success' : 'neutral', size: 'sm' }"
              />
            </span>
            <span class="col-actions">
              <button class="icon-btn" title="Modifier" (click)="openEdit(task)">
                <span class="material-symbols-outlined">edit</span>
              </button>
              <button class="icon-btn" [title]="task.isActive ? 'Désactiver' : 'Activer'"
                (click)="toggleActive(task)">
                <span class="material-symbols-outlined">{{ task.isActive ? 'toggle_on' : 'toggle_off' }}</span>
              </button>
            </span>
          </div>
        }
      </div>
    </ng-template>

    <!-- Add / Edit modal (inline) -->
    @if (showForm()) {
      <div class="modal-backdrop" (click)="closeForm()">
        <div class="modal-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h4>{{ editingId() ? 'Modifier la tâche' : 'Ajouter une tâche' }}</h4>
            <button class="icon-btn" (click)="closeForm()">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="modal-body">
            <div class="form-grid">
              <div>
                <label class="form-label">Type de contrat *</label>
                <select class="form-input" [(ngModel)]="form.contractType" [disabled]="!!editingId()">
                  <option value="">Sélectionner…</option>
                  @for (ct of CONTRACT_TYPES; track ct) {
                    <option [value]="ct">{{ contractTypeLabel(ct) }}</option>
                  }
                </select>
              </div>

              <div>
                <label class="form-label">Code tâche *</label>
                <input class="form-input" type="text" [(ngModel)]="form.taskCode"
                  placeholder="ex: IT_ACCESS_REVOKE" [disabled]="!!editingId()"
                  style="text-transform:uppercase" />
              </div>

              <div class="field-full">
                <label class="form-label">Libellé *</label>
                <input class="form-input" type="text" [(ngModel)]="form.taskLabel"
                  placeholder="ex: Désactivation des accès informatiques" />
              </div>

              <div>
                <label class="form-label">Rôle responsable *</label>
                <input class="form-input" type="text" [(ngModel)]="form.ownerRole"
                  placeholder="ex: IT_OFFICER" />
              </div>

              <div>
                <label class="form-label">SLA (jours ouvrés) *</label>
                <input class="form-input" type="number" [(ngModel)]="form.slaWorkingDays" min="1" max="60" />
              </div>

              <div>
                <label class="form-label">Ordre d'affichage</label>
                <input class="form-input" type="number" [(ngModel)]="form.orderIndex" min="0" />
              </div>

              <div class="field-full toggles-row">
                <label class="toggle-label">
                  <input type="checkbox" [(ngModel)]="form.isMandatory" />
                  <span>Obligatoire</span>
                </label>
                <label class="toggle-label">
                  <input type="checkbox" [(ngModel)]="form.isBlocking" />
                  <span>Bloquant (empêche la validation si non complété)</span>
                </label>
              </div>
            </div>

            @if (formError()) {
              <div class="error-banner">{{ formError() }}</div>
            }
          </div>

          <div class="modal-footer">
            <daf-button label="Annuler" variant="secondary" (onClick)="closeForm()" />
            <daf-button
              [label]="editingId() ? 'Enregistrer' : 'Ajouter'"
              variant="teal"
              [options]="{ loading: saving(), disabled: !isFormValid() }"
              (onClick)="save()"
            />
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .cat-header    { display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;flex-wrap:wrap }
    .section-title { font-size:15px;font-weight:700;color:var(--color-text);margin:0 0 4px }
    .section-sub   { font-size:13px;color:var(--color-text-muted);margin:0 }
    .filter-bar    { display:flex;align-items:center;gap:10px;margin-bottom:16px }
    .filter-select { padding:7px 12px;border:1px solid var(--color-border);border-radius:8px;font-size:13px;background:var(--color-surface);color:var(--color-text);min-width:200px }
    .skeleton-wrap { display:flex;flex-direction:column;gap:8px }
    .skeleton-row  { height:44px;background:var(--color-bg-secondary,#F5F7F9);border-radius:6px;animation:pulse 1.4s ease-in-out infinite }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }
    .empty-state   { display:flex;flex-direction:column;align-items:center;gap:8px;padding:48px;color:var(--color-text-muted);text-align:center }
    .empty-state .material-symbols-outlined { font-size:40px;opacity:.4 }
    .empty-state p { font-size:13px;margin:0 }
    .group-header  { display:flex;align-items:center;gap:10px;padding:10px 0 6px;border-bottom:2px solid var(--color-primary,#1C4E5C);margin-top:20px }
    .group-label   { font-size:13px;font-weight:700;color:var(--color-primary);text-transform:uppercase;letter-spacing:.5px }
    .group-count   { font-size:11px;color:var(--color-text-muted);background:var(--color-bg-secondary);padding:2px 8px;border-radius:999px }
    .cat-table     { border:1px solid var(--color-border);border-radius:10px;overflow:hidden;margin-bottom:4px }
    .cat-table-head{ display:grid;grid-template-columns:40px 1fr 150px 130px 90px 140px 80px 70px;gap:12px;padding:10px 14px;background:var(--color-bg-secondary);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--color-text-muted) }
    .cat-row       { display:grid;grid-template-columns:40px 1fr 150px 130px 90px 140px 80px 70px;gap:12px;padding:10px 14px;align-items:center;border-top:1px solid var(--color-border);font-size:13px;transition:background .12s }
    .cat-row:hover { background:var(--color-bg-secondary) }
    .cat-row.inactive { opacity:.5 }
    .col-order     { font-size:12px;color:var(--color-text-muted);font-variant-numeric:tabular-nums }
    .col-label     { font-weight:500 }
    .col-code, .col-role, .col-sla { color:var(--color-text-muted) }
    .code-chip     { font-family:monospace;font-size:11px;background:var(--color-bg-secondary);padding:2px 6px;border-radius:4px;color:var(--color-primary) }
    .flag-chip     { font-size:10px;font-weight:600;padding:2px 7px;border-radius:999px }
    .flag-chip.mandatory { background:#fef3c7;color:#92400e }
    .flag-chip.blocking  { background:#fee2e2;color:#991b1b }
    .col-flags     { display:flex;flex-direction:column;gap:3px }
    .col-actions   { display:flex;gap:2px }
    .icon-btn      { background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;color:var(--color-text-muted);display:flex;align-items:center;transition:background .12s }
    .icon-btn:hover { background:var(--color-bg-secondary);color:var(--color-text) }
    .icon-btn .material-symbols-outlined { font-size:18px }

    /* Modal */
    .modal-backdrop  { position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px }
    .modal-panel     { background:var(--color-surface);border-radius:14px;width:100%;max-width:600px;box-shadow:0 20px 60px rgba(0,0,0,.2);display:flex;flex-direction:column;max-height:90vh;overflow:hidden }
    .modal-header    { display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid var(--color-border) }
    .modal-header h4 { margin:0;font-size:15px;font-weight:700 }
    .modal-body      { padding:20px;overflow-y:auto }
    .modal-footer    { display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--color-border) }
    .form-grid       { display:grid;grid-template-columns:1fr 1fr;gap:14px }
    .field-full      { grid-column:1/-1 }
    .form-label      { display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--color-text-muted);margin-bottom:4px }
    .form-input      { width:100%;padding:8px 12px;border:1px solid var(--color-border);border-radius:8px;font-size:13px;font-family:inherit;background:var(--color-surface);color:var(--color-text);outline:none;box-sizing:border-box }
    .form-input:focus { border-color:var(--color-primary) }
    .form-input:disabled { opacity:.6;cursor:not-allowed }
    .toggles-row     { display:flex;gap:20px;align-items:center }
    .toggle-label    { display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer }
    .error-banner    { margin-top:12px;padding:10px 14px;border-radius:8px;background:#fee2e2;color:#991b1b;font-size:13px }
    @media(max-width:700px) {
      .cat-table-head, .cat-row { grid-template-columns:40px 1fr 80px 70px }
      .col-code, .col-role, .col-flags { display:none }
    }
    @media(max-width:500px) { .form-grid { grid-template-columns:1fr } }

    .mobile-only { display:none }
    @media (max-width: 640px) {
      .desktop-only { display:none }
      .mobile-only  { display:inline-flex }
    }
  `],
})
export class OffboardingCatalogAdminComponent implements OnInit {
  private svc = inject(AdminService);

  paysId = input.required<number>();

  protected readonly CONTRACT_TYPES = CONTRACT_TYPES;

  filterContractType = '';
  loading  = signal(false);
  rows     = signal<OffboardingCatalogTask[]>([]);

  showForm  = signal(false);
  editingId = signal<number | null>(null);
  saving    = signal(false);
  formError = signal<string | null>(null);

  form: SaveCatalogTaskRequest & { contractType: string; taskCode: string } = {
    paysId:         0,
    contractType:   '',
    taskCode:       '',
    taskLabel:      '',
    ownerRole:      '',
    isMandatory:    true,
    isBlocking:     false,
    slaWorkingDays: 5,
    orderIndex:     0,
  };

  readonly groupedRows = computed(() => {
    const map = new Map<string, OffboardingCatalogTask[]>();
    for (const t of this.rows()) {
      const list = map.get(t.contractType) ?? [];
      list.push(t);
      map.set(t.contractType, list);
    }
    return Array.from(map.entries())
      .map(([contractType, tasks]) => ({ contractType, tasks }))
      .sort((a, b) => a.contractType.localeCompare(b.contractType));
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.listCatalogTasks(this.paysId(), this.filterContractType || undefined)
      .pipe(catchError(() => of([])))
      .subscribe(list => { this.rows.set(list); this.loading.set(false); });
  }

  openAdd() {
    this.editingId.set(null);
    this.form = {
      paysId:         this.paysId(),
      contractType:   this.filterContractType,
      taskCode:       '',
      taskLabel:      '',
      ownerRole:      '',
      isMandatory:    true,
      isBlocking:     false,
      slaWorkingDays: 5,
      orderIndex:     this.rows().length,
    };
    this.formError.set(null);
    this.showForm.set(true);
  }

  openEdit(task: OffboardingCatalogTask) {
    this.editingId.set(task.id);
    this.form = {
      paysId:         task.paysId,
      contractType:   task.contractType,
      taskCode:       task.taskCode,
      taskLabel:      task.taskLabel,
      ownerRole:      task.ownerRole,
      isMandatory:    task.isMandatory,
      isBlocking:     task.isBlocking,
      slaWorkingDays: task.slaWorkingDays,
      orderIndex:     task.orderIndex,
    };
    this.formError.set(null);
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); }

  isFormValid(): boolean {
    return !!(this.form.contractType && this.form.taskCode.trim() &&
              this.form.taskLabel.trim() && this.form.ownerRole.trim() &&
              this.form.slaWorkingDays >= 1);
  }

  save() {
    if (!this.isFormValid()) return;
    const id = this.editingId();
    const payload: SaveCatalogTaskRequest = {
      ...this.form,
      taskCode: this.form.taskCode.toUpperCase().replace(/\s+/g, '_'),
    };
    this.saving.set(true);
    this.formError.set(null);

    const req$ = id
      ? this.svc.updateCatalogTask(id, payload)
      : this.svc.createCatalogTask(payload);

    req$.pipe(
      catchError(err => {
        this.formError.set(err?.error?.message ?? err?.error?.detail ?? 'Erreur lors de l\'enregistrement');
        this.saving.set(false);
        return of(null);
      }),
    ).subscribe(result => {
      this.saving.set(false);
      if (result) {
        this.showForm.set(false);
        this.load();
      }
    });
  }

  toggleActive(task: OffboardingCatalogTask) {
    this.svc.toggleCatalogTaskActive(task.id)
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        if (updated) {
          this.rows.update(list => list.map(t => t.id === updated.id ? updated : t));
        }
      });
  }

  contractTypeLabel(ct: string): string {
    return CONTRACT_TYPE_LABELS[ct] ?? ct;
  }
}
