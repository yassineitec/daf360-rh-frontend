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
import { errorMessage, etatVariant } from '../autorisations/autorisation-display';
import { TeletravailService } from './teletravail.service';
import {
  TeletravailCounts, TeletravailEtat, TeletravailFilter, TeletravailPage, TeletravailRow,
} from './models/teletravail.model';
import { categoryIcon, categoryVariant, formatJours } from './teletravail-display';

/** Which queue this page is showing. */
export type TeletravailScope = 'queue' | 'mine' | 'team' | 'global';

/**
 * The four télétravail screens — `/rh/teletravail/{queue,mine,team,global}`.
 *
 * ONE COMPONENT, FOUR ROUTES, exactly as AutorisationListComponent: the scope decides which
 * endpoint is called, which title is shown, whether the decision actions appear, and whether
 * archiving is offered — nothing else.
 *
 * WHAT IS DIFFERENT FROM AN AUTORISATION
 * -----------------------------------------------------------------------------
 * The duration is a DAY or a HALF day, not a slot of minutes, and approving one DEBITS
 * soldeTeletravail. So the summary shows the half of the day, the approve modal says how
 * much the balance moves, and the archive modal says whether it moves back — the timesheet's
 * archive confirmation promised a refund even for requests that had never been debited.
 */
@Component({
  selector: 'app-teletravail-list',
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
          [label]="'TELETRAVAIL.KPI.TOTAL' | translate" [value]="kpi()['TOTAL']"
          [options]="{ icon: 'home_work', iconColor: 'text-primary', iconBg: 'bg-primary/10' }" />
        <daf-metric-card
          [label]="'TELETRAVAIL.KPI.PENDING' | translate" [value]="kpi()['EN_ATTENTE']"
          [options]="{ icon: 'hourglass_top', iconColor: 'text-warning', iconBg: 'bg-warning/10' }" />
        <daf-metric-card
          [label]="'TELETRAVAIL.KPI.APPROVED' | translate" [value]="kpi()['VALIDE']"
          [options]="{ icon: 'check_circle', iconColor: 'text-success', iconBg: 'bg-success/10' }" />
        <daf-metric-card
          [label]="'TELETRAVAIL.KPI.REFUSED' | translate" [value]="kpi()['REFUSE']"
          [options]="{ icon: 'cancel', iconColor: 'text-danger', iconBg: 'bg-danger/10' }" />
      </section>

      <daf-search-toolbar
        [placeholder]="'TELETRAVAIL.SEARCH' | translate"
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

        <!-- The half of the day, and what it costs — a morning and a full day must not look alike. -->
        <ng-template dafCell="duree" let-row>
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px] text-on-surface-variant">{{ icon(row['_s'].category) }}</span>
            <daf-badge [label]="row['_s'].categoryLabel ?? row['_s'].category"
                       [options]="{ variant: catVariant(row['_s'].category), size: 'sm' }" />
          </div>
        </ng-template>

        <ng-template dafCell="etat" let-row>
          <div class="flex items-center gap-1.5">
            <daf-badge [label]="row['_s'].etatLabel"
                       [options]="{ variant: variant(row['_s'].etatDemande), size: 'sm', dot: true }" />
            @if (row['_s'].settled) {
              <daf-badge [label]="'TELETRAVAIL.SETTLED' | translate"
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
           Every action restates WHICH request it acts on — who, which day, which half —
           before saying what the action does, and what happens to the balance. -->

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
                      {{ 'TELETRAVAIL.APPROVER' | translate }} : {{ r.responsableNom }}
                    </span>
                  }
                </div>
              </div>
              <daf-badge [label]="r.etatLabel"
                         [options]="{ variant: variant(r.etatDemande), size: 'sm', dot: true }" />
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="flex flex-col gap-0.5">
                <span class="text-label-sm text-on-surface-variant">{{ 'TELETRAVAIL.COL.DATE' | translate }}</span>
                <span class="text-body-md font-medium">{{ r.dateTeletravail | date: 'EEE dd/MM/yyyy' }}</span>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-label-sm text-on-surface-variant">{{ 'TELETRAVAIL.COL.DURATION' | translate }}</span>
                <span class="flex items-center gap-1 text-body-md font-medium">
                  <span class="material-symbols-outlined text-[16px] text-tertiary">{{ icon(r.category) }}</span>
                  {{ r.categoryLabel ?? r.category }}
                </span>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-label-sm text-on-surface-variant">{{ 'TELETRAVAIL.DAYS' | translate }}</span>
                <span class="text-body-md font-semibold">{{ jours(r.jours) }}</span>
              </div>
            </div>
            @if (r.reason) {
              <div class="flex flex-col gap-0.5">
                <span class="text-label-sm text-on-surface-variant">{{ 'TELETRAVAIL.REASON' | translate }}</span>
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
                <span class="text-label-sm text-danger">{{ 'TELETRAVAIL.MOTIF_REFUS' | translate }}</span>
                <p class="text-body-md whitespace-pre-line">{{ r.motifRefus }}</p>
              </div>
            }
            @if (r.motifAnnulation) {
              <div class="flex flex-col gap-1 rounded-xl bg-surface-container-low p-3">
                <span class="text-label-sm text-on-surface-variant">{{ 'TELETRAVAIL.MOTIF_ANNULATION' | translate }}</span>
                <p class="text-body-md whitespace-pre-line">{{ r.motifAnnulation }}</p>
              </div>
            }

            <ul class="flex flex-col gap-1.5 text-body-sm text-on-surface-variant">
              @if (r.createdAt) {
                <li class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">send</span>
                  {{ 'TELETRAVAIL.FILED_ON' | translate }} {{ r.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                  @if (r.settled && r.createdByNom) {
                    · {{ 'TELETRAVAIL.FILED_BY' | translate }} {{ r.createdByNom }}
                  }
                </li>
              }
              @if (r.settled) {
                <li class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">history_edu</span>
                  {{ 'TELETRAVAIL.SETTLED_HINT' | translate }}
                </li>
              }
              @if (r.decidedByNom) {
                <li class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">gavel</span>
                  {{ 'TELETRAVAIL.DECIDED_BY' | translate }} {{ r.decidedByNom }}
                  @if (r.dateValidation) { · {{ r.dateValidation | date: 'dd/MM/yyyy' }} }
                </li>
              } @else if (r.etatDemande === 'EN_ATTENTE') {
                <li class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">hourglass_top</span>
                  {{ 'TELETRAVAIL.AWAITING' | translate }}
                </li>
              }
              @if (r.balanceDebited) {
                <li class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                  {{ 'TELETRAVAIL.DEBITED_HINT' | translate: { days: jours(r.jours) } }}
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
              {{ 'TELETRAVAIL.APPROVE_INTRO' | translate: { days: jours(r.jours) } }}
            </p>
          </div>
        }
      </ng-template>

      <ng-template #refuseTpl>
        <div class="flex flex-col gap-3">
          <ng-container [ngTemplateOutlet]="summaryTpl" />
          <p class="flex items-start gap-2 text-body-md">
            <span class="material-symbols-outlined text-[18px] text-tertiary">info</span>
            {{ 'TELETRAVAIL.REFUSE_INTRO' | translate }}
          </p>
          <daf-form-field
            [options]="{ label: ('TELETRAVAIL.MOTIF_REFUS' | translate), type: 'textarea',
                         required: true, fullWidth: true, rows: 3,
                         placeholder: ('TELETRAVAIL.MOTIF_PH' | translate) }"
            [value]="motif()"
            (valueChange)="motif.set($any($event) ?? '')" />
        </div>
      </ng-template>

      <ng-template #withdrawTpl>
        <div class="flex flex-col gap-3">
          <ng-container [ngTemplateOutlet]="summaryTpl" />
          <p class="flex items-start gap-2 text-body-md">
            <span class="material-symbols-outlined text-[18px] text-tertiary">info</span>
            {{ 'TELETRAVAIL.WITHDRAW_INTRO' | translate }}
          </p>
          <daf-form-field
            [options]="{ label: ('TELETRAVAIL.MOTIF_ANNULATION' | translate), type: 'textarea',
                         required: true, fullWidth: true, rows: 3,
                         placeholder: ('TELETRAVAIL.MOTIF_PH' | translate) }"
            [value]="motif()"
            (valueChange)="motif.set($any($event) ?? '')" />
        </div>
      </ng-template>

      <ng-template #archiveTpl>
        @if (detailRow(); as r) {
          <div class="flex flex-col gap-3">
            <ng-container [ngTemplateOutlet]="summaryTpl" />
            <p class="flex items-start gap-2 text-body-md">
              <span class="material-symbols-outlined text-[18px] text-tertiary">info</span>
              {{ (r.balanceDebited ? 'TELETRAVAIL.ARCHIVE_INTRO_REFUND' : 'TELETRAVAIL.ARCHIVE_INTRO')
                 | translate: { days: jours(r.jours) } }}
            </p>
          </div>
        }
      </ng-template>

    </daf-page>
  `,
})
export class TeletravailListComponent implements OnInit {
  /** Read from the route's data.scope — rh-frontend has no withComponentInputBinding(). */
  @Input() scope: TeletravailScope = 'queue';

  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(TeletravailService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly firstLoad = signal(true);
  readonly loading = signal(false);
  readonly working = signal(false);
  readonly error = signal<string | null>(null);

  readonly rows = signal<TeletravailRow[]>([]);
  readonly kpi = signal<TeletravailCounts>({});

  readonly search = signal('');
  readonly etatFilter = signal<TeletravailEtat | null>(null);
  readonly fromFilter = signal<string | null>(null);
  readonly toFilter = signal<string | null>(null);

  readonly currentPage = signal(0);
  readonly pageSize = signal(10);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly pageSizeOptions = [10, 25, 50];

  readonly sortKey = signal('dateTeletravail');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  private readonly detailTpl = viewChild.required<TemplateRef<unknown>>('detailTpl');
  private readonly refuseTpl = viewChild.required<TemplateRef<unknown>>('refuseTpl');
  private readonly approveTpl = viewChild.required<TemplateRef<unknown>>('approveTpl');
  private readonly withdrawTpl = viewChild.required<TemplateRef<unknown>>('withdrawTpl');
  private readonly archiveTpl = viewChild.required<TemplateRef<unknown>>('archiveTpl');
  /** The row every open modal is about — the shared summary block reads it. */
  readonly detailRow = signal<TeletravailRow | null>(null);
  readonly motif = signal('');

  protected readonly variant = etatVariant;
  protected readonly catVariant = categoryVariant;
  protected readonly icon = categoryIcon;

  protected jours(n: number | null | undefined): string {
    return formatJours(n, this.translate.currentLang() ?? 'fr');
  }

  ngOnInit(): void {
    const fromRoute = this.route.snapshot.data['scope'] as TeletravailScope | undefined;
    if (fromRoute) this.scope = fromRoute;
    this.refreshAll();
  }

  // ── Titles ────────────────────────────────────────────────────────────────

  titleKey(): string    { return 'TELETRAVAIL.TITLE_' + this.scope.toUpperCase(); }
  subtitleKey(): string { return 'TELETRAVAIL.SUB_' + this.scope.toUpperCase(); }

  private get canDecide(): boolean { return this.scope === 'queue'; }
  private get canArchive(): boolean { return this.scope === 'global'; }
  private get canWithdraw(): boolean { return this.scope === 'mine'; }

  // ── Data ──────────────────────────────────────────────────────────────────

  readonly exporting = signal(false);

  /** The global scope, with the filters on screen, as an Excel file. */
  exportExcel(): void {
    this.exporting.set(true);
    const f: TeletravailFilter = {
      etat: this.etatFilter(), from: this.fromFilter(), to: this.toFilter(),
      sort: this.sortKey(), dir: this.sortDir(),
    };
    this.svc.exportGlobal(f, this.translate.currentLang() ?? 'fr').subscribe({
      next: (blob) => { saveBlob(blob, 'teletravail.xlsx'); this.exporting.set(false); },
      error: (e) => {
        this.exporting.set(false);
        this.notify.error(errorMessage(e, this.translate.instant('COMMON.exportError')));
      },
    });
  }

  private fetch(): Observable<TeletravailPage> {
    const lang = this.translate.currentLang() ?? 'fr';
    const f: TeletravailFilter = {
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
        this.totalPages.set(p.totalPages);
        this.totalElements.set(p.totalElements);
        this.loading.set(false);
        this.firstLoad.set(false);
      },
      error: e => {
        this.rows.set([]);
        this.error.set(errorMessage(e, this.translate.instant('TELETRAVAIL.ERR_LOAD')));
        this.loading.set(false);
        this.firstLoad.set(false);
      },
    });
  }

  // ── Table ─────────────────────────────────────────────────────────────────

  columns(): TableColumn[] {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('TELETRAVAIL.COL.' + k);
    const cols: TableColumn[] = [];
    // The employee column is noise on "mine" — every row is the same person.
    if (this.scope !== 'mine') cols.push({ key: 'collaborateur', label: t('EMPLOYEE') });
    cols.push(
      { key: 'dateTeletravail', label: t('DATE'), sortable: true, width: '130px' },
      { key: 'duree', label: t('DURATION'), width: '200px' },
      { key: 'reason', label: t('REASON') },
      { key: 'etat', label: t('STATE'), sortable: true, width: '190px' },
      { key: 'motifRefus', label: t('MOTIF') },
    );
    return cols;
  }

  /** `_s` carries the typed row through the table's untyped map — the module's convention. */
  tableRows(): TableRow[] {
    return this.rows().map(r => ({
      id: r.id,
      dateTeletravail: r.dateTeletravail,
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
      emptyMessage: this.translate.instant('TELETRAVAIL.EMPTY'),
      actions: this.actions(),
    } as TableConfig;
  }

  private actions(): TableAction[] {
    this.translate.currentLang();
    const src = (row: TableRow) => row['_s'] as TeletravailRow;
    const pending = (row: TableRow) => src(row).etatDemande === 'EN_ATTENTE';

    return [
      {
        id: 'view', icon: 'visibility',
        tooltip: this.translate.instant('TELETRAVAIL.CONSULT'),
        onClick: (row) => this.openDetail(src(row)),
      },
      {
        id: 'approve', icon: 'check_circle',
        tooltip: this.translate.instant('TELETRAVAIL.APPROVE'),
        hidden: (row) => !this.canDecide || !pending(row),
        disabled: () => this.working(),
        onClick: (row) => this.confirmApprove(src(row)),
      },
      {
        id: 'refuse', icon: 'cancel', variant: 'danger',
        tooltip: this.translate.instant('TELETRAVAIL.REFUSE'),
        hidden: (row) => !this.canDecide || !pending(row),
        disabled: () => this.working(),
        onClick: (row) => this.openRefuse(src(row)),
      },
      {
        id: 'withdraw', icon: 'undo', variant: 'danger',
        tooltip: this.translate.instant('TELETRAVAIL.WITHDRAW'),
        hidden: (row) => !this.canWithdraw || !pending(row),
        disabled: () => this.working(),
        onClick: (row) => this.openWithdraw(src(row)),
      },
      {
        id: 'archive', icon: 'archive',
        tooltip: this.translate.instant('TELETRAVAIL.ARCHIVE'),
        hidden: (row) => !this.canArchive || src(row).etatDemande === 'ARCHIVE',
        disabled: () => this.working(),
        onClick: (row) => this.confirmArchive(src(row)),
      },
    ];
  }

  onSort(e: { key: string; dir: SortDirection }): void {
    this.sortKey.set(e.key);
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
      label: this.translate.instant('TELETRAVAIL.COL.STATE'),
      type: 'select',
      placeholder: this.translate.instant('TELETRAVAIL.FILTER.ALL'),
      options: (['EN_ATTENTE', 'VALIDE', 'REFUSE', 'ARCHIVE'] as TeletravailEtat[])
        .map(e => ({ value: e, label: this.translate.instant('TELETRAVAIL.ETAT.' + e) })),
    }];
    if (this.scope === 'global') {
      fields.push(
        { name: 'from', label: this.translate.instant('TELETRAVAIL.FILTER.FROM'), type: 'date' },
        { name: 'to',   label: this.translate.instant('TELETRAVAIL.FILTER.TO'),   type: 'date' },
      );
    }
    return fields;
  }

  filterConfig(): SearchToolbarFilterConfig {
    this.translate.currentLang();
    return {
      title: this.translate.instant('TELETRAVAIL.FILTER.TITLE'),
      applyLabel: this.translate.instant('TELETRAVAIL.FILTER.APPLY'),
      resetLabel: this.translate.instant('TELETRAVAIL.FILTER.RESET'),
    } as SearchToolbarFilterConfig;
  }

  applyFilters(result: FilterResult): void {
    const one = (v: unknown) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
    this.etatFilter.set(one(result['etat']) as TeletravailEtat | null);
    this.fromFilter.set(this.iso(one(result['from'])));
    this.toFilter.set(this.iso(one(result['to'])));
    this.currentPage.set(0);
    this.load();
  }

  /** Built from parts: toISOString() shifts to UTC and loses a day west of Greenwich. */
  private iso(v: unknown): string | null {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return null;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-'
         + String(d.getDate()).padStart(2, '0');
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  openDetail(row: TeletravailRow): void {
    this.detailRow.set(row);
    this.modal.open({
      title: this.translate.instant('TELETRAVAIL.DETAIL_TITLE'),
      subtitle: this.translate.instant('TELETRAVAIL.DETAIL_SUB'),
      icon: 'home_work',
      body: this.detailTpl(),
      size: 'md',
      buttons: [{ label: this.translate.instant('TELETRAVAIL.CLOSE'), variant: 'secondary',
                  action: (r: ModalRef) => r.close() }],
    });
  }

  private confirmApprove(row: TeletravailRow): void {
    this.detailRow.set(row);
    this.modal.open({
      title: this.translate.instant('TELETRAVAIL.APPROVE_TITLE'),
      subtitle: this.translate.instant('TELETRAVAIL.REQUEST_OF', { employee: row.collaborateurNom ?? '' }),
      icon: 'check_circle',
      body: this.approveTpl(),
      size: 'md',
      buttons: [
        { label: this.translate.instant('TELETRAVAIL.CANCEL'), variant: 'secondary',
          action: (r: ModalRef) => r.close() },
        { label: this.translate.instant('TELETRAVAIL.APPROVE'), variant: 'primary', icon: 'check',
          action: (r: ModalRef) => { r.close(); this.decide(row, true); } },
      ],
    });
  }

  private openRefuse(row: TeletravailRow): void {
    this.detailRow.set(row);
    this.motif.set('');
    this.modal.open({
      title: this.translate.instant('TELETRAVAIL.REFUSE_TITLE'),
      subtitle: this.translate.instant('TELETRAVAIL.REQUEST_OF', { employee: row.collaborateurNom ?? '' }),
      icon: 'cancel',
      body: this.refuseTpl(),
      size: 'md',
      buttons: [
        { label: this.translate.instant('TELETRAVAIL.CANCEL'), variant: 'secondary',
          action: (r: ModalRef) => r.close() },
        { label: this.translate.instant('TELETRAVAIL.REFUSE'), variant: 'primary', icon: 'close',
          action: (r: ModalRef) => {
            if (!this.motif().trim()) {
              this.notify.error(this.translate.instant('TELETRAVAIL.MOTIF_REQUIRED'));
              return;
            }
            r.close();
            this.decide(row, false, this.motif().trim());
          } },
      ],
    });
  }

  private openWithdraw(row: TeletravailRow): void {
    this.detailRow.set(row);
    this.motif.set('');
    this.modal.open({
      title: this.translate.instant('TELETRAVAIL.WITHDRAW_TITLE'),
      subtitle: this.translate.instant('TELETRAVAIL.WITHDRAW_SUB'),
      icon: 'undo',
      body: this.withdrawTpl(),
      size: 'md',
      buttons: [
        { label: this.translate.instant('TELETRAVAIL.CANCEL'), variant: 'secondary',
          action: (r: ModalRef) => r.close() },
        { label: this.translate.instant('TELETRAVAIL.WITHDRAW'), variant: 'primary', icon: 'undo',
          action: (r: ModalRef) => {
            if (!this.motif().trim()) {
              this.notify.error(this.translate.instant('TELETRAVAIL.MOTIF_REQUIRED'));
              return;
            }
            r.close();
            this.run(this.svc.withdraw(row.id, this.motif().trim(), this.translate.currentLang() ?? 'fr'),
              'TELETRAVAIL.WITHDRAWN_OK');
          } },
      ],
    });
  }

  private confirmArchive(row: TeletravailRow): void {
    this.detailRow.set(row);
    this.modal.open({
      title: this.translate.instant('TELETRAVAIL.ARCHIVE_TITLE'),
      subtitle: this.translate.instant('TELETRAVAIL.REQUEST_OF', { employee: row.collaborateurNom ?? '' }),
      icon: 'archive',
      body: this.archiveTpl(),
      size: 'md',
      buttons: [
        { label: this.translate.instant('TELETRAVAIL.CANCEL'), variant: 'secondary',
          action: (r: ModalRef) => r.close() },
        { label: this.translate.instant('TELETRAVAIL.ARCHIVE'), variant: 'primary', icon: 'archive',
          action: (r: ModalRef) => {
            r.close();
            this.run(this.svc.archive(row.id, this.translate.currentLang() ?? 'fr'), 'TELETRAVAIL.ARCHIVED_OK');
          } },
      ],
    });
  }

  private decide(row: TeletravailRow, approved: boolean, motifRefus?: string): void {
    this.run(this.svc.decide(row.id, approved, motifRefus, this.translate.currentLang() ?? 'fr'),
      approved ? 'TELETRAVAIL.APPROVED_OK' : 'TELETRAVAIL.REFUSED_OK');
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
        this.notify.error(errorMessage(e, this.translate.instant('TELETRAVAIL.ERR_ACTION')));
      },
    });
  }
}
