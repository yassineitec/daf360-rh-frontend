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
  DEPARTURE_REASONS, DepartureReason,
  computeProgress, isTerminal,
} from './models/lifecycle.model';
import {
  StatusBadgeComponent, BadgeOptions, ButtonComponent,
  CardComponent, DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SpinnerComponent } from '../../shared/spinner.component';
import { ModalComponent }   from '../../shared/modal.component';
import { UserStore } from '../../core/user.store';
import { NotificationService } from '../../core/notification.service';

type BadgeVariant = BadgeOptions['variant'];

const TASK_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  PENDING:    'neutral',
  IN_PROGRESS:'teal',
  DONE:       'success',
  BLOCKED:    'danger',
  SKIPPED:    'neutral',
};
const ASSET_TYPES: AssetType[] = ['IT', 'BADGE', 'VEHICLE', 'OTHER'];

@Component({
  selector: 'app-workflow-detail',
  standalone: true,
  imports: [
    FormsModule, RouterLink,
    StatusBadgeComponent, ButtonComponent, CardComponent,
    DataTableComponent, DafCellDirective,
    SpinnerComponent, ModalComponent, TranslatePipe,
  ],
  template: `
    <!-- Breadcrumb -->
    <nav class="breadcrumb">
      <a routerLink="/rh/lifecycle" class="bc-link">{{ 'LIFECYCLE.DETAIL.BREADCRUMB' | translate }}</a>
      <span class="bc-sep">›</span>
      <span class="bc-current">{{ 'LIFECYCLE.DETAIL.FILE' | translate:{ id: workflowId } }}</span>
    </nav>

    @if (loading()) {
      <div class="center-spin"><app-spinner size="lg" /></div>
    } @else if (!wf()) {
      <div class="error-state"><p>{{ 'LIFECYCLE.DETAIL.NOT_FOUND' | translate }}</p><a routerLink="/rh/lifecycle" class="btn-back">{{ 'LIFECYCLE.DETAIL.BACK' | translate }}</a></div>
    } @else {

      <!-- SLA / blocked banner -->
      @if (wf()!.slaBreachFlag || wf()!.status === 'BLOCKED') {
        <div class="alert-banner alert-danger">
          <span class="material-symbols-outlined">warning</span>
          @if (wf()!.slaBreachFlag) { <span>{{ 'LIFECYCLE.DETAIL.ALERT_SLA' | translate }}</span> }
          @else { <span>{{ 'LIFECYCLE.DETAIL.ALERT_BLOCKED' | translate }}</span> }
        </div>
      }

      <!-- Header -->
      <daf-card [options]="{ padding: 'lg', radius: 'xl' }" class="block wf-header">
        <div class="header-row">
          <div class="header-meta">
            <h1 class="wf-title">{{ 'LIFECYCLE.DETAIL.TITLE' | translate:{ name: employeeName() } }}</h1>
            <div class="header-chips">
              <daf-badge [label]="statusLabel(wf()!.status)" [options]="{ variant: statusVariant(wf()!.status), size: 'sm' }" />
              <daf-badge [label]="reasonLabel(wf()!.departureReason)" [options]="{ variant: 'neutral', size: 'sm' }" />
              @if (wf()!.slaBreachFlag) {
                <daf-badge [label]="'LIFECYCLE.BADGE.SLA_BREACHED' | translate" [options]="{ variant: 'danger', size: 'sm' }" />
              }
            </div>
          </div>
          <!-- Action buttons (mutations gated on RH_MANAGE_LIFECYCLE) -->
          @if (!isTerminal() && canManage()) {
            <div class="header-actions">
              @if (canValidate()) {
                <daf-button [label]="'LIFECYCLE.DETAIL.VALIDATE' | translate" variant="teal" [options]="{ iconStart: 'check_circle', loading: validating() }" (onClick)="showValidateModal.set(true)" />
              }
              <daf-button [label]="'LIFECYCLE.DETAIL.CANCEL' | translate" variant="danger" [options]="{ iconStart: 'cancel', loading: cancelling() }" (onClick)="showCancelModal.set(true)" />
            </div>
          }
        </div>

        <!-- Key dates -->
        <div class="dates-row">
          <div class="date-item">
            <span class="date-label">{{ 'LIFECYCLE.DETAIL.DATE_TRIGGER' | translate }}</span>
            <span class="date-val">{{ fmt(wf()!.triggerDate) }}</span>
          </div>
          @if (wf()!.lastWorkingDay) {
            <div class="date-item">
              <span class="date-label">{{ 'LIFECYCLE.DETAIL.DATE_LAST_DAY' | translate }}</span>
              <span class="date-val">{{ fmt(wf()!.lastWorkingDay) }}</span>
            </div>
          }
          @if (wf()!.validatedAt) {
            <div class="date-item">
              <span class="date-label">{{ 'LIFECYCLE.DETAIL.DATE_VALIDATED' | translate }}</span>
              <span class="date-val">{{ fmt(wf()!.validatedAt) }}</span>
            </div>
          }
          @if (wf()!.cancelledAt) {
            <div class="date-item">
              <span class="date-label">{{ 'LIFECYCLE.DETAIL.DATE_CANCELLED' | translate }}</span>
              <span class="date-val">{{ fmt(wf()!.cancelledAt) }}</span>
            </div>
          }
          @if (wf()!.handoverManagerName) {
            <div class="date-item">
              <span class="date-label">{{ 'LIFECYCLE.DETAIL.HANDOVER_MANAGER' | translate }}</span>
              <span class="date-val">{{ wf()!.handoverManagerName }}</span>
            </div>
          }
        </div>

        @if (wf()!.cancellationReason) {
          <p class="cancel-reason"><strong>{{ 'LIFECYCLE.DETAIL.CANCEL_REASON_LABEL' | translate }}</strong> {{ wf()!.cancellationReason }}</p>
        }
        @if (wf()!.departureNotes) {
          <p class="notes-text"><strong>{{ 'LIFECYCLE.DETAIL.NOTES_LABEL' | translate }}</strong> {{ wf()!.departureNotes }}</p>
        }

        <!-- Progress bar -->
        @if (tasks().length > 0) {
          <div class="progress-section">
            <div class="progress-label">
              <span>{{ 'LIFECYCLE.DETAIL.PROGRESS_TITLE' | translate }}</span>
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
        <h2 class="section-title">{{ 'LIFECYCLE.DETAIL.TASKS_TITLE' | translate }}</h2>
        @if (tasks().length === 0) {
          <p class="section-empty">{{ 'LIFECYCLE.DETAIL.TASKS_EMPTY' | translate }}</p>
        } @else {
          <daf-data-table [columns]="taskColumns()" [rows]="taskRows()" [config]="taskTableConfig">

            <ng-template dafCell="status" let-row>
              <daf-badge
                [label]="taskStatusLabel(row['_status'])"
                [options]="{ variant: taskStatusVariant(row['_status']), size: 'sm' }"
              />
            </ng-template>

            <ng-template dafCell="sla" let-row>
              @if (row['_slaBreached']) {
                <daf-badge [label]="'LIFECYCLE.BADGE.SLA_BREACHED' | translate" [options]="{ variant: 'danger', size: 'sm' }" />
              } @else if (row['_dueDate']) {
                <span class="date-muted">{{ row['_dueDate'] }}</span>
              } @else {
                <span class="cell-muted">—</span>
              }
            </ng-template>

            <ng-template dafCell="blocking" let-row>
              @if (row['_blocking']) {
                <daf-badge [label]="'LIFECYCLE.BADGE.BLOCKING' | translate" [options]="{ variant: 'warning', size: 'sm' }" />
              } @else {
                <span class="cell-muted">—</span>
              }
            </ng-template>

            <ng-template dafCell="actions" let-row>
              @if (row['_status'] !== 'DONE' && row['_status'] !== 'SKIPPED' && !isTerminal() && canManage()) {
                <div class="row-actions">
                  <daf-button [label]="'LIFECYCLE.DETAIL.COMPLETE' | translate" variant="teal" [options]="{ size: 'sm' }" (onClick)="openCompleteModal(row['_task'])" />
                  @if (!row['_blocking']) {
                    <daf-button [label]="'LIFECYCLE.DETAIL.SKIP' | translate" variant="ghost" [options]="{ size: 'sm' }" (onClick)="openSkipModal(row['_task'])" />
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
          <h2 class="section-title">{{ 'LIFECYCLE.DETAIL.INTERVIEW_TITLE' | translate }}</h2>
          @if (!interview() && !isTerminal() && canManage()) {
            <daf-button [label]="'LIFECYCLE.DETAIL.INTERVIEW_ADD' | translate" variant="secondary" [options]="{ size: 'sm', iconStart: 'add' }" (onClick)="showInterviewForm.set(true)" />
          }
        </div>

        @if (interviewLoading()) {
          <app-spinner size="sm" />
        } @else if (interview()) {
          <div class="interview-card">
            @if (interview()!.isAnonymised) {
              <p class="anon-notice">{{ 'LIFECYCLE.DETAIL.INTERVIEW_ANON' | translate }}</p>
            } @else {
              <div class="interview-grid">
                <div>
                  <span class="meta-label">{{ 'LIFECYCLE.DETAIL.INTERVIEW_DATE' | translate }}</span>
                  <span class="meta-val">{{ fmt(interview()!.conductedDate) }}</span>
                </div>
                @if (interview()!.departureReasons) {
                  <div>
                    <span class="meta-label">{{ 'LIFECYCLE.DETAIL.INTERVIEW_REASONS' | translate }}</span>
                    <span class="meta-val">{{ parseReasons(interview()!.departureReasons) }}</span>
                  </div>
                }
              </div>
              @if (interview()!.feedbackText) {
                <div class="feedback-text">
                  <span class="meta-label">{{ 'LIFECYCLE.DETAIL.INTERVIEW_FEEDBACK' | translate }}</span>
                  <p>{{ interview()!.feedbackText }}</p>
                </div>
              }
            }
          </div>
        } @else if (!showInterviewForm()) {
          <p class="section-empty">{{ 'LIFECYCLE.DETAIL.INTERVIEW_EMPTY' | translate }}</p>
        }

        @if (showInterviewForm() && canManage()) {
          <div class="inline-form">
            <div class="form-grid-2">
              <div>
                <label class="form-label">{{ 'LIFECYCLE.DETAIL.IV_DATE_LABEL' | translate }}</label>
                <input class="form-input" type="date" [(ngModel)]="ivDate" />
              </div>
              <div class="field-full">
                <label class="form-label">{{ 'LIFECYCLE.DETAIL.IV_REASONS_LABEL' | translate }}</label>
                <div class="reasons-checkboxes">
                  @for (r of DEPARTURE_REASONS; track r) {
                    <label class="cb-label">
                      <input type="checkbox" [checked]="ivReasons.includes(r)" (change)="toggleReason(r, $event)" />
                      {{ 'LIFECYCLE.REASON.' + r | translate }}
                    </label>
                  }
                </div>
              </div>
              <div class="field-full">
                <label class="form-label">{{ 'LIFECYCLE.DETAIL.IV_FEEDBACK_LABEL' | translate }}</label>
                <textarea class="form-input form-textarea" rows="3" [(ngModel)]="ivFeedback" [placeholder]="'LIFECYCLE.DETAIL.IV_FEEDBACK_PH' | translate"></textarea>
              </div>
            </div>
            <div class="inline-form-actions">
              <daf-button [label]="'LIFECYCLE.DETAIL.SAVE' | translate" variant="teal" [options]="{ loading: savingInterview() }" (onClick)="saveInterview()" />
              <daf-button [label]="'LIFECYCLE.DETAIL.CANCEL' | translate" variant="ghost" (onClick)="showInterviewForm.set(false)" />
            </div>
            @if (interviewError()) { <p class="inline-error">{{ interviewError() }}</p> }
          </div>
        }
      </section>

      <!-- ── Asset returns ──────────────────────────────────────────────────── -->
      <section class="detail-section">
        <div class="section-header-row">
          <h2 class="section-title">{{ 'LIFECYCLE.DETAIL.ASSETS_TITLE' | translate }}</h2>
          <div class="section-actions">
            @if (!isTerminal() && canManage()) {
              <daf-button [label]="'LIFECYCLE.DETAIL.ASSETS_SYNC' | translate" variant="ghost"
                [options]="{ size: 'sm', iconStart: 'sync', loading: syncingAssets() }"
                (onClick)="syncAssetsFromIt()" />
              <daf-button [label]="'LIFECYCLE.DETAIL.ASSETS_ADD' | translate" variant="secondary"
                [options]="{ size: 'sm', iconStart: 'add' }"
                (onClick)="showAssetForm.set(true)" />
            }
          </div>
        </div>

        @if (assetsLoading()) {
          <app-spinner size="sm" />
        } @else if (assets().length === 0 && !showAssetForm()) {
          <p class="section-empty">{{ 'LIFECYCLE.DETAIL.ASSETS_EMPTY' | translate }}</p>
        }

        @if (assets().length > 0) {
          <div class="asset-list">
            @for (a of assets(); track a.id) {
              <div class="asset-row" [class.returned]="!!a.actualReturnDate">
                <div class="asset-info">
                  <span class="asset-type-badge">{{ 'LIFECYCLE.ASSET_TYPE.' + a.assetType | translate }}</span>
                  <span class="asset-desc">{{ a.assetDescription }}</span>
                </div>
                <div class="asset-dates">
                  <span class="meta-label">{{ 'LIFECYCLE.DETAIL.ASSET_EXPECTED' | translate }}</span>
                  <span>{{ fmt(a.expectedReturnDate) }}</span>
                </div>
                @if (a.actualReturnDate) {
                  <div class="asset-dates">
                    <span class="meta-label">{{ 'LIFECYCLE.DETAIL.ASSET_RETURNED_ON' | translate }}</span>
                    <span>{{ fmt(a.actualReturnDate) }}</span>
                  </div>
                  <daf-badge [label]="'LIFECYCLE.BADGE.RETURNED' | translate" [options]="{ variant: 'success', size: 'sm' }" />
                } @else if (!isTerminal() && canManage()) {
                  <daf-button [label]="'LIFECYCLE.DETAIL.CONFIRM_RETURN' | translate" variant="secondary" [options]="{ size: 'sm' }" (onClick)="openConfirmAsset(a)" />
                } @else {
                  <daf-badge [label]="'LIFECYCLE.BADGE.NOT_RETURNED' | translate" [options]="{ variant: 'warning', size: 'sm' }" />
                }
              </div>
            }
          </div>
        }

        @if (showAssetForm() && canManage()) {
          <div class="inline-form">
            <div class="form-grid-2">
              <div class="field-full">
                <label class="form-label">{{ 'LIFECYCLE.DETAIL.ASSET_DESC_LABEL' | translate }}</label>
                <input class="form-input" type="text" [(ngModel)]="assetDesc" [placeholder]="'LIFECYCLE.DETAIL.ASSET_DESC_PH' | translate" />
              </div>
              <div>
                <label class="form-label">{{ 'LIFECYCLE.DETAIL.ASSET_TYPE_LABEL' | translate }}</label>
                <select class="form-input" [(ngModel)]="assetType">
                  @for (t of ASSET_TYPES; track t) {
                    <option [value]="t">{{ 'LIFECYCLE.ASSET_TYPE.' + t | translate }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="form-label">{{ 'LIFECYCLE.DETAIL.ASSET_EXPECTED_LABEL' | translate }}</label>
                <input class="form-input" type="date" [(ngModel)]="assetExpectedDate" />
              </div>
            </div>
            <div class="inline-form-actions">
              <daf-button [label]="'LIFECYCLE.DETAIL.ADD' | translate" variant="teal" [options]="{ loading: savingAsset() }" (onClick)="saveAsset()" />
              <daf-button [label]="'LIFECYCLE.DETAIL.CANCEL' | translate" variant="ghost" (onClick)="showAssetForm.set(false)" />
            </div>
            @if (assetError()) { <p class="inline-error">{{ assetError() }}</p> }
          </div>
        }
      </section>

    }

    <!-- ── Complete task modal ─────────────────────────────────────────────── -->
    <app-modal [title]="'LIFECYCLE.MODAL.COMPLETE_TITLE' | translate" [visible]="showCompleteModal()" [hasFooter]="true" (closed)="showCompleteModal.set(false)">
      @if (activeTask()) {
        <p class="modal-task-name">{{ activeTask()!.taskLabel }}</p>
      }
      <div class="modal-field">
        <label class="form-label">{{ 'LIFECYCLE.MODAL.COMMENT_LABEL' | translate }}</label>
        <textarea class="form-input form-textarea" rows="3" [(ngModel)]="taskComment" [placeholder]="'LIFECYCLE.MODAL.COMMENT_PH' | translate"></textarea>
      </div>
      <div slot="footer">
        <daf-button [label]="'LIFECYCLE.MODAL.COMMON_CANCEL' | translate" variant="secondary" (onClick)="showCompleteModal.set(false)" />
        <daf-button [label]="'LIFECYCLE.MODAL.MARK_DONE' | translate" variant="teal" [options]="{ loading: actioning() }" (onClick)="confirmComplete()" />
      </div>
    </app-modal>

    <!-- ── Skip task modal ────────────────────────────────────────────────── -->
    <app-modal [title]="'LIFECYCLE.MODAL.SKIP_TITLE' | translate" [visible]="showSkipModal()" [hasFooter]="true" (closed)="showSkipModal.set(false)">
      @if (activeTask()) {
        <p class="modal-task-name">{{ activeTask()!.taskLabel }}</p>
      }
      <div class="modal-field">
        <label class="form-label">{{ 'LIFECYCLE.MODAL.SKIP_REASON_LABEL' | translate }}</label>
        <textarea class="form-input form-textarea" rows="3" [(ngModel)]="skipReason" [placeholder]="'LIFECYCLE.MODAL.SKIP_REASON_PH' | translate"></textarea>
      </div>
      <div slot="footer">
        <daf-button [label]="'LIFECYCLE.MODAL.COMMON_CANCEL' | translate" variant="secondary" (onClick)="showSkipModal.set(false)" />
        <daf-button [label]="'LIFECYCLE.MODAL.SKIP_CONFIRM' | translate" variant="danger" [options]="{ loading: actioning(), disabled: !skipReason.trim() }" (onClick)="confirmSkip()" />
      </div>
    </app-modal>

    <!-- ── Validate modal ─────────────────────────────────────────────────── -->
    <app-modal [title]="'LIFECYCLE.MODAL.VALIDATE_TITLE' | translate" [visible]="showValidateModal()" [hasFooter]="true" (closed)="showValidateModal.set(false)">
      <p class="modal-body-text">{{ 'LIFECYCLE.MODAL.VALIDATE_BODY' | translate }}</p>
      <div slot="footer">
        <daf-button [label]="'LIFECYCLE.MODAL.COMMON_CANCEL' | translate" variant="secondary" (onClick)="showValidateModal.set(false)" />
        <daf-button [label]="'LIFECYCLE.MODAL.VALIDATE_CONFIRM' | translate" variant="teal" [options]="{ loading: validating() }" (onClick)="confirmValidate()" />
      </div>
    </app-modal>

    <!-- ── Cancel modal ───────────────────────────────────────────────────── -->
    <app-modal [title]="'LIFECYCLE.MODAL.CANCEL_TITLE' | translate" [visible]="showCancelModal()" [hasFooter]="true" (closed)="showCancelModal.set(false)">
      <p class="modal-body-text">{{ 'LIFECYCLE.MODAL.CANCEL_BODY' | translate }}</p>
      <div class="modal-field">
        <label class="form-label">{{ 'LIFECYCLE.MODAL.CANCEL_REASON_LABEL' | translate }}</label>
        <textarea class="form-input form-textarea" rows="3" [(ngModel)]="cancelReason" [placeholder]="'LIFECYCLE.MODAL.CANCEL_REASON_PH' | translate"></textarea>
      </div>
      <div slot="footer">
        <daf-button [label]="'LIFECYCLE.MODAL.CANCEL_KEEP' | translate" variant="secondary" (onClick)="showCancelModal.set(false)" />
        <daf-button [label]="'LIFECYCLE.MODAL.CANCEL_CONFIRM' | translate" variant="danger" [options]="{ loading: cancelling() }" (onClick)="confirmCancel()" />
      </div>
    </app-modal>

    <!-- ── Confirm asset return modal ─────────────────────────────────────── -->
    <app-modal [title]="'LIFECYCLE.MODAL.ASSET_TITLE' | translate" [visible]="showConfirmAssetModal()" [hasFooter]="true" (closed)="showConfirmAssetModal.set(false)">
      @if (activeAsset()) {
        <p class="modal-task-name">{{ activeAsset()!.assetDescription }}</p>
      }
      <div class="modal-field">
        <label class="form-label">{{ 'LIFECYCLE.MODAL.ASSET_CONDITION_LABEL' | translate }}</label>
        <input class="form-input" type="text" [(ngModel)]="assetCondition" [placeholder]="'LIFECYCLE.MODAL.ASSET_CONDITION_PH' | translate" />
      </div>
      <div slot="footer">
        <daf-button [label]="'LIFECYCLE.MODAL.COMMON_CANCEL' | translate" variant="secondary" (onClick)="showConfirmAssetModal.set(false)" />
        <daf-button [label]="'LIFECYCLE.MODAL.ASSET_CONFIRM' | translate" variant="teal" [options]="{ loading: confirmingAsset() }" (onClick)="confirmAssetReturn()" />
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
  private route     = inject(ActivatedRoute);
  private svc       = inject(LifecycleService);
  private translate = inject(TranslateService);
  private userStore = inject(UserStore);
  private notify    = inject(NotificationService);

  workflowId = 0;

  /** Only RH_MANAGE_LIFECYCLE holders may run mutating actions. */
  readonly canManage = computed(() => this.userStore.hasPermission('RH_MANAGE_LIFECYCLE'));

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
  readonly employeeName = computed(() => {
    const w = this.wf();
    return w?.employeeFullName
      ?? this.translate.instant('LIFECYCLE.DASHBOARD.PROFILE_PREFIX', { id: w?.employeeProfileId });
  });

  // ── Table config ───────────────────────────────────────────────────────────
  readonly taskColumns = computed<TableColumn[]>(() => [
    { key: 'taskLabel',  label: this.translate.instant('LIFECYCLE.DETAIL.COL_TASK') },
    { key: 'ownerRole',  label: this.translate.instant('LIFECYCLE.DETAIL.COL_OWNER'),  width: '160px' },
    { key: 'status',     label: this.translate.instant('LIFECYCLE.DETAIL.COL_STATUS'), width: '130px' },
    { key: 'sla',        label: this.translate.instant('LIFECYCLE.DETAIL.COL_SLA'),    width: '130px' },
    { key: 'blocking',   label: this.translate.instant('LIFECYCLE.DETAIL.COL_TYPE'),   width: '110px' },
    { key: 'actions',    label: '',                                                    width: '160px' },
  ]);
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
  protected readonly DEPARTURE_REASONS = DEPARTURE_REASONS;
  protected readonly ASSET_TYPES       = ASSET_TYPES;

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
    this.svc.syncAssetsFromIt(this.workflowId).pipe(
      catchError(() => {
        this.notify.error(this.translate.instant('LIFECYCLE.TOAST.ASSET_SYNC_ERR'));
        this.syncingAssets.set(false);
        return of(null);
      }),
    ).subscribe(list => {
      if (list) {
        this.assets.set(list);
        this.notify.success(this.translate.instant('LIFECYCLE.TOAST.ASSET_SYNCED'));
      }
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
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('LIFECYCLE.TOAST.TASK_DONE_ERR'));
        this.actioning.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.actioning.set(false);
        this.showCompleteModal.set(false);
        if (updated) {
          this.tasks.update(list => list.map(t => t.id === updated.id ? updated : t));
          this.notify.success(this.translate.instant('LIFECYCLE.TOAST.TASK_DONE'));
        }
      });
  }

  confirmSkip(): void {
    const task = this.activeTask();
    if (!task || !this.skipReason.trim()) return;
    this.actioning.set(true);
    this.svc.skipTask(task.id, this.skipReason)
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('LIFECYCLE.TOAST.TASK_SKIP_ERR'));
        this.actioning.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.actioning.set(false);
        this.showSkipModal.set(false);
        if (updated) {
          this.tasks.update(list => list.map(t => t.id === updated.id ? updated : t));
          this.notify.success(this.translate.instant('LIFECYCLE.TOAST.TASK_SKIPPED'));
        }
      });
  }

  // ── Validate / Cancel ──────────────────────────────────────────────────────
  confirmValidate(): void {
    this.validating.set(true);
    this.svc.validateOffboarding(this.workflowId)
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('LIFECYCLE.TOAST.VALIDATE_ERR'));
        this.validating.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.validating.set(false);
        this.showValidateModal.set(false);
        if (updated) {
          this.wf.set(updated);
          this.notify.success(this.translate.instant('LIFECYCLE.TOAST.VALIDATED'));
        }
      });
  }

  confirmCancel(): void {
    this.cancelling.set(true);
    this.svc.cancelOffboarding(this.workflowId, this.cancelReason)
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('LIFECYCLE.TOAST.CANCEL_ERR'));
        this.cancelling.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.cancelling.set(false);
        this.showCancelModal.set(false);
        if (updated) {
          this.wf.set(updated);
          this.notify.success(this.translate.instant('LIFECYCLE.TOAST.CANCELLED'));
        }
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
        const msg = err?.error?.message ?? this.translate.instant('LIFECYCLE.TOAST.INTERVIEW_ERR');
        this.interviewError.set(msg);
        this.notify.error(msg);
        this.savingInterview.set(false);
        return of(null);
      }),
    ).subscribe(iv => {
      this.savingInterview.set(false);
      if (iv) {
        this.interview.set(iv);
        this.showInterviewForm.set(false);
        this.notify.success(this.translate.instant('LIFECYCLE.TOAST.INTERVIEW_SAVED'));
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
        const msg = err?.error?.message ?? this.translate.instant('LIFECYCLE.TOAST.ASSET_ERR');
        this.assetError.set(msg);
        this.notify.error(msg);
        this.savingAsset.set(false);
        return of(null);
      }),
    ).subscribe(asset => {
      this.savingAsset.set(false);
      if (asset) {
        this.assets.update(list => [...list, asset]);
        this.showAssetForm.set(false);
        this.notify.success(this.translate.instant('LIFECYCLE.TOAST.ASSET_ADDED'));
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
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('LIFECYCLE.TOAST.ASSET_CONFIRM_ERR'));
        this.confirmingAsset.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.confirmingAsset.set(false);
        this.showConfirmAssetModal.set(false);
        if (updated) {
          this.assets.update(list => list.map(a => a.id === updated.id ? updated : a));
          this.notify.success(this.translate.instant('LIFECYCLE.TOAST.ASSET_CONFIRMED'));
        }
      });
  }

  // ── Badge helpers ──────────────────────────────────────────────────────────
  statusLabel(s: string): string       { return this.translate.instant('LIFECYCLE.STATUS.' + s); }
  statusVariant(s: string): BadgeVariant {
    const map: Record<string, BadgeVariant> = {
      PENDING:'neutral', IN_PROGRESS:'teal', BLOCKED:'danger', VALIDATED:'success', CANCELLED:'neutral', ARCHIVED:'neutral',
    };
    return map[s] ?? 'neutral';
  }
  reasonLabel(r: string): string       { return this.translate.instant('LIFECYCLE.REASON.' + r); }
  taskStatusLabel(s: string): string   { return this.translate.instant('LIFECYCLE.TASK_STATUS.' + s); }
  taskStatusVariant(s: string): BadgeVariant { return TASK_STATUS_VARIANTS[s] ?? 'neutral'; }
  parseReasons(json: string): string {
    try { return (JSON.parse(json) as string[]).map(r => this.translate.instant('LIFECYCLE.REASON.' + r)).join(', '); }
    catch { return json; }
  }
  fmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return iso; }
  }
}
