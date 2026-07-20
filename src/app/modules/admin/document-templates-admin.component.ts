import {
  Component, computed, ElementRef, inject, input, OnInit, signal, ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminService } from './admin.service';
import {
  DocumentTemplate, SaveDocumentTemplateRequest,
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
  imports: [FormsModule, ButtonComponent, StatusBadgeComponent, TranslatePipe],
  template: `
    <!-- Header -->
    <div class="tmpl-header">
      <div>
        <h3 class="section-title">{{ 'ADMIN.docs.templates.title' | translate }}</h3>
        <p class="section-sub">{{ 'ADMIN.docs.templates.subtitle' | translate }} ({{'{{'}}variable.clé{{'}}'}}).</p>
      </div>
      <daf-button [label]="'ADMIN.docs.templates.newTemplate' | translate" variant="teal" [options]="{ iconStart: 'add' }" (onClick)="openAdd()" />
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
            <button class="icon-btn" (click)="closeForm()">
              <span class="material-symbols-outlined">close</span>
            </button>
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
              <!-- Left: HTML editor -->
              <div class="editor-pane">
                <div class="editor-toolbar">
                  <label class="form-label" style="margin:0">{{ 'ADMIN.docs.templates.htmlLabel' | translate }}</label>
                  <button class="toolbar-btn" [title]="'ADMIN.docs.templates.insertDefaultTooltip' | translate"
                    (click)="insertDefaultTemplate()">
                    <span class="material-symbols-outlined">restart_alt</span> {{ 'ADMIN.docs.templates.templateBtn' | translate }}
                  </button>
                </div>
                <textarea
                  #htmlEditor
                  id="html-editor"
                  class="html-textarea"
                  [(ngModel)]="form.htmlContent"
                  rows="22"
                  spellcheck="false"
                  [placeholder]="'ADMIN.docs.templates.htmlPlaceholder' | translate"
                ></textarea>
              </div>

              <!-- Right: Variable picker -->
              <div class="var-panel">
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

                <!-- Preview profile ID -->
                <div class="preview-section">
                  <div class="var-group-label" style="margin-top:16px">{{ 'ADMIN.docs.templates.preview' | translate }}</div>
                  <label class="form-label" style="margin-top:8px">{{ 'ADMIN.docs.templates.previewProfileLabel' | translate }}</label>
                  <input class="form-input" type="number" [(ngModel)]="previewProfileId"
                    [placeholder]="'ADMIN.docs.templates.previewProfilePlaceholder' | translate" />
                  <daf-button [label]="'ADMIN.docs.templates.previewPdf' | translate" variant="ghost"
                    [options]="{ iconStart: 'visibility', loading: previewing(), size: 'sm' }"
                    (onClick)="preview()" style="margin-top:8px;display:block" />
                </div>
              </div>
            </div>

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
    .toolbar-btn    { display:flex;align-items:center;gap:4px;padding:5px 10px;border:1px solid var(--color-border);border-radius:7px;background:var(--color-surface);color:var(--color-text-muted);font-size:12px;cursor:pointer;transition:background .12s }
    .toolbar-btn:hover { background:var(--color-bg-secondary);color:var(--color-text) }
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

    .error-banner   { margin-top:12px;padding:10px 14px;border-radius:8px;background:#fee2e2;color:#991b1b;font-size:13px }

    @media(max-width:800px) {
      .editor-layout   { grid-template-columns:1fr }
      .var-panel       { max-height:250px }
      .tmpl-head, .tmpl-row { grid-template-columns:1fr 90px 70px }
      .col-vars        { display:none }
    }
    @media(max-width:500px) { .meta-grid { grid-template-columns:1fr } }
  `],
})
export class DocumentTemplatesAdminComponent implements OnInit {
  private svc = inject(AdminService);
  private translate = inject(TranslateService);

  paysId = input.required<number>();

  @ViewChild('htmlEditor') htmlEditorRef!: ElementRef<HTMLTextAreaElement>;

  protected readonly TEMPLATE_CATEGORIES = TEMPLATE_CATEGORIES;

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
    this.form = {
      paysId:      this.paysId(),
      category:    this.filterCategory,
      name:        '',
      description: '',
      htmlContent: '',
    };
    this.previewProfileId = null;
    this.formError.set(null);
    this.showForm.set(true);
  }

  openEdit(t: DocumentTemplate) {
    this.editingId.set(t.id);
    this.form = {
      paysId:      t.paysId,
      category:    t.category,
      name:        t.name,
      description: t.description ?? '',
      htmlContent: t.htmlContent,
    };
    this.previewProfileId = null;
    this.formError.set(null);
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); }

  isFormValid(): boolean {
    return !!(this.form.category && this.form.name.trim() && this.form.htmlContent.trim());
  }

  insertDefaultTemplate() {
    this.form.htmlContent = DEFAULT_HTML;
    if (!this.form.category) this.form.category = 'ATTESTATION';
  }

  insertVariable(key: string) {
    const ta = this.htmlEditorRef?.nativeElement;
    if (!ta) {
      this.form.htmlContent += `{{${key}}}`;
      return;
    }
    const start   = ta.selectionStart ?? this.form.htmlContent.length;
    const end     = ta.selectionEnd   ?? start;
    const token   = `{{${key}}}`;
    this.form.htmlContent =
      this.form.htmlContent.substring(0, start) + token + this.form.htmlContent.substring(end);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + token.length;
      ta.focus();
    });
  }

  save() {
    if (!this.isFormValid()) return;
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
    if (!this.form.htmlContent.trim()) return;
    this.previewing.set(true);
    this.svc.previewRawTemplate(
      this.form.htmlContent,
      this.paysId(),
      this.previewProfileId ?? undefined,
    ).pipe(
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
}
