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
import {
  ETIQUETA_ESTADO_DESERCION,
  ETIQUETA_MOTIVO,
  type EstadoDesercion,
  type MotivoDesercion,
  type SolicitudDesercion,
} from '../core/modelos';

/** Motivos en el orden en que se le ofrecen al estudiante. */
const MOTIVOS: MotivoDesercion[] = [
  'ECONOMICO',
  'LABORAL',
  'ACADEMICO',
  'SALUD',
  'FAMILIAR',
  'PERSONAL',
  'CAMBIO_PROGRAMA',
  'OTRO',
];

/** Estados en los que la solicitud sigue en tramite. */
const ABIERTOS: EstadoDesercion[] = ['RADICADA', 'EN_REVISION'];

/**
 * Retiro del programa (RF14).
 *
 * El estudiante declara que quiere desertar y explica por que. La pantalla se
 * disena para que el motivo se registre bien —es el dato que permite intervenir
 * la desercion— y para que el estudiante sepa, antes de enviar, que sus
 * docentes y las directivas quedan notificados y que todavia puede haber
 * alternativas.
 */
@Component({
  selector: 'app-retiro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-3xl">
      <h1 class="text-xl font-semibold text-slate-900">Retiro del programa</h1>
      <p class="mt-1 text-sm text-slate-500">
        Si estás pensando en dejar el programa, cuéntanos por qué. Tus docentes y
        la coordinación recibirán tu solicitud y te contactarán antes de hacerla
        efectiva.
      </p>

      @if (cargando()) {
        <p class="py-16 text-center text-slate-500">Cargando…</p>
      } @else {
        @if (enTramite(); as solicitud) {
          <div
            class="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5"
            role="status"
          >
            <p class="text-sm font-semibold text-amber-900">
              Tienes una solicitud en trámite ({{ estado(solicitud.estado) }})
            </p>
            <p class="mt-1 text-sm text-amber-800">
              Radicada el
              {{ solicitud.fechaSolicitud | date: 'dd/MM/yyyy HH:mm' }} ·
              {{ motivo(solicitud.motivo) }}
            </p>
            <p class="mt-3 text-sm text-amber-900 italic">
              “{{ solicitud.detalle }}”
            </p>
            <p class="mt-3 text-xs text-amber-700">
              Se notificó a {{ solicitud.destinatarios.length }} persona(s) de tu
              programa. Mientras la solicitud esté abierta no puedes radicar otra;
              si cambiaste de opinión, avísale a tu coordinación.
            </p>
          </div>
        } @else {
          <form
            class="mt-6 rounded-lg border border-slate-200 bg-white p-5"
            (ngSubmit)="enviar()"
          >
            <div
              class="mb-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600"
            >
              Al enviar este formulario se notifica por correo a los docentes de
              tus cursos, a la coordinación del programa y a Bienestar
              Universitario. Tu matrícula <strong>no</strong> se retira de
              inmediato: primero la coordinación revisa tu caso.
            </div>

            <label
              for="motivo"
              class="block text-sm font-medium text-slate-700"
            >
              ¿Cuál es el motivo principal?
            </label>
            <select
              id="motivo"
              name="motivo"
              required
              class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              [(ngModel)]="motivoElegido"
            >
              <option value="" disabled>Selecciona un motivo…</option>
              @for (m of motivos; track m) {
                <option [value]="m">{{ motivo(m) }}</option>
              }
            </select>

            <label
              for="detalle"
              class="mt-5 block text-sm font-medium text-slate-700"
            >
              Cuéntanos qué está pasando
            </label>
            <p class="text-xs text-slate-500">
              Entre más concreto seas, más opciones tiene la universidad de
              ofrecerte una alternativa. Mínimo 20 caracteres.
            </p>
            <textarea
              id="detalle"
              name="detalle"
              rows="5"
              required
              placeholder="Por ejemplo: cambié de turno en el trabajo y ya no alcanzo a conectarme a las sesiones de la tarde."
              class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              [(ngModel)]="detalle"
            ></textarea>
            <p class="mt-1 text-right text-xs text-slate-400">
              {{ detalle.trim().length }} / 20
            </p>

            <label class="mt-4 flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="confirmo"
                class="mt-0.5 h-4 w-4 rounded border-slate-300"
                [(ngModel)]="confirmo"
              />
              <span>
                Confirmo que quiero radicar mi solicitud de retiro y que se
                notifique a mis docentes y a las directivas del programa.
              </span>
            </label>

            @if (error()) {
              <p role="alert" class="mt-4 text-sm text-red-700">{{ error() }}</p>
            }

            <div class="mt-5 flex flex-wrap items-center justify-end gap-3">
              <a
                routerLink="/mi-progreso"
                class="text-sm font-medium text-slate-600 hover:underline"
              >
                Volver a mi progreso
              </a>
              <button
                type="submit"
                class="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                [disabled]="!formularioValido() || enviando()"
              >
                {{ enviando() ? 'Enviando…' : 'Radicar solicitud de retiro' }}
              </button>
            </div>
          </form>
        }

        @if (historial().length > 0) {
          <div class="mt-6 rounded-lg border border-slate-200 bg-white">
            <h2
              class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800"
            >
              Mis solicitudes
            </h2>
            <ul class="divide-y divide-slate-100">
              @for (s of historial(); track s.id) {
                <li class="px-5 py-4">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p class="text-sm font-medium text-slate-800">
                        {{ motivo(s.motivo) }}
                      </p>
                      <p class="mt-0.5 text-xs text-slate-500">
                        {{ s.fechaSolicitud | date: 'dd/MM/yyyy HH:mm' }}
                        @if (s.correoEnviado) {
                          · aviso enviado por correo
                        }
                      </p>
                    </div>
                    <span
                      class="rounded-full px-2.5 py-1 text-xs font-medium"
                      [class]="claseEstado(s.estado)"
                    >
                      {{ estado(s.estado) }}
                    </span>
                  </div>
                  <p class="mt-2 text-sm text-slate-600 italic">
                    “{{ s.detalle }}”
                  </p>
                  @if (s.respuesta) {
                    <div
                      class="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700"
                    >
                      <span class="font-semibold">Respuesta de la coordinación:</span>
                      {{ s.respuesta }}
                      @if (s.resueltaPor) {
                        <span class="text-slate-500">
                          — {{ s.resueltaPor.nombres }}
                          {{ s.resueltaPor.apellidos }}
                        </span>
                      }
                    </div>
                  }
                </li>
              }
            </ul>
          </div>
        }
      }
    </div>
  `,
})
export class RetiroComponent {
  private readonly api = inject(ApiService);

  protected readonly motivos = MOTIVOS;
  protected readonly historial = signal<SolicitudDesercion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected motivoElegido: MotivoDesercion | '' = '';
  protected detalle = '';
  protected confirmo = false;

  /** Solicitud abierta, si existe: bloquea el formulario. */
  protected readonly enTramite = computed(
    () => this.historial().find((s) => ABIERTOS.includes(s.estado)) ?? null,
  );

  constructor() {
    void this.cargar();
  }

  protected motivo(valor: MotivoDesercion): string {
    return ETIQUETA_MOTIVO[valor];
  }

  protected estado(valor: EstadoDesercion): string {
    return ETIQUETA_ESTADO_DESERCION[valor];
  }

  protected claseEstado(valor: EstadoDesercion): string {
    switch (valor) {
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

  /**
   * Replica las reglas del DTO del backend para no dejar enviar algo que la API
   * va a rechazar: el estudiante recibe el aviso en el momento, no despues.
   */
  protected formularioValido(): boolean {
    return (
      this.motivoElegido !== '' &&
      this.detalle.trim().length >= 20 &&
      this.confirmo
    );
  }

  protected async enviar(): Promise<void> {
    if (!this.formularioValido() || this.enviando()) return;

    this.enviando.set(true);
    this.error.set(null);

    try {
      await this.api.radicarRetiro({
        motivo: this.motivoElegido as MotivoDesercion,
        detalle: this.detalle.trim(),
        confirmo: this.confirmo,
      });

      this.motivoElegido = '';
      this.detalle = '';
      this.confirmo = false;
      await this.cargar();
    } catch (error) {
      this.error.set(this.mensajeDe(error));
    } finally {
      this.enviando.set(false);
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.historial.set(await this.api.misRetiros());
    } catch {
      this.error.set('No fue posible cargar tus solicitudes de retiro.');
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
    return 'No fue posible radicar la solicitud. Intenta de nuevo.';
  }
}
