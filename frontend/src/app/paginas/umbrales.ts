import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { ETIQUETA_INDICADOR, type Umbral } from '../core/modelos';

/**
 * Configuracion de la matriz de riesgo (caso de uso 5).
 *
 * Es la pantalla que hace que las reglas de riesgo sean una decision de la
 * institucion y no del equipo de desarrollo: cambiar un umbral aqui reclasifica
 * a los estudiantes en el siguiente calculo, sin desplegar codigo.
 */
@Component({
  selector: 'app-umbrales',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule],
  template: `
    <h1 class="text-xl font-semibold text-slate-900">Umbrales de riesgo</h1>
    <p class="mt-0.5 mb-6 text-sm text-slate-500">
      Estos valores determinan cuándo un estudiante entra en riesgo. Los cambios
      se aplican en el siguiente cálculo del motor y quedan registrados en la
      auditoría del sistema.
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
      <p
        role="alert"
        class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {{ error() }}
      </p>
    }

    @if (cargando()) {
      <p class="py-16 text-center text-slate-500">Cargando…</p>
    } @else {
      <div class="grid gap-4 lg:grid-cols-2">
        @for (u of umbrales(); track u.indicador) {
          <div class="rounded-lg border border-slate-200 bg-white p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-sm font-semibold text-slate-900">
                  {{ etiqueta(u.indicador) }}
                </h2>
                <p class="mt-0.5 text-xs text-slate-500">{{ u.descripcion }}</p>
              </div>
              <span
                class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                {{ u.mayorEsMejor ? 'mayor es mejor' : 'menor es mejor' }}
              </span>
            </div>

            <div class="mt-4 grid grid-cols-3 gap-3">
              <div>
                <label
                  [for]="'verde-' + u.indicador"
                  class="block text-xs font-medium text-emerald-700"
                >
                  Umbral verde
                </label>
                <input
                  [id]="'verde-' + u.indicador"
                  type="number"
                  step="0.1"
                  min="0"
                  class="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  [ngModel]="edicion[u.indicador].umbralVerde"
                  (ngModelChange)="edicion[u.indicador].umbralVerde = $event"
                />
              </div>
              <div>
                <label
                  [for]="'amarillo-' + u.indicador"
                  class="block text-xs font-medium text-amber-700"
                >
                  Umbral amarillo
                </label>
                <input
                  [id]="'amarillo-' + u.indicador"
                  type="number"
                  step="0.1"
                  min="0"
                  class="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  [ngModel]="edicion[u.indicador].umbralAmarillo"
                  (ngModelChange)="edicion[u.indicador].umbralAmarillo = $event"
                />
              </div>
              <div>
                <label
                  [for]="'peso-' + u.indicador"
                  class="block text-xs font-medium text-slate-600"
                >
                  Peso (0–1)
                </label>
                <input
                  [id]="'peso-' + u.indicador"
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  class="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  [ngModel]="edicion[u.indicador].peso"
                  (ngModelChange)="edicion[u.indicador].peso = $event"
                />
              </div>
            </div>

            <div class="mt-4 flex items-center justify-between">
              <p class="text-xs text-slate-400">
                Actualizado {{ u.actualizadoEn | date: 'dd/MM/yyyy HH:mm' }}
                @if (u.actualizadoPor) {
                  por {{ u.actualizadoPor.nombres }}
                  {{ u.actualizadoPor.apellidos }}
                }
              </p>
              <button
                type="button"
                class="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                [disabled]="guardando() === u.indicador"
                (click)="guardar(u)"
              >
                {{ guardando() === u.indicador ? 'Guardando…' : 'Guardar' }}
              </button>
            </div>
          </div>
        }
      </div>

      <p class="mt-6 text-xs text-slate-500">
        La suma de los pesos se normaliza automáticamente, de modo que el puntaje
        de riesgo siempre queda entre 0 y 100 aunque los valores no sumen 1.
      </p>
    }
  `,
})
export class UmbralesComponent {
  private readonly api = inject(ApiService);

  protected readonly umbrales = signal<Umbral[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal<string | null>(null);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected edicion: Record<
    string,
    { umbralVerde: number; umbralAmarillo: number; peso: number }
  > = {};

  constructor() {
    void this.cargar();
  }

  protected etiqueta(indicador: string): string {
    return ETIQUETA_INDICADOR[indicador as keyof typeof ETIQUETA_INDICADOR];
  }

  protected async guardar(umbral: Umbral): Promise<void> {
    this.guardando.set(umbral.indicador);
    this.mensaje.set(null);
    this.error.set(null);

    try {
      await this.api.actualizarUmbral(
        umbral.indicador,
        this.edicion[umbral.indicador],
      );
      this.mensaje.set(
        `Umbral de ${this.etiqueta(umbral.indicador)} actualizado. Se aplicará en el próximo cálculo.`,
      );
      await this.cargar();
    } catch (error) {
      this.error.set(this.mensajeDe(error));
    } finally {
      this.guardando.set(null);
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const umbrales = await this.api.umbrales();
      this.umbrales.set(umbrales);
      this.edicion = Object.fromEntries(
        umbrales.map((u) => [
          u.indicador,
          {
            umbralVerde: Number(u.umbralVerde),
            umbralAmarillo: Number(u.umbralAmarillo),
            peso: Number(u.peso),
          },
        ]),
      );
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
    return 'No fue posible guardar el umbral.';
  }
}
