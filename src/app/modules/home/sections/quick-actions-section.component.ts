import { Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { QuickActionCardComponent, QuickActionColor } from '../components/quick-action-card/quick-action-card.component';

interface QuickActionDef {
  icon:     string;
  label:    string;
  sublabel: string;
  route:    string;
  color:    QuickActionColor;
}

// Same per-action palette as the desktop QuickActionCardComponent's COLOR_CLASSES,
// so the mobile icon-only circles match the desktop site.
const MOBILE_QUICK_ACTION_CLASSES: Record<QuickActionColor, { bg: string; color: string }> = {
  secondary: { bg: 'bg-secondary/10', color: 'text-secondary' },
  tertiary:  { bg: 'bg-tertiary/10',  color: 'text-tertiary' },
  teal:      { bg: 'bg-teal/10',      color: 'text-teal' },
  amber:     { bg: 'bg-[rgba(255,221,184,0.30)]', color: 'text-[#4c2e00]' },
};

/**
 * Home section 1 — the four shortcut cards. Owns both its desktop grid and its
 * mobile icon row, so the page template stays a list of sections (UI-PLAYBOOK §1).
 */
@Component({
  selector: 'rh-quick-actions-section',
  standalone: true,
  host: { class: 'block' },
  imports: [TranslatePipe, QuickActionCardComponent],
  template: `
    <!-- Desktop / tablet -->
    <section class="hidden md:block">
      <h2 class="text-body-lg font-bold text-on-surface mb-4">
        {{ 'HOME.QUICK_ACTIONS.SECTION' | translate }}
      </h2>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        @for (action of quickActions(); track action.label) {
          <rh-quick-action-card
            [icon]="action.icon"
            [label]="action.label"
            [sublabel]="action.sublabel"
            [route]="action.route"
            [color]="action.color"
            (clicked)="navigate.emit(action.route)" />
        }
      </div>
    </section>

    <!-- Mobile — icon-only circles in their own card -->
    <div class="md:hidden rounded-2xl bg-white border border-outline-variant/50 shadow-sm p-4">
      <h2 class="text-[11px] font-semibold uppercase tracking-wider text-outline mb-3">
        {{ 'HOME.QUICK_ACTIONS.SECTION' | translate }}
      </h2>
      <div class="flex items-center justify-between gap-2">
        @for (action of quickActions(); track action.label) {
          @let c = mobileClasses(action.color);
          <button type="button"
            class="w-16 h-16 rounded-full flex items-center justify-center shrink-0 shadow-[0_4px_14px_rgba(0,0,0,0.10)] active:scale-95 transition-transform"
            [class]="c.bg + ' ' + c.color"
            [attr.aria-label]="action.label"
            [title]="action.label"
            (click)="navigate.emit(action.route)">
            <span class="material-symbols-outlined text-[28px]">{{ action.icon }}</span>
          </button>
        }
      </div>
    </div>
  `,
})
export class QuickActionsSectionComponent {
  private translate = inject(TranslateService);

  readonly pendingRequests = input<number>(0);

  /** Emits the route segment, relative to the RH module root. */
  readonly navigate = output<string>();

  readonly quickActions = computed<QuickActionDef[]>(() => {
    const t = (key: string, p?: object) => this.translate.instant(key, p);
    return [
      { icon: 'inbox',        label: t('HOME.QUICK_ACTIONS.REQUESTS_LABEL'),    sublabel: t('HOME.QUICK_ACTIONS.REQUESTS_SUBLABEL', { count: this.pendingRequests() }), route: 'requests',    color: 'secondary' },
      { icon: 'person_add',   label: t('HOME.QUICK_ACTIONS.ONBOARDING_LABEL'),  sublabel: t('HOME.QUICK_ACTIONS.ONBOARDING_SUBLABEL'),                                   route: 'onboarding',  color: 'amber' },
      { icon: 'beach_access', label: t('HOME.QUICK_ACTIONS.LEAVE_LABEL'),       sublabel: t('HOME.QUICK_ACTIONS.LEAVE_SUBLABEL'),                                        route: 'leave',       color: 'tertiary' },
      { icon: 'analytics',    label: t('HOME.QUICK_ACTIONS.RECRUITMENT_LABEL'), sublabel: t('HOME.QUICK_ACTIONS.RECRUITMENT_SUBLABEL'),                                  route: 'recrutement', color: 'teal' },
    ];
  });

  mobileClasses(color: QuickActionColor): { bg: string; color: string } {
    return MOBILE_QUICK_ACTION_CLASSES[color];
  }
}
