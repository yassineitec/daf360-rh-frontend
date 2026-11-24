import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TabItem, TabsComponent } from '@khalilrebhiitec/daf360';

export type CandidatesTab = 'board' | 'history';

/** Each tab's own URL — kept, so bookmarks and the breadcrumbs back from a candidate land. */
const TAB_URL: Record<CandidatesTab, string[]> = {
  board:   ['/rh/candidates'],
  history: ['/rh/candidates', 'historique'],
};

/**
 * The two tabs of « Candidats » — the recruitment board and « Historique » (every action on
 * every candidature, with who took it).
 *
 * Route-backed, like « Provisioning IT »: each tab keeps its own component, its own
 * remembered filters and its own URL (`candidates` / `candidates/historique`), so a tab
 * click is a navigation between them. Both pages draw this strip right under the same page
 * header, which is what makes them read as one page.
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
    ];
  });

  protected go(id: string): void {
    if (id === this.active() || !(id in TAB_URL)) return;
    this.router.navigate(TAB_URL[id as CandidatesTab]);
  }
}
