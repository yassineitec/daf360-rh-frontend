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

const SLA_VARIANTS: Record<SlaLevel, BadgeOptions['variant']> = {
  ok: 'success', warning: 'warning', critical: 'danger', none: 'neutral',
};

@Component({
  selector: 'app-request-officer-inbox',
  standalone: true,
  imports: [
    RouterLink, FormsModule, StatusBadgeComponent, ButtonComponent, ModalComponent,
    DataTableComponent, DafCellDirective, PaginationComponent,
  ],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Boîte de réception RH</h1>
        <p class="page-sub">{{ total() }} demande{{ total() !== 1 ? 's' : '' }} à traiter</p>
      </div>
      <a routerLink="/rh/requests" class="btn-ghost">← Mes demandes</a>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <select class="filter-select" [(ngModel)]="filterStatus" (ngModelChange)="reload()">
        <option value="">Toutes les demandes</option>
        <option value="SUBMITTED">Soumises</option>
        <option value="IN_REVIEW">En traitement</option>
        <option value="PENDING_L2">Attente L2</option>
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
          <p>Aucune demande en attente</p>
        </div>
      } @else {
        <daf-data-table [columns]="columns" [rows]="tableRows()" [config]="tableConfig">
          <ng-template dafCell="status" let-row>
            <daf-badge [label]="statusBadge(row['_source'].status).label" [options]="statusBadge(row['_source'].status).options" />
          </ng-template>
          <ng-template dafCell="sla" let-row>
            <daf-badge [label]="row['sla'].label" [options]="{ variant: slaVariant(row['sla'].level), size: 'sm' }" />
          </ng-template>
          <ng-template dafCell="_actions" let-row>
            <a [routerLink]="['/rh/requests', row['_source'].id]" class="action-link">Détails</a>
            @if (canProcess(row['_source'].status)) {
              <daf-button label="Approuver" variant="ghost" [options]="{ size: 'sm', iconStart: 'check' }" (onClick)="quickApprove(row['_source'])" />
              <daf-button label="Refuser" variant="danger" [options]="{ size: 'sm', iconStart: 'close' }" (onClick)="openRefuse(row['_source'])" />
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
      title="Refuser la demande"
      [visible]="!!refuseTarget()"
      [hasFooter]="true"
      (closed)="refuseTarget.set(null)"
    >
      <div class="refuse-body">
        <p class="refuse-desc">
          Demande #{{ refuseTarget()?.id }} — {{ refuseTarget()?.typeDisplayNameFr }}
        </p>
        <label class="form-label">Motif de refus *</label>
        <textarea
          class="form-input"
          [(ngModel)]="refuseMotif"
          placeholder="Préciser la raison du refus…"
          rows="4"
        ></textarea>
      </div>
      <div slot="footer">
        <daf-button label="Annuler" variant="secondary" (onClick)="refuseTarget.set(null)" />
        <daf-button
          label="Confirmer le refus"
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
  private userStore = inject(UserStore);

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

  readonly columns: TableColumn[] = [
    { key: 'id', label: '#' },
    { key: 'employee', label: 'Employé' },
    { key: 'type', label: 'Type' },
    { key: 'submitted', label: 'Soumis le' },
    { key: 'sla', label: 'SLA restant' },
    { key: 'status', label: 'Statut' },
    { key: '_actions', label: 'Actions rapides', align: 'right' },
  ];

  readonly tableConfig: TableConfig = { hoverable: true };

  readonly tableRows = computed<TableRow[]>(() =>
    this.rows().map(row => ({
      id: row.id,
      employee: row.employeeName ?? ('Profil #' + row.employeeProfileId),
      type: row.typeDisplayNameFr ?? 'Demande #' + row.requestTypeId,
      submitted: this.fmtDate(row.submissionDate),
      sla: this.slaPipe.transform(this.slaDeadline(row)),
      status: row.status,
      _source: row,
    })),
  );

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

  quickApprove(row: EmployeeRequest) {
    if (!confirm(`Approuver la demande #${row.id} ?`)) return;
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
    return e?.error?.detail ?? e?.error?.message ?? 'Erreur lors du traitement de la demande.';
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
