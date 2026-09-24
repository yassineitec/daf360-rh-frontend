import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, ChipGroupComponent, FormFieldComponent, SkeletonComponent, StatusBadgeComponent,
  type ChipOption,
} from '@khalilrebhiitec/daf360';

import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import { NotificationService } from '../../../core/notification.service';
import { DocumentHistoryService } from '../document-history/document-history.service';
import { DocumentHistory, DocumentHistoryEntry } from '../document-history/document-history.model';

interface MonthGroup {
  key: string;
  label: string;
  items: DocumentHistoryEntry[];
}

/**
 * Historique documents tab — everything in the employee's SharePoint folders, every tree and
 * every subfolder, as one timeline grouped by month.
 *
 * **Self-loading on purpose.** Unlike the other sections, this one owns its fetch, its filters
 * and its download: the page only hands it a `profileId`. That keeps this feature's footprint on
 * `profile-detail.component.*` — which other work touches too — to a tab entry and one `@case`.
 *
 * Only rendered for `canViewSensitive()` (the page filters the tab out otherwise); the backend
 * enforces the same authorities, since the payroll tree is in here.
 */
@Component({
  selector: 'rh-document-history-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionCardComponent, ButtonComponent, ChipGroupComponent, FormFieldComponent,
    SkeletonComponent, StatusBadgeComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <rh-section-card [title]="'PROFILES.DOC_HISTORY.TITLE' | translate" icon="history">

      <!-- Static root node of the projected content — see rh-it-assets-section. -->
      <div sectionAction>
        <daf-button
          [options]="{ variant: 'ghost', size: 'sm', iconStart: 'refresh',
                       label: ('PROFILES.DOC_HISTORY.REFRESH' | translate),
                       disabled: loading(), loading: loading() && !!history() }"
          (onClick)="load(true)" />
      </div>

      @if (loading() && !history()) {
        <div class="flex flex-col gap-2">
          @for (i of [0, 1, 2, 3]; track i) {
            <daf-skeleton variant="block" radius="lg" width="100%" height="56px" />
          }
        </div>
      } @else if (failed()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>
          {{ 'PROFILES.DOC_HISTORY.ERR_LOAD' | translate }}
        </div>
      } @else if (history(); as h) {

        @if (h.status !== 'FOUND') {
          <div class="flex flex-col items-center gap-2 py-6 text-center">
            <span class="material-symbols-outlined text-[28px] text-outline">cloud_off</span>
            <p class="m-0 text-[13px] text-on-surface-variant">
              {{ 'PROFILES.DOC_HISTORY.STATUS.' + h.status | translate }}
            </p>
            @for (r of h.roots; track r.key) {
              <p class="m-0 font-mono text-[11px] text-outline">{{ r.path }}</p>
            }
          </div>
        } @else {
          <div class="flex flex-col gap-5">

            <!-- ── Filters ── -->
            <div class="flex flex-col gap-3">
              <daf-form-field
                [options]="{ placeholder: ('PROFILES.DOC_HISTORY.SEARCH' | translate), prefixIcon: 'search' }"
                [value]="search()"
                (valueChange)="search.set($event == null ? '' : '' + $event)" />

              @if (treeOptions().length > 1) {
                <daf-chip-group
                  [options]="treeOptions()"
                  [config]="{ label: ('PROFILES.DOC_HISTORY.FILTER_TREE' | translate), multiple: true }"
                  [(selected)]="selectedTrees" />
              }
              @if (categoryOptions().length > 1) {
                <daf-chip-group
                  [options]="categoryOptions()"
                  [config]="{ label: ('PROFILES.DOC_HISTORY.FILTER_CATEGORY' | translate), multiple: true }"
                  [(selected)]="selectedCategories" />
              }

              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-outline">
                <span>{{ 'PROFILES.DOC_HISTORY.COUNT' | translate:{ shown: filtered().length, total: h.items.length } }}</span>
                <span>· {{ 'PROFILES.DOC_HISTORY.FETCHED_AT' | translate:{ time: fmtTime(h.fetchedAt) } }}</span>
              </div>

              @if (h.truncated) {
                <p class="m-0 flex items-start gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-[12px] text-on-surface">
                  <span class="material-symbols-outlined shrink-0 text-[16px]">warning</span>
                  {{ 'PROFILES.DOC_HISTORY.TRUNCATED' | translate }}
                </p>
              }
              @for (r of missingRoots(); track r.key) {
                <p class="m-0 flex items-start gap-1.5 text-[12px] text-on-surface-variant">
                  <span class="material-symbols-outlined shrink-0 text-[16px]">folder_off</span>
                  <span>{{ 'PROFILES.DOC_HISTORY.ROOT_MISSING' | translate }}
                    <span class="font-mono text-[11px]">{{ r.path }}</span></span>
                </p>
              }
            </div>

            <!-- ── Timeline ── -->
            @for (g of groups(); track g.key) {
              <div class="flex flex-col gap-2">
                <span class="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                  {{ g.label }}
                </span>

                @for (d of g.items; track d.id) {
                  <div class="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant px-3 py-2.5">
                    <span class="material-symbols-outlined shrink-0 text-[20px] text-teal">{{ fileIcon(d.name) }}</span>

                    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="break-all text-[13px] font-medium text-on-surface">{{ d.name }}</span>
                        @if (d.filedByApp) {
                          <daf-badge [label]="'PROFILES.DOC_HISTORY.FILED_BY_APP' | translate"
                                     [options]="{ variant: 'secondary', pill: true, size: 'sm' }" />
                        }
                      </div>
                      <span class="text-[11px] text-on-surface-variant">
                        {{ d.category ?? ('PROFILES.DOC_HISTORY.ROOT_FILES' | translate) }}
                        @if (subPath(d); as sp) { › {{ sp }} }
                        · {{ d.rootKey }}
                      </span>
                      <span class="text-[11px] text-outline">
                        {{ 'PROFILES.DOC_HISTORY.MODIFIED' | translate:{ date: fmtDateTime(d.modifiedAt) } }}
                        @if (d.modifiedBy) { · {{ d.modifiedBy }} }
                        @if (d.createdAt && d.createdAt !== d.modifiedAt) {
                          · {{ 'PROFILES.DOC_HISTORY.CREATED' | translate:{ date: fmtDateTime(d.createdAt) } }}
                          @if (d.createdBy && d.createdBy !== d.modifiedBy) { ({{ d.createdBy }}) }
                        }
                        @if (d.sizeBytes != null) { · {{ fmtSize(d.sizeBytes) }} }
                      </span>
                    </div>

                    <div class="flex shrink-0 items-center gap-1.5">
                      <daf-button
                        [options]="{ variant: 'secondary', size: 'sm', iconStart: 'open_in_new',
                                     label: ('PROFILES.DOC_HISTORY.OPEN' | translate),
                                     disabled: opening() === d.id, loading: opening() === d.id }"
                        (onClick)="open(d)" />
                      @if (d.webUrl) {
                        <a class="inline-flex items-center rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                           [href]="d.webUrl" target="_blank" rel="noopener noreferrer"
                           [title]="'PROFILES.DOC_HISTORY.OPEN_SHAREPOINT' | translate"
                           [attr.aria-label]="'PROFILES.DOC_HISTORY.OPEN_SHAREPOINT' | translate">
                          <span class="material-symbols-outlined text-[18px]">cloud</span>
                        </a>
                      }
                    </div>
                  </div>
                }
              </div>
            } @empty {
              <div class="flex flex-col items-center gap-2 py-6 text-center">
                <span class="material-symbols-outlined text-[28px] text-outline">folder_open</span>
                <p class="m-0 text-[13px] text-on-surface-variant">
                  {{ (h.items.length ? 'PROFILES.DOC_HISTORY.NO_MATCH' : 'PROFILES.DOC_HISTORY.EMPTY') | translate }}
                </p>
              </div>
            }
          </div>
        }
      }
    </rh-section-card>
  `,
})
export class DocumentHistorySectionComponent {
  private svc       = inject(DocumentHistoryService);
  private translate = inject(TranslateService);
  private notify    = inject(NotificationService);

  readonly profileId = input.required<number>();

  readonly history  = signal<DocumentHistory | null>(null);
  readonly loading  = signal(false);
  readonly failed   = signal(false);
  readonly opening  = signal<string | null>(null);

  readonly search             = signal('');
  /** Empty = no filter. */
  readonly selectedTrees      = signal<string[]>([]);
  readonly selectedCategories = signal<string[]>([]);

  constructor() {
    // Loads when the tab is first rendered and again if the page switches profile.
    effect(() => {
      this.profileId();
      untracked(() => this.load(false));
    });
  }

  load(refresh: boolean): void {
    const id = this.profileId();
    if (!id) return;
    this.loading.set(true);
    this.failed.set(false);
    this.svc.getHistory(id, refresh).subscribe({
      next: h => { this.history.set(h); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }

  readonly missingRoots = computed(() => (this.history()?.roots ?? []).filter(r => !r.found));

  readonly treeOptions = computed<ChipOption[]>(() =>
    (this.history()?.roots ?? []).filter(r => r.found).map(r => ({ value: r.key, label: r.key })));

  /** Categories present in the selected trees, so a chip never filters to nothing. */
  readonly categoryOptions = computed<ChipOption[]>(() => {
    this.translate.currentLang();
    const trees = this.selectedTrees();
    const cats = new Set<string>();
    for (const d of this.history()?.items ?? []) {
      if (trees.length && !trees.includes(d.rootKey)) continue;
      cats.add(d.category ?? '');
    }
    return [...cats].sort().map(c => ({
      value: c,
      label: c || this.translate.instant('PROFILES.DOC_HISTORY.ROOT_FILES'),
    }));
  });

  readonly filtered = computed<DocumentHistoryEntry[]>(() => {
    const items = this.history()?.items ?? [];
    const trees = this.selectedTrees();
    const cats  = this.selectedCategories();
    const q     = fold(this.search());
    return items.filter(d =>
      (!trees.length || trees.includes(d.rootKey))
      && (!cats.length || cats.includes(d.category ?? ''))
      && (!q || fold(d.name + ' ' + d.folderPath).includes(q)));
  });

  /** Month buckets, newest first — the list already arrives sorted by modification date. */
  readonly groups = computed<MonthGroup[]>(() => {
    const lang = this.locale();
    const out: MonthGroup[] = [];
    for (const d of this.filtered()) {
      const key = d.modifiedAt?.slice(0, 7) ?? '';
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: key ? monthLabel(key, lang) : this.translate.instant('PROFILES.DOC_HISTORY.NO_DATE'), items: [] };
        out.push(g);
      }
      g.items.push(d);
    }
    return out;
  });

  /**
   * Same blob-in-a-new-tab shape as the Documents tab: the bytes come through rh-service, so
   * the permission check stays ours and the viewer needs no access to the HR site.
   */
  open(d: DocumentHistoryEntry): void {
    if (this.opening()) return;
    this.opening.set(d.id);
    this.svc.download(this.profileId(), d.id).subscribe({
      next: blob => {
        this.opening.set(null);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => {
        this.opening.set(null);
        this.notify.error(this.translate.instant('PROFILES.DOC_HISTORY.ERR_OPEN'));
      },
    });
  }

  /** The folder path under the category, e.g. `2026` for `01_Pay-Slip/2026`. */
  subPath(d: DocumentHistoryEntry): string | null {
    const slash = d.folderPath.indexOf('/');
    return slash < 0 ? null : d.folderPath.slice(slash + 1).replace(/\//g, ' › ');
  }

  fileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) return 'image';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'table_chart';
    if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(ext)) return 'description';
    if (['msg', 'eml'].includes(ext)) return 'mail';
    if (['zip', 'rar', '7z'].includes(ext)) return 'folder_zip';
    return 'draft';
  }

  fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  fmtDateTime(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString(this.locale(),
      { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  fmtTime(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString(this.locale(), { hour: '2-digit', minute: '2-digit' });
  }

  private locale(): string {
    const lang = this.translate.currentLang() ?? 'fr';
    return lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar-TN' : 'fr-FR';
  }
}

/** Case- and accent-insensitive search form. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim();
}

function monthLabel(yyyyMm: string, locale: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  const label = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
