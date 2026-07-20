import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { UserStore } from '../../core/user.store';
import { RecruitmentDemandService } from './recruitment-demand.service';
import {
  RecruitmentDemandDetail,
  RecruitmentDemandStatus,
  DEMAND_STATUS_BADGE,
} from './recruitment-demand.model';

@Component({
  selector: 'app-recruitment-demand-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule, TranslatePipe],
  template: `
    <div class="detail-container">
      <!-- Back link -->
      <a routerLink=".." class="back-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        {{ 'RECRUITMENT_DEMANDS.DETAIL.BACK' | translate }}
      </a>

      @if (loading()) {
        <div class="empty-state"><span class="spinner"></span> {{ 'RECRUITMENT_DEMANDS.DETAIL.LOADING' | translate }}</div>
      } @else if (!demand()) {
        <div class="empty-state">{{ 'RECRUITMENT_DEMANDS.DETAIL.NOT_FOUND' | translate }}</div>
      } @else {
        <div class="header-row">
          <div>
            <h1 class="page-title">{{ demand()!.jobTitle }}</h1>
            @if (demand()!.department) {
              <p class="page-sub">{{ demand()!.department }}</p>
            }
          </div>
          <span [class]="'badge ' + badgeClass(demand()!.statut)">
            {{ ('RECRUITMENT_DEMANDS.STATUS.' + demand()!.statut) | translate }}
          </span>
        </div>

        <div class="card-grid">
          <!-- Main info -->
          <div class="card span-2">
            <h3 class="section-title">{{ 'RECRUITMENT_DEMANDS.DETAIL.JOB_DETAILS' | translate }}</h3>
            <dl class="detail-list">
              @if (demand()!.jobExactTitle) {
                <dt>{{ 'RECRUITMENT_DEMANDS.DETAIL.EXACT_TITLE' | translate }}</dt><dd>{{ demand()!.jobExactTitle }}</dd>
              }
              <dt>{{ 'RECRUITMENT_DEMANDS.DETAIL.RECRUITMENT_REASON' | translate }}</dt><dd>{{ demand()!.recruitmentReasonLabel ?? '—' }}</dd>
              <dt>{{ 'RECRUITMENT_DEMANDS.DETAIL.HEADCOUNT' | translate }}</dt><dd>{{ demand()!.headcount }}</dd>
              <dt>{{ 'RECRUITMENT_DEMANDS.DETAIL.URGENCY' | translate }}</dt><dd>{{ demand()!.urgencyLevelLabel ?? '—' }}</dd>
              <dt>{{ 'RECRUITMENT_DEMANDS.DETAIL.CSP' | translate }}</dt><dd>{{ demand()!.cspCategoryLabel ?? '—' }}</dd>
              <dt>{{ 'RECRUITMENT_DEMANDS.DETAIL.EXPERIENCE' | translate }}</dt><dd>{{ demand()!.experienceLevelLabel ?? '—' }}</dd>
              <dt>{{ 'RECRUITMENT_DEMANDS.DETAIL.EDUCATION' | translate }}</dt><dd>{{ demand()!.educationLevelLabel ?? '—' }}</dd>
              <dt>{{ 'RECRUITMENT_DEMANDS.DETAIL.TARGET_START' | translate }}</dt><dd>{{ demand()!.targetStartDate ? (demand()!.targetStartDate | date:'dd/MM/yyyy') : '—' }}</dd>
              <dt>{{ 'RECRUITMENT_DEMANDS.DETAIL.BUDGET' | translate }}</dt><dd>{{ demand()!.budgetRange ?? '—' }}</dd>
              <dt>{{ 'RECRUITMENT_DEMANDS.DETAIL.LINKED_CANDIDATES' | translate }}</dt><dd>{{ demand()!.candidateCount }}</dd>
            </dl>
          </div>

          @if (demand()!.needDescription) {
            <div class="card span-2">
              <h3 class="section-title">{{ 'RECRUITMENT_DEMANDS.DETAIL.NEED_DESC' | translate }}</h3>
              <p class="text-body">{{ demand()!.needDescription }}</p>
            </div>
          }

          <div class="card">
            <h3 class="section-title">{{ 'RECRUITMENT_DEMANDS.DETAIL.REQUIRED_PROFILE' | translate }}</h3>
            <p class="text-body">{{ demand()!.requiredProfile }}</p>
          </div>

          <div class="card">
            <h3 class="section-title">{{ 'RECRUITMENT_DEMANDS.DETAIL.SCOPE' | translate }}</h3>
            <p class="text-body">{{ demand()!.scopeOfWork }}</p>
          </div>

          @if (demand()!.technicalSkills.length) {
            <div class="card">
              <h3 class="section-title">{{ 'RECRUITMENT_DEMANDS.DETAIL.TECH_SKILLS' | translate }}</h3>
              <div class="skill-tags">
                @for (s of demand()!.technicalSkills; track s) {
                  <span class="skill-tag skill-tag--tech">{{ s }}</span>
                }
              </div>
            </div>
          }

          @if (demand()!.softSkills.length) {
            <div class="card">
              <h3 class="section-title">{{ 'RECRUITMENT_DEMANDS.DETAIL.SOFT_SKILLS' | translate }}</h3>
              <div class="skill-tags">
                @for (s of demand()!.softSkills; track s) {
                  <span class="skill-tag skill-tag--soft">{{ s }}</span>
                }
              </div>
            </div>
          }

          @if (demand()!.additionalNotes) {
            <div class="card span-2">
              <h3 class="section-title">{{ 'RECRUITMENT_DEMANDS.DETAIL.ADDITIONAL_NOTES' | translate }}</h3>
              <p class="text-body">{{ demand()!.additionalNotes }}</p>
            </div>
          }

          <!-- Review block -->
          @if (demand()!.reviewedAt) {
            <div class="card span-2 review-card" [class.approved]="demand()!.statut === 'APPROUVEE'" [class.rejected]="demand()!.statut === 'REJETEE'">
              <h3 class="section-title">{{ 'RECRUITMENT_DEMANDS.DETAIL.DECISION' | translate }}</h3>
              <p class="review-verdict">{{ ('RECRUITMENT_DEMANDS.STATUS.' + demand()!.statut) | translate }}</p>
              @if (demand()!.reviewComment) {
                <p class="text-body">{{ demand()!.reviewComment }}</p>
              }
              <p class="text-muted small">{{ demand()!.reviewedAt | date:'dd/MM/yyyy HH:mm' }}</p>
            </div>
          }

          <!-- Approve / Reject panel -->
          @if (canApprove() && demand()!.statut === 'EN_ATTENTE') {
            <div class="card span-2 action-card">
              <h3 class="section-title">{{ 'RECRUITMENT_DEMANDS.DETAIL.PROCESS' | translate }}</h3>
              <textarea class="textarea" [(ngModel)]="reviewComment" [placeholder]="'RECRUITMENT_DEMANDS.DETAIL.COMMENT_OPTIONAL' | translate" rows="3"></textarea>
              @if (reviewError()) {
                <p class="error-msg">{{ reviewError() }}</p>
              }
              <div class="action-row">
                <button class="btn-success" [disabled]="reviewing()" (click)="doReview(true)" type="button">
                  {{ 'RECRUITMENT_DEMANDS.DETAIL.APPROVE' | translate }}
                </button>
                <button class="btn-danger" [disabled]="reviewing()" (click)="doReview(false)" type="button">
                  {{ 'RECRUITMENT_DEMANDS.DETAIL.REJECT' | translate }}
                </button>
              </div>
            </div>
          }

          <!-- Cancel own demand -->
          @if (canCancel()) {
            <div class="card span-2">
              <button class="btn-ghost btn-danger-ghost" [disabled]="reviewing()" (click)="doCancel()" type="button">
                {{ 'RECRUITMENT_DEMANDS.DETAIL.CANCEL_DEMAND' | translate }}
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .detail-container { max-width: 900px; margin: 0 auto; padding: 1.5rem 1rem; }
    .back-link { display: inline-flex; align-items: center; gap: .375rem; color: var(--color-text-muted,#64748b); font-size:.875rem; text-decoration:none; margin-bottom:1.25rem; }
    .back-link:hover { color: var(--color-primary,#3b82f6); }
    .header-row { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; }
    .page-title { font-size:1.5rem; font-weight:700; margin:0; }
    .page-sub   { color:var(--color-text-muted,#64748b); margin:.25rem 0 0; font-size:.875rem; }
    .card-grid  { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    .card { background:#fff; border:1px solid var(--color-border,#e2e8f0); border-radius:.5rem; padding:1.25rem; }
    .span-2 { grid-column:span 2; }
    .section-title { font-size:.875rem; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--color-text-muted,#64748b); margin:0 0 .875rem; }
    .detail-list { display:grid; grid-template-columns:1fr 1fr; gap:.5rem; margin:0; }
    .detail-list dt { font-size:.8125rem; color:var(--color-text-muted,#64748b); font-weight:500; }
    .detail-list dd { font-size:.875rem; font-weight:500; margin:0; }
    .text-body  { font-size:.875rem; line-height:1.6; white-space:pre-wrap; margin:0; }
    .text-muted { color:var(--color-text-muted,#64748b); }
    .small      { font-size:.75rem; margin-top:.5rem; }
    .badge { display:inline-flex; align-items:center; padding:.2rem .6rem; border-radius:9999px; font-size:.75rem; font-weight:600; }
    .badge-warning { background:#fef3c7; color:#92400e; }
    .badge-success { background:#d1fae5; color:#065f46; }
    .badge-danger  { background:#fee2e2; color:#991b1b; }
    .badge-neutral { background:#f1f5f9; color:#475569; }
    .badge-info    { background:#dbeafe; color:#1e40af; }
    .review-card { border-left:4px solid var(--color-border,#e2e8f0); }
    .review-card.approved { border-left-color:#10b981; }
    .review-card.rejected { border-left-color:#ef4444; }
    .review-verdict { font-size:1rem; font-weight:600; margin:0 0 .5rem; }
    .action-card { background:#f8fafc; }
    .textarea  { width:100%; padding:.5rem .75rem; border:1px solid var(--color-border,#e2e8f0); border-radius:.375rem; font-size:.875rem; resize:vertical; box-sizing:border-box; }
    .action-row { display:flex; gap:.75rem; margin-top:.875rem; }
    .btn-success { padding:.5rem 1.25rem; background:#10b981; color:#fff; border:none; border-radius:.375rem; font-size:.875rem; font-weight:500; cursor:pointer; }
    .btn-success:hover { background:#059669; }
    .btn-success:disabled { opacity:.5; cursor:not-allowed; }
    .btn-danger  { padding:.5rem 1.25rem; background:#ef4444; color:#fff; border:none; border-radius:.375rem; font-size:.875rem; font-weight:500; cursor:pointer; }
    .btn-danger:hover { background:#dc2626; }
    .btn-danger:disabled { opacity:.5; cursor:not-allowed; }
    .btn-ghost   { padding:.4rem .875rem; background:transparent; border:1px solid var(--color-border,#e2e8f0); border-radius:.375rem; font-size:.875rem; cursor:pointer; }
    .btn-danger-ghost { color:#ef4444; border-color:#fca5a5; }
    .btn-danger-ghost:hover { background:#fee2e2; }
    .error-msg   { color:#ef4444; font-size:.8125rem; margin:.5rem 0 0; }
    .empty-state { display:flex; align-items:center; gap:.75rem; padding:4rem 2rem; color:var(--color-text-muted,#64748b); }
    .spinner { display:inline-block; width:1.25rem; height:1.25rem; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .skill-tags  { display:flex; flex-wrap:wrap; gap:.375rem; }
    .skill-tag   { display:inline-flex; align-items:center; padding:.2rem .6rem; border-radius:9999px; font-size:.75rem; font-weight:500; }
    .skill-tag--tech { background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; }
    .skill-tag--soft { background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
    @media (max-width:640px) { .card-grid { grid-template-columns:1fr; } .span-2 { grid-column:span 1; } }
  `],
})
export class RecruitmentDemandDetailComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private svc       = inject(RecruitmentDemandService);
  private userStore = inject(UserStore);
  private translate = inject(TranslateService);

  demand       = signal<RecruitmentDemandDetail | null>(null);
  loading      = signal(true);
  reviewing    = signal(false);
  reviewComment = '';
  reviewError  = signal<string | null>(null);

  readonly canApprove = () => this.userStore.hasPermission('RH_APPROVE_RECRUITMENT_DEMAND');
  readonly canCancel  = () => {
    const d = this.demand();
    const uid = this.userStore.currentUser()?.userId;
    return d?.statut === 'EN_ATTENTE' && d?.createdByUserId === uid;
  };

  badgeClass(s: RecruitmentDemandStatus): string  { return DEMAND_STATUS_BADGE[s]; }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.getById(id).pipe(catchError(() => of(null))).subscribe(d => {
      this.demand.set(d);
      this.loading.set(false);
    });
  }

  doReview(approved: boolean): void {
    const d = this.demand();
    if (!d) return;
    this.reviewing.set(true);
    this.reviewError.set(null);
    this.svc.review(d.id, { approved, comment: this.reviewComment || null })
      .pipe(catchError(err => { this.reviewError.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('RECRUITMENT_DEMANDS.DETAIL.ERR')); this.reviewing.set(false); return of(null); }))
      .subscribe(updated => {
        if (updated) { this.demand.set(updated); }
        this.reviewing.set(false);
      });
  }

  doCancel(): void {
    const d = this.demand();
    if (!d) return;
    this.reviewing.set(true);
    this.svc.cancel(d.id)
      .pipe(catchError(() => { this.reviewing.set(false); return of(null); }))
      .subscribe(updated => {
        if (updated) { this.demand.set(updated); }
        this.reviewing.set(false);
      });
  }
}
