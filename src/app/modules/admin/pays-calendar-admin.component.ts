import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, ButtonComponent, DafCellDirective, DataTableComponent, FormFieldComponent,
  SelectComponent, SelectOption, StatusBadgeComponent, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { environment } from '../../../environments/environment';
import { ModalComponent } from '../../shared/modal.component';
import { TableActionComponent } from '../../shared/table-action.component';
import { NotificationService } from '../../core/notification.service';

/** An entity's working calendar, as the API returns it. */
interface PaysScheduling {
  paysId: number;
  frenchLabel: string;
  englishLabel: string | null;
  isoCode: string | null;
  timezone: string | null;
  weekendDays: string[];
  /** True when nothing is configured and Saturday/Sunday is being ASSUMED, not chosen. */
  usingDefaultWeekend: boolean;
  advanceNoticeDays: number | null;
  leaveGapDays: number | null;
  employees: number;
}

/** java.time.DayOfWeek order — what `pays_weekends.day` stores, and how a week reads. */
const DAYS = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
] as const;

/**
 * Administration → Calendrier des entités.
 *
 * WHAT IT SETS, AND WHY IT HAD TO EXIST
 * -----------------------------------------------------------------------------
 * `pays_weekends` decides which days cost a leave day, which days the presence automation
 * expects somebody at their desk, which days a break is deducted on, and what a working-time
 * regime resolves to. Five readers — and until this screen, no writer anywhere in the service.
 * Changing an entity's rest days meant hand-written SQL.
 *
 * It also carries the two country-level leave delays. They belong with the weekend because
 * they are one policy — how this entity schedules time off — and because both are counted in
 * WORKING days, so one is meaningless without the other.
 *
 * "ASSUMED" IS SHOWN AS A DISTINCT STATE, not as Saturday/Sunday.
 * -----------------------------------------------------------------------------
 * An entity with no rows is not configured; `WorkingDayCalculator` falls back to Sat/Sun for
 * it and logs a warning. Rendering that fallback as though somebody had chosen it would hide
 * the one thing an administrator opens this screen to find.
 *
 * ONLY ENTITIES THAT MATTER ARE LISTED — those with employees, or with configuration already.
 * The reference table holds all 194 ISO countries; a picker of 194 rows to reach the two you
 * operate in is a worse screen than one showing those two.
 */
@Component({
  selector: 'app-pays-calendar-admin',
  standalone: true,
  imports: [
    DataTableComponent, DafCellDirective, StatusBadgeComponent, ButtonComponent,
    FormFieldComponent, SelectComponent, ModalComponent, TableActionComponent, TranslatePipe,
  ],
  template: `
    <div class="flex min-w-0 flex-col gap-4">

      <p class="text-body-sm text-on-surface-variant">
        {{ 'ADMIN.paysCalendar.intro' | translate }}
      </p>

      @if (error()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>{{ error() }}
        </div>
      }

      <daf-data-table [columns]="columns()" [rows]="rows()" [config]="config()">

        <ng-template dafCell="weekend" let-row>
          @if (row['_s'].usingDefaultWeekend) {
            <!-- The whole point of the screen: say "assumed", never show it as configured. -->
            <div class="flex flex-wrap items-center gap-2">
              <daf-badge [label]="'ADMIN.paysCalendar.assumed' | translate"
                         [options]="{ variant: 'warning', size: 'sm', dot: true }" />
              <span class="text-body-sm text-outline">{{ 'ADMIN.paysCalendar.assumedDays' | translate }}</span>
            </div>
          } @else {
            <div class="flex flex-wrap gap-1.5">
              @for (d of row['_s'].weekendDays; track d) {
                <daf-badge [label]="dayLabel(d)" [options]="{ variant: 'info', size: 'sm' }" />
              }
            </div>
          }
        </ng-template>

        <ng-template dafCell="delays" let-row>
          <div class="flex items-center justify-end gap-3 tabular-nums">
            <span [title]="'ADMIN.paysCalendar.notice' | translate">{{ num(row['_s'].advanceNoticeDays) }}</span>
            <span class="text-outline-variant">·</span>
            <span [title]="'ADMIN.paysCalendar.gap' | translate">{{ num(row['_s'].leaveGapDays) }}</span>
          </div>
        </ng-template>

        <ng-template dafCell="_actions" let-row>
          <div class="flex items-center justify-end gap-2">
            <rh-table-action id="edit" icon="edit_calendar"
                             [tooltip]="'ADMIN.paysCalendar.edit' | translate"
                             (action)="open(row['_s'])" />
          </div>
        </ng-template>

      </daf-data-table>
    </div>

    <app-modal [title]="('ADMIN.paysCalendar.modalTitle' | translate)"
               [visible]="showEdit()" size="md" [hasFooter]="true"
               (closed)="showEdit.set(false)">
      @if (target(); as p) {
        <div class="flex flex-col gap-4">
          <div>
            <p class="font-semibold">{{ p.frenchLabel }}</p>
            <p class="text-body-sm text-on-surface-variant">
              {{ 'ADMIN.paysCalendar.employees' | translate: { n: p.employees } }}
              @if (p.timezone) { · {{ p.timezone }} }
            </p>
          </div>

          <daf-select
            [options]="dayOptions()"
            [selected]="weekend()"
            [config]="{ label: ('ADMIN.paysCalendar.weekend' | translate), multiple: true,
                        required: true, fullWidth: true,
                        hint: ('ADMIN.paysCalendar.weekendHint' | translate) }"
            (selectedChange)="weekend.set($event)" />

          <!-- Said plainly: an empty weekend does not mean "works every day", it means the
               calculator quietly goes back to Saturday/Sunday. The server refuses it. -->
          @if (weekend().length === 0) {
            <p class="rounded-lg bg-warning/10 px-3 py-2 text-body-sm">
              {{ 'ADMIN.paysCalendar.weekendEmpty' | translate }}
            </p>
          }

          <p class="text-label-caps text-tertiary">{{ 'ADMIN.paysCalendar.delaysTitle' | translate }}</p>
          <p class="text-body-sm text-on-surface-variant">
            {{ 'ADMIN.paysCalendar.delaysHint' | translate }}
          </p>

          <daf-form-field
            [options]="{ label: ('ADMIN.paysCalendar.notice' | translate), type: 'number', fullWidth: true,
                         hint: ('ADMIN.paysCalendar.noticeHint' | translate) }"
            [value]="notice()"
            (valueChange)="notice.set(asNum($event))" />

          <daf-form-field
            [options]="{ label: ('ADMIN.paysCalendar.gap' | translate), type: 'number', fullWidth: true,
                         hint: ('ADMIN.paysCalendar.gapHint' | translate) }"
            [value]="gap()"
            (valueChange)="gap.set(asNum($event))" />

          <p class="text-body-sm text-on-surface-variant">
            {{ 'ADMIN.paysCalendar.delaysNullHint' | translate }}
          </p>

          @if (editError()) { <div class="text-[13px] text-danger">{{ editError() }}</div> }
        </div>
      }
      <div slot="footer">
        <daf-button [label]="('ADMIN.paysCalendar.cancel' | translate)" variant="secondary"
                    (onClick)="showEdit.set(false)" />
        <daf-button [label]="('ADMIN.paysCalendar.save' | translate)" variant="teal"
                    [options]="{ loading: saving(), disabled: weekend().length === 0 }"
                    (onClick)="save()" />
      </div>
    </app-modal>
  `,
})
export class PaysCalendarAdminComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly base = `${environment.hrApiUrl}/api/hr/ref`;

  readonly items = signal<PaysScheduling[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly showEdit = signal(false);
  readonly saving = signal(false);
  readonly editError = signal<string | null>(null);
  readonly target = signal<PaysScheduling | null>(null);

  /** daf-select multiple works in string[], which is also what the API takes. */
  readonly weekend = signal<string[]>([]);
  readonly notice = signal<number | null>(null);
  readonly gap = signal<number | null>(null);

  readonly dayOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return DAYS.map(d => ({ value: d, label: this.dayLabel(d) }));
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'label', label: t('ADMIN.paysCalendar.colEntity'), sortable: true },
      { key: 'employees', label: t('ADMIN.paysCalendar.colEmployees'), align: 'right',
        width: '110px', sortable: true },
      { key: 'weekend', label: t('ADMIN.paysCalendar.colWeekend') },
      { key: 'delays', label: t('ADMIN.paysCalendar.colDelays'), align: 'right', width: '150px' },
      // A real width, not `1%`: resizableColumns puts the table in table-layout: fixed,
      // where a declared width is taken literally.
      { key: '_actions', label: '', align: 'right', width: '72px' },
    ];
  });

  readonly rows = computed<TableRow[]>(() =>
    this.items().map(p => ({
      id: p.paysId,
      label: p.frenchLabel,
      employees: p.employees,
      _s: p,
    })));

  readonly config = computed<TableConfig>(() => ({
    showHeader: false,
    hoverable: true,
    loading: this.loading(),
    skeletonRows: 6,
    emptyMessage: this.translate.instant('ADMIN.paysCalendar.empty'),
    resizableColumns: true,
    columnPicker: true,
    columnPickerLabel: this.translate.instant('ADMIN.paysCalendar.columns'),
    rowId: (row) => String(row['id']),
  }));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<PaysScheduling[]>(`${this.base}/pays/scheduling`).subscribe({
      next: list => { this.items.set(list ?? []); this.loading.set(false); },
      error: () => {
        this.items.set([]);
        this.loading.set(false);
        this.error.set(this.translate.instant('ADMIN.paysCalendar.errLoad'));
      },
    });
  }

  open(p: PaysScheduling): void {
    this.target.set(p);
    this.editError.set(null);
    // An assumed weekend is seeded with the days actually being used, so saving without
    // touching anything records the fallback as a deliberate choice rather than clearing it.
    this.weekend.set(p.usingDefaultWeekend ? ['SATURDAY', 'SUNDAY'] : [...p.weekendDays]);
    this.notice.set(p.advanceNoticeDays);
    this.gap.set(p.leaveGapDays);
    this.showEdit.set(true);
  }

  save(): void {
    const p = this.target();
    if (!p || this.saving()) return;
    if (this.weekend().length === 0) return;

    this.saving.set(true);
    this.editError.set(null);
    this.http.put<PaysScheduling>(`${this.base}/pays/${p.paysId}/scheduling`, {
      weekendDays: this.weekend(),
      advanceNoticeDays: this.notice(),
      leaveGapDays: this.gap(),
    }).subscribe({
      next: updated => {
        this.saving.set(false);
        this.showEdit.set(false);
        // Patched in place: the server returns the saved row, so re-listing buys nothing.
        this.items.update(list => list.map(x => (x.paysId === updated.paysId ? updated : x)));
        this.notify.success(this.translate.instant('ADMIN.paysCalendar.saved',
          { entity: updated.frenchLabel }));
      },
      error: err => {
        this.saving.set(false);
        this.editError.set(err?.error?.message
          ?? this.translate.instant('ADMIN.paysCalendar.errSave'));
      },
    });
  }

  /** A dash for null, the figure for zero — "no default" is not "no delay". */
  num(v: number | null): string {
    return v == null ? '—' : String(v);
  }

  dayLabel(day: string): string {
    return this.translate.instant('ADMIN.paysCalendar.days.' + day);
  }

  asNum(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
