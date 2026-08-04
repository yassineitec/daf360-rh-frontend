import { ChangeDetectionStrategy, Component, computed, inject, input, model, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent, DrawerComponent } from '@khalilrebhiitec/daf360';

import { OffboardingAuditEntry } from './models/offboarding.model';
import { stampDate } from './offboarding-display';
import { TimelineComponent, TimelineItem } from '../../shared/detail/timeline.component';

/**
 * "Historique d'audit" — the design's right-hand panel.
 *
 * Reads the real audit log (`GET /{id}/audit`) since V63's companion endpoint.
 *
 * It used to RECONSTRUCT the trail client-side from whatever timestamps the DTOs happened to
 * carry, because `/api/hr/audit/logs` was unfiltered and paged over the whole table. That
 * could only ever surface events which left a visible field behind — so a skipped task, a
 * deleted checklist line, a corrected settlement amount, a reopened file and every actor's
 * name were all invisible. Now the drawer renders what actually happened, attributed.
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

      @if (loading()) {
        <p class="px-1 py-3 text-[13px] text-on-surface-variant">
          {{ 'OFFBOARDING.AUDIT.LOADING' | translate }}
        </p>
      } @else {
        <rh-timeline [items]="items()" [emptyLabel]="'OFFBOARDING.AUDIT.EMPTY' | translate" />
      }

      <div drawerFooter class="flex justify-end">
        <daf-button
          [options]="{ variant: 'secondary', fullWidth: true, iconStart: 'download',
                       label: ('OFFBOARDING.AUDIT.DOWNLOAD' | translate),
                       disabled: !entries().length }"
          (onClick)="download.emit()" />
      </div>
    </daf-drawer>
  `,
})
export class OffboardingAuditDrawerComponent {
  private translate = inject(TranslateService);

  /** Two-way, driven by the header's history button. */
  readonly open = model(false);

  readonly entries = input<OffboardingAuditEntry[]>([]);
  readonly loading = input(false);

  readonly download = output<void>();

  /**
   * Already newest-first from the API. Actions are translated through
   * `OFFBOARDING.AUDIT.ACTION.<CODE>`, falling back to the raw code — a new audit action
   * added server-side then shows as e.g. `OFFBOARDING_REOPENED` rather than disappearing.
   */
  protected readonly items = computed<TimelineItem[]>(() => {
    this.translate.currentLang();
    return this.entries().map((e, i) => {
      const key = 'OFFBOARDING.AUDIT.ACTION.' + e.action;
      const label = this.translate.instant(key);
      return {
        title: label === key ? e.action : label,
        meta: this.metaOf(e),
        date: stampDate(e.timestamp),
        state: i === 0 ? ('active' as const) : ('done' as const),
      };
    });
  });

  /** Actor, then whatever the entry recorded about the change. */
  private metaOf(e: OffboardingAuditEntry): string | null {
    const parts: string[] = [];
    if (e.actorName) parts.push(e.actorName);
    if (e.oldValue && e.newValue) parts.push(`${e.oldValue} → ${e.newValue}`);
    else if (e.newValue)          parts.push(e.newValue);
    return parts.length ? parts.join(' · ') : null;
  }
}
