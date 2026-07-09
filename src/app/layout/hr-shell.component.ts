import { Component, Injector, OnInit, computed, inject, signal } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';
import { UserStore } from '../core/user.store';
import { AuthService } from '../core/auth.service';
import { RemoteStylesService } from '../core/remote-styles.service';
import { SideNavComponent } from '@khalilrebhiitec/daf360';
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
  permission: string | null;
}

const APP_NAV_DEFS: AppNavDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: 'dashboard', permission: null },
  { id: 'profiles', label: 'Profils', icon: 'account_circle', route: 'profiles', permission: null },
  {
    id: 'recrutement',
    label: 'Pipeline de Recrutement',
    icon: 'analytics',
    route: 'recrutement',
    permission: null,
  },
  {
    id: 'candidates',
    label: 'Candidats',
    icon: 'group_add',
    route: 'candidates',
    permission: null,
  },
  {
    id: 'it-provisioning',
    label: 'Provisioning IT',
    icon: 'devices',
    route: 'it-provisioning',
    permission: null,
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    icon: 'person_add',
    route: 'onboarding',
    permission: null,
  },
  // { id: 'leave', label: 'Congés', icon: 'beach_access', route: 'leave', permission: null },
  // { id: 'lifecycle', label: 'Lifecycle', icon: 'timeline', route: 'lifecycle', permission: null },
  { id: 'requests', label: 'Demandes', icon: 'inbox', route: 'requests', permission: null },
  { id: 'admin', label: 'Admin', icon: 'admin_panel_settings', route: 'admin', permission: null },
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
  private http = inject(HttpClient);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private injector = inject(Injector);
  private translate = inject(TranslateService);
  private remoteStyles = inject(RemoteStylesService);

  constructor() {
    // Register RH translations into whatever TranslateService is active —
    // standalone: the one from appConfig; federated: the shell's singleton.
    // Must run before child routes render so pipes find the keys on first eval.
    // setTranslation is called BEFORE use() so loadOrExtendLanguage sees the
    // translations as already present and skips the loader entirely.
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

  readonly activeRoute = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url, injector: this.injector },
  );

  readonly navItems = computed<NavItem[]>(() =>
    APP_NAV_DEFS.filter(
      (def) => def.permission === null || this.userStore.hasPermission(def.permission),
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
    const stylesUrl = environment.production
      ? '/remotes/rh/styles.css'
      : 'http://localhost:4203/styles.css';
    this.remoteStyles.injectStyles(stylesUrl);

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
