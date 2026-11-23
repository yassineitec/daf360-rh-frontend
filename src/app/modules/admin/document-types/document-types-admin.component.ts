import { Component, Input, OnChanges, TemplateRef, computed, inject, signal, untracked, viewChild } from '@angular/core';
import {
  ButtonComponent, DataTableComponent, DafCellDirective, FormFieldComponent, ModalRef, ModalService,
  PaginationComponent, SearchToolbarComponent, SortDirection, StatusBadgeComponent,
  TableColumn, TableConfig, TableRow, ToggleComponent,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DocumentTypeRow, SharePointAdminService } from '../sharepoint/sharepoint-admin.service';
import { TableSort, searchRows, sortByColumn, toTableSort } from '../../../shared/table-sort.utils';
import { rememberAdminState } from '../admin-section-state';

const PAGE_SIZE = 10;

/**
 * Codes the application uploads with as a fixed value. The backend refuses an upload whose type
 * is inactive for the country, so deactivating one of these would break that flow silently —
 * hence the card refuses to deactivate them. Value = the i18n key of the flow that needs it.
 *
 *   RIB             — onboarding form, RIB attestation (onboarding-form.component.ts)
 *   RESIGNATION     — offboarding, resignation letter (offboarding.service.ts)
 *   EVALUATION_CIVP — CIVP → CDI request, evaluation file (CdiConversionService)
 */
const SYSTEM_TYPES: Record<string, string> = {
  RIB:             'ADMIN.documentTypes.system.ONBOARDING',
  RESIGNATION:     'ADMIN.documentTypes.system.OFFBOARDING',
  EVALUATION_CIVP: 'ADMIN.documentTypes.system.CIVP_CDI',
};

/** What each column sorts on. No sort = the stored order (`sortOrder`). */
const DOC_TYPE_SORT: Record<string, (t: DocumentTypeRow) => string | number | null> = {
  sortOrder: t => t.sortOrder,
  labelFr:   t => t.labelFr || null,
  labelEn:   t => t.labelEn || null,
  code:      t => t.code || null,
  required:  t => (t.requiredForCompletion ? 1 : 0),
  active:    t => (t.active ? 1 : 0),
};

/**
 * « Types de documents » — the per-country document-type catalogue ({@code document_types},
 * V87), as its own Administration card.
 *
 * Deliberately separate from the « SharePoint » card: a type is what may be uploaded into a
 * dossier, whether or not it has a SharePoint folder. The SharePoint card only READS this
 * catalogue (its « Documents requis » checklist and its « Chemins » type dropdown).
 *
 * The API still lives on rh-service's SharePointAdminController (/api/hr/sharepoint/document-types),
 * gated by ADMIN_SHAREPOINT / ADMIN_ROLES / HR_ADMIN_ROLES.
 */
@Component({
  selector: 'app-document-types-admin',
  standalone: true,
  imports: [
    ButtonComponent, FormFieldComponent, StatusBadgeComponent, PaginationComponent,
    DataTableComponent, DafCellDirective, SearchToolbarComponent, ToggleComponent, TranslatePipe,
  ],
  template: `
    <div class="dta-wrap">

      <div class="dta-header">
        <h2 class="dta-title">{{ 'ADMIN.documentTypes.title' | translate }}</h2>
        <p class="dta-sub">{{ 'ADMIN.documentTypes.subtitle' | translate:{ count: activeCount() } }}</p>
      </div>

      <daf-search-toolbar class="dta-toolbar"
        [placeholder]="'REQUESTS.TABLE.SEARCH' | translate"
        [value]="searchQuery()"
        [debounce]="200"
        (valueChange)="onSearch($event)"
        [table]="dtaTable">
        <daf-button
          [label]="'ADMIN.documentTypes.add' | translate"
          variant="teal"
          [options]="{ iconStart: 'add' }"
          (onClick)="openForm(null)" />
      </daf-search-toolbar>

      @if (error()) { <div class="dta-error">{{ error() }}</div> }

      <!-- A country with no row runs on the backend's built-in list; the first row added
           replaces that list for the country, so RH has to know before adding one. -->
      @if (!loading() && loaded() && !types().length) {
        <div class="dta-warn">{{ 'ADMIN.documentTypes.unconfigured' | translate }}</div>
      }

      <!-- A configured country missing one of the codes the app uploads with: that flow's
           upload is refused until the type exists and is active. -->
      @if (missingSystemTypes().length) {
        <div class="dta-warn">
          {{ 'ADMIN.documentTypes.system.missing' | translate:{ codes: missingSystemTypes().join(', ') } }}
        </div>
      }

      <div class="table-scroll">
        <daf-data-table #dtaTable [columns]="columns()" [rows]="rows()" [config]="tableConfig()"
                        (sortChange)="onSortChange($event.key, $event.dir)"
                        (resetClick)="onSortChange('', null)">
          <ng-template dafCell="labelFr" let-row>
            <span class="dta-name">{{ row['labelFr'] }}</span>
          </ng-template>
          <ng-template dafCell="labelEn" let-row>
            @if (row['labelEn']) { <span>{{ row['labelEn'] }}</span> }
            @else { <span class="dta-muted">—</span> }
          </ng-template>
          <ng-template dafCell="code" let-row>
            <code class="dta-code">{{ row['code'] }}</code>
            @if (row['systemUse']) {
              <span class="dta-system" [title]="row['systemUse']">
                <span class="material-symbols-outlined">lock</span>{{ 'ADMIN.documentTypes.system.badge' | translate }}
              </span>
            }
          </ng-template>
          <ng-template dafCell="folder" let-row>
            @if (row['folder']) {
              <code class="dta-code">{{ row['folder'] }}</code>
            } @else if (row['active']) {
              <span class="dta-nofolder">{{ 'ADMIN.documentTypes.noFolder' | translate }}</span>
            } @else {
              <span class="dta-muted">—</span>
            }
          </ng-template>
          <ng-template dafCell="required" let-row>
            @if (row['required']) {
              <daf-badge [label]="'ADMIN.documentTypes.requiredYes' | translate"
                         [options]="{ variant: 'info', size: 'sm' }" />
            } @else {
              <span class="dta-muted">—</span>
            }
          </ng-template>
          <ng-template dafCell="active" let-row>
            <daf-badge
              [label]="(row['active'] ? 'ADMIN.documentTypes.active' : 'ADMIN.documentTypes.inactive') | translate"
              [options]="{ variant: row['active'] ? 'success' : 'neutral', size: 'sm' }" />
          </ng-template>
        </daf-data-table>
      </div>

      @if (filteredTypes().length > 0) {
        <div class="dta-footer">
          <span class="dta-count"><strong>{{ filteredTypes().length }}</strong> {{ 'ADMIN.documentTypes.typesWord' | translate }}</span>
          @if (totalPages() > 1) {
            <daf-pagination
              [currentPage]="currentPage()"
              [totalPages]="totalPages()"
              [totalElements]="filteredTypes().length"
              (pageChange)="currentPage.set($event)" />
          }
        </div>
      }

      <!-- Add / edit form, projected into the daf-modal-host via ModalService. -->
      <ng-template #formTpl>
        <div class="dta-form">
          <daf-form-field
            [options]="{ label: ('ADMIN.documentTypes.code' | translate),
                         hint: ('ADMIN.documentTypes.codeHint' | translate),
                         error: codeError() ? (codeError()! | translate) : undefined,
                         disabled: !!editing(), required: true, maxLength: 100, fullWidth: true }"
            [value]="fCode()"
            (valueChange)="fCode.set($any($event) ?? '')" />

          <div class="dta-form-row">
            <daf-form-field
              [options]="{ label: ('ADMIN.documentTypes.labelFr' | translate), required: true, maxLength: 200, fullWidth: true }"
              [value]="fLabelFr()"
              (valueChange)="fLabelFr.set($any($event) ?? '')" />
            <daf-form-field
              [options]="{ label: ('ADMIN.documentTypes.sortOrder' | translate),
                           hint: ('ADMIN.documentTypes.sortOrderHint' | translate), type: 'number', fullWidth: true }"
              [value]="fSortOrder()"
              (valueChange)="fSortOrder.set($event === null || $event === '' ? null : +$event)" />
          </div>

          <daf-form-field
            [options]="{ label: ('ADMIN.documentTypes.labelEn' | translate),
                         hint: ('ADMIN.documentTypes.labelEnHint' | translate), maxLength: 200, fullWidth: true }"
            [value]="fLabelEn()"
            (valueChange)="fLabelEn.set($any($event) ?? '')" />

          <daf-toggle
            [checked]="fRequired()"
            [options]="{ label: ('ADMIN.documentTypes.requiredToggle' | translate), labelPosition: 'right' }"
            (checkedChange)="fRequired.set($event)" />

          @if (editing(); as e) {
            <daf-toggle
              [checked]="fActive()"
              [options]="{ label: ('ADMIN.documentTypes.activeToggle' | translate), labelPosition: 'right',
                           disabled: isSystem(e.code) && e.active,
                           hint: isSystem(e.code) && e.active ? systemUse(e.code) : undefined }"
              (checkedChange)="fActive.set($event)" />
          }

          @if (!editing() && !types().length) {
            <div class="dta-warn">{{ 'ADMIN.documentTypes.unconfigured' | translate }}</div>
          }

          @if (formProblems().length) {
            <div class="dta-problems">
              @for (p of formProblems(); track p) { <span class="dta-problem">{{ p | translate }}</span> }
            </div>
          }
        </div>
        <div class="dta-form-footer">
          <daf-button [label]="'ADMIN.documentTypes.cancel' | translate"
                      variant="secondary" (onClick)="closeForm()" />
          <daf-button [label]="'ADMIN.documentTypes.save' | translate"
                      variant="teal"
                      [options]="{ disabled: !canSave() || saving(), loading: saving() }"
                      (onClick)="save()" />
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .dta-wrap   { width:100% }
    .dta-header { margin-bottom:20px }
    .dta-title  { font-size:var(--text-headline-md);font-weight:600;color:var(--color-on-surface);margin:0 }
    .dta-sub    { font-size:var(--text-body-sm);color:var(--color-on-surface-variant);margin:3px 0 0;max-width:80ch }
    .dta-toolbar { display:block;margin-bottom:14px }

    .dta-error { background:var(--color-error-container);border-radius:8px;padding:10px 14px;
                 font-size:var(--text-body-sm);color:var(--color-on-error-container);margin-bottom:14px }
    .dta-warn  { background:color-mix(in srgb, var(--color-warning) 14%, transparent);
                 border-radius:8px;padding:9px 13px;font-size:var(--text-body-sm);color:var(--color-warning);margin-bottom:14px }

    .dta-name  { font-size:var(--text-body-sm);font-weight:600;color:var(--color-on-surface) }
    .dta-muted { font-size:var(--text-body-sm);color:var(--color-on-surface-variant) }
    .dta-code  { font-size:var(--text-body-sm);color:var(--color-on-surface);
                 background:var(--color-surface-container);padding:2px 7px;border-radius:6px;word-break:break-all }

    .dta-system { display:inline-flex;align-items:center;gap:3px;margin-left:8px;cursor:help;
                  font-size:var(--text-label-sm);color:var(--color-on-surface-variant);white-space:nowrap }
    .dta-system .material-symbols-outlined { font-size:14px }
    .dta-nofolder { font-size:var(--text-body-sm);color:var(--color-warning) }

    .dta-footer { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px }
    .dta-count  { font-size:var(--text-body-sm);color:var(--color-on-surface-variant) }

    .dta-form     { display:flex;flex-direction:column;gap:14px }
    .dta-form-row { display:grid;grid-template-columns:1fr 140px;gap:12px }
    .dta-form .dta-warn { margin-bottom:0 }
    .dta-problems { display:flex;flex-wrap:wrap;gap:6px }
    .dta-problem  { font-size:var(--text-body-sm);color:var(--color-danger) }
    .dta-form-footer { display:flex;justify-content:flex-end;gap:10px;margin-top:16px;
                       padding-top:14px;border-top:1px solid var(--color-outline-variant) }

    .table-scroll { overflow-x:auto }

    @media (max-width: 480px) {
      .dta-form-row { grid-template-columns:1fr }
    }
  `],
})
export class DocumentTypesAdminComponent implements OnChanges {
  /** The entity chosen in the Administration header — types are per country. */
  @Input() paysId!: number;

  private readonly svc   = inject(SharePointAdminService);
  private readonly i18n  = inject(TranslateService);
  private readonly modal = inject(ModalService);
  private modalRef: ModalRef | null = null;

  readonly formTpl  = viewChild.required<TemplateRef<unknown>>('formTpl');

  readonly types   = signal<DocumentTypeRow[]>([]);
  readonly loading = signal(false);
  /** False until the first answer — the "no type yet" warning must not flash while loading. */
  readonly loaded  = signal(false);
  readonly error   = signal<string | null>(null);
  /** Id of the row being (de)activated — its action is greyed meanwhile. */
  readonly busyId  = signal<number | null>(null);

  readonly activeCount = computed(() => this.types().filter(t => t.active).length);

  // ── Codes the application relies on ───────────────────────────────────────

  isSystem(code: string): boolean {
    return code in SYSTEM_TYPES;
  }

  /** Which flow uploads with this code — shown as the lock's tooltip and the form hint. */
  systemUse(code: string): string {
    const key = SYSTEM_TYPES[code];
    return key ? this.i18n.instant('ADMIN.documentTypes.system.usedBy', { flow: this.i18n.instant(key) }) : '';
  }

  /**
   * Protected codes absent or inactive in a CONFIGURED country. An unconfigured country runs on
   * the backend's built-in list, which has all three — no warning there.
   */
  readonly missingSystemTypes = computed(() => {
    const rows = this.types();
    if (!rows.length) return [];
    return Object.keys(SYSTEM_TYPES).filter(code => !rows.some(t => t.code === code && t.active));
  });

  // ── SharePoint folder per type (read-only here, edited in SharePoint › Chemins) ──

  /** code → configured folder template for this country, valid rows only. */
  private readonly folders = signal<Record<string, string>>({});

  private loadFolders(): void {
    this.svc.listLocations().subscribe({
      next: rows => {
        const map: Record<string, string> = {};
        for (const l of rows) {
          // Same filter as the resolver and the SharePoint card: an inactive or invalid row
          // is "not configured" as far as an upload is concerned.
          if (l.paysId === this.paysId && l.docKind && l.active && !l.problems.length) {
            map[l.docKind] = l.pathTemplate;
          }
        }
        this.folders.set(map);
      },
      // Informative column only — the catalogue stays fully usable without it.
      error: () => this.folders.set({}),
    });
  }

  // ── List: search, sort, page ──────────────────────────────────────────────

  readonly currentPage = signal(0);
  readonly sort        = signal<TableSort | null>(null);
  readonly searchQuery = signal('');

  /** Search, sort and page kept while the user stays in /rh/admin. */
  private readonly memory = rememberAdminState('document-types', {
    currentPage: this.currentPage, sort: this.sort, searchQuery: this.searchQuery,
  });

  onSearch(value: string): void {
    if (value === this.searchQuery()) return;   // daf-search-toolbar re-emits on blur
    this.searchQuery.set(value);
    this.currentPage.set(0);
  }

  onSortChange(key: string, dir: SortDirection): void {
    this.sort.set(toTableSort(key, dir));
    this.currentPage.set(0);
  }

  readonly filteredTypes = computed(() => {
    this.i18n.currentLang();
    return searchRows(this.types(), this.searchQuery(), t => [
      t.code, t.labelFr, t.labelEn,
      this.i18n.instant(t.active ? 'ADMIN.documentTypes.active' : 'ADMIN.documentTypes.inactive'),
    ]);
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredTypes().length / PAGE_SIZE)));

  private readonly pagedTypes = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return sortByColumn(this.filteredTypes(), this.sort(), DOC_TYPE_SORT).slice(start, start + PAGE_SIZE);
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.i18n.currentLang();
    const t = (k: string) => this.i18n.instant(k);
    return [
      { key: 'sortOrder', label: t('ADMIN.documentTypes.colOrder'),   align: 'center', width: '80px', sortable: true },
      { key: 'labelFr',   label: t('ADMIN.documentTypes.colLabelFr'), sortable: true, type: 'custom' },
      { key: 'labelEn',   label: t('ADMIN.documentTypes.colLabelEn'), sortable: true, type: 'custom' },
      { key: 'code',      label: t('ADMIN.documentTypes.colCode'),    width: '230px', sortable: true, type: 'custom' },
      { key: 'folder',    label: t('ADMIN.documentTypes.colFolder'),  type: 'custom' },
      { key: 'required',  label: t('ADMIN.documentTypes.colRequired'), align: 'center', width: '110px', sortable: true, type: 'custom' },
      { key: 'active',    label: t('ADMIN.documentTypes.colStatus'),  align: 'center', width: '120px', sortable: true, type: 'custom' },
    ];
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.i18n.currentLang();
    const t = (k: string) => this.i18n.instant(k);
    const src = (row: TableRow) => row['_source'] as DocumentTypeRow;
    // A seed read once by the table — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      showHeader: false,
      hoverable:  true,
      loading:    this.loading(),
      emptyMessage: t('ADMIN.documentTypes.empty'),
      rowId: (row: TableRow) => src(row).id,
      resizableColumns:  true,
      resizableRows:     true,
      columnPicker:      true,
      columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
      showReset:         true,
      resetLabel:        t('REQUESTS.TABLE.RESET'),
      sortLabel:         t('REQUESTS.TABLE.SORT_BY'),
      manualSort:        true,
      ...(sort ? { defaultSort: sort } : {}),
      actions: [
        {
          id: 'edit', icon: 'edit',
          tooltip: t('ADMIN.documentTypes.edit'),
          onClick: (row: TableRow) => this.openForm(src(row)),
        },
        {
          // A code the app uploads with: shown, greyed, never clickable.
          id: 'locked', icon: 'lock',
          tooltip: t('ADMIN.documentTypes.system.cannotDeactivate'),
          hidden:   (row: TableRow) => !(src(row).active && this.isSystem(src(row).code)),
          disabled: () => true,
          onClick:  () => {},
        },
        {
          id: 'deactivate', icon: 'toggle_on',
          tooltip: t('ADMIN.documentTypes.deactivate'),
          hidden:   (row: TableRow) => !src(row).active || this.isSystem(src(row).code),
          disabled: (row: TableRow) => this.busyId() === src(row).id,
          onClick:  (row: TableRow) => this.deactivate(src(row)),
        },
        {
          id: 'reactivate', icon: 'toggle_off',
          tooltip: t('ADMIN.documentTypes.reactivate'),
          hidden:   (row: TableRow) => src(row).active,
          disabled: (row: TableRow) => this.busyId() === src(row).id,
          onClick:  (row: TableRow) => this.reactivate(src(row)),
        },
      ],
    };
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedTypes().map(t => ({
      sortOrder: t.sortOrder,
      labelFr:   t.labelFr,
      labelEn:   t.labelEn,
      code:      t.code,
      required:  t.requiredForCompletion,
      active:    t.active,
      folder:    this.folders()[t.code] ?? null,
      systemUse: this.isSystem(t.code) ? this.systemUse(t.code) : null,
      _source:   t,
    })));

  // ── Loading ───────────────────────────────────────────────────────────────

  ngOnChanges(): void { this.load(); }

  private load(): void {
    if (this.paysId == null) return;
    this.loadFolders();
    this.loading.set(true);
    this.svc.listDocumentTypes(this.paysId).subscribe({
      next: rows => {
        this.types.set(rows);
        this.loading.set(false);
        this.loaded.set(true);
        // Restored page beyond the reloaded list → last existing page.
        if (this.currentPage() > this.totalPages() - 1) this.currentPage.set(this.totalPages() - 1);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.i18n.instant('ADMIN.documentTypes.loadError'));
      },
    });
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  readonly editing      = signal<DocumentTypeRow | null>(null);
  readonly fCode        = signal('');
  readonly fLabelFr     = signal('');
  readonly fLabelEn     = signal('');
  readonly fSortOrder   = signal<number | null>(100);
  readonly fActive      = signal(true);
  readonly fRequired    = signal(false);
  readonly formProblems = signal<string[]>([]);
  readonly saving       = signal(false);

  /** Same normalisation as DocumentTypeService.save: trimmed, upper-cased. */
  private readonly codeNormalized = computed(() => this.fCode().trim().toUpperCase());

  /**
   * The server's code rule, plus one it does not have: the PUT is an upsert, so typing an
   * existing code would silently overwrite that type's labels instead of creating a new one.
   */
  readonly codeError = computed<string | null>(() => {
    if (this.editing()) return null;
    const code = this.codeNormalized();
    if (!code) return null;
    if (!/^[A-Z0-9_]{1,100}$/.test(code)) return 'ADMIN.documentTypes.errors.CODE_INVALID';
    if (this.types().some(t => t.code === code)) return 'ADMIN.documentTypes.errors.CODE_TAKEN';
    return null;
  });

  readonly canSave = computed(() =>
    (!!this.editing() || !!this.codeNormalized())
    && !this.codeError()
    && !!this.fLabelFr().trim());

  openForm(existing: DocumentTypeRow | null): void {
    this.editing.set(existing);
    this.formProblems.set([]);
    this.fCode.set(existing?.code ?? '');
    this.fLabelFr.set(existing?.labelFr ?? '');
    this.fLabelEn.set(existing?.labelEn ?? '');
    // A new type goes to the end of the list by default.
    const last = Math.max(0, ...this.types().map(t => t.sortOrder));
    this.fSortOrder.set(existing?.sortOrder ?? (this.types().length ? last + 10 : 100));
    this.fActive.set(existing?.active ?? true);
    this.fRequired.set(existing?.requiredForCompletion ?? false);
    this.modalRef = this.modal.open({
      title: this.i18n.instant(existing ? 'ADMIN.documentTypes.editTitle' : 'ADMIN.documentTypes.addTitle'),
      body: this.formTpl(),
      size: 'md',
      closeOnBackdrop: false,
      minWidth: '360px', minHeight: '260px', resizable: true, maximizable: true,
    });
  }

  closeForm(): void {
    this.modalRef?.close();
  }

  save(): void {
    if (!this.canSave()) return;
    const paysId = this.paysId;
    const editing = this.editing();
    const code = editing?.code ?? this.codeNormalized();
    const required = this.fRequired();
    // The required flag (V121) is its own endpoint: only write it when it actually changes.
    const requiredChanged = required !== (editing?.requiredForCompletion ?? false);
    this.saving.set(true);
    this.formProblems.set([]);
    this.svc.saveDocumentType({
      paysId,
      code,
      labelFr:   this.fLabelFr().trim(),
      labelEn:   this.fLabelEn().trim() || null,
      active:    editing ? this.fActive() : true,
      sortOrder: this.fSortOrder() ?? undefined,
    }).subscribe({
      next: () => {
        if (!requiredChanged) { this.afterSave(); return; }
        // The type is saved either way; a refused flag must not undo it.
        this.svc.setRequired(paysId, code, required).subscribe({
          next:  () => this.afterSave(),
          error: err => {
            const cause = err?.error?.message as string | undefined;
            this.error.set(this.i18n.instant(err?.status === 409
              ? 'ADMIN.documentTypes.needsMigration' : 'ADMIN.documentTypes.saveError')
              + (cause ? ' — ' + cause : ''));
            this.afterSave();
          },
        });
      },
      error: err => {
        this.saving.set(false);
        // 422 carries DocumentTypeService's keys: DOC_TYPE.CODE.BLANK, DOC_TYPE.CODE.INVALID,
        // DOC_TYPE.LABEL.BLANK → ADMIN.documentTypes.errors.CODE_BLANK, …
        const problems: string[] | null = Array.isArray(err?.error) ? err.error : null;
        this.formProblems.set(problems?.length
          ? problems.map(p => 'ADMIN.documentTypes.errors.' + p.replace(/^DOC_TYPE\./, '').replace(/\./g, '_'))
          : ['ADMIN.documentTypes.saveError']);
      },
    });
  }

  private afterSave(): void {
    this.saving.set(false);
    this.modalRef?.close();
    this.error.set(null);
    this.load();
  }

  // ── Activation ────────────────────────────────────────────────────────────

  deactivate(row: DocumentTypeRow): void {
    if (this.isSystem(row.code)) return;   // the action is hidden; this is the belt to its braces
    this.busyId.set(row.id);
    this.error.set(null);
    this.svc.deactivateDocumentType(row.id).subscribe({
      next:  () => { this.busyId.set(null); this.load(); },
      error: () => { this.busyId.set(null); this.error.set(this.i18n.instant('ADMIN.documentTypes.saveError')); },
    });
  }

  /** No dedicated endpoint: the upsert with active=true and every other field unchanged. */
  reactivate(row: DocumentTypeRow): void {
    this.busyId.set(row.id);
    this.error.set(null);
    this.svc.saveDocumentType({
      paysId: this.paysId, code: row.code, labelFr: row.labelFr, labelEn: row.labelEn,
      active: true, sortOrder: row.sortOrder,
    }).subscribe({
      next:  () => { this.busyId.set(null); this.load(); },
      error: () => { this.busyId.set(null); this.error.set(this.i18n.instant('ADMIN.documentTypes.saveError')); },
    });
  }
}
