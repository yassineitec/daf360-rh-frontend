import {
  Component, inject, input, OnChanges, output, signal, SimpleChanges,
} from '@angular/core';
import { catchError, of } from 'rxjs';
import { LifecycleService } from '../modules/lifecycle/lifecycle.service';
import { HrNotification }   from '../modules/lifecycle/models/lifecycle.model';

@Component({
  selector: 'app-notification-panel',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="backdrop" (click)="close.emit()" aria-hidden="true"></div>

      <aside class="panel" role="complementary" aria-label="Notifications">
        <header class="panel-header">
          <h2 class="panel-title">Notifications</h2>
          <div class="panel-actions">
            @if (hasUnread()) {
              <button class="mark-all-btn" (click)="markAllRead()" type="button">Tout lire</button>
            }
            <button class="close-btn" (click)="close.emit()" aria-label="Fermer" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </header>

        <div class="panel-body">
          @if (loading()) {
            <div class="loading-list">
              @for (_ of [1,2,3]; track $index) { <div class="notif-skeleton"></div> }
            </div>
          } @else if (notifications().length === 0) {
            <div class="empty-notifs">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <p>Aucune notification</p>
            </div>
          } @else {
            <ul class="notif-list" role="list">
              @for (n of notifications(); track n.id) {
                <li
                  class="notif-item"
                  [class.unread]="!n.isRead"
                  (click)="onNotifClick(n)"
                  role="button"
                  tabindex="0"
                  (keydown.enter)="onNotifClick(n)"
                >
                  <div class="notif-dot" [class.visible]="!n.isRead"></div>
                  <div class="notif-content">
                    <span class="notif-title">{{ n.title }}</span>
                    <span class="notif-msg">{{ n.message }}</span>
                    <span class="notif-time">{{ relativeTime(n.createdAt) }}</span>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      </aside>
    }
  `,
  styles: [`
    .backdrop {
      position: fixed; inset: 0; z-index: 800;
      background: rgba(0,0,0,.25);
      animation: fadeIn .15s ease;
    }
    .panel {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: min(380px, 100vw); z-index: 801;
      background: var(--color-surface, #fff);
      border-left: 1px solid var(--color-border, #E0E7E9);
      display: flex; flex-direction: column;
      box-shadow: -8px 0 32px rgba(0,0,0,.12);
      animation: slideIn .2s cubic-bezier(.4,0,.2,1);
    }
    @keyframes fadeIn  { from { opacity: 0; } }
    @keyframes slideIn { from { transform: translateX(100%); } }
    .panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid var(--color-border, #E0E7E9);
    }
    .panel-title   { font-size: 15px; font-weight: 600; margin: 0; }
    .panel-actions { display: flex; align-items: center; gap: 10px; }
    .mark-all-btn  { font-size: 12px; color: var(--color-primary, #1C4E5C); background: none; border: none; cursor: pointer; text-decoration: underline; }
    .close-btn     { background: none; border: none; cursor: pointer; display: flex; color: var(--color-text-muted, #6B7280); padding: 4px; border-radius: 4px; }
    .close-btn:hover { background: var(--color-bg-secondary, #EEF2F5); }
    .panel-body    { flex: 1; overflow-y: auto; }
    .loading-list  { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .notif-skeleton {
      height: 60px; border-radius: 8px;
      background: linear-gradient(90deg, #e8ecef 25%, #f0f4f8 50%, #e8ecef 75%);
      background-size: 200% 100%; animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .empty-notifs {
      padding: 48px 24px; text-align: center; color: var(--color-text-muted, #6B7280);
      display: flex; flex-direction: column; align-items: center; gap: 12px;
    }
    .empty-notifs svg { opacity: .3; }
    .empty-notifs p   { margin: 0; font-size: 13px; }
    .notif-list  { list-style: none; padding: 8px 0; margin: 0; }
    .notif-item  {
      display: flex; gap: 12px; align-items: flex-start;
      padding: 12px 20px; cursor: pointer; transition: background .1s;
    }
    .notif-item:hover  { background: var(--color-bg, #F8FAFB); }
    .notif-item.unread { background: var(--color-teal-50, #EBF4F7); }
    .notif-dot         { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; background: transparent; }
    .notif-dot.visible { background: var(--color-primary, #1C4E5C); }
    .notif-content     { display: flex; flex-direction: column; gap: 2px; flex: 1; }
    .notif-title  { font-size: 13px; font-weight: 600; color: var(--color-text, #1A1C1E); }
    .notif-msg    { font-size: 12px; color: var(--color-text-muted, #6B7280); line-height: 1.4; }
    .notif-time   { font-size: 10px; color: var(--color-text-subtle, #9CA3AF); margin-top: 2px; }
  `],
})
export class NotificationPanelComponent implements OnChanges {
  private svc = inject(LifecycleService);

  visible        = input(false);
  unreadCountOut = output<number>();
  close          = output<void>();

  loading       = signal(false);
  notifications = signal<HrNotification[]>([]);

  hasUnread() { return this.notifications().some(n => !n.isRead); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible']?.currentValue === true && this.notifications().length === 0) {
      this.load();
    }
  }

  private load() {
    this.loading.set(true);
    this.svc.listNotifications().pipe(catchError(() => of([]))).subscribe(list => {
      this.notifications.set(list);
      this.loading.set(false);
      this.emitCount();
    });
  }

  onNotifClick(n: HrNotification) {
    if (!n.isRead) {
      this.svc.markRead(n.id).pipe(catchError(() => of(null))).subscribe(() => {
        this.notifications.update(list =>
          list.map(x => x.id === n.id ? { ...x, isRead: true } : x)
        );
        this.emitCount();
      });
    }
  }

  markAllRead() {
    this.svc.markAllRead().pipe(catchError(() => of(null))).subscribe(() => {
      this.notifications.update(list => list.map(n => ({ ...n, isRead: true })));
      this.emitCount();
    });
  }

  private emitCount() {
    this.unreadCountOut.emit(this.notifications().filter(n => !n.isRead).length);
  }

  relativeTime(iso: string): string {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (m < 1)  return 'À l\'instant';
    if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h / 24)}j`;
  }
}
