import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgClass, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CandidateService } from './candidate.service';
import { UserStore } from '../../core/user.store';
import { PermissionDirective } from '../../shared/permission.directive';
import { CandidateListItem, CandidateStats, CandidateHistoryItem, PageResponse } from './candidate.model';

@Component({
  selector: 'app-candidate-list',
  standalone: true,
  imports: [NgClass, NgStyle, FormsModule, RouterLink, PermissionDirective],
  templateUrl: './candidate-list.component.html',
  styleUrls: ['./candidate-list.component.scss'],
})
export class CandidateListComponent implements OnInit {
  private svc = inject(CandidateService);
  private router = inject(Router);
  readonly userStore = inject(UserStore);

  candidates    = signal<PageResponse<CandidateListItem> | null>(null);
  stats         = signal<CandidateStats>({ total: 0, pending: 0, hiredThisMonth: 0 });
  history       = signal<CandidateHistoryItem[]>([]);
  selectedId    = signal<number | null>(null);

  isLoadingStats      = signal(true);
  isLoadingCandidates = signal(true);
  isLoadingHistory    = signal(false);
  showFilters         = signal(false);

  currentPage  = signal(0);
  pageSize     = signal(10);
  searchInput  = '';
  statusFilter = '';

  selectedCandidate = computed(() => {
    const id = this.selectedId();
    return this.candidates()?.content?.find(c => c.id === id) ?? null;
  });

  skeletonRows = [1, 2, 3, 4, 5];

  ngOnInit(): void { this.loadStats(); this.loadCandidates(); }

  loadStats(): void {
    this.isLoadingStats.set(true);
    this.svc.getStats().subscribe({
      next:  s  => { this.stats.set(s); this.isLoadingStats.set(false); },
      error: () => this.isLoadingStats.set(false),
    });
  }

  loadCandidates(): void {
    this.isLoadingCandidates.set(true);
    this.svc.getCandidates({
      paysId: this.userStore.currentUser()?.paysId,
      status: this.statusFilter || undefined,
      search: this.searchInput  || undefined,
      page:   this.currentPage(),
      size:   this.pageSize(),
    }).subscribe({
      next:  r  => { this.candidates.set(r); this.isLoadingCandidates.set(false); },
      error: () => this.isLoadingCandidates.set(false),
    });
  }

  onRowClick(candidateId: number): void {
    const same = this.selectedId() === candidateId;
    this.selectedId.set(same ? null : candidateId);
    if (same) return;
    this.isLoadingHistory.set(true);
    this.svc.getHistory(candidateId).subscribe({
      next:  h  => { this.history.set(h); this.isLoadingHistory.set(false); },
      error: () => this.isLoadingHistory.set(false),
    });
  }

  onPageChange(p: number): void { this.currentPage.set(p); this.loadCandidates(); }

  applyFilters(): void { this.currentPage.set(0); this.loadCandidates(); }

  clearFilters(): void {
    this.searchInput = ''; this.statusFilter = '';
    this.currentPage.set(0); this.loadCandidates();
  }

  toggleFilters(): void { this.showFilters.update(v => !v); }

  getStatusClass(s: string): string {
    const m: Record<string, string> = {
      PENDING:        'status-pending',
      ACCEPTED:       'status-accepted',
      REJECTED:       'status-rejected',
      IT_IN_PROGRESS: 'status-it',
      EMAIL_RECEIVED: 'status-email',
      HR_IN_PROGRESS: 'status-hr',
      HIRED:          'status-hired',
      ARCHIVED:       'status-archived',
    };
    return m[s] ?? 'status-archived';
  }

  getStatusLabel(s: string): string {
    const m: Record<string, string> = {
      PENDING:        'En attente',
      ACCEPTED:       'Accepté(e)',
      REJECTED:       'Refusé(e)',
      IT_IN_PROGRESS: 'IT en cours',
      EMAIL_RECEIVED: 'Email reçu',
      HR_IN_PROGRESS: 'RH en cours',
      HIRED:          'Embauché(e)',
      ARCHIVED:       'Archivé(e)',
    };
    return m[s] ?? s;
  }

  getStatusIcon(s: string): string {
    const m: Record<string, string> = {
      PENDING:        'schedule',
      ACCEPTED:       'check_circle',
      REJECTED:       'cancel',
      IT_IN_PROGRESS: 'settings',
      EMAIL_RECEIVED: 'mark_email_read',
      HR_IN_PROGRESS: 'edit_document',
      HIRED:          'how_to_reg',
      ARCHIVED:       'archive',
    };
    return m[s] ?? 'circle';
  }

  getTimelineDotStyle(action: string): object {
    const m: Record<string, { bg: string; color: string }> = {
      ACCEPT_CANDIDATE:            { bg: '#4648d4', color: '#fff' },
      ACCEPT:                      { bg: '#4648d4', color: '#fff' },
      REJECT_CANDIDATE:            { bg: '#ba1a1a', color: '#fff' },
      REJECT:                      { bg: '#ba1a1a', color: '#fff' },
      UPLOAD_CV:                   { bg: 'rgba(51,65,85,.1)', color: '#1d2b3e' },
      CREATE_CANDIDATE:            { bg: 'rgba(51,65,85,.1)', color: '#1d2b3e' },
      CREATE:                      { bg: 'rgba(51,65,85,.1)', color: '#1d2b3e' },
      SUBMIT_MS365_EMAIL:          { bg: '#004941', color: '#00c1ad' },
      COMPLETE_IT_PROVISIONING:    { bg: '#334155', color: '#9eadc5' },
      COMPLETE_ONBOARDING_PROFILE: { bg: '#4648d4', color: '#fff' },
    };
    const s = m[action] ?? { bg: 'rgba(51,65,85,.1)', color: '#1d2b3e' };
    return { 'background-color': s.bg, color: s.color };
  }

  getTimelineIcon(action: string): string {
    const m: Record<string, string> = {
      ACCEPT_CANDIDATE:            'check',
      ACCEPT:                      'check',
      REJECT_CANDIDATE:            'close',
      REJECT:                      'close',
      CREATE_CANDIDATE:            'person_add',
      CREATE:                      'person_add',
      UPLOAD_CV:                   'upload_file',
      UPDATE:                      'edit',
      UPDATE_CANDIDATE:            'edit',
      SUBMIT_MS365_EMAIL:          'computer',
      COMPLETE_IT_PROVISIONING:    'lan',
      COMPLETE_ONBOARDING_PROFILE: 'how_to_reg',
    };
    return m[action] ?? 'history';
  }

  getInitials(fn: string, ln: string): string {
    return ((fn?.[0] ?? '') + (ln?.[0] ?? '')).toUpperCase();
  }

  formatDateFr(d: string | null | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    const mo = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    return dt.getDate() + ' ' + mo[dt.getMonth()] + ' ' + dt.getFullYear();
  }

  formatTimestamp(ts: string | null): string {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
         + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  openNewCandidateForm(): void {
    this.router.navigate(['/hr/candidates/new']);
  }

  openStatusModal(candidate: CandidateListItem): void {
    this.router.navigate(['/hr/candidates', candidate.id]);
  }

  // ── Quick Accept / Reject from list ───────────────────────────────────────

  readonly canAcceptReject = computed(() =>
    this.userStore.hasPermission('ACCEPT_REJECT_CANDIDATE')
  );

  readonly canHire = computed(() =>
    this.userStore.hasPermission('RH_HIRE_CANDIDATE')
  );

  // Reject modal state
  rejectTarget   = signal<CandidateListItem | null>(null);
  rejectReason   = '';
  isActioning    = signal(false);
  actionError    = signal<string | null>(null);

  quickAccept(c: CandidateListItem, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Accepter le candidat ${c.firstName} ${c.lastName} ?`)) return;
    this.isActioning.set(true);
    this.svc.accept(c.id).subscribe({
      next: () => { this.isActioning.set(false); this.loadCandidates(); },
      error: err => { this.isActioning.set(false); this.actionError.set(err?.error?.message ?? 'Erreur lors de l\'acceptation.'); },
    });
  }

  openRejectModal(c: CandidateListItem, event: Event): void {
    event.stopPropagation();
    this.rejectTarget.set(c);
    this.rejectReason = '';
    this.actionError.set(null);
  }

  confirmReject(): void {
    const c = this.rejectTarget();
    if (!c || !this.rejectReason.trim()) return;
    this.isActioning.set(true);
    this.svc.reject(c.id, this.rejectReason).subscribe({
      next: () => { this.isActioning.set(false); this.rejectTarget.set(null); this.loadCandidates(); },
      error: err => { this.isActioning.set(false); this.actionError.set(err?.error?.message ?? 'Erreur lors du rejet.'); },
    });
  }
}
