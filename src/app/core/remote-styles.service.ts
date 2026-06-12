import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RemoteStylesService {
  injectStyles(port: number): void {
    const id = `remote-styles-${port}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `http://localhost:${port}/styles.css`;
    document.head.appendChild(link);
  }
}
