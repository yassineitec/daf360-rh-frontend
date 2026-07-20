import {
  Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { LifecycleService } from './lifecycle.service';
import {
  OffboardingWorkflowInstance, OffboardingTask, ExitInterview,
  OffboardingAssetReturn, AssetType,
  DEPARTURE_REASON_LABELS, OFFBOARDING_STATUS_LABELS, DEPARTURE_REASONS,
  ASSET_TYPE_LABELS, DepartureReason,
  computeProgress, isTerminal,
} from './models/lifecycle.model';
import {
  StatusBadgeComponent, BadgeOptions, ButtonComponent,
  CardComponent, DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';
import { SpinnerComponent } from '../../shared/spinner.component';
import { ModalComponent }   from '../../shared/modal.component';

type BadgeVariant = BadgeOptions['variant'];

const TASK_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  PENDING:    'neutral',
  IN_PROGRESS:'teal',
  DONE:       'success',
  BLOCKED:    'danger',
  SKIPPED:    'neutral',
};
const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING:    'En attente',
  IN_PROGRESS:'En cours',
  DONE:       'Terminé',
  BLOCKED:    'Bloqué',
  SKIPPED:    'Ignoré',
};
const ASSET_TYPES: AssetType[] = ['IT', 'BADGE', 'VEHICLE', 'OTHER'];

@Component({
  selector: 'app-workflow-detail',
  standalone: true,
  imports: [
    FormsModule, RouterLink,
    StatusBadgeComponent, ButtonComponent, CardComponent,
    DataTableComponent, DafCellDirective,
    SpinnerComponent, ModalComponent,
  ],
  template: `
    <!-- Breadcrumb -->
    <nav class="breadcrumb">
      <a routerLink="/rh/lifecycle" class="bc-link">Offboarding</a>
      <span class="bc-sep">›</span>
      <span class="bc-current">Dossier #{{ workflowId }}</span>
    </nav>

    @if (loading()) {
      <div class="center-spin"><app-spinner size="lg" /></div>
    } @else if (!wf()) {
      <div class="error-state"><p>Dossier introuvable.</p><a routerLink="/rh/lifecycle" class="btn-back">Retour</a></div>
    } @else {

      <!-- SLA / blocked banner -->
      @if (wf()!.slaBreachFlag || wf()!.status === 'BLOCKED') {
        <div class="alert-banner alert-danger">
          <span class="material-symbols-outlined">warning</span>
          @if (wf()!.slaBreachFlag) { <span>Une ou plusieurs tâches ont dépassé leur SLA.</span> }
          @else { <span>Ce dossier est <strong>bloqué</strong>. Des tâches obligatoires sont en retard.</span> }
        </div>
      }

      <!-- Header -->
      <daf-card [options]="{ padding: 'lg', radius: 'xl' }" class="block wf-header">
        <div class="header-row">
          <div class="header-meta">
            <h1 class="wf-title">Offboarding — {{ wf()!.employeeFullName ?? 'Profil #' + wf()!.employeeProfileId }}</h1>
            <div class="header-chips">
              <daf-badge [label]="statusLabel(wf()!.status)" [options]="{ variant: statusVariant(wf()!.status), size: 'sm' }" />
              <daf-badge [label]="reasonLabel(wf()!.departureReason)" [options]="{ variant: 'neutral', size: 'sm' }" />
              @if (wf()!.slaBreachFlag) {
                <daf-badge label="SLA dépassé" [options]="{ variant: 'danger', size: 'sm' }" />
              }
            </div>
          </div>
          <!-- Action buttons -->
          @if (!isTerminal()) {
            <div class="header-actions">
              @if (canValidate()) {
                <daf-button label="Valider l'offboarding" variant="teal" [options]="{ iconStart: 'check_circle', loading: validating() }" (onClick)="showValidateModal.set(true)" />
              }
              <daf-button label="Annuler" variant="danger" [options]="{ iconStart: 'cancel', loading: cancelling() }" (onClick)="showCancelModal.set(true)" />
            </div>
          }
        </div>

        <!-- Key dates -->
        <div class="dates-row">
          <div class="date-item">
            <span class="date-label">Déclenchement</span>
            <span class="date-val">{{ fmt(wf()!.triggerDate) }}</span>
          </div>
          @if (wf()!.lastWorkingDay) {
            <div class="date-item">
              <span class="date-label">Dernier jour</span>
              <span class="date-val">{{ fmt(wf()!.lastWorkingDay) }}</span>
            </div>
          }
          @if (wf()!.validatedAt) {
            <div class="date-item">
              <span class="date-label">Validé le</span>
              <span class="date-val">{{ fmt(wf()!.validatedAt) }}</span>
            </div>
          }
          @if (wf()!.cancelledAt) {
            <div class="date-item">
              <span class="date-label">Annulé le</span>
              <span class="date-val">{{ fmt(wf()!.cancelledAt) }}</span>
            </div>
          }
          @if (wf()!.handoverManagerName) {
            <div class="date-item">
              <span class="date-label">Responsable passation</span>
              <span class="date-val">{{ wf()!.handoverManagerName }}</span>
            </div>
          }
        </div>

        @if (wf()!.cancellationReason) {
          <p class="cancel-reason"><strong>Motif d'annulation :</strong> {{ wf()!.cancellationReason }}</p>
        }
        @if (wf()!.departureNotes) {
          <p class="notes-text"><strong>Notes :</strong> {{ wf()!.departureNotes }}</p>
        }

        <!-- Progress bar -->
        @if (tasks().length > 0) {
          <div class="progress-section">
            <div class="progress-label">
              <span>Progression des tâches</span>
              <span class="progress-pct-val">{{ progressPct() }}% — {{ doneTasks() }}/{{ tasks().length }}</span>
            </div>
            <div class="progress-bar-lg">
              <div class="progress-fill-lg" [style.width]="progressPct() + '%'" [class.done]="progressPct() >= 100"></div>
            </div>
          </div>
        }
      </daf-card>

      <!-- ── Tasks ──────────────────────────────────────────────────────────── -->
      <section class="detail-section">
        <h2 class="section-title">Tâches</h2>
        @if (tasks().length === 0) {
          <p class="section-empty">Aucune tâche définie pour ce dossier.</p>
        } @else {
          <daf-data-table [columns]="taskColumns" [rows]="taskRows()" [config]="taskTableConfig">

            <ng-template dafCell="status" let-row>
              <daf-badge
                [label]="taskStatusLabel(row['_status'])"
                [options]="{ variant: taskStatusVariant(row['_status']), size: 'sm' }"
              />
            </ng-template>

            <ng-template dafCell="sla" let-row>
              @if (row['_slaBreached']) {
                <daf-badge label="SLA dépassé" [options]="{ variant: 'danger', size: 'sm' }" />
              } @else if (row['_dueDate']) {
                <span class="date-muted">{{ row['_dueDate'] }}</span>
              } @else {
                <span class="cell-muted">—</span>
              }
            </ng-template>

            <ng-template dafCell="blocking" let-row>
              @if (row['_blocking']) {
                <daf-badge label="Bloquant" [options]="{ variant: 'warning', size: 'sm' }" />
              } @else {
                <span class="cell-muted">—</span>
              }
            </ng-template>

            <ng-template dafCell="actions" let-row>
              @if (row['_status'] !== 'DONE' && row['_status'] !== 'SKIPPED' && !isTerminal()) {
                <div class="row-actions">
                  <daf-button label="Compléter" variant="teal" [options]="{ size: 'sm' }" (onClick)="openCompleteModal(row['_task'])" />
                  @if (!row['_blocking']) {
                    <daf-button label="Ignorer" variant="ghost" [options]="{ size: 'sm' }" (onClick)="openSkipModal(row['_task'])" />
                  }
                </div>
              }
            </ng-template>

          </daf-data-table>
        }
      </section>

      <!-- ── Exit interview ─────────────────────────────────────────────────── -->
      <section class="detail-section">
        <div class="section-header-row">
          <h2 class="section-title">Entretien de sortie</h2>
          @if (!interview() && !isTerminal()) {
            <daf-button label="Enregistrer l'entretien" variant="secondary" [options]="{ size: 'sm', iconStart: 'add' }" (onClick)="showInterviewForm.set(true)" />
          }
        </div>

        @if (interviewLoading()) {
          <app-spinner size="sm" />
        } @else if (interview()) {
          <div class="interview-card">
            @if (interview()!.isAnonymised) {
              <p class="anon-notice">Cet entretien a été anonymisé.</p>
            } @else {
              <div class="interview-grid">
                <div>
                  <span class="meta-label">Date de conduite</span>
                  <span class="meta-val">{{ fmt(interview()!.conductedDate) }}</span>
                </div>
                @if (interview()!.departureReasons) {
                  <div>
                    <span class="meta-label">Raisons déclarées</span>
                    <span class="meta-val">{{ parseReasons(interview()!.departureReasons) }}</span>
                  </div>
                }
              </div>
              @if (interview()!.feedbackText) {
                <div class="feedback-text">
                  <span class="meta-label">Retour de l'employé</span>
                  <p>{{ interview()!.feedbackText }}</p>
                </div>
              }
            }
          </div>
        } @else if (!showInterviewForm()) {
          <p class="section-empty">Aucun entretien enregistré.</p>
        }

        @if (showInterviewForm()) {
          <div class="inline-form">
            <div class="form-grid-2">
              <div>
                <label class="form-label">Date de conduite *</label>
                <input class="form-input" type="date" [(ngModel)]="ivDate" />
              </div>
              <div class="field-full">
                <label class="form-label">Raisons déclarées par l'employé</label>
                <div class="reasons-checkboxes">
                  @for (r of DEPARTURE_REASONS; track r) {
                    <label class="cb-label">
                      <input type="checkbox" [checked]="ivReasons.includes(r)" (change)="toggleReason(r, $event)" />
                      {{ DEPARTURE_REASON_LABELS[r] }}
                    </label>
                  }
                </div>
              </div>
              <div class="field-full">
                <label class="form-label">Feedback</label>
                <textarea class="form-input form-textarea" rows="3" [(ngModel)]="ivFeedback" placeholder="Retour de l'employé…"></textarea>
              </div>
            </div>
            <div class="inline-form-actions">
              <daf-button label="Enregistrer" variant="teal" [options]="{ loading: savingInterview() }" (onClick)="saveInterview()" />
              <daf-button label="Annuler" variant="ghost" (onClick)="showInterviewForm.set(false)" />
            </div>
            @if (interviewError()) { <p class="inline-error">{{ interviewError() }}</p> }
          </div>
        }
      </section>

      <!-- ── Asset returns ──────────────────────────────────────────────────── -->
      <section class="detail-section">
        <div class="section-header-row">
          <h2 class="section-title">Retours d'équipements</h2>
          <div class="section-actions">
            @if (!isTerminal()) {
              <daf-button label="Sync. depuis IT" variant="ghost"
                [options]="{ size: 'sm', iconStart: 'sync', loading: syncingAssets() }"
                (onClick)="syncAssetsFromIt()" />
              <daf-button label="Ajouter un équipement" variant="secondary"
                [options]="{ size: 'sm', iconStart: 'add' }"
                (onClick)="showAssetForm.set(true)" />
            }
          </div>
        </div>

        @if (assetsLoading()) {
          <app-spinner size="sm" />
        } @else if (assets().length === 0 && !showAssetForm()) {
          <p class="section-empty">Aucun équipement enregistré. Cliquez sur "Sync. depuis IT" pour importer les équipements assignés à cet employé.</p>
        }

        @if (assets().length > 0) {
          <div class="asset-list">
            @for (a of assets(); track a.id) {
              <div class="asset-row" [class.returned]="!!a.actualReturnDate">
                <div class="asset-info">
                  <span class="asset-type-badge">{{ ASSET_TYPE_LABELS[a.assetType] }}</span>
                  <span class="asset-desc">{{ a.assetDescription }}</span>
                </div>
                <div class="asset-dates">
                  <span class="meta-label">Attendu</span>
                  <span>{{ fmt(a.expectedReturnDate) }}</span>
                </div>
                @if (a.actualReturnDate) {
                  <div class="asset-dates">
                    <span class="meta-label">Retourné le</span>
                    <span>{{ fmt(a.actualReturnDate) }}</span>
                  </div>
                  <daf-badge label="Retourné" [options]="{ variant: 'success', size: 'sm' }" />
                } @else if (!isTerminal()) {
                  <daf-button label="Confirmer retour" variant="secondary" [options]="{ size: 'sm' }" (onClick)="openConfirmAsset(a)" />
                } @else {
                  <daf-badge label="Non retourné" [options]="{ variant: 'warning', size: 'sm' }" />
                }
              </div>
            }
          </div>
        }

        @if (showAssetForm()) {
          <div class="inline-form">
            <div class="form-grid-2">
              <div class="field-full">
                <label class="form-label">Description *</label>
                <input class="form-input" type="text" [(ngModel)]="assetDesc" placeholder="Ex: MacBook Pro #123" />
              </div>
              <div>
                <label class="form-label">Type</label>
                <select class="form-input" [(ngModel)]="assetType">
                  @for (t of ASSET_TYPES; track t) {
                    <option [value]="t">{{ ASSET_TYPE_LABELS[t] }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="form-label">Date de retour attendue *</label>
                <input class="form-input" type="date" [(ngModel)]="assetExpectedDate" />
              </div>
            </div>
            <div class="inline-form-actions">
              <daf-button label="Ajouter" variant="teal" [options]="{ loading: savingAsset() }" (onClick)="saveAsset()" />
              <daf-button label="Annuler" variant="ghost" (onClick)="showAssetForm.set(false)" />
            </div>
            @if (assetError()) { <p class="inline-error">{{ assetError() }}</p> }
          </div>
        }
      </section>

    }

    <!-- ── Complete task modal ─────────────────────────────────────────────── -->
    <app-modal title="Compléter la tâche" [visible]="showCompleteModal()" [hasFooter]="true" (closed)="showCompleteModal.set(false)">
      @if (activeTask()) {
        <p class="modal-task-name">{{ activeTask()!.taskLabel }}</p>
      }
      <div class="modal-field">
        <label class="form-label">Commentaire</label>
        <textarea class="form-input form-textarea" rows="3" [(ngModel)]="taskComment" placeholder="Optionnel…"></textarea>
      </div>
      <div slot="footer">
        <daf-button label="Annuler" variant="secondary" (onClick)="showCompleteModal.set(false)" />
        <daf-button label="Marquer comme terminé" variant="teal" [options]="{ loading: actioning() }" (onClick)="confirmComplete()" />
      </div>
    </app-modal>

    <!-- ── Skip task modal ────────────────────────────────────────────────── -->
    <app-modal title="Ignorer la tâche" [visible]="showSkipModal()" [hasFooter]="true" (closed)="showSkipModal.set(false)">
      @if (activeTask()) {
        <p class="modal-task-name">{{ activeTask()!.taskLabel }}</p>
      }
      <div class="modal-field">
        <label class="form-label">Raison *</label>
        <textarea class="form-input form-textarea" rows="3" [(ngModel)]="skipReason" placeholder="Expliquer pourquoi cette tâche est ignorée…"></textarea>
      </div>
      <div slot="footer">
        <daf-button label="Annuler" variant="secondary" (onClick)="showSkipModal.set(false)" />
        <daf-button label="Ignorer" variant="danger" [options]="{ loading: actioning(), disabled: !skipReason.trim() }" (onClick)="confirmSkip()" />
      </div>
    </app-modal>

    <!-- ── Validate modal ─────────────────────────────────────────────────── -->
    <app-modal title="Valider l'offboarding" [visible]="showValidateModal()" [hasFooter]="true" (closed)="showValidateModal.set(false)">
      <p class="modal-body-text">Confirmer la clôture de ce dossier ? Le profil de l'employé sera marqué <strong>TERMINÉ</strong>.</p>
      <div slot="footer">
        <daf-button label="Annuler" variant="secondary" (onClick)="showValidateModal.set(false)" />
        <daf-button label="Valider" variant="teal" [options]="{ loading: validating() }" (onClick)="confirmValidate()" />
      </div>
    </app-modal>

    <!-- ── Cancel modal ───────────────────────────────────────────────────── -->
    <app-modal title="Annuler l'offboarding" [visible]="showCancelModal()" [hasFooter]="true" (closed)="showCancelModal.set(false)">
      <p class="modal-body-text">Le profil de l'employé reviendra au statut <strong>ACTIF</strong>.</p>
      <div class="modal-field">
        <label class="form-label">Motif d'annulation</label>
        <textarea class="form-input form-textarea" rows="3" [(ngModel)]="cancelReason" placeholder="Optionnel…"></textarea>
      </div>
      <div slot="footer">
        <daf-button label="Ne pas annuler" variant="secondary" (onClick)="showCancelModal.set(false)" />
        <daf-button label="Confirmer l'annulation" variant="danger" [options]="{ loading: cancelling() }" (onClick)="confirmCancel()" />
      </div>
    </app-modal>

    <!-- ── Confirm asset return modal ─────────────────────────────────────── -->
    <app-modal title="Confirmer le retour" [visible]="showConfirmAssetModal()" [hasFooter]="true" (closed)="showConfirmAssetModal.set(false)">
      @if (activeAsset()) {
        <p class="modal-task-name">{{ activeAsset()!.assetDescription }}</p>
      }
      <div class="modal-field">
        <label class="form-label">État à la restitution</label>
        <input class="form-input" type="text" [(ngModel)]="assetCondition" placeholder="Ex: Bon état, rayure sur le couvercle…" />
      </div>
      <div slot="footer">
        <daf-button label="Annuler" variant="secondary" (onClick)="showConfirmAssetModal.set(false)" />
        <daf-button label="Confirmer" variant="teal" [options]="{ loading: confirmingAsset() }" (onClick)="confirmAssetReturn()" />
      </div>
    </app-modal>
  `,
  styleUrl: './workflow-detail.component.scss',
  styles: [`
    .breadcrumb      { display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:20px }
    .bc-link         { color:var(--color-primary,#1C4E5C);text-decoration:none }
    .bc-link:hover   { text-decoration:underline }
    .bc-sep          { color:var(--color-text-muted) }
    .bc-current      { color:var(--color-text-muted) }
    .center-spin     { display:flex;justify-content:center;padding:80px 0 }
    .error-state     { text-align:center;padding:60px 20px }
    .btn-back        { display:inline-block;margin-top:12px;color:var(--color-primary);font-size:13px }
    .alert-banner    { display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:10px;font-size:13px;margin-bottom:16px }
    .alert-danger    { background:#fee2e2;color:#991b1b;border:1px solid #fca5a5 }
    .wf-header       { margin-bottom:24px }
    .header-row      { display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap }
    .header-meta     { flex:1 }
    .wf-title        { font-size:20px;font-weight:700;color:var(--color-text,#1A1C1E);margin:0 0 10px }
    .header-chips    { display:flex;flex-wrap:wrap;gap:8px }
    .header-actions  { display:flex;gap:8px;flex-wrap:wrap }
    .dates-row       { display:flex;flex-wrap:wrap;gap:24px;margin-top:16px;padding-top:16px;border-top:1px solid var(--color-border,#E0E7E9) }
    .date-item       { display:flex;flex-direction:column;gap:2px }
    .date-label      { font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--color-text-muted) }
    .date-val        { font-size:14px;font-weight:500;color:var(--color-text) }
    .cancel-reason, .notes-text { font-size:13px;color:var(--color-text-muted);margin:12px 0 0 }
    .progress-section  { margin-top:16px }
    .progress-label    { display:flex;justify-content:space-between;font-size:12px;color:var(--color-text-muted);margin-bottom:6px }
    .progress-pct-val  { font-weight:600 }
    .progress-bar-lg   { height:8px;background:var(--color-bg-secondary,#E5E7EB);border-radius:4px }
    .progress-fill-lg  { height:100%;background:var(--color-primary,#1C4E5C);border-radius:4px;transition:width .3s }
    .progress-fill-lg.done { background:#22C55E }
    .detail-section    { background:var(--color-surface,#fff);border:1px solid var(--color-border,#E0E7E9);border-radius:12px;padding:20px 24px;margin-bottom:20px }
    .section-header-row{ display:flex;justify-content:space-between;align-items:center;margin-bottom:16px }
    .section-actions   { display:flex;gap:8px;align-items:center }
    .section-title     { font-size:15px;font-weight:700;color:var(--color-text);margin:0 0 16px }
    .section-header-row .section-title { margin:0 }
    .section-empty     { font-size:13px;color:var(--color-text-muted);font-style:italic }
    .cell-muted, .date-muted { font-size:12px;color:var(--color-text-muted) }
    .row-actions       { display:flex;gap:6px }
    .interview-card    { background:var(--color-bg-secondary,#F8FAFC);border-radius:8px;padding:16px }
    .interview-grid    { display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px }
    .meta-label        { display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--color-text-muted);margin-bottom:2px }
    .meta-val          { font-size:13px;color:var(--color-text) }
    .feedback-text     { margin-top:8px }
    .feedback-text p   { font-size:13px;color:var(--color-text);margin:4px 0 0;line-height:1.5 }
    .anon-notice       { font-size:13px;color:var(--color-text-muted);font-style:italic }
    .asset-list        { display:flex;flex-direction:column;gap:10px }
    .asset-row         { display:flex;align-items:center;gap:16px;padding:12px 16px;background:var(--color-bg-secondary,#F8FAFC);border-radius:8px;flex-wrap:wrap }
    .asset-row.returned{ opacity:.7 }
    .asset-info        { display:flex;align-items:center;gap:8px;flex:1 }
    .asset-type-badge  { font-size:11px;font-weight:600;background:var(--color-primary-light,#E0EEF2);color:var(--color-primary,#1C4E5C);padding:2px 8px;border-radius:999px }
    .asset-desc        { font-size:13px;font-weight:500 }
    .asset-dates       { display:flex;flex-direction:column;gap:2px;font-size:12px }
    .inline-form       { background:var(--color-bg-secondary,#F8FAFC);border:1px solid var(--color-border);border-radius:10px;padding:16px;margin-top:14px }
    .form-grid-2       { display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px }
    .field-full        { grid-column:1/-1 }
    .inline-form-actions { display:flex;gap:8px }
    .inline-error      { font-size:12px;color:#DC2626;margin:8px 0 0 }
    .form-label        { display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--color-text-muted);margin-bottom:4px }
    .form-input        { width:100%;padding:8px 12px;border:1px solid var(--color-border,#E0E7E9);border-radius:8px;font-size:13px;font-family:inherit;background:var(--color-surface,#fff);color:var(--color-text,#1A1C1E);outline:none;box-sizing:border-box;transition:border .15s }
    .form-input:focus  { border-color:var(--color-primary,#1C4E5C) }
    .form-textarea     { resize:vertical }
    .reasons-checkboxes { display:flex;flex-wrap:wrap;gap:10px }
    .cb-label          { display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer }
    .modal-task-name   { font-weight:600;font-size:14px;margin:0 0 14px }
    .modal-body-text   { font-size:14px;color:var(--color-text);margin:0 0 14px;line-height:1.5 }
    .modal-field       { margin-top:8px }
    @media(max-width:600px) { .form-grid-2 { grid-template-columns:1fr } .interview-grid { grid-template-columns:1fr } }
  `],
})
export class WorkflowDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private svc   = inject(LifecycleService);

  workflowId = 0;

  // ── State ──────────────────────────────────────────────────────────────────
  loading           = signal(true);
  wf                = signal<OffboardingWorkflowInstance | null>(null);
  tasks             = signal<OffboardingTask[]>([]);
  interview         = signal<ExitInterview | null>(null);
  interviewLoading  = signal(false);
  assets            = signal<OffboardingAssetReturn[]>([]);
  assetsLoading     = signal(false);
  syncingAssets     = signal(false);

  // ── Modal state ────────────────────────────────────────────────────────────
  showCompleteModal     = signal(false);
  showSkipModal         = signal(false);
  showValidateModal     = signal(false);
  showCancelModal       = signal(false);
  showConfirmAssetModal = signal(false);
  showInterviewForm     = signal(false);
  showAssetForm         = signal(false);

  activeTask  = signal<OffboardingTask | null>(null);
  activeAsset = signal<OffboardingAssetReturn | null>(null);

  // ── Form fields ────────────────────────────────────────────────────────────
  taskComment    = '';
  skipReason     = '';
  cancelReason   = '';
  assetCondition = '';
  ivDate         = '';
  ivFeedback     = '';
  ivReasons:     DepartureReason[] = [];
  assetDesc      = '';
  assetType:     AssetType = 'IT';
  assetExpectedDate = '';

  // ── Loading flags ──────────────────────────────────────────────────────────
  actioning      = signal(false);
  validating     = signal(false);
  cancelling     = signal(false);
  savingInterview= signal(false);
  interviewError = signal<string | null>(null);
  savingAsset    = signal(false);
  assetError     = signal<string | null>(null);
  confirmingAsset= signal(false);

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly progressPct = computed(() => computeProgress(this.tasks()));
  readonly doneTasks   = computed(() => this.tasks().filter(t => t.status === 'DONE' || t.status === 'SKIPPED').length);
  readonly canValidate = computed(() => {
    const blocking = this.tasks().filter(t => t.isBlocking && t.status !== 'DONE' && t.status !== 'SKIPPED');
    return blocking.length === 0 && this.tasks().length > 0;
  });
  readonly isTerminal  = computed(() => {
    const w = this.wf();
    return !!w && isTerminal(w.status);
  });

  // ── Table config ───────────────────────────────────────────────────────────
  readonly taskColumns: TableColumn[] = [
    { key: 'taskLabel',  label: 'Tâche' },
    { key: 'ownerRole',  label: 'Responsable',  width: '160px' },
    { key: 'status',     label: 'Statut',        width: '130px' },
    { key: 'sla',        label: 'Échéance / SLA',width: '130px' },
    { key: 'blocking',   label: 'Type',          width: '110px' },
    { key: 'actions',    label: '',              width: '160px' },
  ];
  readonly taskTableConfig: TableConfig = {};

  readonly taskRows = computed<TableRow[]>(() =>
    this.tasks().map(t => ({
      taskLabel: t.taskLabel,
      ownerRole: t.ownerRole,
      status:    '',
      sla:       '',
      blocking:  '',
      actions:   '',
      _status:   t.status,
      _dueDate:  this.fmt(t.dueDate),
      _slaBreached: !!t.slaBreachDate,
      _blocking: t.isBlocking,
      _task:     t,
    })),
  );

  // ── Constants for template ─────────────────────────────────────────────────
  protected readonly DEPARTURE_REASONS        = DEPARTURE_REASONS;
  protected readonly DEPARTURE_REASON_LABELS  = DEPARTURE_REASON_LABELS;
  protected readonly ASSET_TYPE_LABELS        = ASSET_TYPE_LABELS;
  protected readonly ASSET_TYPES              = ASSET_TYPES;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.workflowId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadWorkflow();
    this.loadInterview();
    this.loadAssets();
  }

  private loadWorkflow(): void {
    this.loading.set(true);
    this.svc.getOffboarding(this.workflowId).pipe(catchError(() => of(null))).subscribe(w => {
      this.wf.set(w);
      this.tasks.set(w?.tasks ?? []);
      this.loading.set(false);
    });
  }

  private loadInterview(): void {
    this.interviewLoading.set(true);
    this.svc.getExitInterview(this.workflowId).pipe(
      catchError(err => err?.status === 404 ? of(null) : of(null)),
    ).subscribe(iv => {
      this.interview.set(iv);
      this.interviewLoading.set(false);
    });
  }

  private loadAssets(): void {
    this.assetsLoading.set(true);
    this.svc.getAssets(this.workflowId).pipe(catchError(() => of([]))).subscribe(list => {
      this.assets.set(list);
      this.assetsLoading.set(false);
    });
  }

  syncAssetsFromIt(): void {
    this.syncingAssets.set(true);
    this.svc.syncAssetsFromIt(this.workflowId).pipe(catchError(() => of([]))).subscribe(list => {
      this.assets.set(list);
      this.syncingAssets.set(false);
    });
  }

  // ── Task actions ───────────────────────────────────────────────────────────
  openCompleteModal(task: OffboardingTask): void {
    this.activeTask.set(task);
    this.taskComment = '';
    this.showCompleteModal.set(true);
  }

  openSkipModal(task: OffboardingTask): void {
    this.activeTask.set(task);
    this.skipReason = '';
    this.showSkipModal.set(true);
  }

  confirmComplete(): void {
    const task = this.activeTask();
    if (!task) return;
    this.actioning.set(true);
    this.svc.completeTask(task.id, { comments: this.taskComment || undefined })
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        this.actioning.set(false);
        this.showCompleteModal.set(false);
        if (updated) this.tasks.update(list => list.map(t => t.id === updated.id ? updated : t));
      });
  }

  confirmSkip(): void {
    const task = this.activeTask();
    if (!task || !this.skipReason.trim()) return;
    this.actioning.set(true);
    this.svc.skipTask(task.id, this.skipReason)
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        this.actioning.set(false);
        this.showSkipModal.set(false);
        if (updated) this.tasks.update(list => list.map(t => t.id === updated.id ? updated : t));
      });
  }

  // ── Validate / Cancel ──────────────────────────────────────────────────────
  confirmValidate(): void {
    this.validating.set(true);
    this.svc.validateOffboarding(this.workflowId)
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        this.validating.set(false);
        this.showValidateModal.set(false);
        if (updated) this.wf.set(updated);
      });
  }

  confirmCancel(): void {
    this.cancelling.set(true);
    this.svc.cancelOffboarding(this.workflowId, this.cancelReason)
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        this.cancelling.set(false);
        this.showCancelModal.set(false);
        if (updated) this.wf.set(updated);
      });
  }

  // ── Exit interview ─────────────────────────────────────────────────────────
  toggleReason(r: DepartureReason, e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    this.ivReasons = checked
      ? [...this.ivReasons, r]
      : this.ivReasons.filter(x => x !== r);
  }

  saveInterview(): void {
    if (!this.ivDate) return;
    this.savingInterview.set(true);
    this.interviewError.set(null);
    this.svc.saveExitInterview(this.workflowId, {
      conductedDate:    this.ivDate,
      departureReasons: this.ivReasons,
      feedbackText:     this.ivFeedback || null,
    }).pipe(
      catchError(err => {
        this.interviewError.set(err?.error?.message ?? 'Erreur lors de l\'enregistrement');
        this.savingInterview.set(false);
        return of(null);
      }),
    ).subscribe(iv => {
      this.savingInterview.set(false);
      if (iv) {
        this.interview.set(iv);
        this.showInterviewForm.set(false);
        // also refresh tasks (EXIT_INTERVIEW task may have been auto-completed)
        this.loadWorkflow();
      }
    });
  }

  // ── Asset returns ──────────────────────────────────────────────────────────
  saveAsset(): void {
    if (!this.assetDesc.trim() || !this.assetExpectedDate) return;
    this.savingAsset.set(true);
    this.assetError.set(null);
    this.svc.addAsset(this.workflowId, {
      workflowInstanceId: this.workflowId,
      assetDescription:   this.assetDesc,
      assetType:          this.assetType,
      expectedReturnDate: this.assetExpectedDate,
    }).pipe(
      catchError(err => {
        this.assetError.set(err?.error?.message ?? 'Erreur lors de l\'ajout');
        this.savingAsset.set(false);
        return of(null);
      }),
    ).subscribe(asset => {
      this.savingAsset.set(false);
      if (asset) {
        this.assets.update(list => [...list, asset]);
        this.showAssetForm.set(false);
        this.assetDesc = '';
        this.assetExpectedDate = '';
        this.assetType = 'IT';
      }
    });
  }

  openConfirmAsset(a: OffboardingAssetReturn): void {
    this.activeAsset.set(a);
    this.assetCondition = '';
    this.showConfirmAssetModal.set(true);
  }

  confirmAssetReturn(): void {
    const asset = this.activeAsset();
    if (!asset) return;
    this.confirmingAsset.set(true);
    this.svc.confirmAssetReturn(asset.id, this.assetCondition)
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        this.confirmingAsset.set(false);
        this.showConfirmAssetModal.set(false);
        if (updated) this.assets.update(list => list.map(a => a.id === updated.id ? updated : a));
      });
  }

  // ── Badge helpers ──────────────────────────────────────────────────────────
  statusLabel(s: string): string       { return OFFBOARDING_STATUS_LABELS[s as keyof typeof OFFBOARDING_STATUS_LABELS] ?? s; }
  statusVariant(s: string): BadgeVariant {
    const map: Record<string, BadgeVariant> = {
      PENDING:'neutral', IN_PROGRESS:'teal', BLOCKED:'danger', VALIDATED:'success', CANCELLED:'neutral', ARCHIVED:'neutral',
    };
    return map[s] ?? 'neutral';
  }
  reasonLabel(r: string): string       { return DEPARTURE_REASON_LABELS[r as DepartureReason] ?? r; }
  taskStatusLabel(s: string): string   { return TASK_STATUS_LABELS[s] ?? s; }
  taskStatusVariant(s: string): BadgeVariant { return TASK_STATUS_VARIANTS[s] ?? 'neutral'; }
  parseReasons(json: string): string {
    try { return (JSON.parse(json) as string[]).map(r => DEPARTURE_REASON_LABELS[r as DepartureReason] ?? r).join(', '); }
    catch { return json; }
  }
  fmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return iso; }
  }
}
