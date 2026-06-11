import {
  Component, OnChanges, SimpleChanges, inject, input, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { OvertimeService } from './overtime.service';
import {
  ParametrageHSDto, CreateParametrageHSRequest,
  TYPE_CALCUL_OPTIONS, DAYS_OPTIONS, OvertimeCalculationRequest, OvertimeCalculationResult,
} from './overtime.model';
import { UserStore } from '../../../core/user.store';

@Component({
  selector: 'app-overtime-admin',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
<div>

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
    <div>
      <h2 style="font-size:16px;font-weight:700;color:#1d2b3e;margin:0;">Heures supplémentaires par pays</h2>
      <p style="font-size:12px;color:#44474c;margin:3px 0 0;">Configuration des règles de calcul selon le type de pays</p>
    </div>
    <button type="button" (click)="openNewForm()"
      style="padding:8px 18px;border-radius:10px;border:none;background:#1a6b7c;color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
      <span class="material-symbols-outlined" style="font-size:16px;">{{ showForm() ? 'close' : 'add' }}</span>
      {{ showForm() ? 'Annuler' : 'Nouvelle règle' }}
    </button>
  </div>

  <!-- Create / Edit form -->
  @if (showForm()) {
    <div style="background:#f7f9fb;border:1px solid #eceef0;border-radius:14px;padding:20px;margin-bottom:20px;">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#44474c;margin:0 0 14px;">
        {{ editingId() ? 'Modifier la règle HS' : 'Nouvelle règle HS' }}
      </p>
      @if (formError()) {
        <div style="background:#fee2e2;border-radius:8px;padding:10px;font-size:12px;color:#991b1b;margin-bottom:12px;">{{ formError() }}</div>
      }
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Pays *</label>
          <select [(ngModel)]="formPaysId" [disabled]="!!editingId()"
            style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;"
            [style.opacity]="editingId() ? '0.6' : '1'">
            <option [ngValue]="0" disabled>Sélectionner un pays…</option>
            @for (p of availablePays(); track p.id) {
              <option [ngValue]="p.id">{{ p.frenchLabel }}</option>
            }
          </select>
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Type de calcul *</label>
          <select [(ngModel)]="formType" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;">
            @for (opt of typeOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
          @if (formType) {
            <small style="font-size:10px;color:#75777d;">{{ getTypeDesc(formType) }}</small>
          }
        </div>

        @if (formType === 'AFTER_WORK_HOURS' || formType === 'MIXTE') {
          <div>
            <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Heure début travail</label>
            <input type="time" [(ngModel)]="formHeureDebut" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
          </div>
          <div>
            <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Heure fin travail</label>
            <input type="time" [(ngModel)]="formHeureFin" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
          </div>
        }

        <div>
          <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">1er jour ouvré</label>
          <select [(ngModel)]="formJourDebut" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;">
            <option value="">— Optionnel —</option>
            @for (d of daysOptions; track d.value) { <option [value]="d.value">{{ d.label }}</option> }
          </select>
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Dernier jour ouvré</label>
          <select [(ngModel)]="formJourFin" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;">
            <option value="">— Optionnel —</option>
            @for (d of daysOptions; track d.value) { <option [value]="d.value">{{ d.label }}</option> }
          </select>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:14px;">
        <button type="button" (click)="saveRule()" [disabled]="isSaving()"
          style="padding:9px 22px;border-radius:10px;border:none;background:#4648d4;color:#fff;font-size:13px;font-weight:700;cursor:pointer;"
          [style.opacity]="isSaving() ? '0.6' : '1'">
          {{ isSaving() ? 'Enregistrement…' : (editingId() ? 'Mettre à jour' : 'Enregistrer') }}
        </button>
      </div>
    </div>
  }

  <!-- Rules table -->
  @if (isLoading()) {
    <div style="height:120px;border-radius:12px;background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;"></div>
  }

  @if (!isLoading() && rules().length === 0) {
    <div style="text-align:center;padding:56px;color:#75777d;">
      <span class="material-symbols-outlined" style="font-size:40px;display:block;margin-bottom:12px;opacity:.4;">timer</span>
      <p style="font-size:13px;margin:0;">Aucune règle HS configurée.</p>
    </div>
  }

  @if (!isLoading() && rules().length > 0) {
    <div style="background:#fff;border-radius:14px;border:1px solid #eceef0;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f2f4f6;">
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Pays</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Type de calcul</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Horaires normaux</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Semaine de travail</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Statut</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Action</th>
          </tr>
        </thead>
        <tbody>
          @for (rule of rules(); track rule.idParametrage) {
            <tr style="border-top:1px solid #f0f2f4;">
              <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#1d2b3e;">
                <span style="background:#e6f4f6;color:#0f4a57;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;font-family:monospace;">{{ rule.paysIsoCode }}</span>
              </td>
              <td style="padding:12px 16px;">
                <span style="font-size:12px;padding:3px 10px;border-radius:999px;font-weight:700;"
                  [style.background]="rule.typeCalculHs === 'WEEKEND_ONLY' ? '#dbeafe' : rule.typeCalculHs === 'AFTER_WORK_HOURS' ? '#fef3c7' : '#ede9fe'"
                  [style.color]="rule.typeCalculHs === 'WEEKEND_ONLY' ? '#1e40af' : rule.typeCalculHs === 'AFTER_WORK_HOURS' ? '#92400e' : '#5b21b6'">
                  {{ getTypeLabel(rule.typeCalculHs) }}
                </span>
              </td>
              <td style="padding:12px 16px;font-size:12px;color:#44474c;">
                @if (rule.heureDebutTravail && rule.heureFinTravail) {
                  {{ rule.heureDebutTravail.slice(0,5) }} → {{ rule.heureFinTravail.slice(0,5) }}
                } @else { — }
              </td>
              <td style="padding:12px 16px;font-size:12px;color:#44474c;">
                @if (rule.jourDebutSemaine && rule.jourFinSemaine) {
                  {{ getDayLabel(rule.jourDebutSemaine) }} → {{ getDayLabel(rule.jourFinSemaine) }}
                } @else { — }
              </td>
              <td style="padding:12px 16px;">
                <span style="font-size:11px;padding:2px 10px;border-radius:999px;font-weight:700;"
                  [style.background]="rule.actif ? '#dcfce7' : '#f1f5f9'"
                  [style.color]="rule.actif ? '#15803d' : '#475569'">
                  {{ rule.actif ? 'Actif' : 'Inactif' }}
                </span>
              </td>
              <td style="padding:12px 16px;text-align:right;display:flex;gap:6px;justify-content:flex-end;align-items:center;">
                @if (rule.actif) {
                  <button type="button" (click)="openEditForm(rule)"
                    style="padding:5px 12px;border-radius:8px;border:none;background:#e0e7ff;color:#3730a3;font-size:12px;font-weight:700;cursor:pointer;">
                    Modifier
                  </button>
                  <button type="button" (click)="deactivate(rule.idParametrage)"
                    style="padding:5px 12px;border-radius:8px;border:none;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:700;cursor:pointer;">
                    Désactiver
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- Simulator -->
  <div style="margin-top:28px;background:#fff;border:1px solid #eceef0;border-radius:14px;padding:20px;">
    <h3 style="font-size:14px;font-weight:700;color:#1d2b3e;margin:0 0 16px;display:flex;align-items:center;gap:8px;">
      <span class="material-symbols-outlined" style="font-size:18px;color:#4648d4;">calculate</span>
      Simulateur de calcul HS
    </h3>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;">
      <div>
        <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Pays</label>
        <select [(ngModel)]="simPaysId" style="width:100%;background:#f2f4f6;border:none;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;">
          <option [ngValue]="0">Sélectionner…</option>
          @for (p of availablePays(); track p.id) { <option [ngValue]="p.id">{{ p.frenchLabel }}</option> }
        </select>
      </div>
      <div>
        <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Date</label>
        <input type="date" [(ngModel)]="simDate" style="width:100%;background:#f2f4f6;border:none;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
      </div>
      <div>
        <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Heures brutes</label>
        <input type="number" step="0.25" [(ngModel)]="simGrossHours" style="width:100%;background:#f2f4f6;border:none;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
      </div>
      <div>
        <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Heure début</label>
        <input type="time" [(ngModel)]="simStart" style="width:100%;background:#f2f4f6;border:none;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
      </div>
      <div>
        <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Heure fin</label>
        <input type="time" [(ngModel)]="simEnd" style="width:100%;background:#f2f4f6;border:none;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
      </div>
      <div style="display:flex;align-items:flex-end;">
        <button type="button" (click)="simulate()" [disabled]="isSimulating()"
          style="width:100%;padding:9px 16px;border-radius:8px;border:none;background:#4648d4;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">
          {{ isSimulating() ? 'Calcul…' : 'Simuler' }}
        </button>
      </div>
    </div>
    @if (simResult()) {
      <div style="background:#f7f9fb;border-radius:10px;padding:14px 16px;border:1px solid #eceef0;">
        <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:8px;">
          <div><span style="font-size:11px;color:#44474c;text-transform:uppercase;letter-spacing:.4px;">Heures normales</span><br/>
            <span style="font-size:20px;font-weight:800;color:#1d2b3e;">{{ simResult()!.normalHours | number:'1.2-2' }}h</span></div>
          <div><span style="font-size:11px;color:#b91c1c;text-transform:uppercase;letter-spacing:.4px;">Heures supp.</span><br/>
            <span style="font-size:20px;font-weight:800;color:#b91c1c;">{{ simResult()!.overtimeHours | number:'1.2-2' }}h</span></div>
          <div><span style="font-size:11px;color:#44474c;text-transform:uppercase;letter-spacing:.4px;">Règle appliquée</span><br/>
            <span style="font-size:13px;font-weight:700;color:#4648d4;">{{ simResult()!.ruleApplied }}</span></div>
          <div><span style="font-size:11px;color:#44474c;text-transform:uppercase;letter-spacing:.4px;">Jour de repos ?</span><br/>
            <span style="font-size:13px;font-weight:700;" [style.color]="simResult()!.isWeekendDay ? '#b91c1c' : '#15803d'">
              {{ simResult()!.isWeekendDay ? 'Oui' : 'Non' }}
            </span></div>
        </div>
        <p style="font-size:12px;color:#44474c;margin:0;font-style:italic;">{{ simResult()!.explanation }}</p>
      </div>
    }
  </div>

</div>
  `,
  styles: [`@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }`],
})
export class OvertimeAdminComponent implements OnChanges {
  private svc = inject(OvertimeService);
  private userStore = inject(UserStore);

  readonly paysId = input<number>(179);

  rules        = signal<ParametrageHSDto[]>([]);
  isLoading    = signal(true);
  showForm     = signal(false);
  isSaving     = signal(false);
  formError    = signal<string | null>(null);

  readonly typeOptions = TYPE_CALCUL_OPTIONS;
  readonly daysOptions = DAYS_OPTIONS;

  // Form fields
  formPaysId   = 0;
  formType     = 'WEEKEND_ONLY';
  formHeureDebut = '';
  formHeureFin   = '';
  formJourDebut  = '';
  formJourFin    = '';

  // Simulator
  simPaysId    = 0;
  simDate      = new Date().toISOString().split('T')[0];
  simGrossHours = 8;
  simStart     = '';
  simEnd       = '';
  simResult    = signal<OvertimeCalculationResult | null>(null);
  isSimulating = signal(false);

  availablePays = signal<{ id: number; isoCode: string; frenchLabel: string }[]>([]);
  editingId     = signal<number | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['paysId']) this.loadAll();
  }

  private loadAll(): void {
    this.isLoading.set(true);
    this.svc.getAll().subscribe({
      next: r => { this.rules.set(r); this.isLoading.set(false); },
      error: () => this.isLoading.set(false),
    });
    this.loadPays();
  }

  private loadPays(): void {
    this.svc.getAllPays().subscribe(list => {
      this.availablePays.set(list.map(p => ({
        id: p.id as number,
        isoCode: p.iso_code as string,
        frenchLabel: (p.french_label as string) || (p.iso_code as string),
      })));
    });
  }

  openNewForm(): void {
    this.editingId.set(null);
    this.resetForm();
    this.showForm.set(!this.showForm());
  }

  openEditForm(rule: ParametrageHSDto): void {
    this.editingId.set(rule.idParametrage);
    this.formPaysId     = rule.paysId;
    this.formType       = rule.typeCalculHs;
    this.formHeureDebut = rule.heureDebutTravail ? rule.heureDebutTravail.slice(0, 5) : '';
    this.formHeureFin   = rule.heureFinTravail   ? rule.heureFinTravail.slice(0, 5)   : '';
    this.formJourDebut  = rule.jourDebutSemaine  ?? '';
    this.formJourFin    = rule.jourFinSemaine    ?? '';
    this.formError.set(null);
    this.showForm.set(true);
  }

  saveRule(): void {
    if (!this.formPaysId || !this.formType) {
      this.formError.set('Pays et type de calcul sont obligatoires.');
      return;
    }
    this.isSaving.set(true);
    this.formError.set(null);
    const req: CreateParametrageHSRequest = {
      paysId: this.formPaysId,
      typeCalculHs: this.formType as CreateParametrageHSRequest['typeCalculHs'],
      heureDebutTravail: this.formHeureDebut || undefined,
      heureFinTravail:   this.formHeureFin   || undefined,
      jourDebutSemaine:  this.formJourDebut  || undefined,
      jourFinSemaine:    this.formJourFin    || undefined,
    };
    const id = this.editingId();
    const op$ = id ? this.svc.update(id, req) : this.svc.create(req);
    op$.subscribe({
      next: r => {
        this.rules.update(rs => {
          const filtered = id
            ? rs.filter(x => x.idParametrage !== id)
            : rs.filter(x => x.paysId !== r.paysId || !x.actif);
          return [r, ...filtered];
        });
        this.showForm.set(false);
        this.isSaving.set(false);
        this.editingId.set(null);
        this.resetForm();
      },
      error: (err: { error?: { message?: string } }) => {
        this.isSaving.set(false);
        this.formError.set(err?.error?.message ?? (id ? 'Erreur lors de la modification.' : 'Erreur lors de la création.'));
      },
    });
  }

  deactivate(id: number): void {
    if (!confirm('Désactiver cette règle HS ?')) return;
    this.svc.deactivate(id).subscribe({
      next: () => this.rules.update(rs => rs.map(r => r.idParametrage === id ? { ...r, actif: false } : r)),
      error: () => {},
    });
  }

  simulate(): void {
    if (!this.simPaysId || !this.simDate) return;
    this.isSimulating.set(true);
    const req: OvertimeCalculationRequest = {
      paysId: this.simPaysId,
      workDate: this.simDate,
      grossHours: this.simGrossHours,
      workStartTime: this.simStart || undefined,
      workEndTime:   this.simEnd   || undefined,
    };
    this.svc.calculate(req).subscribe({
      next: r => { this.simResult.set(r); this.isSimulating.set(false); },
      error: () => this.isSimulating.set(false),
    });
  }

  getTypeLabel(t: string): string {
    return TYPE_CALCUL_OPTIONS.find(o => o.value === t)?.label ?? t;
  }
  getTypeDesc(t: string): string {
    return TYPE_CALCUL_OPTIONS.find(o => o.value === t)?.desc ?? '';
  }
  getDayLabel(d: string): string {
    return DAYS_OPTIONS.find(o => o.value === d)?.label ?? d;
  }

  private resetForm(): void {
    this.formPaysId = 0; this.formType = 'WEEKEND_ONLY';
    this.formHeureDebut = ''; this.formHeureFin = '';
    this.formJourDebut = ''; this.formJourFin = '';
  }
}
