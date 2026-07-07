import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const coachGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;
  const user = auth.currentUser();

  if (!user) return router.parseUrl('/login');
  if (user.role !== 'coach') return router.parseUrl('/scheda');
  return true;
};
