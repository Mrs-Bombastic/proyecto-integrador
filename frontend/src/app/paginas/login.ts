import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

/** Perfiles con acceso al sistema, con su usuario de prueba. */
const PERFILES = [
  { rol: 'Estudiante', email: 'est0195@estudiante.edu.co' },
  { rol: 'Docente', email: 'docente1@dashboard.edu.co' },
  { rol: 'Coordinador', email: 'coordinador.isd@dashboard.edu.co' },
  { rol: 'Administrador', email: 'admin@dashboard.edu.co' },
];

/**
 * Pantalla de acceso.
 *
 * Ocupa el ancho completo en dos mitades: la izquierda presenta el propósito
 * del sistema y la escala de riesgo antes de entrar, la derecha es el
 * formulario. En pantallas estrechas el panel se reduce a su encabezado y el
 * formulario queda debajo.
 */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="grid min-h-screen lg:grid-cols-2">
      <!-- Panel institucional -->
      <div
        class="bg-marca flex flex-col justify-between gap-10 px-6 py-8 text-white sm:px-10 lg:gap-0 lg:px-16 lg:py-16"
      >
        <div class="flex items-center gap-3">
          <span
            class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15 text-sm font-bold"
          >
            SA
          </span>
          <span class="text-sm leading-snug font-semibold">
            Institución Universitaria<br />Digital de Antioquia
          </span>
        </div>

        <div>
          <h1
            class="text-3xl leading-tight font-semibold tracking-tight text-pretty lg:text-[2.75rem]"
          >
            Seguimiento académico<br />y alertas tempranas
          </h1>
          <p class="mt-5 text-base leading-relaxed text-white/80">
            Calificaciones, asistencia y participación en un solo lugar, con
            detección temprana de los estudiantes que necesitan acompañamiento.
          </p>

          <ul class="mt-10 flex flex-col gap-4 lg:mt-12">
            <li class="flex items-baseline gap-3.5">
              <span
                class="bg-riesgo-normal h-2.5 w-2.5 shrink-0 rounded-full"
                aria-hidden="true"
              ></span>
              <span class="text-sm leading-normal">
                <span class="font-semibold">Normal</span>
                <span class="text-white/70">
                  · desempeño dentro de lo esperado</span
                >
              </span>
            </li>
            <li class="flex items-baseline gap-3.5">
              <span
                class="bg-riesgo-medio h-2.5 w-2.5 shrink-0 rounded-full"
                aria-hidden="true"
              ></span>
              <span class="text-sm leading-normal">
                <span class="font-semibold">Riesgo medio</span>
                <span class="text-white/70"> · señales que conviene revisar</span>
              </span>
            </li>
            <li class="flex items-baseline gap-3.5">
              <span
                class="bg-riesgo-alto h-2.5 w-2.5 shrink-0 rounded-full"
                aria-hidden="true"
              ></span>
              <span class="text-sm leading-normal">
                <span class="font-semibold">Riesgo alto</span>
                <span class="text-white/70">
                  · requiere intervención inmediata</span
                >
              </span>
            </li>
          </ul>
        </div>

        <p class="text-[0.8125rem] text-white/60">
          Proyecto Integrado I · Facultad de Ingeniería
        </p>
      </div>

      <!-- Formulario. El bloque lleva una medida propia en pantallas grandes:
           estirado a media pantalla los campos quedan larguísimos y cuesta
           recorrerlos. Es un ancho, no un tope. -->
      <div class="flex flex-col items-center justify-center bg-white px-6 py-12 sm:px-10 lg:py-16">
        <div class="w-full lg:w-[30rem]">
        <h2 class="text-2xl font-semibold tracking-tight text-slate-900">
          Iniciar sesión
        </h2>
        <p class="mt-2 text-[0.9375rem] text-slate-500">
          Acceda con su cuenta institucional.
        </p>

        <form class="mt-10 flex flex-col gap-[1.375rem]" (ngSubmit)="ingresar()">
          <div>
            <label
              for="email"
              class="mb-[0.4375rem] block text-[0.8125rem] font-semibold text-slate-700"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autocomplete="username"
              placeholder="nombre@dashboard.edu.co"
              required
              class="h-[2.875rem] w-full rounded-md border border-slate-300 px-3.5 text-[0.9375rem] text-slate-900 outline-none focus:border-indigo-600 focus:ring-3 focus:ring-indigo-600/15"
              [(ngModel)]="email"
              [disabled]="cargando()"
            />
          </div>

          <div>
            <div class="mb-[0.4375rem] flex items-baseline justify-between gap-3">
              <label
                for="password"
                class="text-[0.8125rem] font-semibold text-slate-700"
              >
                Contraseña
              </label>
              <a
                href="#"
                class="text-[0.8125rem] font-medium text-indigo-600 hover:underline"
              >
                ¿Olvidó su contraseña?
              </a>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              class="h-[2.875rem] w-full rounded-md border border-slate-300 px-3.5 text-[0.9375rem] text-slate-900 outline-none focus:border-indigo-600 focus:ring-3 focus:ring-indigo-600/15"
              [(ngModel)]="password"
              [disabled]="cargando()"
            />
          </div>

          @if (error()) {
            <p
              role="alert"
              class="rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              {{ error() }}
            </p>
          }

          <button
            type="submit"
            class="mt-1.5 h-[2.875rem] w-full rounded-md bg-indigo-600 text-[0.9375rem] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            [disabled]="cargando()"
          >
            {{ cargando() ? 'Ingresando…' : 'Ingresar' }}
          </button>
        </form>

        <div class="mt-10 border-t border-slate-200 pt-7">
          <p
            class="mb-3.5 text-xs font-semibold tracking-wider text-slate-400 uppercase"
          >
            Perfiles del sistema
          </p>
          <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            @for (perfil of perfiles; track perfil.email) {
              <button
                type="button"
                class="rounded-md border border-slate-200 px-2.5 py-3 text-[0.8125rem] text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700"
                [title]="'Usar ' + perfil.email"
                (click)="usar(perfil.email)"
              >
                {{ perfil.rol }}
              </button>
            }
          </div>
          <p class="mt-4 text-[0.8125rem] text-slate-500">
            Elija un perfil para cargar sus credenciales de prueba, o escriba las
            suyas. ¿Problemas para ingresar? Escriba a
            <a
              href="mailto:soporte.academico@iudigital.edu.co"
              class="font-medium text-indigo-600 hover:underline"
            >
              soporte.academico&#64;iudigital.edu.co
            </a>
          </p>
        </div>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly perfiles = PERFILES;

  /** Carga las credenciales de prueba del perfil elegido. */
  protected usar(email: string): void {
    this.email = email;
    this.password = 'Dashboard2026*';
    this.error.set(null);
  }

  protected async ingresar(): Promise<void> {
    if (this.cargando()) return;

    this.error.set(null);
    this.cargando.set(true);

    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigate([this.auth.rutaInicial()]);
    } catch (error) {
      this.error.set(this.mensajeDe(error));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Traduce el error HTTP a algo que el usuario pueda entender y accionar. */
  private mensajeDe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'No fue posible conectar con el servidor. Verifique que la API esté en ejecución.';
      }
      const mensaje = error.error?.message;
      if (typeof mensaje === 'string') return mensaje;
      if (Array.isArray(mensaje)) return mensaje.join('. ');
    }
    return 'Ocurrió un error inesperado al iniciar sesión.';
  }
}
