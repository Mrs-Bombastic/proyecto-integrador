import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SemaforoComponent } from '../compartido/semaforo';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type {
  Cohorte,
  Curso,
  EstudianteRiesgo,
  Programa,
  ResumenRiesgo,
} from '../core/modelos';

/**
 * Panel de docente y coordinador (prototipo 2): listado de estudiantes con
 * esquema de semaforo y filtros por programa, curso, nivel y busqueda (RF08,
 * RF11).
 */
@Component({
  selector: 'app-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, SemaforoComponent],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">
          Seguimiento de estudiantes
        </h1>
        <p class="mt-0.5 text-sm text-slate-500">
          Ordenados por nivel de riesgo: primero quienes requieren atención.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          [disabled]="descargando() !== null"
          (click)="exportar('estudiantes.xlsx')"
        >
          {{ descargando() === 'estudiantes.xlsx' ? 'Generando…' : 'Excel' }}
        </button>
        <button
          type="button"
          class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          [disabled]="descargando() !== null"
          (click)="exportar('estudiantes.pdf')"
        >
          {{ descargando() === 'estudiantes.pdf' ? 'Generando…' : 'PDF' }}
        </button>

        @if (auth.tieneRol('COORDINADOR', 'ADMINISTRADOR')) {
          <button
            type="button"
            class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            [disabled]="recalculando()"
            (click)="recalcular()"
          >
            {{ recalculando() ? 'Recalculando…' : 'Recalcular riesgo' }}
          </button>
        }
      </div>
    </div>

    @if (resumen(); as r) {
      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs font-medium text-slate-500">Estudiantes</p>
          <p class="mt-1 text-2xl font-semibold text-slate-900">
            {{ r.totalEstudiantes }}
          </p>
        </div>
        <div class="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p class="text-xs font-medium text-emerald-700">Normal</p>
          <p class="mt-1 text-2xl font-semibold text-emerald-800">
            {{ r.normal }}
          </p>
        </div>
        <div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p class="text-xs font-medium text-amber-700">Riesgo medio</p>
          <p class="mt-1 text-2xl font-semibold text-amber-800">{{ r.medio }}</p>
        </div>
        <div class="rounded-lg border border-red-200 bg-red-50 p-4">
          <p class="text-xs font-medium text-red-700">Riesgo alto</p>
          <p class="mt-1 text-2xl font-semibold text-red-800">{{ r.alto }}</p>
        </div>
      </div>
    }

    <div
      class="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      @if (programas().length > 1) {
        <div>
          <label for="programa" class="block text-xs font-medium text-slate-600">
            Programa
          </label>
          <select
            id="programa"
            class="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            [(ngModel)]="programaId"
            (ngModelChange)="cambiarPrograma()"
          >
            <option value="">Todos</option>
            @for (p of programas(); track p.id) {
              <option [value]="p.id">{{ p.nombre }}</option>
            }
          </select>
        </div>
      }

      <div>
        <label for="curso" class="block text-xs font-medium text-slate-600">
          Curso
        </label>
        <select
          id="curso"
          class="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          [(ngModel)]="cursoId"
          (ngModelChange)="cargar()"
        >
          <option value="">Todos</option>
          @for (c of cursos(); track c.id) {
            <option [value]="c.id">{{ c.nombre }}</option>
          }
        </select>
      </div>

      <div>
        <label for="cohorte" class="block text-xs font-medium text-slate-600">
          Cohorte
        </label>
        <select
          id="cohorte"
          class="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          [(ngModel)]="cohorte"
          (ngModelChange)="cargar()"
        >
          <option value="">Todas</option>
          @for (c of cohortes(); track c.cohorte) {
            <option [value]="c.cohorte">
              {{ c.cohorte }} ({{ c.estudiantes }})
            </option>
          }
        </select>
      </div>

      <div>
        <label for="periodo" class="block text-xs font-medium text-slate-600">
          Periodo
        </label>
        <select
          id="periodo"
          class="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          [(ngModel)]="periodo"
          (ngModelChange)="cargar()"
        >
          <option value="">Todos</option>
          @for (p of periodos(); track p) {
            <option [value]="p">{{ p }}</option>
          }
        </select>
      </div>

      <div>
        <label for="nivel" class="block text-xs font-medium text-slate-600">
          Nivel de riesgo
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
          <option value="NORMAL">Normal</option>
        </select>
      </div>

      <div class="flex-1 min-w-48">
        <label for="busqueda" class="block text-xs font-medium text-slate-600">
          Buscar
        </label>
        <input
          id="busqueda"
          type="search"
          placeholder="Nombre o código"
          class="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          [(ngModel)]="busqueda"
          (keyup.enter)="cargar()"
        />
      </div>

      <button
        type="button"
        class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        (click)="cargar()"
      >
        Filtrar
      </button>

      @if (hayFiltros()) {
        <button
          type="button"
          class="text-sm font-medium text-slate-500 hover:underline"
          (click)="limpiar()"
        >
          Limpiar
        </button>
      }
    </div>

    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th scope="col" class="px-4 py-3 font-medium">Estudiante</th>
              <th scope="col" class="px-4 py-3 font-medium">Programa</th>
              <th scope="col" class="px-4 py-3 font-medium">Cohorte</th>
              <th scope="col" class="px-4 py-3 text-right font-medium">
                Promedio
              </th>
              <th scope="col" class="px-4 py-3 text-right font-medium">
                Asistencia
              </th>
              <th scope="col" class="px-4 py-3 text-right font-medium">
                Participación
              </th>
              <th scope="col" class="px-4 py-3 text-right font-medium">
                Vencidas
              </th>
              <th scope="col" class="px-4 py-3 font-medium">Estado</th>
              <th scope="col" class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @if (cargando()) {
              <tr>
                <td colspan="9" class="px-4 py-10 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            } @else if (estudiantes().length === 0) {
              <tr>
                <td colspan="9" class="px-4 py-10 text-center text-slate-500">
                  No hay estudiantes que coincidan con los filtros aplicados.
                </td>
              </tr>
            } @else {
              @for (e of estudiantes(); track e.estudianteId) {
                <tr class="hover:bg-slate-50">
                  <td class="px-4 py-3">
                    <p class="font-medium text-slate-900">{{ e.nombre }}</p>
                    <p class="text-xs text-slate-500">
                      {{ e.codigoEstudiante }}
                    </p>
                  </td>
                  <td class="px-4 py-3 text-slate-600">
                    {{ e.programaNombre }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-slate-600">
                    {{ e.cohorte }}
                    <span class="text-xs text-slate-400"
                      >· sem. {{ e.semestre }}</span
                    >
                  </td>
                  <td
                    class="px-4 py-3 text-right tabular-nums"
                    [class]="colorValor(e, 'PROMEDIO')"
                  >
                    {{ e.valores.PROMEDIO.toFixed(2) }}
                  </td>
                  <td
                    class="px-4 py-3 text-right tabular-nums"
                    [class]="colorValor(e, 'ASISTENCIA')"
                  >
                    {{ e.valores.ASISTENCIA.toFixed(0) }}%
                  </td>
                  <td
                    class="px-4 py-3 text-right tabular-nums"
                    [class]="colorValor(e, 'PARTICIPACION')"
                  >
                    {{ e.valores.PARTICIPACION.toFixed(1) }}
                  </td>
                  <td
                    class="px-4 py-3 text-right tabular-nums"
                    [class]="colorValor(e, 'ENTREGAS')"
                  >
                    {{ e.valores.ENTREGAS }}
                  </td>
                  <td class="px-4 py-3">
                    <app-semaforo [nivel]="e.resultado.nivel" />
                    @if (e.alertasAbiertas > 0) {
                      <span class="ml-1 text-xs text-slate-500">
                        {{ e.alertasAbiertas }} alerta(s)
                      </span>
                    }
                  </td>
                  <td class="px-4 py-3 text-right">
                    <a
                      [routerLink]="['/estudiante', e.estudianteId]"
                      class="text-sm font-medium text-indigo-600 hover:underline"
                      >Ver detalle</a
                    >
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (!cargando() && estudiantes().length > 0) {
      <p class="mt-3 text-xs text-slate-500">
        {{ estudiantes().length }} estudiante(s) listado(s).
      </p>
    }
  `,
})
export class PanelComponent {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);

  protected readonly estudiantes = signal<EstudianteRiesgo[]>([]);
  protected readonly programas = signal<Programa[]>([]);
  protected readonly cursos = signal<Curso[]>([]);
  protected readonly cohortes = signal<Cohorte[]>([]);
  protected readonly periodos = signal<string[]>([]);
  protected readonly resumen = signal<ResumenRiesgo | null>(null);
  protected readonly cargando = signal(true);
  protected readonly recalculando = signal(false);
  protected readonly descargando = signal<string | null>(null);

  protected programaId = '';
  protected cursoId = '';
  protected nivelRiesgo = '';
  protected busqueda = '';
  protected cohorte = '';
  protected periodo = '';

  constructor() {
    void this.inicializar();
  }

  protected hayFiltros(): boolean {
    return Boolean(
      this.programaId ||
        this.cursoId ||
        this.nivelRiesgo ||
        this.busqueda ||
        this.cohorte ||
        this.periodo,
    );
  }

  protected async cambiarPrograma(): Promise<void> {
    this.cursoId = '';
    const [cursos, cohortes] = await Promise.all([
      this.api.cursos(this.programaId || undefined),
      this.api.cohortes(this.programaId || undefined),
    ]);
    this.cursos.set(cursos);
    this.cohortes.set(cohortes);
    await this.cargar();
  }

  protected limpiar(): void {
    this.programaId = '';
    this.cursoId = '';
    this.nivelRiesgo = '';
    this.busqueda = '';
    this.cohorte = '';
    this.periodo = '';
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [estudiantes, resumen] = await Promise.all([
        this.api.estudiantes({
          programaId: this.programaId || undefined,
          cursoId: this.cursoId || undefined,
          nivelRiesgo: this.nivelRiesgo || undefined,
          busqueda: this.busqueda || undefined,
          cohorte: this.cohorte || undefined,
          periodo: this.periodo || undefined,
        }),
        this.api.resumenRiesgo({
          programaId: this.programaId || undefined,
          cursoId: this.cursoId || undefined,
        }),
      ]);
      this.estudiantes.set(estudiantes);
      this.resumen.set(resumen);
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Exporta el listado con los mismos filtros que hay en pantalla, para que el
   * archivo coincida exactamente con lo que el usuario esta viendo (RF07).
   */
  protected async exportar(reporte: string): Promise<void> {
    if (this.descargando()) return;

    this.descargando.set(reporte);
    try {
      await this.api.descargarReporte(reporte, {
        programaId: this.programaId || undefined,
        cursoId: this.cursoId || undefined,
        nivelRiesgo: this.nivelRiesgo || undefined,
        busqueda: this.busqueda || undefined,
        cohorte: this.cohorte || undefined,
        periodo: this.periodo || undefined,
      });
    } finally {
      this.descargando.set(null);
    }
  }

  protected async recalcular(): Promise<void> {
    this.recalculando.set(true);
    try {
      await this.api.recalcular();
      await this.cargar();
    } finally {
      this.recalculando.set(false);
    }
  }

  /** Resalta en la tabla el valor que ya incumple su umbral. */
  protected colorValor(
    estudiante: EstudianteRiesgo,
    indicador: string,
  ): string {
    const detalle = estudiante.resultado.detalle.find(
      (d) => d.indicador === indicador,
    );
    switch (detalle?.semaforo) {
      case 'ROJO':
        return 'text-red-700 font-semibold';
      case 'AMARILLO':
        return 'text-amber-700 font-medium';
      default:
        return 'text-slate-700';
    }
  }

  private async inicializar(): Promise<void> {
    const [programas, cursos, cohortes, periodos] = await Promise.all([
      this.api.programas(),
      this.api.cursos(),
      this.api.cohortes(),
      this.api.periodos(),
    ]);
    this.programas.set(programas);
    this.cursos.set(cursos);
    this.cohortes.set(cohortes);
    this.periodos.set(periodos);
    await this.cargar();
  }
}
