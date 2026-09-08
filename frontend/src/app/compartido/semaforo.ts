import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ETIQUETA_NIVEL, type NivelRiesgo, type Semaforo } from '../core/modelos';

/**
 * Distintivo de nivel de riesgo. Los tres estados no se distinguen solo por
 * color: cada uno lleva su etiqueta escrita, para que la informacion siga
 * siendo legible sin percibir el color (criterio de accesibilidad, RNF05).
 */
@Component({
  selector: 'app-semaforo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      [class]="clases()"
    >
      <span class="h-2 w-2 rounded-full" [class]="punto()"></span>
      {{ etiqueta() }}
    </span>
  `,
})
export class SemaforoComponent {
  readonly nivel = input.required<NivelRiesgo>();

  protected etiqueta(): string {
    return ETIQUETA_NIVEL[this.nivel()];
  }

  protected clases(): string {
    switch (this.nivel()) {
      case 'ALTO':
        return 'bg-red-100 text-red-800 ring-1 ring-red-200';
      case 'MEDIO':
        return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200';
      default:
        return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200';
    }
  }

  protected punto(): string {
    switch (this.nivel()) {
      case 'ALTO':
        return 'bg-red-500';
      case 'MEDIO':
        return 'bg-amber-500';
      default:
        return 'bg-emerald-500';
    }
  }
}

/** Distintivo de un indicador individual segun su color de semaforo. */
@Component({
  selector: 'app-indicador-semaforo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
      [class]="clases()"
    >
      {{ texto() }}
    </span>
  `,
})
export class IndicadorSemaforoComponent {
  readonly semaforo = input.required<Semaforo>();
  readonly texto = input.required<string>();

  protected clases(): string {
    switch (this.semaforo()) {
      case 'ROJO':
        return 'bg-red-50 text-red-700';
      case 'AMARILLO':
        return 'bg-amber-50 text-amber-700';
      default:
        return 'bg-emerald-50 text-emerald-700';
    }
  }
}
