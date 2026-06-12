import {
  Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { RequestsService }   from './requests.service';
import { EmployeeRequest, RequestStatus } from './models/request.model';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { SlaCountdownPipe }      from '../../shared/sla-countdown.pipe';
import { SpinnerComponent }      from '../../shared/spinner.component';
import { UserStore }             from '../../core/user.store';
import { NewRequestComponent }   from './new-request.component';

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: '',           label: 'Toutes' },
  { value: 'SUBMITTED',  label: 'Soumises' },
  { value: 'IN_REVIEW',  label: 'En traitement' },
  { value: 'PENDING_L2', label: 'Attente L2' },
  { value: 'APPROVED',   label: 'Approuvées' },
  { value: 'REJECTED',   label: 'Refusées' },
  { value: 'CANCELLED',  label: 'Annulées' },
];

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [RouterLink, FormsModule, StatusBadgeComponent, SlaCountdownPipe, SpinnerComponent, NewRequestComponent],
  template: `
    <!-- ── Header ────────────────────────────────────────────────── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Mes demandes RH</h1>
        <p class="page-sub">{{ total() }} demande{{ total() !== 1 ? 's' : '' }}</p>
      </div>
      <div class="header-actions">
        @if (canViewInbox()) {
          <a routerLink="inbox" class="btn-ghost">Boîte de réception</a>
        }
        <button class="btn-primary" (click)="showNew.set(true)" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nouvelle demande
        </button>
      </div>
    </div>

    <!-- ── Filters ────────────────────────────────────────────────── -->
    <div class="filters-bar">
      <select class="filter-select" [(ngModel)]="filterStatus" (ngModelChange)="reload()">
        @for (o of statusOpts; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
      </select>
      @if (filterStatus) {
        <button class="clear-btn" (click)="filterStatus = ''; reload()" type="button">✕ Tout afficher</button>
      }
    </div>

    <!-- ── Table ──────────────────────────────────────────────────── -->
    <div class="card table-card">
      @if (loading()) {
        <div class="loading-rows">
          @for (_ of [1,2,3]; track $index) { <div class="skeleton-row"></div> }
        </div>
      } @else if (rows().length === 0) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>Aucune demande{{ filterStatus ? ' pour ce statut' : '' }}</p>
          <button class="btn-primary" (click)="showNew.set(true)" type="button">Créer ma première demande</button>
        </div>
      } @else {
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type de demande</th>
              <th>Soumise le</th>
              <th>Statut</th>
              <th>SLA</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr class="data-row">
                <td class="cell-id">{{ row.id }}</td>
                <td>
                  <div class="type-cell">
                    <span class="type-name">{{ row.typeDisplayNameFr ?? 'Demande #' + row.requestTypeId }}</span>
                  </div>
                </td>
                <td class="cell-muted">{{ fmtDate(row.submissionDate) }}</td>
                <td><daf-badge [label]="statusBadge(row.status).label" [options]="statusBadge(row.status).options" /></td>
                <td>
                  @if (row.status === 'SUBMITTED' || row.status === 'IN_REVIEW' || row.status === 'PENDING_L2') {
                    @let sla = slaDeadline(row) | slaCountdown;
                    <span class="sla-chip" [class]="'sla-chip--' + sla.level">{{ sla.label }}</span>
                  } @else {
                    <span class="cell-muted">—</span>
                  }
                </td>
                <td class="cell-actions">
                  <a [routerLink]="[row.id]" class="action-link">Détail ›</a>
                  @if (row.status === 'SUBMITTED') {
                    <button class="action-cancel" (click)="cancel(row)" type="button">Annuler</button>
                  }
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

    <!-- ── New request modal ──────────────────────────────────────── -->
    <app-new-request
      [visible]="showNew()"
      [profileId]="currentProfileId()"
      [paysId]="currentPaysId()"
      (closed)="showNew.set(false)"
      (submitted)="onSubmitted()"
    />
  `,
  styleUrl: './request-list.component.scss',
})
export class RequestListComponent implements OnInit {
  private svc       = inject(RequestsService);
  private userStore = inject(UserStore);

  readonly statusOpts = STATUS_OPTS;

  loading    = signal(false);
  rows       = signal<EmployeeRequest[]>([]);
  total      = signal(0);
  totalPages = signal(1);
  page       = signal(0);
  showNew    = signal(false);

  filterStatus = '';
  protected readonly statusBadge = statusBadge;

  canViewInbox   = computed(() => this.userStore.isHrManager() || this.userStore.isAdmin());
  currentPaysId  = computed(() => this.userStore.currentUser()?.paysId ?? 1);
  currentProfileId = computed(() => {
    // In a real app, the employee profile ID comes from the user context
    // Here we use userId as a fallback placeholder
    return this.userStore.currentUser()?.userId ?? 0;
  });

  ngOnInit() { this.reload(); }

  reload(resetPage = true) {
    if (resetPage) this.page.set(0);
    this.loading.set(true);
    this.svc.listRequests({
      profileId: this.currentProfileId() || undefined,
      status:    (this.filterStatus || undefined) as RequestStatus | undefined,
      page:      this.page(),
      size:      20,
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

  cancel(row: EmployeeRequest) {
    if (!confirm('Annuler cette demande ?')) return;
    this.svc.cancelRequest(row.id, this.currentProfileId())
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        if (updated) this.rows.update(rs => rs.map(r => r.id === updated.id ? updated : r));
      });
  }

  onSubmitted() { this.showNew.set(false); this.reload(); }

  /** Computes a pseudo SLA deadline from submission + defaultSlaDays (we use 3 days as default). */
  slaDeadline(row: EmployeeRequest): string | null {
    if (!row.submissionDate) return null;
    const d = new Date(row.submissionDate);
    d.setDate(d.getDate() + 3);   // default 3-day SLA; real value comes from type catalog
    return d.toISOString();
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }
}
