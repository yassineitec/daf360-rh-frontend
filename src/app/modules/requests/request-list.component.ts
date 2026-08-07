import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import {
  BadgeCell,
  ButtonComponent,
  ChipGroupComponent,
  DafCellDirective,
  DataTableComponent,
  PageComponent,
  PageHeaderComponent,
  PageHeaderBadge,
  PaginationComponent,
  StatusBadgeComponent,
  TableColumn,
  TableConfig,
  TableRow,
} from '@khalilrebhiitec/daf360';

import { RequestsService } from './requests.service';
import { EmployeeRequest, RequestStatus } from './models/request.model';
import { SlaCountdownPipe, SlaLevel } from '../../shared/sla-countdown.pipe';
import { UserStore } from '../../core/user.store';
import { NewRequestComponent } from './new-request.component';
import { statusBadge } from '../../shared/status-badge.utils';
import { TableActionComponent } from '../../shared/table-action.component';
import { ConfirmService } from '../../core/confirm.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  RecruitmentValidationSectionComponent,
  RECRUITMENT_APPROVE_PERMISSION,
} from '../recruitment-demands/recruitment-validation-section.component';

const ACTIVE_STATUSES: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'PENDING_L2'];
const DONE_STATUSES: RequestStatus[] = ['APPROVED', 'REJECTED', 'CANCELLED'];

type TabKey = 'active' | 'done';

const SLA_BADGE_VARIANT: Record<SlaLevel, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ok: 'success',
  warning: 'warning',
  critical: 'danger',
  none: 'neutral',
};

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [
    ButtonComponent,
    ChipGroupComponent,
    StatusBadgeComponent,
    DataTableComponent,
    DafCellDirective,
    PageComponent,
    PageHeaderComponent,
    PaginationComponent,
    SlaCountdownPipe,
    TableActionComponent,
    NewRequestComponent,
    RecruitmentValidationSectionComponent,
    TranslatePipe,
  ],
  template: `
    <!-- Canonical page per UI-PLAYBOOK §1: daf-page owns the 32px rhythm, so there are no
         space-y-* / mb-* between sections, and the title is the header's single h1.
         kpis="0" — this page has no KPI row, so the skeleton must not draw one. -->
    <daf-page [loading]="firstLoad()" [kpis]="0">

      <daf-page-header
        [title]="'REQUESTS.LIST.TITLE' | translate"
        [subtitle]="'REQUESTS.LIST.INTRO_TITLE' | translate"
        [badges]="headerBadges()">
        @if (canViewInbox()) {
          <daf-button pageActions
            [options]="{ variant: 'ghost', label: ('REQUESTS.LIST.INBOX_BTN' | translate), iconStart: 'inbox' }"
            (onClick)="goToInbox()" />
        }
        <daf-button pageActions
          [options]="{ variant: 'teal', label: ('REQUESTS.LIST.NEW_BTN' | translate), iconStart: 'add' }"
          (onClick)="showNew.set(true)" />
      </daf-page-header>

      <!-- ── Validation des demandes de recrutement ─────────────────────
           Its own section, not a third tab: the tabs below page through
           \`employee_requests\`, and recruitment demands are a different table with a
           different approval chain. Rendered only for RH_APPROVE_RECRUITMENT_DEMAND —
           the same permission the review endpoint enforces. -->
      @if (canValidateRecruitment()) {
        <app-recruitment-validation-section />
      }

      <!-- Tabs sit free in the page. They used to be the header row of a container card
           wrapping the table, which double-bordered it (§6b rule 1). -->
      <daf-chip-group
        [options]="tabOptions()"
        [selected]="[activeTab()]"
        (selectedChange)="onTabChange($event)" />

      <!-- No wrapper, no outer card, no overflow div — daf-data-table draws its own
           chrome and owns its horizontal scroll. The empty state is the table's
           \`emptyMessage\`, so empty and populated share the same chrome (§6b rule 3). -->
      <daf-data-table [columns]="columns()" [rows]="rows()" [config]="tableConfig()">
        <ng-template dafCell="type" let-row>
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal">
              <span class="material-symbols-outlined text-[18px]">description</span>
            </div>
            <span class="font-semibold text-on-surface">{{ row['type'] }}</span>
          </div>
        </ng-template>

        <ng-template dafCell="sla" let-row>
          @if (row['isActive']) {
            @let sla = row['slaDeadline'] | slaCountdown;
            <daf-badge
              [label]="sla.label"
              [options]="{ variant: slaVariant(sla.level), size: 'sm', dot: true }" />
          } @else {
            <span class="text-outline">—</span>
          }
        </ng-template>

        <!-- Projected rather than config.actions because "cancel" is conditional on the
             row's status, and TableAction has no row predicate. rh-table-action gives the
             lib's own icon-only rendering and stops propagation itself (§6b rule 4). -->
        <ng-template dafCell="_actions" let-row>
          <div class="flex items-center justify-end gap-2">
            <rh-table-action id="view"
              [tooltip]="'REQUESTS.LIST.VIEW' | translate"
              (action)="viewDetail(row['_source'].id)" />
            @if (row['_source'].status === 'SUBMITTED') {
              <rh-table-action id="delete" variant="danger"
                [tooltip]="'REQUESTS.CANCEL.CONFIRM' | translate"
                (action)="cancel(row['_source'])" />
            }
          </div>
        </ng-template>
      </daf-data-table>

      @if (totalPages() > 1) {
        <daf-pagination
          [currentPage]="page()"
          [totalPages]="totalPages()"
          [totalElements]="total()"
          (pageChange)="goPage($event)" />
      }

    </daf-page>

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
  private svc = inject(RequestsService);
  private confirm = inject(ConfirmService);
  private userStore = inject(UserStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);

  /**
   * Whole-page skeleton, first load only — `daf-page [loading]`.
   *
   * Separate from `loading` on purpose (UI-PLAYBOOK §5): `loading` drives the table's own
   * skeleton rows on every refetch, so a tab switch or a page change never blanks the
   * header and the toolbar the way a single flag would.
   */
  firstLoad = signal(true);
  loading = signal(false);
  allRows = signal<EmployeeRequest[]>([]);
  total = signal(0);
  totalPages = signal(1);
  page = signal(0);
  showNew = signal(false);
  activeTab = signal<TabKey>('active');

  protected readonly statusBadge = statusBadge;
  protected readonly slaVariant = (level: SlaLevel) => SLA_BADGE_VARIANT[level];

  /**
   * The total count, on the title line — where the hand-rolled `daf-badge` next to the old
   * h1 used to sit. Hidden at zero rather than showing "0": an empty page already says so
   * through the table's own empty state.
   */
  readonly headerBadges = computed<PageHeaderBadge[]>(() =>
    this.total() > 0
      ? [{ label: this.total().toString(), variant: 'teal', pill: true }]
      : []);

  canViewInbox = computed(() => this.userStore.isHrManager() || this.userStore.isAdmin());

  /**
   * Gates the recruitment-validation section. Permission-based, not role-based: V31 grants
   * RH_APPROVE_RECRUITMENT_DEMAND to Directeur / DRH / Administrateur today, but the whole
   * point of a permission is that the grant can move without touching this page.
   */
  canValidateRecruitment = computed(() =>
    this.userStore.hasPermission(RECRUITMENT_APPROVE_PERMISSION));
  currentPaysId = computed(() => this.userStore.currentUser()?.paysId ?? 1);
  currentProfileId = computed(() => {
    const u = this.userStore.currentUser();
    if (!u) return 0;
    const fromEmployee = parseInt(u.employeeId ?? '', 10);
    return isNaN(fromEmployee) ? u.userId : fromEmployee;
  });

  readonly tabOptions = computed(() => {
    this.translate.currentLang();
    return [
      { value: 'active', label: this.translate.instant('REQUESTS.LIST.TAB_ACTIVE', { count: this.activeCount() }) },
      { value: 'done', label: this.translate.instant('REQUESTS.LIST.TAB_DONE', { count: this.doneCount() }) },
    ];
  });

  visibleRows = computed(() => {
    const all = this.allRows();
    return this.activeTab() === 'active'
      ? all.filter((r) => ACTIVE_STATUSES.includes(r.status))
      : all.filter((r) => DONE_STATUSES.includes(r.status));
  });

  activeCount = computed(
    () => this.allRows().filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
  );
  doneCount = computed(() => this.allRows().filter((r) => DONE_STATUSES.includes(r.status)).length);

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'type', label: this.translate.instant('REQUESTS.LIST.COL_TYPE') },
      { key: 'submissionDate', label: this.translate.instant('REQUESTS.LIST.COL_SUBMITTED') },
      { key: 'status', label: this.translate.instant('REQUESTS.LIST.COL_STATUS'), type: 'badge' },
      { key: 'sla', label: this.translate.instant('REQUESTS.LIST.COL_SLA') },
      // §6b: an actions column carries no label and takes the minimum width. Never
      // `clickable: true` — that styles the whole cell as a row target.
      { key: '_actions', label: '', align: 'right', width: '1%' },
    ];
  });

  readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.visibleRows().map((r) => ({
      type: r.typeDisplayNameFr ?? this.translate.instant('REQUESTS.COMMON.REQUEST_NUMBER', { id: r.requestTypeId }),
      submissionDate: this.fmtDate(r.submissionDate),
      status: {
        label: this.statusBadge(r.status).label,
        options: this.statusBadge(r.status).options,
      } as BadgeCell,
      isActive: this.isActive(r.status),
      slaDeadline: this.slaDeadline(r),
      _source: r,
    }));
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      // The page-header is the only h1; without this the table draws a second, EMPTY
      // title bar above the rows (§6b rule 2).
      showHeader:   false,
      hoverable:    true,
      loading:      this.loading(),
      // Matches the rows we expect so the skeleton does not jump when data lands.
      skeletonRows: Math.min(Math.max(this.visibleRows().length, 5), 20),
      // Per-tab wording: "no active requests" and "no closed requests" are different
      // statements, and the tab you are on decides which one is true.
      emptyMessage: this.translate.instant(
        this.activeTab() === 'done' ? 'REQUESTS.LIST.EMPTY_DONE' : 'REQUESTS.LIST.EMPTY_ACTIVE'),
    };
  });

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

  ngOnInit() {
    this.reload();
  }

  reload(resetPage = true) {
    if (resetPage) this.page.set(0);
    this.loading.set(true);
    this.svc
      .listRequests({
        profileId: this.currentProfileId() || undefined,
        page: this.page(),
        size: 100,
      })
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.loading.set(false);
        // Cleared whether or not the call succeeded: on failure the page must render its
        // real (empty) state, not sit on a skeleton forever.
        this.firstLoad.set(false);
        if (res) {
          this.allRows.set(res.content);
          this.total.set(res.totalElements);
          this.totalPages.set(res.totalPages);
        }
      });
  }

  goPage(p: number) {
    this.page.set(p);
    this.reload(false);
  }

  async cancel(row: EmployeeRequest) {
    if (!(await this.confirm.ask({
      title: this.translate.instant('REQUESTS.CANCEL.TITLE'),
      message: this.translate.instant('REQUESTS.CANCEL.MESSAGE'),
      confirmLabel: this.translate.instant('REQUESTS.CANCEL.CONFIRM'),
      cancelLabel: this.translate.instant('REQUESTS.CANCEL.BACK'),
    }))) return;
    this.svc
      .cancelRequest(row.id, this.currentProfileId())
      .pipe(catchError(() => of(null)))
      .subscribe((updated) => {
        if (updated)
          this.allRows.update((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      });
  }

  onSubmitted() {
    this.showNew.set(false);
    this.reload();
  }

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
    try {
      return new Date(iso).toLocaleDateString('fr-FR');
    } catch {
      return iso;
    }
  }
}
