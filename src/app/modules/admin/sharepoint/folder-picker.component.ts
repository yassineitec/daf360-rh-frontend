import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { ButtonComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe } from '@ngx-translate/core';
import { ModalComponent } from '../../../shared/modal.component';
import { SharePointAdminService } from './sharepoint-admin.service';

/**
 * Browses the SharePoint tree so a path can be picked instead of typed.
 *
 * The whole reason this exists: the folder names in HR's tree cannot be guessed from outside
 * it. The payroll tree holds `Bilel ZEDINI-CDI-ARX tunisie` where every sibling is
 * `Firstname LASTNAME`, one contracts folder is `Abir  ESSAYEM` with two spaces, another is
 * accented while its namesakes are not, and a junk `OLD` folder sits among the employees.
 * Typing a path from memory gets one of those wrong; clicking through the real tree cannot.
 *
 * Emits a path relative to the drive root, never a trailing slash — the shape the backend's
 * path validation accepts.
 */
@Component({
  selector: 'app-folder-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ButtonComponent, TranslatePipe],
  template: `
    <app-modal
      [title]="'ADMIN.sharepoint.picker.title' | translate"
      [visible]="visible()"
      [hasFooter]="true"
      size="lg"
      (closed)="cancel.emit()">

      <!-- Breadcrumb: every ancestor is clickable, so a wrong turn costs one click -->
      <nav class="fp-crumbs">
        <button type="button" class="fp-crumb" (click)="goTo(-1)">
          {{ 'ADMIN.sharepoint.picker.root' | translate }}
        </button>
        @for (seg of segments(); track $index) {
          <span class="fp-sep material-symbols-outlined">chevron_right</span>
          <button type="button" class="fp-crumb"
                  [class.fp-crumb--current]="$index === segments().length - 1"
                  (click)="goTo($index)">{{ seg }}</button>
        }
      </nav>

      @if (error()) {
        <div class="fp-error">{{ 'ADMIN.sharepoint.picker.error' | translate }}</div>
      }

      @if (loading()) {
        <p class="fp-hint">{{ 'ADMIN.sharepoint.picker.loading' | translate }}</p>
      } @else if (folders().length === 0) {
        <!-- Not an error: a leaf folder is a perfectly good thing to select. -->
        <p class="fp-hint">{{ 'ADMIN.sharepoint.picker.leaf' | translate }}</p>
      } @else {
        <ul class="fp-list">
          @for (folder of folders(); track folder) {
            <li>
              <button type="button" class="fp-item" (click)="enter(folder)">
                <span class="material-symbols-outlined fp-item-icon">folder</span>
                <span class="fp-item-name">{{ folder }}</span>
                <span class="material-symbols-outlined fp-item-go">chevron_right</span>
              </button>
            </li>
          }
        </ul>
      }

      <div class="fp-current">
        <span class="fp-current-label">{{ 'ADMIN.sharepoint.picker.selected' | translate }}</span>
        <code class="fp-current-path">{{ path() || ('ADMIN.sharepoint.picker.root' | translate) }}</code>
      </div>

      <div slot="footer">
        <daf-button [label]="'ADMIN.sharepoint.picker.cancel' | translate"
                    variant="secondary" (onClick)="cancel.emit()" />
        <daf-button [label]="'ADMIN.sharepoint.picker.choose' | translate"
                    variant="teal"
                    [options]="{ disabled: !path() }"
                    (onClick)="choose.emit(path())" />
      </div>
    </app-modal>
  `,
  styles: [`
    .fp-crumbs { display:flex;flex-wrap:wrap;align-items:center;gap:2px;margin-bottom:12px }
    .fp-crumb  { background:none;border:0;padding:2px 6px;border-radius:6px;cursor:pointer;
                 font-size:var(--text-body-sm);color:var(--color-primary);font-family:inherit }
    .fp-crumb:hover { background:var(--color-surface-container) }
    .fp-crumb--current { color:var(--color-on-surface);font-weight:600 }
    .fp-sep    { font-size:16px;color:var(--color-outline) }
    .fp-list   { list-style:none;margin:0;padding:0;max-height:340px;overflow-y:auto;
                 border:1px solid var(--color-outline-variant);border-radius:10px }
    .fp-list li + li { border-top:1px solid var(--color-outline-variant) }
    .fp-item   { display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;
                 background:none;border:0;cursor:pointer;text-align:left;font-family:inherit }
    .fp-item:hover { background:var(--color-surface-container) }
    .fp-item-icon { font-size:18px;color:var(--color-warning) }
    .fp-item-name { flex:1;font-size:var(--text-body-sm);color:var(--color-on-surface) }
    .fp-item-go   { font-size:18px;color:var(--color-outline) }
    .fp-hint   { font-size:var(--text-body-sm);color:var(--color-on-surface-variant);
                 text-align:center;padding:24px;margin:0 }
    .fp-error  { background:var(--color-error-container);border-radius:8px;padding:10px 14px;
                 font-size:var(--text-body-sm);color:var(--color-on-error-container);margin-bottom:12px }
    .fp-current { display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;margin-top:14px;
                  padding-top:12px;border-top:1px solid var(--color-outline-variant) }
    .fp-current-label { font-size:var(--text-body-sm);color:var(--color-on-surface-variant) }
    .fp-current-path  { font-size:var(--text-body-sm);color:var(--color-on-surface);
                        background:var(--color-surface-container);padding:2px 8px;border-radius:6px;
                        word-break:break-all }
  `],
})
export class FolderPickerComponent {
  private readonly svc = inject(SharePointAdminService);

  readonly visible = input(false);
  /** Where to open. A path already configured lands the picker beside it, not at the root. */
  readonly startPath = input('');

  readonly choose = output<string>();
  readonly cancel = output<void>();

  readonly path     = signal('');
  readonly folders  = signal<string[]>([]);
  readonly loading  = signal(false);
  readonly error    = signal(false);

  readonly segments = signal<string[]>([]);

  constructor() {
    // Re-open at startPath each time it becomes visible, rather than wherever the last
    // session was left: the picker is opened from several places, and inheriting an unrelated
    // location is worse than always starting somewhere predictable.
    effect(() => {
      if (!this.visible()) return;
      const start = this.startPath();
      this.load(this.trimTemplate(start));
    });
  }

  /**
   * Strips the placeholder tail off a configured template so the picker opens at the deepest
   * REAL folder. `.../03_Payroll-Admin/{employeeFolder}/01_Pay-Slip/{year}` opens at
   * `.../03_Payroll-Admin` — everything after the first token varies per employee and does not
   * exist as a browsable path.
   */
  private trimTemplate(template: string): string {
    const token = template.indexOf('{');
    const cut = token < 0 ? template : template.slice(0, token);
    return cut.replace(/\/+$/, '');
  }

  private load(path: string): void {
    this.loading.set(true);
    this.error.set(false);
    this.svc.browse(path).subscribe({
      next: listing => {
        this.path.set(listing.path);
        this.segments.set(listing.path ? listing.path.split('/') : []);
        this.folders.set(listing.folders);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.folders.set([]);
        this.loading.set(false);
      },
    });
  }

  enter(folder: string): void {
    const next = this.path() ? `${this.path()}/${folder}` : folder;
    this.load(next);
  }

  /** @param index -1 for the root, otherwise the breadcrumb segment to return to. */
  goTo(index: number): void {
    this.load(index < 0 ? '' : this.segments().slice(0, index + 1).join('/'));
  }
}
