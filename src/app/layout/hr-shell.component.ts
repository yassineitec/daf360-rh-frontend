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

interface AppNavDef {
  id: string;
  label: string;
  icon: string;
  route: string;
  permission: string | null;
}

const APP_NAV_DEFS: AppNavDef[] = [
  { id: 'dashboard',       label: 'Dashboard',       icon: 'dashboard',            route: 'dashboard',       permission: null },
  { id: 'profiles',        label: 'Profils',         icon: 'account_circle',       route: 'profiles',        permission: null },
  { id: 'recrutement',     label: 'Pipeline RH',     icon: 'analytics',            route: 'recrutement',     permission: 'VIEW_CANDIDATES' },
  { id: 'candidates',      label: 'Candidats',       icon: 'group_add',            route: 'candidates',      permission: 'VIEW_CANDIDATES' },
  { id: 'it-provisioning', label: 'Provisioning IT', icon: 'devices',              route: 'it-provisioning', permission: 'IT_PROVISIONING' },
  { id: 'onboarding',      label: 'Onboarding',      icon: 'person_add',           route: 'onboarding',      permission: 'HR_ONBOARDING' },
  { id: 'leave',           label: 'Congés',          icon: 'beach_access',         route: 'leave',           permission: 'RESPONSE_LEAVE' },
  { id: 'lifecycle',       label: 'Lifecycle',       icon: 'timeline',             route: 'lifecycle',       permission: 'VIEW_WORKFLOW' },
  { id: 'requests',        label: 'Demandes',        icon: 'inbox',                route: 'requests',        permission: null },
  { id: 'admin',           label: 'Admin',           icon: 'admin_panel_settings', route: 'admin',           permission: 'HR_ADMIN_ROLES' },
];

@Component({
  selector: 'app-hr-shell',
  standalone: true,
  imports: [RouterOutlet, SideNavComponent],
  templateUrl: './hr-shell.component.html',
})
export class HrShellComponent implements OnInit {
  private userStore       = inject(UserStore);
  private http            = inject(HttpClient);
  private router          = inject(Router);
  private activatedRoute  = inject(ActivatedRoute);
  private auth            = inject(AuthService);
  private injector        = inject(Injector);
  private remoteStyles    = inject(RemoteStylesService);

  onboardingCount = signal(0);

  readonly activeRoute = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url, injector: this.injector },
  );

  readonly navItems = computed<NavItem[]>(() =>
    APP_NAV_DEFS
      .filter(def => def.permission === null || this.userStore.hasPermission(def.permission))
      .map(def => ({
        id:    def.id,
        label: def.label,
        icon:  def.icon,
        route: def.route,
        ...(def.id === 'onboarding' && this.onboardingCount() > 0
          ? { badge: this.onboardingCount() }
          : {}),
      }))
  );

  readonly sideNavConfig: SideNavConfig = {
    sectionLabel: 'NAVIGATION RH',
    collapsible:  true,
  };

  ngOnInit(): void {
    this.remoteStyles.injectStyles(4203);
    if (this.userStore.hasPermission('HR_ONBOARDING')) {
      this.http.get<any[]>(`${environment.hrApiUrl}/api/hr/onboarding/pending`).subscribe({
        next:  list => this.onboardingCount.set(list.length),
        error: ()   => {},
      });
    }
  }

  onNavClick(item: NavItem): void {
    if (item.route) {
      this.router.navigate([item.route], { relativeTo: this.activatedRoute });
    }
  }

  logout(): void { this.auth.logout(); }
}
