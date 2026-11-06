import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, DafCellDirective, DataTableComponent, FormFieldComponent,
  StatusBadgeComponent, TableColumn, TableConfig, TableRow, TimePickerComponent, ToggleComponent,
  type TimePickerValue,
} from '@khalilrebhiitec/daf360';

import { environment } from '../../../environments/environment';
import { ModalComponent } from '../../shared/modal.component';
import { TableActionComponent } from '../../shared/table-action.component';
import { NotificationService } from '../../core/notification.service';
import { formatMinutes } from '../autorisations/autorisation-display';

/** One entity's rules, as /api/hr/autorisations/admin/rules returns them. */
interface RulesRow {
  paysId: number;
  frenchLabel: string | null;
  englishLabel: string | null;
  isoCode: string | null;
  employees: number;
  dailyCapMinutes: number | null;
  monthlyCapMinutes: number | null;
  maxPerDay: number | null;
  noticeDays: number | null;
  requiresJustification: boolean;
}

/**
 * Administration → Autorisations : the quotas, per entity.
 *
 * WHY THIS SCREEN EXISTS AT ALL
 * -----------------------------------------------------------------------------
 * The timesheet hardcoded 120 minutes a day and 240 a month — and wrote 240 twice, once in
 * the refusal and once in the figure it showed the employee. Changing either meant a deploy,
 * and changing one without the other meant the two disagreed. They are rows now.
 *
 * AN EMPTY FIELD MEANS « AUCUNE LIMITE », AND THE FORM SAYS SO.
 * -----------------------------------------------------------------------------
 * null is a real configuration: an entity that does not cap autorisations. Zero is not — it
 * would refuse every request, and nobody could tell it from a value somebody forgot to set.
 * The service refuses a zero for exactly that reason, so the hint here is not decoration.
 *
 * ONLY ENTITIES THAT MATTER are listed — those with people, or already configured. The
 * reference table holds every ISO country; 194 rows to reach the two you operate in is a
 * worse screen than one showing those two. Scoped server-side by the role's pays perimeter,
 * so the list can never offer an entity the save would refuse.
 */
@Component({
  selector: 'app-autorisation-rules-admin',
  standalone: true,
  imports: [
    DataTableComponent, DafCellDirective, StatusBadgeComponent, ButtonComponent,
    ModalComponent, FormFieldComponent, ToggleComponent, TableActionComponent, TranslatePipe,
    TimePickerComponent,
  ],
  template: `
    <div class="flex min-w-0 flex-col gap-4">

      <p class="text-body-sm text-on-surface-variant">
        {{ 'ADMIN.autorisationRules.intro' | translate }}
      </p>

      @if (error()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>{{ error() }}
        </div>
      }

      <daf-data-table [columns]="columns()" [rows]="tableRows()" [config]="config()">

        <!-- « Aucune limite » is a state, not a blank. Showing an empty cell for it would
             read as missing data rather than as a deliberate configuration. -->
        <ng-template dafCell="daily" let-row>
          @if (row['_s'].dailyCapMinutes === null) {
            <daf-badge [label]="'ADMIN.autorisationRules.noLimit' | translate"
                       [options]="{ variant: 'neutral', size: 'sm' }" />
          } @else {
            <span>{{ fmt(row['_s'].dailyCapMinutes) }}</span>
          }
        </ng-template>

        <ng-template dafCell="monthly" let-row>
          @if (row['_s'].monthlyCapMinutes === null) {
            <daf-badge [label]="'ADMIN.autorisationRules.noLimit' | translate"
                       [options]="{ variant: 'neutral', size: 'sm' }" />
          } @else {
            <span>{{ fmt(row['_s'].monthlyCapMinutes) }}</span>
          }
        </ng-template>

        <ng-template dafCell="perDay" let-row>
          @if (row['_s'].maxPerDay === null) {
            <daf-badge [label]="'ADMIN.autorisationRules.noLimit' | translate"
                       [options]="{ variant: 'neutral', size: 'sm' }" />
          } @else {
            <span>{{ row['_s'].maxPerDay }}</span>
          }
        </ng-template>

        <ng-template dafCell="justif" let-row>
          <daf-badge
            [label]="(row['_s'].requiresJustification ? 'ADMIN.autorisationRules.yes'
                                                      : 'ADMIN.autorisationRules.no') | translate"
            [options]="{ variant: row['_s'].requiresJustification ? 'info' : 'neutral', size: 'sm' }" />
        </ng-template>

        <ng-template dafCell="_actions" let-row>
          <div class="flex items-center justify-end gap-2">
            <rh-table-action id="edit" icon="edit"
                             [tooltip]="'ADMIN.autorisationRules.edit' | translate"
                             (action)="open(row['_s'])" />
          </div>
        </ng-template>
      </daf-data-table>
    </div>

    <app-modal [title]="('ADMIN.autorisationRules.modalTitle' | translate)"
               [visible]="showEdit()" size="md" [hasFooter]="true"
               (closed)="showEdit.set(false)">
      @if (target(); as p) {
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3">
            <div class="flex min-w-0 flex-col">
              <p class="truncate font-semibold">{{ p.frenchLabel ?? p.isoCode }}</p>
              <p class="text-body-sm text-on-surface-variant">
                {{ 'ADMIN.autorisationRules.employees' | translate: { n: p.employees } }}
              </p>
            </div>
            <span class="material-symbols-outlined text-[22px] text-tertiary">rule</span>
          </div>

          <p class="text-body-sm text-on-surface-variant">
            {{ 'ADMIN.autorisationRules.modalIntro' | translate }}
          </p>

          <!-- The two caps are DURATIONS, so daf-time-picker in duration mode: 'both' shows
               "02:00" beside "2 h", which is how an administrator thinks about a quota —
               typing 240 and being trusted to know it means four hours was the old form.
               Reset (×) is how « aucune limite » is expressed: the value goes back to null. -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <daf-time-picker
              [value]="daily()"
              (valueChange)="daily.set($event)"
              [config]="{ label: ('ADMIN.autorisationRules.daily' | translate),
                          placeholder: ('ADMIN.autorisationRules.noLimit' | translate),
                          hint: dailyHint(),
                          error: dailyZero() ? ('ADMIN.autorisationRules.zeroCap' | translate) : undefined,
                          fullWidth: true, display: 'both', maxHours: 12, minuteStep: 5,
                          resetLabel: ('ADMIN.autorisationRules.setNoLimit' | translate),
                          confirmLabel: ('ADMIN.autorisationRules.ok' | translate) }" />
            <daf-time-picker
              [value]="monthly()"
              (valueChange)="monthly.set($event)"
              [config]="{ label: ('ADMIN.autorisationRules.monthly' | translate),
                          placeholder: ('ADMIN.autorisationRules.noLimit' | translate),
                          hint: monthlyHint(),
                          error: monthlyZero() ? ('ADMIN.autorisationRules.zeroCap' | translate) : undefined,
                          fullWidth: true, display: 'both', maxHours: 80, minuteStep: 5,
                          resetLabel: ('ADMIN.autorisationRules.setNoLimit' | translate),
                          confirmLabel: ('ADMIN.autorisationRules.ok' | translate) }" />
          </div>

          <daf-form-field
            [options]="{ label: ('ADMIN.autorisationRules.perDay' | translate), type: 'number',
                         fullWidth: true,
                         hint: ('ADMIN.autorisationRules.emptyMeansNoLimit' | translate) }"
            [value]="perDay()"
            (valueChange)="perDay.set($any($event))" />

          <daf-form-field
            [options]="{ label: ('ADMIN.autorisationRules.notice' | translate), type: 'number',
                         fullWidth: true,
                         hint: ('ADMIN.autorisationRules.noticeHint' | translate) }"
            [value]="notice()"
            (valueChange)="notice.set($any($event))" />

          <daf-toggle [checked]="justif()"
                      [options]="{ label: ('ADMIN.autorisationRules.justif' | translate),
                                   hint: ('ADMIN.autorisationRules.justifHint' | translate) }"
                      (checkedChange)="justif.set($event)" />

          <!-- The one combination the server refuses, said before the save rather than after. -->
          @if (monthlyBelowDaily()) {
            <p class="rounded-lg bg-warning/10 px-3 py-2 text-body-sm">
              {{ 'ADMIN.autorisationRules.monthlyBelowDaily' | translate }}
            </p>
          }

          @if (editError()) { <div class="text-[13px] text-danger">{{ editError() }}</div> }
        </div>
      }
      <div slot="footer">
        <daf-button [label]="('ADMIN.autorisationRules.cancel' | translate)" variant="secondary"
                    (onClick)="showEdit.set(false)" />
        <daf-button [label]="('ADMIN.autorisationRules.save' | translate)" variant="teal"
                    [options]="{ loading: saving(),
                                 disabled: monthlyBelowDaily() || dailyZero() || monthlyZero() }"
                    (onClick)="save()" />
      </div>
    </app-modal>
  `,
})
export class AutorisationRulesAdminComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly notify = inject(NotificationService);
  private readonly base = `${environment.hrApiUrl}/api/hr/autorisations/admin/rules`;

  readonly rows = signal<RulesRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly showEdit = signal(false);
  readonly saving = signal(false);
  readonly editError = signal<string | null>(null);
  readonly target = signal<RulesRow | null>(null);

  // The caps are picker values — null is « aucune limite », and the picker's reset is how an
  // administrator sets it. The two count fields stay numbers: empty string is how a cleared
  // number input says "no limit", and that has to reach the payload as null, not 0.
  readonly daily = signal<TimePickerValue | null>(null);
  readonly monthly = signal<TimePickerValue | null>(null);
  readonly perDay = signal<number | string | null>(null);
  readonly notice = signal<number | string | null>(null);
  readonly justif = signal(false);

  protected readonly fmt = formatMinutes;

  /** The one cross-field rule, checked here so the save button can say so first. */
  readonly monthlyBelowDaily = computed(() => {
    const d = this.minutesOf(this.daily());
    const m = this.minutesOf(this.monthly());
    return d !== null && m !== null && m < d;
  });

  /** 00:00 picked: the server refuses a zero cap, and rightly — it would refuse every request. */
  readonly dailyZero = computed(() => this.minutesOf(this.daily()) === 0);
  readonly monthlyZero = computed(() => this.minutesOf(this.monthly()) === 0);

  /** The hint says what the current value MEANS, so « aucune limite » is never ambiguous. */
  readonly dailyHint = computed(() => this.capHint(this.daily(), 'dailyHint'));
  readonly monthlyHint = computed(() => this.capHint(this.monthly(), 'monthlyHint'));

  private capHint(v: TimePickerValue | null, key: string): string {
    this.translate.currentLang();
    const m = this.minutesOf(v);
    return m === null
      ? this.translate.instant('ADMIN.autorisationRules.emptyMeansNoLimit')
      : this.translate.instant('ADMIN.autorisationRules.' + key, { cap: formatMinutes(m) });
  }

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.http.get<RulesRow[]>(this.base).subscribe({
      next: r => { this.rows.set(r ?? []); this.loading.set(false); },
      error: () => {
        this.rows.set([]);
        this.error.set(this.translate.instant('ADMIN.autorisationRules.errLoad'));
        this.loading.set(false);
      },
    });
  }

  columns(): TableColumn[] {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('ADMIN.autorisationRules.' + k);
    return [
      { key: 'pays', label: t('colCountry') },
      { key: 'employees', label: t('colEmployees'), align: 'right', width: '110px' },
      { key: 'daily', label: t('colDaily'), width: '140px' },
      { key: 'monthly', label: t('colMonthly'), width: '140px' },
      { key: 'perDay', label: t('colPerDay'), width: '120px' },
      { key: 'notice', label: t('colNotice'), width: '110px' },
      { key: 'justif', label: t('colJustif'), width: '120px' },
      { key: '_actions', label: '', width: '80px' },
    ];
  }

  tableRows(): TableRow[] {
    return this.rows().map(r => ({
      id: r.paysId,
      pays: r.frenchLabel ?? r.isoCode ?? String(r.paysId),
      employees: r.employees,
      notice: r.noticeDays ?? '—',
      _s: r,
    } as unknown as TableRow));
  }

  config(): TableConfig {
    return {
      loading: this.loading(),
      skeletonRows: 5,
      resizableColumns: true,
      emptyMessage: this.translate.instant('ADMIN.autorisationRules.empty'),
    } as TableConfig;
  }

  open(row: RulesRow): void {
    this.target.set(row);
    this.editError.set(null);
    this.daily.set(this.valueOf(row.dailyCapMinutes));
    this.monthly.set(this.valueOf(row.monthlyCapMinutes));
    this.perDay.set(row.maxPerDay);
    this.notice.set(row.noticeDays);
    this.justif.set(row.requiresJustification);
    this.showEdit.set(true);
  }

  save(): void {
    const p = this.target();
    if (!p) return;
    this.saving.set(true);
    this.editError.set(null);

    this.http.put<RulesRow>(`${this.base}/${p.paysId}`, {
      dailyCapMinutes: this.minutesOf(this.daily()),
      monthlyCapMinutes: this.minutesOf(this.monthly()),
      maxPerDay: this.num(this.perDay()),
      noticeDays: this.num(this.notice()),
      requiresJustification: this.justif(),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showEdit.set(false);
        this.notify.success(this.translate.instant('ADMIN.autorisationRules.saved'));
        this.load();
      },
      error: e => {
        this.saving.set(false);
        // The server names the actual rule — a zero cap, a monthly below the daily. Showing
        // it beats any generic text this component could invent.
        this.editError.set(e?.error?.message
          ?? this.translate.instant('ADMIN.autorisationRules.errSave'));
      },
    });
  }

  /** Minutes (the API's unit) → a picker duration; null stays null — no limit. */
  private valueOf(minutes: number | null): TimePickerValue | null {
    return minutes == null ? null
      : { hours: Math.floor(minutes / 60), minutes: minutes % 60, seconds: 0 };
  }

  /** A picker duration → minutes for the API; null (reset) is « aucune limite ». */
  private minutesOf(v: TimePickerValue | null): number | null {
    return v ? v.hours * 60 + v.minutes : null;
  }

  /**
   * '' and null both mean "no limit"; anything else is a number.
   *
   * A cleared number input yields '', and `Number('')` is 0 — which the server refuses, and
   * rightly: a zero cap would silently refuse every request.
   */
  private num(v: number | string | null): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
