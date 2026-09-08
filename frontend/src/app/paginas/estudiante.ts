import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GraficaComponent, type SerieGrafica } from '../compartido/grafica';
import {
  IndicadorSemaforoComponent,
  SemaforoComponent,
} from '../compartido/semaforo';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import {
  ETIQUETA_ESTADO,
  ETIQUETA_INDICADOR,
  type CursoEstudiante,
  type DetalleEstudiante,
  type DetalleIndicador,
  type Observacion,
} from '../core/modelos';

const COLOR_SEMAFORO: Record<string, string> = {
  VERDE: '#10b981',
  AMARILLO: '#f59e0b',
  ROJO: '#ef4444',
};

/**
 * Detalle academico de un estudiante (prototipo 3).
 *
 * El mismo componente sirve al docente y al coordinador que consultan a un
 * estudiante y al estudiante que consulta su propio progreso (RF10): el
 * backend ya restringe que un estudiante solo pueda pedir su propio id, y aqui
 * solo se ajusta el encabezado.
 */
@Component({
  selector: 'app-estudiante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    GraficaComponent,
    SemaforoComponent,
    IndicadorSemaforoComponent,
  ],
  template: `
    @if (cargando()) {
      <p class="py-16 text-center text-slate-500">Cargando información…</p>
    } @else if (error()) {
      <div class="rounded-lg border border-red-200 bg-red-50 p-6">
        <p class="font-medium text-red-800">{{ error() }}</p>
        @if (!esPropio()) {
          <a routerLink="/panel" class="mt-2 inline-block text-sm text-red-700 underline">
            Volver al panel
          </a>
        }
      </div>
    } @else if (detalle(); as d) {
      @if (!esPropio()) {
        <a
          routerLink="/panel"
          class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          ← Volver al listado
        </a>
      }

      <div
        class="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5"
      >
        <div>
          <h1 class="text-xl font-semibold text-slate-900">
            {{ esPropio() ? 'Mi progreso académico' : d.nombre }}
          </h1>
          <p class="mt-1 text-sm text-slate-500">
            {{ d.codigoEstudiante }} · {{ d.programaNombre }}
          </p>
        </div>
        <div class="text-right">
          <app-semaforo [nivel]="d.resultado.nivel" />
          <p class="mt-1.5 text-xs text-slate-500">
            Puntaje de riesgo: {{ d.resultado.puntaje }} / 100
          </p>
          <button
            type="button"
            class="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            [disabled]="descargando()"
            (click)="descargarFicha()"
          >
            {{ descargando() ? 'Generando…' : 'Descargar ficha PDF' }}
          </button>
          @if (d.resultado.elevadoPorReglaCritica) {
            <p class="mt-1 text-xs text-amber-700">
              Nivel elevado por un indicador crítico en rojo.
            </p>
          }
        </div>
      </div>

      <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        @for (ind of d.resultado.detalle; track ind.indicador) {
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <div class="flex items-start justify-between gap-2">
              <p class="text-xs font-medium text-slate-500">
                {{ etiqueta(ind.indicador) }}
              </p>
              <app-indicador-semaforo
                [semaforo]="ind.semaforo"
                [texto]="ind.semaforo"
              />
            </div>
            <p class="mt-2 text-2xl font-semibold text-slate-900">
              {{ formatoValor(ind) }}
            </p>
            <p class="mt-1 text-xs text-slate-400">
              Peso {{ (ind.peso * 100).toFixed(0) }} %
              @if (ind.umbralIncumplido !== null) {
                · umbral {{ ind.umbralIncumplido }}
              }
            </p>
          </div>
        }
      </div>

      <div class="mb-6 grid gap-4 lg:grid-cols-3">
        <div class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="mb-3 text-sm font-semibold text-slate-800">
            Promedio por curso
          </h2>
          @if (d.cursos.length > 0) {
            <app-grafica
              tipo="bar"
              [etiquetas]="etiquetasCursos()"
              [series]="serieCursos()"
              [maximoY]="5"
            />
            <p class="mt-2 text-xs text-slate-400">
              Promedio ponderado por el peso de cada corte, en escala 0 a 5.
            </p>
          } @else {
            <p class="py-16 text-center text-sm text-slate-500">
              El estudiante no tiene cursos inscritos.
            </p>
          }
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="mb-3 text-sm font-semibold text-slate-800">
            Indicadores actuales
          </h2>
          <app-grafica
            tipo="bar"
            [etiquetas]="etiquetasIndicadores()"
            [series]="serieIndicadores()"
            [maximoY]="100"
          />
          <p class="mt-2 text-xs text-slate-400">
            Valores normalizados a escala 0–100 para poder compararlos.
          </p>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="mb-3 text-sm font-semibold text-slate-800">
            Evolución del puntaje de riesgo
          </h2>
          @if (d.historial.length > 1) {
            <app-grafica
              [etiquetas]="etiquetasHistorial()"
              [series]="serieHistorial()"
              [maximoY]="100"
            />
          } @else {
            <p class="py-16 text-center text-sm text-slate-500">
              Aún no hay suficiente historial para trazar una evolución.
              Se registra un punto cada vez que el riesgo cambia.
            </p>
          }
        </div>
      </div>

      <div class="mb-6 rounded-lg border border-slate-200 bg-white">
        <h2
          class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800"
        >
          Rendimiento por curso
        </h2>
        @if (d.cursos.length === 0) {
          <p class="px-5 py-10 text-center text-sm text-slate-500">
            Sin cursos inscritos en el periodo.
          </p>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th scope="col" class="px-5 py-2.5 font-medium">Curso</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-medium">
                    Corte 1
                  </th>
                  <th scope="col" class="px-3 py-2.5 text-right font-medium">
                    Corte 2
                  </th>
                  <th scope="col" class="px-3 py-2.5 text-right font-medium">
                    Corte 3
                  </th>
                  <th scope="col" class="px-3 py-2.5 text-right font-medium">
                    Promedio
                  </th>
                  <th scope="col" class="px-3 py-2.5 text-right font-medium">
                    Asistencia
                  </th>
                  <th scope="col" class="px-3 py-2.5 text-right font-medium">
                    Vencidas
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (c of d.cursos; track c.cursoId) {
                  <tr class="hover:bg-slate-50">
                    <td class="px-5 py-3">
                      <p class="font-medium text-slate-900">{{ c.nombre }}</p>
                      <p class="text-xs text-slate-500">
                        {{ c.codigo }} · {{ c.periodo }}
                        @if (c.docente) {
                          · {{ c.docente }}
                        }
                      </p>
                    </td>
                    @for (corte of cortes; track corte) {
                      <td class="px-3 py-3 text-right tabular-nums">
                        {{ notaDeCorte(c, corte) }}
                      </td>
                    }
                    <td
                      class="px-3 py-3 text-right font-semibold tabular-nums"
                      [class]="colorNota(c.promedio)"
                    >
                      {{ c.promedio.toFixed(2) }}
                    </td>
                    <td class="px-3 py-3 text-right tabular-nums text-slate-700">
                      {{ c.asistencia.porcentaje }}%
                      <span class="block text-xs text-slate-400">
                        {{ c.asistencia.ausentes }} ausencia(s)
                      </span>
                    </td>
                    <td class="px-3 py-3 text-right tabular-nums text-slate-700">
                      {{ c.entregas.vencidas }}/{{ c.entregas.total }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              class="text-sm font-medium text-indigo-600 hover:underline"
              (click)="alternarAsistencia()"
            >
              {{
                asistenciaAbierta()
                  ? 'Ocultar historial de asistencia'
                  : 'Ver historial de asistencia sesión por sesión'
              }}
            </button>

            @if (asistenciaAbierta()) {
              <div class="mt-4 flex flex-col gap-5">
                @for (c of d.cursos; track c.cursoId) {
                  <div>
                    <p class="mb-2 text-xs font-semibold text-slate-700">
                      {{ c.nombre }}
                      <span class="font-normal text-slate-400">
                        · {{ c.asistencia.presentes }} presente(s),
                        {{ c.asistencia.tarde }} tarde,
                        {{ c.asistencia.ausentes }} ausente(s),
                        {{ c.asistencia.justificadas }} justificada(s)
                      </span>
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                      @for (sesion of c.asistencia.sesiones; track sesion.fecha) {
                        <span
                          class="rounded px-1.5 py-1 text-[0.6875rem] tabular-nums"
                          [class]="claseSesion(sesion.estado)"
                          [title]="
                            (sesion.fecha | date: 'dd/MM/yyyy') +
                            ' · ' +
                            sesion.estado
                          "
                        >
                          {{ sesion.fecha | date: 'dd/MM' }}
                        </span>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <div class="rounded-lg border border-slate-200 bg-white">
        <h2 class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">
          Alertas y seguimiento
        </h2>
        @if (d.alertas.length === 0) {
          <p class="px-5 py-10 text-center text-sm text-slate-500">
            No hay alertas registradas para este estudiante.
          </p>
        } @else {
          <ul class="divide-y divide-slate-100">
            @for (a of d.alertas; track a.id) {
              <li class="px-5 py-4">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p class="text-sm font-medium text-slate-800">
                      {{ a.mensaje }}
                    </p>
                    <p class="mt-1 text-xs text-slate-500">
                      {{ a.tipoAlerta }} ·
                      {{ a.fechaGeneracion | date: 'dd/MM/yyyy HH:mm' }}
                      @if (a.curso) {
                        · {{ a.curso.nombre }}
                      }
                    </p>
                  </div>
                  <span
                    class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {{ estado(a.estado) }}
                  </span>
                </div>

                @if (a.seguimientos && a.seguimientos.length > 0) {
                  <ul class="mt-3 space-y-2 border-l-2 border-slate-100 pl-3">
                    @for (s of a.seguimientos; track s.id) {
                      <li class="text-xs">
                        <span class="font-medium text-slate-700">
                          {{ s.accion }}
                        </span>
                        <span class="text-slate-400">
                          · {{ s.fecha | date: 'dd/MM/yyyy' }}
                        </span>
                        <p class="text-slate-600">{{ s.descripcion }}</p>
                      </li>
                    }
                  </ul>
                }
              </li>
            }
          </ul>
        }
      </div>

      @if (!esPropio()) {
        <div class="mt-6 rounded-lg border border-slate-200 bg-white">
          <h2
            class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800"
          >
            Observaciones docentes
          </h2>

          @if (puedeObservar()) {
            <div class="border-b border-slate-100 px-5 py-4">
              <label
                for="observacion"
                class="block text-xs font-medium text-slate-600"
              >
                Registrar una observación cualitativa
              </label>
              <textarea
                id="observacion"
                rows="3"
                placeholder="Describa lo que los indicadores no muestran: contexto, avances, acuerdos."
                class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                [(ngModel)]="nuevaObservacion"
              ></textarea>

              @if (errorObservacion()) {
                <p role="alert" class="mt-2 text-xs text-red-700">
                  {{ errorObservacion() }}
                </p>
              }

              <div class="mt-2 flex justify-end">
                <button
                  type="button"
                  class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  [disabled]="guardandoObservacion()"
                  (click)="guardarObservacion()"
                >
                  {{ guardandoObservacion() ? 'Guardando…' : 'Registrar' }}
                </button>
              </div>
            </div>
          }

          @if (observaciones().length === 0) {
            <p class="px-5 py-10 text-center text-sm text-slate-500">
              No hay observaciones registradas.
            </p>
          } @else {
            <ul class="divide-y divide-slate-100">
              @for (o of observaciones(); track o.id) {
                <li class="px-5 py-4">
                  <p class="text-sm text-slate-800">{{ o.contenido }}</p>
                  <p class="mt-1 text-xs text-slate-500">
                    {{ o.docente.usuario.nombres }}
                    {{ o.docente.usuario.apellidos }} ·
                    {{ o.fecha | date: 'dd/MM/yyyy HH:mm' }}
                    @if (o.curso) {
                      · {{ o.curso.nombre }}
                    }
                  </p>
                </li>
              }
            </ul>
          }
        </div>
      }
    }
  `,
})
export class EstudianteComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** Id recibido por la ruta. En /mi-progreso se toma el del propio usuario. */
  readonly id = input<string>('');

  protected readonly detalle = signal<DetalleEstudiante | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly esPropio = computed(
    () => this.auth.rol() === 'ESTUDIANTE',
  );

  protected readonly observaciones = signal<Observacion[]>([]);
  protected readonly puedeObservar = computed(
    () => this.auth.rol() === 'DOCENTE',
  );
  protected readonly guardandoObservacion = signal(false);
  protected readonly errorObservacion = signal<string | null>(null);
  protected readonly descargando = signal(false);
  protected readonly asistenciaAbierta = signal(false);
  protected readonly cortes = [1, 2, 3];
  protected nuevaObservacion = '';

  protected alternarAsistencia(): void {
    this.asistenciaAbierta.update((abierta) => !abierta);
  }

  /** Nota del corte indicado, o un guion cuando todavia no se ha registrado. */
  protected notaDeCorte(curso: CursoEstudiante, corte: number): string {
    const calificacion = curso.calificaciones.find((c) => c.corte === corte);
    return calificacion ? calificacion.nota.toFixed(2) : '—';
  }

  protected colorNota(nota: number): string {
    if (nota < 3) return 'text-red-700';
    if (nota < 3.5) return 'text-amber-700';
    return 'text-slate-900';
  }

  protected claseSesion(estado: string): string {
    switch (estado) {
      case 'PRESENTE':
        return 'bg-emerald-50 text-emerald-700';
      case 'TARDE':
        return 'bg-amber-50 text-amber-700';
      case 'JUSTIFICADO':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-red-50 text-red-700';
    }
  }

  protected etiquetasCursos(): string[] {
    return (this.detalle()?.cursos ?? []).map((c) => c.nombre);
  }

  /** Una barra por curso, coloreada segun si el promedio pasa los umbrales. */
  protected serieCursos(): SerieGrafica[] {
    const cursos = this.detalle()?.cursos ?? [];
    const valores = cursos.map((c) => c.promedio);
    const colores = cursos.map((c) =>
      c.promedio < 3
        ? COLOR_SEMAFORO['ROJO']
        : c.promedio < 3.5
          ? COLOR_SEMAFORO['AMARILLO']
          : COLOR_SEMAFORO['VERDE'],
    );

    return [{ etiqueta: 'Promedio', valores, color: '#4f46e5', colores }];
  }

  protected async descargarFicha(): Promise<void> {
    const id = this.detalle()?.estudianteId;
    if (!id || this.descargando()) return;

    this.descargando.set(true);
    try {
      await this.api.descargarReporte(`estudiante/${id}.pdf`);
    } finally {
      this.descargando.set(false);
    }
  }

  protected async guardarObservacion(): Promise<void> {
    const id = this.detalle()?.estudianteId;
    if (!id || this.guardandoObservacion()) return;

    this.guardandoObservacion.set(true);
    this.errorObservacion.set(null);

    try {
      await this.api.crearObservacion({
        estudianteId: id,
        contenido: this.nuevaObservacion,
      });
      this.nuevaObservacion = '';
      this.observaciones.set(await this.api.observaciones(id));
    } catch (error) {
      this.errorObservacion.set(this.mensajeDe(error));
    } finally {
      this.guardandoObservacion.set(false);
    }
  }

  private mensajeDe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const mensaje = error.error?.message;
      if (Array.isArray(mensaje)) return mensaje.join('. ');
      if (typeof mensaje === 'string') return mensaje;
    }
    return 'No fue posible registrar la observación.';
  }

  constructor() {
    // Los inputs enlazados a la ruta se asignan despues de construir el
    // componente, asi que la carga no puede dispararse desde el constructor.
    // El effect ademas recarga al navegar de un estudiante a otro sin que
    // Angular llegue a recrear el componente.
    effect(() => {
      const idRuta = this.id();
      const idSesion = this.auth.usuario()?.perfilId;
      void this.cargar(idRuta || idSesion);
    });
  }

  protected etiqueta(indicador: string): string {
    return ETIQUETA_INDICADOR[indicador as keyof typeof ETIQUETA_INDICADOR];
  }

  protected estado(valor: string): string {
    return ETIQUETA_ESTADO[valor as keyof typeof ETIQUETA_ESTADO];
  }

  protected formatoValor(indicador: DetalleIndicador): string {
    switch (indicador.indicador) {
      case 'PROMEDIO':
        return indicador.valor.toFixed(2);
      case 'ASISTENCIA':
        return `${indicador.valor.toFixed(0)} %`;
      case 'PARTICIPACION':
        return indicador.valor.toFixed(1);
      default:
        return String(Math.round(indicador.valor));
    }
  }

  protected etiquetasIndicadores(): string[] {
    return (this.detalle()?.resultado.detalle ?? []).map(
      (d) => ETIQUETA_INDICADOR[d.indicador],
    );
  }

  /**
   * Lleva los cuatro indicadores a una escala comun 0–100 para poder
   * graficarlos juntos: un promedio de 0 a 5 y una asistencia porcentual no
   * son comparables en el mismo eje sin normalizar.
   */
  protected serieIndicadores(): SerieGrafica[] {
    const detalle = this.detalle()?.resultado.detalle ?? [];

    const valores = detalle.map((d) => {
      switch (d.indicador) {
        case 'PROMEDIO':
          return (d.valor / 5) * 100;
        case 'ASISTENCIA':
          return d.valor;
        case 'PARTICIPACION':
          return Math.min((d.valor / 5) * 100, 100);
        default:
          // Entregas vencidas: se invierte para que "mas alto" siga siendo mejor.
          return Math.max(0, 100 - d.valor * 20);
      }
    });

    // Cada barra toma el color de su semaforo: el grafico refuerza la misma
    // lectura que las tarjetas de arriba en vez de introducir otra escala.
    const colores = detalle.map((d) => COLOR_SEMAFORO[d.semaforo]);

    return [
      { etiqueta: 'Nivel del indicador', valores, color: '#4f46e5', colores },
    ];
  }

  protected etiquetasHistorial(): string[] {
    return [...(this.detalle()?.historial ?? [])]
      .reverse()
      .map((h) =>
        new Date(h.calculadoEn).toLocaleDateString('es-CO', {
          day: '2-digit',
          month: 'short',
        }),
      );
  }

  protected serieHistorial(): SerieGrafica[] {
    const valores = [...(this.detalle()?.historial ?? [])]
      .reverse()
      .map((h) => Number(h.puntajeRiesgo));

    return [{ etiqueta: 'Puntaje de riesgo', valores, color: '#dc2626' }];
  }

  private async cargar(idEstudiante: string | undefined): Promise<void> {
    if (!idEstudiante) {
      this.error.set('No hay un estudiante asociado a esta sesión.');
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    try {
      this.detalle.set(await this.api.estudiante(idEstudiante));

      // Las observaciones son de uso interno docente: el propio estudiante no
      // las consulta, y pedirlas daria 403.
      if (this.auth.rol() !== 'ESTUDIANTE') {
        this.observaciones.set(await this.api.observaciones(idEstudiante));
      }
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse && error.status === 403
          ? 'No tiene permiso para consultar este estudiante.'
          : 'No fue posible cargar la información del estudiante.',
      );
    } finally {
      this.cargando.set(false);
    }
  }
}
