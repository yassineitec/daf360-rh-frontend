import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, CardComponent, DafCellDirective, DataTableComponent,
  FormFieldComponent, StatusBadgeComponent,
  type TableColumn, type TableConfig, type TableRow,
} from '@khalilrebhiitec/daf360';

import { ModalComponent } from '../../shared/modal.component';
import { UserStore } from '../../core/user.store';
import { RecruitmentDemandService } from './recruitment-demand.service';
import { RecruitmentDemandSummary } from './recruitment-demand.model';

/** The permission that owns this queue — the same code the review endpoint enforces. */
export const RECRUITMENT_APPROVE_PERMISSION = 'RH_APPROVE_RECRUITMENT_DEMAND';

/**
 * Recruitment validation queue — a section of the RH Demandes page.
 *
 * Only rendered for holders of RH_APPROVE_RECRUITMENT_DEMAND (V31 grants it to Directeur /
 * DRH / Administrateur), which is the same code `POST /recruitment-demands/{id}/review`
 * enforces — so nothing here is ever a dead end for whoever can see it.
 *
 * Managers raise these from the shell's self-service catalogue; approving one is what lets a
 * candidate be attached to it in the recruitment pipeline. The parent page's own tabs cover
 * `employee_requests`, an unrelated table — hence a section of its own rather than a third
 * tab, which would have implied the two share a workflow.
 *
 * Verdicts are given inline here because the queue only exists to clear it; the full file
 * stays one click away for anything needing more than a comment.
 */
@Component({
  selector: 'app-recruitment-validation-section',
  standalone: true,
  imports: [
    ButtonComponent, CardComponent, DataTableComponent, DafCellDirective,
    FormFieldComponent, StatusBadgeComponent, ModalComponent, DatePipe, TranslatePipe,
  ],
  template: `
    <div class="space-y-3">

      <!-- ── Section header ────────────────────────────────────────────── -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-tertiary">how_to_reg</span>
          <h2 class="text-[18px] font-bold text-on-surface">
            {{ 'RECRUITMENT_VALIDATION.TITLE' | translate }}
          </h2>
          @if (pending().length) {
            <daf-badge [label]="pending().length.toString()"
                       [options]="{ variant: 'warning', pill: true }" />
          }
        </div>
        <daf-button
          [options]="{ variant: 'ghost', label: ('RECRUITMENT_VALIDATION.SEE_ALL' | translate), iconStart: 'open_in_new' }"
          (onClick)="goToAll()" />
      </div>

      <p class="m-0 text-[13px] text-on-surface-variant">
        {{ 'RECRUITMENT_VALIDATION.SUBTITLE' | translate }}
      </p>

      <daf-card class="block" [options]="{ variant: 'default', padding: 'none', radius: 'xl' }">
        <div class="p-4 sm:p-5">

          @if (error()) {
            <div class="mb-3 rounded-lg bg-error-container px-3.5 py-2.5 text-[13px] text-on-error-container">
              {{ error() }}
            </div>
          }

          @if (loading()) {
            @for (i of [0, 1]; track i) {
              <div class="mb-2 h-14 animate-pulse rounded-xl bg-surface-container"></div>
            }
          } @else if (pending().length === 0) {
            <!-- An empty queue is the good outcome, so it reads as cleared, not as broken. -->
            <div class="flex flex-col items-center gap-2 py-12 text-center">
              <span class="material-symbols-outlined text-[36px] text-outline-variant">task_alt</span>
              <p class="m-0 text-[14px] font-semibold text-on-surface">
                {{ 'RECRUITMENT_VALIDATION.EMPTY' | translate }}
              </p>
              <p class="m-0 text-[12px] text-outline">
                {{ 'RECRUITMENT_VALIDATION.EMPTY_HINT' | translate }}
              </p>
            </div>
          } @else {
            <daf-data-table [columns]="columns()" [rows]="rows()" [config]="tableConfig">
              <ng-template dafCell="poste" let-row>
                <div class="flex flex-col">
                  <span class="text-[13px] font-semibold text-on-surface">{{ row['_src'].jobTitle }}</span>
                  @if (row['_src'].department) {
                    <span class="text-[11px] text-outline">{{ row['_src'].department }}</span>
                  }
                </div>
              </ng-template>

              <ng-template dafCell="urgency" let-row>
                @if (row['_src'].urgencyLevelLabel) {
                  <daf-badge [label]="row['_src'].urgencyLevelLabel"
                             [options]="{ variant: 'warning', pill: true, size: 'sm' }" />
                } @else {
                  <span class="text-[12px] text-outline">—</span>
                }
              </ng-template>

              <ng-template dafCell="submitted" let-row>
                <span class="text-[12px] text-on-surface-variant">
                  {{ row['_src'].submittedAt | date:'dd/MM/yyyy' }}
                </span>
              </ng-template>

              <ng-template dafCell="_actions" let-row>
                <div class="flex flex-wrap items-center justify-end gap-1.5">
                  <daf-button
                    [options]="{ variant: 'ghost', size: 'sm', label: ('RECRUITMENT_VALIDATION.OPEN' | translate) }"
                    (onClick)="openDemand(row['_src'].id)" />
                  <daf-button
                    [options]="{ variant: 'teal', size: 'sm', iconStart: 'check', label: ('RECRUITMENT_VALIDATION.APPROVE' | translate) }"
                    (onClick)="askVerdict(row['_src'], true)" />
                  <daf-button
                    [options]="{ variant: 'danger', size: 'sm', iconStart: 'close', label: ('RECRUITMENT_VALIDATION.REJECT' | translate) }"
                    (onClick)="askVerdict(row['_src'], false)" />
                </div>
              </ng-template>
            </daf-data-table>
          }
        </div>
      </daf-card>
    </div>

    <!-- ── Verdict modal ──────────────────────────────────────────────── -->
    <app-modal
      [title]="(approving() ? 'RECRUITMENT_VALIDATION.APPROVE_TITLE' : 'RECRUITMENT_VALIDATION.REJECT_TITLE') | translate"
      [visible]="target() !== null"
      [hasFooter]="true"
      (closed)="closeVerdict()">
      @if (target(); as d) {
        <p class="mb-3 text-[13px] text-on-surface">
          <strong>{{ d.jobTitle }}</strong>
          @if (d.headcount > 1) {
            · {{ 'RECRUITMENT_VALIDATION.POSITIONS' | translate: { n: d.headcount } }}
          }
        </p>
        <daf-form-field
          [options]="{
            label: ((approving() ? 'RECRUITMENT_VALIDATION.COMMENT_OPTIONAL' : 'RECRUITMENT_VALIDATION.COMMENT_REQUIRED') | translate),
            type: 'textarea', rows: 3, fullWidth: true,
            required: !approving(),
            error: commentError()
          }"
          [value]="comment"
          (valueChange)="comment = asText($event); commentError.set('')" />
      }
      <div slot="footer">
        <daf-button [options]="{ variant: 'secondary', label: ('RECRUITMENT_VALIDATION.CANCEL' | translate) }"
                    (onClick)="closeVerdict()" />
        <daf-button
          [options]="{
            variant: approving() ? 'teal' : 'danger',
            label: submitting()
              ? ('RECRUITMENT_VALIDATION.SAVING' | translate)
              : ((approving() ? 'RECRUITMENT_VALIDATION.APPROVE' : 'RECRUITMENT_VALIDATION.REJECT') | translate),
            disabled: submitting(), loading: submitting()
          }"
          (onClick)="submitVerdict()" />
      </div>
    </app-modal>
  `,
})
export class RecruitmentValidationSectionComponent implements OnInit {
  private svc       = inject(RecruitmentDemandService);
  private userStore = inject(UserStore);
  private router    = inject(Router);
  private translate = inject(TranslateService);

  readonly pending    = signal<RecruitmentDemandSummary[]>([]);
  readonly loading    = signal(true);
  readonly error      = signal<string | null>(null);

  readonly target     = signal<RecruitmentDemandSummary | null>(null);
  readonly approving  = signal(true);
  readonly submitting = signal(false);
  comment = '';
  readonly commentError = signal('');

  readonly tableConfig: TableConfig = { hoverable: true };

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('RECRUITMENT_VALIDATION.COL_' + k);
    return [
      { key: 'poste',     label: t('POSITION') },
      { key: 'headcount', label: t('HEADCOUNT') },
      { key: 'reason',    label: t('REASON') },
      { key: 'urgency',   label: t('URGENCY') },
      { key: 'submitted', label: t('SUBMITTED') },
      { key: '_actions',  label: '', align: 'right' },
    ];
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pending().map(d => ({
      poste:     d.jobTitle,
      headcount: d.headcount,
      reason:    d.recruitmentReasonLabel ?? '—',
      urgency:   d.urgencyLevelLabel ?? '—',
      submitted: d.submittedAt,
      _src:      d,
    })),
  );

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    const paysId = this.userStore.currentUser()?.paysId;
    if (!paysId) {
      // Admins and show-all roles have no pays of their own; without one the endpoint has
      // nothing to scope to, so say so rather than render a permanently empty queue.
      this.loading.set(false);
      this.error.set(this.translate.instant('RECRUITMENT_VALIDATION.ERR_NO_PAYS'));
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.svc.listByPays(paysId, 'EN_ATTENTE', 0, 50)
      .pipe(catchError(() => of(null)))
      .subscribe(page => {
        this.loading.set(false);
        if (!page) {
          this.error.set(this.translate.instant('RECRUITMENT_VALIDATION.ERR_LOAD'));
          return;
        }
        this.pending.set(page.content ?? []);
      });
  }

  askVerdict(d: RecruitmentDemandSummary, approve: boolean): void {
    this.approving.set(approve);
    this.target.set(d);
    this.comment = '';
    this.commentError.set('');
  }

  closeVerdict(): void {
    this.target.set(null);
    this.comment = '';
    this.commentError.set('');
  }

  submitVerdict(): void {
    const d = this.target();
    if (!d || this.submitting()) return;

    // A rejection without a reason leaves the manager with no idea what to change, so the
    // comment is required there and optional on approval.
    if (!this.approving() && !this.comment.trim()) {
      this.commentError.set(this.translate.instant('RECRUITMENT_VALIDATION.ERR_COMMENT_REQUIRED'));
      return;
    }

    this.submitting.set(true);
    this.svc.review(d.id, {
      approved: this.approving(),
      comment: this.comment.trim() || undefined,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        // Drop it locally rather than re-fetching: it has left EN_ATTENTE either way, and
        // the row disappearing is the confirmation.
        this.pending.update(list => list.filter(x => x.id !== d.id));
        this.closeVerdict();
      },
      error: (err) => {
        this.submitting.set(false);
        this.commentError.set(err?.error?.detail ?? err?.error?.message
          ?? this.translate.instant('RECRUITMENT_VALIDATION.ERR_REVIEW'));
      },
    });
  }

  openDemand(id: number): void {
    this.router.navigate(['/rh/recruitment-demands', id]);
  }

  goToAll(): void {
    this.router.navigate(['/rh/recruitment-demands']);
  }

  asText(v: string | number | null): string {
    return v == null ? '' : String(v);
  }
}
