import { Component, OnInit, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BulkAction, BulkActionBarComponent,
  FormFieldComponent, MetricCardComponent, ModalButton, ModalRef, ModalService, PageComponent,
  PageHeaderComponent, PaginationComponent, SearchToolbarComponent, ToolbarAction,
} from '@khalilrebhiitec/daf360';

import { NotificationService } from '../../core/notification.service';
import { CongeListBase } from './conge-list-base';
import { CongeCounts, CongeFilter, CongePage, CongeRow, LeaveBalances } from './models/conge.model';
import { errorMessage } from './conge-display';
import { CongeRowAction, CongesTableSectionComponent } from './sections/conges-table-section.component';
import { CongesCardsSectionComponent } from './sections/conges-cards-section.component';
import { CongeDetailComponent } from './sections/conge-detail.component';

/**
 * `/rh/conges/inbox` — the approval queue, on the canonical page shape (UI-PLAYBOOK §1):
 * page header, a four-KPI row, the search/filter/view toolbar, the content, the pager.
 *
 * WHAT THIS REPLACES
 * -----------------------------------------------------------------------------
 * The timesheet's `demandes-manager` page. The queue is resolved server-side from the role
 * hierarchy (there is no manager column anywhere — see LeaveApproverService) and matches
 * either approver slot, because the adjoint exists precisely so that either may decide.
 *
 * DECIDING IS NOT A TOGGLE
 * -----------------------------------------------------------------------------
 * Approving debits the employee's balance and refusing requires a written motive, so neither
 * is a single click on a row. Approve asks for confirmation naming the cost in days; refuse
 * opens a modal that will not submit empty — the server rejects a blank motive anyway, and
 * finding that out after the click is worse than being asked first.
 *
 * BULK APPROVE REPORTS PARTIAL SUCCESS
 * -----------------------------------------------------------------------------
 * It acts on everything the current filters match, resolved server-side so "approve all"
 * means the rows on screen. One employee's exhausted balance does not block the rest, so the
 * result is a count plus a per-row failure list rather than success or failure.
 */
@Component({
  selector: 'app-conge-inbox',
  standalone: true,
  imports: [
    PageComponent, PageHeaderComponent, MetricCardComponent, SearchToolbarComponent,
    PaginationComponent, FormFieldComponent, CongeDetailComponent, BulkActionBarComponent,
    CongesTableSectionComponent, CongesCardsSectionComponent, TranslatePipe,
  ],
  template: `
    <daf-page [loading]="firstLoad()" [kpis]="4">

      <!-- No icon on the page header: platform convention. -->
      <daf-page-header
        [title]="'CONGES.INBOX.TITLE' | translate"
        [subtitle]="'CONGES.INBOX.SUBTITLE' | translate" />

      <!-- Counted over the WHOLE queue by its own endpoint, never over the current page. -->
      <section class="grid grid-cols-4 gap-2 sm:gap-6">
        <daf-metric-card
          [label]="'CONGES.KPI.TOTAL' | translate" [value]="kpi().total"
          [options]="{ icon: 'inbox', iconColor: 'text-primary', iconBg: 'bg-primary/10',
                       help: ('CONGES.KPI.TOTAL_HELP' | translate) }" />
        <daf-metric-card
          [label]="'CONGES.KPI.PENDING' | translate" [value]="kpi().pending"
          [options]="{ icon: 'hourglass_top', iconColor: 'text-warning', iconBg: 'bg-warning/10' }" />
        <daf-metric-card
          [label]="'CONGES.KPI.APPROVED' | translate" [value]="kpi().approved"
          [options]="{ icon: 'check_circle', iconColor: 'text-success', iconBg: 'bg-success/10' }" />
        <daf-metric-card
          [label]="'CONGES.KPI.REFUSED' | translate" [value]="kpi().refused"
          [options]="{ icon: 'cancel', iconColor: 'text-danger', iconBg: 'bg-danger/10' }" />
      </section>

      <daf-search-toolbar
        [placeholder]="'CONGES.SEARCH_PLACEHOLDER' | translate"
        [value]="search()"
        [debounce]="300"
        (valueChange)="onSearch($event)"
        [actions]="toolbarActions()"
        (action)="onToolbarAction($event)"
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

      @if (bulkSummary(); as s) {
        <div class="rounded-xl px-4 py-3"
             [class]="s.failed > 0 ? 'bg-warning/10 text-on-surface' : 'bg-success/10 text-on-surface'">
          <p class="font-semibold">
            {{ 'CONGES.INBOX.BULK_DONE' | translate: { approved: s.approved, failed: s.failed } }}
          </p>
          @if (s.failed > 0) {
            <ul class="mt-2 list-disc pl-5 text-sm">
              @for (f of s.failures; track f.leaveRequestId) {
                <li><strong>{{ f.employee || ('CONGES.UNKNOWN' | translate) }}</strong> — {{ f.reason }}</li>
              }
            </ul>
          }
        </div>
      }

      <!-- Appears only once something is ticked, so the page is not carrying a permanently
           empty bar. totalCount is the WHOLE filtered queue, not the page — the shortcut it
           offers is "select the 43 that match", and passing the page length would silently
           make it mean "select these 10". -->
      @if (selectedIds().length > 0) {
        <daf-bulk-action-bar
          [count]="bulkTargetCount()"
          [totalCount]="totalElements()"
          [countLabel]="'CONGES.INBOX.SELECTED' | translate"
          [selectAllLabel]="'CONGES.INBOX.SELECT_ALL_MATCHING' | translate: { n: totalElements() }"
          [allSelectedLabel]="'CONGES.INBOX.ALL_SELECTED' | translate"
          [cancelLabel]="'CONGES.CANCEL' | translate"
          [actions]="bulkActions()"
          (actionClick)="onBulkAction($event)"
          (selectAll)="selectWholeQueue()"
          (cancel)="clearSelection()" />
      }

      <!-- Content sits free in the page — never wrapped in an outer daf-card (§1). -->
      @if (viewMode() === 'grid') {
        <rh-conges-cards-section
          [items]="rows()" [loading]="loading()" [skeletonCount]="pageSize()"
          [emptyMessage]="emptyMessage()" [allowDecide]="true"
          (open)="openDetail($event)" (act)="onRowAction($event)" />
      } @else {
        <rh-conges-table-section
          [items]="rows()" [loading]="loading()" [skeletonRows]="pageSize()"
          [emptyMessage]="emptyMessage()" [allowDecide]="true" [busy]="working()"
          [sortKey]="sortKey()" [sortDir]="sortDir()"
          [selectable]="pendingShown()" [selected]="selectedIds()"
          (selectedChange)="selectedIds.set($event)"
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

      <!-- Bulk approve: the one control that acts on rows the user cannot all see at once,
           so it has to say exactly what it will act on before it does. -->
      <ng-template #bulkTpl>
        <div class="flex flex-col gap-4">

          <div class="flex items-center gap-3 rounded-xl bg-primary/10 px-4 py-3">
            <span class="material-symbols-outlined text-[28px] text-primary">done_all</span>
            <div>
              <p class="text-headline-sm font-semibold tabular-nums">
                {{ 'CONGES.INBOX.BULK_COUNT' | translate: { count: bulkTargetCount() } }}
              </p>
              <p class="text-body-sm text-on-surface-variant">
                {{ 'CONGES.INBOX.BULK_COUNT_SUB' | translate }}
              </p>
            </div>
          </div>

          <!-- The filters, itemised. "Approve all" means something different under each one,
               and a sentence naming them is the difference between a considered click and a
               surprise. Skipped entirely for a hand-picked selection: the user chose those
               rows one by one, so the filters that produced the list are not the point. -->
          @if (wholeQueue()) {
            <div class="flex flex-col gap-1.5">
              <p class="text-body-sm text-on-surface-variant">{{ 'CONGES.INBOX.BULK_SCOPE' | translate }}</p>
              @if (activeFilters().length === 0) {
                <p class="m-0 rounded-lg bg-surface-container-low px-3 py-2 text-body-sm">
                  {{ 'CONGES.INBOX.BULK_SCOPE_NONE' | translate }}
                </p>
              } @else {
                <ul class="m-0 flex flex-col gap-1 rounded-lg bg-surface-container-low px-3 py-2">
                  @for (f of activeFilters(); track f) {
                    <li class="flex items-center gap-2 text-body-sm">
                      <span class="material-symbols-outlined text-body-lg text-outline">filter_alt</span>{{ f }}
                    </li>
                  }
                </ul>
              }
            </div>
          } @else {
            <!-- A hand-picked set: say so plainly, so nobody reads the count as "everything". -->
            <p class="m-0 rounded-lg bg-surface-container-low px-3 py-2 text-body-sm">
              {{ 'CONGES.INBOX.BULK_SCOPE_PICKED' | translate }}
            </p>
          }

          <p class="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-body-sm">
            <span class="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            {{ 'CONGES.INBOX.BULK_EFFECT' | translate }}
          </p>

          <!-- Partial success is the EXPECTED outcome, not an error. Saying so up front stops
               the result reading as a failure when three of forty are refused. -->
          <p class="text-body-sm text-on-surface-variant">
            {{ 'CONGES.INBOX.BULK_PARTIAL' | translate }}
          </p>
        </div>
      </ng-template>

      <!-- All three modals share one body: the full request. A decision taken on less
           information than a consultation shows would be the wrong way round. -->
      <ng-template #detailTpl>
        <rh-conge-detail [row]="detailRow()" [balances]="detailBalances()"
                         [balanceField]="detailBalanceField()" />
      </ng-template>

      <!-- Approve: the same detail, plus what it will cost the balance. -->
      <ng-template #approveTpl>
        <rh-conge-detail [row]="detailRow()" [balances]="detailBalances()"
                         [balanceField]="detailBalanceField()" />
        <p class="mt-4 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-body-sm">
          <span class="material-symbols-outlined text-[18px]">account_balance_wallet</span>
          {{ 'CONGES.INBOX.APPROVE_EFFECT' | translate: { days: detailRow()?.totalJours, type: detailRow()?.typeLabel } }}
        </p>
      </ng-template>

      <!-- Refusal: a motive is mandatory, so it gets a field rather than a confirm. -->
      <ng-template #refuseTpl>
        <rh-conge-detail [row]="detailRow()" [balances]="detailBalances()"
                         [balanceField]="detailBalanceField()" />
        <p class="mt-4 mb-2 text-body-sm text-on-surface-variant">{{ 'CONGES.INBOX.REFUSE_LEAD' | translate }}</p>
        <daf-form-field
          [options]="{ label: ('CONGES.INBOX.MOTIF' | translate), type: 'textarea', rows: 3,
                       required: true, fullWidth: true, error: motifError() }"
          [value]="motif()"
          (valueChange)="motif.set(str($event) ?? '')" />
      </ng-template>

    </daf-page>
  `,
})
export class CongeInboxComponent extends CongeListBase implements OnInit {
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);

  /** The three modal bodies, handed to ModalService. */
  private readonly detailTpl = viewChild.required<TemplateRef<unknown>>('detailTpl');
  private readonly approveTpl = viewChild.required<TemplateRef<unknown>>('approveTpl');
  private readonly refuseTpl = viewChild.required<TemplateRef<unknown>>('refuseTpl');
  private readonly bulkTpl = viewChild.required<TemplateRef<unknown>>('bulkTpl');

  /**
   * The row the open modal is about.
   *
   * A signal rather than a template context variable: ModalService renders the TemplateRef in
   * its own view, so `let-row` would need a context object threaded through an API that does
   * not take one. One signal set before opening is simpler and re-renders on refresh.
   */
  readonly detailRow = signal<CongeRow | null>(null);

  /**
   * The employee's balances, fetched when a modal opens rather than with the list.
   *
   * Per-employee and therefore one call per row — asking for twenty on every page load to
   * populate a panel that is usually never opened would be the wrong trade. Left null on
   * failure, which hides the block instead of showing three dashes.
   */
  readonly detailBalances = signal<LeaveBalances | null>(null);

  /** Which balance the open request draws on, from the type catalogue. */
  readonly detailBalanceField = signal<string | null>(null);

  readonly motif = signal('');
  readonly motifError = signal('');
  readonly bulkSummary = signal<{
    approved: number; failed: number;
    failures: { leaveRequestId: number; employee: string | null; reason: string }[];
  } | null>(null);

  /**
   * Ticked rows, as the id strings the table works in.
   *
   * Selection is PER PAGE — the table only holds the rows it was given — which is why the
   * bar also offers "select the N matching": that path drops the explicit ids and lets the
   * server resolve the whole filtered queue, the behaviour this button had before.
   */
  readonly selectedIds = signal<string[]>([]);

  /** True once the user asked for the whole queue rather than ticking rows. */
  private readonly wholeQueueSelected = signal(false);

  /** Template-visible form of the above. */
  readonly wholeQueue = computed(() => this.wholeQueueSelected());

  /**
   * Checkboxes only while the pending list is shown.
   *
   * The only bulk action is approval, and approval cannot un-refuse or un-archive — so on any
   * other state filter the column would select rows nothing could be done with.
   */
  readonly pendingShown = computed(() => this.etat() === 'EN_ATTENTE');

  readonly bulkActions = computed<BulkAction[]>(() => {
    this.translate.currentLang();
    return [{
      id: 'approve',
      label: this.translate.instant('CONGES.INBOX.BULK_APPROVE'),
      icon: 'done_all',
    }];
  });

  protected fetch(filter: CongeFilter): Observable<CongePage> {
    return this.svc.queue(filter, this.translate.currentLang() ?? 'fr');
  }
  protected fetchCounts(): Observable<CongeCounts> { return this.svc.queueCounts(); }
  protected scopeKey(): string { return 'CONGES.INBOX'; }

  ngOnInit(): void {
    // The queue opens on what is waiting — the only state that needs an answer.
    this.etat.set('EN_ATTENTE');
    this.loadTypes();
    this.loadTypeRules();
    this.refreshAll();
  }

  /**
   * Which balance each type draws on, so the detail panel can point at the one an approval
   * will move. Fetched once with the catalogue; a type that tracks no balance maps to null.
   */
  private readonly balanceFieldByType = signal<Record<string, string | null>>({});

  private loadTypeRules(): void {
    this.svc.typeRules(this.translate.currentLang() ?? 'fr').subscribe({
      next: (list) => this.balanceFieldByType.set(
        Object.fromEntries(list.map((t) => [t.code, t.balanceField]))),
      // A missing map only costs the highlight, so this stays silent rather than alarming.
      error: () => this.balanceFieldByType.set({}),
    });
  }

  /** Loads the balances behind whichever modal is opening. */
  private primeDetail(row: CongeRow): void {
    this.detailRow.set(row);
    this.detailBalances.set(null);
    this.detailBalanceField.set(this.balanceFieldByType()[row.type] ?? null);
    this.svc.balancesOf(row.collaborateurId).subscribe({
      next: (b) => this.detailBalances.set(b),
      error: () => this.detailBalances.set(null),
    });
  }

  /**
   * Bulk approve lives in the toolbar rather than above the table, so the one control that
   * acts on the whole filtered set sits with the controls that define it.
   *
   * Offered only while the pending list is shown: it approves, it cannot un-refuse.
   */
  readonly toolbarActions = computed<ToolbarAction[]>(() => {
    this.translate.currentLang();
    if (this.etat() !== 'EN_ATTENTE') return [];
    return [{
      id: 'bulk',
      label: this.translate.instant('CONGES.INBOX.BULK_APPROVE'),
      icon: 'done_all',
      position: 'right',
      disabled: this.rows().length === 0 || this.working(),
    }];
  });

  onToolbarAction(id: string): void {
    if (id === 'bulk') { this.selectWholeQueue(); this.confirmBulk(); }
  }

  onBulkAction(id: string): void {
    if (id === 'approve') this.confirmBulk();
  }

  /**
   * "Approve everything that matches", the behaviour the toolbar button always had.
   *
   * The explicit ids are dropped rather than expanded client-side: the queue spans pages the
   * browser has never loaded, so only the server can enumerate it — which is exactly what
   * `bulkApprove` does when no ids arrive.
   */
  selectWholeQueue(): void {
    this.wholeQueueSelected.set(true);
    this.selectedIds.set(this.rows().map((r) => String(r.id)));
  }

  clearSelection(): void {
    this.wholeQueueSelected.set(false);
    this.selectedIds.set([]);
  }

  /** Any new page of rows drops the selection — see CongeListBase.onRowsReplaced. */
  protected override onRowsReplaced(): void {
    this.clearSelection();
  }

  /** How many requests the confirmation should name. */
  readonly bulkTargetCount = computed(() =>
    this.wholeQueueSelected() ? this.totalElements() : this.selectedIds().length);

  // ── Row actions ───────────────────────────────────────────────────────────

  onRowAction(e: { row: CongeRow; action: CongeRowAction }): void {
    if (e.action === 'approve') this.confirmApprove(e.row);
    if (e.action === 'refuse') this.openRefuse(e.row);
  }

  /**
   * Consult. Read-only, and offered on every row including decided ones — the reason, the
   * refusal motive and the decision trail are all here and nowhere else in the UI.
   *
   * It carries an Approve button when the row is still pending, so reading a request and
   * acting on it is one flow rather than "close this, now find the tick".
   */
  openDetail(row: CongeRow): void {
    this.primeDetail(row);
    // Annotated: without it TS infers the element type from the first literal and the
    // primary button below is rejected as not-'secondary'.
    const buttons: ModalButton[] = [
      {
        label: this.translate.instant('CONGES.CLOSE'), variant: 'secondary',
        action: (r: ModalRef) => r.close(),
      },
    ];
    if (row.etatDemande === 'EN_ATTENTE') {
      buttons.push({
        label: this.translate.instant('CONGES.INBOX.APPROVE'), variant: 'primary',
        icon: 'check_circle',
        action: (r: ModalRef) => { r.close(); this.confirmApprove(row); },
      });
    }
    this.modal.open({
      title: this.translate.instant('CONGES.DETAIL.TITLE'),
      subtitle: this.translate.instant('CONGES.DETAIL.SUBTITLE'),
      icon: 'beach_access',
      body: this.detailTpl(),
      size: 'md',
      buttons,
    });
  }

  /**
   * Approve. Shows the whole request plus what approving costs the balance.
   *
   * It used to be a title and one line. Approving moves an employee's allowance and cannot be
   * undone with one click — the decision deserves the same information consulting gives.
   */
  private confirmApprove(row: CongeRow): void {
    this.primeDetail(row);
    this.modal.open({
      title: this.translate.instant('CONGES.INBOX.APPROVE_TITLE'),
      subtitle: row.collaborateurName ?? '',
      icon: 'check_circle',
      body: this.approveTpl(),
      size: 'md',
      buttons: [
        { label: this.translate.instant('CONGES.CANCEL'), variant: 'secondary', action: (r) => r.close() },
        {
          label: this.translate.instant('CONGES.INBOX.APPROVE'),
          variant: 'primary',
          icon: 'check_circle',
          action: (r) => { r.close(); this.decide(row, true); },
        },
      ],
    });
  }

  private openRefuse(row: CongeRow): void {
    this.primeDetail(row);
    this.motif.set('');
    this.motifError.set('');
    this.modal.open({
      title: this.translate.instant('CONGES.INBOX.REFUSE_TITLE'),
      subtitle: row.collaborateurName ?? '',
      icon: 'cancel',
      body: this.refuseTpl(),
      size: 'md',
      closeOnBackdrop: false,
      buttons: [
        { label: this.translate.instant('CONGES.CANCEL'), variant: 'secondary', action: (r) => r.close() },
        {
          label: this.translate.instant('CONGES.INBOX.REFUSE'),
          variant: 'primary',
          action: (r) => {
            // Checked here as well as on the server, so the manager is told before the trip.
            if (!this.motif().trim()) {
              this.motifError.set(this.translate.instant('CONGES.INBOX.MOTIF_REQUIRED'));
              return;
            }
            r.close();
            this.decide(row, false, this.motif().trim());
          },
        },
      ],
    });
  }

  private decide(row: CongeRow, approved: boolean, motif?: string): void {
    this.working.set(true);
    this.svc.decide(row.id, approved, motif, this.translate.currentLang() ?? 'fr').subscribe({
      next: () => {
        this.working.set(false);
        this.notify.success(this.translate.instant(
          approved ? 'CONGES.INBOX.APPROVED_OK' : 'CONGES.INBOX.REFUSED_OK'));
        this.refreshAll();
      },
      error: (e) => {
        this.working.set(false);
        // rh-service names the rule that blocked it — an insufficient balance, a stale state.
        this.notify.error(errorMessage(e, this.translate.instant('CONGES.INBOX.DECIDE_FAILED')));
      },
    });
  }

  // ── Bulk ──────────────────────────────────────────────────────────────────

  private confirmBulk(): void {
    this.modal.open({
      title: this.translate.instant('CONGES.INBOX.BULK_TITLE'),
      subtitle: this.translate.instant('CONGES.INBOX.BULK_SUB'),
      icon: 'done_all',
      body: this.bulkTpl(),
      size: 'md',
      // No backdrop dismiss: this one debits every matching employee's balance, so leaving
      // it takes the same deliberate click as confirming it.
      closeOnBackdrop: false,
      buttons: [
        { label: this.translate.instant('CONGES.CANCEL'), variant: 'secondary', action: (r) => r.close() },
        {
          label: this.translate.instant('CONGES.INBOX.BULK_APPROVE'),
          variant: 'primary',
          icon: 'done_all',
          action: (r) => { r.close(); this.runBulk(); },
        },
      ],
    });
  }

  private runBulk(): void {
    this.working.set(true);
    this.bulkSummary.set(null);
    // EVERY filter the list is under, search included, so "approve all" means exactly the
    // rows on screen. Leaving `search` out approved everyone's requests while the list showed
    // one person's.
    //
    // `ids` only when rows were actually ticked. Sending the page's ids for a whole-queue
    // approval would silently cap it at ten; omitting them is what tells the server to
    // resolve the full filtered set. It intersects either way, so the filters still bound it.
    this.svc.bulkApprove({
      from: this.from(), to: this.to(), type: this.type(), search: this.search() || null,
      ids: this.wholeQueueSelected() ? null : this.selectedIds().map(Number),
    }).subscribe({
      next: (res) => {
        this.working.set(false);
        this.bulkSummary.set(res);
        this.clearSelection();
        this.refreshAll();
      },
      error: (e) => {
        this.working.set(false);
        this.notify.error(errorMessage(e, this.translate.instant('CONGES.INBOX.DECIDE_FAILED')));
      },
    });
  }

  /**
   * The filters currently narrowing the list, one per line, for the bulk-approve dialog.
   *
   * The button acts on the filtered set, so the dialog has to itemise that set — "approve all
   * 43 requests" and "approve all 43 requests matching Ahmed, in March" are very different
   * acts and must not read identically.
   *
   * These are exactly the filters `runBulk` forwards to the server, so what the dialog lists
   * and what the call applies cannot drift.
   */
  readonly activeFilters = computed<string[]>(() => {
    this.translate.currentLang();
    const t = (k: string, p?: object) => this.translate.instant(k, p);
    const parts: string[] = [];
    if (this.search().trim()) {
      parts.push(t('CONGES.INBOX.BULK_SCOPE_SEARCH') + ' « ' + this.search().trim() + ' »');
    }
    if (this.type()) {
      const label = this.types().find((x) => x.value === this.type())?.label ?? this.type();
      parts.push(t('CONGES.INBOX.BULK_SCOPE_TYPE') + ' ' + label);
    }
    if (this.from() && this.to()) {
      parts.push(t('CONGES.INBOX.BULK_SCOPE_PERIOD', { from: this.from(), to: this.to() }));
    }
    return parts;
  });

  protected str(v: unknown): string | null { return v == null || v === '' ? null : String(v); }
}
