import {
  Component, OnChanges, SimpleChanges, inject, input, signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BreakService } from './break.service';
import { BreakLegalRuleDto, CreateBreakLegalRuleRequest } from './break.model';
import { PermissionDirective } from '../../../shared/permission.directive';

@Component({
  selector: 'app-legal-rules-admin',
  standalone: true,
  imports: [NgClass, FormsModule, PermissionDirective],
  template: `
<div>
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
    <div>
      <h2 style="font-size:16px;font-weight:700;color:#1d2b3e;margin:0;">Règles légales de pause</h2>
      <p style="font-size:12px;color:#44474c;margin:3px 0 0;">Seuils légaux de déduction de pause par entité</p>
    </div>
    <button type="button" (click)="showForm.set(!showForm())" *appHasPermission="'ADMIN_BREAKS'"
      style="padding:8px 18px;border-radius:10px;border:none;background:#1a6b7c;color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
      <span class="material-symbols-outlined" style="font-size:16px;">{{ showForm() ? 'close' : 'add' }}</span>
      {{ showForm() ? 'Annuler' : 'Nouvelle règle' }}
    </button>
  </div>

  <!-- Create form -->
  @if (showForm()) {
    <div style="background:#f7f9fb;border:1px solid #eceef0;border-radius:14px;padding:20px;margin-bottom:20px;">
      <h3 style="font-size:13px;font-weight:700;color:#1d2b3e;margin:0 0 14px;text-transform:uppercase;letter-spacing:.4px;">Nouvelle règle</h3>
      @if (formError()) { <div style="background:#fee2e2;border-radius:8px;padding:10px;font-size:12px;color:#991b1b;margin-bottom:12px;">{{ formError() }}</div> }
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="grid-column:span 2">
          <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Libellé *</label>
          <input [(ngModel)]="formLabel" type="text" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Min heures travaillées *</label>
          <input [(ngModel)]="formMinHours" type="number" step="0.5" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Max heures (optionnel)</label>
          <input [(ngModel)]="formMaxHours" type="number" step="0.5" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Déduction (minutes) *</label>
          <input [(ngModel)]="formDeductionMin" type="number" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
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
          <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Date d'effet *</label>
          <input [(ngModel)]="formEffFrom" type="date" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#44474c;display:block;margin-bottom:4px;">Date de fin (optionnel)</label>
          <input [(ngModel)]="formEffTo" type="date" style="width:100%;background:#fff;border:1px solid #c5c6cd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;box-sizing:border-box;" />
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:14px;">
        <button type="button" (click)="saveRule()" [disabled]="isSaving()"
          style="padding:9px 22px;border-radius:10px;border:none;background:#4648d4;color:#fff;font-size:13px;font-weight:700;cursor:pointer;"
          [style.opacity]="isSaving() ? '0.6' : '1'">
          {{ isSaving() ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </div>
    </div>
  }

  <!-- Rules table -->
  <div style="background:#fff;border-radius:14px;border:1px solid #eceef0;overflow:hidden;">
    @if (isLoading()) {
      <div style="padding:32px;text-align:center;color:#44474c;font-size:13px;">Chargement…</div>
    }
    @if (!isLoading() && rules().length === 0) {
      <div style="padding:48px;text-align:center;">
        <p style="font-size:13px;color:#75777d;margin:0;">Aucune règle légale configurée pour cette entité.</p>
      </div>
    }
    @if (!isLoading() && rules().length > 0) {
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f2f4f6;">
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Libellé</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Min h. travaillées</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Déduction (min)</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Jours</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Effet</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.5px;">Action</th>
          </tr>
        </thead>
        <tbody>
          @for (rule of rules(); track rule.id) {
            <tr style="border-top:1px solid #f0f2f4;">
              <td style="padding:12px 16px;font-size:13px;font-weight:500;color:#1d2b3e;">{{ rule.labelFr }}</td>
              <td style="padding:12px 16px;font-size:13px;color:#44474c;">{{ rule.minWorkHours }}h{{ rule.maxWorkHours ? ' – ' + rule.maxWorkHours + 'h' : '+' }}</td>
              <td style="padding:12px 16px;">
                <span style="background:#e6f4f6;color:#0f4a57;font-size:12px;padding:3px 10px;border-radius:999px;font-weight:600;">{{ rule.deductionMin }} min</span>
              </td>
              <td style="padding:12px 16px;font-size:12px;color:#44474c;">{{ formatDays(rule.appliesToDays) }}</td>
              <td style="padding:12px 16px;font-size:12px;color:#44474c;">{{ rule.effectiveFrom }}{{ rule.effectiveTo ? ' → ' + rule.effectiveTo : '' }}</td>
              <td style="padding:12px 16px;text-align:right;">
                <button type="button" (click)="removeRule(rule.id)" *appHasPermission="'ADMIN_BREAKS'"
                  style="padding:5px 8px;border-radius:8px;border:none;background:#fee2e2;color:#ba1a1a;cursor:pointer;">
                  <span class="material-symbols-outlined" style="font-size:14px;">delete</span>
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    }
  </div>
</div>
  `,
})
export class LegalRulesAdminComponent implements OnChanges {
  private svc = inject(BreakService);

  readonly paysId = input<number>(179);

  rules     = signal<BreakLegalRuleDto[]>([]);
  isLoading = signal(true);
  showForm  = signal(false);
  isSaving  = signal(false);
  formError = signal<string | null>(null);

  // Form fields
  formLabel = '';
  formMinHours = 0;
  formMaxHours: number | null = null;
  formDeductionMin = 0;
  formDays = 'ALL';
  formEffFrom = new Date().toISOString().split('T')[0];
  formEffTo = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['paysId']) this.loadRules();
  }

  loadRules(): void {
    this.isLoading.set(true);
    this.svc.getLegalRules(this.paysId()).subscribe({
      next: rs => { this.rules.set(rs); this.isLoading.set(false); },
      error: () => this.isLoading.set(false),
    });
  }

  saveRule(): void {
    if (!this.formLabel || !this.formMinHours || !this.formDeductionMin || !this.formEffFrom) {
      this.formError.set('Libellé, heures minimum, déduction et date d\'effet sont obligatoires.');
      return;
    }
    this.isSaving.set(true);
    this.formError.set(null);
    const req: CreateBreakLegalRuleRequest = {
      paysId: this.paysId(),
      labelFr: this.formLabel,
      minWorkHours: this.formMinHours,
      maxWorkHours: this.formMaxHours ?? undefined,
      deductionMin: this.formDeductionMin,
      appliesToDays: this.formDays,
      effectiveFrom: this.formEffFrom,
      effectiveTo: this.formEffTo || undefined,
    };
    this.svc.createLegalRule(req).subscribe({
      next: r => {
        this.rules.update(rs => [...rs, r]);
        this.showForm.set(false);
        this.isSaving.set(false);
        this.formLabel = ''; this.formMinHours = 0; this.formDeductionMin = 0;
      },
      error: err => {
        this.isSaving.set(false);
        this.formError.set(err?.error?.message ?? 'Erreur lors de la création.');
      },
    });
  }

  removeRule(id: number): void {
    if (!confirm('Supprimer cette règle ?')) return;
    this.svc.deleteLegalRule(id).subscribe({
      next: () => this.rules.update(rs => rs.filter(r => r.id !== id)),
      error: () => {},
    });
  }

  formatDays(d: string): string {
    const m: Record<string, string> = { ALL: 'Tous', WEEKDAYS: 'Jours ouvrés', WEEKEND: 'Week-end' };
    return m[d] ?? d;
  }
}
