import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { CorreoService } from '../correo/correo.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import {
  calcularRiesgo,
  mensajeAlerta,
  tipoAlertaPara,
  type Indicador,
  type ResultadoRiesgo,
  type Umbral,
  type ValoresIndicadores,
} from './matriz-riesgo.js';

/** Ventana de observacion del indicador de entregas vencidas. */
const SEMANAS_VENTANA_ENTREGAS = 4;

/** Dias habiles que una alerta ALTA puede permanecer sin gestion (RF13). */
const DIAS_HABILES_ESCALAMIENTO = 5;

const MS_POR_DIA = 86400000;
const MS_POR_SEMANA = 7 * MS_POR_DIA;

/** Criterios de seleccion de estudiantes para el calculo y los listados. */
export interface FiltrosRiesgo {
  estudianteId?: string;
  programaId?: string;
  cursoId?: string;
  /** Periodo de ingreso del estudiante, ej. "2024-1" (RF08). */
  cohorte?: string;
  /** Periodo academico de los cursos, ej. "2026-2" (RF08). */
  periodo?: string;
  /** Limita a los estudiantes inscritos en cursos de un docente. */
  docenteId?: string;
}

/** Fila cruda que devuelve la consulta de agregacion. */
interface FilaAgregada {
  estudianteId: string;
  codigoEstudiante: string;
  nombres: string;
  apellidos: string;
  programaId: string;
  programaNombre: string;
  cohorte: string;
  semestre: number;
  promedio: Prisma.Decimal | number | null;
  presentes: number;
  computables: number;
  primera: Date | null;
  ultima: Date | null;
  participaciones: number;
  cursos: number;
  vencidas: number;
}

/** Datos minimos del coordinador necesarios para notificarle. */
interface Coordinador {
  id: string;
  email: string;
}

export interface RiesgoEstudiante {
  estudianteId: string;
  codigoEstudiante: string;
  nombre: string;
  programaId: string;
  programaNombre: string;
  cohorte: string;
  semestre: number;
  valores: ValoresIndicadores;
  resultado: ResultadoRiesgo;
}

export interface ResumenRecalculo {
  evaluados: number;
  normal: number;
  medio: number;
  alto: number;
  alertasCreadas: number;
  alertasActualizadas: number;
  alertasCerradas: number;
  duracionMs: number;
}

/**
 * Motor de seguimiento y alertas: calcula los indicadores de cada estudiante,
 * los evalua contra la matriz de riesgo y mantiene el ciclo de vida de las
 * alertas. Es el nucleo funcional del sistema — el dashboard solo presenta lo
 * que este servicio produce.
 */
@Injectable()
export class RiesgoService {
  private readonly logger = new Logger(RiesgoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
    private readonly config: ConfigService,
  ) {}

  // ------------------------------ Umbrales --------------------------------

  /** Lee los umbrales activos configurados por el administrador. */
  async obtenerUmbrales(): Promise<Umbral[]> {
    const filas = await this.prisma.configuracionUmbral.findMany({
      where: { activo: true },
      orderBy: { id: 'asc' },
    });

    return filas.map((fila) => ({
      indicador: fila.indicador as Indicador,
      umbralVerde: Number(fila.umbralVerde),
      umbralAmarillo: Number(fila.umbralAmarillo),
      mayorEsMejor: fila.mayorEsMejor,
      peso: Number(fila.peso),
    }));
  }

  // --------------------------- Calculo de datos ---------------------------

  /**
   * Agrega los cuatro indicadores de todos los estudiantes en una sola
   * consulta. Se resuelve en SQL y no en memoria porque el sistema debe
   * responder con miles de estudiantes sin degradarse (RNF02 y RNF04).
   */
  private async agregarIndicadores(
    filtros: FiltrosRiesgo = {},
  ): Promise<FilaAgregada[]> {
    const desde = new Date(
      Date.now() - SEMANAS_VENTANA_ENTREGAS * MS_POR_SEMANA,
    );

    const condiciones: Prisma.Sql[] = [];

    if (filtros.estudianteId) {
      condiciones.push(Prisma.sql`AND e.id = ${filtros.estudianteId}`);
    }
    if (filtros.programaId) {
      condiciones.push(Prisma.sql`AND e."programaId" = ${filtros.programaId}`);
    }
    if (filtros.cursoId) {
      condiciones.push(Prisma.sql`
        AND EXISTS (
          SELECT 1 FROM inscripcion i
          WHERE i."estudianteId" = e.id AND i."cursoId" = ${filtros.cursoId}
        )`);
    }
    if (filtros.cohorte) {
      condiciones.push(Prisma.sql`AND e.cohorte = ${filtros.cohorte}`);
    }
    if (filtros.periodo) {
      condiciones.push(Prisma.sql`
        AND EXISTS (
          SELECT 1 FROM inscripcion i
          JOIN curso c ON c.id = i."cursoId"
          WHERE i."estudianteId" = e.id AND c.periodo = ${filtros.periodo}
        )`);
    }
    if (filtros.docenteId) {
      condiciones.push(Prisma.sql`
        AND EXISTS (
          SELECT 1 FROM inscripcion i
          JOIN curso c ON c.id = i."cursoId"
          WHERE i."estudianteId" = e.id AND c."docenteId" = ${filtros.docenteId}
        )`);
    }

    // Prisma.join exige al menos un elemento: sin filtros la clausula va vacia.
    const filtro =
      condiciones.length > 0 ? Prisma.join(condiciones, ' ') : Prisma.empty;

    return this.prisma.$queryRaw<FilaAgregada[]>`
      SELECT
        e.id                        AS "estudianteId",
        e."codigoEstudiante"        AS "codigoEstudiante",
        u.nombres                   AS "nombres",
        u.apellidos                 AS "apellidos",
        e."programaId"              AS "programaId",
        pr.nombre                   AS "programaNombre",
        e.cohorte                   AS "cohorte",
        e.semestre                  AS "semestre",
        cal.promedio                AS "promedio",
        COALESCE(asi.presentes, 0)  AS "presentes",
        COALESCE(asi.computables, 0) AS "computables",
        asi.primera                 AS "primera",
        asi.ultima                  AS "ultima",
        COALESCE(par.total, 0)      AS "participaciones",
        COALESCE(ins.cursos, 0)     AS "cursos",
        COALESCE(ven.vencidas, 0)   AS "vencidas"
      FROM estudiante e
      JOIN usuario u ON u.id = e."usuarioId"
      JOIN programa pr ON pr.id = e."programaId"
      LEFT JOIN (
        SELECT i."estudianteId", COUNT(*)::int AS cursos
        FROM inscripcion i GROUP BY i."estudianteId"
      ) ins ON ins."estudianteId" = e.id
      LEFT JOIN (
        SELECT i."estudianteId", AVG(c.nota) AS promedio
        FROM calificacion c
        JOIN inscripcion i ON i.id = c."inscripcionId"
        GROUP BY i."estudianteId"
      ) cal ON cal."estudianteId" = e.id
      LEFT JOIN (
        SELECT
          i."estudianteId",
          COUNT(*) FILTER (WHERE a.estado::text IN ('PRESENTE', 'TARDE'))::int AS presentes,
          COUNT(*) FILTER (WHERE a.estado::text <> 'JUSTIFICADO')::int         AS computables,
          MIN(a."fechaSesion") AS primera,
          MAX(a."fechaSesion") AS ultima
        FROM asistencia a
        JOIN inscripcion i ON i.id = a."inscripcionId"
        GROUP BY i."estudianteId"
      ) asi ON asi."estudianteId" = e.id
      LEFT JOIN (
        SELECT i."estudianteId", SUM(p.cantidad)::int AS total
        FROM participacion p
        JOIN inscripcion i ON i.id = p."inscripcionId"
        GROUP BY i."estudianteId"
      ) par ON par."estudianteId" = e.id
      LEFT JOIN (
        SELECT i."estudianteId", COUNT(*)::int AS vencidas
        FROM entrega en
        JOIN inscripcion i ON i.id = en."inscripcionId"
        WHERE en.estado::text = 'VENCIDA' AND en."fechaLimite" >= ${desde}
        GROUP BY i."estudianteId"
      ) ven ON ven."estudianteId" = e.id
      WHERE e.estado::text = 'ACTIVO' ${filtro}
    `;
  }

  /**
   * Traduce una fila agregada a los cuatro valores de la matriz.
   *
   * Las inasistencias justificadas se excluyen del denominador en lugar de
   * contarse como ausencia: penalizarlas castigaria a un estudiante que
   * reporto su situacion, que es justo el comportamiento que el sistema quiere
   * fomentar.
   */
  private valoresDesdeFila(fila: FilaAgregada): ValoresIndicadores {
    const asistencia =
      fila.computables > 0 ? (fila.presentes / fila.computables) * 100 : 100;

    const semanas = this.semanasTranscurridas(fila.primera, fila.ultima);
    const participacion =
      fila.cursos > 0 ? fila.participaciones / (semanas * fila.cursos) : 0;

    return {
      PROMEDIO: fila.promedio === null ? 0 : Number(fila.promedio),
      ASISTENCIA: asistencia,
      PARTICIPACION: participacion,
      ENTREGAS: fila.vencidas,
    };
  }

  private semanasTranscurridas(
    primera: Date | null,
    ultima: Date | null,
  ): number {
    if (!primera || !ultima) return 1;
    const semanas =
      Math.round((ultima.getTime() - primera.getTime()) / MS_POR_SEMANA) + 1;
    return Math.max(1, semanas);
  }

  /** Calcula el riesgo de un conjunto de estudiantes sin persistir nada. */
  private async evaluar(
    filtros: FiltrosRiesgo = {},
  ): Promise<RiesgoEstudiante[]> {
    const umbrales = await this.obtenerUmbrales();
    const filas = await this.agregarIndicadores(filtros);

    return filas.map((fila) => {
      const valores = this.valoresDesdeFila(fila);
      return {
        estudianteId: fila.estudianteId,
        codigoEstudiante: fila.codigoEstudiante,
        nombre: `${fila.nombres} ${fila.apellidos}`,
        programaId: fila.programaId,
        programaNombre: fila.programaNombre,
        cohorte: fila.cohorte,
        semestre: fila.semestre,
        valores,
        resultado: calcularRiesgo(valores, umbrales),
      };
    });
  }

  /**
   * Listado de estudiantes con su nivel de riesgo, para el panel del docente y
   * el del coordinador (RF08, RF11).
   *
   * El alcance se restringe segun el rol: un docente solo ve estudiantes
   * inscritos en sus cursos y un coordinador solo los de su programa, sin que
   * el cliente pueda ampliarlo manipulando los parametros.
   */
  async listarEstudiantes(
    solicitante: UsuarioAutenticado,
    filtros: FiltrosRiesgo & { nivelRiesgo?: string; busqueda?: string } = {},
  ) {
    const alcance = await this.alcanceDe(solicitante, filtros);

    let evaluaciones = await this.evaluar(alcance);

    if (filtros.nivelRiesgo) {
      const nivel = filtros.nivelRiesgo.toUpperCase();
      evaluaciones = evaluaciones.filter((e) => e.resultado.nivel === nivel);
    }

    if (filtros.busqueda) {
      const termino = filtros.busqueda.toLowerCase().trim();
      evaluaciones = evaluaciones.filter(
        (e) =>
          e.nombre.toLowerCase().includes(termino) ||
          e.codigoEstudiante.toLowerCase().includes(termino),
      );
    }

    const alertasPorEstudiante = await this.contarAlertasAbiertas(
      evaluaciones.map((e) => e.estudianteId),
    );

    // Los de mayor riesgo primero: el panel debe abrir mostrando a quien
    // necesita atencion, no a quien va bien.
    return evaluaciones
      .map((evaluacion) => ({
        ...evaluacion,
        alertasAbiertas: alertasPorEstudiante.get(evaluacion.estudianteId) ?? 0,
      }))
      .sort((a, b) => b.resultado.puntaje - a.resultado.puntaje);
  }

  /**
   * Traduce el rol del solicitante a un filtro obligatorio, combinandolo con
   * los filtros opcionales que pida la interfaz.
   */
  private async alcanceDe(
    solicitante: UsuarioAutenticado,
    filtros: FiltrosRiesgo,
  ): Promise<FiltrosRiesgo> {
    if (solicitante.rol === 'ESTUDIANTE') {
      throw new ForbiddenException('Solo puede consultar su propio progreso');
    }

    if (solicitante.rol === 'DOCENTE') {
      return { ...filtros, docenteId: solicitante.perfilId };
    }

    if (solicitante.rol === 'COORDINADOR') {
      const programas = await this.prisma.programa.findMany({
        where: { coordinadorId: solicitante.sub },
        select: { id: true },
      });
      const idsPrograma = programas.map((p) => p.id);

      // Si pidio un programa concreto, debe ser uno de los que coordina.
      if (filtros.programaId && !idsPrograma.includes(filtros.programaId)) {
        throw new ForbiddenException(
          'El programa solicitado no esta a su cargo',
        );
      }

      return { ...filtros, programaId: filtros.programaId ?? idsPrograma[0] };
    }

    return filtros; // ADMINISTRADOR: sin restriccion
  }

  /**
   * Comprueba que el solicitante pueda ver a un estudiante concreto.
   *
   * El filtro del listado no basta como control de acceso: quien conozca un id
   * puede pedir el detalle directamente. Cada consulta puntual tiene que
   * revalidar el mismo alcance que el listado.
   */
  private async verificarAccesoAEstudiante(
    estudianteId: string,
    solicitante: UsuarioAutenticado,
  ): Promise<void> {
    if (solicitante.rol === 'ADMINISTRADOR') return;

    if (solicitante.rol === 'ESTUDIANTE') {
      if (solicitante.perfilId !== estudianteId) {
        throw new ForbiddenException('Solo puede consultar su propio progreso');
      }
      return;
    }

    if (solicitante.rol === 'COORDINADOR') {
      const estudiante = await this.prisma.estudiante.findFirst({
        where: {
          id: estudianteId,
          programa: { coordinadorId: solicitante.sub },
        },
        select: { id: true },
      });
      if (!estudiante) {
        throw new ForbiddenException(
          'El estudiante no pertenece a un programa a su cargo',
        );
      }
      return;
    }

    const inscripcion = await this.prisma.inscripcion.findFirst({
      where: { estudianteId, curso: { docenteId: solicitante.perfilId } },
      select: { id: true },
    });
    if (!inscripcion) {
      throw new ForbiddenException('El estudiante no cursa con usted');
    }
  }

  private async contarAlertasAbiertas(
    estudianteIds: string[],
  ): Promise<Map<string, number>> {
    if (estudianteIds.length === 0) return new Map();

    const conteos = await this.prisma.alerta.groupBy({
      by: ['estudianteId'],
      where: {
        estudianteId: { in: estudianteIds },
        estado: { in: ['NUEVA', 'EN_PROCESO'] },
      },
      _count: { _all: true },
    });

    return new Map(conteos.map((c) => [c.estudianteId, c._count._all]));
  }

  // --------------------------- Recalculo completo -------------------------

  /**
   * Recalcula el riesgo de todos los estudiantes activos, guarda el snapshot
   * historico y sincroniza las alertas.
   */
  async recalcularTodos(): Promise<ResumenRecalculo> {
    const inicio = Date.now();
    const evaluaciones = await this.evaluar();

    const resumen: ResumenRecalculo = {
      evaluados: evaluaciones.length,
      normal: 0,
      medio: 0,
      alto: 0,
      alertasCreadas: 0,
      alertasActualizadas: 0,
      alertasCerradas: 0,
      duracionMs: 0,
    };

    await this.guardarSnapshots(evaluaciones);

    const coordinadores = await this.coordinadoresPorPrograma();

    for (const evaluacion of evaluaciones) {
      const nivel = evaluacion.resultado.nivel;
      if (nivel === 'NORMAL') resumen.normal++;
      else if (nivel === 'MEDIO') resumen.medio++;
      else resumen.alto++;

      const cambios = await this.sincronizarAlerta(evaluacion, coordinadores);
      resumen.alertasCreadas += cambios.creadas;
      resumen.alertasActualizadas += cambios.actualizadas;
      resumen.alertasCerradas += cambios.cerradas;
    }

    resumen.duracionMs = Date.now() - inicio;
    this.logger.log(
      `Recalculo completado: ${resumen.evaluados} estudiantes en ${resumen.duracionMs} ms ` +
        `(${resumen.alertasCreadas} alertas nuevas, ${resumen.alertasCerradas} cerradas)`,
    );

    return resumen;
  }

  /** Recalcula un unico estudiante, tras registrar una nota o una asistencia. */
  async recalcularEstudiante(
    estudianteId: string,
    solicitante: UsuarioAutenticado,
  ): Promise<RiesgoEstudiante> {
    await this.verificarAccesoAEstudiante(estudianteId, solicitante);

    const [evaluacion] = await this.evaluar({ estudianteId });

    if (!evaluacion) {
      throw new NotFoundException('El estudiante no existe o no esta activo');
    }

    await this.guardarSnapshots([evaluacion]);
    await this.sincronizarAlerta(
      evaluacion,
      await this.coordinadoresPorPrograma(),
    );

    return evaluacion;
  }

  /**
   * Guarda el snapshot de indicadores. Si ya existe uno del mismo dia con los
   * mismos valores no se duplica: el historial debe reflejar cambios, no
   * ejecuciones del motor.
   */
  private async guardarSnapshots(
    evaluaciones: RiesgoEstudiante[],
  ): Promise<void> {
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    const existentes = await this.prisma.indicadorEstudiante.findMany({
      where: {
        estudianteId: { in: evaluaciones.map((e) => e.estudianteId) },
        calculadoEn: { gte: inicioDelDia },
      },
      orderBy: { calculadoEn: 'desc' },
    });

    const ultimoPorEstudiante = new Map<string, (typeof existentes)[number]>();
    for (const snapshot of existentes) {
      if (!ultimoPorEstudiante.has(snapshot.estudianteId)) {
        ultimoPorEstudiante.set(snapshot.estudianteId, snapshot);
      }
    }

    const nuevos = evaluaciones.filter((evaluacion) => {
      const previo = ultimoPorEstudiante.get(evaluacion.estudianteId);
      if (!previo) return true;
      return (
        Number(previo.puntajeRiesgo) !== evaluacion.resultado.puntaje ||
        previo.nivelRiesgo !== evaluacion.resultado.nivel
      );
    });

    if (nuevos.length === 0) return;

    await this.prisma.indicadorEstudiante.createMany({
      data: nuevos.map((evaluacion) => ({
        estudianteId: evaluacion.estudianteId,
        periodo: this.periodoActual(),
        promedio: this.aDecimal(evaluacion.valores.PROMEDIO, 5),
        porcentajeAsistencia: this.aDecimal(evaluacion.valores.ASISTENCIA, 100),
        participacionSemanal: this.aDecimal(
          evaluacion.valores.PARTICIPACION,
          999,
        ),
        entregasVencidas: Math.round(evaluacion.valores.ENTREGAS),
        puntajeRiesgo: evaluacion.resultado.puntaje,
        nivelRiesgo: evaluacion.resultado.nivel,
      })),
    });
  }

  // ---------------------------- Ciclo de alertas --------------------------

  /**
   * Crea, actualiza o cierra la alerta de un estudiante segun su nivel actual.
   *
   * Solo existe una alerta abierta por estudiante y tipo: si el riesgo se
   * mantiene entre ejecuciones se actualiza la existente en lugar de acumular
   * duplicados, que es el problema que haria inutilizable el panel del
   * coordinador.
   */
  private async sincronizarAlerta(
    evaluacion: RiesgoEstudiante,
    coordinadores: Map<string, Coordinador | null>,
  ): Promise<{ creadas: number; actualizadas: number; cerradas: number }> {
    const { resultado } = evaluacion;
    const abiertas = await this.prisma.alerta.findMany({
      where: {
        estudianteId: evaluacion.estudianteId,
        estado: { in: ['NUEVA', 'EN_PROCESO'] },
      },
    });

    if (resultado.nivel === 'NORMAL') {
      if (abiertas.length === 0)
        return { creadas: 0, actualizadas: 0, cerradas: 0 };
      await this.cerrarPorRecuperacion(abiertas.map((a) => a.id));
      return { creadas: 0, actualizadas: 0, cerradas: abiertas.length };
    }

    const tipo = tipoAlertaPara(resultado);
    const mensaje = mensajeAlerta(evaluacion.nombre, resultado);
    const peorIndicador = resultado.detalle
      .filter((d) => d.semaforo !== 'VERDE')
      .sort((a, b) => b.puntos * b.peso - a.puntos * a.peso)[0];

    const datosComunes = {
      nivelRiesgo: resultado.nivel,
      puntajeRiesgo: resultado.puntaje,
      valorObservado: this.aDecimal(peorIndicador?.valor ?? 0, 9999),
      umbralSuperado: this.aDecimal(peorIndicador?.umbralIncumplido ?? 0, 9999),
      mensaje,
    };

    const existente = abiertas.find((a) => a.tipoAlerta === tipo);

    if (existente) {
      const sinCambios =
        existente.nivelRiesgo === resultado.nivel &&
        Number(existente.puntajeRiesgo) === resultado.puntaje;

      if (sinCambios) return { creadas: 0, actualizadas: 0, cerradas: 0 };

      await this.prisma.alerta.update({
        where: { id: existente.id },
        data: datosComunes,
      });
      return { creadas: 0, actualizadas: 1, cerradas: 0 };
    }

    // El tipo de alerta cambio (por ejemplo, de ASISTENCIA a GLOBAL): se
    // cierran las anteriores para no dejar dos alertas abiertas del mismo
    // estudiante describiendo la misma situacion.
    if (abiertas.length > 0) {
      await this.cerrarPorReemplazo(abiertas.map((a) => a.id));
    }

    const alerta = await this.prisma.alerta.create({
      data: {
        ...datosComunes,
        tipoAlerta: tipo,
        estudianteId: evaluacion.estudianteId,
        estado: 'NUEVA',
      },
    });

    await this.notificarAlerta(
      alerta.id,
      evaluacion,
      coordinadores.get(evaluacion.programaId) ?? null,
      mensaje,
    );

    return { creadas: 1, actualizadas: 0, cerradas: abiertas.length };
  }

  private async cerrarPorRecuperacion(ids: string[]): Promise<void> {
    await this.prisma.alerta.updateMany({
      where: { id: { in: ids } },
      data: { estado: 'GESTIONADA', fechaGestion: new Date() },
    });
  }

  private async cerrarPorReemplazo(ids: string[]): Promise<void> {
    await this.prisma.alerta.updateMany({
      where: { id: { in: ids } },
      data: { estado: 'DESCARTADA', fechaGestion: new Date() },
    });
  }

  /**
   * Notifica al coordinador del programa por los dos canales del RF09: en
   * plataforma y por correo. El correo se registra tambien como Notificacion
   * para dejar constancia de que se despacho.
   */
  private async notificarAlerta(
    alertaId: string,
    evaluacion: RiesgoEstudiante,
    coordinador: Coordinador | null,
    mensaje: string,
  ): Promise<void> {
    if (!coordinador) return;

    const titulo = `Riesgo ${evaluacion.resultado.nivel.toLowerCase()}: ${evaluacion.nombre}`;

    await this.prisma.notificacion.create({
      data: {
        usuarioId: coordinador.id,
        alertaId,
        titulo,
        mensaje,
        canal: 'PLATAFORMA',
      },
    });

    const enviado = await this.correo.enviar({
      para: coordinador.email,
      asunto: `[Alerta académica] ${titulo}`,
      cuerpo:
        `${mensaje}\n\n` +
        `Programa: ${evaluacion.programaNombre}\n` +
        `Código del estudiante: ${evaluacion.codigoEstudiante}\n\n` +
        'Consulte el detalle y registre el seguimiento en el panel de alertas.',
    });

    if (enviado) {
      await this.prisma.notificacion.create({
        data: {
          usuarioId: coordinador.id,
          alertaId,
          titulo,
          mensaje,
          canal: 'CORREO',
          leida: true, // el canal de correo no se lee dentro de la plataforma
        },
      });
    }
  }

  private async coordinadoresPorPrograma(): Promise<
    Map<string, Coordinador | null>
  > {
    const programas = await this.prisma.programa.findMany({
      select: {
        id: true,
        coordinador: { select: { id: true, email: true } },
      },
    });

    return new Map(
      programas.map((p) => [
        p.id,
        p.coordinador ? { id: p.coordinador.id, email: p.coordinador.email } : null,
      ]),
    );
  }

  // ------------------------------ Consultas -------------------------------

  /**
   * Distribucion de estudiantes por nivel de riesgo (panel del coordinador).
   *
   * Usa el mismo alcance que el listado: de lo contrario las tarjetas de
   * resumen mostrarian el total de la institucion mientras la tabla de abajo
   * muestra solo el programa del coordinador, y los numeros no cuadrarian.
   */
  async resumen(
    solicitante: UsuarioAutenticado,
    filtros: FiltrosRiesgo = {},
  ) {
    const alcance = await this.alcanceDe(solicitante, filtros);
    const evaluaciones = await this.evaluar(alcance);

    const idsEnAlcance = evaluaciones.map((e) => e.estudianteId);
    const alertasAbiertas =
      idsEnAlcance.length === 0
        ? 0
        : await this.prisma.alerta.count({
            where: {
              estado: { in: ['NUEVA', 'EN_PROCESO'] },
              estudianteId: { in: idsEnAlcance },
            },
          });

    return {
      totalEstudiantes: evaluaciones.length,
      normal: evaluaciones.filter((e) => e.resultado.nivel === 'NORMAL').length,
      medio: evaluaciones.filter((e) => e.resultado.nivel === 'MEDIO').length,
      alto: evaluaciones.filter((e) => e.resultado.nivel === 'ALTO').length,
      alertasAbiertas,
    };
  }

  /**
   * Detalle de riesgo de un estudiante con su historial de indicadores.
   * Un estudiante solo puede consultarse a si mismo (RF10).
   */
  async detalleEstudiante(
    estudianteId: string,
    solicitante: UsuarioAutenticado,
  ) {
    await this.verificarAccesoAEstudiante(estudianteId, solicitante);

    const [evaluacion] = await this.evaluar({ estudianteId });
    if (!evaluacion) {
      throw new NotFoundException('El estudiante no existe o no esta activo');
    }

    const [historial, alertas, cursos] = await Promise.all([
      this.prisma.indicadorEstudiante.findMany({
        where: { estudianteId },
        orderBy: { calculadoEn: 'desc' },
        take: 30,
      }),
      this.prisma.alerta.findMany({
        where: { estudianteId },
        orderBy: { fechaGeneracion: 'desc' },
        include: {
          seguimientos: { orderBy: { fecha: 'desc' } },
          curso: { select: { id: true, nombre: true } },
        },
      }),
      this.desglosePorCurso(estudianteId),
    ]);

    return { ...evaluacion, historial, alertas, cursos };
  }

  /**
   * Desglose academico curso por curso: notas de cada corte (RF02) y
   * asistencia con el detalle de sesiones (RF03).
   *
   * El promedio general responde "cómo va", pero no "dónde": un estudiante con
   * 3.2 puede tener dos cursos sobresalientes y uno perdido, y la intervención
   * es distinta en cada caso.
   */
  private async desglosePorCurso(estudianteId: string) {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { estudianteId },
      include: {
        curso: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            periodo: true,
            creditos: true,
            docente: {
              select: { usuario: { select: { nombres: true, apellidos: true } } },
            },
          },
        },
        calificaciones: { orderBy: { corte: 'asc' } },
        asistencias: { orderBy: { fechaSesion: 'asc' } },
        entregas: { orderBy: { fechaLimite: 'asc' } },
        _count: { select: { participaciones: true } },
      },
      orderBy: { curso: { nombre: 'asc' } },
    });

    return inscripciones.map((inscripcion) => {
      const notas = inscripcion.calificaciones.map((c) => Number(c.nota));

      // Promedio ponderado por el peso de cada corte; si los pesos no suman
      // 100 se normaliza sobre lo registrado, para no castigar un corte que
      // todavia no existe.
      const pesoTotal = inscripcion.calificaciones.reduce(
        (total, c) => total + c.porcentaje,
        0,
      );
      const promedio =
        pesoTotal > 0
          ? inscripcion.calificaciones.reduce(
              (total, c) => total + Number(c.nota) * c.porcentaje,
              0,
            ) / pesoTotal
          : 0;

      const asistencias = inscripcion.asistencias;
      const justificadas = asistencias.filter(
        (a) => a.estado === 'JUSTIFICADO',
      ).length;
      const presentes = asistencias.filter(
        (a) => a.estado === 'PRESENTE' || a.estado === 'TARDE',
      ).length;
      const computables = asistencias.length - justificadas;

      return {
        cursoId: inscripcion.curso.id,
        codigo: inscripcion.curso.codigo,
        nombre: inscripcion.curso.nombre,
        periodo: inscripcion.curso.periodo,
        creditos: inscripcion.curso.creditos,
        docente: inscripcion.curso.docente
          ? `${inscripcion.curso.docente.usuario.nombres} ${inscripcion.curso.docente.usuario.apellidos}`
          : null,
        calificaciones: inscripcion.calificaciones.map((c) => ({
          corte: c.corte,
          nota: Number(c.nota),
          porcentaje: c.porcentaje,
          descripcion: c.descripcion,
          fechaRegistro: c.fechaRegistro,
        })),
        promedio: Math.round(promedio * 100) / 100,
        notaMinima: notas.length > 0 ? Math.min(...notas) : null,
        asistencia: {
          porcentaje:
            computables > 0
              ? Math.round((presentes / computables) * 1000) / 10
              : 100,
          presentes: asistencias.filter((a) => a.estado === 'PRESENTE').length,
          tarde: asistencias.filter((a) => a.estado === 'TARDE').length,
          ausentes: asistencias.filter((a) => a.estado === 'AUSENTE').length,
          justificadas,
          totalSesiones: asistencias.length,
          sesiones: asistencias.map((a) => ({
            fecha: a.fechaSesion,
            estado: a.estado,
            minutosConectado: a.minutosConectado,
          })),
        },
        participaciones: inscripcion._count.participaciones,
        entregas: {
          total: inscripcion.entregas.length,
          vencidas: inscripcion.entregas.filter((e) => e.estado === 'VENCIDA')
            .length,
          detalle: inscripcion.entregas.map((e) => ({
            titulo: e.titulo,
            fechaLimite: e.fechaLimite,
            fechaEntrega: e.fechaEntrega,
            estado: e.estado,
          })),
        },
      };
    });
  }

  // -------------------- RF13: escalamiento a Bienestar --------------------

  /**
   * Escala a Bienestar Universitario las alertas de nivel ALTO que llevan mas
   * de cinco dias habiles sin gestion (RF13).
   *
   * Bienestar no tiene usuario en el sistema: es un destinatario de correo.
   * Por eso el escalamiento no crea una notificacion en plataforma sino un
   * mensaje con los datos de contacto del estudiante y el motivo de la alerta.
   */
  async escalarABienestar(): Promise<{
    escaladas: number;
    destinatario: string | null;
    correoEnviado: boolean;
  }> {
    const alertas = await this.alertasParaEscalar();
    const destinatario = this.config.get<string>('BIENESTAR_EMAIL') ?? null;

    if (alertas.length === 0 || !destinatario) {
      return {
        escaladas: alertas.length,
        destinatario,
        correoEnviado: false,
      };
    }

    const lineas = alertas.map((alerta) => {
      const { usuario, codigoEstudiante, programa } = alerta.estudiante;
      const dias = Math.floor(
        (Date.now() - alerta.fechaGeneracion.getTime()) / MS_POR_DIA,
      );
      return (
        `- ${usuario.nombres} ${usuario.apellidos} (${codigoEstudiante}, ${programa.nombre})\n` +
        `  ${usuario.email} · alerta abierta hace ${dias} día(s)\n` +
        `  ${alerta.mensaje}`
      );
    });

    const correoEnviado = await this.correo.enviar({
      para: destinatario,
      asunto: `[Escalamiento] ${alertas.length} estudiante(s) en riesgo alto sin acompañamiento`,
      cuerpo:
        `Las siguientes alertas de riesgo alto llevan más de ${DIAS_HABILES_ESCALAMIENTO} ` +
        'días hábiles sin gestión por parte de la coordinación académica:\n\n' +
        `${lineas.join('\n\n')}\n\n` +
        'Se solicita contacto desde Bienestar Universitario.',
    });

    return { escaladas: alertas.length, destinatario, correoEnviado };
  }

  /**
   * Detecta alertas de nivel ALTO sin gestionar por mas de cinco dias habiles
   * y deja constancia en la auditoria.
   */
  async alertasParaEscalar() {
    const limite = this.restarDiasHabiles(
      new Date(),
      DIAS_HABILES_ESCALAMIENTO,
    );

    const alertas = await this.prisma.alerta.findMany({
      where: {
        estado: 'NUEVA',
        nivelRiesgo: 'ALTO',
        fechaGeneracion: { lt: limite },
      },
      include: {
        estudiante: {
          include: {
            usuario: {
              select: { nombres: true, apellidos: true, email: true },
            },
            programa: { select: { nombre: true } },
          },
        },
      },
    });

    if (alertas.length > 0) {
      await this.prisma.auditoria.createMany({
        data: alertas.map((alerta) => ({
          accion: 'ESCALAMIENTO_BIENESTAR',
          entidad: 'alerta',
          entidadId: alerta.id,
          detalle: `Alerta ALTA sin gestion por mas de ${DIAS_HABILES_ESCALAMIENTO} dias habiles`,
        })),
      });
      this.logger.warn(
        `${alertas.length} alerta(s) de riesgo alto requieren escalamiento a Bienestar`,
      );
    }

    return alertas;
  }

  /** Resta dias habiles a una fecha, saltando sabados y domingos. */
  private restarDiasHabiles(desde: Date, dias: number): Date {
    const fecha = new Date(desde);
    let restantes = dias;

    while (restantes > 0) {
      fecha.setDate(fecha.getDate() - 1);
      const diaSemana = fecha.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) restantes--;
    }

    return fecha;
  }

  // ------------------------------- Utilidades -----------------------------

  private periodoActual(): string {
    const ahora = new Date();
    const semestre = ahora.getMonth() < 6 ? 1 : 2;
    return `${ahora.getFullYear()}-${semestre}`;
  }

  /** Acota un valor al rango que admite la columna decimal correspondiente. */
  private aDecimal(valor: number, maximo: number): number {
    const acotado = Math.min(Math.max(valor, 0), maximo);
    return Math.round(acotado * 100) / 100;
  }
}
