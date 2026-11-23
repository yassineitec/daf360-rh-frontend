import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeOptions,
  ButtonComponent,
  CardComponent,
  PageComponent,
  PageHeaderComponent,
  StatusBadgeComponent,
} from '@khalilrebhiitec/daf360';
import { InterviewService } from './interview.service';
import { AssignedInterview, interviewTypeLabel } from './interview.model';

type Bucket = 'toWrite' | 'upcoming' | 'done';

/**
 * /rh/mes-entretiens (V132) — the interviews the user sits on, wherever their rights stop.
 *
 * Being an interviewer is not a permission, so this page is the way in for someone who holds
 * no RH code: it lists their interviews in three groups — PV to write, upcoming, finished —
 * and each opens the candidate on the Entretiens tab, where the PV is written.
 */
@Component({
  selector: 'app-my-interviews',
  standalone: true,
  imports: [PageComponent, PageHeaderComponent, CardComponent, ButtonComponent, StatusBadgeComponent, TranslatePipe],
  template: `
    <daf-page [loading]="loading()" [kpis]="0">
      <daf-page-header
        [title]="'MY_INTERVIEWS.TITLE' | translate"
        [subtitle]="'MY_INTERVIEWS.SUBTITLE' | translate" />

      @if (error()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>
          {{ error() }}
        </div>
      }

      @if (!loading() && !error() && !items().length) {
        <daf-card [options]="{ variant: 'glass', padding: 'lg' }">
          <div class="flex flex-col items-center gap-2 py-6 text-center">
            <span class="material-symbols-outlined text-[32px] text-outline">event_available</span>
            <p class="text-sm text-outline">{{ 'MY_INTERVIEWS.EMPTY' | translate }}</p>
          </div>
        </daf-card>
      }

      @for (group of groups(); track group.id) {
        @if (group.items.length) {
          <section class="flex flex-col gap-3">
            <h2 class="flex items-center gap-2 text-sm font-semibold text-on-surface">
              {{ group.labelKey | translate }}
              <daf-badge [label]="group.items.length + ''" [options]="{ variant: group.id === 'toWrite' ? 'warning' : 'neutral', size: 'sm' }" />
            </h2>
            <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
              @for (iv of group.items; track iv.id) {
                <daf-card [options]="{ variant: 'glass', padding: 'md', accent: group.id === 'toWrite' ? 'warning' : 'none' }">
                  <div class="flex flex-col gap-2">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div class="min-w-0">
                        <p class="truncate text-sm font-semibold text-on-surface">{{ iv.candidateName }}</p>
                        @if (iv.appliedPosition) {
                          <p class="truncate text-xs text-outline">{{ iv.appliedPosition }}</p>
                        }
                      </div>
                      <daf-badge [label]="statusLabel(iv)" [options]="statusBadge(iv)" />
                    </div>
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-outline">
                      <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px]">record_voice_over</span>
                        {{ typeLabel(iv) }}
                      </span>
                      <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px]">schedule</span>
                        {{ formatSlot(iv.scheduledAt) }}
                      </span>
                      @if (iv.location) {
                        <span class="flex items-center gap-1">
                          <span class="material-symbols-outlined text-[14px]">location_on</span>
                          {{ iv.location }}
                        </span>
                      }
                      @if (iv.graphJoinUrl && iv.status === 'PLANNED') {
                        <a [href]="iv.graphJoinUrl" target="_blank" rel="noopener"
                           class="flex items-center gap-1 text-primary hover:underline">
                          <span class="material-symbols-outlined text-[14px]">videocam</span>
                          {{ 'CANDIDATES.INTERVIEWS.JOIN_TEAMS' | translate }}
                        </a>
                      }
                    </div>
                    <div class="flex justify-end">
                      <daf-button
                        [label]="(group.id === 'toWrite' ? 'MY_INTERVIEWS.WRITE_PV' : 'MY_INTERVIEWS.OPEN') | translate"
                        [variant]="group.id === 'toWrite' ? 'teal' : 'ghost'"
                        [options]="{ size: 'sm', iconEnd: 'arrow_forward' }"
                        (onClick)="open(iv)" />
                    </div>
                  </div>
                </daf-card>
              }
            </div>
          </section>
        }
      }
    </daf-page>
  `,
})
export class MyInterviewsComponent implements OnInit {
  private readonly svc       = inject(InterviewService);
  private readonly router    = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly items   = signal<AssignedInterview[]>([]);
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);

  readonly groups = computed(() => {
    const by: Record<Bucket, AssignedInterview[]> = { toWrite: [], upcoming: [], done: [] };
    for (const iv of this.items()) by[this.bucketOf(iv)].push(iv);
    // Upcoming soonest first; the other two most recent first (the server's order).
    by.upcoming.reverse();
    return [
      { id: 'toWrite'  as Bucket, labelKey: 'MY_INTERVIEWS.TO_WRITE', items: by.toWrite },
      { id: 'upcoming' as Bucket, labelKey: 'MY_INTERVIEWS.UPCOMING', items: by.upcoming },
      { id: 'done'     as Bucket, labelKey: 'MY_INTERVIEWS.DONE',     items: by.done },
    ];
  });

  ngOnInit(): void {
    this.svc.listAssigned().subscribe({
      next: list => { this.items.set(list); this.loading.set(false); },
      error: () => { this.error.set(this.translate.instant('MY_INTERVIEWS.ERR_LOAD')); this.loading.set(false); },
    });
  }

  /**
   * PV to write: not decided, the user's PV missing, and the slot reached. The slot is the
   * wall clock typed by RH stamped +00:00, so « reached » compares it as such — a few hours
   * of drift across entities only moves a row between two groups; the server decides.
   */
  private bucketOf(iv: AssignedInterview): Bucket {
    if (iv.result || iv.myReportAt) return 'done';
    return this.slotTime(iv.scheduledAt) <= this.nowAsWallClock() ? 'toWrite' : 'upcoming';
  }

  private slotTime(iso: string): number {
    const t = new Date(iso).getTime();
    return isNaN(t) ? 0 : t;
  }

  /** The browser's wall clock read as if it were UTC — the same frame as a stored slot. */
  private nowAsWallClock(): number {
    const d = new Date();
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
  }

  typeLabel(iv: AssignedInterview): string {
    return iv.interviewTypeName
      ? interviewTypeLabel(iv.interviewTypeName, iv.interviewTypeNameEn, this.translate.currentLang())
      : this.translate.instant('MY_INTERVIEWS.INTERVIEW');
  }

  /** UTC on purpose — the slot is the typed wall clock (see the interviews panel). */
  formatSlot(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR', {
      weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    });
  }

  statusLabel(iv: AssignedInterview): string {
    const key = iv.result === 'PASS' ? 'CANDIDATES.INTERVIEWS.RESULT_PASS'
      : iv.result === 'FAIL' ? 'CANDIDATES.INTERVIEWS.RESULT_FAIL'
      : iv.myReportAt ? 'MY_INTERVIEWS.PV_SENT'
      : iv.status === 'DONE' ? 'CANDIDATES.INTERVIEWS.STATUS_DONE'
      : 'CANDIDATES.INTERVIEWS.STATUS_PLANNED';
    return this.translate.instant(key);
  }

  statusBadge(iv: AssignedInterview): BadgeOptions {
    const variant = iv.result === 'PASS' ? 'success'
      : iv.result === 'FAIL' ? 'danger'
      : iv.myReportAt ? 'info'
      : 'teal';
    return { variant, size: 'sm' };
  }

  open(iv: AssignedInterview): void {
    this.router.navigate(['/rh/candidates', iv.candidateId], {
      queryParams: { tab: 'entretiens', from: 'mes-entretiens' },
    });
  }
}
