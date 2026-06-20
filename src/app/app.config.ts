import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { Observable, of } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { provideTranslateService, TranslateLoader, TranslationObject } from '@ngx-translate/core';

import en from '@public/assets/i18n/en.json';
import fr from '@public/assets/i18n/fr.json';
import ar from '@public/assets/i18n/ar.json';

const TRANSLATIONS: Record<string, TranslationObject> = {
  en: en as TranslationObject,
  fr: fr as TranslationObject,
  ar: ar as TranslationObject,
};

class InlineTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return of(TRANSLATIONS[lang] ?? TRANSLATIONS['fr']);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    ...provideTranslateService({
      fallbackLang: 'en',
      lang: 'fr',
      loader: { provide: TranslateLoader, useClass: InlineTranslateLoader },
    }),
  ],
};
