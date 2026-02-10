import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { map, catchError, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ArtistService } from '../services/artist.service';
import { MusicServiceProviderService } from '../services/music-service-provider.service';
import { ProfileTier } from '../models/subscription.model';

/**
 * Guard that checks if the user has a subscribed tier profile.
 * Can check for either Artist or ServiceProvider profiles.
 *
 * Usage in routes:
 * {
 *   path: 'premium-feature',
 *   component: PremiumFeatureComponent,
 *   canActivate: [subscribedTierGuard]
 * }
 *
 * Or with profile type:
 * {
 *   path: 'artist-premium',
 *   component: ArtistPremiumComponent,
 *   canActivate: [subscribedTierGuard],
 *   data: { profileType: 'artist' }
 * }
 */
export const subscribedTierGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const artistService = inject(ArtistService);
  const serviceProviderService = inject(MusicServiceProviderService);

  const user = authService.currentUserValue;

  // If not logged in, redirect to login
  if (!user) {
    router.navigate(['/login'], {
      queryParams: { returnUrl: route.url.join('/') }
    });
    return false;
  }

  // Get profile type from route data, or check both
  const profileType = route.data['profileType'] as 'artist' | 'serviceProvider' | undefined;

  // Check Artist profile
  if (!profileType || profileType === 'artist') {
    return artistService.getArtistByUserId(user.id).pipe(
      catchError(() => of(null)),
      switchMap(artist => {
        if (artist && artist.tier === ProfileTier.Subscribed) {
          return of(true);
        }

        // If we're only checking artist, show error
        if (profileType === 'artist') {
          alert('תכונה זו דורשת מנוי פעיל. אנא שדרג את המנוי שלך.');
          router.navigate(['/subscription/select']);
          return of(false);
        }

        // Otherwise, continue to check service provider
        return checkServiceProvider();
      })
    );
  }

  // Check ServiceProvider profile
  if (profileType === 'serviceProvider') {
    return checkServiceProvider();
  }

  // Default: no access
  router.navigate(['/subscription/select']);
  return false;

  function checkServiceProvider() {
    return serviceProviderService.getServiceProviderByUserId(user!.id).pipe(
      map(provider => {
        if (provider && provider.tier === ProfileTier.Subscribed) {
          return true;
        }

        alert('תכונה זו דורשת מנוי פעיל. אנא שדרג את המנוי שלך.');
        router.navigate(['/subscription/select']);
        return false;
      }),
      catchError(() => {
        router.navigate(['/subscription/select']);
        return of(false);
      })
    );
  }
};

/**
 * Guard that checks if the user has at least one subscribed profile (Artist OR ServiceProvider).
 * More lenient than subscribedTierGuard.
 */
export const anySubscribedProfileGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const artistService = inject(ArtistService);
  const serviceProviderService = inject(MusicServiceProviderService);

  const user = authService.currentUserValue;

  if (!user) {
    router.navigate(['/login'], {
      queryParams: { returnUrl: route.url.join('/') }
    });
    return false;
  }

  // Check both profiles and allow if either has subscribed tier
  return artistService.getArtistByUserId(user.id).pipe(
    catchError(() => of(null)),
    switchMap(artist => {
      // If artist has subscribed tier, allow access
      if (artist && artist.tier === ProfileTier.Subscribed) {
        return of(true);
      }

      // Otherwise, check service provider
      return serviceProviderService.getServiceProviderByUserId(user.id).pipe(
        map(provider => {
          if (provider && provider.tier === ProfileTier.Subscribed) {
            return true;
          }

          alert('תכונה זו דורשת מנוי פעיל. אנא שדרג את המנוי שלך.');
          router.navigate(['/subscription/select']);
          return false;
        }),
        catchError(() => {
          alert('תכונה זו דורשת מנוי פעיל. אנא שדרג את המנוי שלך.');
          router.navigate(['/subscription/select']);
          return of(false);
        })
      );
    })
  );
};

/**
 * Guard that checks if the user has a specific subscription plan or higher.
 *
 * Usage:
 * {
 *   path: 'premium-only',
 *   component: PremiumComponent,
 *   canActivate: [planGuard],
 *   data: { requiredPlan: SubscriptionPlan.Premium }
 * }
 */
export const planGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  const user = authService.currentUserValue;

  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  // This would require accessing the subscription service to check the plan
  // For now, just redirect to subscription page
  alert('תכונה זו זמינה רק למנויי Premium. שדרג עכשיו!');
  router.navigate(['/subscription/select']);
  return false;
};
