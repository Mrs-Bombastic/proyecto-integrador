import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Adjunta el token a cada peticion y cierra la sesion ante un 401.
 *
 * Sin este ultimo paso, un token expirado dejaria al usuario en una pantalla
 * vacia sin explicacion: se le devuelve al login.
 */
export const authInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token;

  const conCredenciales = token
    ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : peticion;

  return siguiente(conCredenciales).pipe(
    catchError((error: HttpErrorResponse) => {
      const esLogin = peticion.url.includes('/auth/login');
      if (error.status === 401 && !esLogin) {
        auth.cerrarSesion();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
