import { ApplicationConfig, ErrorHandler, importProvidersFrom, isDevMode, LOCALE_ID } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { ChunkErrorHandler } from './services/chunk-error.handler';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeHe from '@angular/common/locales/he';
import { routes } from './app.routes';
import { SocialLoginModule, SocialAuthServiceConfig, GoogleLoginProvider } from '@abacritt/angularx-social-login';
import { authInterceptor } from './services/auth-interceptor';
import { errorInterceptor } from './services/error.interceptor';
import { PublicListReuseStrategy } from './strategies/public-list-reuse.strategy';

registerLocaleData(localeHe, 'he-IL');

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'he-IL' },
    { provide: ErrorHandler, useClass: ChunkErrorHandler },
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'disabled' })),
    { provide: RouteReuseStrategy, useClass: PublicListReuseStrategy },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    // 🔒 Interceptors: authInterceptor מוסיף טוקן, errorInterceptor מטפל בשגיאות
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    importProvidersFrom([
      SocialLoginModule
    ]),
    {
      provide: 'SocialAuthServiceConfig',
      useValue: {
        autoLogin: false,
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider(
              '502970815708-25ubgon2jacu88p1afsg30r45j5bogto.apps.googleusercontent.com', // החליפי ב־Client ID שלך
              {
                oneTapEnabled: false,
                prompt: 'select_account'
              }
            )
          }
        ],
        onError: (err: any) => {
          console.error(err);
        }
      } as SocialAuthServiceConfig,
    }
  ]
};
