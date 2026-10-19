import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ProvisioningSort } from './sections/it-provisioning-table-section.component';

/** Tout ce qui décrit l'historique des provisionnements IT tel que l'utilisateur l'a laissé. */
export interface ItProvisioningHistoryState {
  viewMode:          'grid' | 'list';
  search:            string;
  completedRange:    Date[] | null;
  startRange:        Date[] | null;
  profileFilter:     string[];
  positionFilter:    string[];
  completedByFilter: string;
  sort:              ProvisioningSort | null;
  page:              number;
  pageSize:          number;
}

/**
 * Zone où les filtres survivent : l'historique (`it-provisioning/historique`) et la fiche
 * d'un dossier (`it-provisioning/42`). Sans préfixe fixe, pour valoir sous le shell
 * (`/rh/it-provisioning`) comme en app servie seule (`/it-provisioning`).
 */
const HISTORY_ZONE = /\/it-provisioning\/(historique|\d+)$/;

/**
 * Mémorise les filtres de l'historique des provisionnements IT pour que le retour depuis un
 * dossier (fil d'Ariane, bouton Retour) retrouve l'historique tel qu'on l'a quitté — même
 * principe que `ItProvisioningListStateService` pour la liste en cours.
 *
 * Volontairement en mémoire seulement : un rechargement (F5) repart d'un historique propre.
 * Et toute navigation hors de la zone historique / dossier efface l'état.
 */
@Injectable({ providedIn: 'root' })
export class ItProvisioningHistoryStateService {
  private state: ItProvisioningHistoryState | null = null;

  constructor() {
    inject(Router).events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        if (!HISTORY_ZONE.test(path)) this.state = null;
      });
  }

  save(state: ItProvisioningHistoryState): void {
    this.state = state;
  }

  restore(): ItProvisioningHistoryState | null {
    return this.state;
  }
}
