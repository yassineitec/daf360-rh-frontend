import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe],
  template: `
    <div class="shell">
      <!-- ── Sidebar ─────────────────────────────────────── -->
      <aside class="sidebar">
        <div class="sidebar-brand">
          <svg class="brand-mark" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#ffffff" fill-opacity="0.12"/>
            <path d="M7 9h14M7 14h9M7 19h11" stroke="white" stroke-width="2"
                  stroke-linecap="round"/>
          </svg>
          <div>
            <div class="brand-name">DAF360</div>
            <div class="brand-sub">Ressources Humaines</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <p class="nav-section-label">Modules</p>

          @for (item of navItems; track item.path) {
            <a class="nav-item"
               [routerLink]="item.path"
               routerLinkActive="active"
               [routerLinkActiveOptions]="{ exact: false }">
              <span class="nav-icon" [innerHTML]="item.icon"></span>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <a class="nav-item" [href]="portalUrl">
            <span class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M15 3h6v6M10 14L21 3M9 3H3v18h18v-6"
                      stroke="currentColor" stroke-width="1.8"
                      stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span>Back to Portal</span>
          </a>
        </div>
      </aside>

      <!-- ── Main ───────────────────────────────────────── -->
      <div class="main">
        <!-- Topbar -->
        <header class="topbar">
          <div class="topbar-left">
            <h1 class="topbar-title">HR Management</h1>
          </div>
          <div class="topbar-right">
            @if (user$ | async; as user) {
              <div class="user-chip">
                <div class="user-avatar">{{ initials(user.name) }}</div>
                <div class="user-text">
                  <span class="user-name">{{ user.name }}</span>
                  <span class="user-email">{{ user.email }}</span>
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" (click)="logout()">
                Sign out
              </button>
            }
          </div>
        </header>

        <!-- Content -->
        <main class="content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100dvh; }

    .shell {
      display: flex;
      height: 100%;
    }

    /* ── Sidebar ── */
    .sidebar {
      width: 220px;
      min-width: 220px;
      background: #111111;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 18px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    .brand-mark { width: 28px; height: 28px; flex-shrink: 0; }

    .brand-name {
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.03em;
    }

    .brand-sub {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.45);
      margin-top: 1px;
    }

    .sidebar-nav {
      flex: 1;
      padding: 12px 8px;
    }

    .nav-section-label {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: rgba(255,255,255,0.3);
      padding: 8px 10px 4px;
      margin: 0;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 6px;
      color: rgba(255,255,255,0.65);
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
      transition: background 0.12s, color 0.12s;
      cursor: pointer;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
      margin-bottom: 2px;
    }

    .nav-item:hover {
      background: rgba(255,255,255,0.08);
      color: #ffffff;
    }

    .nav-item.active {
      background: #ffffff;
      color: #111111;
    }

    .nav-item.active .nav-icon { opacity: 1; }

    .nav-icon {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
      flex-shrink: 0;
    }

    .sidebar-footer {
      padding: 8px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }

    /* ── Main ── */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #f8f8f8;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      height: 60px;
      background: #ffffff;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }

    .topbar-title {
      font-size: 1rem;
      font-weight: 600;
      color: #333;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .user-chip {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #333;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .user-text {
      display: flex;
      flex-direction: column;
    }

    .user-name  { font-size: 0.85rem; font-weight: 600; color: #111; }
    .user-email { font-size: 0.72rem; color: #888; }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }
  `],
})
export class ShellComponent {
  user$: ReturnType<AuthService['getUser']>;
  portalUrl: string;

  navItems: NavItem[] = [
    {
      label: 'Employees',
      path: '/employees',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
               <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/>
               <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
               <path d="M16 11a4 4 0 010 8M19 21v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
             </svg>`,
    },
    {
      label: 'Leave Requests',
      path: '/leaves',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
               <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/>
               <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
             </svg>`,
    },
    {
      label: 'Pay Slips',
      path: '/payslips',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
               <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                     stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
               <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
             </svg>`,
    },
    {
      label: 'Documents',
      path: '/documents',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
               <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                     stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
             </svg>`,
    },
    {
      label: 'Audit Log',
      path: '/audit',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
               <path d="M9 11l3 3L22 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
               <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
                     stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
             </svg>`,
    },
  ];

  constructor(private authService: AuthService) {
    this.portalUrl = environment.shellUrl || '/';
    this.user$ = this.authService.getUser();
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  }

  logout(): void {
    this.authService.logout();
  }
}
