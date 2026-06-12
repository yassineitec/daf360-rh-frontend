import {
  Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { RequestsService }  from './requests.service';
import { EmployeeRequest, RequestStatus } from './models/request.model';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { SlaCountdownPipe }      from '../../shared/sla-countdown.pipe';
import { SpinnerComponent }      from '../../shared/spinner.component';
import { ModalComponent }        from '../../shared/modal.component';
import { UserStore }             from '../../core/user.store';

@Component({
  selector: 'app-request-officer-inbox',
  standalone: true,
  imports: [RouterLink, FormsModule, StatusBadgeComponent, SlaCountdownPipe, SpinnerComponent, ModalComponent],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Boîte de réception RH</h1>
        <p class="page-sub">{{ total() }} demande{{ total() !== 1 ? 's' : '' }} à traiter</p>
      </div>
      <a routerLink="/requests" class="btn-ghost">← Mes demandes</a>
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
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Employé</th>
              <th>Type</th>
              <th>Soumis le</th>
              <th>SLA restant</th>
              <th>Statut</th>
              <th>Actions rapides</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr class="data-row">
                <td class="cell-id">{{ row.id }}</td>
                <td class="cell-muted">Profil #{{ row.employeeProfileId }}</td>
                <td>
                  <div class="type-cell">
                    <span class="type-name">{{ row.typeDisplayNameFr ?? 'Demande #' + row.requestTypeId }}</span>
                  </div>
                </td>
                <td class="cell-muted">{{ fmtDate(row.submissionDate) }}</td>
                <td>
                  @let sla = slaDeadline(row) | slaCountdown;
                  <span class="sla-chip" [class]="'sla-chip--' + sla.level">{{ sla.label }}</span>
                </td>
                <td><daf-badge [label]="statusBadge(row.status).label" [options]="statusBadge(row.status).options" /></td>
                <td class="cell-actions">
                  <a [routerLink]="['/requests', row.id]" class="action-link">Détail</a>
                  <button class="action-approve" (click)="quickApprove(row)" type="button">✓ Approuver</button>
                  <button class="action-refuse"  (click)="openRefuse(row)"  type="button">✕ Refuser</button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        @if (totalPages() > 1) {
          <div class="pagination">
            <span class="pag-info">{{ page() + 1 }} / {{ totalPages() }}</span>
            <div class="pag-controls">
              <button (click)="goPage(page() - 1)" [disabled]="page() <= 0" type="button">‹</button>
              <button (click)="goPage(page() + 1)" [disabled]="page() >= totalPages() - 1" type="button">›</button>
            </div>
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
        <button class="btn-ghost" (click)="refuseTarget.set(null)" type="button">Annuler</button>
        <button
          class="btn-danger" type="button"
          [disabled]="!refuseMotif.trim() || saving()"
          (click)="confirmRefuse()"
        >
          @if (saving()) { <app-spinner size="sm" /> }
          Confirmer le refus
        </button>
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
  protected readonly statusBadge = statusBadge;

  private officerId = computed(() => this.userStore.currentUser()?.userId ?? 0);
  private paysId    = computed(() => this.userStore.currentUser()?.paysId ?? 1);

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
    this.svc.processRequest(row.id, this.officerId(), 'APPROVED', 'Approuvé via boîte de réception')
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        if (updated) this.rows.update(rs => rs.map(r => r.id === updated.id ? updated : r));
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
    this.svc.processRequest(row.id, this.officerId(), 'REJECTED', this.refuseMotif)
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        this.saving.set(false);
        if (updated) {
          this.rows.update(rs => rs.map(r => r.id === updated.id ? updated : r));
          this.refuseTarget.set(null);
        }
      });
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
