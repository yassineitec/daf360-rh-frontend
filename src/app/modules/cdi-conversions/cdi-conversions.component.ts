import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, ButtonComponent, DataTableComponent, FormFieldComponent, MetricCardComponent,
  PageComponent, PageHeaderComponent, TabItem, TableColumn, TableConfig, TableRow,
  TabsComponent, tabParam,
} from '@khalilrebhiitec/daf360';

import { ModalComponent } from '../../shared/modal.component';
import { errorMessage, formatAmount, initialsOf, localeDate, localeOf } from '../missions/mission-display';
import { CdiConversionService } from './cdi-conversion.service';
import { CdiConversion, CdiDecisionAction, CdiDecisionPayload, isAwaitingConversion } from './cdi-conversion.model';
import { cdiStatusKey, cdiStatusVariant } from './cdi-conversion-display';
import { CdiConversionDetailDrawerComponent, CdiDrawerAction } from './cdi-conversion-detail-drawer.component';
import { CdiConversionDecisionModalComponent } from './cdi-conversion-decision-modal.component';

type TabKey = 'todo' | 'all';

/**
 * `/rh/cdi-conversions` — CIVP → CDI requests, canonical page shape (§1).
 *
 * « À traiter » is what waits for the caller, computed by the backend from their
 * permissions: SUBMITTED for the technical & salary validator, ESCALATED for the arbiter,
 * APPROVED-not-converted for RH. « Toutes » is every request of the caller's pays scope
 * (a pure requester sees only their own). Requests are filed from the profile's contract
 * card, never from here — the contract is the context the requester needs.
 */
@Component({
  selector: 'rh-cdi-conversions',
  standalone: true,
  imports: [
    PageComponent, PageHeaderComponent, MetricCardComponent, TabsComponent, DataTableComponent,
    ButtonComponent, FormFieldComponent, ModalComponent,
    CdiConversionDetailDrawerComponent, CdiConversionDecisionModalComponent, TranslatePipe,
  ],
  templateUrl: './cdi-conversions.component.html',
})
export class CdiConversionsComponent implements OnInit {
  private svc = inject(CdiConversionService);
  private translate = inject(TranslateService);
  private route = inject(ActivatedRoute);

  readonly todo = signal<CdiConversion[]>([]);
  readonly all = signal<CdiConversion[]>([]);
  readonly firstLoad = signal(true);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly activeTab = tabParam<TabKey>(['todo', 'all'], 'todo');

  readonly selected = signal<CdiConversion | null>(null);
  readonly deciding = signal<CdiDecisionAction | null>(null);
  readonly cancelling = signal(false);
  readonly cancelComment = signal('');
  readonly submitting = signal(false);
  readonly modalError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.svc.get(id).subscribe({
        next: r => this.selected.set(r),
        error: err => this.error.set(errorMessage(err, this.translate)),
      });
    }
  }

  load(): void {
    if (!this.firstLoad()) this.loading.set(true);
    this.error.set(null);
    this.svc.list(false).subscribe({
      next: list => {
        this.all.set(list);
        this.todo.set(list.filter(r => r.canDecide || r.canConvert));
        this.loading.set(false);
        this.firstLoad.set(false);
        // Keep an open drawer in step with the refreshed row.
        const open = this.selected();
        if (open) this.selected.set(list.find(r => r.id === open.id) ?? open);
      },
      error: err => {
        this.error.set(errorMessage(err, this.translate));
        this.loading.set(false);
        this.firstLoad.set(false);
      },
    });
  }

  // ── Header / KPIs / tabs ─────────────────────────────────────────────────

  readonly stats = computed(() => {
    const list = this.all();
    return {
      todo: this.todo().length,
      pending: list.filter(r => r.status === 'SUBMITTED' || r.status === 'ESCALATED').length,
      toConvert: list.filter(isAwaitingConversion).length,
      converted: list.filter(r => r.convertedContractId != null).length,
    };
  });

  readonly tabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { id: 'todo', label: t('CDI_CONVERSION.TABS.TODO'), count: this.firstLoad() ? null : this.stats().todo },
      { id: 'all', label: t('CDI_CONVERSION.TABS.ALL') },
    ];
  });

  readonly visible = computed(() => (this.activeTab() === 'todo' ? this.todo() : this.all()));

  // ── Table ────────────────────────────────────────────────────────────────

  private readonly locale = computed(() => localeOf(this.translate.currentLang()));

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const src = (row: TableRow) => row['_source'] as CdiConversion;
    const time = (iso: string | null) => (iso ? new Date(iso).getTime() || null : null);
    return [
      { key: 'employee', label: t('CDI_CONVERSION.COLS.EMPLOYEE'), type: 'avatar', sortable: true },
      { key: 'status',   label: t('CDI_CONVERSION.COLS.STATUS'), type: 'badge', sortable: true },
      { key: 'start',    label: t('CDI_CONVERSION.COLS.START'), sortable: true,
        sortAccessor: row => time(src(row).validatedStartDate ?? src(row).requestedStartDate) },
      { key: 'salary',   label: t('CDI_CONVERSION.COLS.SALARY'), sortable: true, align: 'right',
        sortAccessor: row => src(row).validatedNetSalary ?? src(row).proposedNetSalary },
      { key: 'requester', label: t('CDI_CONVERSION.COLS.REQUESTER'), sortable: true },
      { key: 'requested', label: t('CDI_CONVERSION.COLS.REQUESTED_AT'), sortable: true,
        sortAccessor: row => time(src(row).requestedAt) },
    ];
  });

  readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return this.visible().map(r => ({
      employee: { name: r.employeeName ?? '—', initials: initialsOf(r.employeeName), subtitle: 'CIVP → CDI' },
      status: {
        label: t(cdiStatusKey(r)),
        options: { variant: cdiStatusVariant(r), size: 'sm', dot: true },
      } satisfies BadgeCell,
      start: localeDate(r.validatedStartDate ?? r.requestedStartDate, this.locale()),
      salary: formatAmount(r.validatedNetSalary ?? r.proposedNetSalary, null, this.locale()),
      requester: r.requestedByName ?? '—',
      requested: localeDate(r.requestedAt, this.locale()),
      _source: r,
    }));
  });

  readonly config = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const src = (row: TableRow) => row['_source'] as CdiConversion;
    return {
      showHeader: false,
      hoverable: true,
      loading: this.loading(),
      skeletonRows: 5,
      emptyMessage: t(this.activeTab() === 'todo' ? 'CDI_CONVERSION.EMPTY_TODO' : 'CDI_CONVERSION.EMPTY_ALL'),
      rowId: row => src(row).id,
      actions: [
        { id: 'open', icon: 'visibility', tooltip: t('CDI_CONVERSION.ACTIONS.OPEN'),
          onClick: row => this.selected.set(src(row)) },
      ],
    };
  });

  // ── Actions ──────────────────────────────────────────────────────────────

  onRowClick(row: TableRow): void {
    this.selected.set(row['_source'] as CdiConversion);
  }

  onDrawerAction(action: CdiDrawerAction): void {
    this.modalError.set(null);
    if (action === 'CANCEL') {
      this.cancelComment.set('');
      this.cancelling.set(true);
    } else {
      this.deciding.set(action);
    }
  }

  applyDecision(payload: CdiDecisionPayload): void {
    const r = this.selected();
    if (!r || this.submitting()) return;
    this.submitting.set(true);
    this.modalError.set(null);
    this.svc.decide(r.id, payload).subscribe({
      next: updated => {
        this.submitting.set(false);
        this.deciding.set(null);
        this.selected.set(updated);
        this.load();
      },
      error: err => {
        this.submitting.set(false);
        this.modalError.set(errorMessage(err, this.translate));
      },
    });
  }

  confirmCancel(): void {
    const r = this.selected();
    if (!r || this.submitting()) return;
    this.submitting.set(true);
    this.modalError.set(null);
    this.svc.cancel(r.id, this.cancelComment().trim() || null).subscribe({
      next: updated => {
        this.submitting.set(false);
        this.cancelling.set(false);
        this.selected.set(updated);
        this.load();
      },
      error: err => {
        this.submitting.set(false);
        this.modalError.set(errorMessage(err, this.translate));
      },
    });
  }

  onCancelComment(v: string | number | null): void {
    this.cancelComment.set(v == null ? '' : String(v));
  }
}
