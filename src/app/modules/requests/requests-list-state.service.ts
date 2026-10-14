import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Valeurs des signaux d'état de la page `/rh/requests`, par nom. Deux parties : `list` —
 * la page et son onglet « Demande » (`RequestListComponent`) — et `validation` — l'onglet
 * « Demande de recrutement » (`RecruitmentValidationSectionComponent`), qui tient ses
 * propres filtres.
 */
export type RequestsListPart = 'list' | 'validation';
export type RequestsListValues = Record<string, unknown>;

/**
 * Zone où les filtres survivent : la page (`requests`), la fiche d'une demande qu'elle
 * ouvre (`requests/42`) et la fiche d'une demande de recrutement ouverte depuis l'onglet
 * « Demande de recrutement » (`requests-history/42`). Sans préfixe fixe, pour valoir sous
 * le shell (`/rh/requests`) comme en app servie seule (`/requests`).
 */
const REQUESTS_ZONE = /\/(requests(\/\d+)?|requests-history\/\d+)$/;

/**
 * Mémorise les filtres de la page Demandes pour que le retour depuis une fiche retrouve la
 * page telle qu'on l'a quittée — onglet actif compris.
 *
 * Volontairement en mémoire seulement : un rechargement (F5) repart d'une page propre.
 * Et toute navigation hors de la zone page / fiches efface l'état — revenir par le menu
 * après être passé ailleurs (y compris par l'Historique) ne ramène pas l'ancien filtre.
 */
@Injectable({ providedIn: 'root' })
export class RequestsListStateService {
  private state: Partial<Record<RequestsListPart, RequestsListValues>> = {};

  constructor() {
    inject(Router).events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        if (!REQUESTS_ZONE.test(path)) this.state = {};
      });
  }

  save(part: RequestsListPart, values: RequestsListValues): void {
    this.state[part] = values;
  }

  restore(part: RequestsListPart): RequestsListValues | null {
    return this.state[part] ?? null;
  }
}
