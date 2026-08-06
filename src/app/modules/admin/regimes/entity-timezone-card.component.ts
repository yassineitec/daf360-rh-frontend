import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { SelectComponent, SelectOption, ButtonComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DafHasPermissionDirective } from '@khalilrebhiitec/daf360';

import { RefDataService } from '../../../core/ref/ref-data.service';
import { PaysTimezone, TimezoneOption } from '../../../core/ref/ref-data.model';

/**
 * The entity's working clock — the zone every regime, break window and pointage transition
 * of this entity is read in.
 *
 * It lives at the top of the regimes admin page because it is a precondition for everything
 * below it: an entity with no timezone has NO presence automation (clock-in, breaks,
 * end-of-shift all resolve to "no schedule"), and that used to be invisible. Hence the
 * explicit error state rather than a blank select.
 *
 * The offset shown next to each zone is computed by the backend for the current instant and
 * never stored: it changes with DST, which is exactly why the persisted value is an IANA id.
 */
@Component({
  selector: 'app-entity-timezone-card',
  standalone: true,
  imports: [SelectComponent, ButtonComponent, TranslatePipe, DafHasPermissionDirective],
  template: `
    <div class="etz-card" [class.etz-unset]="!current()?.timezone">
      <div class="etz-head">
        <span class="material-symbols-outlined etz-icon">public</span>
        <div class="etz-titles">
          <p class="etz-title">{{ 'ADMIN.regimes.timezone.title' | translate }}</p>
          <p class="etz-sub">
            @if (current()?.timezone) {
              {{ current()!.timezone }} · {{ current()!.offsetLabel }}
            } @else {
              {{ 'ADMIN.regimes.timezone.unset' | translate }}
            }
          </p>
        </div>
      </div>

      <p class="etz-help">{{ 'ADMIN.regimes.timezone.help' | translate }}</p>

      <!-- Whoever configures the hours must be able to configure the clock they are read
           in; ADMIN_LISTS is accepted too because the column lives on [pays]. -->
      <div class="etz-row" *dafHasPermission="['ADMIN_REGIMES', 'ADMIN_LISTS']">
        <daf-select
          [selected]="selected()"
          [options]="options()"
          [config]="{ label: ('ADMIN.regimes.timezone.field' | translate), searchable: true, required: true, fullWidth: true }"
          (selectedChange)="onChange($event)" />
        <daf-button
          [label]="(saving() ? 'ADMIN.regimes.common.saving' : 'ADMIN.regimes.common.save') | translate"
          variant="teal"
          [options]="{ disabled: saving() || !dirty(), loading: saving() }"
          (onClick)="save()" />
      </div>

      @if (message()) { <div class="etz-msg" [class.etz-msg-error]="isError()">{{ message() }}</div> }
    </div>
  `,
  styles: [`
    .etz-card {
      border: 1px solid var(--color-outline-variant);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
      background: var(--color-surface-container-low);
    }
    /* An unconfigured entity is a broken entity as far as pointage is concerned. */
    .etz-unset { border-color: #fca5a5; background: var(--color-error-container); }
    .etz-head { display: flex; align-items: center; gap: 12px; }
    .etz-icon { font-size: 22px; color: var(--color-tertiary); }
    .etz-titles { display: flex; flex-direction: column; gap: 2px; }
    .etz-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-on-surface); }
    .etz-sub   { margin: 0; font-size: 13px; color: var(--color-on-surface-variant); }
    .etz-help  { margin: 10px 0 14px; font-size: 12px; color: var(--color-on-surface-variant); }
    .etz-row   { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
    .etz-row daf-select { flex: 1 1 320px; }
    .etz-msg   { margin-top: 12px; font-size: 13px; color: #15803d; }
    .etz-msg-error { color: var(--color-on-error-container); }
  `],
})
export class EntityTimezoneCardComponent {
  private refData   = inject(RefDataService);
  private translate = inject(TranslateService);

  readonly paysId = input<number>(179);

  current  = signal<PaysTimezone | null>(null);
  saving   = signal(false);
  message  = signal<string | null>(null);
  isError  = signal(false);
  selected = signal<string[]>(['']);

  private readonly timezones = signal<TimezoneOption[]>([]);

  readonly options = computed<SelectOption[]>(() =>
    this.timezones().map(t => ({ value: t.id, label: t.label })));

  /** Only enable Save once the choice actually differs from what is stored. */
  readonly dirty = computed(() => {
    const picked = this.selected()[0] ?? '';
    return !!picked && picked !== (this.current()?.timezone ?? '');
  });

  constructor() {
    // input() is a signal, so this also re-runs when the admin switches entity.
    effect(() => {
      const id = this.paysId();
      this.message.set(null);
      this.refData.getPaysTimezones().subscribe(list => {
        const row = list.find(p => p.id === id) ?? null;
        this.current.set(row);
        this.selected.set([row?.timezone ?? '']);
      });
    });
    this.refData.getTimezones().subscribe(tzs => this.timezones.set(tzs));
  }

  onChange(values: string[]): void {
    this.selected.set([values[0] ?? '']);
    this.message.set(null);
  }

  save(): void {
    const tz = this.selected()[0];
    if (!tz) return;
    this.saving.set(true);
    this.refData.setPaysTimezone(this.paysId(), tz).subscribe({
      next: () => {
        this.saving.set(false);
        this.isError.set(false);
        this.message.set(this.translate.instant('ADMIN.regimes.timezone.saved'));
        // Re-read so the displayed offset comes from the server rather than being guessed
        // client-side — the browser's idea of a zone's offset is not the authority here.
        this.refData.getPaysTimezones().subscribe(list =>
          this.current.set(list.find(p => p.id === this.paysId()) ?? null));
        setTimeout(() => this.message.set(null), 3000);
      },
      error: err => {
        this.saving.set(false);
        this.isError.set(true);
        this.message.set(err?.error?.message
          ?? this.translate.instant('ADMIN.regimes.timezone.errorSave'));
      },
    });
  }
}
