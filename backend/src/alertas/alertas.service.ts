import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import type { RegistrarSeguimientoDto } from './dto/registrar-seguimiento.dto.js';

export interface FiltrosAlertas {
  estado?: string;
  nivelRiesgo?: string;
  programaId?: string;
  cursoId?: string;
}

/**
 * Gestion del ciclo de vida de las alertas (caso de uso 2).
 *
 * Una alerta no es un semaforo sino un caso: se abre, alguien la toma, registra
 * lo que hizo y la cierra. Ese rastro es lo que permite demostrar que el
 * acompanamiento ocurrio y evaluar si sirvio.
 */
@Injectable()
export class AlertasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(solicitante: UsuarioAutenticado, filtros: FiltrosAlertas = {}) {
    const where = await this.alcanceDe(solicitante, filtros);

    return this.prisma.alerta.findMany({
      where,
      orderBy: [{ estado: 'asc' }, { fechaGeneracion: 'desc' }],
      include: {
        estudiante: {
          select: {
            id: true,
            codigoEstudiante: true,
            usuario: { select: { nombres: true, apellidos: true, email: true } },
            programa: { select: { id: true, nombre: true } },
          },
        },
        curso: { select: { id: true, nombre: true } },
        gestionadaPor: { select: { nombres: true, apellidos: true } },
        _count: { select: { seguimientos: true } },
      },
    });
  }

  /** Contadores del encabezado del panel de alertas (prototipo 4). */
  async resumen(solicitante: UsuarioAutenticado, filtros: FiltrosAlertas = {}) {
    const where = await this.alcanceDe(solicitante, filtros);

    const [nuevas, enProceso, gestionadas, descartadas, altas] =
      await Promise.all([
        this.prisma.alerta.count({ where: { ...where, estado: 'NUEVA' } }),
        this.prisma.alerta.count({ where: { ...where, estado: 'EN_PROCESO' } }),
        this.prisma.alerta.count({ where: { ...where, estado: 'GESTIONADA' } }),
        this.prisma.alerta.count({ where: { ...where, estado: 'DESCARTADA' } }),
        this.prisma.alerta.count({
          where: {
            ...where,
            nivelRiesgo: 'ALTO',
            estado: { in: ['NUEVA', 'EN_PROCESO'] },
          },
        }),
      ]);

    return {
      nuevas,
      enProceso,
      gestionadas,
      descartadas,
      total: nuevas + enProceso + gestionadas + descartadas,
      altasSinCerrar: altas,
    };
  }

  async detalle(id: string, solicitante: UsuarioAutenticado) {
    const alerta = await this.prisma.alerta.findUnique({
      where: { id },
      include: {
        estudiante: {
          include: {
            usuario: { select: { nombres: true, apellidos: true, email: true } },
            programa: { select: { id: true, nombre: true } },
          },
        },
        curso: { select: { id: true, nombre: true } },
        seguimientos: {
          orderBy: { fecha: 'desc' },
          include: {
            usuario: { select: { nombres: true, apellidos: true } },
          },
        },
      },
    });

    if (!alerta) {
      throw new NotFoundException('La alerta no existe');
    }

    await this.verificarAcceso(alerta.estudiante.programaId, solicitante);

    return alerta;
  }

  /**
   * Registra una accion de acompanamiento y mueve la alerta de estado.
   *
   * El seguimiento y el cambio de estado se escriben en una transaccion: una
   * alerta marcada como gestionada sin la accion que lo justifica destruiria la
   * trazabilidad que da sentido al modulo.
   */
  async registrarSeguimiento(
    id: string,
    dto: RegistrarSeguimientoDto,
    solicitante: UsuarioAutenticado,
  ) {
    const alerta = await this.prisma.alerta.findUnique({
      where: { id },
      include: { estudiante: { select: { programaId: true } } },
    });

    if (!alerta) {
      throw new NotFoundException('La alerta no existe');
    }

    await this.verificarAcceso(alerta.estudiante.programaId, solicitante);

    const nuevoEstado = dto.nuevoEstado ?? 'EN_PROCESO';
    const seCierra = nuevoEstado === 'GESTIONADA' || nuevoEstado === 'DESCARTADA';

    return this.prisma.$transaction(async (tx) => {
      await tx.seguimiento.create({
        data: {
          alertaId: id,
          usuarioId: solicitante.sub,
          accion: dto.accion,
          descripcion: dto.descripcion,
        },
      });

      const actualizada = await tx.alerta.update({
        where: { id },
        data: {
          estado: nuevoEstado,
          gestionadaPorId: solicitante.sub,
          fechaGestion: seCierra ? new Date() : null,
        },
        include: {
          seguimientos: {
            orderBy: { fecha: 'desc' },
            include: { usuario: { select: { nombres: true, apellidos: true } } },
          },
        },
      });

      await tx.auditoria.create({
        data: {
          usuarioId: solicitante.sub,
          accion: 'ALERTA_GESTIONADA',
          entidad: 'alerta',
          entidadId: id,
          detalle: `${alerta.estado} -> ${nuevoEstado} (${dto.accion})`,
        },
      });

      return actualizada;
    });
  }

  /** Notificaciones en plataforma del usuario en sesion (RF09). */
  async notificaciones(solicitante: UsuarioAutenticado, soloNoLeidas = false) {
    return this.prisma.notificacion.findMany({
      where: {
        usuarioId: solicitante.sub,
        ...(soloNoLeidas ? { leida: false } : {}),
      },
      orderBy: { fechaEnvio: 'desc' },
      take: 50,
      include: {
        alerta: {
          select: {
            id: true,
            nivelRiesgo: true,
            estado: true,
            estudianteId: true,
          },
        },
      },
    });
  }

  async marcarNotificacionLeida(id: string, solicitante: UsuarioAutenticado) {
    const notificacion = await this.prisma.notificacion.findUnique({
      where: { id },
    });

    if (!notificacion || notificacion.usuarioId !== solicitante.sub) {
      throw new NotFoundException('La notificacion no existe');
    }

    return this.prisma.notificacion.update({
      where: { id },
      data: { leida: true },
    });
  }

  // ------------------------------ Alcance ---------------------------------

  /**
   * Construye la clausula `where` restringida al alcance del rol. Un docente
   * solo ve alertas de estudiantes inscritos en sus cursos; un coordinador,
   * las de los programas que coordina.
   */
  private async alcanceDe(
    solicitante: UsuarioAutenticado,
    filtros: FiltrosAlertas,
  ): Promise<Prisma.AlertaWhereInput> {
    if (solicitante.rol === 'ESTUDIANTE') {
      throw new ForbiddenException('Su rol no gestiona alertas');
    }

    const where: Prisma.AlertaWhereInput = {};

    if (filtros.estado) where.estado = filtros.estado.toUpperCase() as never;
    if (filtros.nivelRiesgo) {
      where.nivelRiesgo = filtros.nivelRiesgo.toUpperCase() as never;
    }
    if (filtros.cursoId) where.cursoId = filtros.cursoId;

    const condicionesEstudiante: Prisma.EstudianteWhereInput = {};

    if (solicitante.rol === 'DOCENTE') {
      condicionesEstudiante.inscripciones = {
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
        throw new ForbiddenException('El programa solicitado no esta a su cargo');
      }

      condicionesEstudiante.programaId = filtros.programaId
        ? filtros.programaId
        : { in: idsPrograma };
    } else if (filtros.programaId) {
      condicionesEstudiante.programaId = filtros.programaId;
    }

    if (Object.keys(condicionesEstudiante).length > 0) {
      where.estudiante = condicionesEstudiante;
    }

    return where;
  }

  private async verificarAcceso(
    programaId: string,
    solicitante: UsuarioAutenticado,
  ): Promise<void> {
    if (solicitante.rol === 'ADMINISTRADOR') return;

    if (solicitante.rol === 'ESTUDIANTE') {
      throw new ForbiddenException('Su rol no gestiona alertas');
    }

    if (solicitante.rol === 'COORDINADOR') {
      const programa = await this.prisma.programa.findFirst({
        where: { id: programaId, coordinadorId: solicitante.sub },
      });
      if (!programa) {
        throw new ForbiddenException('La alerta no pertenece a un programa a su cargo');
      }
      return;
    }

    // Docente: debe tener al menos un curso con ese estudiante.
    const curso = await this.prisma.curso.findFirst({
      where: {
        docenteId: solicitante.perfilId,
        inscripciones: { some: { estudiante: { programaId } } },
      },
    });
    if (!curso) {
      throw new ForbiddenException('La alerta no corresponde a sus cursos');
    }
  }
}
