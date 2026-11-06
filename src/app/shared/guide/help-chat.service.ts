import { Injectable, signal } from '@angular/core';

/** Open state of the help assistant's bubble (`rh-help-chat`), so a page can open it. */
@Injectable({ providedIn: 'root' })
export class HelpChatService {
  readonly open = signal(false);
}
