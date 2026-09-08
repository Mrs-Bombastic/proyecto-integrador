import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { Chart, registerables, type ChartType } from 'chart.js';

Chart.register(...registerables);

export interface SerieGrafica {
  etiqueta: string;
  valores: number[];
  color: string;
  /** Color por punto. Permite que cada barra use el color de su semaforo. */
  colores?: string[];
}

/**
 * Envoltura de Chart.js. Recrea el grafico cuando cambian los datos y lo
 * destruye al salir del componente: sin eso, cada navegacion dejaria un
 * grafico huerfano consumiendo memoria.
 */
@Component({
  selector: 'app-grafica',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" [style.height.px]="alto()">
      <canvas #lienzo></canvas>
    </div>
  `,
})
export class GraficaComponent implements OnDestroy {
  readonly tipo = input<ChartType>('line');
  readonly etiquetas = input.required<string[]>();
  readonly series = input.required<SerieGrafica[]>();
  readonly alto = input(240);
  readonly maximoY = input<number | undefined>(undefined);

  private readonly lienzo =
    viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private grafico?: Chart;

  constructor() {
    effect(() => {
      const etiquetas = this.etiquetas();
      const series = this.series();
      const tipo = this.tipo();
      const maximoY = this.maximoY();

      const contexto = this.lienzo().nativeElement;
      this.grafico?.destroy();

      this.grafico = new Chart(contexto, {
        type: tipo,
        data: {
          labels: etiquetas,
          datasets: series.map((serie) => ({
            label: serie.etiqueta,
            data: serie.valores,
            borderColor: serie.colores ?? serie.color,
            backgroundColor:
              serie.colores ??
              (tipo === 'line' ? `${serie.color}20` : `${serie.color}cc`),
            borderWidth: 2,
            fill: tipo === 'line',
            tension: 0.3,
            pointRadius: 3,
            borderRadius: tipo === 'bar' ? 4 : undefined,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: series.length > 1,
              labels: { boxWidth: 12, font: { size: 11 } },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: maximoY,
              grid: { color: '#f1f5f9' },
              ticks: { font: { size: 11 } },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 } },
            },
          },
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.grafico?.destroy();
  }
}
