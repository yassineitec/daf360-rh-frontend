import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Holiday } from './models/admin.model';
import { FLAG_SVGS } from './flag-svgs';

interface HolidayCalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  holiday: Holiday | null;
}

const WEEKDAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * Month-grid calendar for the "Jours fériés" admin page — reproduces the portal's own
 * /home calendar design (glass panel, 3D tilt-on-hover card, neu-pressed pill month
 * navigator, gradient "today" cell) using this app's own colour tokens, since that
 * original is a one-off component in daf360-shell, not part of the shared
 * @khalilrebhiitec/daf360 library. Unlike a generic multi-type event calendar, a day
 * here has at most one holiday, so clicking it either opens "Ajouter" (empty day) or
 * "Modifier" (day already marked) — both handled by the parent's existing modal.
 */
@Component({
  selector: 'app-holiday-calendar',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="hc-wrap">
      <div class="hc-topbar">
        <div class="hc-nav-pill">
          <button type="button" class="hc-nav-btn" [title]="'ADMIN.catalog.holidays.calendar.prevMonth' | translate" (click)="prevMonth()">
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <span class="hc-month-label">{{ monthLabel() }}</span>
          <button type="button" class="hc-nav-btn" [title]="'ADMIN.catalog.holidays.calendar.nextMonth' | translate" (click)="nextMonth()">
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      <div class="hc-card">
        <div class="hc-grid hc-grid-header">
          @for (d of dayHeaders(); track $index) {
            <div class="hc-day-header">{{ d }}</div>
          }
        </div>

        @for (week of weeks(); track $index) {
          <div class="hc-grid">
            @for (day of week; track day.date.getTime()) {
              <div [class]="dayClasses(day)" (click)="onDayClick(day)">
                @if (!day.isCurrentMonth) {
                  <span class="hc-daynum hc-daynum-outside">{{ day.dayNumber }}</span>
                } @else {
                  <span class="hc-daynum" [class.hc-daynum-today]="day.isToday">{{ day.dayNumber }}</span>
                  @if (day.holiday) {
                    <span class="hc-holiday-bar" [title]="day.holiday.frenchLabel">
                      @if (flagDataUri(); as uri) {
                        <img class="hc-holiday-flag" [src]="uri" [alt]="flagCode()" />
                      }
                      <span class="hc-holiday-abbrev">{{ 'ADMIN.catalog.holidays.calendar.abbrev' | translate }}</span>
                    </span>
                  }
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .hc-wrap        { display:flex;flex-direction:column;gap:16px }
    .hc-topbar      { display:flex;align-items:center;justify-content:center }

    /* Neu-pressed glass pill around the month navigator — same recipe as /home's own
       calendar (glass-panel + inset shadow), built on this app's tokens. */
    .hc-nav-pill {
      display:flex;align-items:center;gap:2px;padding:4px;border-radius:999px;
      background:color-mix(in srgb, var(--color-surface) 75%, transparent);
      backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
      border:1px solid var(--color-border);
      box-shadow:inset 2px 2px 5px rgba(0,0,0,.05), inset -2px -2px 5px rgba(255,255,255,.6);
    }
    .hc-nav-btn     { display:flex;align-items:center;justify-content:center;width:32px;height:32px;border:none;border-radius:999px;background:transparent;color:var(--color-text-muted);cursor:pointer;transition:background .15s ease }
    .hc-nav-btn:hover { background:var(--color-bg-secondary);color:var(--color-text) }
    .hc-month-label { min-width:150px;text-align:center;font-size:14px;font-weight:700;text-transform:capitalize;color:var(--color-text) }

    /* Glass card with a subtle 3D tilt that resets on hover — same signature as /home. */
    .hc-card {
      border-radius:18px;overflow:hidden;border:1px solid var(--color-border);
      background:color-mix(in srgb, var(--color-surface) 80%, transparent);
      backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
      box-shadow:0 20px 45px -20px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.4);
      transform:rotateX(1.4deg) rotateY(-1.4deg);transform-style:preserve-3d;
      transition:transform .5s ease;
    }
    .hc-card:hover  { transform:rotateX(0) rotateY(0) }

    .hc-grid        { display:grid;grid-template-columns:repeat(7,1fr) }
    .hc-grid-header {
      border-bottom:1px solid var(--color-border);
      background:color-mix(in srgb, var(--color-bg-secondary) 65%, transparent);
      backdrop-filter:blur(8px);
    }
    .hc-day-header  { padding:9px 0;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted) }

    .hc-cell        { position:relative;min-height:88px;padding:8px;border-right:1px solid var(--color-border);border-bottom:1px solid var(--color-border);cursor:pointer;transition:background .15s ease }
    .hc-cell:hover  { background:color-mix(in srgb, var(--color-surface) 40%, transparent) }
    .hc-cell-outside { cursor:default;opacity:.35;background:var(--color-bg-secondary) }
    /* Diagonal tint + inset shadow, same "today" treatment as /home's calendar. */
    .hc-cell-today {
      background:linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 10%, transparent) 0%, transparent 60%);
      box-shadow:inset 3px 3px 8px color-mix(in srgb, var(--color-primary) 12%, transparent), inset 1px 1px 0 color-mix(in srgb, var(--color-primary) 15%, transparent);
    }
    .hc-cell-selected {
      background:color-mix(in srgb, var(--color-primary) 8%, transparent);
      box-shadow:inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 28%, transparent);
    }

    .hc-daynum        { display:block;margin-bottom:4px;font-size:12px;font-weight:600;color:var(--color-text) }
    .hc-daynum-outside { color:var(--color-text-muted);font-weight:500 }
    .hc-daynum-today  { font-size:14px;font-weight:800;color:var(--color-primary) }

    /* Bottom bar of the day frame — flag on the left, "JF"/"PH" abbreviation on the right.
       Flags come from FLAG_SVGS (flag-svgs.ts) as inline data URIs, not a static asset
       path or CSS/font dependency — see that file for why. */
    .hc-holiday-bar    { position:absolute;left:6px;right:6px;bottom:5px;display:flex;align-items:center;justify-content:space-between;gap:4px;transition:transform .15s ease }
    .hc-holiday-bar:hover { transform:scale(1.04) }
    .hc-holiday-flag   { width:16px;height:12px;object-fit:cover;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.08);flex-shrink:0 }
    .hc-holiday-abbrev { font-size:10px;font-weight:700;letter-spacing:.03em;color:#b45309;background:rgba(217,119,6,.12);padding:1px 5px;border-radius:5px }

    @media (max-width: 700px) {
      .hc-cell         { min-height:56px;padding:5px }
      .hc-holiday-bar  { left:3px;right:3px;bottom:3px }
      .hc-holiday-flag { width:13px;height:10px }
    }
  `],
})
export class HolidayCalendarComponent {
  private translate = inject(TranslateService);

  holidays = input<Holiday[]>([]);
  paysIsoCode = input('');

  /** Empty day clicked — parent opens "Ajouter" prefilled with this date. */
  dayClick = output<Date>();
  /** Already-marked day clicked — parent opens it for editing. */
  holidayClick = output<Holiday>();

  readonly viewYear  = signal(new Date().getFullYear());
  readonly viewMonth = signal(new Date().getMonth());
  readonly selectedDay = signal<Date | null>(null);

  readonly dayHeaders = computed(() => {
    this.translate.currentLang();
    return WEEKDAY_KEYS.map(d => this.translate.instant(`ADMIN.catalog.holidays.calendar.days.${d}`));
  });

  readonly monthLabel = computed(() => {
    const lang = this.translate.currentLang() ?? 'fr';
    return new Date(this.viewYear(), this.viewMonth(), 1).toLocaleDateString(lang, { month: 'long', year: 'numeric' });
  });

  private readonly holidayByIso = computed(() => {
    const map = new Map<string, Holiday>();
    for (const h of this.holidays()) map.set(h.dateHoliday, h);
    return map;
  });

  private toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Lowercase ISO 3166-1 alpha-2 — key into FLAG_SVGS. */
  flagCode(): string {
    return this.paysIsoCode().toLowerCase();
  }

  /** Inline data URI for the current country's flag, or '' if not in FLAG_SVGS. */
  flagDataUri(): string {
    const svg = FLAG_SVGS[this.flagCode()];
    return svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : '';
  }

  private buildDay(date: Date, isCurrentMonth: boolean, todayIso: string): HolidayCalendarDay {
    const iso = this.toIso(date);
    return {
      date,
      dayNumber: date.getDate(),
      isCurrentMonth,
      isToday: isCurrentMonth && iso === todayIso,
      holiday: isCurrentMonth ? (this.holidayByIso().get(iso) ?? null) : null,
    };
  }

  readonly weeks = computed<HolidayCalendarDay[][]>(() => {
    const year  = this.viewYear();
    const month = this.viewMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = this.toIso(today);

    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const startOff = firstDay.getDay();
    const days: HolidayCalendarDay[] = [];

    for (let i = startOff; i > 0; i--) days.push(this.buildDay(new Date(year, month, 1 - i), false, todayIso));
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(this.buildDay(new Date(year, month, d), true, todayIso));

    const remainder = days.length % 7;
    if (remainder !== 0) {
      for (let i = 1; i <= 7 - remainder; i++) days.push(this.buildDay(new Date(year, month + 1, i), false, todayIso));
    }

    const rows: HolidayCalendarDay[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  });

  prevMonth(): void {
    if (this.viewMonth() === 0) { this.viewMonth.set(11); this.viewYear.update(y => y - 1); }
    else this.viewMonth.update(m => m - 1);
  }

  nextMonth(): void {
    if (this.viewMonth() === 11) { this.viewMonth.set(0); this.viewYear.update(y => y + 1); }
    else this.viewMonth.update(m => m + 1);
  }

  isSelected(day: HolidayCalendarDay): boolean {
    const sel = this.selectedDay();
    return !!sel && sel.getTime() === day.date.getTime();
  }

  dayClasses(day: HolidayCalendarDay): string {
    if (!day.isCurrentMonth) return 'hc-cell hc-cell-outside';
    if (this.isSelected(day)) return 'hc-cell hc-cell-selected';
    if (day.isToday) return 'hc-cell hc-cell-today';
    return 'hc-cell';
  }

  onDayClick(day: HolidayCalendarDay): void {
    if (!day.isCurrentMonth) return;
    this.selectedDay.set(day.date);
    if (day.holiday) this.holidayClick.emit(day.holiday);
    else this.dayClick.emit(day.date);
  }
}
