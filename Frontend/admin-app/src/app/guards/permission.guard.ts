import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const permissions = route.data?.['permissions'] as string[] | undefined;

  if (!permissions || permissions.length === 0) return true;
  if (permissions.some(permission => authService.hasPermission(permission))) return true;

  router.navigate(['/admin/dashboard']);
  return false;
};
