import { ApplicationConfig, importProvidersFrom, LOCALE_ID } from '@angular/core';
import { PreloadAllModules, provideRouter, withInMemoryScrolling, withPreloading } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeHe from '@angular/common/locales/he';
import { routes } from './app.routes';
import { SocialLoginModule, SocialAuthServiceConfig, GoogleLoginProvider } from '@abacritt/angularx-social-login';
import { authInterceptor } from './services/auth-interceptor';
import { errorInterceptor } from './services/error.interceptor';

registerLocaleData(localeHe, 'he-IL');

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'he-IL' },
    provideRouter(routes, withPreloading(PreloadAllModules), withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
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
