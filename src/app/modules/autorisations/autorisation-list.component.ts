import { Component, Input, OnInit, TemplateRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Observable } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  AvatarComponent, ButtonComponent, DafCellDirective, DataTableComponent, FilterField, FilterResult,
  FormFieldComponent, MetricCardComponent, ModalService, ModalRef, PageComponent,
  PageHeaderComponent, PaginationComponent, SearchToolbarComponent, SearchToolbarFilterConfig,
  SortDirection, StatusBadgeComponent, TableAction, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { NotificationService } from '../../core/notification.service';
import { saveBlob } from '../../shared/utils/file-download.utils';
import { AutorisationsService } from './autorisations.service';
import {
  AutorisationCounts, AutorisationEtat, AutorisationFilter, AutorisationPage, AutorisationRow,
} from './models/autorisation.model';
import { errorMessage, etatVariant, formatMinutes, hhmm } from './autorisation-display';

/** Which queue this page is showing. */
export type AutorisationScope = 'queue' | 'mine' | 'team' | 'global';

/**
 * The four autorisation screens — `/rh/autorisations/{queue,mine,team,global}`.
 *
 * ONE COMPONENT, FOUR ROUTES. The timesheet had these as four pages showing the same columns
 * with the same filters against four endpoints of different scope; they are one component
 * with a `scope` here, so a change to the filter grammar or the row layout cannot land in one
 * and miss the others. {@code CongeHistoryComponent} does the same for its two.
 *
 * THE SCOPE DECIDES FOUR THINGS AND NOTHING ELSE: which endpoint is called, which title is
 * shown, whether the decision actions appear, and whether archiving is offered.
 *
 * WHAT EACH ONE COVERS
 * -----------------------------------------------------------------------------
 *   queue  — waiting on the caller as responsable or adjoint. The only one that decides.
 *   mine   — the caller's own, whatever their role.
 *   team   — everyone below the caller in the role hierarchy, resolved server-side. No pays
 *            filter: a manager with reports in two countries manages both.
 *   global — bounded by the caller's ROLE PAYS SCOPE (V74), read from the token. The filter
 *            narrows within that ceiling and can never widen it.
 */
@Component({
  selector: 'app-autorisation-list',
  standalone: true,
  imports: [
    PageComponent, PageHeaderComponent, ButtonComponent, MetricCardComponent, SearchToolbarComponent,
    PaginationComponent, DataTableComponent, DafCellDirective, StatusBadgeComponent,
    AvatarComponent, FormFieldComponent, TranslatePipe, DatePipe, NgTemplateOutlet,
  ],
  template: `
    <daf-page [loading]="firstLoad()" [kpis]="4">

      <!-- No icon on the page header: platform convention. -->
      <daf-page-header
        [title]="titleKey() | translate"
        [subtitle]="subtitleKey() | translate">
        <!-- Country-wide view only: the export replaces the timesheet's, same filters as the list. -->
        @if (scope === 'global') {
          <ng-container pageActions>
            <daf-button
              [options]="{ variant: 'secondary', iconStart: 'download',
                           label: ('COMMON.exportExcel' | translate), disabled: exporting() }"
              (onClick)="exportExcel()" />
          </ng-container>
        }
      </daf-page-header>

      <!-- Counted over the whole scope by its own endpoint, never over the current page. -->
      <section class="grid grid-cols-4 gap-2 sm:gap-6">
        <daf-metric-card
          [label]="'AUTORISATIONS.KPI.TOTAL' | translate" [value]="kpi()['TOTAL'] "
          [options]="{ icon: 'schedule', iconColor: 'text-primary', iconBg: 'bg-primary/10' }" />
        <daf-metric-card
          [label]="'AUTORISATIONS.KPI.PENDING' | translate" [value]="kpi()['EN_ATTENTE'] "
          [options]="{ icon: 'hourglass_top', iconColor: 'text-warning', iconBg: 'bg-warning/10' }" />
        <daf-metric-card
          [label]="'AUTORISATIONS.KPI.APPROVED' | translate" [value]="kpi()['VALIDE'] "
          [options]="{ icon: 'check_circle', iconColor: 'text-success', iconBg: 'bg-success/10' }" />
        <daf-metric-card
          [label]="'AUTORISATIONS.KPI.REFUSED' | translate" [value]="kpi()['REFUSE'] "
          [options]="{ icon: 'cancel', iconColor: 'text-danger', iconBg: 'bg-danger/10' }" />
      </section>

      <daf-search-toolbar
        [placeholder]="'AUTORISATIONS.SEARCH' | translate"
        [value]="search()"
        [debounce]="300"
        (valueChange)="onSearch($event)"
        [filterFields]="filterFields()"
        [filterConfig]="filterConfig()"
        (filterApply)="applyFilters($event)" />

      @if (error()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>{{ error() }}
        </div>
      }

      <daf-data-table [columns]="columns()" [rows]="tableRows()" [config]="tableConfig()"
                      (sortChange)="onSort($event)" class="block min-w-0">

        <ng-template dafCell="collaborateur" let-row>
          <div class="flex min-w-0 items-center gap-2">
            <daf-avatar [data]="{ name: row['_s'].collaborateurNom ?? '—',
                                  avatarUrl: row['_s'].collaborateurAvatarUrl }" size="sm" />
            <span class="truncate">{{ row['_s'].collaborateurNom ?? '—' }}</span>
          </div>
        </ng-template>

        <!-- The slot and what it costs, together: the quota is spent in minutes, so the
             figure that matters is beside the times rather than inferred from them. -->
        <ng-template dafCell="creneau" let-row>
          <div class="flex min-w-0 flex-col leading-tight">
            <span>{{ hhmm(row['_s'].startTime) }} – {{ hhmm(row['_s'].endTime) }}</span>
            <span class="text-body-sm text-on-surface-variant">
              {{ fmt(row['_s'].dureeMinutes) }}
            </span>
          </div>
        </ng-template>

        <ng-template dafCell="etat" let-row>
          <div class="flex items-center gap-1.5">
            <daf-badge [label]="row['_s'].etatLabel"
                       [options]="{ variant: variant(row['_s'].etatDemande), size: 'sm', dot: true }" />
            @if (row['_s'].settled) {
              <daf-badge [label]="'AUTORISATIONS.SETTLED' | translate"
                         [options]="{ variant: 'info', size: 'sm' }" />
            }
          </div>
        </ng-template>
      </daf-data-table>

      @if (totalPages() > 0) {
        <daf-pagination
          [currentPage]="currentPage()" [totalPages]="totalPages()"
          [totalElements]="totalElements()" [pageSize]="pageSize()"
          [pageSizeOptions]="pageSizeOptions"
          [perPageLabel]="'PROFILES.LIST.PER_PAGE' | translate"
          [summaryLabel]="'PROFILES.LIST.RANGE_SUMMARY' | translate"
          (pageChange)="onPageChange($event)" (pageSizeChange)="onPageSizeChange($event)" />
      }

      <!-- ── Modal bodies ─────────────────────────────────────────────────────
           Every action restates WHICH request it acts on — who, which day, which slot, how
           long — before saying what the action does. A confirmation that only names the
           employee leaves the approver guessing between two pending slots of the same day. -->

      <!-- The request itself, shared by every body below. -->
      <ng-template #summaryTpl>
        @if (detailRow(); as r) {
          <div class="flex flex-col gap-3 rounded-xl bg-surface-container-low p-3">
            <div class="flex items-center justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <daf-avatar [data]="{ name: r.collaborateurNom ?? '—',
                                      avatarUrl: r.collaborateurAvatarUrl }" size="md" />
                <div class="flex min-w-0 flex-col">
                  <span class="truncate font-semibold">{{ r.collaborateurNom ?? '—' }}</span>
                  @if (r.responsableNom) {
                    <span class="truncate text-body-sm text-on-surface-variant">
                      {{ 'AUTORISATIONS.APPROVER' | translate }} : {{ r.responsableNom }}
                    </span>
                  }
                </div>
              </div>
              <daf-badge [label]="r.etatLabel"
                         [options]="{ variant: variant(r.etatDemande), size: 'sm', dot: true }" />
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="flex flex-col gap-0.5">
                <span class="text-label-sm text-on-surface-variant">{{ 'AUTORISATIONS.COL.DATE' | translate }}</span>
                <span class="text-body-md font-medium">{{ r.dateAutorisation | date: 'EEE dd/MM/yyyy' }}</span>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-label-sm text-on-surface-variant">{{ 'AUTORISATIONS.COL.SLOT' | translate }}</span>
                <span class="text-body-md font-medium tabular-nums">{{ hhmm(r.startTime) }} – {{ hhmm(r.endTime) }}</span>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-label-sm text-on-surface-variant">{{ 'AUTORISATIONS.DURATION' | translate }}</span>
                <span class="text-body-md font-semibold">{{ fmt(r.dureeMinutes) }}</span>
              </div>
            </div>
            @if (r.reason) {
              <div class="flex flex-col gap-0.5">
                <span class="text-label-sm text-on-surface-variant">{{ 'AUTORISATIONS.REASON' | translate }}</span>
                <p class="text-body-md whitespace-pre-line">{{ r.reason }}</p>
              </div>
            }
          </div>
        }
      </ng-template>

      <ng-template #detailTpl>
        @if (detailRow(); as r) {
          <div class="flex flex-col gap-4">
            <ng-container [ngTemplateOutlet]="summaryTpl" />

            @if (r.motifRefus) {
              <div class="flex flex-col gap-1 rounded-xl bg-danger/10 p-3">
                <span class="text-label-sm text-danger">{{ 'AUTORISATIONS.MOTIF_REFUS' | translate }}</span>
                <p class="text-body-md whitespace-pre-line">{{ r.motifRefus }}</p>
              </div>
            }
            @if (r.motifAnnulation) {
              <div class="flex flex-col gap-1 rounded-xl bg-surface-container-low p-3">
                <span class="text-label-sm text-on-surface-variant">{{ 'AUTORISATIONS.MOTIF_ANNULATION' | translate }}</span>
                <p class="text-body-md whitespace-pre-line">{{ r.motifAnnulation }}</p>
              </div>
            }

            <!-- The trail: who filed it, when, and who decided. -->
            <ul class="flex flex-col gap-1.5 text-body-sm text-on-surface-variant">
              @if (r.createdAt) {
                <li class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">send</span>
                  {{ 'AUTORISATIONS.FILED_ON' | translate }} {{ r.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                  @if (r.settled && r.createdByNom) {
                    · {{ 'AUTORISATIONS.FILED_BY' | translate }} {{ r.createdByNom }}
                  }
                </li>
              }
              @if (r.settled) {
                <li class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">history_edu</span>
                  {{ 'AUTORISATIONS.SETTLED_HINT' | translate }}
                </li>
              }
              @if (r.decidedByNom) {
                <li class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">gavel</span>
                  {{ 'AUTORISATIONS.DECIDED_BY' | translate }} {{ r.decidedByNom }}
                  @if (r.dateValidation) { · {{ r.dateValidation | date: 'dd/MM/yyyy' }} }
                </li>
              } @else if (r.etatDemande === 'EN_ATTENTE') {
                <li class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">hourglass_top</span>
                  {{ 'AUTORISATIONS.AWAITING' | translate }}
                </li>
              }
            </ul>
          </div>
        }
      </ng-template>

      <ng-template #approveTpl>
        @if (detailRow(); as r) {
          <div class="flex flex-col gap-3">
            <ng-container [ngTemplateOutlet]="summaryTpl" />
            <p class="flex items-start gap-2 text-body-md">
              <span class="material-symbols-outlined text-[18px] text-success">check_circle</span>
              {{ 'AUTORISATIONS.APPROVE_INTRO' | translate: { minutes: fmt(r.dureeMinutes) } }}
            </p>
          </div>
        }
      </ng-template>

      <ng-template #refuseTpl>
        <div class="flex flex-col gap-3">
          <ng-container [ngTemplateOutlet]="summaryTpl" />
          <p class="flex items-start gap-2 text-body-md">
            <span class="material-symbols-outlined text-[18px] text-tertiary">info</span>
            {{ 'AUTORISATIONS.REFUSE_INTRO' | translate }}
          </p>
          <daf-form-field
            [options]="{ label: ('AUTORISATIONS.MOTIF_REFUS' | translate), type: 'textarea',
                         required: true, fullWidth: true, rows: 3,
                         placeholder: ('AUTORISATIONS.MOTIF_PH' | translate) }"
            [value]="refuseMotif()"
            (valueChange)="refuseMotif.set($any($event) ?? '')" />
        </div>
      </ng-template>

      <ng-template #withdrawTpl>
        <div class="flex flex-col gap-3">
          <ng-container [ngTemplateOutlet]="summaryTpl" />
          <p class="flex items-start gap-2 text-body-md">
            <span class="material-symbols-outlined text-[18px] text-tertiary">info</span>
            {{ 'AUTORISATIONS.WITHDRAW_INTRO' | translate }}
          </p>
          <daf-form-field
            [options]="{ label: ('AUTORISATIONS.MOTIF_ANNULATION' | translate), type: 'textarea',
                         required: true, fullWidth: true, rows: 3,
                         placeholder: ('AUTORISATIONS.MOTIF_PH' | translate) }"
            [value]="refuseMotif()"
            (valueChange)="refuseMotif.set($any($event) ?? '')" />
        </div>
      </ng-template>

      <ng-template #archiveTpl>
        <div class="flex flex-col gap-3">
          <ng-container [ngTemplateOutlet]="summaryTpl" />
          <p class="flex items-start gap-2 text-body-md">
            <span class="material-symbols-outlined text-[18px] text-tertiary">info</span>
            {{ 'AUTORISATIONS.ARCHIVE_INTRO' | translate }}
          </p>
        </div>
      </ng-template>

    </daf-page>
  `,
})
export class AutorisationListComponent implements OnInit {
  /**
   * Read from the route's `data.scope`, not bound as an @Input: rh-frontend calls
   * provideRouter(routes) WITHOUT withComponentInputBinding(), so a route-data binding would
   * silently never arrive and every page would render as the default.
   */
  @Input() scope: AutorisationScope = 'queue';

  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(AutorisationsService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly firstLoad = signal(true);
  readonly loading = signal(false);
  readonly working = signal(false);
  readonly error = signal<string | null>(null);

  readonly rows = signal<AutorisationRow[]>([]);
  readonly kpi = signal<AutorisationCounts>({});

  readonly search = signal('');
  readonly etatFilter = signal<AutorisationEtat | null>(null);
  readonly fromFilter = signal<string | null>(null);
  readonly toFilter = signal<string | null>(null);

  readonly currentPage = signal(0);
  readonly pageSize = signal(10);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly pageSizeOptions = [10, 25, 50];

  readonly sortKey = signal('dateAutorisation');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  private readonly detailTpl = viewChild.required<TemplateRef<unknown>>('detailTpl');
  private readonly refuseTpl = viewChild.required<TemplateRef<unknown>>('refuseTpl');
  private readonly approveTpl = viewChild.required<TemplateRef<unknown>>('approveTpl');
  private readonly withdrawTpl = viewChild.required<TemplateRef<unknown>>('withdrawTpl');
  private readonly archiveTpl = viewChild.required<TemplateRef<unknown>>('archiveTpl');
  /** The row every open modal is about — the shared summary block reads it. */
  readonly detailRow = signal<AutorisationRow | null>(null);
  readonly refuseMotif = signal('');

  protected readonly fmt = formatMinutes;
  protected readonly hhmm = hhmm;
  protected readonly variant = etatVariant;

  ngOnInit(): void {
    const fromRoute = this.route.snapshot.data['scope'] as AutorisationScope | undefined;
    if (fromRoute) this.scope = fromRoute;
    this.refreshAll();
  }

  // ── Titles ────────────────────────────────────────────────────────────────

  titleKey(): string    { return `AUTORISATIONS.TITLE_${this.scope.toUpperCase()}`; }
  subtitleKey(): string { return `AUTORISATIONS.SUB_${this.scope.toUpperCase()}`; }

  /** Deciding belongs to the approver's queue; archiving to the country-wide view. */
  private get canDecide(): boolean { return this.scope === 'queue'; }
  private get canArchive(): boolean { return this.scope === 'global'; }
  private get canWithdraw(): boolean { return this.scope === 'mine'; }

  // ── Data ──────────────────────────────────────────────────────────────────

  readonly exporting = signal(false);

  /** The global scope, with the filters on screen, as an Excel file. */
  exportExcel(): void {
    this.exporting.set(true);
    const f: AutorisationFilter = {
      etat: this.etatFilter(), from: this.fromFilter(), to: this.toFilter(),
      sort: this.sortKey(), dir: this.sortDir(),
    };
    this.svc.exportGlobal(f, this.translate.currentLang() ?? 'fr').subscribe({
      next: (blob) => { saveBlob(blob, 'autorisations.xlsx'); this.exporting.set(false); },
      error: (e) => {
        this.exporting.set(false);
        this.notify.error(errorMessage(e, this.translate.instant('COMMON.exportError')));
      },
    });
  }

  private fetch(): Observable<AutorisationPage> {
    const lang = this.translate.currentLang() ?? 'fr';
    const f: AutorisationFilter = {
      etat: this.etatFilter(), from: this.fromFilter(), to: this.toFilter(),
      page: this.currentPage(), size: this.pageSize(),
      sort: this.sortKey(), dir: this.sortDir(),
    };
    switch (this.scope) {
      case 'mine':   return this.svc.mine(f, lang);
      case 'team':   return this.svc.team(f, lang);
      case 'global': return this.svc.global(f, lang);
      default:       return this.svc.queue(f, lang);
    }
  }

  refreshAll(): void {
    this.load();
    const countScope = this.scope === 'queue' ? 'manager' : this.scope === 'global' ? 'global' : 'mine';
    this.svc.counts(countScope).subscribe({
      next: c => this.kpi.set(c),
      // A failed count costs the four figures and nothing else — the table still renders.
      error: () => { /* keep the last known figures */ },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fetch().subscribe({
      next: p => {
        this.rows.set(p.content ?? []);
        this.totalPages.set(p.totalPages );
        this.totalElements.set(p.totalElements );
        this.loading.set(false);
        this.firstLoad.set(false);
      },
      error: e => {
        this.rows.set([]);
        this.error.set(errorMessage(e, this.translate.instant('AUTORISATIONS.ERR_LOAD')));
        this.loading.set(false);
        this.firstLoad.set(false);
      },
    });
  }

  // ── Table ─────────────────────────────────────────────────────────────────

  columns(): TableColumn[] {
    this.translate.currentLang();
    const cols: TableColumn[] = [];
    // The employee column is noise on "mine" — every row is the same person.
    if (this.scope !== 'mine') {
      cols.push({ key: 'collaborateur', label: this.translate.instant('AUTORISATIONS.COL.EMPLOYEE') });
    }
    cols.push(
      { key: 'dateAutorisation', label: this.translate.instant('AUTORISATIONS.COL.DATE'),
        sortable: true, width: '130px' },
      { key: 'creneau', label: this.translate.instant('AUTORISATIONS.COL.SLOT'), width: '150px' },
      { key: 'reason', label: this.translate.instant('AUTORISATIONS.COL.REASON') },
      { key: 'etat', label: this.translate.instant('AUTORISATIONS.COL.STATE'),
        sortable: true, width: '190px' },
      { key: 'motifRefus', label: this.translate.instant('AUTORISATIONS.COL.MOTIF') },
    );
    return cols;
  }

  /** `_s` carries the typed row through the table's untyped map — the module's convention. */
  tableRows(): TableRow[] {
    return this.rows().map(r => ({
      id: r.id,
      dateAutorisation: r.dateAutorisation,
      reason: r.reason ?? '—',
      motifRefus: r.motifRefus ?? '—',
      etat: r.etatDemande,
      _s: r,
    } as unknown as TableRow));
  }

  tableConfig(): TableConfig {
    return {
      manualSort: true,
      resizableColumns: true,
      columnPicker: true,
      loading: this.loading(),
      skeletonRows: this.pageSize(),
      emptyMessage: this.translate.instant('AUTORISATIONS.EMPTY'),
      actions: this.actions(),
    } as TableConfig;
  }

  /**
   * Row actions, by scope and by state.
   *
   * `hidden` is evaluated per row, so one declaration covers every case — the lib's own
   * mechanism rather than a projected cell template, which a content query cannot reach
   * through an intermediate component.
   */
  private actions(): TableAction[] {
    this.translate.currentLang();
    const src = (row: TableRow) => row['_s'] as AutorisationRow;
    const pending = (row: TableRow) => src(row).etatDemande === 'EN_ATTENTE';

    return [
      {
        id: 'view', icon: 'visibility',
        tooltip: this.translate.instant('AUTORISATIONS.CONSULT'),
        onClick: (row) => this.openDetail(src(row)),
      },
      {
        id: 'approve', icon: 'check_circle',
        tooltip: this.translate.instant('AUTORISATIONS.APPROVE'),
        hidden: (row) => !this.canDecide || !pending(row),
        disabled: () => this.working(),
        onClick: (row) => this.confirmApprove(src(row)),
      },
      {
        id: 'refuse', icon: 'cancel', variant: 'danger',
        tooltip: this.translate.instant('AUTORISATIONS.REFUSE'),
        hidden: (row) => !this.canDecide || !pending(row),
        disabled: () => this.working(),
        onClick: (row) => this.openRefuse(src(row)),
      },
      {
        id: 'withdraw', icon: 'undo', variant: 'danger',
        tooltip: this.translate.instant('AUTORISATIONS.WITHDRAW'),
        hidden: (row) => !this.canWithdraw || !pending(row),
        disabled: () => this.working(),
        onClick: (row) => this.openWithdraw(src(row)),
      },
      {
        id: 'archive', icon: 'archive',
        tooltip: this.translate.instant('AUTORISATIONS.ARCHIVE'),
        hidden: (row) => !this.canArchive || src(row).etatDemande === 'ARCHIVE',
        disabled: () => this.working(),
        onClick: (row) => this.confirmArchive(src(row)),
      },
    ];
  }

  onSort(e: { key: string; dir: SortDirection }): void {
    this.sortKey.set(e.key);
    // The table's SortDirection includes null (a third click clears it); the endpoint always
    // needs one, so a cleared header falls back to descending.
    this.sortDir.set(e.dir === 'asc' ? 'asc' : 'desc');
    this.currentPage.set(0);
    this.load();
  }

  onPageChange(p: number): void { this.currentPage.set(p); this.load(); }

  onPageSizeChange(s: number): void {
    this.pageSize.set(s);
    this.currentPage.set(0);
    this.load();
  }

  // ── Search and filters ────────────────────────────────────────────────────

  onSearch(value: string): void {
    this.search.set(value);
    this.currentPage.set(0);
    this.load();
  }

  filterFields(): FilterField[] {
    this.translate.currentLang();
    const fields: FilterField[] = [{
      name: 'etat',
      label: this.translate.instant('AUTORISATIONS.COL.STATE'),
      type: 'select',
      placeholder: this.translate.instant('AUTORISATIONS.FILTER.ALL'),
      options: (['EN_ATTENTE', 'VALIDE', 'REFUSE', 'ARCHIVE'] as AutorisationEtat[])
        .map(e => ({ value: e, label: this.translate.instant('AUTORISATIONS.ETAT.' + e) })),
    }];
    // Only the country-wide view spans enough time for a date range to be useful.
    if (this.scope === 'global') {
      fields.push(
        { name: 'from', label: this.translate.instant('AUTORISATIONS.FILTER.FROM'), type: 'date' },
        { name: 'to',   label: this.translate.instant('AUTORISATIONS.FILTER.TO'),   type: 'date' },
      );
    }
    return fields;
  }

  filterConfig(): SearchToolbarFilterConfig {
    this.translate.currentLang();
    return {
      title: this.translate.instant('AUTORISATIONS.FILTER.TITLE'),
      applyLabel: this.translate.instant('AUTORISATIONS.FILTER.APPLY'),
      resetLabel: this.translate.instant('AUTORISATIONS.FILTER.RESET'),
    } as SearchToolbarFilterConfig;
  }

  applyFilters(result: FilterResult): void {
    const one = (v: unknown) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
    this.etatFilter.set(one(result['etat']) as AutorisationEtat | null);
    this.fromFilter.set(this.iso(one(result['from'])));
    this.toFilter.set(this.iso(one(result['to'])));
    this.currentPage.set(0);
    this.load();
  }

  /** Built from parts: `toISOString()` shifts to UTC and loses a day west of Greenwich. */
  private iso(v: unknown): string | null {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-`
         + String(d.getDate()).padStart(2, '0');
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  openDetail(row: AutorisationRow): void {
    this.detailRow.set(row);
    this.modal.open({
      title: this.translate.instant('AUTORISATIONS.DETAIL_TITLE'),
      subtitle: this.translate.instant('AUTORISATIONS.DETAIL_SUB'),
      icon: 'schedule',
      body: this.detailTpl(),
      size: 'md',
      buttons: [{ label: this.translate.instant('AUTORISATIONS.CLOSE'), variant: 'secondary',
                  action: (r: ModalRef) => r.close() }],
    });
  }

  private confirmApprove(row: AutorisationRow): void {
    this.detailRow.set(row);
    this.modal.open({
      title: this.translate.instant('AUTORISATIONS.APPROVE_TITLE'),
      subtitle: this.translate.instant('AUTORISATIONS.APPROVE_SUB', {
        employee: row.collaborateurNom ?? '',
      }),
      icon: 'check_circle',
      body: this.approveTpl(),
      size: 'md',
      buttons: [
        { label: this.translate.instant('AUTORISATIONS.CANCEL'), variant: 'secondary',
          action: (r: ModalRef) => r.close() },
        { label: this.translate.instant('AUTORISATIONS.APPROVE'), variant: 'primary', icon: 'check',
          action: (r: ModalRef) => { r.close(); this.decide(row, true); } },
      ],
    });
  }

  private openRefuse(row: AutorisationRow): void {
    this.detailRow.set(row);
    this.refuseMotif.set('');
    this.modal.open({
      title: this.translate.instant('AUTORISATIONS.REFUSE_TITLE'),
      subtitle: this.translate.instant('AUTORISATIONS.REFUSE_SUB', {
        employee: row.collaborateurNom ?? '',
      }),
      icon: 'cancel',
      body: this.refuseTpl(),
      size: 'md',
      buttons: [
        { label: this.translate.instant('AUTORISATIONS.CANCEL'), variant: 'secondary',
          action: (r: ModalRef) => r.close() },
        { label: this.translate.instant('AUTORISATIONS.REFUSE'), variant: 'primary', icon: 'close',
          action: (r: ModalRef) => {
            if (!this.refuseMotif().trim()) {
              this.notify.error(this.translate.instant('AUTORISATIONS.MOTIF_REQUIRED'));
              return;
            }
            r.close();
            this.decide(row, false, this.refuseMotif().trim());
          } },
      ],
    });
  }

  private openWithdraw(row: AutorisationRow): void {
    this.detailRow.set(row);
    this.refuseMotif.set('');
    this.modal.open({
      title: this.translate.instant('AUTORISATIONS.WITHDRAW_TITLE'),
      subtitle: this.translate.instant('AUTORISATIONS.WITHDRAW_SUB'),
      icon: 'undo',
      body: this.withdrawTpl(),
      size: 'md',
      buttons: [
        { label: this.translate.instant('AUTORISATIONS.CANCEL'), variant: 'secondary',
          action: (r: ModalRef) => r.close() },
        { label: this.translate.instant('AUTORISATIONS.WITHDRAW'), variant: 'primary', icon: 'undo',
          action: (r: ModalRef) => {
            if (!this.refuseMotif().trim()) {
              this.notify.error(this.translate.instant('AUTORISATIONS.MOTIF_REQUIRED'));
              return;
            }
            r.close();
            this.run(this.svc.withdraw(row.id, this.refuseMotif().trim(),
              this.translate.currentLang() ?? 'fr'), 'AUTORISATIONS.WITHDRAWN_OK');
          } },
      ],
    });
  }

  private confirmArchive(row: AutorisationRow): void {
    this.detailRow.set(row);
    this.modal.open({
      title: this.translate.instant('AUTORISATIONS.ARCHIVE_TITLE'),
      subtitle: this.translate.instant('AUTORISATIONS.ARCHIVE_SUB', {
        employee: row.collaborateurNom ?? '',
      }),
      icon: 'archive',
      body: this.archiveTpl(),
      size: 'md',
      buttons: [
        { label: this.translate.instant('AUTORISATIONS.CANCEL'), variant: 'secondary',
          action: (r: ModalRef) => r.close() },
        { label: this.translate.instant('AUTORISATIONS.ARCHIVE'), variant: 'primary', icon: 'archive',
          action: (r: ModalRef) => {
            r.close();
            this.run(this.svc.archive(row.id, this.translate.currentLang() ?? 'fr'),
              'AUTORISATIONS.ARCHIVED_OK');
          } },
      ],
    });
  }

  private decide(row: AutorisationRow, approved: boolean, motifRefus?: string): void {
    this.run(this.svc.decide(row.id, approved, motifRefus, this.translate.currentLang() ?? 'fr'),
      approved ? 'AUTORISATIONS.APPROVED_OK' : 'AUTORISATIONS.REFUSED_OK');
  }

  /** One place for the busy flag, the toast and the refresh — every action ends the same way. */
  private run(call: Observable<unknown>, okKey: string): void {
    this.working.set(true);
    call.subscribe({
      next: () => {
        this.working.set(false);
        this.notify.success(this.translate.instant(okKey));
        this.refreshAll();
      },
      error: e => {
        this.working.set(false);
        this.notify.error(errorMessage(e, this.translate.instant('AUTORISATIONS.ERR_ACTION')));
      },
    });
  }
}
