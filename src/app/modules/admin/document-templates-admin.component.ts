import {
  Component, computed, ElementRef, inject, input, OnDestroy, OnInit, signal, ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ClassicEditor,
  Essentials, Paragraph, Heading,
  Bold, Italic, Underline, Strikethrough,
  Alignment,
  FontSize,
  List, Indent, IndentBlock,
  Link,
  Table, TableToolbar,
  HorizontalLine,
  BlockQuote,
  GeneralHtmlSupport,
  Undo,
} from 'ckeditor5';
import type { EditorConfig } from 'ckeditor5';
import { CKEditorComponent, CKEditorModule } from '@ckeditor/ckeditor5-angular';

import { AdminService } from './admin.service';
import {
  DocumentTemplate, DocumentTemplateVersion, SaveDocumentTemplateRequest,
  TEMPLATE_CATEGORIES, VariableDef,
} from './models/admin.model';
import { ButtonComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  body        { font-family: Arial, sans-serif; margin: 50px; font-size: 14px; line-height: 1.8; color: #333; }
  .header     { text-align: center; margin-bottom: 40px; }
  .company    { font-size: 16px; font-weight: bold; }
  .title      { font-size: 18px; font-weight: bold; text-align: center; margin: 30px 0; text-transform: uppercase; text-decoration: underline; }
  .content    { margin: 20px 0; }
  .signature  { margin-top: 60px; text-align: right; }
  p           { margin: 10px 0; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">{{company.name}}</div>
  </div>

  <div class="title">Attestation de travail</div>

  <div class="content">
    <p>Je soussigné(e), <strong>{{company.dgName}}</strong>, {{company.dgTitle}},</p>
    <p>certifie que <strong>{{employee.fullName}}</strong> est employé(e) au sein de notre entreprise
    depuis le <strong>{{employee.startDate}}</strong>, en qualité de <strong>{{employee.position}}</strong>.</p>
    <p>La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.</p>
  </div>

  <div class="signature">
    <p>Tunis, le {{date.today}}</p>
    <br/><br/>
    <p>Le Directeur Général</p>
    <p><strong>{{company.dgName}}</strong></p>
  </div>
</body>
</html>`;

@Component({
  selector: 'app-document-templates-admin',
  standalone: true,
  imports: [FormsModule, CKEditorModule, ButtonComponent, StatusBadgeComponent, TranslatePipe],
  template: `
    <!-- Header -->
    <div class="tmpl-header">
      <div>
        <h3 class="section-title">{{ 'ADMIN.docs.templates.title' | translate }}</h3>
        <p class="section-sub">{{ 'ADMIN.docs.templates.subtitle' | translate }} ({{'{{'}}variable.clé{{'}}'}}).</p>
      </div>
      <daf-button class="desktop-only" [label]="'ADMIN.docs.templates.newTemplate' | translate" variant="teal" [options]="{ iconStart: 'add' }" (onClick)="openAdd()" />
      <daf-button class="icon-btn-toggle mobile-only" title="Nouvelle maquette" variant="teal" [options]="{ iconStart: 'add', size: 'sm' }" (onClick)="openAdd()" />
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <select class="filter-select" [(ngModel)]="filterCategory" (ngModelChange)="load()">
        <option value="">{{ 'ADMIN.docs.templates.allCategories' | translate }}</option>
        @for (c of TEMPLATE_CATEGORIES; track c) {
          <option [value]="c">{{ categoryLabel(c) }}</option>
        }
      </select>
      <label class="show-inactive-toggle">
        <input type="checkbox" [(ngModel)]="showInactive" (ngModelChange)="load()" />
        <span>{{ 'ADMIN.docs.templates.showInactive' | translate }}</span>
      </label>
    </div>

    <!-- List -->
    @if (loading()) {
      <div class="skeleton-wrap">
        @for (_ of [1,2,3]; track $index) { <div class="skeleton-row"></div> }
      </div>
    } @else if (rows().length === 0) {
      <div class="empty-state">
        <span class="material-symbols-outlined">description</span>
        <p>{{ 'ADMIN.docs.templates.empty' | translate }}</p>
      </div>
    } @else {
      <div class="tmpl-table">
        <div class="tmpl-head">
          <span class="col-name">{{ 'ADMIN.docs.templates.colName' | translate }}</span>
          <span class="col-cat">{{ 'ADMIN.docs.templates.colCategory' | translate }}</span>
          <span class="col-vars">{{ 'ADMIN.docs.templates.colVariables' | translate }}</span>
          <span class="col-status">{{ 'ADMIN.docs.templates.colStatus' | translate }}</span>
          <span class="col-actions"></span>
        </div>
        @for (t of rows(); track t.id) {
          <div class="tmpl-row" [class.inactive]="!t.isActive">
            <span class="col-name">
              <span class="tmpl-name">{{ t.name }}</span>
              @if (t.description) { <span class="tmpl-desc">{{ t.description }}</span> }
            </span>
            <span class="col-cat">
              <span class="cat-badge cat-{{ t.category.toLowerCase() }}">{{ categoryLabel(t.category) }}</span>
            </span>
            <span class="col-vars">
              @if (t.variables?.length) {
                <span class="var-count">{{ t.variables!.length }} {{ (t.variables!.length > 1 ? 'ADMIN.docs.templates.variablePlural' : 'ADMIN.docs.templates.variableSingular') | translate }}</span>
              } @else {
                <span class="no-vars">—</span>
              }
            </span>
            <span class="col-status">
              <daf-badge [label]="(t.isActive ? 'ADMIN.docs.templates.active' : 'ADMIN.docs.templates.inactive') | translate"
                [options]="{ variant: t.isActive ? 'success' : 'neutral', size: 'sm' }" />
            </span>
            <span class="col-actions">
              <button class="icon-btn" [title]="'ADMIN.docs.templates.edit' | translate" (click)="openEdit(t)">
                <span class="material-symbols-outlined">edit</span>
              </button>
              <button class="icon-btn" [title]="(t.isActive ? 'ADMIN.docs.templates.deactivate' : 'ADMIN.docs.templates.activate') | translate" (click)="toggleActive(t)">
                <span class="material-symbols-outlined">{{ t.isActive ? 'toggle_on' : 'toggle_off' }}</span>
              </button>
            </span>
          </div>
        }
      </div>
    }

    <!-- Create / Edit modal -->
    @if (showForm()) {
      <div class="modal-backdrop" (click)="closeForm()">
        <div class="modal-panel modal-xl" (click)="$event.stopPropagation()">

          <div class="modal-header">
            <h4>{{ (editingId() ? 'ADMIN.docs.templates.editTitle' : 'ADMIN.docs.templates.newTemplate') | translate }}</h4>
            <div class="modal-header-actions">
              @if (editingId()) {
                <button class="icon-btn history-toggle-btn" [class.active]="showHistory()" title="Historique des versions" (click)="toggleHistory()">
                  <span class="material-symbols-outlined">history</span>
                </button>
              }
              <button class="icon-btn" (click)="closeForm()">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          <div class="modal-body">
            <!-- Meta fields -->
            <div class="meta-grid">
              <div>
                <label class="form-label">{{ 'ADMIN.docs.templates.nameLabel' | translate }}</label>
                <input class="form-input" type="text" [(ngModel)]="form.name"
                  [placeholder]="'ADMIN.docs.templates.namePlaceholder' | translate" />
              </div>
              <div>
                <label class="form-label">{{ 'ADMIN.docs.templates.categoryLabel' | translate }}</label>
                <select class="form-input" [(ngModel)]="form.category">
                  <option value="">{{ 'ADMIN.docs.templates.selectPlaceholder' | translate }}</option>
                  @for (c of TEMPLATE_CATEGORIES; track c) {
                    <option [value]="c">{{ categoryLabel(c) }}</option>
                  }
                </select>
              </div>
              <div class="field-full">
                <label class="form-label">{{ 'ADMIN.docs.templates.descriptionLabel' | translate }}</label>
                <input class="form-input" type="text" [(ngModel)]="form.description"
                  [placeholder]="'ADMIN.docs.templates.descriptionPlaceholder' | translate" />
              </div>
            </div>

            <!-- Editor + Variable picker -->
            <div class="editor-layout">
              <!-- Left: editor -->
              <div class="editor-pane">
                <div class="editor-toolbar">
                  <!-- Mode toggle -->
                  <div class="mode-toggle">
                    <button class="mode-btn" [class.active]="editorMode() === 'wysiwyg'" (click)="switchToWysiwyg()" title="Éditeur visuel">
                      <span class="material-symbols-outlined">wysiwyg</span>
                      WYSIWYG
                    </button>
                    <button class="mode-btn" [class.active]="editorMode() === 'source'" (click)="switchToSource()" title="Code HTML brut">
                      <span class="material-symbols-outlined">code</span>
                      Source HTML
                    </button>
                  </div>
                  <button class="toolbar-btn" [title]="'ADMIN.docs.templates.insertDefaultTooltip' | translate"
                    (click)="insertDefaultTemplate()">
                    <span class="material-symbols-outlined">restart_alt</span> {{ 'ADMIN.docs.templates.templateBtn' | translate }}
                  </button>
                </div>

                <!-- CKEditor (WYSIWYG mode) -->
                @if (editorMode() === 'wysiwyg') {
                  <div class="ck-wrapper">
                    <ckeditor
                      [editor]="Editor"
                      [config]="ckConfig"
                      [(ngModel)]="bodyContent"
                      (change)="syncContent()"
                      (ready)="onEditorReady($event)"
                    ></ckeditor>
                  </div>
                }

                <!-- Source textarea (Source mode) -->
                @if (editorMode() === 'source') {
                  <textarea
                    #htmlEditor
                    class="html-textarea"
                    [(ngModel)]="form.htmlContent"
                    rows="22"
                    spellcheck="false"
                    [placeholder]="'ADMIN.docs.templates.htmlPlaceholder' | translate"
                  ></textarea>
                }
              </div>

              <!-- Right: Variables | Live Preview panel -->
              <div class="var-panel">
                <!-- Tab toggle -->
                <div class="panel-tabs">
                  <button class="panel-tab" [class.active]="rightPanelMode() === 'variables'" (click)="switchToVariablesPanel()">
                    <span class="material-symbols-outlined">data_object</span>
                    Variables
                  </button>
                  <button class="panel-tab" [class.active]="rightPanelMode() === 'preview'" (click)="switchToPreviewPanel()">
                    <span class="material-symbols-outlined">visibility</span>
                    Aperçu rendu
                  </button>
                </div>

                <!-- Variables tab content -->
                @if (rightPanelMode() === 'variables') {
                  <div class="var-panel-title">{{ 'ADMIN.docs.templates.availableVariables' | translate }}</div>
                  <p class="var-hint">{{ 'ADMIN.docs.templates.variableHint' | translate }}</p>

                  @if (variableGroups().length === 0) {
                    <div class="var-loading">{{ 'ADMIN.docs.templates.loading' | translate }}</div>
                  } @else {
                    @for (group of variableGroups(); track group.name) {
                      <div class="var-group">
                        <div class="var-group-label">{{ group.name }}</div>
                        @for (v of group.vars; track v.key) {
                          <button class="var-chip" (click)="insertVariable(v.key)">
                            <code class="var-code">{{ '{{' + v.key + '}}' }}</code>
                            <span class="var-label-text">{{ v.labelFr }}</span>
                          </button>
                        }
                      </div>
                    }
                  }

                  <!-- Preview PDF -->
                  <div class="preview-section">
                    <div class="var-group-label" style="margin-top:16px">{{ 'ADMIN.docs.templates.preview' | translate }}</div>
                    <label class="form-label" style="margin-top:8px">{{ 'ADMIN.docs.templates.previewProfileLabel' | translate }}</label>
                    <input class="form-input" type="number" [(ngModel)]="previewProfileId"
                      [placeholder]="'ADMIN.docs.templates.previewProfilePlaceholder' | translate" />
                    <daf-button [label]="'ADMIN.docs.templates.previewPdf' | translate" variant="ghost"
                      [options]="{ iconStart: 'picture_as_pdf', loading: previewing(), size: 'sm' }"
                      (onClick)="preview()" style="margin-top:8px;display:block" />
                  </div>
                }

                <!-- Live preview tab content -->
                @if (rightPanelMode() === 'preview') {
                  <div class="live-preview-wrap">
                    <p class="var-hint">Rendu HTML en temps réel (mise à jour à chaque modification).</p>
                    @if (previewSrc()) {
                      <iframe
                        class="live-preview-frame"
                        [src]="previewSrc()!"
                        sandbox="allow-scripts"
                        title="Aperçu rendu HTML"
                      ></iframe>
                    } @else {
                      <div class="live-preview-empty">
                        <span class="material-symbols-outlined">description</span>
                        <p>Commencez à éditer pour voir l'aperçu.</p>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Version History panel -->
            @if (showHistory() && editingId()) {
              <div class="history-panel">
                <div class="history-header">
                  <span class="material-symbols-outlined">history</span>
                  <span class="history-title-text">Historique des versions</span>
                  @if (versionsLoading()) {
                    <span class="history-loading">
                      <span class="material-symbols-outlined spin">autorenew</span>
                    </span>
                  }
                </div>
                @if (!versionsLoading() && versions().length === 0) {
                  <p class="history-empty">Aucune version enregistrée pour ce modèle.</p>
                }
                @for (v of versions(); track v.id) {
                  <div class="history-row">
                    <span class="history-ver">v{{ v.versionNumber }}</span>
                    <span class="history-date">{{ formatVersionDate(v.changedAt) }}</span>
                    <span class="history-summary">{{ v.changeSummary || '—' }}</span>
                    <button class="toolbar-btn restore-btn"
                      [disabled]="restoringVersionId() === v.id"
                      (click)="restoreVersion(v.id)">
                      @if (restoringVersionId() === v.id) {
                        <span class="material-symbols-outlined spin" style="font-size:14px">autorenew</span>
                      } @else {
                        <span class="material-symbols-outlined" style="font-size:14px">restore</span>
                        Restaurer
                      }
                    </button>
                  </div>
                }
              </div>
            }

            @if (formError()) {
              <div class="error-banner">{{ formError() }}</div>
            }
          </div>

          <div class="modal-footer">
            <daf-button [label]="'ADMIN.docs.templates.cancel' | translate" variant="secondary" (onClick)="closeForm()" />
            <daf-button
              [label]="(editingId() ? 'ADMIN.docs.templates.save' : 'ADMIN.docs.templates.create') | translate"
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
    .tmpl-header    { display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;flex-wrap:wrap }
    .section-title  { font-size:15px;font-weight:700;color:var(--color-text);margin:0 0 4px }
    .section-sub    { font-size:13px;color:var(--color-text-muted);margin:0 }

    .filter-bar     { display:flex;align-items:center;gap:14px;margin-bottom:16px }
    .filter-select  { padding:7px 12px;border:1px solid var(--color-border);border-radius:8px;font-size:13px;background:var(--color-surface);color:var(--color-text);min-width:200px }
    .show-inactive-toggle { display:flex;align-items:center;gap:6px;font-size:13px;color:var(--color-text-muted);cursor:pointer }

    .skeleton-wrap  { display:flex;flex-direction:column;gap:8px }
    .skeleton-row   { height:52px;background:var(--color-bg-secondary);border-radius:6px;animation:pulse 1.4s ease-in-out infinite }
    @keyframes pulse{ 0%,100%{opacity:1}50%{opacity:.5} }

    .empty-state    { display:flex;flex-direction:column;align-items:center;gap:8px;padding:48px;color:var(--color-text-muted);text-align:center }
    .empty-state .material-symbols-outlined { font-size:40px;opacity:.4 }
    .empty-state p  { font-size:13px;margin:0 }

    .tmpl-table     { border:1px solid var(--color-border);border-radius:10px;overflow:hidden }
    .tmpl-head      { display:grid;grid-template-columns:1fr 130px 90px 80px 60px;gap:12px;padding:10px 16px;background:var(--color-bg-secondary);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--color-text-muted) }
    .tmpl-row       { display:grid;grid-template-columns:1fr 130px 90px 80px 60px;gap:12px;padding:12px 16px;align-items:center;border-top:1px solid var(--color-border);transition:background .12s }
    .tmpl-row:hover { background:var(--color-bg-secondary) }
    .tmpl-row.inactive { opacity:.5 }
    .tmpl-name      { display:block;font-weight:600;font-size:13px }
    .tmpl-desc      { display:block;font-size:11px;color:var(--color-text-muted);margin-top:2px }
    .cat-badge      { font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--color-bg-secondary) }
    .cat-badge.cat-attestation { background:#dbeafe;color:#1d4ed8 }
    .cat-badge.cat-contract    { background:#d1fae5;color:#065f46 }
    .cat-badge.cat-lettre      { background:#fef9c3;color:#854d0e }
    .cat-badge.cat-autre       { background:var(--color-bg-secondary);color:var(--color-text-muted) }
    .var-count      { font-size:12px;color:var(--color-text-muted) }
    .no-vars        { color:var(--color-text-muted);opacity:.4 }
    .col-actions    { display:flex;gap:2px }
    .icon-btn       { background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;color:var(--color-text-muted);display:flex;align-items:center;transition:background .12s }
    .icon-btn:hover { background:var(--color-bg-secondary);color:var(--color-text) }
    .icon-btn .material-symbols-outlined { font-size:18px }

    /* Modal */
    .modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto }
    .modal-panel    { background:var(--color-surface);border-radius:14px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2);display:flex;flex-direction:column }
    .modal-xl       { max-width:1100px }
    .modal-header   { display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid var(--color-border) }
    .modal-header h4{ margin:0;font-size:15px;font-weight:700 }
    .modal-header-actions { display:flex;align-items:center;gap:4px }
    .history-toggle-btn.active { background:var(--color-bg-secondary);color:var(--color-primary) }
    .modal-body     { padding:20px 22px;overflow-y:auto }
    .modal-footer   { display:flex;justify-content:flex-end;gap:8px;padding:14px 22px;border-top:1px solid var(--color-border) }

    .meta-grid      { display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px }
    .field-full     { grid-column:1/-1 }
    .form-label     { display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--color-text-muted);margin-bottom:4px }
    .form-input     { width:100%;padding:8px 12px;border:1px solid var(--color-border);border-radius:8px;font-size:13px;font-family:inherit;background:var(--color-surface);color:var(--color-text);outline:none;box-sizing:border-box }
    .form-input:focus { border-color:var(--color-primary) }

    /* Editor layout */
    .editor-layout  { display:grid;grid-template-columns:1fr 260px;gap:16px;align-items:start }
    .editor-pane    { display:flex;flex-direction:column;gap:8px }
    .editor-toolbar { display:flex;justify-content:space-between;align-items:center }

    /* Mode toggle */
    .mode-toggle    { display:flex;gap:4px;background:var(--color-bg-secondary);border-radius:8px;padding:3px }
    .mode-btn       { display:flex;align-items:center;gap:5px;padding:5px 10px;border:none;border-radius:6px;background:transparent;color:var(--color-text-muted);font-size:11px;font-weight:600;cursor:pointer;transition:all .15s }
    .mode-btn:hover { color:var(--color-text) }
    .mode-btn.active { background:var(--color-surface);color:var(--color-primary);box-shadow:0 1px 3px rgba(0,0,0,.12) }
    .mode-btn .material-symbols-outlined { font-size:15px }

    /* CKEditor wrapper */
    .ck-wrapper     { border:1px solid var(--color-border);border-radius:8px;overflow:hidden }
    .ck-wrapper :global(.ck-editor__editable) { min-height:360px;font-size:13px }

    .toolbar-btn    { display:flex;align-items:center;gap:4px;padding:5px 10px;border:1px solid var(--color-border);border-radius:7px;background:var(--color-surface);color:var(--color-text-muted);font-size:12px;cursor:pointer;transition:background .12s }
    .toolbar-btn:hover:not(:disabled) { background:var(--color-bg-secondary);color:var(--color-text) }
    .toolbar-btn:disabled { opacity:.5;cursor:not-allowed }
    .toolbar-btn .material-symbols-outlined { font-size:16px }

    .html-textarea  { width:100%;box-sizing:border-box;padding:12px;border:1px solid var(--color-border);border-radius:8px;font-family:'Cascadia Code','Fira Code',monospace;font-size:12px;line-height:1.6;background:var(--color-bg-secondary);color:var(--color-text);resize:vertical;outline:none;tab-size:2 }
    .html-textarea:focus { border-color:var(--color-primary) }

    /* Variable panel */
    .var-panel       { background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:4px;max-height:600px;overflow-y:auto }
    .var-panel-title { font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-muted);margin-bottom:4px }
    .var-hint        { font-size:11px;color:var(--color-text-muted);margin:0 0 10px;line-height:1.5 }
    .var-group       { margin-bottom:8px }
    .var-group-label { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--color-primary);margin-bottom:4px }
    .var-chip        { width:100%;text-align:left;padding:5px 8px;border:1px solid var(--color-border);border-radius:6px;background:var(--color-surface);cursor:pointer;display:flex;flex-direction:column;gap:1px;transition:background .12s }
    .var-chip:hover  { background:var(--color-primary);border-color:var(--color-primary) }
    .var-chip:hover .var-code,
    .var-chip:hover .var-label-text { color:#fff }
    .var-code        { font-family:monospace;font-size:10px;color:var(--color-primary) }
    .var-label-text  { font-size:10px;color:var(--color-text-muted) }
    .var-loading     { font-size:12px;color:var(--color-text-muted);padding:8px }
    .preview-section { border-top:1px solid var(--color-border);margin-top:12px;padding-top:12px }

    /* Panel tabs (Variables | Aperçu rendu) */
    .panel-tabs      { display:flex;gap:3px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:8px;padding:3px;margin-bottom:10px }
    .panel-tab       { flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:5px 6px;border:none;border-radius:6px;background:transparent;color:var(--color-text-muted);font-size:10px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap }
    .panel-tab:hover { color:var(--color-text) }
    .panel-tab.active { background:var(--color-primary);color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.15) }
    .panel-tab .material-symbols-outlined { font-size:13px }

    /* Live preview iframe */
    .live-preview-wrap  { display:flex;flex-direction:column;flex:1;min-height:0 }
    .live-preview-frame { width:100%;height:460px;border:1px solid var(--color-border);border-radius:8px;background:#fff }
    .live-preview-empty { display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px 16px;color:var(--color-text-muted);text-align:center }
    .live-preview-empty .material-symbols-outlined { font-size:36px;opacity:.35 }
    .live-preview-empty p { font-size:12px;margin:0 }

    /* Version history */
    .history-panel  { margin-top:16px;border:1px solid var(--color-border);border-radius:10px;overflow:hidden }
    .history-header { display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--color-bg-secondary);border-bottom:1px solid var(--color-border);font-size:12px;font-weight:700;color:var(--color-text) }
    .history-header .material-symbols-outlined { font-size:17px;color:var(--color-primary) }
    .history-title-text { flex:1 }
    .history-loading { display:flex;align-items:center }
    .history-empty  { font-size:12px;color:var(--color-text-muted);padding:12px 14px;margin:0 }
    .history-row    { display:grid;grid-template-columns:42px 1fr 1fr auto;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid var(--color-border);font-size:12px }
    .history-row:first-of-type { border-top:none }
    .history-ver    { font-weight:700;color:var(--color-primary);font-size:11px }
    .history-date   { color:var(--color-text-muted) }
    .history-summary { color:var(--color-text-muted);font-style:italic }
    .restore-btn    { white-space:nowrap }

    @keyframes spin  { to { transform:rotate(360deg) } }
    .spin           { display:inline-block;animation:spin .8s linear infinite }

    .error-banner   { margin-top:12px;padding:10px 14px;border-radius:8px;background:#fee2e2;color:#991b1b;font-size:13px }

    @media(max-width:800px) {
      .editor-layout   { grid-template-columns:1fr }
      .var-panel       { max-height:300px }
      .live-preview-frame { height:280px }
      .tmpl-head, .tmpl-row { grid-template-columns:1fr 90px 70px }
      .col-vars        { display:none }
      .history-row     { grid-template-columns:42px 1fr auto }
      .history-summary { display:none }
    }
    @media(max-width:500px) { .meta-grid { grid-template-columns:1fr } }

    .mobile-only { display:none }
    @media (max-width: 640px) {
      .desktop-only { display:none }
      .mobile-only  { display:inline-flex }
    }
  `],
})
export class DocumentTemplatesAdminComponent implements OnInit, OnDestroy {
  private svc       = inject(AdminService);
  private translate = inject(TranslateService);
  private sanitizer = inject(DomSanitizer);

  paysId = input.required<number>();

  @ViewChild('htmlEditor') private htmlEditorRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild(CKEditorComponent) private ckEditorRef?: CKEditorComponent;

  protected readonly TEMPLATE_CATEGORIES = TEMPLATE_CATEGORIES;
  protected readonly Editor = ClassicEditor;
  protected readonly ckConfig: EditorConfig = {
    licenseKey: 'GPL',
    plugins: [
      Essentials, Paragraph, Heading,
      Bold, Italic, Underline, Strikethrough,
      Alignment, FontSize,
      List, Indent, IndentBlock,
      Link,
      Table, TableToolbar,
      HorizontalLine, BlockQuote,
      GeneralHtmlSupport, Undo,
    ],
    toolbar: {
      items: [
        'heading', '|',
        'bold', 'italic', 'underline', 'strikethrough', '|',
        'fontSize', 'alignment', '|',
        'bulletedList', 'numberedList', 'indent', 'outdent', '|',
        'link', 'insertTable', 'horizontalLine', 'blockQuote', '|',
        'undo', 'redo',
      ],
    },
    htmlSupport: {
      allow: [{ name: /^.+$/, attributes: true, classes: true, styles: true }],
    },
    table: {
      contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'],
    },
  };

  // ── State ──────────────────────────────────────────────────────────────────
  filterCategory = '';
  showInactive   = false;
  loading        = signal(false);
  rows           = signal<DocumentTemplate[]>([]);
  variables      = signal<VariableDef[]>([]);

  showForm  = signal(false);
  editingId = signal<number | null>(null);
  saving    = signal(false);
  previewing = signal(false);
  formError = signal<string | null>(null);

  editorMode = signal<'wysiwyg' | 'source'>('wysiwyg');
  bodyContent = '';
  private headPart = '';

  // Right sidebar: variables vs live preview toggle
  rightPanelMode  = signal<'variables' | 'preview'>('variables');
  previewSrc      = signal<SafeResourceUrl | null>(null);
  private previewBlobUrl:    string | null              = null;
  private previewDebounce:   ReturnType<typeof setTimeout> | null = null;
  private headCssStyleEl:    HTMLStyleElement | null    = null;

  showHistory       = signal(false);
  versionsLoading   = signal(false);
  versions          = signal<DocumentTemplateVersion[]>([]);
  restoringVersionId = signal<number | null>(null);

  previewProfileId: number | null = null;

  form: SaveDocumentTemplateRequest & { description: string } = {
    paysId:      0,
    category:    '',
    name:        '',
    description: '',
    htmlContent: '',
  };

  readonly variableGroups = computed(() => {
    const map = new Map<string, VariableDef[]>();
    for (const v of this.variables()) {
      const list = map.get(v.group) ?? [];
      list.push(v);
      map.set(v.group, list);
    }
    return Array.from(map.entries()).map(([name, vars]) => ({ name, vars }));
  });

  ngOnInit() {
    this.load();
    this.svc.getTemplateVariables()
      .pipe(catchError(() => of([])))
      .subscribe(v => this.variables.set(v));
  }

  load() {
    this.loading.set(true);
    this.svc.listTemplates(this.paysId(), this.filterCategory || undefined, this.showInactive)
      .pipe(catchError(() => of([])))
      .subscribe(list => { this.rows.set(list); this.loading.set(false); });
  }

  openAdd() {
    this.editingId.set(null);
    this.form = { paysId: this.paysId(), category: this.filterCategory, name: '', description: '', htmlContent: '' };
    this.bodyContent = '';
    this.headPart = '';
    this.previewProfileId = null;
    this.formError.set(null);
    this.showHistory.set(false);
    this.versions.set([]);
    this.editorMode.set('wysiwyg');
    this.showForm.set(true);
  }

  openEdit(t: DocumentTemplate) {
    this.editingId.set(t.id);
    this.form = { paysId: t.paysId, category: t.category, name: t.name, description: t.description ?? '', htmlContent: t.htmlContent };
    const split = this.splitHtml(t.htmlContent);
    this.headPart = split.head;
    this.bodyContent = split.body;
    this.previewProfileId = null;
    this.formError.set(null);
    this.showHistory.set(false);
    this.versions.set([]);
    this.editorMode.set('wysiwyg');
    this.showForm.set(true);
  }

  ngOnDestroy() {
    if (this.previewBlobUrl) URL.revokeObjectURL(this.previewBlobUrl);
    if (this.headCssStyleEl) this.headCssStyleEl.remove();
    if (this.previewDebounce) clearTimeout(this.previewDebounce);
  }

  // ── CKEditor CSS injection ──────────────────────────────────────────────────
  onEditorReady(_editor: unknown) {
    this.injectCkStyles();
  }

  private injectCkStyles() {
    if (this.headCssStyleEl) { this.headCssStyleEl.remove(); this.headCssStyleEl = null; }
    const css = this.extractHeadCss();
    if (!css.trim()) return;
    const scoped = this.scopeCssToEditable(css);
    const el = document.createElement('style');
    el.setAttribute('data-ck-tmpl', '');
    el.textContent = scoped;
    document.head.appendChild(el);
    this.headCssStyleEl = el;
  }

  private extractHeadCss(): string {
    const matches = this.headPart.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? [];
    return matches
      .map(m => m.replace(/<style[^>]*>/i, '').replace(/<\/style>/i, ''))
      .join('\n');
  }

  private scopeCssToEditable(css: string): string {
    // Scope each CSS rule to .ck-editor__editable; map `body` → editable root
    return css.replace(/([^{}@]+)\{([^{}]*)\}/g, (_match, selector: string, body: string) => {
      const trimSel = selector.trim();
      if (!trimSel) return _match;
      const scoped = trimSel.split(',').map(s => {
        const st = s.trim();
        if (!st) return '';
        if (st === 'body') return '.ck-editor__editable';
        return `.ck-editor__editable ${st}`;
      }).filter(Boolean).join(', ');
      return `${scoped} { ${body.trim()} }`;
    });
  }

  // ── Live preview ────────────────────────────────────────────────────────────
  switchToPreviewPanel() {
    this.rightPanelMode.set('preview');
    this.updatePreview();
  }

  switchToVariablesPanel() {
    this.rightPanelMode.set('variables');
  }

  private schedulePreviewUpdate() {
    if (this.previewDebounce) clearTimeout(this.previewDebounce);
    this.previewDebounce = setTimeout(() => this.updatePreview(), 400);
  }

  private updatePreview() {
    if (this.previewBlobUrl) URL.revokeObjectURL(this.previewBlobUrl);
    const html = this.buildHtml();
    const blob = new Blob([html], { type: 'text/html' });
    this.previewBlobUrl = URL.createObjectURL(blob);
    this.previewSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewBlobUrl));
  }

  closeForm() { this.showForm.set(false); }

  isFormValid(): boolean {
    const hasContent = this.editorMode() === 'source'
      ? !!this.form.htmlContent.trim()
      : !!this.bodyContent.trim();
    return !!(this.form.category && this.form.name.trim() && hasContent);
  }

  insertDefaultTemplate() {
    const split = this.splitHtml(DEFAULT_HTML);
    this.headPart = split.head;
    this.bodyContent = split.body;
    this.form.htmlContent = DEFAULT_HTML;
    if (!this.form.category) this.form.category = 'ATTESTATION';
  }

  insertVariable(key: string) {
    const token = `{{${key}}}`;

    if (this.editorMode() === 'wysiwyg') {
      const editor = this.ckEditorRef?.editorInstance;
      if (editor) {
        editor.model.change(writer => {
          editor.model.insertContent(
            writer.createText(token),
            editor.model.document.selection,
          );
        });
        return;
      }
      this.bodyContent += token;
      this.syncContent();
      return;
    }

    const ta = this.htmlEditorRef?.nativeElement;
    if (!ta) { this.form.htmlContent += token; return; }
    const start = ta.selectionStart ?? this.form.htmlContent.length;
    const end   = ta.selectionEnd   ?? start;
    this.form.htmlContent =
      this.form.htmlContent.substring(0, start) + token + this.form.htmlContent.substring(end);
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + token.length; ta.focus(); });
  }

  switchToWysiwyg() {
    if (this.editorMode() === 'wysiwyg') return;
    const split = this.splitHtml(this.form.htmlContent);
    this.headPart = split.head;
    this.bodyContent = split.body;
    this.editorMode.set('wysiwyg');
    setTimeout(() => this.injectCkStyles(), 50);
  }

  switchToSource() {
    if (this.editorMode() === 'source') return;
    this.form.htmlContent = this.buildHtml();
    this.editorMode.set('source');
  }

  syncContent() {
    this.form.htmlContent = this.buildHtml();
    if (this.rightPanelMode() === 'preview') this.schedulePreviewUpdate();
  }

  toggleHistory() {
    const id = this.editingId();
    if (!id) return;
    const next = !this.showHistory();
    this.showHistory.set(next);
    if (next && this.versions().length === 0) this.loadVersions(id);
  }

  private loadVersions(id: number) {
    this.versionsLoading.set(true);
    this.svc.getTemplateVersions(id)
      .pipe(catchError(() => of([])))
      .subscribe(v => { this.versions.set(v); this.versionsLoading.set(false); });
  }

  restoreVersion(versionId: number) {
    const id = this.editingId();
    if (!id) return;
    this.restoringVersionId.set(versionId);
    this.svc.restoreTemplateVersion(id, versionId).pipe(
      catchError(err => {
        this.formError.set(err?.error?.message ?? 'Erreur lors de la restauration.');
        this.restoringVersionId.set(null);
        return of(null);
      }),
    ).subscribe(result => {
      this.restoringVersionId.set(null);
      if (!result) return;
      this.form.htmlContent = result.htmlContent;
      const split = this.splitHtml(result.htmlContent);
      this.headPart = split.head;
      this.bodyContent = split.body;
      if (this.editorMode() === 'source') this.editorMode.set('wysiwyg');
      this.loadVersions(id);
    });
  }

  save() {
    if (!this.isFormValid()) return;
    this.form.htmlContent = this.buildHtml();
    const id      = this.editingId();
    const payload = { ...this.form, description: this.form.description || undefined };
    this.saving.set(true);
    this.formError.set(null);

    const req$ = id
      ? this.svc.updateTemplate(id, payload)
      : this.svc.createTemplate(payload);

    req$.pipe(
      catchError(err => {
        this.formError.set(err?.error?.message ?? err?.error?.detail ?? this.translate.instant('ADMIN.docs.templates.saveError'));
        this.saving.set(false);
        return of(null);
      }),
    ).subscribe(result => {
      this.saving.set(false);
      if (result) { this.showForm.set(false); this.load(); }
    });
  }

  preview() {
    const html = this.buildHtml();
    if (!html.trim()) return;
    this.previewing.set(true);
    this.svc.previewRawTemplate(html, this.paysId(), this.previewProfileId ?? undefined).pipe(
      catchError(() => { this.previewing.set(false); return of(null); }),
    ).subscribe(blob => {
      this.previewing.set(false);
      if (blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    });
  }

  toggleActive(t: DocumentTemplate) {
    this.svc.toggleTemplateActive(t.id)
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        if (updated) this.rows.update(list => list.map(r => r.id === updated.id ? updated : r));
      });
  }

  categoryLabel(cat: string): string {
    const key = `ADMIN.docs.templates.category.${cat}`;
    const val = this.translate.instant(key);
    return val === key ? cat : val;
  }

  formatVersionDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }

  private splitHtml(full: string): { head: string; body: string } {
    const bodyOpenMatch = full.match(/<body[^>]*>/i);
    const bodyCloseIdx = full.lastIndexOf('</body>');
    if (bodyOpenMatch?.index !== undefined && bodyCloseIdx !== -1) {
      const bodyStart = bodyOpenMatch.index + bodyOpenMatch[0].length;
      return {
        head: full.substring(0, bodyStart),
        body: full.substring(bodyStart, bodyCloseIdx).trim(),
      };
    }
    return { head: '', body: full };
  }

  private buildHtml(): string {
    if (this.editorMode() === 'source') return this.form.htmlContent;
    if (!this.headPart) return this.bodyContent;
    return `${this.headPart}\n${this.bodyContent}\n</body>\n</html>`;
  }
}
