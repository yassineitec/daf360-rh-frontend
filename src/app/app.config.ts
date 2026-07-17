import { APP_INITIALIZER, ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { rootReducers } from '@khalilrebhiitec/daf360';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { UserStore } from './core/user.store';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { InlineTranslateLoader } from './core/inline-translate.loader';

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
