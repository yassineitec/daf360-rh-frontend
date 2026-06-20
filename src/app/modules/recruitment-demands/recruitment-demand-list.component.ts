import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { catchError, of } from 'rxjs';

import { UserStore } from '../../core/user.store';
import { RecruitmentDemandService } from './recruitment-demand.service';
import {
  RecruitmentDemandSummary,
  RecruitmentDemandStatus,
  DEMAND_STATUS_LABELS,
  DEMAND_STATUS_BADGE,
} from './recruitment-demand.model';
import { RecruitmentDemandFormComponent } from './recruitment-demand-form.component';

const STATUS_FILTER_OPTS: { value: string; label: string }[] = [
  { value: '',           label: 'Tous les statuts' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'APPROUVEE',  label: 'Approuvées' },
  { value: 'REJETEE',    label: 'Rejetées' },
  { value: 'ANNULEE',    label: 'Annulées' },
  { value: 'CLOTUREE',   label: 'Clôturées' },
];

@Component({
  selector: 'app-recruitment-demand-list',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, RecruitmentDemandFormComponent],
  template: `
    <!-- ── Header ─────────────────────────────────────────────────── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Demandes de recrutement</h1>
        <p class="page-sub">{{ total() }} demande{{ total() !== 1 ? 's' : '' }}</p>
      </div>
      @if (canCreate()) {
        <button class="btn-primary" (click)="showForm.set(true)" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nouvelle demande
        </button>
      }
    </div>

    <!-- ── Filters ─────────────────────────────────────────────────── -->
    <div class="filters-bar">
      <select class="filter-select" [(ngModel)]="filterStatut" (ngModelChange)="reload()">
        @for (o of statusOpts; track o.value) {
          <option [value]="o.value">{{ o.label }}</option>
        }
      </select>
    </div>

    <!-- ── Loading / Empty ─────────────────────────────────────────── -->
    @if (loading()) {
      <div class="empty-state"><span class="spinner"></span> Chargement…</div>
    } @else if (items().length === 0) {
      <div class="empty-state">
        <p>Aucune demande de recrutement trouvée.</p>
        @if (canCreate()) {
          <button class="btn-primary" (click)="showForm.set(true)" type="button">
            Créer une demande
          </button>
        }
      </div>
    } @else {
      <!-- ── Table ─────────────────────────────────────────────────── -->
      <div class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Poste</th>
              <th>Motif</th>
              <th>Urgence</th>
              <th>Effectif</th>
              <th>Candidats</th>
              <th>Statut</th>
              <th>Soumise le</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (d of items(); track d.id) {
              <tr>
                <td>
                  <span class="fw-medium">{{ d.jobExactTitle ?? d.jobTitle }}</span>
                  @if (d.jobExactTitle && d.jobExactTitle !== d.jobTitle) {
                    <span class="sub-label">{{ d.jobTitle }}</span>
                  }
                </td>
                <td class="text-muted">{{ d.recruitmentReasonLabel ?? '—' }}</td>
                <td>{{ d.urgencyLevelLabel ?? '—' }}</td>
                <td>{{ d.headcount }}</td>
                <td>{{ d.candidateCount }}</td>
                <td>
                  <span [class]="'badge ' + badgeClass(d.statut)">
                    {{ statusLabel(d.statut) }}
                  </span>
                </td>
                <td class="text-muted">{{ d.submittedAt | date:'dd/MM/yyyy' }}</td>
                <td>
                  <a [routerLink]="[d.id]" class="link-action">Voir</a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- ── Pagination ─────────────────────────────────────────────── -->
      @if (totalPages() > 1) {
        <div class="pagination-bar">
          <button class="btn-ghost" [disabled]="page() === 0" (click)="changePage(page() - 1)" type="button">‹ Préc.</button>
          <span class="page-info">Page {{ page() + 1 }} / {{ totalPages() }}</span>
          <button class="btn-ghost" [disabled]="page() >= totalPages() - 1" (click)="changePage(page() + 1)" type="button">Suiv. ›</button>
        </div>
      }
    }

    <!-- ── Create form modal ─────────────────────────────────────────── -->
    <app-recruitment-demand-form
      [visible]="showForm()"
      (closed)="showForm.set(false)"
      (saved)="reload()"
    />
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
    .page-title  { font-size: 1.5rem; font-weight: 700; margin: 0; }
    .page-sub    { color: var(--color-text-muted, #64748b); margin: .25rem 0 0; font-size: .875rem; }
    .filters-bar { display: flex; gap: .75rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .filter-select { padding: .4rem .75rem; border: 1px solid var(--color-border, #e2e8f0); border-radius: .375rem; font-size: .875rem; }
    .table-card  { background: #fff; border: 1px solid var(--color-border, #e2e8f0); border-radius: .5rem; overflow: hidden; }
    .data-table  { width: 100%; border-collapse: collapse; font-size: .875rem; }
    .data-table th { background: var(--color-surface, #f8fafc); padding: .75rem 1rem; text-align: left; font-weight: 600; color: var(--color-text-muted, #64748b); text-transform: uppercase; font-size: .7rem; letter-spacing: .05em; border-bottom: 1px solid var(--color-border, #e2e8f0); }
    .data-table td { padding: .875rem 1rem; border-bottom: 1px solid var(--color-border, #e2e8f0); vertical-align: middle; }
    .data-table tbody tr:last-child td { border-bottom: none; }
    .data-table tbody tr:hover { background: var(--color-surface, #f8fafc); }
    .fw-medium  { font-weight: 500; display: block; }
    .sub-label  { display: block; font-size: .75rem; color: var(--color-text-muted, #64748b); margin-top: .1rem; }
    .text-muted { color: var(--color-text-muted, #64748b); }
    .badge { display: inline-flex; align-items: center; padding: .2rem .6rem; border-radius: 9999px; font-size: .75rem; font-weight: 600; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-danger  { background: #fee2e2; color: #991b1b; }
    .badge-neutral { background: #f1f5f9; color: #475569; }
    .badge-info    { background: #dbeafe; color: #1e40af; }
    .link-action { color: var(--color-primary, #3b82f6); font-weight: 500; font-size: .875rem; text-decoration: none; }
    .link-action:hover { text-decoration: underline; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 4rem 2rem; color: var(--color-text-muted, #64748b); text-align: center; }
    .spinner { display: inline-block; width: 1.25rem; height: 1.25rem; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .pagination-bar { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1.25rem; }
    .page-info { font-size: .875rem; color: var(--color-text-muted, #64748b); }
    .btn-primary { display: inline-flex; align-items: center; gap: .375rem; padding: .5rem 1rem; background: var(--color-primary, #3b82f6); color: #fff; border: none; border-radius: .375rem; font-size: .875rem; font-weight: 500; cursor: pointer; }
    .btn-primary:hover { background: var(--color-primary-dark, #2563eb); }
    .btn-ghost { padding: .4rem .875rem; background: transparent; border: 1px solid var(--color-border, #e2e8f0); border-radius: .375rem; font-size: .875rem; cursor: pointer; }
    .btn-ghost:hover { background: var(--color-surface, #f8fafc); }
    .btn-ghost:disabled { opacity: .45; cursor: not-allowed; }
  `],
})
export class RecruitmentDemandListComponent implements OnInit {
  private svc       = inject(RecruitmentDemandService);
  private userStore = inject(UserStore);

  readonly statusOpts   = STATUS_FILTER_OPTS;
  readonly canCreate    = () => this.userStore.hasPermission('RH_CREATE_RECRUITMENT_DEMAND');
  readonly canViewAll   = () => this.userStore.hasPermission('RH_VIEW_RECRUITMENT_DEMAND');

  items       = signal<RecruitmentDemandSummary[]>([]);
  total       = signal(0);
  totalPages  = signal(0);
  page        = signal(0);
  loading     = signal(false);
  showForm    = signal(false);
  filterStatut = '';

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.page.set(0);
    this.load();
  }

  changePage(p: number): void {
    this.page.set(p);
    this.load();
  }

  statusLabel(s: RecruitmentDemandStatus): string { return DEMAND_STATUS_LABELS[s]; }
  badgeClass(s: RecruitmentDemandStatus): string  { return DEMAND_STATUS_BADGE[s]; }

  private load(): void {
    this.loading.set(true);
    const paysId  = this.userStore.currentUser()?.paysId;
    const statut  = this.filterStatut as RecruitmentDemandStatus | '';

    const obs$ = (paysId && this.canViewAll())
      ? this.svc.listByPays(paysId, statut, this.page(), 20)
      : this.svc.listMine(statut, this.page(), 20);

    obs$.pipe(catchError(() => of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })))
      .subscribe(r => {
        this.items.set(r.content);
        this.total.set(r.totalElements);
        this.totalPages.set(r.totalPages);
        this.loading.set(false);
      });
  }
}
