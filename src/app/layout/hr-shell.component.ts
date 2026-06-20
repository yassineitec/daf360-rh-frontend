import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { RouterLink, RouterLinkActive, RouterOutlet, ActivatedRoute } from '@angular/router';
import { UserStore }                 from '../core/user.store';
import { AuthService }               from '../core/auth.service';
import { NotificationPanelComponent } from '../shared/notification-panel.component';

interface NavItem {
  path:       string;
  label:      string;
  permission: string | null;  // null = visible to all authenticated users
  icon:       string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/hr/profiles',    label: 'Profils',    icon: 'users',      permission: 'HR_CREATE_PROFILE' },
  { path: '/hr/recrutement', label: 'Pipeline RH', icon: 'pipeline', permission: 'VIEW_CANDIDATES' },
  { path: '/hr/candidates', label: 'Candidats', icon: 'users-plus', permission: 'VIEW_CANDIDATES' },
  { path: '/hr/it-provisioning', label: 'Provisioning IT', icon: 'server', permission: 'IT_PROVISIONING' },
  { path: '/hr/onboarding', label: 'Onboarding', icon: 'user-check', permission: 'HR_ONBOARDING' },
  { path: '/hr/leave',      label: 'Congés',    icon: 'calendar',   permission: 'RESPONSE_LEAVE' },
  { path: '/hr/lifecycle',  label: 'Lifecycle', icon: 'activity', permission: 'VIEW_WORKFLOW' },
  { path: '/hr/recruitment-demands', label: 'Expr. de besoin', icon: 'briefcase', permission: 'RH_VIEW_RECRUITMENT_DEMAND' },
  { path: '/hr/requests',   label: 'Demandes',  icon: 'inbox',    permission: null },
  { path: '/hr/admin',      label: 'Admin',     icon: 'settings', permission: 'HR_ADMIN_ROLES' },
];

@Component({
  selector: 'app-hr-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationPanelComponent],
  templateUrl: './hr-shell.component.html',
  styleUrl: './hr-shell.component.scss',
})
export class HrShellComponent implements OnInit {
  private userStore = inject(UserStore);
  private auth      = inject(AuthService);
  private http      = inject(HttpClient);

  readonly user     = this.userStore.currentUser;
  readonly initials = this.userStore.userInitials;

  readonly visibleNavItems = computed(() =>
    NAV_ITEMS.filter(item =>
      item.permission === null || this.userStore.hasPermission(item.permission)
    )
  );

  notificationCount    = signal(0);
  sidebarOpen          = signal(true);
  onboardingCount      = signal(0);
  lifecycleAlertCount  = signal(0);

  icons: Record<string, string> = {
    users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    'users-plus': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3z"/><path d="M2 21v-1a4 4 0 0 1 4-4h8"/><line x1="19" y1="15" x2="19" y2="21"/><line x1="16" y1="18" x2="22" y2="18"/></svg>`,
    pipeline: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="12" x2="2" y2="12"/><polyline points="15 5 22 12 15 19"/><polyline points="9 5 2 12 9 19"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    activity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    inbox: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
    coin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>`,
    server: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
    'user-check': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>`,
    briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  };

  showNotifications = signal(false);

  ngOnInit(): void {
    if (this.userStore.hasPermission('HR_ONBOARDING')) {
      this.http.get<any[]>(`${environment.hrApiUrl}/api/hr/onboarding/pending`).subscribe({
        next: list => this.onboardingCount.set(list.length),
        error: () => {},
      });
    }
    const paysId = this.userStore.currentUser()?.paysId;
    if (paysId && this.userStore.hasPermission('RH_VIEW_CONTRACTS')) {
      this.http.get<any[]>(`${environment.hrApiUrl}/api/hr/lifecycle/alerts?paysId=${paysId}&acknowledged=false`).subscribe({
        next: list => this.lifecycleAlertCount.set(list.length),
        error: () => {},
      });
    }
  }

  logout() { this.auth.logout(); }
  toggleSidebar() { this.sidebarOpen.update(v => !v); }
}
