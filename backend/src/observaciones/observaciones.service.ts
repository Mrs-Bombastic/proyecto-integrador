import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import type { CrearObservacionDto } from './dto/crear-observacion.dto.js';

/**
 * Observaciones cualitativas del docente (RF06).
 *
 * Complementan los indicadores numericos: un promedio bajo no explica si el
 * estudiante atraviesa una dificultad puntual o viene desconectandose. Son
 * notas internas de acompanamiento; el estudiante no las consulta desde su
 * panel (decision de alcance documentada en docs/PLAN.md).
 */
@Injectable()
export class ObservacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CrearObservacionDto, autor: UsuarioAutenticado) {
    if (autor.rol !== 'DOCENTE' || !autor.perfilId) {
      throw new ForbiddenException(
        'Solo un docente puede registrar observaciones sobre un estudiante',
      );
    }

    const estudiante = await this.prisma.estudiante.findUnique({
      where: { id: dto.estudianteId },
      select: { id: true },
    });

    if (!estudiante) {
      throw new NotFoundException('El estudiante no existe');
    }

    // El docente solo puede observar a estudiantes que efectivamente cursan
    // con el: sin esta comprobacion, cualquier docente podria dejar notas
    // sobre cualquier estudiante de la institucion.
    const inscripcion = await this.prisma.inscripcion.findFirst({
      where: {
        estudianteId: dto.estudianteId,
        curso: { docenteId: autor.perfilId },
        ...(dto.cursoId ? { cursoId: dto.cursoId } : {}),
      },
      select: { cursoId: true },
    });

    if (!inscripcion) {
      throw new ForbiddenException(
        'El estudiante no está inscrito en ninguno de sus cursos',
      );
    }

    if (dto.cursoId) {
      const curso = await this.prisma.curso.findFirst({
        where: { id: dto.cursoId, docenteId: autor.perfilId },
        select: { id: true },
      });
      if (!curso) {
        throw new BadRequestException('El curso indicado no le corresponde');
      }
    }

    const observacion = await this.prisma.observacion.create({
      data: {
        estudianteId: dto.estudianteId,
        docenteId: autor.perfilId,
        cursoId: dto.cursoId ?? inscripcion.cursoId,
        contenido: dto.contenido,
        archivoUrl: dto.archivoUrl,
      },
      include: {
        docente: {
          select: { usuario: { select: { nombres: true, apellidos: true } } },
        },
        curso: { select: { id: true, nombre: true } },
      },
    });

    await this.prisma.auditoria.create({
      data: {
        usuarioId: autor.sub,
        accion: 'OBSERVACION_CREADA',
        entidad: 'observacion',
        entidadId: observacion.id,
        detalle: `Sobre el estudiante ${dto.estudianteId}`,
      },
    });

    return observacion;
  }

  /** Observaciones de un estudiante, en orden cronologico inverso (RF12). */
  async listarDeEstudiante(
    estudianteId: string,
    solicitante: UsuarioAutenticado,
  ) {
    await this.verificarAcceso(estudianteId, solicitante);

    return this.prisma.observacion.findMany({
      where: { estudianteId },
      orderBy: { fecha: 'desc' },
      include: {
        docente: {
          select: {
            codigoDocente: true,
            usuario: { select: { nombres: true, apellidos: true } },
          },
        },
        curso: { select: { id: true, nombre: true } },
      },
    });
  }

  private async verificarAcceso(
    estudianteId: string,
    solicitante: UsuarioAutenticado,
  ): Promise<void> {
    if (solicitante.rol === 'ADMINISTRADOR') return;

    if (solicitante.rol === 'ESTUDIANTE') {
      throw new ForbiddenException(
        'Las observaciones de acompañamiento son de uso interno docente',
      );
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
      where: {
        estudianteId,
        curso: { docenteId: solicitante.perfilId },
      },
      select: { id: true },
    });
    if (!inscripcion) {
      throw new ForbiddenException('El estudiante no cursa con usted');
    }
  }
}
