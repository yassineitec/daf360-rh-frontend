import {
  Component, OnChanges, SimpleChanges, inject, input, signal, computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';

import { RefDataService }      from '../../core/ref/ref-data.service';
import { RefDataItem, CreateRefDataRequest } from '../../core/ref/ref-data.model';
import { ContractHistoryService } from '../profiles/contract-history/contract-history.service';
import { TypeContratDto } from '../profiles/contract-history/contract-history.model';

type RefTab = 'grades' | 'disciplines' | 'nog-levels' | 'departments' | 'banks' | 'nationalities' | 'type-contrat' | 'it-asset-types';

interface TabConfig {
  key:      RefTab;
  label:    string;
  hasPays:  boolean;
  endpoint: string;
}

const TABS: TabConfig[] = [
  { key: 'grades',        label: 'Grades',             hasPays: true,  endpoint: 'grades'        },
  { key: 'disciplines',   label: 'Disciplines',         hasPays: true,  endpoint: 'disciplines'   },
  { key: 'nog-levels',    label: 'Niveaux NOG',         hasPays: true,  endpoint: 'nog-levels'    },
  { key: 'departments',   label: 'Départements',        hasPays: true,  endpoint: 'departments'   },
  { key: 'banks',         label: 'Banques',              hasPays: true,  endpoint: 'banks'         },
  { key: 'nationalities', label: 'Nationalités',         hasPays: false, endpoint: 'nationalities' },
  { key: 'type-contrat',    label: 'Types de contrat',     hasPays: false, endpoint: 'type-contrat'   },
  { key: 'it-asset-types',  label: 'Matériels informatiques', hasPays: false, endpoint: 'it-asset-types' },
];

@Component({
  selector: 'app-ref-data-admin',
  standalone: true,
  imports: [FormsModule, NgClass],
  template: `
<div>
  <!-- Sub-tab bar -->
  <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:24px;background:#eceef0;padding:4px;border-radius:12px;width:fit-content;">
    @for (tab of tabs; track tab.key) {
      <button type="button" (click)="selectTab(tab)"
        [ngClass]="activeTab().key === tab.key ? 'sub-active' : 'sub-inactive'"
        style="padding:8px 16px;border-radius:8px;border:none;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;">
        {{ tab.label }}
      </button>
    }
  </div>

  <!-- Flash messages -->
  @if (successMsg()) {
    <div style="background:#dcfce7;color:#166534;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:16px;">
      {{ successMsg() }}
    </div>
  }
  @if (error()) {
    <div style="background:#fee2e2;color:#991b1b;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:16px;">
      {{ error() }}
    </div>
  }

  <!-- Table — generic ref data -->
  @if (!isTypeContratTab()) {
    @if (loading()) {
      <p style="font-size:13px;color:#6B7280;">Chargement…</p>
    } @else {
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
        <thead>
          <tr style="border-bottom:2px solid #e5e7eb;">
            <th style="text-align:left;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">Libellé FR</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">Libellé EN</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">Code</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">Ordre</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">Actif</th>
            <th style="padding:8px 12px;"></th>
          </tr>
        </thead>
        <tbody>
          @for (item of items(); track item.id) {
            <tr style="border-bottom:1px solid #f3f4f6;" [style.opacity]="item.isActive ? '1' : '0.5'">
              <td style="padding:8px 12px;">{{ item.labelFr }}</td>
              <td style="padding:8px 12px;color:#6B7280;">{{ item.labelEn }}</td>
              <td style="padding:8px 12px;font-family:monospace;font-size:12px;">{{ item.code ?? '—' }}</td>
              <td style="padding:8px 12px;">{{ item.sortOrder ?? '—' }}</td>
              <td style="padding:8px 12px;">
                @if (item.isActive) {
                  <span style="background:#dcfce7;color:#166534;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;">Oui</span>
                } @else {
                  <span style="background:#f3f4f6;color:#6B7280;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;">Non</span>
                }
              </td>
              <td style="padding:8px 12px;text-align:right;">
                <button type="button"
                  (click)="deleteItem(item)"
                  style="font-size:12px;color:#ba1a1a;background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:6px;"
                  title="Supprimer">
                  Supprimer
                </button>
              </td>
            </tr>
          }
          @if (items().length === 0) {
            <tr>
              <td colspan="6" style="padding:24px;text-align:center;color:#9CA3AF;font-size:13px;">
                Aucune entrée. Utilisez le formulaire ci-dessous pour en ajouter.
              </td>
            </tr>
          }
        </tbody>
      </table>
    }

    <!-- Inline create form — generic -->
    <div style="background:#f8f9fa;border:1px solid #eceef0;border-radius:12px;padding:16px 20px;">
      <button type="button"
        (click)="showForm.set(!showForm())"
        style="font-size:13px;font-weight:600;color:#1C4E5C;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;margin-bottom:0;">
        @if (showForm()) { ▲ Masquer le formulaire } @else { ▼ Ajouter une entrée }
      </button>

      @if (showForm()) {
        <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;align-items:end;">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">
              Libellé FR <span style="color:#ba1a1a;">*</span>
            </label>
            <input type="text" [(ngModel)]="createForm.labelFr" placeholder="Ex: Ingénieur Senior"
              style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;" />
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">Libellé EN</label>
            <input type="text" [(ngModel)]="createForm.labelEn" placeholder="Ex: Senior Engineer"
              style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;" />
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">Code</label>
            <input type="text" [(ngModel)]="createForm.code" placeholder="Ex: SENIOR_ENG"
              style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;font-family:monospace;" />
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">Ordre</label>
            <input type="number" [(ngModel)]="createForm.sortOrder" placeholder="0"
              style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;" />
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button type="button" (click)="onCreate()"
            [disabled]="saving() || !createForm.labelFr.trim()"
            style="padding:9px 20px;background:#1C4E5C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;"
            [style.opacity]="saving() || !createForm.labelFr.trim() ? '0.5' : '1'">
            @if (saving()) { Enregistrement… } @else { Ajouter }
          </button>
          <button type="button" (click)="resetForm()"
            style="padding:9px 20px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;">
            Réinitialiser
          </button>
        </div>
      }
    </div>
  }

  <!-- Table — Types de contrat -->
  @if (isTypeContratTab()) {
    @if (loading()) {
      <p style="font-size:13px;color:#6B7280;">Chargement…</p>
    } @else {
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
        <thead>
          <tr style="border-bottom:2px solid #e5e7eb;">
            <th style="text-align:left;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">Code</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">Libellé FR</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">Libellé EN</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">Actif</th>
            <th style="padding:8px 12px;"></th>
          </tr>
        </thead>
        <tbody>
          @for (tc of typeContrats(); track tc.id) {
            <tr style="border-bottom:1px solid #f3f4f6;" [style.opacity]="tc.isActive ? '1' : '0.5'">
              <td style="padding:8px 12px;font-family:monospace;font-size:12px;">{{ tc.code }}</td>
              <td style="padding:8px 12px;font-weight:500;">{{ tc.labelFr }}</td>
              <td style="padding:8px 12px;color:#6B7280;">{{ tc.labelEn }}</td>
              <td style="padding:8px 12px;">
                @if (tc.isActive) {
                  <span style="background:#dcfce7;color:#166534;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;">Oui</span>
                } @else {
                  <span style="background:#f3f4f6;color:#6B7280;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;">Non</span>
                }
              </td>
              <td style="padding:8px 12px;text-align:right;">
                <button type="button" (click)="deleteTypeContrat(tc)"
                  style="font-size:12px;color:#ba1a1a;background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:6px;">
                  Supprimer
                </button>
              </td>
            </tr>
          }
          @if (typeContrats().length === 0) {
            <tr>
              <td colspan="5" style="padding:24px;text-align:center;color:#9CA3AF;font-size:13px;">
                Aucun type de contrat. Utilisez le formulaire ci-dessous pour en ajouter.
              </td>
            </tr>
          }
        </tbody>
      </table>
    }

    <!-- Inline create form — type contrat -->
    <div style="background:#f8f9fa;border:1px solid #eceef0;border-radius:12px;padding:16px 20px;">
      <button type="button"
        (click)="showForm.set(!showForm())"
        style="font-size:13px;font-weight:600;color:#1C4E5C;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;margin-bottom:0;">
        @if (showForm()) { ▲ Masquer le formulaire } @else { ▼ Ajouter un type de contrat }
      </button>

      @if (showForm()) {
        <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;align-items:end;">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">
              Code <span style="color:#ba1a1a;">*</span>
            </label>
            <input type="text" [(ngModel)]="tcCreateCode" placeholder="Ex: CDI"
              style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;font-family:monospace;" />
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">
              Libellé FR <span style="color:#ba1a1a;">*</span>
            </label>
            <input type="text" [(ngModel)]="tcCreateLabelFr" placeholder="Ex: Contrat à durée indéterminée"
              style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;" />
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;">Libellé EN</label>
            <input type="text" [(ngModel)]="tcCreateLabelEn" placeholder="Ex: Permanent contract"
              style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;" />
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button type="button" (click)="onCreateTypeContrat()"
            [disabled]="saving() || !tcCreateLabelFr.trim() || !tcCreateCode.trim()"
            style="padding:9px 20px;background:#1C4E5C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;"
            [style.opacity]="saving() || !tcCreateLabelFr.trim() || !tcCreateCode.trim() ? '0.5' : '1'">
            @if (saving()) { Enregistrement… } @else { Ajouter }
          </button>
          <button type="button" (click)="tcCreateCode = ''; tcCreateLabelFr = ''; tcCreateLabelEn = ''"
            style="padding:9px 20px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;">
            Réinitialiser
          </button>
        </div>
      }
    </div>
  }
</div>
  `,
  styles: [`
    .sub-active   { background:#fff; color:#1C4E5C; box-shadow:0 1px 3px rgba(0,0,0,.1); }
    .sub-inactive { background:transparent; color:#6B7280; }
    .sub-inactive:hover { background:#fff8; color:#1A1C1E; }
  `],
})
export class RefDataAdminComponent implements OnChanges {
  private refSvc      = inject(RefDataService);
  private contractSvc = inject(ContractHistoryService);

  paysId = input<number>(179);

  // TypeContrat-specific state (loaded when tab = 'type-contrat')
  typeContrats     = signal<TypeContratDto[]>([]);
  tcCreateCode     = '';
  tcCreateLabelFr  = '';
  tcCreateLabelEn  = '';
  isTypeContratTab = computed(() => this.activeTab().key === 'type-contrat');

  readonly tabs = TABS;

  activeTab = signal<TabConfig>(TABS[0]);
  items     = signal<RefDataItem[]>([]);
  loading   = signal(false);
  saving    = signal(false);
  showForm  = signal(false);
  error     = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  createForm: { labelFr: string; labelEn: string; code: string; sortOrder: number | null } = {
    labelFr: '', labelEn: '', code: '', sortOrder: null,
  };

  ngOnChanges(changes: SimpleChanges): void {
    this.loadItems();
  }

  selectTab(tab: TabConfig): void {
    this.activeTab.set(tab);
    this.showForm.set(false);
    this.resetForm();
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.error.set(null);
    const tab = this.activeTab();

    if (tab.key === 'type-contrat') {
      this.contractSvc.getTypeContrats().subscribe({
        next: tc => { this.typeContrats.set(tc); this.loading.set(false); },
        error: () => { this.error.set('Impossible de charger les types de contrat.'); this.loading.set(false); },
      });
      return;
    }

    if (tab.key === 'it-asset-types') {
      this.refSvc.getItAssetTypes().subscribe({
        next: r  => { this.items.set(r); this.loading.set(false); },
        error: () => { this.error.set('Impossible de charger les matériels.'); this.loading.set(false); },
      });
      return;
    }

    const obs = tab.hasPays
      ? this.getForType(tab.key, this.paysId())
      : this.refSvc.getNationalities();

    obs.subscribe({
      next: r  => { this.items.set(r); this.loading.set(false); },
      error: () => { this.error.set('Impossible de charger les données.'); this.loading.set(false); },
    });
  }

  private getForType(key: RefTab, paysId: number) {
    switch (key) {
      case 'grades':       return this.refSvc.getGrades(paysId);
      case 'disciplines':  return this.refSvc.getDisciplines(paysId);
      case 'nog-levels':   return this.refSvc.getNogLevels(paysId);
      case 'departments':  return this.refSvc.getDepartments(paysId);
      case 'banks':        return this.refSvc.getBanks(paysId);
      default:             return this.refSvc.getNationalities();
    }
  }

  onCreate(): void {
    if (!this.createForm.labelFr.trim()) return;
    this.saving.set(true);
    this.error.set(null);
    const tab = this.activeTab();
    const req: CreateRefDataRequest = {
      labelFr:   this.createForm.labelFr.trim(),
      labelEn:   this.createForm.labelEn.trim() || undefined,
      code:      this.createForm.code.trim()    || undefined,
      sortOrder: this.createForm.sortOrder      ?? undefined,
      paysId:    tab.hasPays ? this.paysId()    : undefined,
    };
    this.refSvc.invalidateAll();
    this.refSvc.create(tab.endpoint, req).subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForm();
        this.showForm.set(false);
        this.flash('Entrée créée avec succès.');
        this.loadItems();
      },
      error: err => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Erreur lors de la création.');
      },
    });
  }

  deleteItem(item: RefDataItem): void {
    if (!confirm(`Supprimer « ${item.labelFr} » ?`)) return;
    const tab = this.activeTab();
    this.refSvc.invalidateAll();
    this.refSvc.delete(tab.endpoint, item.id, tab.hasPays ? this.paysId() : undefined).subscribe({
      next: () => { this.flash('Entrée supprimée.'); this.loadItems(); },
      error: err => this.error.set(err?.error?.message ?? 'Erreur lors de la suppression.'),
    });
  }

  onCreateTypeContrat(): void {
    if (!this.tcCreateLabelFr.trim() || !this.tcCreateCode.trim()) return;
    this.saving.set(true);
    this.error.set(null);
    this.contractSvc.createTypeContrat({
      code:    this.tcCreateCode.trim(),
      labelFr: this.tcCreateLabelFr.trim(),
      labelEn: this.tcCreateLabelEn.trim() || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.tcCreateCode = ''; this.tcCreateLabelFr = ''; this.tcCreateLabelEn = '';
        this.showForm.set(false);
        this.flash('Type de contrat créé.');
        this.loadItems();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Erreur lors de la création.');
      },
    });
  }

  deleteTypeContrat(tc: TypeContratDto): void {
    if (!confirm(`Supprimer « ${tc.labelFr} » ?`)) return;
    this.contractSvc.deleteTypeContrat(tc.id).subscribe({
      next: () => { this.flash('Type de contrat supprimé.'); this.loadItems(); },
      error: (err: any) => this.error.set(err?.error?.message ?? 'Erreur lors de la suppression.'),
    });
  }

  resetForm(): void {
    this.createForm = { labelFr: '', labelEn: '', code: '', sortOrder: null };
  }

  private flash(msg: string): void {
    this.successMsg.set(msg);
    this.error.set(null);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
