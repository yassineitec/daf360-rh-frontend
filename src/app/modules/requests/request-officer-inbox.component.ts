import {
  Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { RequestsService }  from './requests.service';
import { EmployeeRequest, RequestStatus } from './models/request.model';
import {
  StatusBadgeComponent, BadgeOptions, ButtonComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow, PaginationComponent,
} from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { SlaCountdownPipe, SlaLevel } from '../../shared/sla-countdown.pipe';
import { ModalComponent }        from '../../shared/modal.component';
import { UserStore }             from '../../core/user.store';
import { ConfirmService } from '../../core/confirm.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const SLA_VARIANTS: Record<SlaLevel, BadgeOptions['variant']> = {
  ok: 'success', warning: 'warning', critical: 'danger', none: 'neutral',
};

@Component({
  selector: 'app-request-officer-inbox',
  standalone: true,
  imports: [
    RouterLink, FormsModule, StatusBadgeComponent, ButtonComponent, ModalComponent,
    DataTableComponent, DafCellDirective, PaginationComponent, TranslatePipe,
  ],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ 'REQUESTS.INBOX.TITLE' | translate }}</h1>
        <p class="page-sub">{{ 'REQUESTS.INBOX.SUBTITLE' | translate:{ count: total() } }}</p>
      </div>
      <a routerLink="/rh/requests" class="btn-ghost">{{ 'REQUESTS.INBOX.BACK_MY_REQUESTS' | translate }}</a>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <select class="filter-select" [(ngModel)]="filterStatus" (ngModelChange)="reload()">
        <option value="">{{ 'REQUESTS.INBOX.FILTER_ALL' | translate }}</option>
        <option value="SUBMITTED">{{ 'REQUESTS.INBOX.FILTER_SUBMITTED' | translate }}</option>
        <option value="IN_REVIEW">{{ 'REQUESTS.INBOX.FILTER_IN_REVIEW' | translate }}</option>
        <option value="PENDING_L2">{{ 'REQUESTS.INBOX.FILTER_PENDING_L2' | translate }}</option>
      </select>
    </div>

    @if (errorMsg()) {
      <div class="inbox-error" role="alert">
        {{ errorMsg() }}
        <button type="button" class="inbox-error-close" (click)="errorMsg.set('')">×</button>
      </div>
    }

    <!-- Table -->
    <div class="card table-card">
      @if (loading()) {
        <div class="loading-rows">
          @for (_ of [1,2,3,4]; track $index) { <div class="skeleton-row"></div> }
        </div>
      } @else if (rows().length === 0) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p>{{ 'REQUESTS.INBOX.EMPTY' | translate }}</p>
        </div>
      } @else {
        <daf-data-table [columns]="columns()" [rows]="tableRows()" [config]="tableConfig">
          <ng-template dafCell="status" let-row>
            <daf-badge [label]="statusBadge(row['_source'].status).label" [options]="statusBadge(row['_source'].status).options" />
          </ng-template>
          <ng-template dafCell="sla" let-row>
            <daf-badge [label]="row['sla'].label" [options]="{ variant: slaVariant(row['sla'].level), size: 'sm' }" />
          </ng-template>
          <ng-template dafCell="_actions" let-row>
            <a [routerLink]="['/rh/requests', row['_source'].id]" class="action-link">{{ 'REQUESTS.INBOX.DETAILS' | translate }}</a>
            @if (canProcess(row['_source'].status)) {
              <daf-button [label]="'REQUESTS.INBOX.APPROVE' | translate" variant="ghost" [options]="{ size: 'sm', iconStart: 'check' }" (onClick)="quickApprove(row['_source'])" />
              <daf-button [label]="'REQUESTS.INBOX.REJECT' | translate" variant="danger" [options]="{ size: 'sm', iconStart: 'close' }" (onClick)="openRefuse(row['_source'])" />
            }
          </ng-template>
        </daf-data-table>

        @if (totalPages() > 1) {
          <div class="pagination">
            <daf-pagination
              [currentPage]="page()"
              [totalPages]="totalPages()"
              [totalElements]="total()"
              (pageChange)="goPage($event)" />
          </div>
        }
      }
    </div>

    <!-- Refuse modal -->
    <app-modal
      [title]="'REQUESTS.INBOX.REFUSE_TITLE' | translate"
      [visible]="!!refuseTarget()"
      [hasFooter]="true"
      (closed)="refuseTarget.set(null)"
    >
      <div class="refuse-body">
        <p class="refuse-desc">
          {{ 'REQUESTS.INBOX.REFUSE_DESC' | translate:{ id: refuseTarget()?.id, type: refuseTarget()?.typeDisplayNameFr } }}
        </p>
        <label class="form-label">{{ 'REQUESTS.INBOX.REFUSE_MOTIF_LABEL' | translate }}</label>
        <textarea
          class="form-input"
          [(ngModel)]="refuseMotif"
          [placeholder]="'REQUESTS.INBOX.REFUSE_PLACEHOLDER' | translate"
          rows="4"
        ></textarea>
      </div>
      <div slot="footer">
        <daf-button [label]="'REQUESTS.INBOX.CANCEL' | translate" variant="secondary" (onClick)="refuseTarget.set(null)" />
        <daf-button
          [label]="'REQUESTS.INBOX.CONFIRM_REFUSE' | translate"
          variant="danger"
          [options]="{ disabled: !refuseMotif.trim() || saving(), loading: saving() }"
          (onClick)="confirmRefuse()"
        />
      </div>
    </app-modal>
  `,
  styleUrl: './request-officer-inbox.component.scss',
})
export class RequestOfficerInboxComponent implements OnInit {
  private svc       = inject(RequestsService);
  private confirm = inject(ConfirmService);
  private userStore = inject(UserStore);
  private translate = inject(TranslateService);

  loading    = signal(false);
  saving     = signal(false);
  rows       = signal<EmployeeRequest[]>([]);
  total      = signal(0);
  totalPages = signal(1);
  page       = signal(0);

  filterStatus  = '';
  refuseTarget  = signal<EmployeeRequest | null>(null);
  refuseMotif   = '';
  errorMsg      = signal('');
  protected readonly statusBadge = statusBadge;

  /** Statuses the backend allows processing on — actions are hidden otherwise. */
  private static readonly PROCESSABLE: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'PENDING_L2'];
  canProcess = (status: RequestStatus) => RequestOfficerInboxComponent.PROCESSABLE.includes(status);

  private officerId = computed(() => this.userStore.currentUser()?.userId ?? 0);
  private paysId    = computed(() => this.userStore.currentUser()?.paysId ?? 1);

  private slaPipe = new SlaCountdownPipe();

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'id', label: this.translate.instant('REQUESTS.INBOX.COL_ID') },
      { key: 'employee', label: this.translate.instant('REQUESTS.INBOX.COL_EMPLOYEE') },
      { key: 'type', label: this.translate.instant('REQUESTS.INBOX.COL_TYPE') },
      { key: 'submitted', label: this.translate.instant('REQUESTS.INBOX.COL_SUBMITTED') },
      { key: 'sla', label: this.translate.instant('REQUESTS.INBOX.COL_SLA') },
      { key: 'status', label: this.translate.instant('REQUESTS.INBOX.COL_STATUS') },
      { key: '_actions', label: this.translate.instant('REQUESTS.INBOX.COL_ACTIONS'), align: 'right' },
    ];
  });

  readonly tableConfig: TableConfig = { hoverable: true };

  readonly tableRows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.rows().map(row => ({
      id: row.id,
      employee: row.employeeName ?? this.translate.instant('REQUESTS.COMMON.PROFILE_NUMBER', { id: row.employeeProfileId }),
      type: row.typeDisplayNameFr ?? this.translate.instant('REQUESTS.COMMON.REQUEST_NUMBER', { id: row.requestTypeId }),
      submitted: this.fmtDate(row.submissionDate),
      sla: this.slaPipe.transform(this.slaDeadline(row)),
      status: row.status,
      _source: row,
    }));
  });

  slaVariant(level: SlaLevel): BadgeOptions['variant'] {
    return SLA_VARIANTS[level];
  }

  ngOnInit() { this.reload(); }

  reload(resetPage = true) {
    if (resetPage) this.page.set(0);
    this.loading.set(true);
    this.svc.listRequests({
      paysId:  this.paysId(),
      status:  (this.filterStatus || undefined) as RequestStatus | undefined,
      page:    this.page(),
      size:    30,
    }).pipe(catchError(() => of(null))).subscribe(res => {
      this.loading.set(false);
      if (res) {
        this.rows.set(res.content);
        this.total.set(res.totalElements);
        this.totalPages.set(res.totalPages);
      }
    });
  }

  goPage(p: number) { this.page.set(p); this.reload(false); }

  async quickApprove(row: EmployeeRequest) {
    if (!(await this.confirm.ask({
      title: this.translate.instant('REQUESTS.INBOX.APPROVE_TITLE'),
      message: this.translate.instant('REQUESTS.INBOX.APPROVE_MESSAGE', { id: row.id }),
      confirmLabel: this.translate.instant('REQUESTS.INBOX.APPROVE'), icon: 'check',
    }))) return;
    this.errorMsg.set('');
    this.svc.processRequest(row.id, this.officerId(), 'APPROVED', 'Approuvé via boîte de réception')
      .subscribe({
        next: updated => this.rows.update(rs => rs.map(r => r.id === updated.id ? updated : r)),
        error: err => this.errorMsg.set(this.extractError(err)),
      });
  }

  openRefuse(row: EmployeeRequest) {
    this.refuseTarget.set(row);
    this.refuseMotif = '';
  }

  confirmRefuse() {
    const row = this.refuseTarget();
    if (!row || !this.refuseMotif.trim()) return;
    this.saving.set(true);
    this.errorMsg.set('');
    this.svc.processRequest(row.id, this.officerId(), 'REJECTED', this.refuseMotif)
      .subscribe({
        next: updated => {
          this.saving.set(false);
          this.rows.update(rs => rs.map(r => r.id === updated.id ? updated : r));
          this.refuseTarget.set(null);
        },
        error: err => {
          this.saving.set(false);
          this.errorMsg.set(this.extractError(err));
        },
      });
  }

  /** Pulls the RFC-7807 `detail` from the backend error, with sensible fallbacks. */
  private extractError(err: unknown): string {
    const e = err as { error?: { detail?: string; message?: string } };
    return e?.error?.detail ?? e?.error?.message ?? this.translate.instant('REQUESTS.INBOX.ERROR');
  }

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
