import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent, SkeletonComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import {
  ASSET_SOURCE_KEYS, ASSET_STATUS_CONFIG, AssetAssignmentSource, AssetAssignmentStatus,
  ItAssetAssignmentDto, assetIcon,
} from '../it-assets/it-asset.model';
import { fmtDate } from './field-bridges';

/**
 * Matériel IT tab — the equipment ledger for one employee.
 *
 * Two lists, not one table: what the employee holds RIGHT NOW is the operational
 * question (an offboarding starts from it), and what they held before is history. A
 * single date-sorted table buries the first inside the second.
 *
 * Read-only component: every action is an output, the modals and the service calls stay
 * on the page — same split as `rh-lifecycle-section`.
 */
@Component({
  selector: 'rh-it-assets-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionCardComponent, ButtonComponent, SkeletonComponent, StatusBadgeComponent,
    TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <rh-section-card [title]="'PROFILES.SECTIONS.IT_ASSETS' | translate" icon="devices">

      <!-- Must be a STATIC root node of the projected content: an element inside an
           @if lives in an embedded view, which ng-content's selector never matches. -->
      <div sectionAction>
        @if (canEdit()) {
          <div class="flex items-center gap-2">
            <daf-button
              [options]="{ variant: 'ghost', size: 'sm', iconStart: 'sync',
                           label: ('PROFILES.IT_ASSETS.SYNC' | translate),
                           disabled: syncing(), loading: syncing() }"
              (onClick)="sync.emit()" />
            <daf-button
              [options]="{ variant: 'primary', size: 'sm', iconStart: 'add',
                           label: ('PROFILES.IT_ASSETS.ASSIGN' | translate) }"
              (onClick)="assign.emit()" />
          </div>
        }
      </div>

      @if (loading()) {
        <div class="flex flex-col gap-2">
          @for (i of [0, 1, 2]; track i) {
            <daf-skeleton variant="block" radius="lg" width="100%" height="64px" />
          }
        </div>
      } @else if (!assets().length) {
        <div class="flex flex-col items-center gap-2 py-6 text-center">
          <span class="material-symbols-outlined text-[28px] text-outline">inventory_2</span>
          <p class="m-0 text-[13px] text-on-surface-variant">{{ 'PROFILES.IT_ASSETS.NONE' | translate }}</p>
          @if (canEdit()) {
            <p class="m-0 text-[11px] text-outline">{{ 'PROFILES.IT_ASSETS.NONE_HINT' | translate }}</p>
          }
        </div>
      } @else {

        <div class="flex flex-col gap-6">

          <!-- ── Currently held ── -->
          <div class="flex flex-col gap-2.5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                {{ 'PROFILES.IT_ASSETS.CURRENT' | translate }}
              </span>
              <span class="text-[11px] text-outline">
                {{ 'PROFILES.IT_ASSETS.COUNT_CURRENT' | translate:{ count: current().length } }}
              </span>
            </div>

            @for (a of current(); track a.id) {
              <div class="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
                <div class="flex flex-wrap items-start justify-between gap-2.5">
                  <div class="flex min-w-0 flex-1 gap-3">
                    <span class="material-symbols-outlined mt-0.5 shrink-0 text-[20px] text-teal">{{ icon(a) }}</span>
                    <div class="flex min-w-0 flex-col gap-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-[13px] font-bold text-on-surface">{{ typeLabel(a) }}</span>
                        <daf-badge [label]="statusLabel(a.status)"
                                   [options]="{ variant: statusVariant(a.status), size: 'sm' }" />
                        <daf-badge [label]="sourceLabel(a.source)"
                                   [options]="{ variant: 'neutral', pill: true, size: 'sm' }" />
                      </div>

                      @if (a.brandModel) {
                        <span class="text-[12px] text-on-surface">{{ a.brandModel }}</span>
                      }

                      <div class="flex flex-wrap gap-3 text-[12px] text-on-surface-variant">
                        @if (a.serialNumber) {
                          <span>{{ 'PROFILES.IT_ASSETS.SERIAL' | translate }} : <span class="font-mono">{{ a.serialNumber }}</span></span>
                        }
                        @if (a.assetTag) {
                          <span>{{ 'PROFILES.IT_ASSETS.TAG' | translate }} : {{ a.assetTag }}</span>
                        }
                        <span>{{ 'PROFILES.IT_ASSETS.SINCE' | translate:{ date: fmtDate(a.assignedAt) } }}</span>
                        <span>{{ 'PROFILES.IT_ASSETS.DAYS_HELD' | translate:{ days: a.daysHeld } }}</span>
                        <span>{{ 'PROFILES.IT_ASSETS.CONDITION_ON_ASSIGN' | translate }} :
                          {{ conditionLabel(a.conditionOnAssign) }}</span>
                      </div>

                      @if (a.notes) {
                        <p class="m-0 text-[11px] italic text-on-surface-variant">{{ a.notes }}</p>
                      }
                      @if (a.assignedByName) {
                        <span class="text-[11px] text-outline">
                          {{ 'PROFILES.IT_ASSETS.ASSIGNED_BY' | translate:{ name: a.assignedByName } }}
                        </span>
                      }
                    </div>
                  </div>

                  @if (canEdit()) {
                    <div class="flex shrink-0 items-center gap-1.5">
                      <daf-button
                        [options]="{ variant: 'secondary', size: 'sm', iconStart: 'assignment_return',
                                     label: ('PROFILES.IT_ASSETS.RETURN' | translate) }"
                        (onClick)="returnAsset.emit(a)" />
                      <daf-button
                        [options]="{ variant: 'ghost', size: 'sm', iconStart: 'edit',
                                     title: ('PROFILES.IT_ASSETS.EDIT' | translate) }"
                        (onClick)="edit.emit(a)" />
                    </div>
                  }
                </div>
              </div>
            } @empty {
              <p class="m-0 text-[13px] text-on-surface-variant">
                {{ 'PROFILES.IT_ASSETS.NONE_CURRENT' | translate }}
              </p>
            }
          </div>

          <!-- ── Returned / closed ── -->
          @if (past().length) {
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                  {{ 'PROFILES.IT_ASSETS.PAST' | translate }}
                </span>
                <span class="text-[11px] text-outline">
                  {{ 'PROFILES.IT_ASSETS.COUNT_PAST' | translate:{ count: past().length } }}
                </span>
              </div>

              @for (a of past(); track a.id) {
                <div class="flex flex-wrap items-center gap-2.5 rounded-lg border border-outline-variant px-3 py-2.5">
                  <span class="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant">{{ icon(a) }}</span>
                  <div class="flex min-w-0 flex-1 flex-col">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-[13px] font-medium text-on-surface">{{ typeLabel(a) }}</span>
                      @if (a.brandModel) {
                        <span class="text-[12px] text-on-surface-variant">{{ a.brandModel }}</span>
                      }
                      <daf-badge [label]="statusLabel(a.status)"
                                 [options]="{ variant: statusVariant(a.status), size: 'sm' }" />
                    </div>
                    <span class="text-[11px] text-on-surface-variant">
                      {{ 'PROFILES.IT_ASSETS.PERIOD' | translate:{
                           from: fmtDate(a.assignedAt), to: fmtDate(a.returnedAt), days: a.daysHeld } }}
                      @if (a.serialNumber) { · <span class="font-mono">{{ a.serialNumber }}</span> }
                      @if (a.conditionOnReturn) { · {{ conditionLabel(a.conditionOnReturn) }} }
                    </span>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </rh-section-card>
  `,
})
export class ItAssetsSectionComponent {
  private translate = inject(TranslateService);

  readonly assets  = input<ItAssetAssignmentDto[]>([]);
  readonly loading = input(false);
  readonly syncing = input(false);
  readonly canEdit = input(false);

  readonly assign      = output<void>();
  readonly sync        = output<void>();
  readonly returnAsset = output<ItAssetAssignmentDto>();
  readonly edit        = output<ItAssetAssignmentDto>();

  /** `isCurrent` comes from the backend (`returnedAt IS NULL`) — one definition, not two. */
  readonly current = computed(() => this.assets().filter(a => a.isCurrent));
  readonly past    = computed(() => this.assets().filter(a => !a.isCurrent));

  protected readonly fmtDate = fmtDate;

  protected icon(a: ItAssetAssignmentDto): string {
    return assetIcon(a.assetTypeCode);
  }

  /**
   * The reference table carries both labels; picking on the active language avoids a
   * fourth copy of the asset-type names in the i18n files.
   */
  protected typeLabel(a: ItAssetAssignmentDto): string {
    const en = this.translate.currentLang() === 'en';
    return (en ? a.assetTypeLabelEn : a.assetTypeLabelFr)
        ?? a.assetTypeLabelFr ?? a.assetTypeCode ?? '—';
  }

  protected statusLabel(status: AssetAssignmentStatus): string {
    const cfg = ASSET_STATUS_CONFIG[status];
    return cfg ? this.translate.instant(cfg.key) : status;
  }

  protected statusVariant(status: AssetAssignmentStatus) {
    return ASSET_STATUS_CONFIG[status]?.variant ?? ('neutral' as const);
  }

  protected sourceLabel(source: AssetAssignmentSource): string {
    const key = ASSET_SOURCE_KEYS[source];
    return key ? this.translate.instant(key) : source;
  }

  protected conditionLabel(code: string | null): string {
    if (!code) return '—';
    const key = 'PROFILES.IT_ASSETS.CONDITION.' + code;
    const label = this.translate.instant(key);
    // ngx-translate echoes the key back when it is missing — show the raw code instead of
    // a dotted path leaking into the UI.
    return label === key ? code : label;
  }
}
