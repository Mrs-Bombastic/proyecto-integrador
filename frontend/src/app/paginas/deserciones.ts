import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import {
  ETIQUETA_ESTADO_DESERCION,
  ETIQUETA_MOTIVO,
  type EstadoDesercion,
  type MotivoDesercion,
  type ResumenDesercion,
  type SolicitudDesercion,
} from '../core/modelos';

/** Resoluciones que ofrece el formulario, en orden de intervencion. */
const RESOLUCIONES = [
  {
    valor: 'EN_REVISION',
    etiqueta: 'Tomar el caso (en revisión)',
    ayuda: 'La solicitud sigue abierta y el estudiante queda notificado de que lo van a contactar.',
  },
  {
    valor: 'RETENIDO',
    etiqueta: 'Estudiante retenido (cerrar)',
    ayuda: 'El estudiante acordó continuar. Su matrícula permanece activa.',
  },
  {
    valor: 'CONFIRMADA',
    etiqueta: 'Confirmar el retiro (cerrar)',
    ayuda: 'La matrícula pasa a RETIRADO y se descartan sus alertas abiertas. No se puede deshacer desde la plataforma.',
  },
];

/**
 * Gestion de solicitudes de retiro (RF14).
 *
 * El listado ordena por estado para que las solicitudes recien radicadas queden
 * arriba: una solicitud de retiro tiene una ventana corta para intervenirse, y
 * el conteo por motivo de la cabecera es lo que orienta esa intervencion.
 */
@Component({
  selector: 'app-deserciones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">
        Solicitudes de retiro
      </h1>
      <p class="mt-0.5 text-sm text-slate-500">
        Retiros declarados por los estudiantes, con el motivo que reportaron.
        Atenderlas a tiempo es lo que permite retener a quien todavía duda.
      </p>
    </div>

    @if (resumen(); as r) {
      <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p class="text-xs font-medium text-amber-700">Radicadas</p>
          <p class="mt-1 text-2xl font-semibold text-amber-800">
            {{ r.radicadas }}
          </p>
        </div>
        <div class="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <p class="text-xs font-medium text-indigo-700">En revisión</p>
          <p class="mt-1 text-2xl font-semibold text-indigo-800">
            {{ r.enRevision }}
          </p>
        </div>
        <div class="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p class="text-xs font-medium text-emerald-700">Retenidos</p>
          <p class="mt-1 text-2xl font-semibold text-emerald-800">
            {{ r.retenidos }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs font-medium text-slate-500">Retiros confirmados</p>
          <p class="mt-1 text-2xl font-semibold text-slate-900">
            {{ r.confirmadas }}
          </p>
        </div>
      </div>

      @if (r.porMotivo.length > 0) {
        <div class="mb-4 rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs font-semibold text-slate-600">
            Motivos declarados
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            @for (m of r.porMotivo; track m.motivo) {
              <span
                class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
              >
                {{ m.etiqueta }}
                <strong class="ml-1 tabular-nums">{{ m.total }}</strong>
              </span>
            }
          </div>
        </div>
      }
    }

    <div
      class="mb-4 grid grid-cols-2 items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex sm:flex-wrap"
    >
      <div>
        <label for="estado" class="block text-xs font-medium text-slate-600">
          Estado
        </label>
        <select
          id="estado"
          class="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:w-auto"
          [(ngModel)]="estado"
          (ngModelChange)="cargar()"
        >
          <option value="">Todos</option>
          <option value="RADICADA">Radicadas</option>
          <option value="EN_REVISION">En revisión</option>
          <option value="RETENIDO">Retenidos</option>
          <option value="CONFIRMADA">Retiros confirmados</option>
        </select>
      </div>
      <div>
        <label for="motivo" class="block text-xs font-medium text-slate-600">
          Motivo
        </label>
        <select
          id="motivo"
          class="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:w-auto"
          [(ngModel)]="motivoFiltro"
          (ngModelChange)="cargar()"
        >
          <option value="">Todos</option>
          @for (m of motivos; track m) {
            <option [value]="m">{{ etiquetaMotivo(m) }}</option>
          }
        </select>
      </div>
    </div>

    @if (error()) {
      <p role="alert" class="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ error() }}
      </p>
    }

    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
      @if (cargando()) {
        <p class="px-4 py-10 text-center text-slate-500">Cargando…</p>
      } @else if (solicitudes().length === 0) {
        <p class="px-4 py-10 text-center text-slate-500">
          No hay solicitudes de retiro con los filtros seleccionados.
        </p>
      } @else {
        <ul class="divide-y divide-slate-100">
          @for (s of solicitudes(); track s.id) {
            <li class="px-5 py-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  @if (s.estudiante) {
                    <a
                      [routerLink]="['/estudiante', s.estudiante.id]"
                      class="font-medium text-indigo-600 hover:underline"
                    >
                      {{ s.estudiante.usuario.nombres }}
                      {{ s.estudiante.usuario.apellidos }}
                    </a>
                    <p class="mt-0.5 text-xs text-slate-500">
                      {{ s.estudiante.codigoEstudiante }} ·
                      {{ s.estudiante.programa.nombre }} · semestre
                      {{ s.estudiante.semestre }} · cohorte
                      {{ s.estudiante.cohorte }}
                    </p>
                    <p class="text-xs text-slate-500">
                      {{ s.estudiante.usuario.email }}
                    </p>
                  }
                </div>
                <div class="flex flex-col items-end gap-1.5">
                  <span
                    class="rounded-full px-2.5 py-1 text-xs font-medium"
                    [class]="claseEstado(s.estado)"
                  >
                    {{ etiquetaEstado(s.estado) }}
                  </span>
                  @if (puedeResolver() && abierta(s)) {
                    <button
                      type="button"
                      class="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                      (click)="abrir(s)"
                    >
                      Atender
                    </button>
                  }
                </div>
              </div>

              <div class="mt-3 rounded-md bg-slate-50 px-3 py-2">
                <p class="text-xs font-semibold text-slate-600">
                  {{ etiquetaMotivo(s.motivo) }}
                  <span class="font-normal text-slate-400">
                    · radicada el
                    {{ s.fechaSolicitud | date: 'dd/MM/yyyy HH:mm' }}
                    @if (s.nivelRiesgo) {
                      · riesgo {{ s.nivelRiesgo.toLowerCase() }} al radicar
                    }
                  </span>
                </p>
                <p class="mt-1 text-sm text-slate-700 italic">
                  “{{ s.detalle }}”
                </p>
              </div>

              <p class="mt-2 text-xs text-slate-400">
                Notificados: {{ s.destinatarios.length }} destinatario(s)
                @if (!s.correoEnviado) {
                  · correo en modo simulación (revisar log del servidor)
                }
              </p>

              @if (s.respuesta) {
                <div
                  class="mt-2 border-l-2 border-slate-200 pl-3 text-xs text-slate-600"
                >
                  <span class="font-semibold">Gestión:</span> {{ s.respuesta }}
                  @if (s.resueltaPor) {
                    <span class="text-slate-400">
                      — {{ s.resueltaPor.nombres }} {{ s.resueltaPor.apellidos }}
                      @if (s.fechaResolucion) {
                        · {{ s.fechaResolucion | date: 'dd/MM/yyyy' }}
                      }
                    </span>
                  }
                </div>
              }
            </li>
          }
        </ul>
      }
    </div>

    @if (seleccionada(); as s) {
      <div
        class="fixed inset-0 z-30 grid place-items-center bg-slate-900/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-retiro"
      >
        <div
          class="max-h-full w-full overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:w-[32rem] sm:p-6"
        >
          <h2 id="titulo-retiro" class="text-lg font-semibold text-slate-900">
            Atender solicitud de retiro
          </h2>
          @if (s.estudiante) {
            <p class="mt-1 text-sm text-slate-500">
              {{ s.estudiante.usuario.nombres }}
              {{ s.estudiante.usuario.apellidos }} ·
              {{ etiquetaMotivo(s.motivo) }}
            </p>
          }

          <label
            for="resolucion"
            class="mt-5 block text-sm font-medium text-slate-700"
          >
            Decisión
          </label>
          <select
            id="resolucion"
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            [(ngModel)]="resolucion"
          >
            @for (op of resoluciones; track op.valor) {
              <option [value]="op.valor">{{ op.etiqueta }}</option>
            }
          </select>
          <p class="mt-1 text-xs text-slate-500">{{ ayudaResolucion() }}</p>

          <label
            for="respuesta"
            class="mt-4 block text-sm font-medium text-slate-700"
          >
            Gestión realizada
          </label>
          <textarea
            id="respuesta"
            rows="4"
            placeholder="Qué se le ofreció al estudiante y qué acordaron. El estudiante recibe este texto por correo."
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            [(ngModel)]="respuesta"
          ></textarea>

          @if (errorGestion()) {
            <p
              role="alert"
              class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {{ errorGestion() }}
            </p>
          }

          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              (click)="cerrar()"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              [disabled]="guardando() || respuesta.trim().length < 10"
              (click)="guardar()"
            >
              {{ guardando() ? 'Guardando…' : 'Registrar decisión' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DesercionesComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  protected readonly solicitudes = signal<SolicitudDesercion[]>([]);
  protected readonly resumen = signal<ResumenDesercion | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly seleccionada = signal<SolicitudDesercion | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorGestion = signal<string | null>(null);

  protected readonly resoluciones = RESOLUCIONES;
  protected readonly motivos = Object.keys(ETIQUETA_MOTIVO) as MotivoDesercion[];

  /** Solo coordinacion y administracion deciden sobre una matricula. */
  protected readonly puedeResolver = computed(() =>
    this.auth.tieneRol('COORDINADOR', 'ADMINISTRADOR'),
  );

  protected estado = '';
  protected motivoFiltro = '';
  protected resolucion = 'EN_REVISION';
  protected respuesta = '';

  constructor() {
    void this.cargar();
  }

  protected etiquetaMotivo(motivo: MotivoDesercion): string {
    return ETIQUETA_MOTIVO[motivo];
  }

  protected etiquetaEstado(estado: EstadoDesercion): string {
    return ETIQUETA_ESTADO_DESERCION[estado];
  }

  protected claseEstado(estado: EstadoDesercion): string {
    switch (estado) {
      case 'RADICADA':
        return 'bg-amber-100 text-amber-800';
      case 'EN_REVISION':
        return 'bg-indigo-100 text-indigo-800';
      case 'RETENIDO':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-slate-200 text-slate-700';
    }
  }

  protected abierta(solicitud: SolicitudDesercion): boolean {
    return solicitud.estado === 'RADICADA' || solicitud.estado === 'EN_REVISION';
  }

  protected ayudaResolucion(): string {
    return (
      RESOLUCIONES.find((op) => op.valor === this.resolucion)?.ayuda ?? ''
    );
  }

  protected abrir(solicitud: SolicitudDesercion): void {
    this.seleccionada.set(solicitud);
    this.resolucion =
      solicitud.estado === 'RADICADA' ? 'EN_REVISION' : 'RETENIDO';
    this.respuesta = '';
    this.errorGestion.set(null);
  }

  protected cerrar(): void {
    this.seleccionada.set(null);
  }

  protected async guardar(): Promise<void> {
    const solicitud = this.seleccionada();
    if (!solicitud || this.guardando()) return;

    this.guardando.set(true);
    this.errorGestion.set(null);

    try {
      await this.api.resolverDesercion(solicitud.id, {
        estado: this.resolucion,
        respuesta: this.respuesta.trim(),
      });
      this.seleccionada.set(null);
      await this.cargar();
    } catch (error) {
      this.errorGestion.set(this.mensajeDe(error));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      const filtros = {
        estado: this.estado || undefined,
        motivo: this.motivoFiltro || undefined,
      };
      const [solicitudes, resumen] = await Promise.all([
        this.api.deserciones(filtros),
        this.api.resumenDeserciones(),
      ]);
      this.solicitudes.set(solicitudes);
      this.resumen.set(resumen);
    } catch (error) {
      this.error.set(this.mensajeDe(error));
    } finally {
      this.cargando.set(false);
    }
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
