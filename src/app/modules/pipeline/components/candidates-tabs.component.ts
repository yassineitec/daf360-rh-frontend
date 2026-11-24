import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TabItem, TabsComponent } from '@khalilrebhiitec/daf360';

export type CandidatesTab = 'board' | 'history' | 'archived';

/** Each tab's own URL — kept, so bookmarks and the breadcrumbs back from a candidate land. */
const TAB_URL: Record<CandidatesTab, string[]> = {
  board:   ['/rh/candidates'],
  history: ['/rh/candidates', 'historique'],
  archived: ['/rh/candidates', 'archives'],
};

/**
 * The tabs of « Candidats » — the recruitment board, « Historique » (every action on
 * every candidature, with who took it) and « Archivés » (closed candidatures, with why).
 *
 * Route-backed: each tab keeps its own component, its own remembered filters and its own URL
 * (`candidates` / `candidates/historique` / `candidates/archives`). They are CHILD routes of
 * CandidatesPageComponent, which draws this strip once with the title and the KPIs — a tab
 * click only swaps the content under it, nothing above it reloads.
 */
@Component({
  selector: 'rh-candidates-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TabsComponent],
  host: { class: 'block' },
  template: `
    <daf-tabs
      variant="underline"
      style="--daf-tabs-fade: var(--color-background)"
      idPrefix="candidates"
      [tabs]="tabs()"
      [active]="active()"
      (activeChange)="go($event)" />
  `,
})
export class CandidatesTabsComponent {
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  /** The tab of the page drawing the strip. */
  readonly active = input.required<CandidatesTab>();

  protected readonly tabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'board',   label: this.translate.instant('CANDIDATES.TABS.BOARD'),   icon: 'view_kanban' },
      { id: 'history', label: this.translate.instant('CANDIDATES.TABS.HISTORY'), icon: 'history' },
      { id: 'archived', label: this.translate.instant('CANDIDATES.TABS.ARCHIVED'), icon: 'inventory_2' },
    ];
  });

  protected go(id: string): void {
    if (id === this.active() || !(id in TAB_URL)) return;
    this.router.navigate(TAB_URL[id as CandidatesTab]);
  }
}
