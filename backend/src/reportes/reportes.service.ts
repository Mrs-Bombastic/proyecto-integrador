import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import pdfmake from 'pdfmake';
import type {
  DynamicContent,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces.js';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { AlertasService, type FiltrosAlertas } from '../alertas/alertas.service.js';
import { ObservacionesService } from '../observaciones/observaciones.service.js';
import { RiesgoService, type FiltrosRiesgo } from '../riesgo/riesgo.service.js';
import { ETIQUETA_INDICADOR } from './etiquetas.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';

const requerir = createRequire(import.meta.url);

/**
 * pdfmake necesita fuentes reales para incrustar en el PDF. Se usan las Roboto
 * que el propio paquete distribuye, resueltas desde node_modules, en lugar de
 * copiarlas al repositorio: soportan tildes y ene, que es lo que exige un
 * reporte en espanol.
 */
const RUTA_FUENTES = join(dirname(requerir.resolve('pdfmake/package.json')), 'fonts', 'Roboto');

pdfmake.addFonts({
  Roboto: {
    normal: join(RUTA_FUENTES, 'Roboto-Regular.ttf'),
    bold: join(RUTA_FUENTES, 'Roboto-Medium.ttf'),
    italics: join(RUTA_FUENTES, 'Roboto-Italic.ttf'),
    bolditalics: join(RUTA_FUENTES, 'Roboto-MediumItalic.ttf'),
  },
});

const COLOR_NIVEL: Record<string, string> = {
  NORMAL: '#047857',
  MEDIO: '#b45309',
  ALTO: '#b91c1c',
};

const ETIQUETA_NIVEL: Record<string, string> = {
  NORMAL: 'Normal',
  MEDIO: 'Riesgo medio',
  ALTO: 'Riesgo alto',
};

export interface ArchivoGenerado {
  contenido: Buffer;
  nombre: string;
  tipoMime: string;
}

/**
 * Generacion de reportes exportables (RF07).
 *
 * Los reportes se construyen sobre los mismos servicios que alimentan la
 * pantalla, de modo que un PDF nunca puede contradecir lo que el usuario acaba
 * de ver, y heredan el control de alcance por rol.
 */
@Injectable()
export class ReportesService {
  constructor(
    private readonly riesgo: RiesgoService,
    private readonly alertas: AlertasService,
    private readonly observaciones: ObservacionesService,
  ) {}

  // ------------------------------- Excel ----------------------------------

  async estudiantesExcel(
    solicitante: UsuarioAutenticado,
    filtros: FiltrosRiesgo & { nivelRiesgo?: string; busqueda?: string },
  ): Promise<ArchivoGenerado> {
    const estudiantes = await this.riesgo.listarEstudiantes(solicitante, filtros);

    const libro = new ExcelJS.Workbook();
    libro.creator = 'Dashboard de Seguimiento Académico';
    libro.created = new Date();

    const hoja = libro.addWorksheet('Estudiantes');
    hoja.columns = [
      { header: 'Código', key: 'codigo', width: 12 },
      { header: 'Estudiante', key: 'nombre', width: 32 },
      { header: 'Programa', key: 'programa', width: 34 },
      { header: 'Promedio', key: 'promedio', width: 11 },
      { header: 'Asistencia (%)', key: 'asistencia', width: 14 },
      { header: 'Participación/semana', key: 'participacion', width: 20 },
      { header: 'Entregas vencidas', key: 'vencidas', width: 18 },
      { header: 'Puntaje de riesgo', key: 'puntaje', width: 18 },
      { header: 'Nivel', key: 'nivel', width: 14 },
      { header: 'Alertas abiertas', key: 'alertas', width: 16 },
    ];

    hoja.getRow(1).font = { bold: true };
    hoja.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EAF6' },
    };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];

    for (const e of estudiantes) {
      const fila = hoja.addRow({
        codigo: e.codigoEstudiante,
        nombre: e.nombre,
        programa: e.programaNombre,
        promedio: Number(e.valores.PROMEDIO.toFixed(2)),
        asistencia: Number(e.valores.ASISTENCIA.toFixed(1)),
        participacion: Number(e.valores.PARTICIPACION.toFixed(2)),
        vencidas: Math.round(e.valores.ENTREGAS),
        puntaje: e.resultado.puntaje,
        nivel: ETIQUETA_NIVEL[e.resultado.nivel],
        alertas: e.alertasAbiertas,
      });

      // El nivel se colorea para que la hoja siga siendo legible de un vistazo
      // fuera de la aplicacion.
      fila.getCell('nivel').font = {
        bold: true,
        color: { argb: this.aArgb(COLOR_NIVEL[e.resultado.nivel]) },
      };
    }

    hoja.autoFilter = { from: 'A1', to: 'J1' };

    const contenido = Buffer.from(await libro.xlsx.writeBuffer());

    return {
      contenido,
      nombre: `estudiantes-${this.marcaTiempo()}.xlsx`,
      tipoMime:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async alertasExcel(
    solicitante: UsuarioAutenticado,
    filtros: FiltrosAlertas,
  ): Promise<ArchivoGenerado> {
    const alertas = await this.alertas.listar(solicitante, filtros);

    const libro = new ExcelJS.Workbook();
    libro.creator = 'Dashboard de Seguimiento Académico';
    const hoja = libro.addWorksheet('Alertas');

    hoja.columns = [
      { header: 'Código', key: 'codigo', width: 12 },
      { header: 'Estudiante', key: 'estudiante', width: 32 },
      { header: 'Programa', key: 'programa', width: 34 },
      { header: 'Tipo', key: 'tipo', width: 16 },
      { header: 'Nivel', key: 'nivel', width: 14 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Generada', key: 'generada', width: 18 },
      { header: 'Gestionada', key: 'gestionada', width: 18 },
      { header: 'Acciones registradas', key: 'acciones', width: 20 },
      { header: 'Motivo', key: 'motivo', width: 70 },
    ];
    hoja.getRow(1).font = { bold: true };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];

    for (const a of alertas) {
      hoja.addRow({
        codigo: a.estudiante?.codigoEstudiante ?? '',
        estudiante: a.estudiante
          ? `${a.estudiante.usuario.nombres} ${a.estudiante.usuario.apellidos}`
          : '',
        programa: a.estudiante?.programa.nombre ?? '',
        tipo: a.tipoAlerta,
        nivel: ETIQUETA_NIVEL[a.nivelRiesgo],
        estado: a.estado,
        generada: a.fechaGeneracion,
        gestionada: a.fechaGestion ?? '',
        acciones: a._count?.seguimientos ?? 0,
        motivo: a.mensaje,
      });
    }

    return {
      contenido: Buffer.from(await libro.xlsx.writeBuffer()),
      nombre: `alertas-${this.marcaTiempo()}.xlsx`,
      tipoMime:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  // -------------------------------- PDF -----------------------------------

  /** Listado consolidado para reuniones de seguimiento. */
  async estudiantesPdf(
    solicitante: UsuarioAutenticado,
    filtros: FiltrosRiesgo & { nivelRiesgo?: string; busqueda?: string },
  ): Promise<ArchivoGenerado> {
    const estudiantes = await this.riesgo.listarEstudiantes(solicitante, filtros);

    const filas: TableCell[][] = estudiantes.map((e) => [
      { text: e.codigoEstudiante, fontSize: 8 },
      { text: e.nombre, fontSize: 8 },
      { text: e.valores.PROMEDIO.toFixed(2), fontSize: 8, alignment: 'right' },
      {
        text: `${e.valores.ASISTENCIA.toFixed(0)} %`,
        fontSize: 8,
        alignment: 'right',
      },
      {
        text: e.valores.PARTICIPACION.toFixed(1),
        fontSize: 8,
        alignment: 'right',
      },
      {
        text: String(Math.round(e.valores.ENTREGAS)),
        fontSize: 8,
        alignment: 'right',
      },
      {
        text: ETIQUETA_NIVEL[e.resultado.nivel],
        fontSize: 8,
        bold: true,
        color: COLOR_NIVEL[e.resultado.nivel],
      },
    ]);

    const documento: TDocumentDefinitions = {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [32, 60, 32, 45],
      header: this.encabezado('Reporte de seguimiento académico'),
      footer: this.piePagina(),
      content: [
        {
          text: `${estudiantes.length} estudiante(s) · generado por ${solicitante.nombres} ${solicitante.apellidos}`,
          fontSize: 9,
          color: '#64748b',
          margin: [0, 0, 0, 10],
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Código', style: 'th' },
                { text: 'Estudiante', style: 'th' },
                { text: 'Promedio', style: 'th', alignment: 'right' },
                { text: 'Asistencia', style: 'th', alignment: 'right' },
                { text: 'Particip.', style: 'th', alignment: 'right' },
                { text: 'Vencidas', style: 'th', alignment: 'right' },
                { text: 'Estado', style: 'th' },
              ],
              ...filas,
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],
      styles: {
        th: { bold: true, fontSize: 8, color: '#334155' },
      },
      defaultStyle: { font: 'Roboto' },
    };

    return {
      contenido: await this.generarPdf(documento),
      nombre: `estudiantes-${this.marcaTiempo()}.pdf`,
      tipoMime: 'application/pdf',
    };
  }

  /** Ficha individual: es el documento que se adjunta a un caso de tutoría. */
  async estudiantePdf(
    estudianteId: string,
    solicitante: UsuarioAutenticado,
  ): Promise<ArchivoGenerado> {
    const detalle = await this.riesgo.detalleEstudiante(estudianteId, solicitante);

    const observaciones =
      solicitante.rol === 'ESTUDIANTE'
        ? []
        : await this.observaciones.listarDeEstudiante(estudianteId, solicitante);

    const indicadores: TableCell[][] = detalle.resultado.detalle.map((d) => [
      { text: ETIQUETA_INDICADOR[d.indicador], fontSize: 9 },
      { text: this.formatoValor(d.indicador, d.valor), fontSize: 9, alignment: 'right' },
      {
        text: d.umbralIncumplido === null ? '—' : String(d.umbralIncumplido),
        fontSize: 9,
        alignment: 'right',
      },
      { text: `${(d.peso * 100).toFixed(0)} %`, fontSize: 9, alignment: 'right' },
      {
        text: d.semaforo,
        fontSize: 9,
        bold: true,
        color:
          d.semaforo === 'ROJO'
            ? '#b91c1c'
            : d.semaforo === 'AMARILLO'
              ? '#b45309'
              : '#047857',
      },
    ]);

    const documento: TDocumentDefinitions = {
      pageSize: 'LETTER',
      pageMargins: [40, 60, 40, 45],
      header: this.encabezado('Ficha de seguimiento académico'),
      footer: this.piePagina(),
      content: [
        { text: detalle.nombre, fontSize: 16, bold: true },
        {
          text: `${detalle.codigoEstudiante} · ${detalle.programaNombre}`,
          fontSize: 10,
          color: '#64748b',
          margin: [0, 2, 0, 12],
        },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'Nivel de riesgo', fontSize: 10, bold: true },
                {
                  text: ETIQUETA_NIVEL[detalle.resultado.nivel],
                  fontSize: 10,
                  bold: true,
                  color: COLOR_NIVEL[detalle.resultado.nivel],
                  alignment: 'right',
                },
              ],
              [
                { text: 'Puntaje ponderado', fontSize: 10 },
                {
                  text: `${detalle.resultado.puntaje} / 100`,
                  fontSize: 10,
                  alignment: 'right',
                },
              ],
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 14],
        },

        { text: 'Indicadores', fontSize: 12, bold: true, margin: [0, 0, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Indicador', style: 'th' },
                { text: 'Valor', style: 'th', alignment: 'right' },
                { text: 'Umbral', style: 'th', alignment: 'right' },
                { text: 'Peso', style: 'th', alignment: 'right' },
                { text: 'Estado', style: 'th' },
              ],
              ...indicadores,
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 16],
        },

        { text: 'Alertas', fontSize: 12, bold: true, margin: [0, 0, 0, 6] },
        detalle.alertas.length === 0
          ? {
              text: 'Sin alertas registradas.',
              fontSize: 9,
              italics: true,
              color: '#64748b',
            }
          : {
              ul: detalle.alertas.map((a) => ({
                text: [
                  { text: `${a.tipoAlerta} · ${a.estado} · `, bold: true },
                  this.fecha(a.fechaGeneracion),
                  `\n${a.mensaje}`,
                ],
                fontSize: 9,
                margin: [0, 0, 0, 4],
              })),
            },

        {
          text: 'Observaciones docentes',
          fontSize: 12,
          bold: true,
          margin: [0, 16, 0, 6],
        },
        observaciones.length === 0
          ? {
              text:
                solicitante.rol === 'ESTUDIANTE'
                  ? 'No se incluyen en este reporte.'
                  : 'Sin observaciones registradas.',
              fontSize: 9,
              italics: true,
              color: '#64748b',
            }
          : {
              ul: observaciones.map((o) => ({
                text: [
                  {
                    text: `${o.docente.usuario.nombres} ${o.docente.usuario.apellidos} · ${this.fecha(o.fecha)}\n`,
                    bold: true,
                  },
                  o.contenido,
                ],
                fontSize: 9,
                margin: [0, 0, 0, 4],
              })),
            },
      ],
      styles: { th: { bold: true, fontSize: 9, color: '#334155' } },
      defaultStyle: { font: 'Roboto' },
    };

    return {
      contenido: await this.generarPdf(documento),
      nombre: `ficha-${detalle.codigoEstudiante}-${this.marcaTiempo()}.pdf`,
      tipoMime: 'application/pdf',
    };
  }

  // ------------------------------ Utilidades ------------------------------

  private generarPdf(documento: TDocumentDefinitions): Promise<Buffer> {
    return pdfmake.createPdf(documento).getBuffer();
  }

  private encabezado(titulo: string): DynamicContent {
    return () => ({
      columns: [
        { text: titulo, fontSize: 11, bold: true, margin: [32, 24, 0, 0] },
        {
          text: 'Institución Universitaria Digital de Antioquia',
          fontSize: 9,
          color: '#64748b',
          alignment: 'right',
          margin: [0, 26, 32, 0],
        },
      ],
    });
  }

  private piePagina(): DynamicContent {
    return (pagina: number, total: number) => ({
      columns: [
        {
          text: `Generado el ${this.fecha(new Date())}`,
          fontSize: 8,
          color: '#94a3b8',
          margin: [32, 12, 0, 0],
        },
        {
          text: `Página ${pagina} de ${total}`,
          fontSize: 8,
          color: '#94a3b8',
          alignment: 'right',
          margin: [0, 12, 32, 0],
        },
      ],
    });
  }

  private formatoValor(indicador: string, valor: number): string {
    switch (indicador) {
      case 'PROMEDIO':
        return valor.toFixed(2);
      case 'ASISTENCIA':
        return `${valor.toFixed(0)} %`;
      case 'PARTICIPACION':
        return valor.toFixed(1);
      default:
        return String(Math.round(valor));
    }
  }

  private fecha(valor: Date | string): string {
    return new Date(valor).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private marcaTiempo(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** Convierte #rrggbb al formato ARGB que usa ExcelJS. */
  private aArgb(hex: string): string {
    return `FF${hex.replace('#', '').toUpperCase()}`;
  }
}
