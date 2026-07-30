import { Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CardComponent, ProgressBarComponent, ProgressBarOptions } from '@khalilrebhiitec/daf360';
import { getAvatarUrl } from '../../../../shared/utils/avatar.utils';

export interface EmployeeCardData {
  profileId:    number | null;
  fullName:     string;
  poste:        string | null;
  department:   string | null;
  discipline:   string | null;
  /** Human phrase ("Contrat à durée indéterminée"), already translated by the parent. */
  contractLabel: string | null;
  /** Country name as plain text — no flag, by design. */
  countryLabel: string | null;
  /** Start working date, already formatted for the active locale. */
  startDate:    string;
  photoUrl:     string | null;
  gender:       string | null;
  initials:     string;
  /**
   * Onboarding completeness, one entry per wizard step (documents last). Already
   * translated by the parent. See UI-PLAYBOOK §8b.
   */
  sections: EmployeeCardSection[];
}

export interface EmployeeCardSection {
  key:    string;
  label:  string;
  filled: number;
  total:  number;
}

// Same glass-card recipe as /finance/affaires' cards: badge pinned top-right,
// avatar + ref + name header, row-separated info list, and a green pill CTA
// that's hidden until the card is hovered.
@Component({
  selector: 'rh-employee-card',
  standalone: true,
  imports: [TranslatePipe, CardComponent, ProgressBarComponent],
  template: `
    <daf-card [options]="{ variant: 'glass', padding: 'none', radius: 'xl', hoverable: true, clickable: true }"
              (click)="viewProfile.emit(employee().profileId)"
              (mouseenter)="hovered.set(true)"
              (mouseleave)="hovered.set(false)">
      <div class="emp-card">

        <!-- Country (top-right) — text only, never a flag -->
        @if (employee().countryLabel) {
          <div class="emp-card__badge-pos">
            <span class="flex items-center gap-1 text-[11px] font-bold text-teal">
              <span class="material-symbols-outlined text-[14px]">location_on</span>
              {{ employee().countryLabel }}
            </span>
          </div>
        }

        <!-- Avatar + name -->
        <div class="emp-card__header">
          <div class="emp-card__id-block">
            <div class="emp-card__avatar">
              @if (!avatarFailed()) {
                <img [src]="getAvatarUrl(employee().profileId, employee().photoUrl, employee().gender)"
                     [alt]="employee().fullName"
                     class="w-full h-full object-cover"
                     (error)="avatarFailed.set(true)" />
              } @else {
                <span class="text-[13px] font-bold text-on-surface-variant">{{ employee().initials }}</span>
              }
            </div>
            <div class="min-w-0">
              @if (employee().contractLabel) {
                <span class="emp-card__ref">{{ employee().contractLabel }}</span>
              }
              <h5 class="emp-card__name">{{ employee().fullName }}</h5>
            </div>
          </div>
        </div>

        <!-- Info rows -->
        <div class="emp-card__body">
          <div class="emp-card__row">
            <span class="emp-card__row-label">{{ 'HOME.EMPLOYEE_CARD.ROLE' | translate }}</span>
            <span class="emp-card__row-val truncate">
              {{ employee().discipline ?? employee().poste ?? '—' }}{{ employee().department ? ' • ' + employee().department : '' }}
            </span>
          </div>
          <div class="emp-card__row emp-card__row--last">
            <span class="emp-card__row-label">{{ 'HOME.EMPLOYEE_CARD.START_DATE' | translate }}</span>
            <span class="emp-card__row-val emp-card__row-val--teal">{{ employee().startDate }}</span>
          </div>
        </div>

        <!-- Onboarding file — one bar per wizard step, documents last. A section at
             0 is red, partial is amber, complete is teal, so RH can see at a glance
             which step still needs infos or docs. -->
        <div class="emp-card__progress">
          <div class="flex items-center gap-3 mb-2.5">
            <div class="min-w-0 flex-1">
              <p class="emp-card__progress-title">
                {{ 'HOME.EMPLOYEE_CARD.ONBOARDING_PROGRESS' | translate }}
              </p>
              <span class="emp-card__progress-count"
                    [class.emp-card__progress-count--ok]="isComplete()">
                {{ totalFilled() }}/{{ totalRequired() }}
              </span>
            </div>

            <!-- Completion ring, with the percentage centred inside it. The colour is
                 an inline STYLE, not a Tailwind class — a runtime-assembled class is
                 never emitted (UI-PLAYBOOK §3), and this hue is continuous anyway.
                 The label is a sibling of the svg, not a child, so the svg's -90deg
                 rotation doesn't tip the text over with it. -->
            <div class="emp-card__ring-wrap">
              <svg class="emp-card__ring" viewBox="0 0 44 44" aria-hidden="true">
                <circle cx="22" cy="22" [attr.r]="RING_RADIUS" fill="none"
                        stroke="var(--color-surface-container-high)" stroke-width="4" />
                <circle cx="22" cy="22" [attr.r]="RING_RADIUS" fill="none"
                        stroke-width="4" stroke-linecap="round"
                        [style.stroke]="RING_COLOR"
                        [attr.stroke-dasharray]="ringCircumference"
                        [attr.stroke-dashoffset]="ringOffset()" />
              </svg>
              <span class="emp-card__ring-value" [style.color]="RING_COLOR">
                {{ completionPct() }}%
              </span>
            </div>
          </div>

          <!-- Odd section counts leave the last bar alone on a row, so let it span
               both columns rather than sit in a half-width column next to nothing. -->
          <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
            @for (section of employee().sections; track section.key; let last = $last) {
              <daf-progress-bar
                [class.col-span-2]="last && spansFullWidth()"
                [label]="section.label + ' · ' + section.filled + '/' + section.total"
                [value]="section.filled"
                [options]="sectionOptions(section)" />
            }
          </div>
        </div>

        <!-- Footer — same markup, classes and hover behaviour as daf-entity-card's:
             collapsed to h-0 until hover, click stops propagation. -->
        <div class="flex items-center justify-between pt-3 border-t border-white/20 transition-all duration-100 overflow-hidden"
             [class.opacity-0]="!hovered()"
             [class.opacity-100]="hovered()"
             [class.h-0]="!hovered()"
             [class.pointer-events-none]="!hovered()">
          <div></div>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:text-secondary transition-colors"
            (click)="$event.stopPropagation(); viewProfile.emit(employee().profileId)">
            {{ 'HOME.EMPLOYEE_CARD.VIEW_PROFILE' | translate }}
            <span class="material-symbols-outlined"
                  style="font-size:14px;font-variation-settings:'FILL' 0,'wght' 500,'GRAD' 0,'opsz' 24">
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    </daf-card>
  `,
  styles: [`
    /* The "section complete" progress bars use daf-progress-bar's 'tertiary'
       variant, which resolves to background-color: var(--color-tertiary).
       ProgressBarOptions has no custom-colour input, so retint the token scoped to
       this host instead — the documented override mechanism (UI-PLAYBOOK §4:
       overriding an existing lib token works because the utility reads the var at
       runtime). Safe to scope here because 'tertiary' is used for nothing else
       inside this card; the partial/empty bars are warning/danger. */
    :host {
      --color-tertiary: #9BCEC1;
    }

    .emp-card {
      position: relative;
      overflow: hidden;
      padding: 20px;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      height: 100%;
    }

    .emp-card__badge-pos {
      position: absolute;
      top: 12px;
      right: 12px;
    }

    .emp-card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      margin-top: 20px;
    }

    .emp-card__id-block { display: flex; align-items: center; gap: 10px; }

    .emp-card__avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid #79D7BE;
      overflow: hidden;
      flex-shrink: 0;
      background: var(--color-surface-container);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .emp-card__ref {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #006b58;
      margin-bottom: 2px;
    }

    .emp-card__name {
      font-size: 14px;
      font-weight: 700;
      line-height: 20px;
      color: var(--color-on-surface);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    .emp-card__body { display: flex; flex-direction: column; gap: 10px; flex: 1; margin-bottom: 16px; }

    .emp-card__row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--color-surface-container);
    }

    .emp-card__row--last { border-bottom: none; padding-bottom: 0; }

    .emp-card__row-label { font-size: 11px; font-weight: 400; color: var(--color-outline); flex-shrink: 0; }

    .emp-card__row-val {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-on-surface);
      text-align: right;
    }

    .emp-card__row-val--teal { color: #006b58; font-weight: 700; font-size: 12px; }

    .emp-card__progress { margin-bottom: 4px; }

    .emp-card__ring-wrap {
      position: relative;
      width: 48px;
      height: 48px;
      flex-shrink: 0;
    }

    .emp-card__ring {
      width: 100%;
      height: 100%;
      /* -90deg so the arc starts at 12 o'clock instead of 3 o'clock. */
      transform: rotate(-90deg);

      circle:last-child {
        transition: stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1), stroke 300ms;
      }
    }

    .emp-card__ring-value {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.02em;
      /* Fallback only — the template sets the colour inline from RING_COLOR so the
         label always matches the arc. Kept so the label is never unstyled if that
         binding is ever removed. */
      color: var(--color-on-surface);
    }

    .emp-card__progress-title {
      margin: 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--color-outline);
    }

    .emp-card__progress-count {
      font-size: 11px;
      font-weight: 700;
      color: var(--color-on-surface);
      white-space: nowrap;
    }

    .emp-card__progress-count--ok { color: #006b58; }
  `],
})
export class EmployeeCardComponent {
  readonly employee     = input.required<EmployeeCardData>();
  readonly avatarFailed = signal(false);
  readonly viewProfile  = output<number | null>();
  readonly getAvatarUrl = getAvatarUrl;

  /** Mirrors daf-entity-card: the footer is driven by a hover signal, not CSS :hover. */
  readonly hovered = signal(false);

  readonly totalFilled   = computed(() => this.sum(s => s.filled));
  readonly totalRequired = computed(() => this.sum(s => s.total));
  readonly isComplete    = computed(() => this.totalFilled() >= this.totalRequired());

  // ── Completion ring ────────────────────────────────────────────────────────
  /** Radius inside the 44×44 viewBox, leaving room for the 4px stroke. */
  protected readonly RING_RADIUS = 18;
  protected readonly ringCircumference = 2 * Math.PI * this.RING_RADIUS;

  /** True when the section count is odd, i.e. the last bar has no row partner. */
  protected readonly spansFullWidth = computed(() => this.employee().sections.length % 2 === 1);

  readonly completionPct = computed(() => {
    const total = this.totalRequired();
    return total === 0 ? 0 : Math.round((this.totalFilled() / total) * 100);
  });

  /** Dash offset draws the arc: full circumference = empty, 0 = complete. */
  protected readonly ringOffset = computed(() =>
    this.ringCircumference * (1 - this.completionPct() / 100),
  );

  /**
   * Fixed ring colour, applied to BOTH the arc and the centred percentage label.
   * Replaced a continuous hue ramp (`hsl(pct × 1.2, 68%, 40%)`, red → amber →
   * green), so the ring no longer encodes completion in its colour — only in its
   * arc length.
   *
   * Note the label is intentionally this same light sage: it's a deliberate design
   * choice, not an oversight. The old ramp pinned lightness to 40% so one value
   * could serve as both stroke and readable text; this value trades that legibility
   * for the matching look. If the 11px label ever needs to read more strongly,
   * darken it here rather than reintroducing a separate token.
   */
  protected readonly RING_COLOR = '#A5CF83';

  /** Red at zero, amber while partial, tertiary once the section is fully filled. */
  sectionOptions(section: EmployeeCardSection): ProgressBarOptions {
    return {
      max:         Math.max(1, section.total),
      size:        'xs',
      showPercent: false,
      variant:     section.filled === 0              ? 'danger'
                 : section.filled >= section.total   ? 'tertiary'
                 : 'warning',
    };
  }

  private sum(pick: (s: EmployeeCardSection) => number): number {
    return this.employee().sections.reduce((total, s) => total + pick(s), 0);
  }
}
