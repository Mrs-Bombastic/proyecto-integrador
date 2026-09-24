import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { CorreoService } from '../correo/correo.service.js';
import { DestinatariosService } from '../correo/destinatarios.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import type { CrearDesercionDto } from './dto/crear-desercion.dto.js';
import type { ResolverDesercionDto } from './dto/resolver-desercion.dto.js';

/** Texto legible de cada motivo, para los correos y los reportes. */
export const ETIQUETA_MOTIVO: Record<string, string> = {
  ECONOMICO: 'Dificultades económicas',
  ACADEMICO: 'Dificultades académicas',
  LABORAL: 'Incompatibilidad con el trabajo',
  SALUD: 'Motivos de salud',
  FAMILIAR: 'Situación familiar',
  PERSONAL: 'Motivos personales',
  CAMBIO_PROGRAMA: 'Cambio de programa o institución',
  OTRO: 'Otro motivo',
};

const ETIQUETA_ESTADO: Record<string, string> = {
  RADICADA: 'Radicada',
  EN_REVISION: 'En revisión',
  RETENIDO: 'Estudiante retenido',
  CONFIRMADA: 'Retiro confirmado',
};

/** Estados en los que la solicitud sigue viva y no admite otra encima. */
const ESTADOS_ABIERTOS = ['RADICADA', 'EN_REVISION'] as const;

export interface FiltrosDesercion {
  estado?: string;
  motivo?: string;
  programaId?: string;
}

/**
 * Solicitudes de retiro voluntario (RF14).
 *
 * El estudiante declara su intencion de desertar y explica por que. El sistema
 * no la aplica de inmediato: la radica, la notifica en el mismo momento a los
 * docentes de sus cursos y a los directivos, y la deja abierta para que
 * coordinacion intente retenerlo. El retiro efectivo solo ocurre cuando alguien
 * con esa competencia lo confirma.
 *
 * Esa secuencia es el requisito: una desercion que solo cambia un estado en la
 * base de datos no le da a nadie la oportunidad de evitarla, y es justo lo que
 * un sistema de alertas tempranas deberia poder evitar.
 */
@Injectable()
export class DesercionService {
  private readonly logger = new Logger(DesercionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
    private readonly destinatarios: DestinatariosService,
    private readonly config: ConfigService,
  ) {}

  // ------------------------------- Radicar --------------------------------

  async radicar(dto: CrearDesercionDto, solicitante: UsuarioAutenticado) {
    if (solicitante.rol !== 'ESTUDIANTE' || !solicitante.perfilId) {
      throw new ForbiddenException(
        'Solo el propio estudiante puede radicar su solicitud de retiro',
      );
    }

    const estudiante = await this.prisma.estudiante.findUnique({
      where: { id: solicitante.perfilId },
      include: {
        usuario: { select: { id: true, nombres: true, apellidos: true, email: true } },
        programa: { select: { id: true, nombre: true } },
        indicadores: { orderBy: { calculadoEn: 'desc' }, take: 1 },
      },
    });

    if (!estudiante) {
      throw new NotFoundException('No hay un estudiante asociado a esta sesión');
    }

    if (estudiante.estado !== 'ACTIVO') {
      throw new BadRequestException(
        `Su matrícula está en estado ${estudiante.estado}: no hay un retiro que radicar`,
      );
    }

    const abierta = await this.prisma.solicitudDesercion.findFirst({
      where: {
        estudianteId: estudiante.id,
        estado: { in: [...ESTADOS_ABIERTOS] },
      },
    });

    if (abierta) {
      throw new BadRequestException(
        'Ya tiene una solicitud de retiro en trámite. Coordinación se pondrá en contacto con usted.',
      );
    }

    const ultimo = estudiante.indicadores[0];
    const nombreEstudiante = `${estudiante.usuario.nombres} ${estudiante.usuario.apellidos}`;

    const [docentes, directivos] = await Promise.all([
      this.destinatarios.docentesDe(estudiante.id),
      this.destinatarios.directivosDe(estudiante.programaId),
    ]);

    const correosDestino = [
      ...docentes.map((d) => d.email),
      ...directivos.internos.map((d) => d.email),
      ...directivos.externos,
    ];

    const solicitud = await this.prisma.solicitudDesercion.create({
      data: {
        estudianteId: estudiante.id,
        motivo: dto.motivo,
        detalle: dto.detalle.trim(),
        // Se congela el riesgo del momento: permite analizar despues si el
        // sistema alcanzo a alertar antes de que el estudiante desistiera.
        nivelRiesgo: ultimo?.nivelRiesgo ?? null,
        puntajeRiesgo: ultimo?.puntajeRiesgo ?? null,
        destinatarios: [...new Set(correosDestino)],
      },
    });

    const correoEnviado = await this.avisarRadicacion(
      solicitud.id,
      {
        estudianteId: estudiante.id,
        nombre: nombreEstudiante,
        codigo: estudiante.codigoEstudiante,
        email: estudiante.usuario.email,
        usuarioId: estudiante.usuario.id,
        programa: estudiante.programa.nombre,
        semestre: estudiante.semestre,
        cohorte: estudiante.cohorte,
      },
      dto,
      docentes,
      directivos,
    );

    await this.prisma.$transaction([
      this.prisma.solicitudDesercion.update({
        where: { id: solicitud.id },
        data: { correoEnviado },
      }),
      this.prisma.auditoria.create({
        data: {
          usuarioId: solicitante.sub,
          accion: 'DESERCION_RADICADA',
          entidad: 'solicitud_desercion',
          entidadId: solicitud.id,
          detalle:
            `Motivo ${dto.motivo}. Notificados: ${solicitud.destinatarios.length} destinatario(s). ` +
            `Correo real: ${correoEnviado ? 'sí' : 'no (modo simulación)'}`,
        },
      }),
    ]);

    this.logger.warn(
      `Solicitud de retiro radicada por ${nombreEstudiante} (${estudiante.codigoEstudiante}): ${dto.motivo}`,
    );

    return this.detalleDe(solicitud.id);
  }

  /**
   * Despacha los tres avisos de la radicacion: docentes, directivos y acuse al
   * estudiante. Devuelve si al menos un correo salio de verdad, que es lo que
   * se guarda como constancia.
   */
  private async avisarRadicacion(
    solicitudId: string,
    estudiante: {
      estudianteId: string;
      nombre: string;
      codigo: string;
      email: string;
      usuarioId: string;
      programa: string;
      semestre: number;
      cohorte: string;
    },
    dto: CrearDesercionDto,
    docentes: { usuarioId: string; email: string; cursos: string[] }[],
    directivos: {
      internos: { usuarioId: string; email: string }[];
      externos: string[];
    },
  ): Promise<boolean> {
    const titulo = `Solicitud de retiro: ${estudiante.nombre}`;
    const motivo = ETIQUETA_MOTIVO[dto.motivo] ?? dto.motivo;

    const ficha =
      `Estudiante: ${estudiante.nombre} (${estudiante.codigo})\n` +
      `Programa: ${estudiante.programa} · semestre ${estudiante.semestre} · cohorte ${estudiante.cohorte}\n` +
      `Correo: ${estudiante.email}\n` +
      `Motivo declarado: ${motivo}\n\n` +
      `Explicación del estudiante:\n"${dto.detalle.trim()}"\n`;

    const resultados: boolean[] = [];

    // Docentes: cada uno recibe el aviso con los cursos que pierde, que es lo
    // que necesita para cerrar notas y decidir si intenta retenerlo.
    for (const docente of docentes) {
      await this.prisma.notificacion.create({
        data: {
          usuarioId: docente.usuarioId,
          titulo,
          mensaje: `${estudiante.nombre} radicó una solicitud de retiro. Motivo: ${motivo}.`,
          canal: 'PLATAFORMA',
        },
      });

      resultados.push(
        await this.correo.enviar({
          para: docente.email,
          asunto: `[Retiro estudiantil] ${titulo}`,
          cuerpo:
            `Un estudiante de sus cursos radicó una solicitud de retiro del programa.\n\n` +
            `${ficha}\n` +
            `Cursos suyos en los que está inscrito: ${docente.cursos.join(', ')}\n\n` +
            `Historial académico del estudiante:\n${this.enlace(`/estudiante/${estudiante.estudianteId}`)}\n\n` +
            'La coordinación del programa y las directivas recibieron este mismo aviso.',
        }),
      );
    }

    // Directivos: coordinacion y administradores tienen cuenta; Bienestar y
    // Registro y Control solo correo, por eso van como copia del mismo mensaje.
    if (directivos.internos.length > 0 || directivos.externos.length > 0) {
      for (const interno of directivos.internos) {
        await this.prisma.notificacion.create({
          data: {
            usuarioId: interno.usuarioId,
            titulo,
            mensaje: `${estudiante.nombre} radicó una solicitud de retiro. Motivo: ${motivo}.`,
            canal: 'PLATAFORMA',
          },
        });
      }

      const principales = directivos.internos.map((d) => d.email);

      resultados.push(
        await this.correo.enviar({
          para: principales.length > 0 ? principales : directivos.externos,
          copia: principales.length > 0 ? directivos.externos : undefined,
          asunto: `[Retiro estudiantil] ${titulo}`,
          cuerpo:
            'Se radicó una solicitud de retiro voluntario que requiere gestión de permanencia.\n\n' +
            `${ficha}\n` +
            'Atienda la solicitud (retener o confirmar el retiro) en:\n' +
            `${this.enlace('/deserciones')}\n\n` +
            'Los docentes de sus cursos recibieron el mismo aviso.',
        }),
      );
    }

    // Acuse al estudiante: confirma que su solicitud quedó radicada y deja
    // abierta la puerta a retenerlo, que es el objetivo del flujo.
    await this.prisma.notificacion.create({
      data: {
        usuarioId: estudiante.usuarioId,
        titulo: 'Tu solicitud de retiro quedó radicada',
        mensaje:
          'Recibimos tu solicitud. La coordinación del programa se pondrá en contacto contigo antes de hacerla efectiva.',
        canal: 'PLATAFORMA',
      },
    });

    resultados.push(
      await this.correo.enviar({
        para: estudiante.email,
        asunto: '[Seguimiento académico] Recibimos tu solicitud de retiro',
        cuerpo:
          `Hola ${estudiante.nombre.split(' ')[0]}.\n\n` +
          'Tu solicitud de retiro quedó radicada y fue enviada a tus docentes y a la ' +
          'coordinación del programa.\n\n' +
          `Motivo que registraste: ${motivo}\n` +
          `Lo que nos contaste:\n"${dto.detalle.trim()}"\n\n` +
          'Antes de hacerla efectiva, la coordinación se pondrá en contacto contigo: ' +
          'según el motivo hay alternativas (aplazamiento de semestre, apoyo del fondo ' +
          'de permanencia, ajuste de carga académica) que quizá no conozcas.\n\n' +
          `Puedes seguir el estado de tu solicitud en:\n${this.enlace('/retiro')}`,
      }),
    );

    if (resultados.every((enviado) => !enviado)) {
      this.logger.warn(
        `Los avisos de la solicitud ${solicitudId} quedaron solo en el log: no hay proveedor de correo configurado`,
      );
    }

    return resultados.some((enviado) => enviado);
  }

  // ------------------------------ Consultas -------------------------------

  /** Solicitudes del propio estudiante en sesion. */
  async misSolicitudes(solicitante: UsuarioAutenticado) {
    if (solicitante.rol !== 'ESTUDIANTE' || !solicitante.perfilId) {
      throw new ForbiddenException('Solo un estudiante consulta sus retiros');
    }

    return this.prisma.solicitudDesercion.findMany({
      where: { estudianteId: solicitante.perfilId },
      orderBy: { fechaSolicitud: 'desc' },
      include: {
        resueltaPor: { select: { nombres: true, apellidos: true } },
      },
    });
  }

  async listar(solicitante: UsuarioAutenticado, filtros: FiltrosDesercion = {}) {
    const where = await this.alcanceDe(solicitante, filtros);

    return this.prisma.solicitudDesercion.findMany({
      where,
      orderBy: [{ estado: 'asc' }, { fechaSolicitud: 'desc' }],
      include: {
        estudiante: {
          select: {
            id: true,
            codigoEstudiante: true,
            semestre: true,
            cohorte: true,
            estado: true,
            usuario: { select: { nombres: true, apellidos: true, email: true } },
            programa: { select: { id: true, nombre: true } },
          },
        },
        resueltaPor: { select: { nombres: true, apellidos: true } },
      },
    });
  }

  /**
   * Conteos por estado y por motivo. El agregado por motivo es el dato que
   * sirve para decidir politicas de permanencia: no es lo mismo perder
   * estudiantes por dinero que por dificultad academica.
   */
  async resumen(solicitante: UsuarioAutenticado, filtros: FiltrosDesercion = {}) {
    const where = await this.alcanceDe(solicitante, filtros);

    const [porEstado, porMotivo, total] = await Promise.all([
      this.prisma.solicitudDesercion.groupBy({
        by: ['estado'],
        where,
        _count: { _all: true },
      }),
      this.prisma.solicitudDesercion.groupBy({
        by: ['motivo'],
        where,
        _count: { _all: true },
      }),
      this.prisma.solicitudDesercion.count({ where }),
    ]);

    const contar = (estado: string) =>
      porEstado.find((fila) => fila.estado === estado)?._count._all ?? 0;

    return {
      total,
      radicadas: contar('RADICADA'),
      enRevision: contar('EN_REVISION'),
      retenidos: contar('RETENIDO'),
      confirmadas: contar('CONFIRMADA'),
      porMotivo: porMotivo
        .map((fila) => ({
          motivo: fila.motivo,
          etiqueta: ETIQUETA_MOTIVO[fila.motivo] ?? fila.motivo,
          total: fila._count._all,
        }))
        .sort((a, b) => b.total - a.total),
    };
  }

  // ------------------------------ Resolucion ------------------------------

  /**
   * Cierra o escala la solicitud. Solo coordinacion y administracion: el retiro
   * efectivo cambia el estado de la matricula, que no es una decision docente.
   */
  async resolver(
    id: string,
    dto: ResolverDesercionDto,
    solicitante: UsuarioAutenticado,
  ) {
    if (
      solicitante.rol !== 'COORDINADOR' &&
      solicitante.rol !== 'ADMINISTRADOR'
    ) {
      throw new ForbiddenException(
        'Solo coordinación o administración pueden resolver una solicitud de retiro',
      );
    }

    const solicitud = await this.prisma.solicitudDesercion.findUnique({
      where: { id },
      include: {
        estudiante: {
          select: {
            id: true,
            programaId: true,
            usuario: {
              select: { id: true, nombres: true, apellidos: true, email: true },
            },
          },
        },
      },
    });

    if (!solicitud) {
      throw new NotFoundException('La solicitud de retiro no existe');
    }

    await this.verificarPrograma(solicitud.estudiante.programaId, solicitante);

    if (solicitud.estado === 'CONFIRMADA' || solicitud.estado === 'RETENIDO') {
      throw new BadRequestException(
        `La solicitud ya está cerrada como ${ETIQUETA_ESTADO[solicitud.estado]}`,
      );
    }

    const cierra = dto.estado === 'CONFIRMADA' || dto.estado === 'RETENIDO';

    const actualizada = await this.prisma.$transaction(async (tx) => {
      const resultado = await tx.solicitudDesercion.update({
        where: { id },
        data: {
          estado: dto.estado,
          respuesta: dto.respuesta,
          resueltaPorId: solicitante.sub,
          fechaResolucion: cierra ? new Date() : null,
        },
      });

      if (dto.estado === 'CONFIRMADA') {
        await tx.estudiante.update({
          where: { id: solicitud.estudiante.id },
          data: { estado: 'RETIRADO' },
        });

        // Las alertas de un estudiante retirado ya no son gestionables: se
        // descartan para que no queden como casos abiertos en el panel ni
        // disparen el escalamiento a Bienestar del RF13.
        await tx.alerta.updateMany({
          where: {
            estudianteId: solicitud.estudiante.id,
            estado: { in: ['NUEVA', 'EN_PROCESO'] },
          },
          data: { estado: 'DESCARTADA', fechaGestion: new Date() },
        });
      }

      await tx.auditoria.create({
        data: {
          usuarioId: solicitante.sub,
          accion: `DESERCION_${dto.estado}`,
          entidad: 'solicitud_desercion',
          entidadId: id,
          detalle: `${solicitud.estado} -> ${dto.estado}. ${dto.respuesta}`,
        },
      });

      return resultado;
    });

    await this.avisarResolucion(solicitud.estudiante.usuario, dto);

    return this.detalleDe(actualizada.id);
  }

  private async avisarResolucion(
    usuario: { id: string; nombres: string; email: string },
    dto: ResolverDesercionDto,
  ): Promise<void> {
    const titulo = `Tu solicitud de retiro: ${ETIQUETA_ESTADO[dto.estado]}`;

    const cuerpos: Record<string, string> = {
      EN_REVISION:
        'La coordinación del programa tomó tu caso y va a contactarte para revisar alternativas antes de hacer efectivo el retiro.',
      RETENIDO:
        'Tu solicitud de retiro se cerró porque acordaste continuar en el programa. Tu matrícula sigue activa.',
      CONFIRMADA:
        'Tu retiro quedó registrado y tu matrícula pasó a estado RETIRADO. Si más adelante quieres reintegrarte, comunícate con la coordinación del programa.',
    };

    await this.prisma.notificacion.create({
      data: {
        usuarioId: usuario.id,
        titulo,
        mensaje: cuerpos[dto.estado],
        canal: 'PLATAFORMA',
      },
    });

    await this.correo.enviar({
      para: usuario.email,
      asunto: `[Seguimiento académico] ${titulo}`,
      cuerpo:
        `Hola ${usuario.nombres.split(' ')[0]}.\n\n` +
        `${cuerpos[dto.estado]}\n\n` +
        `Respuesta de la coordinación:\n"${dto.respuesta}"\n`,
    });
  }

  // -------------------------------- Detalle -------------------------------

  async detalle(id: string, solicitante: UsuarioAutenticado) {
    const solicitud = await this.detalleDe(id);

    if (solicitante.rol === 'ESTUDIANTE') {
      if (solicitud.estudianteId !== solicitante.perfilId) {
        throw new ForbiddenException('Solo puede consultar sus propias solicitudes');
      }
      return solicitud;
    }

    await this.verificarPrograma(
      solicitud.estudiante.programaId,
      solicitante,
      solicitud.estudianteId,
    );

    return solicitud;
  }

  private async detalleDe(id: string) {
    const solicitud = await this.prisma.solicitudDesercion.findUnique({
      where: { id },
      include: {
        estudiante: {
          select: {
            id: true,
            codigoEstudiante: true,
            semestre: true,
            cohorte: true,
            estado: true,
            programaId: true,
            usuario: { select: { nombres: true, apellidos: true, email: true } },
            programa: { select: { id: true, nombre: true } },
          },
        },
        resueltaPor: { select: { nombres: true, apellidos: true } },
      },
    });

    if (!solicitud) {
      throw new NotFoundException('La solicitud de retiro no existe');
    }

    return solicitud;
  }

  // ------------------------------- Alcance --------------------------------

  /**
   * Restringe el listado al alcance del rol, igual que hacen alertas y
   * estudiantes: un docente solo ve los retiros de estudiantes que cursan con
   * el, y un coordinador los de los programas que coordina.
   */
  private async alcanceDe(
    solicitante: UsuarioAutenticado,
    filtros: FiltrosDesercion,
  ): Promise<Prisma.SolicitudDesercionWhereInput> {
    if (solicitante.rol === 'ESTUDIANTE') {
      throw new ForbiddenException(
        'Su rol no gestiona solicitudes de retiro; consulte las suyas en "Retiro del programa"',
      );
    }

    const where: Prisma.SolicitudDesercionWhereInput = {};

    if (filtros.estado) where.estado = filtros.estado.toUpperCase() as never;
    if (filtros.motivo) where.motivo = filtros.motivo.toUpperCase() as never;

    const estudiante: Prisma.EstudianteWhereInput = {};

    if (solicitante.rol === 'DOCENTE') {
      estudiante.inscripciones = {
        some: { curso: { docenteId: solicitante.perfilId } },
      };
    }

    if (solicitante.rol === 'COORDINADOR') {
      const programas = await this.prisma.programa.findMany({
        where: { coordinadorId: solicitante.sub },
        select: { id: true },
      });
      const idsPrograma = programas.map((p) => p.id);

      if (filtros.programaId && !idsPrograma.includes(filtros.programaId)) {
        throw new ForbiddenException('El programa solicitado no está a su cargo');
      }

      estudiante.programaId = filtros.programaId ?? { in: idsPrograma };
    } else if (filtros.programaId) {
      estudiante.programaId = filtros.programaId;
    }

    if (Object.keys(estudiante).length > 0) where.estudiante = estudiante;

    return where;
  }

  private async verificarPrograma(
    programaId: string,
    solicitante: UsuarioAutenticado,
    estudianteId?: string,
  ): Promise<void> {
    if (solicitante.rol === 'ADMINISTRADOR') return;

    if (solicitante.rol === 'COORDINADOR') {
      const programa = await this.prisma.programa.findFirst({
        where: { id: programaId, coordinadorId: solicitante.sub },
        select: { id: true },
      });
      if (!programa) {
        throw new ForbiddenException(
          'La solicitud no pertenece a un programa a su cargo',
        );
      }
      return;
    }

    if (solicitante.rol === 'DOCENTE' && estudianteId) {
      const inscripcion = await this.prisma.inscripcion.findFirst({
        where: { estudianteId, curso: { docenteId: solicitante.perfilId } },
        select: { id: true },
      });
      if (!inscripcion) {
        throw new ForbiddenException('El estudiante no cursa con usted');
      }
      return;
    }

    throw new ForbiddenException('No tiene acceso a esta solicitud');
  }

  /** Enlace absoluto a una pantalla del frontend, para incluirlo en el correo. */
  private enlace(ruta: string): string {
    const base =
      this.config.get<string>('APP_URL')?.replace(/\/$/, '') ??
      'http://localhost:4200';
    return `${base}${ruta}`;
  }
}
