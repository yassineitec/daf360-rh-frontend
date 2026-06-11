import {
  Component, OnChanges, SimpleChanges, inject, input, signal, computed,
} from '@angular/core';
import { NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BreakService } from './breaks/break.service';
import { RegimeService } from './regimes/regime.service';
import { LegalRulesAdminComponent } from './breaks/legal-rules-admin.component';
import {
  BreakTemplateDto, CreateBreakTemplateRequest,
} from './breaks/break.model';
import { WorkingTimeRegime } from './regimes/regime.model';
import { PermissionDirective } from '../../shared/permission.directive';

type BreakTab = 'templates' | 'legal-rules';

@Component({
  selector: 'app-breaks-admin',
  standalone: true,
  imports: [NgClass, FormsModule, LegalRulesAdminComponent, PermissionDirective],
  template: `
<div>
  <!-- Sub-tab bar -->
  <div style="display:flex;gap:4px;margin-bottom:24px;background:#eceef0;padding:4px;border-radius:12px;width:fit-content;">
    <button type="button" (click)="activeTab.set('templates')"
      [ngClass]="activeTab()==='templates' ? 'sub-active' : 'sub-inactive'"
      style="padding:8px 20px;border-radius:8px;border:none;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .15s;">
      <span class="material-symbols-outlined" style="font-size:16px;">list_alt</span>
      Modèles de pause
    </button>
    <button type="button" (click)="activeTab.set('legal-rules')"
      [ngClass]="activeTab()==='legal-rules' ? 'sub-active' : 'sub-inactive'"
      style="padding:8px 20px;border-radius:8px;border:none;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .15s;">
      <span class="material-symbols-outlined" style="font-size:16px;">gavel</span>
      Règles légales
    </button>
  </div>

  <!-- Templates tab -->
  @if (activeTab() === 'templates') {
    <div>
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <h2 style="font-size:16px;font-weight:700;color:#1d2b3e;margin:0;">Modèles de pause</h2>
          <p style="font-size:12px;color:#44474c;margin:3px 0 0;">Pauses automatiques par régime horaire</p>
        </div>
        <button type="button" (click)="showCreateForm.set(!showCreateForm())" *appHasPermission="'ADMIN_BREAKS'"
          style="padding:8px 18px;border-radius:10px;border:none;background:#1a6b7c;color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
          <span class="material-symbols-outlined" style="font-size:16px;">{{ showCreateForm() ? 'close' : 'add' }}</span>
          {{ showCreateForm() ? 'Annuler' : 'Nouveau modèle' }}
        </button>
      </div>

      <!-- Create form -->
      @if (showCreateForm()) {
        <div style="background:#f7f9fb;border:1px solid #eceef0;border-radius:14px;padding:20px;margin-bottom:20px;">
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#44474c;margin:0 0 14px;">Nouveau modèle de pause</p>
          @if (formError()) { <div style="background:#fee2e2;border-radius:8px;padding:10px;font-size:12px;color:#991b1b;margin-bottom:12px;">{{ formError() }}</div> }
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="grid-column:span 2">
              <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Régime horaire *</label>
              <select [(ngModel)]="formRegimeId" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;">
                <option value="0" disabled>Sélectionner un régime…</option>
                @for (r of regimes(); track r.id) {
                  <option [value]="r.id">{{ r.labelFr }} · {{ r.hoursPerWeek }}h/sem</option>
                }
              </select>
            </div>
            <div>
              <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Libellé FR *</label>
              <input [(ngModel)]="formLabelFr" type="text" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
            </div>
            <div>
              <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Libellé EN</label>
              <input [(ngModel)]="formLabelEn" type="text" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
            </div>
            <div>
              <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Type *</label>
              <select [(ngModel)]="formType" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;">
                <option value="AUTO">AUTO — Automatique conditionnelle</option>
                <option value="MANDATORY">MANDATORY — Obligatoire</option>
                <option value="OPTIONAL">OPTIONAL — Facultative</option>
              </select>
            </div>
            <div>
              <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Durée (minutes) *</label>
              <input [(ngModel)]="formDurationMin" type="number" min="1" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
            </div>
            <div>
              <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Jours applicables</label>
              <select [(ngModel)]="formDays" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;">
                <option value="ALL">Tous les jours</option>
                <option value="WEEKDAYS">Jours ouvrés</option>
                <option value="WEEKEND">Week-end</option>
              </select>
            </div>
            <div>
              <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Min heures travaillées (déclencheur)</label>
              <input [(ngModel)]="formMinHours" type="number" step="0.5" placeholder="ex: 6" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
            </div>
            <div>
              <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">
                Heure de début (optionnel)
              </label>
              <input type="time" [(ngModel)]="formTimeStart"
                style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
              <small style="font-size:10px;color:#75777d;">Laisser vide = déduction par seuil d'heures</small>
            </div>
            <div>
              <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">
                Heure de fin (optionnel)
              </label>
              <input type="time" [(ngModel)]="formTimeEnd"
                style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:14px;">
            <button type="button" (click)="saveTemplate()" [disabled]="isSaving()"
              style="padding:9px 22px;border-radius:10px;border:none;background:#4648d4;color:#fff;font-size:13px;font-weight:700;cursor:pointer;"
              [style.opacity]="isSaving() ? '0.6' : '1'">
              {{ isSaving() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
          </div>
        </div>
      }

      <!-- Templates by regime -->
      @if (isLoading()) {
        <div style="display:flex;flex-direction:column;gap:8px;">
          @for (i of [1,2,3]; track i) {
            <div style="height:60px;border-radius:10px;background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;"></div>
          }
        </div>
      }

      @if (!isLoading()) {
        @if (groupedTemplates().length === 0) {
          <div style="text-align:center;padding:56px;color:#75777d;">
            <span class="material-symbols-outlined" style="font-size:40px;display:block;margin-bottom:12px;opacity:.4;">list_alt</span>
            <p style="font-size:13px;margin:0;">Aucun modèle de pause configuré pour cette entité.</p>
            <p style="font-size:12px;margin:6px 0 0;color:#a8a9ad;">Créez le premier modèle en cliquant sur "Nouveau modèle".</p>
          </div>
        }

        @for (group of groupedTemplates(); track group.regimeId) {
          <div style="margin-bottom:20px;">
            <p style="font-size:12px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.4px;margin:0 0 8px;display:flex;align-items:center;gap:6px;">
              <span class="material-symbols-outlined" style="font-size:14px;color:#1a6b7c;">schedule</span>
              {{ group.regimeName }}
            </p>
            <div style="background:#fff;border-radius:14px;border:1px solid #eceef0;overflow:hidden;">
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#f2f4f6;">
                    <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Libellé</th>
                    <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Type</th>
                    <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Durée</th>
                    <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Jours</th>
                    <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Horaire</th>
                    <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Déclencheur</th>
                    <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  @for (t of group.templates; track t.id) {
                    <tr style="border-top:1px solid #f0f2f4;">
                      <td style="padding:12px 16px;font-size:13px;font-weight:500;color:#1d2b3e;">{{ t.labelFr }}</td>
                      <td style="padding:12px 16px;">
                        <span style="font-size:11px;padding:3px 10px;border-radius:999px;font-weight:700;"
                          [style.background]="t.deductionType==='MANDATORY' ? '#fee2e2' : t.deductionType==='AUTO' ? '#e6f4f6' : '#f1f5f9'"
                          [style.color]="t.deductionType==='MANDATORY' ? '#991b1b' : t.deductionType==='AUTO' ? '#0f4a57' : '#475569'">
                          {{ t.deductionType }}
                        </span>
                      </td>
                      <td style="padding:12px 16px;">
                        <span style="background:#e6f4f6;color:#0f4a57;font-size:12px;padding:3px 10px;border-radius:999px;font-weight:600;">{{ t.durationMin }} min</span>
                      </td>
                      <td style="padding:12px 16px;font-size:12px;color:#44474c;">{{ formatDays(t.appliesToDays) }}</td>
                      <td style="padding:12px 16px;font-size:12px;color:#44474c;">{{ t.breakTimeStart ? t.breakTimeStart + ' – ' + t.breakTimeEnd : '—' }}</td>
                      <td style="padding:12px 16px;font-size:12px;color:#44474c;">
                        {{ t.minWorkHoursTrigger ? '≥ ' + t.minWorkHoursTrigger + 'h' : '—' }}
                      </td>
                      <td style="padding:12px 16px;text-align:right;">
                        <button type="button" (click)="removeTemplate(t.id)" *appHasPermission="'ADMIN_BREAKS'"
                          style="padding:5px 8px;border-radius:8px;border:none;background:#fee2e2;color:#ba1a1a;cursor:pointer;">
                          <span class="material-symbols-outlined" style="font-size:14px;">delete</span>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    </div>
  }

  <!-- Legal rules tab -->
  @if (activeTab() === 'legal-rules') {
    <app-legal-rules-admin [paysId]="paysId()" />
  }
</div>
  `,
  styles: [`
    .sub-active   { background:#fff; color:#1d2b3e; box-shadow:0 1px 3px rgba(51,65,85,.12); }
    .sub-inactive { background:transparent; color:#44474c; }
    .sub-inactive:hover { background:rgba(255,255,255,.5); }
    @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  `],
})
export class BreaksAdminComponent implements OnChanges {
  private breakSvc  = inject(BreakService);
  private regimeSvc = inject(RegimeService);

  readonly paysId = input<number>(179);

  activeTab     = signal<BreakTab>('templates');
  templates     = signal<BreakTemplateDto[]>([]);
  regimes       = signal<WorkingTimeRegime[]>([]);
  isLoading     = signal(true);
  showCreateForm = signal(false);
  isSaving      = signal(false);
  formError     = signal<string | null>(null);

  // Form fields
  formRegimeId  = 0;
  formLabelFr   = '';
  formLabelEn   = '';
  formType      = 'AUTO';
  formDurationMin = 30;
  formDays      = 'ALL';
  formMinHours: number | null = null;
  formTimeStart = '';
  formTimeEnd   = '';

  groupedTemplates = computed(() => {
    const groups = new Map<number, { regimeId: number; regimeName: string; templates: BreakTemplateDto[] }>();
    for (const t of this.templates()) {
      const regime = this.regimes().find(r => r.id === t.regimeId);
      const name   = regime?.labelFr ?? 'Régime #' + t.regimeId;
      if (!groups.has(t.regimeId)) groups.set(t.regimeId, { regimeId: t.regimeId, regimeName: name, templates: [] });
      groups.get(t.regimeId)!.templates.push(t);
    }
    return Array.from(groups.values());
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['paysId']) this.loadAll();
  }

  loadAll(): void {
    this.isLoading.set(true);
    this.regimeSvc.getRegimes(this.paysId()).subscribe({ next: rs => this.regimes.set(rs) });
    this.breakSvc.getTemplatesForPays(this.paysId()).subscribe({
      next: ts => { this.templates.set(ts); this.isLoading.set(false); },
      error: () => this.isLoading.set(false),
    });
  }

  saveTemplate(): void {
    if (!this.formRegimeId || !this.formLabelFr || !this.formDurationMin) {
      this.formError.set('Régime, libellé et durée sont obligatoires.');
      return;
    }
    this.isSaving.set(true);
    this.formError.set(null);
    const req: CreateBreakTemplateRequest = {
      paysId: this.paysId(),
      regimeId: this.formRegimeId,
      labelFr: this.formLabelFr,
      labelEn: this.formLabelEn || undefined,
      deductionType: this.formType,
      durationMin: this.formDurationMin,
      appliesToDays: this.formDays,
      minWorkHoursTrigger: this.formMinHours ?? undefined,
      sortOrder: this.templates().filter(t => t.regimeId === this.formRegimeId).length,
      breakTimeStart: this.formTimeStart || undefined,
      breakTimeEnd:   this.formTimeEnd   || undefined,
    };
    this.breakSvc.createTemplate(req).subscribe({
      next: t => {
        this.templates.update(ts => [...ts, t]);
        this.showCreateForm.set(false);
        this.isSaving.set(false);
        this.resetForm();
      },
      error: err => {
        this.isSaving.set(false);
        this.formError.set(err?.error?.message ?? 'Erreur lors de la création.');
      },
    });
  }

  removeTemplate(id: number): void {
    if (!confirm('Supprimer ce modèle de pause ?')) return;
    this.breakSvc.deleteTemplate(id).subscribe({
      next: () => this.templates.update(ts => ts.filter(t => t.id !== id)),
      error: () => {},
    });
  }

  formatDays(d: string): string {
    const m: Record<string, string> = { ALL: 'Tous', WEEKDAYS: 'Jours ouvrés', WEEKEND: 'Week-end' };
    return m[d] ?? d;
  }

  private resetForm(): void {
    this.formRegimeId = 0; this.formLabelFr = ''; this.formLabelEn = '';
    this.formType = 'AUTO'; this.formDurationMin = 30; this.formDays = 'ALL'; this.formMinHours = null;
    this.formTimeStart = '';
    this.formTimeEnd   = '';
  }
}
