import { Component, Input, OnInit, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import {
  ButtonComponent, DataTableComponent, DafCellDirective, FormFieldComponent,
  ModalRef, ModalService, PaginationComponent, PaginationConfig, SelectComponent,
  StatusBadgeComponent, TableColumn, TableConfig, TableRow, TabItem, TabsComponent,
} from '@khalilrebhiitec/daf360';
import type { BadgeVariant, SelectOption } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FolderPickerComponent } from './folder-picker.component';
import {
  Diagnosis, DocKindInfo, EmployeeFolderRow, SharePointAdminService,
  SharePointLocation, SharePointStatus,
} from './sharepoint-admin.service';

type Panel = 'paths' | 'employees' | 'diagnose';

/** Same client-side page size as the other admin catalog tables (ref-data-admin,
 * request-types-admin) — both lists here are fetched whole from the backend. */
const PAGE_SIZE = 10;

/**
 * Status → badge colour. `null` (never looked up) is deliberately its own, neutral state:
 * before the batch action existed that was the condition of ~128 of 130 employees, and
 * showing it as a failure would have hidden the real point — nobody had ever asked.
 */
const STATUS_VARIANTS: Record<SharePointStatus, BadgeVariant> = {
  FOUND:              'success',
  NO_CONFIG:          'neutral',
  FOLDER_MISSING:     'danger',
  AMBIGUOUS:          'warning',
  AMBIGUOUS_EMPLOYEE: 'warning',
  NO_NAME:            'warning',
  UNAVAILABLE:        'info',
};

@Component({
  selector: 'app-sharepoint-admin',
  standalone: true,
  imports: [
    ButtonComponent, FormFieldComponent, SelectComponent, StatusBadgeComponent,
    DataTableComponent, DafCellDirective, FolderPickerComponent, TabsComponent,
    PaginationComponent, TranslatePipe,
  ],
  template: `
    <div class="spa-wrap">

      <div class="spa-header">
        <div>
          <h2 class="spa-title">{{ 'ADMIN.sharepoint.title' | translate }}</h2>
          <p class="spa-sub">{{ 'ADMIN.sharepoint.subtitle' | translate }}</p>
        </div>
        <div class="spa-kind">
          <daf-select
            [options]="kindOptions()"
            [config]="{ label: ('ADMIN.sharepoint.kindLabel' | translate), fullWidth: false }"
            [selected]="[docKind()]"
            (selectedChange)="onKindChange($event)" />
        </div>
      </div>

      @if (error()) { <div class="spa-error">{{ error() }}</div> }

      <!-- Real daf-tabs strip, same convention as regimes-admin / role-editor — not three
           stacked sections: the three answer different questions and only one is ever
           being read at a time. -->
      <daf-tabs
        class="spa-tabs"
        variant="underline"
        [tabs]="panelTabs()"
        [active]="panel()"
        (activeChange)="panel.set($any($event))" />

      <!-- ══ Panel 1: configured paths ══════════════════════════════════════ -->
      @if (panel() === 'paths') {
        <div class="spa-panel-head">
          <p class="spa-panel-hint">{{ 'ADMIN.sharepoint.paths.hint' | translate }}</p>
          <daf-button [label]="'ADMIN.sharepoint.paths.add' | translate"
                      variant="teal" [options]="{ iconStart: 'add' }"
                      (onClick)="openPathForm(null)" />
        </div>

        <div class="table-scroll">
          <daf-data-table [columns]="pathColumns()" [rows]="pathRows()" [config]="pathTableConfig()">
            <ng-template dafCell="pathTemplate" let-row>
              <code class="spa-path">{{ row['pathTemplate'] }}</code>
              @if (row['_source'].problems.length) {
                <div class="spa-problems">
                  @for (p of row['_source'].problems; track p) {
                    <span class="spa-problem">{{ p | translate }}</span>
                  }
                </div>
              }
            </ng-template>
          </daf-data-table>
        </div>

        @if (pathsTotalPages() > 1) {
          <div class="spa-pagination">
            <daf-pagination
              [currentPage]="pathsCurrentPage()"
              [totalPages]="pathsTotalPages()"
              [totalElements]="locations().length"
              [config]="paginationConfig"
              (pageChange)="onPathsPageChange($event)" />
          </div>
        }
      }

      <!-- ══ Panel 2: who resolves, who does not ════════════════════════════ -->
      @if (panel() === 'employees') {
        <div class="spa-panel-head">
          <p class="spa-panel-hint">{{ 'ADMIN.sharepoint.employees.hint' | translate }}</p>
          <daf-button
            [label]="(resolving() ? 'ADMIN.sharepoint.employees.resolving'
                                  : 'ADMIN.sharepoint.employees.resolveAll') | translate"
            variant="teal"
            [options]="{ iconStart: 'sync', disabled: resolving(), loading: resolving() }"
            (onClick)="resolveAll()" />
        </div>

        <!-- The tally, which is the number an operator actually reads -->
        @if (tally().length) {
          <div class="spa-tally">
            @for (t of tally(); track t.status) {
              <div class="spa-tally-item">
                <daf-badge [label]="('ADMIN.sharepoint.status.' + t.status) | translate"
                           [options]="{ variant: variantFor(t.status), size: 'sm' }" />
                <strong class="spa-tally-count">{{ t.count }}</strong>
              </div>
            }
          </div>
        }

        <div class="table-scroll">
          <daf-data-table [columns]="employeeColumns()" [rows]="employeeRows()" [config]="employeeTableConfig()">
            <ng-template dafCell="status" let-row>
              @if (row['_source'].status) {
                <daf-badge [label]="('ADMIN.sharepoint.status.' + row['_source'].status) | translate"
                           [options]="{ variant: variantFor(row['_source'].status), size: 'sm' }" />
              } @else {
                <daf-badge [label]="'ADMIN.sharepoint.status.NEVER' | translate"
                           [options]="{ variant: 'neutral', size: 'sm' }" />
              }
            </ng-template>
            <ng-template dafCell="folderSegment" let-row>
              @if (row['_source'].folderSegment) {
                <code class="spa-path">{{ row['_source'].folderSegment }}</code>
                @if (row['_source'].source === 'MANUAL') {
                  <span class="spa-manual">{{ 'ADMIN.sharepoint.employees.manual' | translate }}</span>
                }
              } @else if (row['_source'].lastError) {
                <span class="spa-detail">{{ row['_source'].lastError }}</span>
              } @else {
                <span class="spa-detail">—</span>
              }
            </ng-template>
          </daf-data-table>
        </div>

        @if (employeesTotalPages() > 1) {
          <div class="spa-pagination">
            <daf-pagination
              [currentPage]="employeesCurrentPage()"
              [totalPages]="employeesTotalPages()"
              [totalElements]="employees().length"
              [config]="paginationConfig"
              (pageChange)="onEmployeesPageChange($event)" />
          </div>
        }
      }

      <!-- ══ Panel 3: diagnosis ═════════════════════════════════════════════ -->
      @if (panel() === 'diagnose') {
        <p class="spa-panel-hint">{{ 'ADMIN.sharepoint.diagnose.hint' | translate }}</p>

        <div class="spa-diag-form">
          <daf-form-field
            [options]="{ label: ('ADMIN.sharepoint.diagnose.profileId' | translate),
                         type: 'number', fullWidth: false }"
            [value]="diagProfileId()"
            (valueChange)="diagProfileId.set($event === null || $event === '' ? null : +$event)" />
          <daf-button [label]="'ADMIN.sharepoint.diagnose.run' | translate"
                      variant="teal"
                      [options]="{ disabled: !diagProfileId() || diagnosing(), loading: diagnosing() }"
                      (onClick)="runDiagnose(false)" />
          <!-- Force exists because a remembered failure is trusted for 24h; after fixing a
               folder in SharePoint, waiting that out is not an acceptable answer. -->
          <daf-button [label]="'ADMIN.sharepoint.diagnose.force' | translate"
                      variant="secondary"
                      [options]="{ disabled: !diagProfileId() || diagnosing() }"
                      (onClick)="runDiagnose(true)" />
        </div>

        @if (diagnosis(); as d) {
          <div class="spa-diag-result">
            <div class="spa-diag-row">
              <span class="spa-diag-key">{{ 'ADMIN.sharepoint.diagnose.status' | translate }}</span>
              <daf-badge [label]="('ADMIN.sharepoint.status.' + d.status) | translate"
                         [options]="{ variant: variantFor(d.status), size: 'sm' }" />
            </div>
            @if (!d.graphConfigured) {
              <div class="spa-warn">{{ 'ADMIN.sharepoint.diagnose.notConfigured' | translate }}</div>
            }
            @if (d.detail) {
              <div class="spa-diag-row">
                <span class="spa-diag-key">{{ 'ADMIN.sharepoint.diagnose.detail' | translate }}</span>
                <span class="spa-detail">{{ d.detail }}</span>
              </div>
            }
            @if (d.employeeFolder) {
              <div class="spa-diag-row">
                <span class="spa-diag-key">{{ 'ADMIN.sharepoint.diagnose.folder' | translate }}</span>
                <code class="spa-path">{{ d.employeeFolder }}</code>
              </div>
            }
            @if (d.basePath) {
              <div class="spa-diag-row">
                <span class="spa-diag-key">{{ 'ADMIN.sharepoint.diagnose.path' | translate }}</span>
                <code class="spa-path">{{ d.basePath }}</code>
              </div>
            }
            @if (d.years.length) {
              <div class="spa-diag-row">
                <span class="spa-diag-key">{{ 'ADMIN.sharepoint.diagnose.years' | translate }}</span>
                <span class="spa-detail">{{ d.years.join(', ') }}</span>
              </div>
            }
            <!-- Files matter: a FOUND folder holding nothing looks identical to a resolution
                 failure from the employee's side of the app. -->
            <div class="spa-diag-row">
              <span class="spa-diag-key">{{ 'ADMIN.sharepoint.diagnose.files' | translate }}</span>
              @if (d.files.length) {
                <ul class="spa-files">
                  @for (f of d.files; track f) { <li><code class="spa-path">{{ f }}</code></li> }
                </ul>
              } @else {
                <span class="spa-detail">{{ 'ADMIN.sharepoint.diagnose.noFiles' | translate }}</span>
              }
            </div>
          </div>
        }
      }

      <!-- ══ Path form. Projected into the real daf-modal-host via ModalService, same
           convention as the other admin catalog pages. ═══════════════════════════ -->
      <ng-template #pathFormTpl>
        <div class="spa-form">
          <daf-form-field
            [options]="{ label: ('ADMIN.sharepoint.paths.paysId' | translate), type: 'number',
                         disabled: !!editingPath(), fullWidth: true }"
            [value]="formPaysId()"
            (valueChange)="onFormPaysChange($event)" />

          <daf-select
            [options]="kindOptions()"
            [config]="{ label: ('ADMIN.sharepoint.kindLabel' | translate),
                        disabled: !!editingPath(), fullWidth: true }"
            [selected]="[formKind()]"
            (selectedChange)="formKind.set($event[0])" />

          <div class="spa-form-path">
            <daf-form-field
              [options]="{ label: ('ADMIN.sharepoint.paths.template' | translate),
                           hint: pathHint(), fullWidth: true }"
              [value]="formTemplate()"
              (valueChange)="formTemplate.set($any($event) ?? '')" />
            <daf-button [label]="'ADMIN.sharepoint.paths.browse' | translate"
                        variant="secondary" [options]="{ iconStart: 'folder_open' }"
                        (onClick)="showPicker.set(true)" />
          </div>

          <!-- Tokens inserted as chips: they are literal placeholders, not free text, and
               mistyping one is the difference between a working path and every employee
               resolving to the same folder. -->
          <div class="spa-tokens">
            <span class="spa-tokens-label">{{ 'ADMIN.sharepoint.paths.tokens' | translate }}</span>
            <button type="button" class="spa-token" (click)="appendToken('{employeeFolder}')">
              {{ '{employeeFolder}' }}
            </button>
            @if (selectedKindYearScoped()) {
              <button type="button" class="spa-token" (click)="appendToken('{year}')">
                {{ '{year}' }}
              </button>
            }
          </div>

          @if (formProblems().length) {
            <div class="spa-problems">
              @for (p of formProblems(); track p) {
                <span class="spa-problem">{{ p | translate }}</span>
              }
            </div>
          }
        </div>
        <div class="spa-form-footer">
          <daf-button [label]="'ADMIN.sharepoint.cancel' | translate"
                      variant="secondary" (onClick)="closePathForm()" />
          <daf-button [label]="'ADMIN.sharepoint.save' | translate"
                      variant="teal"
                      [options]="{ disabled: !canSavePath() || savingPath(), loading: savingPath() }"
                      (onClick)="savePath()" />
        </div>
      </ng-template>

      <!-- ══ Manual override form ═══════════════════════════════════════════ -->
      <ng-template #pinFormTpl>
        <p class="spa-pin-who">{{ pinTarget()?.fullName }}</p>
        <p class="spa-panel-hint">{{ 'ADMIN.sharepoint.pin.hint' | translate }}</p>
        <daf-form-field
          [options]="{ label: ('ADMIN.sharepoint.pin.segment' | translate),
                       hint: ('ADMIN.sharepoint.pin.segmentHint' | translate), fullWidth: true }"
          [value]="pinSegment()"
          (valueChange)="pinSegment.set($any($event) ?? '')" />
        @if (pinProblem()) {
          <p class="spa-problem">{{ pinProblem()! | translate }}</p>
        }
        <div class="spa-form-footer">
          <daf-button [label]="'ADMIN.sharepoint.cancel' | translate"
                      variant="secondary" (onClick)="closePinForm()" />
          <daf-button [label]="'ADMIN.sharepoint.save' | translate"
                      variant="teal"
                      [options]="{ disabled: !pinSegment().trim() || pinning(), loading: pinning() }"
                      (onClick)="savePin()" />
        </div>
      </ng-template>

      <app-folder-picker
        [visible]="showPicker()"
        [startPath]="formTemplate()"
        (choose)="onPickedFolder($event)"
        (cancel)="showPicker.set(false)" />
    </div>
  `,
  styles: [`
    .spa-wrap { width:100% }
    .spa-header { display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:16px }
    .spa-title { font-size:var(--text-headline-md);font-weight:600;color:var(--color-on-surface);margin:0 }
    .spa-sub   { font-size:var(--text-body-sm);color:var(--color-on-surface-variant);margin:3px 0 0;max-width:62ch }
    .spa-kind  { min-width:220px }

    .spa-tabs { margin-bottom:16px }

    .spa-panel-head { display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px }
    .spa-panel-hint { font-size:var(--text-body-sm);color:var(--color-on-surface-variant);margin:0;max-width:70ch }

    .spa-tally { display:flex;flex-wrap:wrap;gap:14px;margin-bottom:14px;padding:12px 14px;
                 background:var(--color-surface-container);border-radius:10px }
    .spa-tally-item  { display:flex;align-items:center;gap:7px }
    .spa-tally-count { font-size:var(--text-body-md);color:var(--color-on-surface) }

    .spa-path { font-size:var(--text-body-sm);color:var(--color-on-surface);
                background:var(--color-surface-container);padding:2px 7px;border-radius:6px;word-break:break-all }
    .spa-manual { font-size:var(--text-label-sm);color:var(--color-warning);margin-left:7px;text-transform:uppercase;letter-spacing:.04em }
    .spa-detail { font-size:var(--text-body-sm);color:var(--color-on-surface-variant) }

    .spa-problems { display:flex;flex-wrap:wrap;gap:6px;margin-top:6px }
    .spa-problem  { font-size:var(--text-body-sm);color:var(--color-danger) }
    .spa-error { background:var(--color-error-container);border-radius:8px;padding:10px 14px;
                 font-size:var(--text-body-sm);color:var(--color-on-error-container);margin-bottom:14px }
    .spa-warn  { background:color-mix(in srgb, var(--color-warning) 14%, transparent);
                 border-radius:8px;padding:9px 13px;font-size:var(--text-body-sm);color:var(--color-warning) }

    .spa-form { display:flex;flex-direction:column;gap:14px }
    .spa-form-path { display:flex;align-items:flex-end;gap:10px }
    .spa-form-path daf-form-field { flex:1 }
    .spa-tokens { display:flex;flex-wrap:wrap;align-items:center;gap:8px }
    .spa-tokens-label { font-size:var(--text-body-sm);color:var(--color-on-surface-variant) }
    .spa-token { background:var(--color-secondary-container);border:0;border-radius:6px;
                 padding:3px 9px;cursor:pointer;font-family:inherit;font-size:var(--text-body-sm);
                 color:var(--color-on-secondary-container) }
    .spa-form-footer { display:flex;justify-content:flex-end;gap:10px;margin-top:16px;
                        padding-top:14px;border-top:1px solid var(--color-outline-variant) }

    .spa-diag-form { display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;margin-bottom:16px }
    .spa-diag-result { display:flex;flex-direction:column;gap:10px;padding:14px 16px;
                       border:1px solid var(--color-outline-variant);border-radius:10px }
    .spa-diag-row { display:flex;flex-wrap:wrap;align-items:baseline;gap:10px }
    .spa-diag-key { min-width:120px;font-size:var(--text-body-sm);color:var(--color-on-surface-variant) }
    .spa-files { list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px }

    .spa-pin-who { font-size:var(--text-body-md);font-weight:600;color:var(--color-on-surface);margin:0 0 4px }

    .spa-pagination { display:flex;justify-content:flex-end;padding:10px 0 }

    .table-scroll { overflow-x:auto }
  `],
})
export class SharePointAdminComponent implements OnInit {
  private readonly svc = inject(SharePointAdminService);
  private readonly i18n = inject(TranslateService);
  private readonly modal = inject(ModalService);

  /** The admin shell's current country, used as the default when adding a path. */
  @Input() paysId: number | null = null;

  readonly pathFormTpl = viewChild.required<TemplateRef<unknown>>('pathFormTpl');
  readonly pinFormTpl  = viewChild.required<TemplateRef<unknown>>('pinFormTpl');
  private pathModalRef: ModalRef | null = null;
  private pinModalRef:  ModalRef | null = null;

  readonly panel = signal<Panel>('paths');

  readonly panelTabs = computed<TabItem[]>(() => [
    { id: 'paths',     label: this.i18n.instant('ADMIN.sharepoint.panel.paths'),     icon: 'folder_open' },
    { id: 'employees', label: this.i18n.instant('ADMIN.sharepoint.panel.employees'), icon: 'group' },
    { id: 'diagnose',  label: this.i18n.instant('ADMIN.sharepoint.panel.diagnose'),  icon: 'troubleshoot' },
  ]);

  readonly kinds    = signal<DocKindInfo[]>([]);
  readonly docKind  = signal('PHOTO');
  readonly error    = signal<string | null>(null);

  /** Same client-side pagination config as the other admin catalog tables. */
  readonly paginationConfig: PaginationConfig = {
    showFirstLast: true,
    showPrevNext:  true,
    maxVisible:    5,
    size:          'sm',
  };

  // Panel 1
  readonly locations    = signal<SharePointLocation[]>([]);
  readonly loadingPaths = signal(false);
  readonly editingPath  = signal<SharePointLocation | null>(null);
  readonly formPaysId   = signal<number | null>(null);
  readonly formKind     = signal('');
  readonly formTemplate = signal('');
  readonly formProblems = signal<string[]>([]);
  readonly savingPath   = signal(false);
  readonly showPicker   = signal(false);
  readonly pathsCurrentPage = signal(0);

  // Panel 2
  readonly employees        = signal<EmployeeFolderRow[]>([]);
  readonly loadingEmployees = signal(false);
  readonly resolving        = signal(false);
  readonly pinTarget        = signal<EmployeeFolderRow | null>(null);
  readonly pinSegment       = signal('');
  readonly pinProblem       = signal<string | null>(null);
  readonly pinning          = signal(false);
  readonly employeesCurrentPage = signal(0);

  // Panel 3
  readonly diagProfileId = signal<number | null>(null);
  readonly diagnosis     = signal<Diagnosis | null>(null);
  readonly diagnosing    = signal(false);

  ngOnInit(): void {
    this.loadKinds();
    this.loadLocations();
    this.loadEmployees();
  }

  /**
   * Loads the configurable kinds for the current country.
   *
   * Re-run whenever the country changes: document types are per-country ({@code document_types},
   * V87), so the list of things a path can be configured for is not constant. Without the
   * country the endpoint returns only the three built-in kinds — which is what made document
   * folders unconfigurable from this screen.
   */
  /**
   * The country changed in the path form.
   *
   * Reloads the kinds, because document types belong to a country: keeping the previous
   * country's list would offer a type this one does not have, and the save would then be
   * rejected as an unknown kind with no clue why.
   */
  protected onFormPaysChange(value: string | number | null): void {
    this.formPaysId.set(value === null || value === '' ? null : +value);
    this.loadKinds();
  }

  private loadKinds(): void {
    this.svc.kinds(this.formPaysId() ?? this.paysId ?? undefined).subscribe({
      next: k => {
        this.kinds.set(k);
        if (k.length && !k.some(x => x.code === this.docKind())) this.docKind.set(k[0].code);
      },
      error: () => this.fail('ADMIN.sharepoint.errors.load'),
    });
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  readonly kindOptions = computed<SelectOption[]>(() =>
    this.kinds().map(k => {
      // Built-in kinds keep their translated names; a document type carries its own configured
      // label, which is the whole point of putting labels in the table — a new type has to be
      // readable here without an i18n entry being added first.
      if (!k.builtIn) return { value: k.code, label: k.label };
      const key = 'ADMIN.sharepoint.kind.' + k.code;
      const label = this.i18n.instant(key);
      return { value: k.code, label: label === key ? k.code : label };
    }));

  readonly selectedKindYearScoped = computed(() =>
    this.kinds().find(k => k.code === this.formKind())?.yearScoped ?? false);

  variantFor(status: SharePointStatus): BadgeVariant {
    return STATUS_VARIANTS[status] ?? 'neutral';
  }

  onKindChange(selected: string[]): void {
    const next = selected[0];
    if (!next || next === this.docKind()) return;
    this.docKind.set(next);
    this.diagnosis.set(null);
    this.employeesCurrentPage.set(0);
    this.loadEmployees();
  }

  private fail(key: string): void {
    this.error.set(this.i18n.instant(key));
  }

  // ── Panel 1: paths ────────────────────────────────────────────────────────

  private loadLocations(): void {
    this.loadingPaths.set(true);
    this.svc.listLocations().subscribe({
      next: rows => { this.locations.set(rows); this.loadingPaths.set(false); },
      error: () => { this.loadingPaths.set(false); this.fail('ADMIN.sharepoint.errors.load'); },
    });
  }

  readonly pathColumns = computed<TableColumn[]>(() => [
    { key: 'isoCode',      label: this.i18n.instant('ADMIN.sharepoint.paths.country'), width: '90px' },
    { key: 'docKind',      label: this.i18n.instant('ADMIN.sharepoint.kindLabel'),     width: '190px' },
    { key: 'pathTemplate', label: this.i18n.instant('ADMIN.sharepoint.paths.template') },
  ]);

  /** Native `TableConfig.actions`, not a hand-placed `_actions` column — same convention
   * as the other admin catalog tables (see document-templates-admin.component.ts). */
  readonly pathTableConfig = computed<TableConfig>(() => ({
    hoverable:    true,
    loading:      this.loadingPaths(),
    emptyMessage: this.i18n.instant('ADMIN.sharepoint.paths.empty'),
    actions: [
      {
        id: 'edit', icon: 'edit',
        tooltip: this.i18n.instant('ADMIN.sharepoint.paths.edit'),
        onClick: (row: TableRow) => this.openPathForm(row['_source'] as SharePointLocation),
      },
      {
        id: 'delete', icon: 'delete', variant: 'danger',
        tooltip: this.i18n.instant('ADMIN.sharepoint.paths.delete'),
        onClick: (row: TableRow) => this.deletePath(row['_source'] as SharePointLocation),
      },
    ],
  }));

  readonly pathsTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.locations().length / PAGE_SIZE)));

  onPathsPageChange(page: number): void {
    this.pathsCurrentPage.set(page);
  }

  private readonly pagedLocations = computed(() => {
    const start = this.pathsCurrentPage() * PAGE_SIZE;
    return this.locations().slice(start, start + PAGE_SIZE);
  });

  readonly pathRows = computed<TableRow[]>(() =>
    this.pagedLocations().map(l => ({
      isoCode: l.isoCode ?? '—',
      docKind: l.docKind ? this.i18n.instant('ADMIN.sharepoint.kind.' + l.docKind) : '—',
      pathTemplate: l.pathTemplate,
      _source: l,
    })));

  readonly pathHint = computed(() =>
    this.i18n.instant('ADMIN.sharepoint.paths.templateHint'));

  readonly canSavePath = computed(() =>
    !!this.formPaysId() && !!this.formKind() && !!this.formTemplate().trim());

  openPathForm(existing: SharePointLocation | null): void {
    this.editingPath.set(existing);
    this.formProblems.set([]);
    this.formPaysId.set(existing?.paysId ?? this.paysId ?? null);
    this.formKind.set(existing?.docKind ?? this.docKind());
    this.formTemplate.set(existing?.pathTemplate ?? '');
    this.pathModalRef = this.modal.open({
      title: this.i18n.instant('ADMIN.sharepoint.paths.formTitle'),
      body: this.pathFormTpl(),
      size: 'md',
      closeOnBackdrop: false,
    });
  }

  closePathForm(): void {
    this.pathModalRef?.close();
  }

  appendToken(token: string): void {
    const current = this.formTemplate().replace(/\/+$/, '');
    this.formTemplate.set(current ? `${current}/${token}` : token);
  }

  /**
   * The picker returns a real folder path; the tokens are appended afterwards. Kept separate
   * on purpose — the picker can only ever show folders that exist, and the per-employee part
   * of a template by definition does not.
   */
  onPickedFolder(path: string): void {
    this.showPicker.set(false);
    this.formTemplate.set(path);
  }

  savePath(): void {
    const paysId = this.formPaysId();
    if (!paysId) return;
    this.savingPath.set(true);
    this.formProblems.set([]);
    this.svc.saveLocation(paysId, this.formKind(), this.formTemplate().trim()).subscribe({
      next: () => {
        this.savingPath.set(false);
        this.pathModalRef?.close();
        this.loadLocations();
      },
      error: err => {
        this.savingPath.set(false);
        // 422 carries the same validation keys the resolver applies, so the form cannot save
        // a template the resolver would then silently ignore.
        const problems = Array.isArray(err?.error) ? err.error : null;
        this.formProblems.set(problems ?? ['ADMIN.sharepoint.errors.save']);
      },
    });
  }

  deletePath(row: SharePointLocation): void {
    this.svc.deleteLocation(row.id).subscribe({
      next: () => this.loadLocations(),
      error: () => this.fail('ADMIN.sharepoint.errors.save'),
    });
  }

  // ── Panel 2: employees ────────────────────────────────────────────────────

  private loadEmployees(): void {
    this.loadingEmployees.set(true);
    this.svc.listEmployees(this.docKind()).subscribe({
      next: rows => { this.employees.set(rows); this.loadingEmployees.set(false); },
      error: () => { this.loadingEmployees.set(false); this.fail('ADMIN.sharepoint.errors.load'); },
    });
  }

  readonly employeeColumns = computed<TableColumn[]>(() => [
    { key: 'fullName',      label: this.i18n.instant('ADMIN.sharepoint.employees.name') },
    { key: 'status',        label: this.i18n.instant('ADMIN.sharepoint.employees.status'), width: '150px' },
    { key: 'folderSegment', label: this.i18n.instant('ADMIN.sharepoint.employees.folder') },
  ]);

  /** Native `TableConfig.actions`, not a hand-placed `_actions` column — same convention
   * as the paths table above and the other admin catalog tables. */
  readonly employeeTableConfig = computed<TableConfig>(() => ({
    hoverable:    true,
    loading:      this.loadingEmployees(),
    emptyMessage: this.i18n.instant('ADMIN.sharepoint.employees.empty'),
    actions: [
      {
        id: 'diagnose', icon: 'troubleshoot',
        tooltip: this.i18n.instant('ADMIN.sharepoint.employees.diagnose'),
        onClick: (row: TableRow) => this.diagnoseFrom(row['_source'] as EmployeeFolderRow),
      },
      {
        id: 'pin', icon: 'edit_note',
        tooltip: this.i18n.instant('ADMIN.sharepoint.employees.pin'),
        onClick: (row: TableRow) => this.openPinForm(row['_source'] as EmployeeFolderRow),
      },
      {
        id: 'reset', icon: 'restart_alt',
        tooltip: this.i18n.instant('ADMIN.sharepoint.employees.reset'),
        onClick: (row: TableRow) => this.resetEmployee(row['_source'] as EmployeeFolderRow),
      },
    ],
  }));

  readonly employeesTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.employees().length / PAGE_SIZE)));

  onEmployeesPageChange(page: number): void {
    this.employeesCurrentPage.set(page);
  }

  private readonly pagedEmployees = computed(() => {
    const start = this.employeesCurrentPage() * PAGE_SIZE;
    return this.employees().slice(start, start + PAGE_SIZE);
  });

  readonly employeeRows = computed<TableRow[]>(() =>
    this.pagedEmployees().map(e => ({
      fullName: e.fullName,
      status: e.status ?? '',
      folderSegment: e.folderSegment ?? '',
      _source: e,
    })));

  /** Counts per status, worst first — the failures are what the operator is here for. */
  readonly tally = computed(() => {
    const counts = new Map<string, number>();
    for (const e of this.employees()) {
      const key = e.status ?? 'NEVER';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const order = ['FOLDER_MISSING', 'AMBIGUOUS', 'AMBIGUOUS_EMPLOYEE', 'NO_NAME',
                   'UNAVAILABLE', 'NEVER', 'NO_CONFIG', 'FOUND'];
    return [...counts.entries()]
      .map(([status, count]) => ({ status: status as SharePointStatus, count }))
      .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  });

  resolveAll(): void {
    this.resolving.set(true);
    this.error.set(null);
    this.svc.resolveAll(this.docKind(), true).subscribe({
      next: () => { this.resolving.set(false); this.loadEmployees(); },
      error: () => { this.resolving.set(false); this.fail('ADMIN.sharepoint.errors.resolve'); },
    });
  }

  openPinForm(row: EmployeeFolderRow): void {
    this.pinTarget.set(row);
    this.pinSegment.set(row.folderSegment ?? row.fullName);
    this.pinProblem.set(null);
    this.pinModalRef = this.modal.open({
      title: this.i18n.instant('ADMIN.sharepoint.pin.title'),
      body: this.pinFormTpl(),
      size: 'md',
      closeOnBackdrop: false,
    });
  }

  closePinForm(): void {
    this.pinModalRef?.close();
  }

  savePin(): void {
    const target = this.pinTarget();
    if (!target) return;
    this.pinning.set(true);
    this.pinProblem.set(null);
    this.svc.pinFolder(target.profileId, this.docKind(), this.pinSegment().trim()).subscribe({
      next: () => { this.pinning.set(false); this.pinModalRef?.close(); this.loadEmployees(); },
      error: err => {
        this.pinning.set(false);
        // The backend refuses an override pointing at a folder that does not exist — one that
        // looks configured but resolves to nothing is worse than none at all.
        this.pinProblem.set(typeof err?.error === 'string'
          ? err.error : 'ADMIN.sharepoint.errors.save');
      },
    });
  }

  resetEmployee(row: EmployeeFolderRow): void {
    this.svc.clearFolder(row.profileId, this.docKind()).subscribe({
      next: () => this.loadEmployees(),
      error: () => this.fail('ADMIN.sharepoint.errors.save'),
    });
  }

  diagnoseFrom(row: EmployeeFolderRow): void {
    this.diagProfileId.set(row.profileId);
    this.panel.set('diagnose');
    this.runDiagnose(false);
  }

  // ── Panel 3: diagnosis ────────────────────────────────────────────────────

  runDiagnose(force: boolean): void {
    const id = this.diagProfileId();
    if (!id) return;
    this.diagnosing.set(true);
    this.error.set(null);
    this.svc.diagnose(id, this.docKind(), force).subscribe({
      next: d => { this.diagnosis.set(d); this.diagnosing.set(false); },
      error: () => { this.diagnosing.set(false); this.fail('ADMIN.sharepoint.errors.load'); },
    });
  }
}
