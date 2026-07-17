import { Observable, of } from 'rxjs';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';

import en from '@public/assets/i18n/en.json';
import fr from '@public/assets/i18n/fr.json';
import ar from '@public/assets/i18n/ar.json';

export const RH_TRANSLATIONS: Record<string, TranslationObject> = {
  en: en as TranslationObject,
  fr: fr as TranslationObject,
  ar: ar as TranslationObject,
};

/** Loads the RH translations that are bundled inline (no HTTP round-trip). */
export class InlineTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return of(RH_TRANSLATIONS[lang] ?? RH_TRANSLATIONS['fr']);
  }
}
