import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { SocialLoginModule, SocialAuthServiceConfig, GoogleLoginProvider } from '@abacritt/angularx-social-login';
import { authInterceptor } from './services/auth-interceptor';
import { errorInterceptor } from './services/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
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
                oneTapEnabled: false, // Disable One Tap to avoid FedCM
                prompt: 'select_account' // Always show account selection
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
