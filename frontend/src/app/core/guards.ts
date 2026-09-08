import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import type { Rol } from './modelos';

/** Exige sesion iniciada. */
export const sesionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.autenticado()) return true;

  return router.createUrlTree(['/login']);
};

/**
 * Exige uno de los roles indicados. Es una comodidad de la interfaz, no la
 * medida de seguridad: la autorizacion real la aplica el backend en cada
 * endpoint.
 */
export const rolGuard =
  (...roles: Rol[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.autenticado()) return router.createUrlTree(['/login']);
    if (auth.tieneRol(...roles)) return true;

    return router.createUrlTree([auth.rutaInicial()]);
  };
