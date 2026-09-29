import { Component, OnInit, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
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
    PaginationComponent, FormFieldComponent, CongeDetailComponent,
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
    if (id === 'bulk') this.confirmBulk();
  }

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
      // Names the count and the active filters, because "all" means something different
      // depending on what is filtered and the button cannot be undone in one click.
      subtitle: this.translate.instant('CONGES.INBOX.BULK_SUB', {
        count: this.totalElements(),
        scope: this.activeFilterSummary(),
      }),
      size: 'sm',
      buttons: [
        { label: this.translate.instant('CONGES.CANCEL'), variant: 'secondary', action: (r) => r.close() },
        {
          label: this.translate.instant('CONGES.INBOX.BULK_APPROVE'),
          variant: 'primary',
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
    this.svc.bulkApprove({
      from: this.from(), to: this.to(), type: this.type(), search: this.search() || null,
    }).subscribe({
      next: (res) => {
        this.working.set(false);
        this.bulkSummary.set(res);
        this.refreshAll();
      },
      error: (e) => {
        this.working.set(false);
        this.notify.error(errorMessage(e, this.translate.instant('CONGES.INBOX.DECIDE_FAILED')));
      },
    });
  }

  /**
   * The filters currently narrowing the list, in words, for the bulk-approve confirmation.
   *
   * The button acts on the filtered set, so the confirmation has to say what that set is —
   * "approve all 43 requests" and "approve all 43 requests matching Ahmed, in March" are very
   * different acts and must not read identically.
   */
  private activeFilterSummary(): string {
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
    return parts.length === 0 ? t('CONGES.INBOX.BULK_SCOPE_NONE') : parts.join(' · ');
  }

  protected str(v: unknown): string | null { return v == null || v === '' ? null : String(v); }
}
