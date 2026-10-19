import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Valeurs des signaux d'état de l'Historique des demandes, par nom (voir
 * `RecruitmentDemandListComponent.persisted`) : onglet, vue, et recherche / filtres / tri /
 * pagination de chacun des deux onglets.
 */
export type RequestsHistoryState = Record<string, unknown>;

/**
 * Zone où les filtres survivent : la page (`requests-history`), la fiche d'une demande de
 * recrutement (`requests-history/42`) et la fiche d'une demande ordinaire ouverte depuis
 * l'onglet « Demande » (`requests/42`). Sans préfixe fixe, pour valoir sous le shell
 * (`/rh/requests-history`) comme en app servie seule (`/requests-history`).
 */
const REQUESTS_HISTORY_ZONE = /\/(requests-history(\/\d+)?|requests\/\d+)$/;

/**
 * Mémorise les filtres de l'Historique des demandes pour que le retour depuis une fiche
 * retrouve la page telle qu'on l'a quittée — onglet actif compris.
 *
 * Volontairement en mémoire seulement : un rechargement (F5) repart d'une page propre.
 * Et toute navigation hors de la zone page / fiches efface l'état — revenir par le menu
 * après être passé ailleurs (y compris par `/rh/requests`) ne ramène pas l'ancien filtre.
 */
@Injectable({ providedIn: 'root' })
export class RequestsHistoryStateService {
  private state: RequestsHistoryState | null = null;

  constructor() {
    inject(Router).events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        if (!REQUESTS_HISTORY_ZONE.test(path)) this.state = null;
      });
  }

  save(state: RequestsHistoryState): void {
    this.state = state;
  }

  restore(): RequestsHistoryState | null {
    return this.state;
  }
}
