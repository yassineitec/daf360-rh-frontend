import {
  Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import {
  BadgeCell,
  ButtonComponent,
  CardComponent,
  ChipGroupComponent,
  DafCellDirective,
  DataTableComponent,
  PaginationComponent,
  StatusBadgeComponent,
  TableColumn,
  TableConfig,
  TableRow,
} from '@khalilrebhiitec/daf360';

import { RequestsService }               from './requests.service';
import { EmployeeRequest, RequestStatus } from './models/request.model';
import { SlaCountdownPipe, SlaLevel }    from '../../shared/sla-countdown.pipe';
import { UserStore }                     from '../../core/user.store';
import { NewRequestComponent }           from './new-request.component';
import { statusBadge } from '../../shared/status-badge.utils';

const ACTIVE_STATUSES: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'PENDING_L2'];
const DONE_STATUSES:   RequestStatus[] = ['APPROVED', 'REJECTED', 'CANCELLED'];

type TabKey = 'active' | 'done';

const SLA_BADGE_VARIANT: Record<SlaLevel, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ok:       'success',
  warning:  'warning',
  critical: 'danger',
  none:     'neutral',
};

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [
    ButtonComponent, CardComponent, ChipGroupComponent, StatusBadgeComponent,
    DataTableComponent, DafCellDirective, PaginationComponent,
    SlaCountdownPipe, NewRequestComponent,
  ],
  template: `
    <div class="space-y-6">

      <!-- ── Header ─────────────────────────────────────────────────────── -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <h1 class="text-[32px] font-bold leading-tight tracking-tight text-on-surface">
            Mes demandes RH
          </h1>
          <daf-badge [label]="total().toString()" [options]="{ variant: 'teal', pill: true }" />
        </div>
        <div class="flex items-center gap-3">
          @if (canViewInbox()) {
            <daf-button
              [options]="{ variant: 'ghost', label: 'Boîte de réception', iconStart: 'inbox' }"
              (onClick)="goToInbox()" />
          }
          <daf-button
            [options]="{ variant: 'teal', label: 'Nouvelle demande', iconStart: 'add' }"
            (onClick)="goToSelfService()" />
        </div>
      </div>

      <!-- ── Intro card ─────────────────────────────────────────────────── -->
      <daf-card class="block mb-6" [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
        <p class="text-[11px] font-bold uppercase tracking-widest text-teal mb-1">Statut de vos requêtes</p>
        <h2 class="text-[18px] font-bold text-on-surface">Suivi en temps réel de vos demandes administratives.</h2>
      </daf-card>

      <!-- ── Main card ──────────────────────────────────────────────────── -->
      <daf-card class="block" [options]="{ variant: 'default', padding: 'none', radius: 'xl' }">

        <!-- Tabs -->
        <div class="p-4 sm:p-5 border-b border-outline-variant">
          <daf-chip-group
            [options]="tabOptions()"
            [selected]="[activeTab()]"
            (selectedChange)="onTabChange($event)" />
        </div>

        <div class="p-4 sm:p-5">

          <!-- Empty state -->
          @if (!loading() && visibleRows().length === 0) {
            <div class="flex flex-col items-center py-16 gap-3 text-center">
              <span class="material-symbols-outlined text-[48px] text-outline-variant">move_to_inbox</span>
              <p class="text-[16px] font-semibold text-on-surface">
                @if (activeTab() === 'done') { Aucune demande traitée } @else { Aucune demande en cours }
              </p>
              <p class="text-[13px] text-outline">Vos demandes apparaîtront ici.</p>
            </div>

          <!-- Table -->
          } @else {
            <daf-data-table [columns]="columns" [rows]="rows()" [config]="tableConfig()">

              <ng-template dafCell="type" let-row>
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-teal/10 text-teal flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[18px]">description</span>
                  </div>
                  <span class="font-semibold text-on-surface">{{ row['type'] }}</span>
                </div>
              </ng-template>

              <ng-template dafCell="sla" let-row>
                @if (row['isActive']) {
                  @let sla = row['slaDeadline'] | slaCountdown;
                  <daf-badge [label]="sla.label" [options]="{ variant: slaVariant(sla.level), size: 'sm', dot: true }" />
                } @else {
                  <span class="text-outline">—</span>
                }
              </ng-template>

              <ng-template dafCell="_actions" let-row>
                <div class="flex items-center justify-end gap-1">
                  <daf-button
                    [options]="{ variant: 'ghost', size: 'sm', iconStart: 'visibility' }"
                    (onClick)="viewDetail(row['_source'].id)" />
                  @if (row['_source'].status === 'SUBMITTED') {
                    <daf-button
                      [options]="{ variant: 'danger', size: 'sm', iconStart: 'delete_outline' }"
                      (onClick)="cancel(row['_source'])" />
                  }
                </div>
              </ng-template>

            </daf-data-table>

            @if (totalPages() > 1) {
              <div class="mt-4 flex justify-center">
                <daf-pagination
                  [currentPage]="page()"
                  [totalPages]="totalPages()"
                  [totalElements]="total()"
                  [config]="{ showPrevNext: true, size: 'sm' }"
                  (pageChange)="goPage($event)" />
              </div>
            }
          }

        </div>
      </daf-card>

    </div>

    <!-- ── New request modal ─────────────────────────────── -->
    <app-new-request
      [visible]="showNew()"
      [profileId]="currentProfileId()"
      [paysId]="currentPaysId()"
      (closed)="showNew.set(false)"
      (submitted)="onSubmitted()"
    />
  `,
})
export class RequestListComponent implements OnInit {
  private svc       = inject(RequestsService);
  private userStore = inject(UserStore);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);

  loading    = signal(false);
  allRows    = signal<EmployeeRequest[]>([]);
  total      = signal(0);
  totalPages = signal(1);
  page       = signal(0);
  showNew    = signal(false);
  activeTab  = signal<TabKey>('active');

  protected readonly statusBadge = statusBadge;
  protected readonly slaVariant  = (level: SlaLevel) => SLA_BADGE_VARIANT[level];

  canViewInbox    = computed(() => this.userStore.isHrManager() || this.userStore.isAdmin());
  currentPaysId   = computed(() => this.userStore.currentUser()?.paysId ?? 1);
  currentProfileId = computed(() => {
    const u = this.userStore.currentUser();
    if (!u) return 0;
    const fromEmployee = parseInt(u.employeeId ?? '', 10);
    return isNaN(fromEmployee) ? u.userId : fromEmployee;
  });

  readonly tabOptions = computed(() => [
    { value: 'active', label: `En cours (${this.activeCount()})` },
    { value: 'done',   label: `Traitées (${this.doneCount()})` },
  ]);

  visibleRows = computed(() => {
    const all = this.allRows();
    return this.activeTab() === 'active'
      ? all.filter(r => ACTIVE_STATUSES.includes(r.status))
      : all.filter(r => DONE_STATUSES.includes(r.status));
  });

  activeCount = computed(() =>
    this.allRows().filter(r => ACTIVE_STATUSES.includes(r.status)).length
  );
  doneCount = computed(() =>
    this.allRows().filter(r => DONE_STATUSES.includes(r.status)).length
  );

  readonly columns: TableColumn[] = [
    { key: 'type', label: 'Type de demande' },
    { key: 'submissionDate', label: 'Soumise le' },
    { key: 'status', label: 'Statut', type: 'badge' },
    { key: 'sla', label: 'SLA' },
    { key: '_actions', label: 'Actions', align: 'right' },
  ];

  readonly rows = computed<TableRow[]>(() =>
    this.visibleRows().map(r => ({
      type:            r.typeDisplayNameFr ?? 'Demande #' + r.requestTypeId,
      submissionDate:  this.fmtDate(r.submissionDate),
      status:          { label: this.statusBadge(r.status).label, options: this.statusBadge(r.status).options } as BadgeCell,
      isActive:        this.isActive(r.status),
      slaDeadline:     this.slaDeadline(r),
      _source:         r,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => ({
    hoverable: true,
    loading: this.loading(),
    emptyMessage: 'Aucune demande.',
  }));

  goToInbox(): void {
    this.router.navigate(['inbox'], { relativeTo: this.route });
  }

  viewDetail(id: number): void {
    this.router.navigate([id], { relativeTo: this.route });
  }

  onTabChange(values: string[]): void {
    const value = values[0];
    if (value === 'active' || value === 'done') this.activeTab.set(value);
  }

  isActive(status: string): boolean {
    return ACTIVE_STATUSES.includes(status as RequestStatus);
  }

  ngOnInit() { this.reload(); }

  reload(resetPage = true) {
    if (resetPage) this.page.set(0);
    this.loading.set(true);
    this.svc.listRequests({
      profileId: this.currentProfileId() || undefined,
      page:      this.page(),
      size:      100,
    }).pipe(catchError(() => of(null))).subscribe(res => {
      this.loading.set(false);
      if (res) {
        this.allRows.set(res.content);
        this.total.set(res.totalElements);
        this.totalPages.set(res.totalPages);
      }
    });
  }

  goPage(p: number) { this.page.set(p); this.reload(false); }

  cancel(row: EmployeeRequest) {
    if (!confirm('Annuler cette demande ?')) return;
    this.svc.cancelRequest(row.id, this.currentProfileId())
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        if (updated) this.allRows.update(rs => rs.map(r => r.id === updated.id ? updated : r));
      });
  }

  onSubmitted() { this.showNew.set(false); this.reload(); }

  /** New requests are created on the shell's self-service page (a different app),
   *  so navigate the top-level window rather than the remote's router. */
  goToSelfService() {
    window.location.href = '/home/self-service';
  }

  /** Computes a pseudo SLA deadline from submission + defaultSlaDays (we use 3 days as default). */
  slaDeadline(row: EmployeeRequest): string | null {
    if (!row.submissionDate) return null;
    const d = new Date(row.submissionDate);
    d.setDate(d.getDate() + 3);
    return d.toISOString();
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }
}
