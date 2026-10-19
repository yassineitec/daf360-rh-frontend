import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BarChartBar, BarChartComponent, StatusBadgeComponent,
} from '@khalilrebhiitec/daf360';
import { AgeBreakdown, WorkforceData } from '../../services/home.service';
import {
  DONUT_COLORS, DONUT_NEUTRAL, DonutChartComponent, DonutSegment,
} from '../donut-chart/donut-chart.component';

export type WorkforceDetailCard = 'workforce' | 'ingproj' | 'seniority';

interface Kpi {
  icon:     string;
  value:    string | number;
  labelKey: string;
  /** Range shown after the label, e.g. "0 à 4 ans". */
  hintKey?: string;
  /** Share shown next to the value. */
  pct?:     number;
  /** Group this tile selects for the age section — makes the tile clickable. */
  group?:   AgeGroup;
}

/** Keys of `WorkforceData.groupAges` — one per clickable tile. */
type AgeGroup =
  | 'femmes' | 'hommes'
  | 'ingenieurs' | 'projeteurs' | 'autres'
  | 'juniors' | 'confirmes' | 'seniors';

/** Group name in the age section's title, e.g. "Tranches d'âge — Senior". */
const GROUP_TITLE_KEYS: Record<AgeGroup, string> = {
  femmes:     'HOME.DETAIL.WOMEN',
  hommes:     'HOME.DETAIL.MEN',
  ingenieurs: 'HOME.ENGINEER_PRO_STATS.ENGINEER',
  projeteurs: 'HOME.ENGINEER_PRO_STATS.PROJETEUR',
  autres:     'HOME.DETAIL.OTHER_GRADES',
  juniors:    'HOME.SENIORITY_STATS.JUNIOR',
  confirmes:  'HOME.SENIORITY_STATS.CONFIRME',
  seniors:    'HOME.SENIORITY_STATS.SENIOR',
};

/** "Click a tile…" hint under the age title, per card. */
const AGE_HINT_KEYS: Record<WorkforceDetailCard, string> = {
  workforce: 'HOME.DETAIL.AGE_HINT_WORKFORCE',
  ingproj:   'HOME.DETAIL.AGE_HINT_INGPROJ',
  seniority: 'HOME.DETAIL.AGE_LEVEL_HINT',
};
interface Row   extends DonutSegment { pct: number; hint?: string; }

/**
 * Body of the workforce-card pop-up on /rh/accueil: KPI tiles, a segmented ring with
 * its legend, and one extra library chart per card —
 *   workforce → effectif par pays (daf-bar-chart, horizontal)
 *   ingproj   → nothing more: its ring already shows both groups
 *   seniority → nothing more: its ring already shows the brackets
 *
 * Text never wears a series colour: values and labels stay in text tokens, the coloured
 * dot beside them carries the identity. Every segment is labelled in the legend with its
 * count and share, so nothing is told by colour alone.
 */
@Component({
  selector: 'rh-workforce-detail',
  standalone: true,
  host: { class: 'block' },
  imports: [TranslatePipe, DonutChartComponent, BarChartComponent, StatusBadgeComponent],
  template: `
    @if (base() === 0) {
      <div class="flex flex-col items-center gap-2 py-10 text-center text-on-surface-variant">
        <span class="material-symbols-outlined text-[40px] text-outline-variant">group_off</span>
        <p class="text-body-md">{{ 'HOME.DETAIL.EMPTY' | translate }}</p>
      </div>
    } @else {
      <!-- KPI tiles. A tile with a group is a toggle: it narrows the "Tranches d'âge"
           section below to that group; a second click lifts it. -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        @for (k of kpis(); track k.labelKey) {
          <div class="flex items-center gap-3 rounded-2xl border bg-surface-container-low px-4 py-3 transition-colors"
               [class.border-outline-variant/50]="selectedGroup() !== k.group || !k.group"
               [class.border-teal]="k.group && selectedGroup() === k.group"
               [class.ring-2]="k.group && selectedGroup() === k.group"
               [class.ring-teal/20]="k.group && selectedGroup() === k.group"
               [class.cursor-pointer]="!!k.group"
               [class.hover:border-teal/60]="!!k.group"
               [attr.role]="k.group ? 'button' : null"
               [attr.tabindex]="k.group ? 0 : null"
               [attr.aria-pressed]="k.group ? selectedGroup() === k.group : null"
               (click)="toggleGroup(k.group)" (keydown.enter)="toggleGroup(k.group)">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal">
              <span class="material-symbols-outlined text-[20px]">{{ k.icon }}</span>
            </span>
            <div class="min-w-0">
              <p class="text-headline-md font-bold leading-tight text-on-surface">
                {{ k.value }}
                @if (k.pct != null) {
                  <span class="text-label-sm font-semibold text-on-surface-variant">{{ k.pct }} %</span>
                }
              </p>
              <p class="truncate text-label-sm text-on-surface-variant"
                 [attr.title]="k.hintKey ? (k.labelKey | translate) + ' · ' + (k.hintKey | translate) : null">
                {{ k.labelKey | translate }}
                @if (k.hintKey) { <span class="text-outline"> · {{ k.hintKey | translate }}</span> }
              </p>
            </div>
          </div>
        }
      </div>

      <!-- Ring + legend -->
      <div class="mt-5 flex flex-col items-center gap-6 rounded-2xl border border-outline-variant/50 p-5 sm:flex-row">
        <rh-donut-chart
          class="shrink-0"
          [segments]="rows()"
          [highlight]="hoveredRow()"
          [centerLabel]="centerLabelKey() | translate"
          [ariaLabel]="(titleKey() | translate) + ' — ' + base()" />

        <ul class="flex w-full min-w-0 flex-col gap-3">
          @for (r of rows(); track r.key) {
            <li class="rounded-xl px-2 py-1.5 transition-colors"
                [class.bg-surface-container-low]="hoveredRow() === r.key"
                (mouseenter)="hoveredRow.set(r.key)" (mouseleave)="hoveredRow.set(null)">
              <div class="flex items-center gap-2">
                <span class="h-3 w-3 shrink-0 rounded-full" [style.background-color]="r.color"></span>
                <span class="min-w-0 flex-1 truncate text-body-sm font-semibold text-on-surface">
                  {{ r.label }}
                  @if (r.hint) { <span class="font-normal text-outline"> · {{ r.hint }}</span> }
                </span>
                <span class="text-body-sm font-bold text-on-surface">{{ r.value }}</span>
                <span class="w-12 text-right text-label-sm text-on-surface-variant">{{ r.pct }} %</span>
              </div>
              <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container">
                <div class="h-full rounded-full transition-[width] duration-500"
                     [style.width.%]="r.pct" [style.background-color]="r.color"></div>
              </div>
            </li>
          }
        </ul>
      </div>

      <!-- One more view, from the library — Effectif only. The "Répartition par tranche"
           bars were removed from the two other cards on request: their ring + legend
           already show the same categories. -->
      @if (card() === 'workforce' && countryBars().length > 1) {
        <div class="mt-5 rounded-2xl border border-outline-variant/50 p-5">
          <p class="mb-3 text-label-md font-semibold text-on-surface">{{ 'HOME.WORKFORCE_STATS.BY_COUNTRY' | translate }}</p>
          <daf-bar-chart
            [bars]="countryBars()"
            [options]="{ orientation: 'horizontal', variant: 'teal',
                         ariaLabel: ('HOME.WORKFORCE_STATS.BY_COUNTRY' | translate) }" />
        </div>
      }

      <!-- Age brackets — a breakdown, not a filter. Whole headcount (engineers + drafters
           only on that card) until a tile is clicked, then that tile's group only. -->
      @if (age(); as a) {
        <div class="mt-5 rounded-2xl border border-outline-variant/50 p-5">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p class="text-label-md font-semibold text-on-surface">{{ ageTitle() }}</p>
            @if (!a.hidden && a.ageMoyen != null) {
              <daf-badge [label]="'HOME.DETAIL.AGE_AVERAGE' | translate:{ age: a.ageMoyen }"
                         [options]="{ variant: 'teal', icon: 'cake', pill: true }" />
            }
          </div>

          <p class="-mt-1 mb-3 flex flex-wrap items-center gap-1.5 text-label-sm text-outline">
            <span class="material-symbols-outlined text-[16px]">touch_app</span>
            @if (selectedGroup()) {
              {{ 'HOME.DETAIL.AGE_LEVEL_RESET' | translate }}
              <button type="button" class="font-semibold text-teal underline-offset-2 hover:underline"
                      (click)="selectedGroup.set(null)">{{ 'HOME.DETAIL.AGE_SHOW_ALL' | translate }}</button>
            } @else {
              {{ ageHintKey() | translate }}
            }
          </p>

          @if (a.total === 0) {
            <p class="text-body-sm text-on-surface-variant">{{ 'HOME.DETAIL.AGE_LEVEL_EMPTY' | translate }}</p>
          } @else if (a.hidden) {
            <!-- Under 5 people: brackets withheld server side, they'd reveal each age. -->
            <div class="flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-3 text-body-sm text-on-surface-variant">
              <span class="material-symbols-outlined text-[18px]">lock</span>
              {{ 'HOME.DETAIL.AGE_HIDDEN' | translate }}
            </div>
          } @else if (a.total > a.nonRenseigne) {
            <daf-bar-chart
              [bars]="ageBars()"
              [options]="{ height: '150px', variant: 'teal',
                           ariaLabel: ageTitle() }" />
          } @else {
            <p class="text-body-sm text-on-surface-variant">{{ 'HOME.DETAIL.AGE_NONE' | translate }}</p>
          }

          @if (!a.hidden && a.nonRenseigne > 0) {
            <p class="mt-3 text-label-sm text-outline">
              {{ 'HOME.DETAIL.AGE_MISSING' | translate:{ n: a.nonRenseigne, total: a.total } }}
            </p>
          }
        </div>
      }
    }
  `,
})
export class WorkforceDetailComponent {
  private translate = inject(TranslateService);

  readonly card = input.required<WorkforceDetailCard>();
  readonly data = input.required<WorkforceData>();

  /** Legend row under the pointer — mirrored on the ring. */
  protected readonly hoveredRow = signal<string | null>(null);

  private t(key: string): string { return this.translate.instant(key); }

  protected readonly titleKey = computed(() => ({
    workforce: 'HOME.WORKFORCE_STATS.LABEL',
    ingproj:   'HOME.ENGINEER_PRO_STATS.LABEL',
    seniority: 'HOME.SENIORITY_STATS.LABEL',
  })[this.card()]);

  protected readonly techTotal = computed(() => this.data().ingenieurs + this.data().projeteurs);

  /** What the ring's 100 % is: the headcount, or ingénieurs + projeteurs. */
  protected readonly base = computed(() => {
    const d = this.data();
    return this.card() === 'ingproj' ? this.techTotal() : d.totalActifs;
  });

  protected readonly centerLabelKey = computed(() =>
    this.card() === 'ingproj' ? 'HOME.DETAIL.TECH_PROFILES' : 'HOME.WORKFORCE_STATS.ACTIVE_EMPLOYEES');

  protected readonly rows = computed<Row[]>(() => {
    const d = this.data();
    const [c1, c2, c3] = DONUT_COLORS;
    let segs: (DonutSegment & { hint?: string })[];
    switch (this.card()) {
      case 'workforce':
        segs = [
          { key: 'f', label: this.t('HOME.DETAIL.WOMEN'), value: d.femmes,    color: c1 },
          { key: 'm', label: this.t('HOME.DETAIL.MEN'),   value: d.hommes,    color: c2 },
          { key: 'n', label: this.t('HOME.DETAIL.NOT_DEFINED'),     value: d.nonDefini, color: DONUT_NEUTRAL },
        ];
        break;
      case 'ingproj':
        segs = [
          { key: 'ing',  label: this.t('HOME.ENGINEER_PRO_STATS.ENGINEER'),  value: d.ingenieurs, color: c1, hint: 'EN1 – EN8' },
          { key: 'proj', label: this.t('HOME.ENGINEER_PRO_STATS.PROJETEUR'), value: d.projeteurs, color: c2, hint: 'BC1 – BC5' },
        ];
        break;
      default:
        segs = [
          { key: 'jr', label: this.t('HOME.SENIORITY_STATS.JUNIOR'),   value: d.juniors,   color: c1, hint: this.t('HOME.SENIORITY_STATS.JUNIOR_RANGE') },
          { key: 'cf', label: this.t('HOME.SENIORITY_STATS.CONFIRME'), value: d.confirmes, color: c2, hint: this.t('HOME.SENIORITY_STATS.CONFIRME_RANGE') },
          { key: 'sr', label: this.t('HOME.SENIORITY_STATS.SENIOR'),   value: d.seniors,   color: c3, hint: this.t('HOME.SENIORITY_STATS.SENIOR_RANGE') },
          { key: 'nd', label: this.t('HOME.DETAIL.NO_HIRE_DATE'),      value: d.ancienneteNonDefinie, color: DONUT_NEUTRAL },
        ];
    }
    const total = segs.reduce((s, x) => s + x.value, 0);
    return segs
      // An empty "non défini" row is noise; an empty real category is information.
      .filter(s => s.value > 0 || s.color !== DONUT_NEUTRAL)
      .map(s => ({ ...s, pct: total ? Math.round((s.value / total) * 1000) / 10 : 0 }));
  });

  protected readonly kpis = computed<Kpi[]>(() => {
    const d = this.data();
    switch (this.card()) {
      case 'workforce':
        // Féminin / Masculin are clickable; the country count is context only.
        return [
          { icon: 'female', value: d.femmes, labelKey: 'HOME.DETAIL.WOMEN',
            pct: d.pctFemmes, group: 'femmes' },
          { icon: 'male',   value: d.hommes, labelKey: 'HOME.DETAIL.MEN',
            pct: d.pctHommes, group: 'hommes' },
          { icon: 'public', value: d.byCountry.length, labelKey: 'HOME.DETAIL.COUNTRIES' },
        ];
      case 'ingproj':
        return [
          { icon: 'engineering',  value: d.ingenieurs, labelKey: 'HOME.ENGINEER_PRO_STATS.ENGINEER',
            hintKey: 'HOME.DETAIL.GRADES_EN', pct: d.pctIngenieurs, group: 'ingenieurs' },
          { icon: 'architecture', value: d.projeteurs, labelKey: 'HOME.ENGINEER_PRO_STATS.PROJETEUR',
            hintKey: 'HOME.DETAIL.GRADES_BC', pct: d.pctProjeteurs, group: 'projeteurs' },
          { icon: 'person_off',   value: Math.max(0, d.totalActifs - this.techTotal()),
            labelKey: 'HOME.DETAIL.OTHER_GRADES', group: 'autres' },
        ];
      default:
        return [
          // One tile per bracket, same figures and same % as the legend below.
          { icon: 'school',        value: d.juniors,   labelKey: 'HOME.SENIORITY_STATS.JUNIOR',
            hintKey: 'HOME.SENIORITY_STATS.JUNIOR_RANGE',   pct: d.pctJuniors,   group: 'juniors' },
          { icon: 'workspace_premium', value: d.confirmes, labelKey: 'HOME.SENIORITY_STATS.CONFIRME',
            hintKey: 'HOME.SENIORITY_STATS.CONFIRME_RANGE', pct: d.pctConfirmes, group: 'confirmes' },
          { icon: 'military_tech', value: d.seniors,   labelKey: 'HOME.SENIORITY_STATS.SENIOR',
            hintKey: 'HOME.SENIORITY_STATS.SENIOR_RANGE',   pct: d.pctSeniors,   group: 'seniors' },
        ];
    }
  });

  protected readonly countryBars = computed<BarChartBar[]>(() =>
    this.data().byCountry.map(c => ({
      label:      c.label ?? this.t('HOME.WORKFORCE_STATS.COUNTRY_UNKNOWN'),
      value:      c.count,
      valueLabel: String(c.count),
    })));


  /**
   * Group whose tile was clicked — narrows the age section to that group. Kept across
   * country/department changes: the new figures carry every group. The pop-up body is
   * rebuilt on each opening, so a new card always starts unselected.
   */
  readonly selectedGroup = signal<AgeGroup | null>(null);

  protected toggleGroup(group: AgeGroup | undefined): void {
    if (!group) return;
    this.selectedGroup.set(this.selectedGroup() === group ? null : group);
  }

  protected readonly ageHintKey = computed(() => AGE_HINT_KEYS[this.card()]);

  /**
   * Age brackets shown on this card; null when the backend didn't send any. A picked
   * group is returned even when empty, so the section can say "nobody in this group"
   * instead of vanishing under the click.
   */
  protected readonly age = computed<AgeBreakdown | null>(() => {
    const d = this.data();
    const group = this.selectedGroup();
    if (group) return d.groupAges?.[group] ?? null;
    const a = this.card() === 'ingproj' ? d.techAges : d.ages;
    return a && a.total > 0 ? a : null;
  });

  protected readonly ageTitle = computed(() => {
    const group = this.selectedGroup();
    if (group) {
      return this.translate.instant('HOME.DETAIL.AGE_TITLE_LEVEL', { level: this.t(GROUP_TITLE_KEYS[group]) });
    }
    return this.t(this.card() === 'ingproj' ? 'HOME.DETAIL.AGE_TITLE_TECH' : 'HOME.DETAIL.AGE_TITLE');
  });

  protected readonly ageBars = computed<BarChartBar[]>(() => {
    const a = this.age();
    if (!a) return [];
    const bars = [
      { key: 'AGE_LT25',  value: a.moins25 },
      { key: 'AGE_25_34', value: a.de25a34 },
      { key: 'AGE_35_44', value: a.de35a44 },
      { key: 'AGE_45_54', value: a.de45a54 },
      { key: 'AGE_55',    value: a.plus55 },
    ];
    const max = Math.max(...bars.map(b => b.value));
    return bars.map(b => ({
      label:      this.t(`HOME.DETAIL.${b.key}`),
      value:      b.value,
      valueLabel: String(b.value),
      highlight:  max > 0 && b.value === max,
    }));
  });
}
