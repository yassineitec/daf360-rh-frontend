import { APP_INITIALIZER, ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { rootReducers } from '@khalilrebhiitec/daf360';
import { Observable, of } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { UserStore } from './core/user.store';
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
    provideStore(rootReducers),
    {
      provide: APP_INITIALIZER,
      useFactory: (userStore: UserStore) => () => userStore.loadCurrentUser(),
      deps: [UserStore],
      multi: true,
    },
    ...provideTranslateService({
      fallbackLang: 'en',
      lang: 'fr',
      loader: { provide: TranslateLoader, useClass: InlineTranslateLoader },
    }),
  ],
};
