import { Component, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import {
  ButtonComponent, DafHasPermissionDirective, PageComponent, PageHeaderComponent,
} from '@khalilrebhiitec/daf360';

import { CandidatesTabsComponent, CandidatesTab } from './components/candidates-tabs.component';
import { CandidatesKpisComponent } from './components/candidates-kpis.component';
import { CandidatesPageState } from './candidates-page.state';

/**
 * /rh/candidates — the « Candidats » page shell: title, « Nouveau candidat », the KPI row and
 * the tab strip are drawn ONCE here, and only the tab's content changes underneath (the
 * child route in the outlet: Kanban, Historique, Archivés).
 *
 * The tabs used to be three sibling pages, each redrawing the header, refetching the KPIs
 * and replaying the first-load skeleton on every tab click. They are child routes now: the
 * URLs are the same (`candidates`, `candidates/historique`, `candidates/archives`), so
 * bookmarks and « back » from a candidate still land on the right tab.
 *
 * Layout: `daf-page` gives its children a 32px flex rhythm. The outlet element itself is
 * hidden (it would count as a flex item and add a gap), and every tab component's host is
 * `display: contents`, so its sections sit in this same column exactly as before.
 */
@Component({
  selector: 'rh-candidates-page',
  standalone: true,
  imports: [
    PageComponent, PageHeaderComponent, ButtonComponent, DafHasPermissionDirective,
    CandidatesTabsComponent, CandidatesKpisComponent, RouterOutlet, TranslatePipe,
  ],
  template: `
    <daf-page [loading]="!state.loaded()" [kpis]="3">

      <daf-page-header
        [title]="'PIPELINE.TITLE' | translate"
        [subtitle]="'PIPELINE.SUBTITLE' | translate">
        <ng-container pageActions>
          <daf-button *dafHasPermission="'CREATE_CANDIDATE'"
            [options]="{ variant: 'teal', label: ('PIPELINE.NEW_CANDIDATE' | translate), iconStart: 'add' }"
            (onClick)="newCandidate()" />
        </ng-container>
      </daf-page-header>

      <!-- Page-level KPIs ABOVE the tab strip: the same row, loaded once, on every tab. -->
      <rh-candidates-kpis [stats]="state.stats()" />

      <rh-candidates-tabs [active]="activeTab()" />

      <router-outlet style="display: none" />
    </daf-page>
  `,
})
export class CandidatesPageComponent implements OnInit {
  private readonly router = inject(Router);
  protected readonly state = inject(CandidatesPageState);

  /** The tab of the current URL — the strip follows the route, back/forward included. */
  protected readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => CandidatesPageComponent.tabOf(this.router.url)),
    ),
    { initialValue: CandidatesPageComponent.tabOf(this.router.url) },
  );

  ngOnInit(): void {
    this.state.reload();
  }

  newCandidate(): void {
    this.router.navigate(['/rh/candidates', 'new']);
  }

  private static tabOf(url: string): CandidatesTab {
    const path = url.split(/[?#]/)[0];
    if (path.endsWith('/historique')) return 'history';
    if (path.endsWith('/archives')) return 'archived';
    return 'board';
  }
}
