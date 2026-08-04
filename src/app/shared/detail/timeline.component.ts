import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type TimelineState = 'done' | 'active' | 'pending';

export interface TimelineItem {
  title:  string;
  /** Second line — who did it, or what it changed. */
  meta?:  string | null;
  /** Third line, rendered as a micro-label. Already formatted by the caller. */
  date?:  string | null;
  state?: TimelineState;
  /** Material Symbol for a pending step; done steps always draw a check. */
  icon?:  string;
}

/**
 * Dated vertical milestones — the audit trail of `/rh/offboarding/:id`.
 *
 * NOT `daf-stepper`: a stepper models a position in a flow you can navigate, this
 * models events that already happened. Kept app-side for now — two callers, both in
 * rh-frontend; the second is the integration tracker on
 * `/rh/onboarding/:candidateId`, whose hand-rolled `.tracker-*` SCSS this can
 * replace once the offboarding page has proved the shape.
 */
@Component({
  selector: 'rh-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ol class="m-0 list-none p-0">
      @for (item of items(); track $index; let last = $last) {
        <li class="relative flex items-start gap-3" [class.pb-5]="!last">

          <!-- Connector, drawn per row: rows are not equal height once a date line
               is in play, so one absolute track would miss the dot centres. -->
          @if (!last) {
            <span aria-hidden="true"
                  class="absolute left-[13px] top-7 bottom-0 w-0.5 -translate-x-1/2 rounded-full"
                  [class]="(item.state ?? 'pending') === 'pending' ? 'bg-outline-variant' : 'bg-tertiary'"></span>
          }

          <!-- Dot -->
          @if ((item.state ?? 'pending') === 'done') {
            <div aria-hidden="true"
                 class="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tertiary text-white">
              <span class="material-symbols-outlined text-[14px]">check</span>
            </div>
          } @else if (item.state === 'active') {
            <div aria-hidden="true"
                 class="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                        border-4 border-tertiary/40 bg-tertiary/20">
              <div class="h-2 w-2 rounded-full bg-tertiary"></div>
            </div>
          } @else {
            <div aria-hidden="true"
                 class="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                        border border-outline-variant bg-surface-container-high text-outline">
              <span class="material-symbols-outlined text-[14px]">{{ item.icon || 'schedule' }}</span>
            </div>
          }

          <div class="min-w-0 pt-0.5">
            <p class="text-[13px] font-bold" [class]="item.state === 'pending' ? 'text-outline' : 'text-on-surface'">
              {{ item.title }}
            </p>
            @if (item.meta) {
              <p class="text-[12px] text-on-surface-variant">{{ item.meta }}</p>
            }
            @if (item.date) {
              <p class="mt-0.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50">
                {{ item.date }}
              </p>
            }
          </div>
        </li>
      }
      @empty {
        <li class="text-[13px] italic text-on-surface-variant">{{ emptyLabel() }}</li>
      }
    </ol>
  `,
})
export class TimelineComponent {
  readonly items      = input<TimelineItem[]>([]);
  readonly emptyLabel = input<string>('—');
}
