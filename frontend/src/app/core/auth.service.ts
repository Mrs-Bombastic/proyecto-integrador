import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { RespuestaLogin, Rol, Usuario } from './modelos';

const CLAVE_TOKEN = 'dashboard.token';
const CLAVE_USUARIO = 'dashboard.usuario';

/**
 * Sesion del usuario. Guarda el token en localStorage para sobrevivir a una
 * recarga de la pagina y expone el usuario como signal para que los
 * componentes reaccionen sin suscripciones manuales.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _usuario = signal<Usuario | null>(this.leerUsuarioGuardado());

  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);
  readonly rol = computed(() => this._usuario()?.rol ?? null);
  readonly nombreCompleto = computed(() => {
    const u = this._usuario();
    return u ? `${u.nombres} ${u.apellidos}` : '';
  });

  get token(): string | null {
    return localStorage.getItem(CLAVE_TOKEN);
  }

  async login(email: string, password: string): Promise<void> {
    const respuesta = await firstValueFrom(
      this.http.post<RespuestaLogin>(`${environment.api}/auth/login`, {
        email,
        password,
      }),
    );

    localStorage.setItem(CLAVE_TOKEN, respuesta.accessToken);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(respuesta.usuario));
    this._usuario.set(respuesta.usuario);
  }

  cerrarSesion(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    this._usuario.set(null);
    void this.router.navigate(['/login']);
  }

  tieneRol(...roles: Rol[]): boolean {
    const rol = this.rol();
    return rol !== null && roles.includes(rol);
  }

  /** Ruta inicial de cada rol tras iniciar sesion. */
  rutaInicial(): string {
    switch (this.rol()) {
      case 'ESTUDIANTE':
        return '/mi-progreso';
      case 'ADMINISTRADOR':
        return '/umbrales';
      default:
        return '/panel';
    }
  }

  private leerUsuarioGuardado(): Usuario | null {
    const guardado = localStorage.getItem(CLAVE_USUARIO);
    if (!guardado) return null;
    try {
      return JSON.parse(guardado) as Usuario;
    } catch {
      // Dato corrupto: se descarta en lugar de dejar la aplicacion rota.
      localStorage.removeItem(CLAVE_USUARIO);
      return null;
    }
  }
}
