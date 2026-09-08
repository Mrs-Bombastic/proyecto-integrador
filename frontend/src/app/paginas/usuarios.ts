import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type {
  RegistroAuditoria,
  RolSistema,
  UsuarioAdmin,
} from '../core/modelos';

/**
 * Gestión de usuarios y roles, y registro de auditoría.
 *
 * Es el caso de uso propio del administrador. Las cuentas de estudiante y
 * docente no se crean aquí: llegan con su ficha académica desde matrículas, y
 * el servidor rechaza intentar crearlas sueltas.
 */
@Component({
  selector: 'app-usuarios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule],
  template: `
    <h1 class="text-xl font-semibold text-slate-900">Usuarios y roles</h1>
    <p class="mt-0.5 mb-6 text-sm text-slate-500">
      Cuentas del sistema, sus roles y el registro de acciones sensibles.
    </p>

    @if (mensaje()) {
      <p
        role="status"
        class="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
      >
        {{ mensaje() }}
      </p>
    }
    @if (error()) {
      <p role="alert" class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ error() }}
      </p>
    }

    <!-- Roles -->
    <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      @for (rol of roles(); track rol.id) {
        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <div class="flex items-baseline justify-between gap-2">
            <h2 class="text-sm font-semibold text-slate-900">{{ rol.nombre }}</h2>
            <span class="text-sm text-slate-500">{{ rol._count.usuarios }}</span>
          </div>
          <p class="mt-1 text-xs text-slate-500">{{ rol.descripcion }}</p>
          <ul class="mt-2 flex flex-wrap gap-1">
            @for (permiso of rol.permisos; track permiso) {
              <li
                class="rounded bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] text-slate-600"
              >
                {{ permiso }}
              </li>
            }
          </ul>
        </div>
      }
    </div>

    <!-- Alta de cuentas administrativas -->
    <div class="mb-6 rounded-lg border border-slate-200 bg-white p-5">
      <h2 class="text-sm font-semibold text-slate-900">
        Crear cuenta administrativa
      </h2>
      <p class="mt-1 mb-4 text-xs text-slate-500">
        Solo coordinadores y administradores. Las cuentas de estudiante y docente
        se crean junto con su ficha académica.
      </p>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label for="nombres" class="block text-xs font-medium text-slate-600">
            Nombres
          </label>
          <input
            id="nombres"
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            [(ngModel)]="nuevo.nombres"
          />
        </div>
        <div>
          <label for="apellidos" class="block text-xs font-medium text-slate-600">
            Apellidos
          </label>
          <input
            id="apellidos"
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            [(ngModel)]="nuevo.apellidos"
          />
        </div>
        <div>
          <label for="correo" class="block text-xs font-medium text-slate-600">
            Correo institucional
          </label>
          <input
            id="correo"
            type="email"
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            [(ngModel)]="nuevo.email"
          />
        </div>
        <div>
          <label for="clave" class="block text-xs font-medium text-slate-600">
            Contraseña inicial
          </label>
          <input
            id="clave"
            type="password"
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            [(ngModel)]="nuevo.password"
          />
        </div>
        <div>
          <label for="rolNuevo" class="block text-xs font-medium text-slate-600">
            Rol
          </label>
          <select
            id="rolNuevo"
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            [(ngModel)]="nuevo.rolId"
          >
            @for (rol of rolesAsignables(); track rol.id) {
              <option [value]="rol.id">{{ rol.nombre }}</option>
            }
          </select>
        </div>
      </div>

      <div class="mt-4 flex justify-end">
        <button
          type="button"
          class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          [disabled]="creando()"
          (click)="crear()"
        >
          {{ creando() ? 'Creando…' : 'Crear cuenta' }}
        </button>
      </div>
    </div>

    <!-- Listado -->
    <div class="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <label for="filtroRol" class="block text-xs font-medium text-slate-600">
          Rol
        </label>
        <select
          id="filtroRol"
          class="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          [(ngModel)]="filtroRol"
          (ngModelChange)="cargarUsuarios()"
        >
          <option value="">Todos</option>
          @for (rol of roles(); track rol.id) {
            <option [value]="rol.nombre">{{ rol.nombre }}</option>
          }
        </select>
      </div>
      <div>
        <label for="filtroActivo" class="block text-xs font-medium text-slate-600">
          Estado
        </label>
        <select
          id="filtroActivo"
          class="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          [(ngModel)]="filtroActivo"
          (ngModelChange)="cargarUsuarios()"
        >
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>
      <div class="min-w-56 flex-1">
        <label for="buscar" class="block text-xs font-medium text-slate-600">
          Buscar
        </label>
        <input
          id="buscar"
          type="search"
          placeholder="Nombre o correo"
          class="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          [(ngModel)]="filtroBusqueda"
          (keyup.enter)="cargarUsuarios()"
        />
      </div>
      <button
        type="button"
        class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        (click)="cargarUsuarios()"
      >
        Filtrar
      </button>
    </div>

    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th scope="col" class="px-4 py-3 font-medium">Usuario</th>
              <th scope="col" class="px-4 py-3 font-medium">Rol</th>
              <th scope="col" class="px-4 py-3 font-medium">Último acceso</th>
              <th scope="col" class="px-4 py-3 font-medium">Estado</th>
              <th scope="col" class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @if (cargando()) {
              <tr>
                <td colspan="5" class="px-4 py-10 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            } @else if (usuarios().length === 0) {
              <tr>
                <td colspan="5" class="px-4 py-10 text-center text-slate-500">
                  No hay usuarios que coincidan con los filtros.
                </td>
              </tr>
            } @else {
              @for (u of usuarios(); track u.id) {
                <tr class="hover:bg-slate-50">
                  <td class="px-4 py-3">
                    <p class="font-medium text-slate-900">
                      {{ u.nombres }} {{ u.apellidos }}
                    </p>
                    <p class="text-xs text-slate-500">
                      {{ u.email }}
                      @if (u.estudiante) {
                        · {{ u.estudiante.codigoEstudiante }}
                      }
                      @if (u.docente) {
                        · {{ u.docente.codigoDocente }}
                      }
                    </p>
                  </td>
                  <td class="px-4 py-3 text-slate-600">{{ u.rol.nombre }}</td>
                  <td class="px-4 py-3 text-slate-600">
                    {{
                      u.ultimoAcceso
                        ? (u.ultimoAcceso | date: 'dd/MM/yyyy HH:mm')
                        : 'Nunca'
                    }}
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="rounded-full px-2.5 py-1 text-xs font-medium"
                      [class]="
                        u.activo
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      "
                    >
                      {{ u.activo ? 'Activo' : 'Inactivo' }}
                    </span>
                    @if (u.bloqueadoHasta) {
                      <span class="ml-1 text-xs text-amber-700">bloqueado</span>
                    }
                  </td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">
                    @if (u.id !== propioId()) {
                      <button
                        type="button"
                        class="text-sm font-medium text-indigo-600 hover:underline"
                        (click)="alternarActivo(u)"
                      >
                        {{ u.activo ? 'Desactivar' : 'Activar' }}
                      </button>
                    } @else {
                      <span class="text-xs text-slate-400">su cuenta</span>
                    }
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Auditoría -->
    <div class="mt-6 rounded-lg border border-slate-200 bg-white">
      <h2
        class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800"
      >
        Registro de auditoría
      </h2>
      @if (auditoria().length === 0) {
        <p class="px-5 py-10 text-center text-sm text-slate-500">
          Sin registros todavía.
        </p>
      } @else {
        <ul class="divide-y divide-slate-100">
          @for (registro of auditoria(); track registro.id) {
            <li class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-2.5">
              <span class="font-mono text-xs text-slate-500">
                {{ registro.fecha | date: 'dd/MM/yyyy HH:mm:ss' }}
              </span>
              <span class="text-sm font-medium text-slate-800">
                {{ registro.accion }}
              </span>
              @if (registro.usuario) {
                <span class="text-xs text-slate-500">
                  {{ registro.usuario.nombres }} {{ registro.usuario.apellidos }}
                </span>
              }
              @if (registro.detalle) {
                <span class="text-xs text-slate-500">· {{ registro.detalle }}</span>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class UsuariosComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  protected readonly usuarios = signal<UsuarioAdmin[]>([]);
  protected readonly roles = signal<RolSistema[]>([]);
  protected readonly auditoria = signal<RegistroAuditoria[]>([]);
  protected readonly cargando = signal(true);
  protected readonly creando = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected filtroRol = '';
  protected filtroActivo = '';
  protected filtroBusqueda = '';

  protected nuevo = {
    nombres: '',
    apellidos: '',
    email: '',
    password: '',
    rolId: 0,
  };

  constructor() {
    void this.inicializar();
  }

  protected propioId(): string | undefined {
    return this.auth.usuario()?.id;
  }

  /** Solo los roles que se pueden asignar a una cuenta creada desde aquí. */
  protected rolesAsignables(): RolSistema[] {
    return this.roles().filter(
      (rol) => rol.nombre === 'COORDINADOR' || rol.nombre === 'ADMINISTRADOR',
    );
  }

  protected async crear(): Promise<void> {
    if (this.creando()) return;

    this.creando.set(true);
    this.mensaje.set(null);
    this.error.set(null);

    try {
      const creado = await this.api.crearUsuario({
        ...this.nuevo,
        rolId: Number(this.nuevo.rolId),
      });
      this.mensaje.set(`Cuenta creada para ${creado.email}.`);
      this.nuevo = {
        nombres: '',
        apellidos: '',
        email: '',
        password: '',
        rolId: this.rolesAsignables()[0]?.id ?? 0,
      };
      await this.cargarUsuarios();
      await this.cargarAuditoria();
    } catch (error) {
      this.error.set(this.mensajeDe(error));
    } finally {
      this.creando.set(false);
    }
  }

  protected async alternarActivo(usuario: UsuarioAdmin): Promise<void> {
    this.mensaje.set(null);
    this.error.set(null);

    try {
      await this.api.actualizarUsuario(usuario.id, { activo: !usuario.activo });
      this.mensaje.set(
        `${usuario.email} quedó ${usuario.activo ? 'inactivo' : 'activo'}.`,
      );
      await this.cargarUsuarios();
      await this.cargarAuditoria();
    } catch (error) {
      this.error.set(this.mensajeDe(error));
    }
  }

  protected async cargarUsuarios(): Promise<void> {
    this.cargando.set(true);
    try {
      this.usuarios.set(
        await this.api.usuarios({
          rol: this.filtroRol || undefined,
          activo: this.filtroActivo || undefined,
          busqueda: this.filtroBusqueda || undefined,
        }),
      );
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarAuditoria(): Promise<void> {
    this.auditoria.set(await this.api.auditoria(30));
  }

  private async inicializar(): Promise<void> {
    const roles = await this.api.rolesSistema();
    this.roles.set(roles);
    this.nuevo.rolId = this.rolesAsignables()[0]?.id ?? 0;
    await Promise.all([this.cargarUsuarios(), this.cargarAuditoria()]);
  }

  private mensajeDe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const mensaje = error.error?.message;
      if (Array.isArray(mensaje)) return mensaje.join('. ');
      if (typeof mensaje === 'string') return mensaje;
    }
    return 'No fue posible completar la operación.';
  }
}
