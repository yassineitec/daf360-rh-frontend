import { Component, Injector, OnInit, computed, inject, signal } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';
import { UserStore } from '../core/user.store';
import { AuthService } from '../core/auth.service';
import { SideNavComponent, PermissionService } from '@khalilrebhiitec/daf360';
import type { NavItem, SideNavConfig } from '@khalilrebhiitec/daf360';
import { TranslateService } from '@ngx-translate/core';
import en from '@public/assets/i18n/en.json';
import fr from '@public/assets/i18n/fr.json';
import ar from '@public/assets/i18n/ar.json';

interface AppNavDef {
  id: string;
  /** i18n key under NAV.*, resolved in `navItems` — never a literal label. */
  labelKey: string;
  icon: string;
  route: string;
  /** Any-of gate; empty = visible to every authenticated user. */
  permissions: string[];
  /**
   * Sub-entries, rendered by `daf-side-nav` as an expandable group (one level only —
   * see `NavItem.children` in the lib). `route` is a full path relative to the shell,
   * so it holds several segments where a top-level entry holds one.
   */
  children?: AppNavDef[];
}

const APP_NAV_DEFS: AppNavDef[] = [
  { id: 'accueil', labelKey: 'NAV.ACCUEIL', icon: 'home', route: 'accueil', permissions: [] },
  { id: 'profiles', labelKey: 'NAV.PROFILES', icon: 'account_circle', route: 'profiles', permissions: [] },
  {
    id: 'recrutement',
    labelKey: 'NAV.PIPELINE',
    icon: 'analytics',
    route: 'recrutement',
    permissions: ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE'],
  },
  {
    id: 'candidates',
    labelKey: 'NAV.CANDIDATES',
    icon: 'group_add',
    route: 'candidates',
    permissions: ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE', 'CREATE_CANDIDATE'],
  },
  {
    id: 'it-provisioning',
    labelKey: 'NAV.IT_PROVISIONING',
    icon: 'devices',
    route: 'it-provisioning',
    permissions: ['IT_PROVISIONING'],
  },
  {
    id: 'onboarding',
    labelKey: 'NAV.ONBOARDING',
    icon: 'person_add',
    route: 'onboarding',
    permissions: ['HR_ONBOARDING'],
  },
  {
    id: 'offboarding',
    labelKey: 'NAV.OFFBOARDING',
    icon: 'logout',
    route: 'offboarding',
    permissions: ['RH_MANAGE_OFFBOARDING', 'RH_VIEW_CONTRACTS', 'RH_MANAGE_LIFECYCLE'],
    // One child per departure reason. Only RESIGNATION for now, by request; the other
    // six codes of `DEPARTURE_REASONS` are added here, one line each, when wanted.
    // The parent entry stays and keeps showing every reason.
    children: [
      {
        id: 'offboarding-resignation',
        labelKey: 'NAV.OFFBOARDING_RESIGNATION',
        icon: 'edit_document',
        route: 'offboarding/type/RESIGNATION',
        permissions: ['RH_MANAGE_OFFBOARDING', 'RH_VIEW_CONTRACTS', 'RH_MANAGE_LIFECYCLE'],
      },
    ],
  },
  { id: 'requests', labelKey: 'NAV.REQUESTS', icon: 'inbox', route: 'requests', permissions: ['HR_UPDATE_PROFILE', 'HR_ADMIN_ROLES'] },
  {
    id: 'admin',
    labelKey: 'NAV.ADMIN',
    icon: 'admin_panel_settings',
    route: 'admin',
    permissions: ['ADMIN_ROLES', 'HR_ADMIN_ROLES', 'GET_ROLES', 'ADMIN_LISTS', 'ADMIN_REGIMES', 'ADMIN_BREAKS', 'ADMIN_NOTIFICATIONS'],
  },
];

@Component({
  selector: 'app-hr-shell',
  standalone: true,
  imports: [RouterOutlet, SideNavComponent],
  templateUrl: './hr-shell.component.html',
  styleUrl: './hr-shell.component.scss',
  host: { style: 'display:block;height:100%' },
})
export class HrShellComponent implements OnInit {
  private userStore = inject(UserStore);
  private perm = inject(PermissionService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private injector = inject(Injector);
  private translate = inject(TranslateService);

  constructor() {
    // Populate the RH translation store. The shell route now provides an ISOLATED
    // child TranslateService (see app.routes), so this writes to RH's OWN store and
    // never clobbers the shell host's translations. Runs before child routes render
    // so pipes find the keys on first eval; setTranslation before use() lets
    // loadOrExtendLanguage skip the loader.
    this.translate.setTranslation('fr', fr, true);
    this.translate.setTranslation('en', en, true);
    this.translate.setTranslation('ar', ar, true);
    // getCurrentLang() returns string | null (snapshot, not signal).
    // Only activate 'fr' when nothing is set; respect whatever lang the shell picked.
    if (!this.translate.getCurrentLang()) {
      this.translate.use('fr');
    }
  }

  onboardingCount = signal(0);

  private readonly rawUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url, injector: this.injector },
  );

  // daf-side-nav highlights on an exact `activeRoute === item.route` match, but nav
  // routes are single segments ('accueil', 'admin', …) while the URL is absolute
  // (e.g. /rh/admin/roles). Map the live URL to the matching nav segment (longest
  // match first) so nested/child routes still light up their top-level item.
  //
  // Sub-entries are in the same pool, and longest-match-first is what makes them win:
  // on /rh/offboarding/type/RESIGNATION both 'offboarding/type/RESIGNATION' and
  // 'offboarding' match, and returning the parent would leave the child permanently
  // unlit. The lib lights the parent anyway, via its own `hasActiveChild`.
  readonly activeRoute = computed(() => {
    const url = (this.rawUrl() ?? '').split(/[?#]/)[0];
    const match = APP_NAV_DEFS.flatMap((d) => [d, ...(d.children ?? [])])
      .sort((a, b) => b.route.length - a.route.length)
      .find((d) => new RegExp(`(^|/)${d.route}(/|$)`).test(url));
    return match ? match.route : '';
  });

  // `translate.instant` is a plain call, not reactive — reading `currentLang()` (a
  // Signal in ngx-translate v18) is what makes these recompute on a language switch.
  // Without it the sidebar keeps the labels of whatever language was active at first
  // render. daf-side-nav takes NavItem/SideNavConfig objects, not templates, so the
  // translate PIPE isn't an option here.
  readonly navItems = computed<NavItem[]>(() => {
    this.translate.currentLang();
    const visible = (def: AppNavDef) =>
      def.permissions.length === 0 || this.perm.hasAny(def.permissions);

    const toNavItem = (def: AppNavDef): NavItem => {
      const children = (def.children ?? []).filter(visible).map(toNavItem);
      return {
        id: def.id,
        label: this.translate.instant(def.labelKey),
        icon: def.icon,
        route: def.route,
        // Omitted when empty: `children: []` would still make the lib treat the item as
        // an expandable group, so it would render a chevron that opens nothing.
        ...(children.length ? { children } : {}),
        ...(def.id === 'onboarding' && this.onboardingCount() > 0
          ? { badge: this.onboardingCount() }
          : {}),
      };
    };

    return APP_NAV_DEFS.filter(visible).map(toNavItem);
  });

  readonly sideNavConfig = computed<SideNavConfig>(() => {
    this.translate.currentLang();
    return {
      sectionLabel: this.translate.instant('NAV.SECTION_LABEL'),
      collapsible: true,
    };
  });

  ngOnInit(): void {
    // NOTE: the remote's styles.css is injected + awaited by the shell
    // (ensureRemoteStyles) before this route activates — no runtime injection here.
    if (this.userStore.hasPermission('HR_ONBOARDING')) {
      this.http.get<any[]>(`${environment.hrApiUrl}/api/hr/onboarding/pending`).subscribe({
        next: (list) => this.onboardingCount.set(list.length),
        error: () => {},
      });
    }
    const paysId = this.userStore.currentUser()?.paysId;
    // if (paysId && this.userStore.hasPermission('RH_VIEW_CONTRACTS')) {
    //   this.http.get<any[]>(`${environment.hrApiUrl}/api/hr/lifecycle/alerts?paysId=${paysId}&acknowledged=false`).subscribe({
    //     next: list => this.lifecycleAlertCount.set(list.length),
    //     error: () => {},
    //   });
    // }
  }

  onNavClick(item: NavItem): void {
    if (item.route) {
      // Split: a sub-entry's route is multi-segment ('offboarding/type/RESIGNATION'),
      // and one array element per segment is unambiguous where a single slash-bearing
      // string relies on the router re-parsing it.
      this.router.navigate(item.route.split('/'), { relativeTo: this.activatedRoute });
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
