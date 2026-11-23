import { Component, Input, OnChanges, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, DafCellDirective, DataTableComponent, FormFieldComponent, FormFieldOptions,
  ModalRef, ModalService, SelectComponent, StatusBadgeComponent, TableColumn, TableConfig, TableRow,
  ToggleComponent, type SelectOption,
} from '@khalilrebhiitec/daf360';
import {
  CandidateEmailCode, CandidateEmailDefault, CandidateEmailTemplate, CandidateEmailTemplateService,
} from './candidate-email-template.service';

const CODES: CandidateEmailCode[] = ['OFFER', 'OFFER_REVISED'];

/**
 * « Modèles d'emails candidats » (V134) — the text of the emails sent to a candidate, per
 * entity. Same idea as the finance WIP email templates: plain-text subject and body with
 * {{tokens}}; RH sees the rendered email before sending and may edit that one send.
 *
 * One template per email and entity. Without one, the built-in default is sent — and
 * « Nouveau modèle » opens on that default, so an admin starts from the real text.
 */
@Component({
  selector: 'app-candidate-email-templates-admin',
  standalone: true,
  imports: [
    TranslatePipe, ButtonComponent, DataTableComponent, DafCellDirective, FormFieldComponent,
    SelectComponent, ToggleComponent, StatusBadgeComponent,
  ],
  template: `
    <div class="cet">
      <div class="cet-header">
        <div>
          <h2 class="cet-title">{{ 'ADMIN.CANDIDATE_EMAILS.TITLE' | translate }}</h2>
          <p class="cet-sub">{{ 'ADMIN.CANDIDATE_EMAILS.INTRO' | translate }}</p>
        </div>
        <daf-button
          [label]="'ADMIN.CANDIDATE_EMAILS.ADD' | translate"
          variant="teal"
          [options]="{ iconStart: 'add', disabled: !freeCodes().length }"
          (onClick)="openCreate()" />
      </div>

      @if (error()) {
        <div class="cet-error">{{ error() }}</div>
      }

      <daf-data-table [columns]="columns()" [rows]="rows()" [config]="config()">
        <ng-template dafCell="state" let-row>
          <daf-badge
            [label]="(row['active'] ? 'ADMIN.CANDIDATE_EMAILS.ACTIVE' : 'ADMIN.CANDIDATE_EMAILS.INACTIVE') | translate"
            [options]="{ variant: row['active'] ? 'success' : 'neutral', size: 'sm' }" />
        </ng-template>
      </daf-data-table>

      <!-- Emails with no template of this entity: the default text is what goes out. -->
      @if (freeCodes().length) {
        <p class="cet-note">
          {{ 'ADMIN.CANDIDATE_EMAILS.DEFAULT_USED' | translate }}
          @for (c of freeCodes(); track c; let last = $last) {
            <strong>{{ ('ADMIN.CANDIDATE_EMAILS.CODE_' + c) | translate }}</strong>@if (!last) {, }
          }
        </p>
      }
    </div>

    <ng-template #formTpl>
      <div class="cet-form">
        @if (formError()) {
          <div class="cet-error">{{ formError() }}</div>
        }

        <daf-select
          [options]="codeOptions()"
          [selected]="[code()]"
          [config]="{ label: ('ADMIN.CANDIDATE_EMAILS.FIELD_CODE' | translate), required: true, fullWidth: true,
                      disabled: editing() !== null }"
          (selectedChange)="onCodeChange($any($event[0]))" />

        <daf-form-field
          [value]="subject()"
          (valueChange)="subject.set($any($event) ?? '')"
          [options]="subjectOpts()" />

        <daf-form-field
          [value]="body()"
          (valueChange)="body.set($any($event) ?? '')"
          [options]="bodyOpts()" />

        <div class="cet-tokens">
          <span class="cet-label">{{ 'ADMIN.CANDIDATE_EMAILS.TOKENS' | translate }}</span>
          <div class="cet-token-list">
            @for (t of tokens(); track t) {
              <button type="button" class="cet-token" (click)="insertToken(t)">{{ t }}</button>
            }
          </div>
        </div>

        <daf-toggle
          [checked]="active()"
          [options]="{ label: ('ADMIN.CANDIDATE_EMAILS.FIELD_ACTIVE' | translate) }"
          (checkedChange)="active.set($event)" />
        <p class="cet-hint">{{ 'ADMIN.CANDIDATE_EMAILS.ACTIVE_HINT' | translate }}</p>

        <div class="cet-actions">
          @if (editing() === null) {
            <span></span>
          } @else {
            <daf-button
              [label]="'ADMIN.CANDIDATE_EMAILS.RESET_DEFAULT' | translate"
              variant="secondary"
              [options]="{ iconStart: 'restart_alt', disabled: saving() }"
              (onClick)="resetToDefault()" />
          }
          <div class="cet-actions-right">
            <daf-button [label]="'ADMIN.CANDIDATE_EMAILS.CANCEL' | translate" variant="secondary"
              [options]="{ disabled: saving() }" (onClick)="close()" />
            <daf-button [label]="'ADMIN.CANDIDATE_EMAILS.SAVE' | translate" variant="teal"
              [options]="{ iconStart: 'save', loading: saving(), disabled: saving() || !canSave() }"
              (onClick)="save()" />
          </div>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .cet        { width:100%; display:flex; flex-direction:column; gap:16px; }
    .cet-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
    .cet-title  { margin:0; font-size:var(--text-headline-md); font-weight:600; color:var(--color-on-surface); }
    .cet-sub    { margin:3px 0 0; max-width:720px; font-size:var(--text-body-sm); color:var(--color-on-surface-variant); }
    .cet-note   { margin:0; font-size:var(--text-body-sm); color:var(--color-on-surface-variant); }
    .cet-error  { padding:10px 14px; border-radius:8px; font-size:var(--text-body-sm); color:var(--color-danger);
                  background:color-mix(in srgb, var(--color-danger) 10%, transparent); }
    .cet-form   { display:flex; flex-direction:column; gap:16px; padding:4px; }
    .cet-label  { font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
                  color:var(--color-on-surface-variant); }
    .cet-tokens { display:flex; flex-direction:column; gap:6px; }
    .cet-token-list { display:flex; flex-wrap:wrap; gap:4px; }
    .cet-token  { border:0; cursor:pointer; padding:2px 8px; border-radius:999px; font-family:monospace; font-size:11px;
                  font-weight:700; color:var(--color-on-surface-variant); background:var(--color-surface-container); }
    .cet-token:hover { color:var(--color-primary); background:color-mix(in srgb, var(--color-primary) 10%, transparent); }
    .cet-hint   { margin:-8px 0 0; font-size:var(--text-body-sm); color:var(--color-on-surface-variant); }
    .cet-actions { display:flex; justify-content:space-between; align-items:center; gap:10px; padding-top:12px;
                   border-top:1px solid var(--color-outline-variant); }
    .cet-actions-right { display:flex; gap:10px; }
  `],
})
export class CandidateEmailTemplatesAdminComponent implements OnChanges {
  @Input() paysId!: number;

  private readonly svc       = inject(CandidateEmailTemplateService);
  private readonly translate = inject(TranslateService);
  private readonly modal     = inject(ModalService);
  private modalRef?: ModalRef;
  private readonly formTpl = viewChild.required<TemplateRef<unknown>>('formTpl');

  readonly templates = signal<CandidateEmailTemplate[]>([]);
  readonly defaults  = signal<CandidateEmailDefault[]>([]);
  readonly loading   = signal(false);
  readonly error     = signal<string | null>(null);

  readonly editing   = signal<CandidateEmailTemplate | null>(null);
  readonly saving    = signal(false);
  readonly formError = signal<string | null>(null);
  readonly code      = signal<CandidateEmailCode>('OFFER');
  readonly subject   = signal('');
  readonly body      = signal('');
  readonly active    = signal(true);

  /** Emails of this entity without a template — the only codes « Nouveau modèle » offers. */
  readonly freeCodes = computed(() => {
    const used = new Set(this.templates().map(t => t.code));
    return CODES.filter(c => !used.has(c));
  });

  readonly codeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    const allowed = this.editing() ? CODES : this.freeCodes();
    return allowed.map(c => ({ value: c, label: this.translate.instant('ADMIN.CANDIDATE_EMAILS.CODE_' + c) }));
  });

  readonly tokens = computed(() => this.defaults()[0]?.tokens ?? []);
  readonly canSave = computed(() => !!this.subject().trim() && !!this.body().trim());

  readonly subjectOpts = computed<FormFieldOptions>(() => {
    this.translate.currentLang();
    return { label: this.translate.instant('ADMIN.CANDIDATE_EMAILS.FIELD_SUBJECT'), maxLength: 500, required: true, fullWidth: true };
  });
  readonly bodyOpts = computed<FormFieldOptions>(() => {
    this.translate.currentLang();
    return { label: this.translate.instant('ADMIN.CANDIDATE_EMAILS.FIELD_BODY'), type: 'textarea', rows: 14, required: true, fullWidth: true };
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'codeLabel', label: t('ADMIN.CANDIDATE_EMAILS.COL_CODE') },
      { key: 'subject',   label: t('ADMIN.CANDIDATE_EMAILS.COL_SUBJECT') },
      { key: 'state',     label: t('ADMIN.CANDIDATE_EMAILS.COL_STATE'), align: 'center', width: '120px' },
    ];
  });

  readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.templates().map(tpl => ({
      codeLabel: this.translate.instant('ADMIN.CANDIDATE_EMAILS.CODE_' + tpl.code),
      subject:   tpl.subject,
      active:    tpl.active,
      _source:   tpl,
    }));
  });

  readonly config = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      showHeader: false,
      hoverable: true,
      loading: this.loading(),
      emptyMessage: t('ADMIN.CANDIDATE_EMAILS.EMPTY'),
      rowId: (row: TableRow) => (row['_source'] as CandidateEmailTemplate).id,
      actions: [
        { id: 'edit', icon: 'edit', tooltip: t('ADMIN.CANDIDATE_EMAILS.EDIT'),
          onClick: (row: TableRow) => this.openEdit(row['_source'] as CandidateEmailTemplate) },
        { id: 'delete', icon: 'delete', variant: 'danger', tooltip: t('ADMIN.CANDIDATE_EMAILS.DELETE'),
          onClick: (row: TableRow) => this.remove(row['_source'] as CandidateEmailTemplate) },
      ],
    };
  });

  ngOnChanges(): void {
    this.load();
    if (!this.defaults().length) {
      this.svc.defaults().subscribe({ next: d => this.defaults.set(d), error: () => this.defaults.set([]) });
    }
  }

  private load(): void {
    if (!this.paysId) return;
    this.loading.set(true);
    this.error.set(null);
    this.svc.list(this.paysId).subscribe({
      next: list => { this.templates.set(list); this.loading.set(false); },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? this.translate.instant('ADMIN.CANDIDATE_EMAILS.ERROR_LOAD'));
      },
    });
  }

  openCreate(): void {
    const first = this.freeCodes()[0];
    if (!first) return;
    this.editing.set(null);
    this.active.set(true);
    this.applyDefault(first);
    this.openModal('ADMIN.CANDIDATE_EMAILS.NEW_TITLE');
  }

  openEdit(tpl: CandidateEmailTemplate): void {
    this.editing.set(tpl);
    this.code.set(tpl.code);
    this.subject.set(tpl.subject);
    this.body.set(tpl.body);
    this.active.set(tpl.active);
    this.openModal('ADMIN.CANDIDATE_EMAILS.EDIT_TITLE');
  }

  /** Creating: switching the email reloads its default text. Editing: the code is fixed. */
  onCodeChange(code: CandidateEmailCode | undefined): void {
    if (!code || this.editing()) return;
    this.applyDefault(code);
  }

  resetToDefault(): void {
    const d = this.defaults().find(x => x.code === this.code());
    if (d) { this.subject.set(d.subject); this.body.set(d.body); }
  }

  private applyDefault(code: CandidateEmailCode): void {
    this.code.set(code);
    const d = this.defaults().find(x => x.code === code);
    this.subject.set(d?.subject ?? '');
    this.body.set(d?.body ?? '');
  }

  private openModal(titleKey: string): void {
    this.formError.set(null);
    this.modalRef = this.modal.open({
      title: this.translate.instant(titleKey),
      icon: 'mail_outline',
      body: this.formTpl(),
      size: 'lg',
      closeOnBackdrop: false,
      minWidth: '420px',
      minHeight: '360px',
      resizable: true,
      maximizable: true,
    });
  }

  close(): void {
    this.modalRef?.close();
  }

  insertToken(token: string): void {
    this.body.update(b => b ? b + token : token);
  }

  save(): void {
    if (this.saving() || !this.canSave()) return;
    this.saving.set(true);
    this.formError.set(null);
    const dto = {
      code: this.code(), paysId: this.paysId,
      subject: this.subject().trim(), body: this.body(), active: this.active(),
    };
    const editing = this.editing();
    (editing ? this.svc.update(editing.id, dto) : this.svc.create(dto)).subscribe({
      next: () => { this.saving.set(false); this.modalRef?.close(); this.load(); },
      error: err => {
        this.saving.set(false);
        this.formError.set(err?.error?.detail ?? this.translate.instant('ADMIN.CANDIDATE_EMAILS.ERROR_SAVE'));
      },
    });
  }

  remove(tpl: CandidateEmailTemplate): void {
    this.error.set(null);
    this.svc.delete(tpl.id).subscribe({
      next: () => this.load(),
      error: err => this.error.set(err?.error?.detail ?? this.translate.instant('ADMIN.CANDIDATE_EMAILS.ERROR_DELETE')),
    });
  }
}
