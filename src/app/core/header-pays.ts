import { computed, inject, Signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectSelectedCountryIds } from '@khalilrebhiitec/daf360';

/**
 * Les pays cochés dans la navbar du shell (store partagé), en `pays_id` triés et séparés
 * par des virgules — ce qu'attendent les endpoints RH (`?paysId=179,64`). `undefined` =
 * « Tous les pays » : le serveur applique alors tout le périmètre du rôle.
 *
 * Texte trié : deux sélections identiques donnent la même valeur, donc un `effect` qui
 * compare à la dernière valeur chargée ne recharge que sur un VRAI changement de drapeaux.
 *
 * À appeler dans un contexte d'injection (initialiseur de champ d'un composant).
 */
export function injectHeaderPays(): Signal<string | undefined> {
  const ids = inject(Store).selectSignal(selectSelectedCountryIds);
  return computed(() => {
    const list = [...new Set(ids()
      .map(id => Number(id))
      .filter(id => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
    return list.length ? list.join(',') : undefined;
  });
}

/**
 * Garde-t-on cet élément pour les drapeaux `pays` (`179,64`) ? Pour les pages qui
 * reçoivent toute leur liste d'un coup et filtrent dans le navigateur. Sans drapeau, tout
 * passe ; avec des drapeaux, un élément sans pays connu est écarté.
 */
export function inHeaderPays(pays: string | undefined, paysId: number | null | undefined): boolean {
  if (!pays) return true;
  return paysId != null && pays.split(',').includes(String(paysId));
}

/** `{ paysId }` pour `HttpClient` quand des pays sont cochés, sinon rien. */
export function paysHttpParam(pays: string | undefined): Record<string, string> {
  return pays ? { paysId: pays } : {};
}
