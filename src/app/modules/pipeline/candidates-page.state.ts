import { Injectable, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';

import { PipelineService, PipelineStats } from './services/pipeline.service';

/**
 * The page-level figures of « Candidats » — the KPI row above the tab strip.
 *
 * Held once for the whole page (`CandidatesPageComponent` draws them) so switching tab never
 * refetches nor redraws them. A tab whose action changes the figures (accepting an offer on
 * the Kanban…) calls `reload()`; the tiles update in place.
 */
@Injectable({ providedIn: 'root' })
export class CandidatesPageState {
  private readonly pipelineSvc = inject(PipelineService);

  /** null until `/pipeline/stats` answers — or when it failed (tiles then show 0 / « — »). */
  readonly stats  = signal<PipelineStats | null>(null);
  /** First answer received (success or failure): ends the page's first-load skeleton. */
  readonly loaded = signal(false);

  reload(): void {
    this.pipelineSvc.getStats().pipe(catchError(() => of(null))).subscribe(s => {
      if (s) this.stats.set(s);
      this.loaded.set(true);
    });
  }
}
