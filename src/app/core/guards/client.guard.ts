import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ProtocolBootstrapService } from '../../services/protocol-bootstrap.service';

export const clientGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const bootstrap = inject(ProtocolBootstrapService);

  await auth.ready;
  const user = auth.currentUser();

  if (!user) return router.parseUrl('/login');
  if (user.role !== 'client') return router.parseUrl('/coach/bacheca');
  await bootstrap.ensureLoaded();
  return true;
};
