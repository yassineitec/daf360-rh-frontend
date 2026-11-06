import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, DafCellDirective, DataTableComponent, FormFieldComponent, RadioGroupComponent,
  StatusBadgeComponent, TableColumn, TableConfig, TableRow, ToggleComponent,
} from '@khalilrebhiitec/daf360';

import { environment } from '../../../environments/environment';
import { ModalComponent } from '../../shared/modal.component';
import { TableActionComponent } from '../../shared/table-action.component';
import { NotificationService } from '../../core/notification.service';
import { TeletravailDurations } from '../teletravail/models/teletravail.model';

/** One entity's rules, as /api/hr/teletravail/admin/rules returns them. */
interface RulesRow {
  paysId: number;
  frenchLabel: string | null;
  englishLabel: string | null;
  isoCode: string | null;
  employees: number;
  allowedDurations: TeletravailDurations;
  maxDaysPerWeek: number | null;
  maxDaysPerMonth: number | null;
  noticeDays: number | null;
  usesBalance: boolean;
}

/**
 * Administration → Télétravail : the rules, per entity.
 *
 * WHY THIS SCREEN EXISTS AT ALL
 * -----------------------------------------------------------------------------
 * The timesheet had no télétravail rules — every request was a whole day, the only check was
 * the balance, and even that never ran on submission. Here each entity decides:
 *
 *   · which DURATIONS its employees may ask for — full days, half days, or both. This is the
 *     half-day option; the timesheet offered full days only;
 *   · how many days a week and a month (in steps of half a day), empty = no limit;
 *   · how much notice, in working days, as for congés;
 *   · whether approving draws on soldeTeletravail.
 *
 * Same shape and same gate as the autorisation rules beside it, so an administrator learns
 * one screen and reads two.
 */
@Component({
  selector: 'app-teletravail-rules-admin',
  standalone: true,
  imports: [
    DataTableComponent, DafCellDirective, StatusBadgeComponent, ButtonComponent, RadioGroupComponent,
    ModalComponent, FormFieldComponent, ToggleComponent, TableActionComponent, TranslatePipe,
  ],
  template: `
    <div class="flex min-w-0 flex-col gap-4">

      <p class="text-body-sm text-on-surface-variant">
        {{ 'ADMIN.teletravailRules.intro' | translate }}
      </p>

      @if (error()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>{{ error() }}
        </div>
      }

      <daf-data-table [columns]="columns()" [rows]="tableRows()" [config]="config()">

        <ng-template dafCell="durations" let-row>
          <daf-badge [label]="('ADMIN.teletravailRules.durations.' + row['_s'].allowedDurations) | translate"
                     [options]="{ variant: row['_s'].allowedDurations === 'FULL_DAY' ? 'neutral' : 'info', size: 'sm' }" />
        </ng-template>

        <ng-template dafCell="week" let-row>
          @if (row['_s'].maxDaysPerWeek === null) {
            <daf-badge [label]="'ADMIN.teletravailRules.noLimit' | translate"
                       [options]="{ variant: 'neutral', size: 'sm' }" />
          } @else {
            <span>{{ days(row['_s'].maxDaysPerWeek) }}</span>
          }
        </ng-template>

        <ng-template dafCell="month" let-row>
          @if (row['_s'].maxDaysPerMonth === null) {
            <daf-badge [label]="'ADMIN.teletravailRules.noLimit' | translate"
                       [options]="{ variant: 'neutral', size: 'sm' }" />
          } @else {
            <span>{{ days(row['_s'].maxDaysPerMonth) }}</span>
          }
        </ng-template>

        <ng-template dafCell="balance" let-row>
          <daf-badge
            [label]="(row['_s'].usesBalance ? 'ADMIN.teletravailRules.yes' : 'ADMIN.teletravailRules.no') | translate"
            [options]="{ variant: row['_s'].usesBalance ? 'info' : 'neutral', size: 'sm' }" />
        </ng-template>

        <ng-template dafCell="_actions" let-row>
          <div class="flex items-center justify-end gap-2">
            <rh-table-action id="edit" icon="edit"
                             [tooltip]="'ADMIN.teletravailRules.edit' | translate"
                             (action)="open(row['_s'])" />
          </div>
        </ng-template>
      </daf-data-table>
    </div>

    <app-modal [title]="('ADMIN.teletravailRules.modalTitle' | translate)"
               [visible]="showEdit()" size="md" [hasFooter]="true"
               (closed)="showEdit.set(false)">
      @if (target(); as p) {
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3">
            <div class="flex min-w-0 flex-col">
              <p class="truncate font-semibold">{{ p.frenchLabel ?? p.isoCode }}</p>
              <p class="text-body-sm text-on-surface-variant">
                {{ 'ADMIN.teletravailRules.employees' | translate: { n: p.employees } }}
              </p>
            </div>
            <span class="material-symbols-outlined text-[22px] text-tertiary">home_work</span>
          </div>

          <p class="text-body-sm text-on-surface-variant">
            {{ 'ADMIN.teletravailRules.modalIntro' | translate }}
          </p>

          <!-- The half-day option. Radios, not a select: three choices an administrator
               should read side by side, each with what it means for the employee. -->
          <daf-radio-group
            [options]="durationOptions()"
            [selected]="durations()"
            (selectedChange)="durations.set($any($event))"
            [config]="{ label: ('ADMIN.teletravailRules.durationsLabel' | translate), required: true }" />

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <daf-form-field
              [options]="{ label: ('ADMIN.teletravailRules.perWeek' | translate), type: 'number',
                           fullWidth: true, suffixText: ('ADMIN.teletravailRules.dayUnit' | translate),
                           hint: capHint(week()),
                           error: capError(week()) }"
              [value]="week()"
              (valueChange)="week.set($any($event))" />
            <daf-form-field
              [options]="{ label: ('ADMIN.teletravailRules.perMonth' | translate), type: 'number',
                           fullWidth: true, suffixText: ('ADMIN.teletravailRules.dayUnit' | translate),
                           hint: capHint(month()),
                           error: capError(month()) }"
              [value]="month()"
              (valueChange)="month.set($any($event))" />
          </div>

          <daf-form-field
            [options]="{ label: ('ADMIN.teletravailRules.notice' | translate), type: 'number',
                         fullWidth: true,
                         hint: ('ADMIN.teletravailRules.noticeHint' | translate) }"
            [value]="notice()"
            (valueChange)="notice.set($any($event))" />

          <daf-toggle [checked]="usesBalance()"
                      [options]="{ label: ('ADMIN.teletravailRules.usesBalance' | translate),
                                   hint: ('ADMIN.teletravailRules.usesBalanceHint' | translate) }"
                      (checkedChange)="usesBalance.set($event)" />

          @if (monthBelowWeek()) {
            <p class="rounded-lg bg-warning/10 px-3 py-2 text-body-sm">
              {{ 'ADMIN.teletravailRules.monthBelowWeek' | translate }}
            </p>
          }

          @if (editError()) { <div class="text-[13px] text-danger">{{ editError() }}</div> }
        </div>
      }
      <div slot="footer">
        <daf-button [label]="('ADMIN.teletravailRules.cancel' | translate)" variant="secondary"
                    (onClick)="showEdit.set(false)" />
        <daf-button [label]="('ADMIN.teletravailRules.save' | translate)" variant="teal"
                    [options]="{ loading: saving(), disabled: invalid() }"
                    (onClick)="save()" />
      </div>
    </app-modal>
  `,
})
export class TeletravailRulesAdminComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly notify = inject(NotificationService);
  private readonly base = `${environment.hrApiUrl}/api/hr/teletravail/admin/rules`;

  readonly rows = signal<RulesRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly showEdit = signal(false);
  readonly saving = signal(false);
  readonly editError = signal<string | null>(null);
  readonly target = signal<RulesRow | null>(null);

  readonly durations = signal<TeletravailDurations>('BOTH');
  // Number inputs give '' when cleared — that is « no limit » and must reach the payload as null.
  readonly week = signal<number | string | null>(null);
  readonly month = signal<number | string | null>(null);
  readonly notice = signal<number | string | null>(null);
  readonly usesBalance = signal(true);

  readonly durationOptions = computed(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('ADMIN.teletravailRules.durations.' + k);
    return (['BOTH', 'FULL_DAY', 'HALF_DAY'] as TeletravailDurations[]).map(d => ({
      value: d, label: t(d), hint: t(d + '_HINT'),
    }));
  });

  readonly monthBelowWeek = computed(() => {
    const w = this.num(this.week());
    const m = this.num(this.month());
    return w !== null && m !== null && m < w;
  });

  /** Anything the server would refuse, caught first so Save can say so. */
  readonly invalid = computed(() =>
    this.monthBelowWeek() || !!this.capError(this.week()) || !!this.capError(this.month()));

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.http.get<RulesRow[]>(this.base).subscribe({
      next: r => { this.rows.set(r ?? []); this.loading.set(false); },
      error: () => {
        this.rows.set([]);
        this.error.set(this.translate.instant('ADMIN.teletravailRules.errLoad'));
        this.loading.set(false);
      },
    });
  }

  columns(): TableColumn[] {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('ADMIN.teletravailRules.' + k);
    return [
      { key: 'pays', label: t('colCountry') },
      { key: 'employees', label: t('colEmployees'), align: 'right', width: '110px' },
      { key: 'durations', label: t('colDurations'), width: '200px' },
      { key: 'week', label: t('colWeek'), width: '130px' },
      { key: 'month', label: t('colMonth'), width: '130px' },
      { key: 'notice', label: t('colNotice'), width: '110px' },
      { key: 'balance', label: t('colBalance'), width: '120px' },
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
      emptyMessage: this.translate.instant('ADMIN.teletravailRules.empty'),
    } as TableConfig;
  }

  open(row: RulesRow): void {
    this.target.set(row);
    this.editError.set(null);
    this.durations.set(row.allowedDurations ?? 'BOTH');
    this.week.set(row.maxDaysPerWeek);
    this.month.set(row.maxDaysPerMonth);
    this.notice.set(row.noticeDays);
    this.usesBalance.set(row.usesBalance);
    this.showEdit.set(true);
  }

  save(): void {
    const p = this.target();
    if (!p || this.invalid()) return;
    this.saving.set(true);
    this.editError.set(null);

    this.http.put<RulesRow>(`${this.base}/${p.paysId}`, {
      allowedDurations: this.durations(),
      maxDaysPerWeek: this.num(this.week()),
      maxDaysPerMonth: this.num(this.month()),
      noticeDays: this.num(this.notice()),
      usesBalance: this.usesBalance(),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showEdit.set(false);
        this.notify.success(this.translate.instant('ADMIN.teletravailRules.saved'));
        this.load();
      },
      error: e => {
        this.saving.set(false);
        this.editError.set(e?.error?.message ?? this.translate.instant('ADMIN.teletravailRules.errSave'));
      },
    });
  }

  /** "2 j", "2,5 j". */
  protected days(n: number | null): string {
    if (n == null) return '—';
    const fmt = new Intl.NumberFormat(this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR',
      { maximumFractionDigits: 1 }).format(n);
    return this.translate.instant('ADMIN.teletravailRules.daysValue', { n: fmt });
  }

  /** The hint says what the current value MEANS — « aucune limite » is never ambiguous. */
  protected capHint(v: number | string | null): string {
    const n = this.num(v);
    return n === null
      ? this.translate.instant('ADMIN.teletravailRules.emptyMeansNoLimit')
      : this.translate.instant('ADMIN.teletravailRules.capHint', { n: this.days(n) });
  }

  /** Zero, negative, not a multiple of half a day, or under one day with full days only. */
  protected capError(v: number | string | null): string | undefined {
    const n = this.num(v);
    if (n === null) return undefined;
    if (n <= 0) return this.translate.instant('ADMIN.teletravailRules.errZero');
    if (Math.round(n * 2) !== n * 2) return this.translate.instant('ADMIN.teletravailRules.errHalfSteps');
    if (this.durations() === 'FULL_DAY' && n < 1) return this.translate.instant('ADMIN.teletravailRules.errFullDayCap');
    return undefined;
  }

  /** '' and null both mean "no limit". Number('') is 0, which the server rightly refuses. */
  private num(v: number | string | null): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
