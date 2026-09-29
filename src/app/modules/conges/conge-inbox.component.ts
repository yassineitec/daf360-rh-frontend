import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  PageComponent, PageHeaderComponent, DataTableComponent, ButtonComponent,
  FormFieldComponent, SelectComponent, ModalService,
  type TableColumn, type TableConfig, type TableRow, type SelectOption, type BadgeVariant,
} from '@khalilrebhiitec/daf360';

import { CongesService } from './conges.service';
import { CongeRow, DemandeEtat } from './models/conge.model';

/** The four states, for the filter. Values are the server's, unchanged. */
const ETATS: { value: DemandeEtat; labelKey: string }[] = [
  { value: 'EN_ATTENTE', labelKey: 'CONGES.ETAT.EN_ATTENTE' },
  { value: 'VALIDE',     labelKey: 'CONGES.ETAT.VALIDE' },
  { value: 'REFUSE',     labelKey: 'CONGES.ETAT.REFUSE' },
  { value: 'ARCHIVE',    labelKey: 'CONGES.ETAT.ARCHIVE' },
];

/**
 * The demandes inbox — where an employee's congé request lands.
 *
 * WHAT THIS REPLACES
 * -----------------------------------------------------------------------------
 * The timesheet's `demandes-manager` page. The queue is resolved server-side from the role
 * hierarchy (there is no manager column anywhere — see LeaveApproverService), and matches
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
    PageComponent, PageHeaderComponent, DataTableComponent, ButtonComponent,
    SelectComponent, FormFieldComponent, TranslatePipe,
  ],
  template: `
    <daf-page [loading]="loading()">
      <!-- No icon on the page header: platform convention. -->
      <daf-page-header
        [title]="'CONGES.INBOX.TITLE' | translate"
        [subtitle]="'CONGES.INBOX.SUBTITLE' | translate" />

      <div class="ci-filters">
        <daf-select
          [options]="etatOptions()"
          [selected]="sel(etat())"
          [config]="{ label: ('CONGES.FILTER.ETAT' | translate), placeholder: ('CONGES.FILTER.ALL' | translate), fullWidth: true }"
          (selectedChange)="onEtat($event[0])" />

        <daf-form-field
          [options]="{ label: ('CONGES.FILTER.FROM' | translate), type: 'date', fullWidth: true }"
          [value]="from()"
          (valueChange)="from.set(str($event)); reload()" />

        <daf-form-field
          [options]="{ label: ('CONGES.FILTER.TO' | translate), type: 'date', fullWidth: true }"
          [value]="to()"
          (valueChange)="to.set(str($event)); reload()" />

        <div class="ci-actions">
          @if (pendingShown()) {
            <daf-button
              [options]="{ label: ('CONGES.INBOX.BULK_APPROVE' | translate), variant: 'secondary', iconStart: 'done_all', disabled: rows().length === 0 || working() }"
              (onClick)="confirmBulk()" />
          }
        </div>
      </div>

      @if (bulkSummary(); as s) {
        <div class="ci-bulk" [class.ci-bulk--partial]="s.failed > 0">
          <p class="ci-bulk-head">
            {{ 'CONGES.INBOX.BULK_DONE' | translate: { approved: s.approved, failed: s.failed } }}
          </p>
          @if (s.failed > 0) {
            <ul class="ci-bulk-list">
              @for (f of s.failures; track f.leaveRequestId) {
                <li><strong>{{ f.employee || ('CONGES.UNKNOWN' | translate) }}</strong> — {{ f.reason }}</li>
              }
            </ul>
          }
        </div>
      }

      <daf-data-table
        [columns]="columns()"
        [rows]="tableRows()"
        [config]="tableConfig()" />

      @if (totalPages() > 1) {
        <div class="ci-pager">
          <daf-button
            [options]="{ label: ('CONGES.PREV' | translate), variant: 'ghost', iconStart: 'chevron_left', disabled: page() === 0 }"
            (onClick)="goto(page() - 1)" />
          <span class="ci-pager-info">{{ page() + 1 }} / {{ totalPages() }}</span>
          <daf-button
            [options]="{ label: ('CONGES.NEXT' | translate), variant: 'ghost', iconStart: 'chevron_right', disabled: page() + 1 >= totalPages() }"
            (onClick)="goto(page() + 1)" />
        </div>
      }

      <!-- Refusal: a motive is mandatory, so it gets a field rather than a confirm. -->
      <ng-template #refuseTpl>
        <p class="ci-refuse-lead">{{ 'CONGES.INBOX.REFUSE_LEAD' | translate }}</p>
        <daf-form-field
          [options]="{ label: ('CONGES.INBOX.MOTIF' | translate), type: 'textarea', rows: 3, required: true, fullWidth: true, error: motifError() }"
          [value]="motif()"
          (valueChange)="motif.set(str($event) ?? '')" />
      </ng-template>
    </daf-page>
  `,
  styles: [`
    .ci-filters { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)) auto; gap: 12px; align-items: end; margin-bottom: 18px; }
    @media (max-width: 900px) { .ci-filters { grid-template-columns: 1fr 1fr; } .ci-actions { grid-column: 1 / -1; } }
    @media (max-width: 560px) { .ci-filters { grid-template-columns: 1fr; } }
    .ci-actions { display: flex; gap: 8px; }

    .ci-bulk { margin-bottom: 16px; padding: 12px 16px; border-radius: 8px;
               background: var(--color-tertiary-container); color: var(--color-on-tertiary-container); }
    .ci-bulk--partial { background: color-mix(in srgb, var(--color-warning) 14%, transparent); color: var(--color-on-surface); }
    .ci-bulk-head { margin: 0; font-weight: 600; }
    .ci-bulk-list { margin: 8px 0 0; padding-left: 20px; font-size: .875rem; }

    .ci-pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 16px; }
    .ci-pager-info { font-variant-numeric: tabular-nums; color: var(--color-on-surface-variant); font-size: .875rem; }

    .ci-refuse-lead { margin: 0 0 12px; color: var(--color-on-surface-variant); }
  `],
})
export class CongeInboxComponent implements OnInit {
  private readonly svc = inject(CongesService);
  private readonly modal = inject(ModalService);
  private readonly translate = inject(TranslateService);

  /** The refusal form, handed to ModalService as the modal body. */
  private readonly refuseTpl = viewChild.required<TemplateRef<unknown>>('refuseTpl');

  readonly rows = signal<CongeRow[]>([]);
  readonly loading = signal(false);
  readonly working = signal(false);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  readonly etat = signal<DemandeEtat | null>('EN_ATTENTE');
  readonly from = signal<string | null>(null);
  readonly to = signal<string | null>(null);

  readonly motif = signal('');
  readonly motifError = signal('');
  readonly bulkSummary = signal<{ approved: number; failed: number; failures: { leaveRequestId: number; employee: string | null; reason: string }[] } | null>(null);

  /** Bulk approve only makes sense on a pending list — it approves, it cannot un-refuse. */
  readonly pendingShown = computed(() => this.etat() === 'EN_ATTENTE');

  readonly etatOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return ETATS.map((e) => ({ value: e.value, label: this.translate.instant(e.labelKey) }));
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'collaborateurName', label: this.translate.instant('CONGES.COL.EMPLOYEE'), sortable: true },
      { key: 'typeLabel',         label: this.translate.instant('CONGES.COL.TYPE'), sortable: true },
      { key: 'periode',           label: this.translate.instant('CONGES.COL.PERIOD') },
      { key: 'totalJours',        label: this.translate.instant('CONGES.COL.DAYS'), type: 'number', align: 'right',
        format: { maximumFractionDigits: 1 } },
      { key: 'etatBadge',         label: this.translate.instant('CONGES.COL.STATE'), type: 'badge' },
      { key: 'createdAt',         label: this.translate.instant('CONGES.COL.SUBMITTED'), type: 'date',
        format: { dateStyle: 'short' }, sortable: true },
    ];
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      hoverable: true,
      loading: this.loading(),
      emptyMessage: this.translate.instant('CONGES.INBOX.EMPTY'),
      manualSort: true,          // the server paginates; re-sorting one page would lie
      actions: [
        {
          id: 'approve',
          icon: 'check_circle',
          tooltip: this.translate.instant('CONGES.INBOX.APPROVE'),
          onClick: (r) => this.confirmApprove(r as unknown as CongeRow),
          hidden: (r) => r['etatDemande'] !== 'EN_ATTENTE',
        },
        {
          id: 'refuse',
          icon: 'cancel',
          variant: 'danger',
          tooltip: this.translate.instant('CONGES.INBOX.REFUSE'),
          onClick: (r) => this.openRefuse(r as unknown as CongeRow),
          hidden: (r) => r['etatDemande'] !== 'EN_ATTENTE',
        },
      ],
    };
  });

  /** The row shape the table renders — the period and the badge are display-only derivations. */
  readonly tableRows = computed<TableRow[]>(() =>
    this.rows().map((r) => ({
      ...r,
      periode: r.dateDebut === r.dateFin
        ? this.fmt(r.dateDebut)
        : `${this.fmt(r.dateDebut)} → ${this.fmt(r.dateFin)}`,
      etatBadge: this.badge(r.etatDemande),
    })));

  ngOnInit(): void {
    this.reload();
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  reload(): void {
    this.loading.set(true);
    this.bulkSummary.set(null);
    this.svc.queue({
      etat: this.etat(), from: this.from(), to: this.to(),
      page: this.page(), size: 20,
    }, this.translate.currentLang() ?? 'fr').subscribe({
      next: (p) => {
        this.rows.set(p.content ?? []);
        this.totalPages.set(p.totalPages ?? 0);
        this.loading.set(false);
      },
      // Not swallowed into an empty table: "no pending requests" and "the call failed" must
      // not look the same to a manager deciding whether anyone is waiting on them.
      error: () => { this.rows.set([]); this.totalPages.set(0); this.loading.set(false); },
    });
  }

  goto(p: number): void {
    this.page.set(Math.max(0, p));
    this.reload();
  }

  onEtat(v: unknown): void {
    this.etat.set((v == null || v === '' ? null : String(v)) as DemandeEtat | null);
    this.page.set(0);
    this.reload();
  }

  // ── Deciding ──────────────────────────────────────────────────────────────

  /** Names the cost, because approving moves a balance and that should not be a surprise. */
  private confirmApprove(row: CongeRow): void {
    this.modal.open({
      title: this.translate.instant('CONGES.INBOX.APPROVE_TITLE'),
      subtitle: this.translate.instant('CONGES.INBOX.APPROVE_SUB', {
        employee: row.collaborateurName ?? '',
        days: row.totalJours,
        type: row.typeLabel,
      }),
      size: 'sm',
      buttons: [
        { label: this.translate.instant('CONGES.CANCEL'), variant: 'secondary', action: (ref) => ref.close() },
        {
          label: this.translate.instant('CONGES.INBOX.APPROVE'),
          variant: 'primary',
          action: (ref) => { ref.close(); this.decide(row, true); },
        },
      ],
    });
  }

  private openRefuse(row: CongeRow): void {
    this.motif.set('');
    this.motifError.set('');
    this.modal.open({
      title: this.translate.instant('CONGES.INBOX.REFUSE_TITLE'),
      subtitle: row.collaborateurName ?? '',
      body: this.refuseTpl(),
      size: 'md',
      closeOnBackdrop: false,
      buttons: [
        { label: this.translate.instant('CONGES.CANCEL'), variant: 'secondary', action: (ref) => ref.close() },
        {
          label: this.translate.instant('CONGES.INBOX.REFUSE'),
          variant: 'primary',
          action: (ref) => {
            // Checked here as well as on the server, so the manager is told before the trip.
            if (!this.motif().trim()) {
              this.motifError.set(this.translate.instant('CONGES.INBOX.MOTIF_REQUIRED'));
              return;
            }
            ref.close();
            this.decide(row, false, this.motif().trim());
          },
        },
      ],
    });
  }

  private decide(row: CongeRow, approved: boolean, motif?: string): void {
    this.working.set(true);
    this.svc.decide(row.id, approved, motif, this.translate.currentLang() ?? 'fr').subscribe({
      next: () => { this.working.set(false); this.reload(); },
      error: (e) => {
        this.working.set(false);
        // rh-service names the rule that blocked it — an insufficient balance, a stale state.
        this.modal.open({
          title: this.translate.instant('CONGES.ERROR'),
          subtitle: e?.error?.message ?? this.translate.instant('CONGES.INBOX.DECIDE_FAILED'),
          size: 'sm',
          buttons: [{ label: this.translate.instant('CONGES.CLOSE'), variant: 'secondary', action: (r) => r.close() }],
        });
      },
    });
  }

  // ── Bulk ──────────────────────────────────────────────────────────────────

  /** Bound in the template, so protected rather than private. */
  protected confirmBulk(): void {
    this.modal.open({
      title: this.translate.instant('CONGES.INBOX.BULK_TITLE'),
      subtitle: this.translate.instant('CONGES.INBOX.BULK_SUB'),
      size: 'sm',
      buttons: [
        { label: this.translate.instant('CONGES.CANCEL'), variant: 'secondary', action: (ref) => ref.close() },
        {
          label: this.translate.instant('CONGES.INBOX.BULK_APPROVE'),
          variant: 'primary',
          action: (ref) => { ref.close(); this.runBulk(); },
        },
      ],
    });
  }

  private runBulk(): void {
    this.working.set(true);
    this.svc.bulkApprove({ from: this.from(), to: this.to() }).subscribe({
      next: (res) => {
        this.working.set(false);
        this.bulkSummary.set(res);
        this.reload();
      },
      error: () => { this.working.set(false); },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** BadgeCell is { label, options } — the variant lives inside options, not beside it. */
  private badge(etat: DemandeEtat): { label: string; options: { variant: BadgeVariant } } {
    const map: Record<DemandeEtat, BadgeVariant> = {
      EN_ATTENTE: 'warning', VALIDE: 'success', REFUSE: 'danger', ARCHIVE: 'neutral',
    };
    return { label: this.translate.instant('CONGES.ETAT.' + etat), options: { variant: map[etat] } };
  }

  private fmt(iso: string): string {
    // Split rather than new Date(): an ISO date parsed as UTC then rendered locally can
    // show the previous day, which is the exact class of bug this module just moved away from.
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  protected sel(v: string | null): string[] { return v == null ? [] : [v]; }
  protected str(v: unknown): string | null { return v == null || v === '' ? null : String(v); }
}
