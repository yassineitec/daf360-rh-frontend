import { ChangeDetectionStrategy, Component, computed, inject, input, model, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent, DrawerComponent } from '@khalilrebhiitec/daf360';

import {
  ExitInterview, OffboardingAssetReturn, OffboardingTask, OffboardingWorkflowInstance,
} from './models/offboarding.model';
import { stampDate } from './offboarding-display';
import { TimelineComponent, TimelineItem } from '../../shared/detail/timeline.component';

/**
 * "Historique d'audit" — the design's right-hand panel.
 *
 * Every mutation on this file is already written to `audit_logs` by
 * `OffboardingWorkflowService`, but no endpoint can fetch them per entity yet
 * (`/api/hr/audit/logs` is unfiltered and paged over the whole table). So the
 * trail is **reconstructed client-side** from the timestamps the DTOs already
 * carry: task completions/skips, asset confirmations, the interview, and the
 * instance's own lifecycle stamps.
 *
 * PENDING V46 — swap `items()` for the filtered endpoint (see
 * OFFBOARDING-BACKEND-CHANGES.md §3) and the actor names stop being ids; the
 * timeline itself does not change.
 */
@Component({
  selector: 'rh-offboarding-audit-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerComponent, ButtonComponent, TimelineComponent, TranslatePipe],
  template: `
    <daf-drawer
      [(open)]="open"
      [config]="{
        title: ('OFFBOARDING.AUDIT.TITLE' | translate),
        icon: 'history',
        width: '420px',
        showToggle: false,
        closeLabel: ('OFFBOARDING.AUDIT.CLOSE' | translate)
      }">

      <rh-timeline [items]="items()" [emptyLabel]="'OFFBOARDING.AUDIT.EMPTY' | translate" />

      <div drawerFooter class="flex justify-end">
        <!-- PENDING V46 — needs the filtered audit endpoint + CSV export. -->
        <daf-button
          [options]="{ variant: 'secondary', fullWidth: true, iconStart: 'download',
                       label: ('OFFBOARDING.AUDIT.DOWNLOAD' | translate), disabled: true }"
          (onClick)="download.emit()" />
      </div>
    </daf-drawer>
  `,
})
export class OffboardingAuditDrawerComponent {
  private translate = inject(TranslateService);

  /** Two-way, driven by the header's history button. */
  readonly open = model(false);

  readonly wf        = input.required<OffboardingWorkflowInstance>();
  readonly tasks     = input<OffboardingTask[]>([]);
  readonly assets    = input<OffboardingAssetReturn[]>([]);
  readonly interview = input<ExitInterview | null>(null);

  readonly download = output<void>();

  /** Newest first, like the design. */
  protected readonly items = computed<TimelineItem[]>(() => {
    this.translate.currentLang();
    const t = (k: string, p?: Record<string, unknown>) => this.translate.instant(k, p);
    const w = this.wf();
    const rows: { at: string; item: TimelineItem }[] = [];

    const push = (at: string | null | undefined, title: string, meta?: string | null) => {
      if (!at) return;
      rows.push({ at, item: { title, meta, date: stampDate(at), state: 'done' } });
    };

    push(w.createdAt, t('OFFBOARDING.AUDIT.EV_STARTED'),
      t('OFFBOARDING.REASON.' + w.departureReason));

    for (const task of this.tasks()) {
      push(task.completedAt, t('OFFBOARDING.AUDIT.EV_TASK_DONE', { task: task.taskLabel }),
        task.comments || null);
      if (task.skippedBy && !task.completedAt) {
        push(task.createdAt, t('OFFBOARDING.AUDIT.EV_TASK_SKIPPED', { task: task.taskLabel }),
          task.skipReason || null);
      }
    }

    for (const asset of this.assets()) {
      push(asset.confirmedAt ?? asset.actualReturnDate,
        t('OFFBOARDING.AUDIT.EV_ASSET_RETURNED', { asset: asset.assetDescription }),
        asset.conditionOnReturn || null);
    }

    const iv = this.interview();
    if (iv) push(iv.createdAt, t('OFFBOARDING.AUDIT.EV_INTERVIEW'), null);

    push(w.validatedAt,  t('OFFBOARDING.AUDIT.EV_VALIDATED'), null);
    push(w.cancelledAt,  t('OFFBOARDING.AUDIT.EV_CANCELLED'), w.cancellationReason);

    rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    // The newest event is the live one, so it reads as the current position.
    return rows.map((r, i) => i === 0 ? { ...r.item, state: 'active' as const } : r.item);
  });
}
