import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';

/**
 * Catalogos que alimentan los desplegables de filtros (RF08).
 *
 * Cada rol recibe solo lo que le corresponde: si el desplegable ofreciera
 * programas o cursos ajenos, el usuario elegiria opciones que la API le va a
 * rechazar despues.
 */
@Injectable()
export class CatalogosService {
  constructor(private readonly prisma: PrismaService) {}

  async programas(solicitante: UsuarioAutenticado) {
    if (solicitante.rol === 'COORDINADOR') {
      return this.prisma.programa.findMany({
        where: { coordinadorId: solicitante.sub, activo: true },
        select: { id: true, codigo: true, nombre: true },
        orderBy: { nombre: 'asc' },
      });
    }

    if (solicitante.rol === 'DOCENTE') {
      return this.prisma.programa.findMany({
        where: {
          activo: true,
          cursos: { some: { docenteId: solicitante.perfilId } },
        },
        select: { id: true, codigo: true, nombre: true },
        orderBy: { nombre: 'asc' },
      });
    }

    return this.prisma.programa.findMany({
      where: { activo: true },
      select: { id: true, codigo: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Cohortes y periodos presentes en los datos, para los desplegables del
   * RF08. Se derivan de lo que existe en lugar de mantener una lista fija:
   * así el filtro nunca ofrece una cohorte sin estudiantes.
   */
  async cohortes(solicitante: UsuarioAutenticado, programaId?: string) {
    const where: Record<string, unknown> = { estado: 'ACTIVO' };

    if (programaId) where.programaId = programaId;

    if (solicitante.rol === 'COORDINADOR') {
      const programas = await this.prisma.programa.findMany({
        where: { coordinadorId: solicitante.sub },
        select: { id: true },
      });
      where.programaId = programaId ?? { in: programas.map((p) => p.id) };
    }

    if (solicitante.rol === 'DOCENTE') {
      where.inscripciones = {
        some: { curso: { docenteId: solicitante.perfilId } },
      };
    }

    const filas = await this.prisma.estudiante.groupBy({
      by: ['cohorte'],
      where,
      _count: { _all: true },
      orderBy: { cohorte: 'desc' },
    });

    return filas.map((fila) => ({
      cohorte: fila.cohorte,
      estudiantes: fila._count._all,
    }));
  }

  /** Periodos académicos con cursos registrados. */
  async periodos() {
    const filas = await this.prisma.curso.groupBy({
      by: ['periodo'],
      orderBy: { periodo: 'desc' },
    });
    return filas.map((fila) => fila.periodo);
  }

  async cursos(solicitante: UsuarioAutenticado, programaId?: string) {
    const where: Record<string, unknown> = {};

    if (programaId) where.programaId = programaId;
    if (solicitante.rol === 'DOCENTE') where.docenteId = solicitante.perfilId;

    if (solicitante.rol === 'COORDINADOR') {
      const programas = await this.prisma.programa.findMany({
        where: { coordinadorId: solicitante.sub },
        select: { id: true },
      });
      where.programaId = programaId ?? { in: programas.map((p) => p.id) };
    }

    return this.prisma.curso.findMany({
      where,
      select: {
        id: true,
        codigo: true,
        nombre: true,
        periodo: true,
        programaId: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }
}
