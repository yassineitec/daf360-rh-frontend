import { Component, Input, OnInit, TemplateRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  AvatarComponent, DafCellDirective, DataTableComponent, FormFieldComponent,
  MetricCardComponent, ModalService, PageComponent, PageHeaderComponent,
  PaginationComponent, StatusBadgeComponent, TableColumn, TableConfig, TableRow,
  BadgeVariant, SortDirection,
} from '@khalilrebhiitec/daf360';

import { NotificationService } from '../../core/notification.service';
import { TableActionComponent } from '../../shared/table-action.component';
import { CongeModificationsService } from './conge-modifications.service';
import {
  CongeModificationCounts, CongeModificationPage, CongeModificationRow,
} from './models/conge-modification.model';
import { errorMessage } from './conge-display';

/** Which of the two approval stages this page is working. */
export type ModificationStage = 'manager' | 'hr';

/**
 * `/rh/conges/modifications/manager` and `/rh/conges/modifications/hr` — the two stages of a
 * modification or annulation request.
 *
 * ONE COMPONENT, TWO ROUTES, the same arrangement {@link CongeHistoryComponent} uses for its
 * two histories: the screens differ in which endpoint they call, which permission guards
 * them and what the decision does, and in nothing else. Two components would be the same
 * table twice, and a change to the comparison layout would land in one of them.
 *
 * WHAT THE TWO STAGES ACTUALLY DECIDE — they are NOT the same question
 * -----------------------------------------------------------------------------
 *   manager — only MODIFICATION requests reach here, and agreeing changes NOTHING: it passes
 *             the proposal to HR. The manager is being asked whether the new dates work for
 *             the team, not whether the balance can take it.
 *   hr      — every request reaches here, and this is the stage that WRITES. Approving moves
 *             the congé and adjusts the balance by the difference.
 *
 * The badge on the approve button says which of the two is happening, because "Approuver"
 * meaning "pass it on" in one screen and "apply it now" in the other is how somebody approves
 * a thing they meant to forward.
 */
@Component({
  selector: 'app-conge-modifications',
  standalone: true,
  imports: [
    PageComponent, PageHeaderComponent, MetricCardComponent, PaginationComponent,
    DataTableComponent, DafCellDirective, StatusBadgeComponent, AvatarComponent,
    FormFieldComponent, TableActionComponent, TranslatePipe, DatePipe,
  ],
  template: `
    <daf-page [loading]="firstLoad()" [kpis]="4">

      <!-- No icon on the page header: platform convention. -->
      <daf-page-header
        [title]="(stage === 'hr' ? 'CONGES.MODIF.TITLE_HR' : 'CONGES.MODIF.TITLE_MANAGER') | translate"
        [subtitle]="(stage === 'hr' ? 'CONGES.MODIF.SUB_HR' : 'CONGES.MODIF.SUB_MANAGER') | translate" />

      <!-- Counted over the whole scope by its own endpoint, never over the current page. -->
      <section class="grid grid-cols-4 gap-2 sm:gap-6">
        <daf-metric-card
          [label]="'CONGES.MODIF.KPI.PENDING_MANAGER' | translate" [value]="counts().manager"
          [options]="{ icon: 'supervisor_account', iconColor: 'text-warning', iconBg: 'bg-warning/10',
                       help: ('CONGES.MODIF.KPI.PENDING_MANAGER_HELP' | translate) }" />
        <daf-metric-card
          [label]="'CONGES.MODIF.KPI.PENDING_HR' | translate" [value]="counts().hr"
          [options]="{ icon: 'hourglass_top', iconColor: 'text-primary', iconBg: 'bg-primary/10',
                       help: ('CONGES.MODIF.KPI.PENDING_HR_HELP' | translate) }" />
        <daf-metric-card
          [label]="'CONGES.MODIF.KPI.APPROVED' | translate" [value]="counts().approved"
          [options]="{ icon: 'check_circle', iconColor: 'text-success', iconBg: 'bg-success/10' }" />
        <daf-metric-card
          [label]="'CONGES.MODIF.KPI.REJECTED' | translate" [value]="counts().rejected"
          [options]="{ icon: 'cancel', iconColor: 'text-danger', iconBg: 'bg-danger/10' }" />
      </section>

      @if (error()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>{{ error() }}
        </div>
      }

      <daf-data-table [columns]="columns()" [rows]="tableRows()" [config]="tableConfig()"
                      (sortChange)="onSort($event)" class="block min-w-0">

        <!-- Who asked. -->
        <ng-template dafCell="collaborateur" let-row>
          <div class="flex min-w-0 items-center gap-2">
            <daf-avatar [data]="{ name: row['_s'].collaborateurNom ?? '—',
                                  avatarUrl: row['_s'].collaborateurAvatarUrl }"
                        size="sm" />
            <span class="truncate">{{ row['_s'].collaborateurNom ?? '—' }}</span>
          </div>
        </ng-template>

        <!-- The congé as approved, against what is being asked. The whole point of the
             screen: an approver cannot judge the proposal without the thing it replaces. -->
        <ng-template dafCell="comparison" let-row>
          <div class="flex min-w-0 flex-col gap-0.5 text-body-sm">
            <span class="text-on-surface-variant line-through">
              {{ row['_s'].absenceDateDebut | date: 'dd/MM/yy' }} →
              {{ row['_s'].absenceDateFin | date: 'dd/MM/yy' }}
              ({{ row['_s'].absenceTotalJours }} {{ 'CONGES.DAYS' | translate }})
            </span>
            @if (row['_s'].type === 'ANNULATION') {
              <span class="font-medium text-danger">{{ 'CONGES.MODIF.CANCELLED' | translate }}</span>
            } @else {
              <span class="font-medium text-on-surface">
                {{ row['_s'].nouvelleDateDebut | date: 'dd/MM/yy' }} →
                {{ row['_s'].nouvelleDateFin | date: 'dd/MM/yy' }}
                ({{ row['_s'].nouveauTotal }} {{ 'CONGES.DAYS' | translate }})
              </span>
            }
          </div>
        </ng-template>

        <!-- What it costs or gives back. Signed, because the sign is the decision. -->
        <ng-template dafCell="delta" let-row>
          @if (row['_s'].deltaJours === null) {
            <span class="text-outline">—</span>
          } @else if (row['_s'].deltaJours > 0) {
            <span class="font-semibold text-danger">+{{ row['_s'].deltaJours }}</span>
          } @else if (row['_s'].deltaJours < 0) {
            <span class="font-semibold text-success">{{ row['_s'].deltaJours }}</span>
          } @else {
            <span class="text-on-surface-variant">0</span>
          }
        </ng-template>

        <ng-template dafCell="type" let-row>
          <daf-badge [label]="row['_s'].typeLabel"
                     [options]="{ variant: row['_s'].type === 'ANNULATION' ? 'danger' : 'info', size: 'sm' }" />
        </ng-template>

        <ng-template dafCell="etat" let-row>
          <daf-badge [label]="row['_s'].etatLabel"
                     [options]="{ variant: badgeVariant(row['_s'].etat), size: 'sm', dot: true }" />
        </ng-template>

        <ng-template dafCell="_actions" let-row>
          <div class="flex items-center justify-end gap-1">
            <rh-table-action id="view" icon="visibility"
                             [tooltip]="'CONGES.MODIF.CONSULT' | translate"
                             (action)="openDetail(row['_s'])" />
            <rh-table-action id="approve" icon="check_circle"
                             [tooltip]="(stage === 'hr' ? 'CONGES.MODIF.APPLY' : 'CONGES.MODIF.FORWARD') | translate"
                             [disabled]="working()"
                             (action)="confirmApprove(row['_s'])" />
            <rh-table-action id="reject" icon="cancel"
                             [tooltip]="'CONGES.MODIF.REJECT' | translate"
                             [disabled]="working()"
                             (action)="openReject(row['_s'])" />
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

      <!-- Consult. Same comparison the table shows, with the employee's reasoning. -->
      <ng-template #detailTpl>
        @if (detailRow(); as r) {
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3">
              <daf-avatar [data]="{ name: r.collaborateurNom ?? '—',
                                    avatarUrl: r.collaborateurAvatarUrl }"
                          size="md" />
              <div class="flex flex-col">
                <span class="font-semibold">{{ r.collaborateurNom }}</span>
                <span class="text-body-sm text-on-surface-variant">{{ r.absenceTypeLabel }}</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 rounded-xl bg-surface-container-low p-3">
              <div class="flex flex-col">
                <span class="text-label-sm text-on-surface-variant">{{ 'CONGES.MODIF.CURRENT' | translate }}</span>
                <span class="text-body-md">
                  {{ r.absenceDateDebut | date: 'dd/MM/yyyy' }} → {{ r.absenceDateFin | date: 'dd/MM/yyyy' }}
                </span>
                <span class="text-body-sm text-on-surface-variant">
                  {{ r.absenceTotalJours }} {{ 'CONGES.DAYS' | translate }}
                </span>
              </div>
              <div class="flex flex-col">
                <span class="text-label-sm text-on-surface-variant">{{ 'CONGES.MODIF.PROPOSED' | translate }}</span>
                @if (r.type === 'ANNULATION') {
                  <span class="text-body-md font-medium text-danger">
                    {{ 'CONGES.MODIF.CANCELLED' | translate }}
                  </span>
                } @else {
                  <span class="text-body-md font-medium">
                    {{ r.nouvelleDateDebut | date: 'dd/MM/yyyy' }} → {{ r.nouvelleDateFin | date: 'dd/MM/yyyy' }}
                  </span>
                  <span class="text-body-sm text-on-surface-variant">
                    {{ r.nouveauTotal }} {{ 'CONGES.DAYS' | translate }}
                  </span>
                }
              </div>
            </div>

            @if (r.motif) {
              <div class="flex flex-col gap-1">
                <span class="text-label-sm text-on-surface-variant">{{ 'CONGES.MODIF.MOTIF' | translate }}</span>
                <p class="text-body-md whitespace-pre-line">{{ r.motif }}</p>
              </div>
            }
            @if (r.motifRefus) {
              <div class="flex flex-col gap-1 rounded-xl bg-danger/10 p-3">
                <span class="text-label-sm text-danger">{{ 'CONGES.MODIF.MOTIF_REFUS' | translate }}</span>
                <p class="text-body-md whitespace-pre-line">{{ r.motifRefus }}</p>
              </div>
            }
          </div>
        }
      </ng-template>

      <!-- Refusal. The motif is required — the server refuses a blank one, so asking here
           saves a round trip and says why. -->
      <ng-template #rejectTpl>
        <div class="flex flex-col gap-3">
          <p class="text-body-md">{{ 'CONGES.MODIF.REJECT_INTRO' | translate }}</p>
          <daf-form-field
            [options]="{ label: ('CONGES.MODIF.MOTIF_REFUS' | translate), type: 'textarea',
                         required: true, fullWidth: true, rows: 3 }"
            [value]="rejectMotif()"
            (valueChange)="rejectMotif.set($any($event) ?? '')" />
        </div>
      </ng-template>

    </daf-page>
  `,
})
export class CongeModificationsComponent implements OnInit {
  /**
   * Read from the route's `data.stage`, not bound as an @Input: rh-frontend calls
   * provideRouter(routes) WITHOUT withComponentInputBinding(), so a route-data binding would
   * silently never arrive and every page would render as the default — the same trap
   * CongeHistoryComponent records.
   */
  @Input() stage: ModificationStage = 'manager';

  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(CongeModificationsService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly firstLoad = signal(true);
  readonly loading = signal(false);
  readonly working = signal(false);
  readonly error = signal<string | null>(null);

  readonly rows = signal<CongeModificationRow[]>([]);
  readonly counts = signal<CongeModificationCounts>(
    { manager: 0, hr: 0, approved: 0, rejected: 0 });

  readonly currentPage = signal(0);
  readonly pageSize = signal(10);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly pageSizeOptions = [10, 25, 50];

  readonly sortKey = signal('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  private readonly detailTpl = viewChild.required<TemplateRef<unknown>>('detailTpl');
  private readonly rejectTpl = viewChild.required<TemplateRef<unknown>>('rejectTpl');
  readonly detailRow = signal<CongeModificationRow | null>(null);
  readonly rejectMotif = signal('');

  ngOnInit(): void {
    const fromRoute = this.route.snapshot.data['stage'] as ModificationStage | undefined;
    if (fromRoute) this.stage = fromRoute;
    this.refreshAll();
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  private fetch(): Observable<CongeModificationPage> {
    const lang = this.translate.currentLang() ?? 'fr';
    const filter = {
      page: this.currentPage(), size: this.pageSize(),
      sort: this.sortKey(), dir: this.sortDir(),
    };
    return this.stage === 'hr' ? this.svc.hrQueue(filter, lang) : this.svc.managerQueue(filter, lang);
  }

  refreshAll(): void {
    this.load();
    this.svc.counts().subscribe({
      next: c => this.counts.set(c),
      // A failed count costs the four figures and nothing else — the queue still renders.
      error: () => { /* keep the last known figures */ },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fetch().subscribe({
      next: p => {
        this.rows.set(p.content ?? []);
        this.totalPages.set(p.totalPages ?? 0);
        this.totalElements.set(p.totalElements ?? 0);
        this.loading.set(false);
        this.firstLoad.set(false);
      },
      error: e => {
        this.rows.set([]);
        this.error.set(errorMessage(e, this.translate.instant('CONGES.MODIF.ERR_LOAD')));
        this.loading.set(false);
        this.firstLoad.set(false);
      },
    });
  }

  // ── Table ─────────────────────────────────────────────────────────────────

  columns(): TableColumn[] {
    this.translate.currentLang();
    return [
      { key: 'collaborateur', label: this.translate.instant('CONGES.COL.EMPLOYEE') },
      { key: 'type', label: this.translate.instant('CONGES.MODIF.COL.TYPE'), width: '120px' },
      { key: 'comparison', label: this.translate.instant('CONGES.MODIF.COL.CHANGE') },
      { key: 'delta', label: this.translate.instant('CONGES.MODIF.COL.DELTA'), width: '90px' },
      { key: 'etat', label: this.translate.instant('CONGES.COL.STATE'), width: '150px' },
      { key: 'createdAt', label: this.translate.instant('CONGES.MODIF.COL.ASKED'), sortable: true, width: '120px' },
      { key: '_actions', label: '', width: '132px' },
    ];
  }

  /** `_s` carries the typed row through the table's untyped row map — the module's convention. */
  tableRows(): TableRow[] {
    return this.rows().map(r => ({
      id: r.id,
      createdAt: r.createdAt,
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
      emptyMessage: this.translate.instant(
        this.stage === 'hr' ? 'CONGES.MODIF.EMPTY_HR' : 'CONGES.MODIF.EMPTY_MANAGER'),
    } as TableConfig;
  }

  badgeVariant(state: string): BadgeVariant {
    switch (state) {
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'danger';
      case 'PENDING_HR': return 'info';
      default: return 'warning';
    }
  }

  onSort(e: { key: string; dir: SortDirection }): void {
    this.sortKey.set(e.key);
    // The table's SortDirection includes null (the third click clears the sort); the
    // endpoint always needs a direction, so a cleared header falls back to descending.
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

  // ── Decisions ─────────────────────────────────────────────────────────────

  openDetail(row: CongeModificationRow): void {
    this.detailRow.set(row);
    this.modal.open({
      title: this.translate.instant('CONGES.MODIF.DETAIL_TITLE'),
      subtitle: row.typeLabel,
      body: this.detailTpl(),
      size: 'md',
      buttons: [{
        label: this.translate.instant('CONGES.CLOSE'), variant: 'secondary',
        action: r => r.close(),
      }],
    });
  }

  /**
   * Approving is confirmed, and the confirmation says which of the two things is about to
   * happen. At the manager stage it forwards; at the HR stage it moves a congé and a balance,
   * and the number of days is named so nobody applies a figure they did not read.
   */
  confirmApprove(row: CongeModificationRow): void {
    const hr = this.stage === 'hr';
    const key = hr
      ? (row.type === 'ANNULATION' ? 'CONGES.MODIF.CONFIRM_APPLY_CANCEL' : 'CONGES.MODIF.CONFIRM_APPLY')
      : 'CONGES.MODIF.CONFIRM_FORWARD';

    this.modal.open({
      title: this.translate.instant(hr ? 'CONGES.MODIF.APPLY' : 'CONGES.MODIF.FORWARD'),
      subtitle: this.translate.instant(key, {
        employee: row.collaborateurNom ?? '',
        days: row.deltaJours === null ? '?' : Math.abs(row.deltaJours),
      }),
      size: 'sm',
      buttons: [
        { label: this.translate.instant('CONGES.CANCEL'), variant: 'secondary', action: r => r.close() },
        {
          label: this.translate.instant('CONGES.MODIF.CONFIRM'),
          variant: 'primary',
          action: r => { r.close(); this.decide(row, true); },
        },
      ],
    });
  }

  openReject(row: CongeModificationRow): void {
    this.rejectMotif.set('');
    this.modal.open({
      title: this.translate.instant('CONGES.MODIF.REJECT'),
      subtitle: row.collaborateurNom ?? '',
      body: this.rejectTpl(),
      size: 'sm',
      buttons: [
        { label: this.translate.instant('CONGES.CANCEL'), variant: 'secondary', action: r => r.close() },
        {
          label: this.translate.instant('CONGES.MODIF.REJECT'),
          // ModalService buttons take primary/secondary only — the refusal is the modal's
          // main action, and its own title already says what it does.
          variant: 'primary',
          action: r => {
            if (!this.rejectMotif().trim()) {
              this.notify.error(this.translate.instant('CONGES.MODIF.MOTIF_REQUIRED'));
              return;
            }
            r.close();
            this.decide(row, false, this.rejectMotif().trim());
          },
        },
      ],
    });
  }

  private decide(row: CongeModificationRow, approved: boolean, motifRefus?: string): void {
    const lang = this.translate.currentLang() ?? 'fr';
    this.working.set(true);

    const call = this.stage === 'hr'
      ? this.svc.decideAsHr(row.id, approved, motifRefus, lang)
      : this.svc.decideAsManager(row.id, approved, motifRefus, lang);

    call.subscribe({
      next: () => {
        this.working.set(false);
        this.notify.success(this.translate.instant(
          approved
            ? (this.stage === 'hr' ? 'CONGES.MODIF.APPLIED_OK' : 'CONGES.MODIF.FORWARDED_OK')
            : 'CONGES.MODIF.REJECTED_OK'));
        this.refreshAll();
      },
      error: e => {
        this.working.set(false);
        this.notify.error(errorMessage(e, this.translate.instant('CONGES.MODIF.ERR_DECIDE')));
      },
    });
  }
}
