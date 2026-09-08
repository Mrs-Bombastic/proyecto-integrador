import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SemaforoComponent } from '../compartido/semaforo';
import { ApiService } from '../core/api.service';
import {
  ETIQUETA_ESTADO,
  type Alerta,
  type ResumenAlertas,
} from '../core/modelos';

const ACCIONES = [
  { valor: 'CONTACTO', etiqueta: 'Contacto con el estudiante' },
  { valor: 'TUTORIA', etiqueta: 'Tutoría programada' },
  { valor: 'REMISION_BIENESTAR', etiqueta: 'Remisión a Bienestar' },
  { valor: 'CIERRE', etiqueta: 'Cierre del caso' },
  { valor: 'OTRO', etiqueta: 'Otra acción' },
];

/**
 * Panel de gestion de alertas (prototipo 4 y caso de uso 2).
 *
 * Cada alerta se atiende registrando la accion realizada, que es lo que
 * convierte un indicador en rojo en un caso con trazabilidad.
 */
@Component({
  selector: 'app-alertas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, RouterLink, SemaforoComponent],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Gestión de alertas</h1>
        <p class="mt-0.5 text-sm text-slate-500">
          Cada alerta se cierra registrando la acción de acompañamiento realizada.
        </p>
      </div>
      <button
        type="button"
        class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        [disabled]="descargando()"
        (click)="exportar()"
      >
        {{ descargando() ? 'Generando…' : 'Exportar Excel' }}
      </button>
    </div>

    @if (resumen(); as r) {
      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-lg border border-red-200 bg-red-50 p-4">
          <p class="text-xs font-medium text-red-700">Nuevas</p>
          <p class="mt-1 text-2xl font-semibold text-red-800">{{ r.nuevas }}</p>
        </div>
        <div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p class="text-xs font-medium text-amber-700">En proceso</p>
          <p class="mt-1 text-2xl font-semibold text-amber-800">
            {{ r.enProceso }}
          </p>
        </div>
        <div class="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p class="text-xs font-medium text-emerald-700">Gestionadas</p>
          <p class="mt-1 text-2xl font-semibold text-emerald-800">
            {{ r.gestionadas }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs font-medium text-slate-500">Total</p>
          <p class="mt-1 text-2xl font-semibold text-slate-900">{{ r.total }}</p>
        </div>
      </div>
    }

    <div
      class="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div>
        <label for="estado" class="block text-xs font-medium text-slate-600">
          Estado
        </label>
        <select
          id="estado"
          class="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          [(ngModel)]="estado"
          (ngModelChange)="cargar()"
        >
          <option value="">Todos</option>
          <option value="NUEVA">Nuevas</option>
          <option value="EN_PROCESO">En proceso</option>
          <option value="GESTIONADA">Gestionadas</option>
          <option value="DESCARTADA">Descartadas</option>
        </select>
      </div>
      <div>
        <label for="nivel" class="block text-xs font-medium text-slate-600">
          Nivel
        </label>
        <select
          id="nivel"
          class="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          [(ngModel)]="nivelRiesgo"
          (ngModelChange)="cargar()"
        >
          <option value="">Todos</option>
          <option value="ALTO">Riesgo alto</option>
          <option value="MEDIO">Riesgo medio</option>
        </select>
      </div>
    </div>

    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th scope="col" class="px-4 py-3 font-medium">Estudiante</th>
              <th scope="col" class="px-4 py-3 font-medium">Tipo</th>
              <th scope="col" class="px-4 py-3 font-medium">Nivel</th>
              <th scope="col" class="px-4 py-3 font-medium">Fecha</th>
              <th scope="col" class="px-4 py-3 font-medium">Estado</th>
              <th scope="col" class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @if (cargando()) {
              <tr>
                <td colspan="6" class="px-4 py-10 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            } @else if (alertas().length === 0) {
              <tr>
                <td colspan="6" class="px-4 py-10 text-center text-slate-500">
                  No hay alertas con los filtros seleccionados.
                </td>
              </tr>
            } @else {
              @for (a of alertas(); track a.id) {
                <tr class="hover:bg-slate-50">
                  <td class="px-4 py-3">
                    @if (a.estudiante) {
                      <a
                        [routerLink]="['/estudiante', a.estudiante.id]"
                        class="font-medium text-indigo-600 hover:underline"
                      >
                        {{ a.estudiante.usuario.nombres }}
                        {{ a.estudiante.usuario.apellidos }}
                      </a>
                      <p class="text-xs text-slate-500">
                        {{ a.estudiante.codigoEstudiante }} ·
                        {{ a.estudiante.programa.nombre }}
                      </p>
                    }
                  </td>
                  <td class="px-4 py-3 text-slate-600">{{ a.tipoAlerta }}</td>
                  <td class="px-4 py-3">
                    <app-semaforo [nivel]="a.nivelRiesgo" />
                  </td>
                  <td class="px-4 py-3 text-slate-600">
                    {{ a.fechaGeneracion | date: 'dd/MM/yyyy' }}
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="rounded-full px-2.5 py-1 text-xs font-medium"
                      [class]="claseEstado(a.estado)"
                    >
                      {{ nombreEstado(a.estado) }}
                    </span>
                    @if (a._count && a._count.seguimientos > 0) {
                      <span class="ml-1 text-xs text-slate-400">
                        {{ a._count.seguimientos }} acción(es)
                      </span>
                    }
                  </td>
                  <td class="px-4 py-3 text-right">
                    @if (a.estado === 'NUEVA' || a.estado === 'EN_PROCESO') {
                      <button
                        type="button"
                        class="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                        (click)="abrirGestion(a)"
                      >
                        Gestionar
                      </button>
                    } @else {
                      <span class="text-xs text-slate-400">Cerrada</span>
                    }
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (seleccionada(); as a) {
      <div
        class="fixed inset-0 z-30 grid place-items-center bg-slate-900/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-gestion"
      >
        <!-- Ancho fijo en vez de un tope: el diálogo necesita una medida
             propia, y estirado a toda la pantalla sería inmanejable. -->
        <div class="w-full rounded-xl bg-white p-6 shadow-xl sm:w-[32rem]">
          <h2 id="titulo-gestion" class="text-lg font-semibold text-slate-900">
            Registrar acción de seguimiento
          </h2>
          <p class="mt-1 text-sm text-slate-500">{{ a.mensaje }}</p>

          <label
            for="accion"
            class="mt-5 block text-sm font-medium text-slate-700"
          >
            Acción realizada
          </label>
          <select
            id="accion"
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            [(ngModel)]="accion"
          >
            @for (op of acciones; track op.valor) {
              <option [value]="op.valor">{{ op.etiqueta }}</option>
            }
          </select>

          <label
            for="descripcion"
            class="mt-4 block text-sm font-medium text-slate-700"
          >
            Descripción
          </label>
          <textarea
            id="descripcion"
            rows="3"
            placeholder="Describa lo realizado y los acuerdos con el estudiante."
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            [(ngModel)]="descripcion"
          ></textarea>

          <label
            for="nuevoEstado"
            class="mt-4 block text-sm font-medium text-slate-700"
          >
            Nuevo estado
          </label>
          <select
            id="nuevoEstado"
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            [(ngModel)]="nuevoEstado"
          >
            <option value="EN_PROCESO">En proceso</option>
            <option value="GESTIONADA">Gestionada (cerrar)</option>
            <option value="DESCARTADA">Descartar</option>
          </select>

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
              (click)="cerrarGestion()"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              [disabled]="guardando()"
              (click)="guardar()"
            >
              {{ guardando() ? 'Guardando…' : 'Registrar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AlertasComponent {
  private readonly api = inject(ApiService);

  protected readonly alertas = signal<Alerta[]>([]);
  protected readonly resumen = signal<ResumenAlertas | null>(null);
  protected readonly cargando = signal(true);
  protected readonly seleccionada = signal<Alerta | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorGestion = signal<string | null>(null);
  protected readonly descargando = signal(false);

  protected readonly acciones = ACCIONES;

  protected estado = '';
  protected nivelRiesgo = '';
  protected accion = 'CONTACTO';
  protected descripcion = '';
  protected nuevoEstado = 'EN_PROCESO';

  constructor() {
    void this.cargar();
  }

  protected nombreEstado(estado: string): string {
    return ETIQUETA_ESTADO[estado as keyof typeof ETIQUETA_ESTADO];
  }

  protected claseEstado(estado: string): string {
    switch (estado) {
      case 'NUEVA':
        return 'bg-red-100 text-red-800';
      case 'EN_PROCESO':
        return 'bg-amber-100 text-amber-800';
      case 'GESTIONADA':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  protected abrirGestion(alerta: Alerta): void {
    this.seleccionada.set(alerta);
    this.accion = 'CONTACTO';
    this.descripcion = '';
    this.nuevoEstado = 'EN_PROCESO';
    this.errorGestion.set(null);
  }

  protected cerrarGestion(): void {
    this.seleccionada.set(null);
  }

  protected async guardar(): Promise<void> {
    const alerta = this.seleccionada();
    if (!alerta || this.guardando()) return;

    this.guardando.set(true);
    this.errorGestion.set(null);

    try {
      await this.api.registrarSeguimiento(alerta.id, {
        accion: this.accion,
        descripcion: this.descripcion,
        nuevoEstado: this.nuevoEstado,
      });
      this.seleccionada.set(null);
      await this.cargar();
    } catch (error) {
      this.errorGestion.set(this.mensajeDe(error));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async exportar(): Promise<void> {
    if (this.descargando()) return;

    this.descargando.set(true);
    try {
      await this.api.descargarReporte('alertas.xlsx', {
        estado: this.estado || undefined,
        nivelRiesgo: this.nivelRiesgo || undefined,
      });
    } finally {
      this.descargando.set(false);
    }
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const filtros = {
        estado: this.estado || undefined,
        nivelRiesgo: this.nivelRiesgo || undefined,
      };
      const [alertas, resumen] = await Promise.all([
        this.api.alertas(filtros),
        this.api.resumenAlertas(),
      ]);
      this.alertas.set(alertas);
      this.resumen.set(resumen);
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
    return 'No fue posible registrar el seguimiento.';
  }
}
