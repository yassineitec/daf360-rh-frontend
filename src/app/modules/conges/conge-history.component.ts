import { Component, Input, OnInit, TemplateRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import {
  MetricCardComponent, ModalService, PageComponent, PageHeaderComponent,
  PaginationComponent, SearchToolbarComponent,
} from '@khalilrebhiitec/daf360';

import { NotificationService } from '../../core/notification.service';
import { CongeListBase } from './conge-list-base';
import { CongeCounts, CongeFilter, CongePage, CongeRow } from './models/conge.model';
import { errorMessage } from './conge-display';
import { CongeRowAction, CongesTableSectionComponent } from './sections/conges-table-section.component';
import { CongesCardsSectionComponent } from './sections/conges-cards-section.component';
import { CongeDetailComponent } from './sections/conge-detail.component';

/** Which history this page is showing. The two differ only in scope and permission. */
export type HistoryScope = 'team' | 'global';

/**
 * `/rh/conges/team` and `/rh/conges/global` — the two read-only histories.
 *
 * ONE COMPONENT, TWO ROUTES. The timesheet had these as separate pages
 * (`employees-leaves-history` and a country-wide one) showing the same columns with the same
 * filters against two endpoints of different scope. They are one component with a `scope`
 * here, so a change to the filter grammar cannot land in one and miss the other.
 *
 * THE SCOPE DECIDES THREE THINGS AND NOTHING ELSE: which endpoint is called, which title is
 * shown, and — on the country-wide view only — whether archiving is offered.
 *
 * WHAT EACH ONE ACTUALLY COVERS
 * -----------------------------------------------------------------------------
 *   team   — everyone below the caller in the role hierarchy, resolved server-side. No pays
 *            filter, deliberately: a manager with reports in Tunisia and Egypt manages both,
 *            and scoping this by country would hide half their own team from them.
 *   global — bounded by the CALLER'S ROLE PAYS SCOPE (V74), read from the token. The country
 *            filter in the panel narrows within that ceiling and can never widen it.
 */
@Component({
  selector: 'app-conge-history',
  standalone: true,
  imports: [
    PageComponent, PageHeaderComponent, MetricCardComponent, SearchToolbarComponent,
    PaginationComponent, CongesTableSectionComponent, CongesCardsSectionComponent,
    CongeDetailComponent, TranslatePipe,
  ],
  template: `
    <daf-page [loading]="firstLoad()" [kpis]="4">

      <!-- No icon on the page header: platform convention. -->
      <daf-page-header
        [title]="(scope === 'global' ? 'CONGES.HISTORY.TITLE_GLOBAL' : 'CONGES.HISTORY.TITLE_TEAM') | translate"
        [subtitle]="(scope === 'global' ? 'CONGES.HISTORY.SUB_GLOBAL' : 'CONGES.HISTORY.SUB_TEAM') | translate" />

      <!-- Counted over the whole scope by its own endpoint, never over the current page. -->
      <section class="grid grid-cols-4 gap-2 sm:gap-6">
        <daf-metric-card
          [label]="'CONGES.KPI.TOTAL' | translate" [value]="kpi().total"
          [options]="{ icon: 'beach_access', iconColor: 'text-primary', iconBg: 'bg-primary/10',
                       help: ('CONGES.KPI.SCOPE_HELP' | translate) }" />
        <daf-metric-card
          [label]="'CONGES.KPI.PENDING' | translate" [value]="kpi().pending"
          [options]="{ icon: 'hourglass_top', iconColor: 'text-warning', iconBg: 'bg-warning/10' }" />
        <daf-metric-card
          [label]="'CONGES.KPI.APPROVED' | translate" [value]="kpi().approved"
          [options]="{ icon: 'check_circle', iconColor: 'text-success', iconBg: 'bg-success/10' }" />
        <daf-metric-card
          [label]="'CONGES.KPI.ARCHIVED' | translate" [value]="kpi().archived"
          [options]="{ icon: 'archive', iconColor: 'text-outline', iconBg: 'bg-surface-container' }" />
      </section>

      <daf-search-toolbar
        [placeholder]="'CONGES.SEARCH_PLACEHOLDER' | translate"
        [value]="search()"
        [debounce]="300"
        (valueChange)="onSearch($event)"
        [filterFields]="filterFields()"
        [filterConfig]="filterConfig()"
        (filterApply)="applyFilters($event)"
        [views]="viewOptions()"
        [view]="viewMode()"
        (viewChange)="setView($event)" />

      @if (error()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>
          {{ error() }}
        </div>
      }

      @if (viewMode() === 'grid') {
        <rh-conges-cards-section
          [items]="rows()" [loading]="loading()" [skeletonCount]="pageSize()"
          [emptyMessage]="emptyMessage()" [allowArchive]="canArchive"
          (open)="openDetail($event)" (act)="onRowAction($event)" />
      } @else {
        <rh-conges-table-section
          [items]="rows()" [loading]="loading()" [skeletonRows]="pageSize()"
          [emptyMessage]="emptyMessage()" [allowArchive]="canArchive" [busy]="working()"
          [sortKey]="sortKey()" [sortDir]="sortDir()"
          (open)="openDetail($event)" (act)="onRowAction($event)" (sortChange)="onSort($event)" />
      }

      @if (totalPages() > 0) {
        <daf-pagination
          [currentPage]="currentPage()" [totalPages]="totalPages()"
          [totalElements]="totalElements()" [pageSize]="pageSize()"
          [pageSizeOptions]="pageSizeOptions"
          [perPageLabel]="'PROFILES.LIST.PER_PAGE' | translate"
          [summaryLabel]="'PROFILES.LIST.RANGE_SUMMARY' | translate"
          (pageChange)="onPageChange($event)" (pageSizeChange)="onPageSizeChange($event)" />
      }

      <!-- Same body as the queue's consult modal: a history row answers the same questions. -->
      <ng-template #detailTpl>
        <rh-conge-detail [row]="detailRow()" />
      </ng-template>

    </daf-page>
  `,
})
export class CongeHistoryComponent extends CongeListBase implements OnInit {
  /**
   * Which history this is. Read from the route's `data.scope` rather than bound as an input:
   * rh-frontend calls provideRouter(routes) WITHOUT withComponentInputBinding(), so a
   * route-data-to-@Input binding would silently never arrive and every page would render as
   * the default.
   */
  @Input() scope: HistoryScope = 'team';

  private readonly route = inject(ActivatedRoute);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);

  /** Archiving is HR's act on the country-wide view, not a manager's on their team list. */
  protected canArchive = false;

  private readonly detailTpl = viewChild.required<TemplateRef<unknown>>('detailTpl');
  /** The row the open modal is about — see CongeInboxComponent for why it is a signal. */
  readonly detailRow = signal<CongeRow | null>(null);

  protected fetch(filter: CongeFilter): Observable<CongePage> {
    const lang = this.translate.currentLang() ?? 'fr';
    return this.scope === 'global' ? this.svc.global(filter, lang) : this.svc.team(filter, lang);
  }

  protected fetchCounts(): Observable<CongeCounts> {
    return this.scope === 'global' ? this.svc.globalCounts() : this.svc.teamCounts();
  }

  protected scopeKey(): string {
    return this.scope === 'global' ? 'CONGES.HISTORY.GLOBAL' : 'CONGES.HISTORY.TEAM';
  }

  /** Both histories read by when the person was away, not by when they asked. */
  protected override defaultSortKey(): string { return 'dateDebut'; }

  ngOnInit(): void {
    const fromRoute = this.route.snapshot.data['scope'] as HistoryScope | undefined;
    if (fromRoute) this.scope = fromRoute;
    this.canArchive = this.scope === 'global';

    this.sortKey.set('dateDebut');
    this.loadTypes();
    this.refreshAll();
  }

  openDetail(row: CongeRow): void {
    this.detailRow.set(row);
    this.modal.open({
      title: this.translate.instant('CONGES.DETAIL.TITLE'),
      subtitle: this.translate.instant('CONGES.DETAIL.SUBTITLE'),
      icon: 'beach_access',
      body: this.detailTpl(),
      size: 'md',
      buttons: [{
        label: this.translate.instant('CONGES.CLOSE'), variant: 'secondary',
        action: (r) => r.close(),
      }],
    });
  }

  onRowAction(e: { row: CongeRow; action: CongeRowAction }): void {
    if (e.action === 'archive') this.confirmArchive(e.row);
  }

  /**
   * Archiving names what it costs: an APPROVED congé has already been debited, and archiving
   * refunds those days. Doing that silently would move a balance nobody asked to move.
   */
  private confirmArchive(row: CongeRow): void {
    const refunds = row.etatDemande === 'VALIDE';
    this.modal.open({
      title: this.translate.instant('CONGES.ARCHIVE_TITLE'),
      subtitle: this.translate.instant(
        refunds ? 'CONGES.ARCHIVE_SUB_REFUND' : 'CONGES.ARCHIVE_SUB',
        { employee: row.collaborateurName ?? '', days: row.totalJours }),
      size: 'sm',
      buttons: [
        { label: this.translate.instant('CONGES.CANCEL'), variant: 'secondary', action: (r) => r.close() },
        {
          label: this.translate.instant('CONGES.ARCHIVE'),
          variant: 'primary',
          action: (r) => { r.close(); this.archive(row); },
        },
      ],
    });
  }

  private archive(row: CongeRow): void {
    this.working.set(true);
    this.svc.archive(row.id, this.translate.currentLang() ?? 'fr').subscribe({
      next: () => {
        this.working.set(false);
        this.notify.success(this.translate.instant('CONGES.ARCHIVED_OK'));
        this.refreshAll();
      },
      error: (e) => {
        this.working.set(false);
        this.notify.error(errorMessage(e, this.translate.instant('CONGES.ERR_ARCHIVE')));
      },
    });
  }
}
