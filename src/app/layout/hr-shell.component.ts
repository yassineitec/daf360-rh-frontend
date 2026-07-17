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
  label: string;
  icon: string;
  route: string;
  /** Any-of gate; empty = visible to every authenticated user. */
  permissions: string[];
}

const APP_NAV_DEFS: AppNavDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: 'dashboard', permissions: [] },
  { id: 'profiles', label: 'Profiles', icon: 'account_circle', route: 'profiles', permissions: [] },
  {
    id: 'recrutement',
    label: 'Pipeline RH',
    icon: 'analytics',
    route: 'recrutement',
    permissions: ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE'],
  },
  {
    id: 'candidates',
    label: 'Candidats',
    icon: 'group_add',
    route: 'candidates',
    permissions: ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE', 'CREATE_CANDIDATE'],
  },
  {
    id: 'it-provisioning',
    label: 'Provisioning IT',
    icon: 'devices',
    route: 'it-provisioning',
    permissions: ['IT_PROVISIONING'],
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    icon: 'person_add',
    route: 'onboarding',
    permissions: ['HR_ONBOARDING'],
  },
  { id: 'requests', label: 'Demandes', icon: 'inbox', route: 'requests', permissions: ['HR_UPDATE_PROFILE', 'HR_ADMIN_ROLES'] },
  {
    id: 'admin',
    label: 'Admin',
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
  sidebarOpen     = signal(false);

  private readonly rawUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url, injector: this.injector },
  );

  // daf-side-nav highlights on an exact `activeRoute === item.route` match, but nav
  // routes are single segments ('dashboard', 'admin', …) while the URL is absolute
  // (e.g. /rh/admin/roles). Map the live URL to the matching nav segment (longest
  // match first) so nested/child routes still light up their top-level item.
  readonly activeRoute = computed(() => {
    const url = (this.rawUrl() ?? '').split(/[?#]/)[0];
    const match = [...APP_NAV_DEFS]
      .sort((a, b) => b.route.length - a.route.length)
      .find((d) => new RegExp(`(^|/)${d.route}(/|$)`).test(url));
    return match ? match.route : '';
  });

  readonly navItems = computed<NavItem[]>(() =>
    APP_NAV_DEFS.filter(
      (def) => def.permissions.length === 0 || this.perm.hasAny(def.permissions),
    ).map((def) => ({
      id: def.id,
      label: def.label,
      icon: def.icon,
      route: def.route,
      ...(def.id === 'onboarding' && this.onboardingCount() > 0
        ? { badge: this.onboardingCount() }
        : {}),
    })),
  );

  readonly sideNavConfig: SideNavConfig = {
    sectionLabel: 'NAVIGATION RH',
    collapsible: true,
  };

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
      this.router.navigate([item.route], { relativeTo: this.activatedRoute });
    }
    this.sidebarOpen.set(false);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
  }
}
