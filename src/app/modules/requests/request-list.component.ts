import {
  Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { RequestsService }               from './requests.service';
import { EmployeeRequest, RequestStatus } from './models/request.model';
import { SlaCountdownPipe }              from '../../shared/sla-countdown.pipe';
import { UserStore }                     from '../../core/user.store';
import { NewRequestComponent }           from './new-request.component';

const ACTIVE_STATUSES: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'PENDING_L2'];
const DONE_STATUSES:   RequestStatus[] = ['APPROVED', 'REJECTED', 'CANCELLED'];

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED:  'Soumis',
  IN_REVIEW:  'En traitement',
  PENDING_L2: 'Attente L2',
  APPROVED:   'Approuvée',
  REJECTED:   'Refusée',
  CANCELLED:  'Annulée',
};

type TabKey = 'all' | 'active' | 'done';

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [RouterLink, SlaCountdownPipe, NewRequestComponent],
  template: `
    <div class="rl-page">

      <!-- ── Header ──────────────────────────────────────── -->
      <div class="rl-header">
        <h1 class="rl-title">
          Mes demandes RH
          <span class="rl-count-badge">{{ total() }}</span>
        </h1>
        <div class="rl-header-actions">
          @if (canViewInbox()) {
            <a routerLink="inbox" class="rl-btn-ghost">Boîte de réception</a>
          }
          <button class="rl-btn-primary" (click)="showNew.set(true)" type="button">
            <span class="material-symbols-outlined">add</span>
            + Nouvelle demande
          </button>
        </div>
      </div>

      <!-- ── Glass Banner ────────────────────────────────── -->
      <div class="rl-banner">
        <div class="rl-banner-left">
          <p class="rl-banner-eyebrow">Statut de vos requêtes</p>
          <h2 class="rl-banner-title">Suivi en temps réel de vos demandes administratives.</h2>
        </div>
        <div class="rl-banner-stats">
          <div class="rl-stat">
            <span class="rl-stat-label">Délai moyen</span>
            <span class="rl-stat-value">48h</span>
          </div>
          <div class="rl-stat">
            <span class="rl-stat-label">Satisfaction</span>
            <span class="rl-stat-value">98%</span>
          </div>
        </div>
      </div>

      <!-- ── Main Card ────────────────────────────────────── -->
      <div class="rl-card">

        <!-- Tabs -->
        <div class="rl-tabs">
          <button class="rl-tab" [class.rl-tab--active]="activeTab() === 'all'"
                  (click)="setTab('all')" type="button">
            Toutes ({{ total() }})
          </button>
          <button class="rl-tab" [class.rl-tab--active]="activeTab() === 'active'"
                  (click)="setTab('active')" type="button">
            En cours ({{ activeCount() }})
          </button>
          <button class="rl-tab" [class.rl-tab--active]="activeTab() === 'done'"
                  (click)="setTab('done')" type="button">
            Traitées ({{ doneCount() }})
          </button>
        </div>

        <!-- Loading skeleton -->
        @if (loading()) {
          <div class="rl-loading">
            @for (_ of [1,2,3]; track $index) {
              <div class="rl-skeleton"></div>
            }
          </div>
        }

        <!-- Empty state -->
        @else if (visibleRows().length === 0) {
          <div class="rl-empty">
            <span class="material-symbols-outlined rl-empty-icon">move_to_inbox</span>
            <h3 class="rl-empty-title">
              @if (activeTab() === 'done') { Aucune demande traitée }
              @else if (activeTab() === 'active') { Aucune demande en cours }
              @else { Aucune demande }
            </h3>
            <p class="rl-empty-sub">Vos demandes apparaîtront ici.</p>
            @if (activeTab() === 'all') {
              <button class="rl-btn-primary" (click)="showNew.set(true)" type="button">
                Créer ma première demande
              </button>
            }
          </div>
        }

        <!-- Table -->
        @else {
          <div class="rl-table-wrap">
            <table class="rl-table">
              <thead>
                <tr>
                  <th>Type de demande</th>
                  <th>Soumise le</th>
                  <th>Statut</th>
                  <th>SLA</th>
                  <th class="rl-th-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (row of visibleRows(); track row.id) {
                  <tr class="rl-row">
                    <td class="rl-td-type">
                      <div class="rl-type-cell">
                        <div class="rl-type-icon">
                          <span class="material-symbols-outlined">description</span>
                        </div>
                        <span class="rl-type-name">
                          {{ row.typeDisplayNameFr ?? 'Demande #' + row.requestTypeId }}
                        </span>
                      </div>
                    </td>
                    <td class="rl-td-muted">{{ fmtDate(row.submissionDate) }}</td>
                    <td>
                      <span class="rl-badge" [class]="'rl-badge--' + row.status.toLowerCase()">
                        {{ statusLabel(row.status) }}
                      </span>
                    </td>
                    <td>
                      @if (isActive(row.status)) {
                        @let sla = slaDeadline(row) | slaCountdown;
                        <div class="rl-sla">
                          <span class="rl-sla-dot" [class]="'rl-sla-dot--' + sla.level"></span>
                          <span class="rl-sla-label" [class]="'rl-sla-label--' + sla.level">
                            {{ sla.label }}
                          </span>
                        </div>
                      } @else {
                        <span class="rl-td-muted">—</span>
                      }
                    </td>
                    <td class="rl-td-actions">
                      <a [routerLink]="[row.id]" class="rl-action-btn rl-action-view" title="Détail">
                        <span class="material-symbols-outlined">visibility</span>
                      </a>
                      @if (row.status === 'SUBMITTED') {
                        <button class="rl-action-btn rl-action-cancel"
                                (click)="cancel(row)" type="button" title="Annuler">
                          <span class="material-symbols-outlined">delete_outline</span>
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            @if (totalPages() > 1) {
              <div class="rl-pagination">
                <span class="rl-pag-info">{{ page() + 1 }} / {{ totalPages() }}</span>
                <div class="rl-pag-controls">
                  <button (click)="goPage(page() - 1)" [disabled]="page() <= 0" type="button">‹</button>
                  <button (click)="goPage(page() + 1)" [disabled]="page() >= totalPages() - 1" type="button">›</button>
                </div>
              </div>
            }
          </div>
        }

      </div><!-- /rl-card -->
    </div><!-- /rl-page -->

    <!-- ── New request modal ─────────────────────────────── -->
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

  loading    = signal(false);
  allRows    = signal<EmployeeRequest[]>([]);
  total      = signal(0);
  totalPages = signal(1);
  page       = signal(0);
  showNew    = signal(false);
  activeTab  = signal<TabKey>('all');

  canViewInbox    = computed(() => this.userStore.isHrManager() || this.userStore.isAdmin());
  currentPaysId   = computed(() => this.userStore.currentUser()?.paysId ?? 1);
  currentProfileId = computed(() => {
    const u = this.userStore.currentUser();
    if (!u) return 0;
    const fromEmployee = parseInt(u.employeeId ?? '', 10);
    return isNaN(fromEmployee) ? u.userId : fromEmployee;
  });

  visibleRows = computed(() => {
    const all = this.allRows();
    switch (this.activeTab()) {
      case 'active': return all.filter(r => ACTIVE_STATUSES.includes(r.status));
      case 'done':   return all.filter(r => DONE_STATUSES.includes(r.status));
      default:       return all;
    }
  });

  activeCount = computed(() =>
    this.allRows().filter(r => ACTIVE_STATUSES.includes(r.status)).length
  );
  doneCount = computed(() =>
    this.allRows().filter(r => DONE_STATUSES.includes(r.status)).length
  );

  setTab(tab: TabKey) { this.activeTab.set(tab); }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
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
