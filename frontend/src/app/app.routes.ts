import { inject } from '@angular/core';
import type { Routes } from '@angular/router';
import { AuthService } from './core/auth.service';
import { rolGuard, sesionGuard } from './core/guards';

/**
 * Rutas de la aplicacion. Las paginas se cargan de forma diferida para que el
 * paquete inicial sea pequeno y el panel abra rapido (RNF02).
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./paginas/login').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [sesionGuard],
    loadComponent: () =>
      import('./compartido/layout').then((m) => m.LayoutComponent),
    children: [
      {
        path: 'panel',
        canActivate: [rolGuard('DOCENTE', 'COORDINADOR', 'ADMINISTRADOR')],
        loadComponent: () =>
          import('./paginas/panel').then((m) => m.PanelComponent),
      },
      {
        path: 'alertas',
        canActivate: [rolGuard('DOCENTE', 'COORDINADOR', 'ADMINISTRADOR')],
        loadComponent: () =>
          import('./paginas/alertas').then((m) => m.AlertasComponent),
      },
      {
        path: 'estudiante/:id',
        canActivate: [rolGuard('DOCENTE', 'COORDINADOR', 'ADMINISTRADOR')],
        loadComponent: () =>
          import('./paginas/estudiante').then((m) => m.EstudianteComponent),
      },
      {
        // Panel propio del estudiante (RF10). Reutiliza el mismo componente:
        // el id sale de la sesion y el backend impide consultar a otro.
        path: 'mi-progreso',
        canActivate: [rolGuard('ESTUDIANTE')],
        loadComponent: () =>
          import('./paginas/estudiante').then((m) => m.EstudianteComponent),
      },
      {
        path: 'usuarios',
        canActivate: [rolGuard('ADMINISTRADOR')],
        loadComponent: () =>
          import('./paginas/usuarios').then((m) => m.UsuariosComponent),
      },
      {
        path: 'umbrales',
        canActivate: [rolGuard('ADMINISTRADOR')],
        loadComponent: () =>
          import('./paginas/umbrales').then((m) => m.UmbralesComponent),
      },
      {
        path: '',
        pathMatch: 'full',
        // Cada rol aterriza en la pantalla que le corresponde.
        redirectTo: () => inject(AuthService).rutaInicial(),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
