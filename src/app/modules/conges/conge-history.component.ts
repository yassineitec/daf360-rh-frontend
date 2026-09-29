import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  PageComponent, PageHeaderComponent, DataTableComponent, ButtonComponent,
  FormFieldComponent, SelectComponent,
  type TableColumn, type TableConfig, type TableRow, type SelectOption,
} from '@khalilrebhiitec/daf360';

import { CongesService } from './conges.service';
import { CongeRow, DemandeEtat } from './models/conge.model';

/** Which history this page is showing. The two differ only in scope and permission. */
export type HistoryScope = 'team' | 'global';

const ETATS: DemandeEtat[] = ['EN_ATTENTE', 'VALIDE', 'REFUSE', 'ARCHIVE'];

/**
 * The type list is NOT hardcoded here.
 *
 * It used to be — a thirteen-value array copied from an enum that no longer exists. The
 * catalogue is a table HR administers, so a list compiled into the frontend goes stale the
 * moment someone adds or retires a type, and the filter would silently omit it. Loaded from
 * `GET /api/hr/leave/types` in ngOnInit instead.
 */

/**
 * Congé history — the team's, or the whole country's.
 *
 * ONE COMPONENT, TWO PAGES
 * -----------------------------------------------------------------------------
 * The timesheet had these as separate pages (`employees-leaves-history` and
 * `global-demande-history`) that differed in almost nothing: the same columns, the same
 * filters, the same empty state, against two endpoints with different scopes. They are one
 * component with a `scope` input here, so a change to the filter grammar cannot land in one
 * and be forgotten in the other — which is how the two drifted apart in the first place.
 *
 * The scope decides three things and nothing else: which endpoint is called, which extra
 * filter is offered (country-wide adds a type filter), and which permission the route
 * demands. Everything below is shared.
 */
@Component({
  selector: 'app-conge-history',
  standalone: true,
  imports: [
    PageComponent, PageHeaderComponent, DataTableComponent, ButtonComponent,
    SelectComponent, FormFieldComponent, TranslatePipe,
  ],
  template: `
    <daf-page [loading]="loading()">
      <daf-page-header
        [title]="(scope === 'global' ? 'CONGES.HISTORY.TITLE_GLOBAL' : 'CONGES.HISTORY.TITLE_TEAM') | translate"
        [subtitle]="(scope === 'global' ? 'CONGES.HISTORY.SUB_GLOBAL' : 'CONGES.HISTORY.SUB_TEAM') | translate" />

      <div class="ch-filters">
        <daf-select
          [options]="etatOptions()"
          [selected]="sel(etat())"
          [config]="{ label: ('CONGES.FILTER.ETAT' | translate), placeholder: ('CONGES.FILTER.ALL' | translate), fullWidth: true }"
          (selectedChange)="etat.set(code($event[0])); apply()" />

        @if (scope === 'global') {
          <daf-select
            [options]="typeOptions()"
            [selected]="sel(type())"
            [config]="{ label: ('CONGES.FILTER.TYPE' | translate), placeholder: ('CONGES.FILTER.ALL' | translate), fullWidth: true, searchable: true }"
            (selectedChange)="type.set(code($event[0])); apply()" />
        }

        <daf-form-field
          [options]="{ label: ('CONGES.FILTER.FROM' | translate), type: 'date', fullWidth: true }"
          [value]="from()"
          (valueChange)="from.set(str($event)); apply()" />

        <daf-form-field
          [options]="{ label: ('CONGES.FILTER.TO' | translate), type: 'date', fullWidth: true }"
          [value]="to()"
          (valueChange)="to.set(str($event)); apply()" />

        <div class="ch-actions">
          <daf-button
            [options]="{ label: ('CONGES.FILTER.RESET' | translate), variant: 'ghost', iconStart: 'filter_alt_off' }"
            (onClick)="reset()" />
        </div>
      </div>

      <div class="ch-summary">
        <span>{{ 'CONGES.HISTORY.COUNT' | translate: { n: totalElements() } }}</span>
        @if (totalDays() > 0) {
          <span class="ch-summary-days">{{ 'CONGES.HISTORY.DAYS_TOTAL' | translate: { d: totalDays() } }}</span>
        }
      </div>

      <daf-data-table
        [columns]="columns()"
        [rows]="tableRows()"
        [config]="tableConfig()" />

      @if (totalPages() > 1) {
        <div class="ch-pager">
          <daf-button
            [options]="{ label: ('CONGES.PREV' | translate), variant: 'ghost', iconStart: 'chevron_left', disabled: page() === 0 }"
            (onClick)="goto(page() - 1)" />
          <span class="ch-pager-info">{{ page() + 1 }} / {{ totalPages() }}</span>
          <daf-button
            [options]="{ label: ('CONGES.NEXT' | translate), variant: 'ghost', iconStart: 'chevron_right', disabled: page() + 1 >= totalPages() }"
            (onClick)="goto(page() + 1)" />
        </div>
      }
    </daf-page>
  `,
  styles: [`
    .ch-filters { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)) auto; gap: 12px; align-items: end; margin-bottom: 14px; }
    @media (max-width: 1000px) { .ch-filters { grid-template-columns: 1fr 1fr; } .ch-actions { grid-column: 1 / -1; } }
    @media (max-width: 560px) { .ch-filters { grid-template-columns: 1fr; } }
    .ch-actions { display: flex; gap: 8px; }

    .ch-summary { display: flex; gap: 18px; align-items: baseline; margin-bottom: 12px;
                  font-size: .875rem; color: var(--color-on-surface-variant); }
    .ch-summary-days { font-variant-numeric: tabular-nums; }

    .ch-pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 16px; }
    .ch-pager-info { font-variant-numeric: tabular-nums; color: var(--color-on-surface-variant); font-size: .875rem; }
  `],
})
export class CongeHistoryComponent implements OnInit {
  /**
   * Which history this is. Read from the route's `data.scope` rather than bound as an
   * input: rh-frontend calls provideRouter(routes) WITHOUT withComponentInputBinding(), so
   * a route-data-to-@Input binding would silently never arrive and every page would render
   * as the team view. The @Input is kept so a parent can still set it directly.
   */
  @Input() scope: HistoryScope = 'team';

  private readonly route = inject(ActivatedRoute);

  private readonly svc = inject(CongesService);
  private readonly translate = inject(TranslateService);

  readonly rows = signal<CongeRow[]>([]);
  readonly loading = signal(false);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);

  readonly etat = signal<DemandeEtat | null>(null);
  readonly type = signal<string | null>(null);
  readonly from = signal<string | null>(null);
  readonly to = signal<string | null>(null);

  /**
   * Days on the CURRENT PAGE, not across the filter.
   *
   * Said plainly in the label rather than presented as a grand total: summing one page and
   * calling it the total is the kind of figure someone quotes in a meeting. A true total
   * needs a server-side aggregate, which is worth adding when someone actually needs it.
   */
  readonly totalDays = computed(() =>
    Math.round(this.rows().reduce((n, r) => n + (r.totalJours ?? 0), 0) * 10) / 10);

  readonly etatOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return ETATS.map((e) => ({ value: e, label: this.translate.instant('CONGES.ETAT.' + e) }));
  });

  /** Filled from the catalogue endpoint; empty until it answers. */
  readonly typeCatalogue = signal<{ label: string; value: string }[]>([]);

  readonly typeOptions = computed<SelectOption[]>(() =>
    this.typeCatalogue().map((t) => ({ value: t.value, label: t.label })));

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const cols: TableColumn[] = [
      { key: 'collaborateurName', label: this.translate.instant('CONGES.COL.EMPLOYEE'), sortable: true },
      { key: 'typeLabel',         label: this.translate.instant('CONGES.COL.TYPE'), sortable: true },
      { key: 'periode',           label: this.translate.instant('CONGES.COL.PERIOD') },
      { key: 'totalJours',        label: this.translate.instant('CONGES.COL.DAYS'), type: 'number',
        align: 'right', format: { maximumFractionDigits: 1 } },
      { key: 'etatBadge',         label: this.translate.instant('CONGES.COL.STATE'), type: 'badge' },
      { key: 'responsableName',   label: this.translate.instant('CONGES.COL.APPROVER') },
      { key: 'dateValidation',    label: this.translate.instant('CONGES.COL.DECIDED'), type: 'date',
        format: { dateStyle: 'short' }, sortable: true },
    ];
    return cols;
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      hoverable: true,
      loading: this.loading(),
      emptyMessage: this.translate.instant('CONGES.HISTORY.EMPTY'),
      manualSort: true,
      columnPicker: true,
      columnPickerLabel: this.translate.instant('CONGES.COLUMNS'),
    };
  });

  readonly tableRows = computed<TableRow[]>(() =>
    this.rows().map((r) => ({
      ...r,
      periode: r.dateDebut === r.dateFin
        ? this.fmt(r.dateDebut)
        : `${this.fmt(r.dateDebut)} → ${this.fmt(r.dateFin)}`,
      etatBadge: {
        label: this.translate.instant('CONGES.ETAT.' + r.etatDemande),
        // BadgeCell nests the variant inside .
        options: { variant: ({ EN_ATTENTE: 'warning', VALIDE: 'success', REFUSE: 'danger', ARCHIVE: 'neutral' } as const)[r.etatDemande] },
      },
      // A refused row without its motive is a dead end for whoever reads the history.
      motifRefus: r.motifRefus ?? '',
    })));

  ngOnInit(): void {
    this.svc.types(this.translate.currentLang() ?? 'fr').subscribe({
      next: (t) => this.typeCatalogue.set(t ?? []),
      // Left empty: the filter simply offers no types, which is visibly different from
      // offering a stale list that quietly omits whatever HR added last week.
      error: () => this.typeCatalogue.set([]),
    });
    const fromRoute = this.route.snapshot.data['scope'] as HistoryScope | undefined;
    if (fromRoute) this.scope = fromRoute;
    this.load();
  }

  apply(): void {
    this.page.set(0);
    this.load();
  }

  reset(): void {
    this.etat.set(null);
    this.type.set(null);
    this.from.set(null);
    this.to.set(null);
    this.apply();
  }

  goto(p: number): void {
    this.page.set(Math.max(0, p));
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    const filter = {
      etat: this.etat(),
      type: this.scope === 'global' ? this.type() : null,
      from: this.from(),
      to: this.to(),
      page: this.page(),
      size: 20,
    };
    const lang = this.translate.currentLang() ?? 'fr';
    const call = this.scope === 'global' ? this.svc.global(filter, lang) : this.svc.team(filter, lang);

    call.subscribe({
      next: (p) => {
        this.rows.set(p.content ?? []);
        this.totalPages.set(p.totalPages ?? 0);
        this.totalElements.set(p.totalElements ?? 0);
        this.loading.set(false);
      },
      // Left empty with the loading flag cleared; the table's own empty message shows. The
      // shell's interceptor surfaces the status, so this does not invent a second error UI.
      error: () => {
        this.rows.set([]);
        this.totalPages.set(0);
        this.totalElements.set(0);
        this.loading.set(false);
      },
    });
  }

  /** Split, not new Date(): an ISO date parsed as UTC can render as the previous day. */
  private fmt(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  protected sel(v: string | null): string[] { return v == null ? [] : [v]; }
  protected str(v: unknown): string | null { return v == null || v === '' ? null : String(v); }
  protected code<T extends string>(v: unknown): T | null {
    return (v == null || v === '' ? null : String(v)) as T | null;
  }
}
