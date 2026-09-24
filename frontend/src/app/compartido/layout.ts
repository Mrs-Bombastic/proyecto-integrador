import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type { Notificacion } from '../core/modelos';

/**
 * Marco de la aplicacion: barra superior con la identidad del usuario, la
 * navegacion propia de su rol y el buzon de notificaciones (RF09).
 */
@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-slate-50">
      <header class="border-b border-slate-200 bg-white">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <a
            routerLink="/"
            class="flex items-center gap-2"
            (click)="menuAbierto.set(false)"
          >
            <span
              class="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white"
              >SA</span
            >
            <span class="text-sm leading-tight font-semibold text-slate-900">
              Seguimiento Académico
              <span class="block text-xs font-normal text-slate-500">
                Alertas tempranas
              </span>
            </span>
          </a>

          <!-- En el telefono la navegacion se pliega bajo el boton de menu y
               ocupa su propia fila; desde md vuelve a estar en linea. -->
          <nav
            id="navegacion"
            class="order-last w-full flex-col gap-1 border-t border-slate-100 pt-2 text-sm md:order-none md:flex md:w-auto md:flex-1 md:flex-row md:flex-wrap md:items-center md:border-0 md:pt-0"
            [class.flex]="menuAbierto()"
            [class.hidden]="!menuAbierto()"
            (click)="menuAbierto.set(false)"
          >
            @if (auth.tieneRol('DOCENTE', 'COORDINADOR', 'ADMINISTRADOR')) {
              <a
                routerLink="/panel"
                routerLinkActive="bg-indigo-50 text-indigo-700"
                class="rounded-md px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 md:py-1.5"
                >Estudiantes</a
              >
              <a
                routerLink="/alertas"
                routerLinkActive="bg-indigo-50 text-indigo-700"
                class="rounded-md px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 md:py-1.5"
                >Alertas</a
              >
              <a
                routerLink="/deserciones"
                routerLinkActive="bg-indigo-50 text-indigo-700"
                class="rounded-md px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 md:py-1.5"
                >Retiros</a
              >
            }
            @if (auth.tieneRol('ESTUDIANTE')) {
              <a
                routerLink="/mi-progreso"
                routerLinkActive="bg-indigo-50 text-indigo-700"
                class="rounded-md px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 md:py-1.5"
                >Mi progreso</a
              >
              <a
                routerLink="/retiro"
                routerLinkActive="bg-indigo-50 text-indigo-700"
                class="rounded-md px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 md:py-1.5"
                >Retiro del programa</a
              >
            }
            @if (auth.tieneRol('ADMINISTRADOR')) {
              <a
                routerLink="/usuarios"
                routerLinkActive="bg-indigo-50 text-indigo-700"
                class="rounded-md px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 md:py-1.5"
                >Usuarios</a
              >
              <a
                routerLink="/umbrales"
                routerLinkActive="bg-indigo-50 text-indigo-700"
                class="rounded-md px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 md:py-1.5"
                >Umbrales</a
              >
            }
          </nav>

          <div class="ml-auto flex items-center gap-2 sm:gap-3">
            <!-- El buzón es para todos los roles: desde el RF14 el estudiante
                 también recibe avisos de su riesgo y de su retiro. -->
            <div class="relative">
              <button
                type="button"
                class="relative rounded-md p-2 text-slate-500 hover:bg-slate-100"
                [attr.aria-label]="
                  'Notificaciones, ' + noLeidas().length + ' sin leer'
                "
                (click)="alternarBuzon()"
              >
                <svg
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V5a2 2 0 1 0-4 0v.3A6 6 0 0 0 6 11v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
                  />
                </svg>
                @if (noLeidas().length > 0) {
                  <span
                    class="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
                  >
                    {{ noLeidas().length > 9 ? '9+' : noLeidas().length }}
                  </span>
                }
              </button>

              @if (buzonAbierto()) {
                <div
                  class="fixed inset-x-4 top-16 z-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80"
                >
                  <div
                    class="border-b border-slate-100 px-4 py-2 text-xs font-semibold text-slate-500"
                  >
                    Notificaciones sin leer
                  </div>
                  @if (noLeidas().length === 0) {
                    <p class="px-4 py-6 text-center text-sm text-slate-500">
                      No hay notificaciones pendientes.
                    </p>
                  } @else {
                    <ul class="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                      @for (n of noLeidas(); track n.id) {
                        <li class="px-4 py-3">
                          <p class="text-sm font-medium text-slate-800">
                            {{ n.titulo }}
                          </p>
                          <p class="mt-0.5 text-xs text-slate-500">
                            {{ n.mensaje }}
                          </p>
                          <button
                            type="button"
                            class="mt-1.5 text-xs font-medium text-indigo-600 hover:underline"
                            (click)="marcarLeida(n)"
                          >
                            Marcar como leída
                          </button>
                        </li>
                      }
                    </ul>
                  }
                </div>
              }
            </div>

            <div class="hidden text-right sm:block">
              <p class="text-sm font-medium text-slate-800">
                {{ auth.nombreCompleto() }}
              </p>
              <p class="text-xs text-slate-500">{{ auth.rol() }}</p>
            </div>
            <button
              type="button"
              class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              (click)="auth.cerrarSesion()"
            >
              Salir
            </button>
            <button
              type="button"
              class="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              aria-controls="navegacion"
              [attr.aria-expanded]="menuAbierto()"
              [attr.aria-label]="menuAbierto() ? 'Cerrar menú' : 'Abrir menú'"
              (click)="alternarMenu()"
            >
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                viewBox="0 0 24 24"
              >
                @if (menuAbierto()) {
                  <path stroke-linecap="round" d="M6 6l12 12M18 6 6 18" />
                } @else {
                  <path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16" />
                }
              </svg>
            </button>
          </div>
        </div>
      </header>

      <!-- En el telefono el nombre y el rol no caben en la barra; se muestran
           al desplegar el menu. -->
      @if (menuAbierto()) {
        <p
          class="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 sm:hidden"
        >
          {{ auth.nombreCompleto() }} · {{ auth.rol() }}
        </p>
      }

      <main class="px-4 py-5 sm:px-6 sm:py-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class LayoutComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  protected readonly noLeidas = signal<Notificacion[]>([]);
  protected readonly buzonAbierto = signal(false);
  protected readonly menuAbierto = signal(false);

  constructor() {
    void this.cargarNotificaciones();
  }

  protected alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
    this.buzonAbierto.set(false);
  }

  protected alternarBuzon(): void {
    this.menuAbierto.set(false);
    this.buzonAbierto.update((abierto) => !abierto);
    if (this.buzonAbierto()) void this.cargarNotificaciones();
  }

  protected async marcarLeida(notificacion: Notificacion): Promise<void> {
    await this.api.marcarNotificacionLeida(notificacion.id);
    this.noLeidas.update((lista) =>
      lista.filter((n) => n.id !== notificacion.id),
    );
  }

  private async cargarNotificaciones(): Promise<void> {
    try {
      this.noLeidas.set(await this.api.notificaciones(true));
    } catch {
      // El buzon es accesorio: si falla, la aplicacion sigue siendo usable.
      this.noLeidas.set([]);
    }
  }
}
