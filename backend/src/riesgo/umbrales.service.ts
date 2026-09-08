import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ActualizarUmbralDto } from './dto/actualizar-umbral.dto.js';

/**
 * Gestion de los umbrales de la matriz de riesgo (caso de uso 5).
 *
 * Que los umbrales vivan en base de datos y no en el codigo es una decision de
 * diseno explicita: la institucion puede endurecer o relajar sus criterios de
 * riesgo sin solicitar un cambio de software.
 */
@Injectable()
export class UmbralesService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.configuracionUmbral.findMany({
      orderBy: { id: 'asc' },
      include: {
        actualizadoPor: { select: { nombres: true, apellidos: true } },
      },
    });
  }

  async actualizar(
    indicador: string,
    dto: ActualizarUmbralDto,
    usuarioId: string,
  ) {
    const existente = await this.prisma.configuracionUmbral.findUnique({
      where: { indicador },
    });

    if (!existente) {
      throw new NotFoundException(`No existe el indicador ${indicador}`);
    }

    const actualizado = await this.prisma.configuracionUmbral.update({
      where: { indicador },
      data: { ...dto, actualizadoPorId: usuarioId },
    });

    // Cambiar un umbral altera que estudiantes se consideran en riesgo: queda
    // registrado con el valor anterior y el nuevo.
    await this.prisma.auditoria.create({
      data: {
        usuarioId,
        accion: 'UMBRAL_ACTUALIZADO',
        entidad: 'configuracion_umbral',
        entidadId: String(existente.id),
        detalle:
          `${indicador}: verde ${existente.umbralVerde} -> ${actualizado.umbralVerde}, ` +
          `amarillo ${existente.umbralAmarillo} -> ${actualizado.umbralAmarillo}, ` +
          `peso ${existente.peso} -> ${actualizado.peso}`,
      },
    });

    return actualizado;
  }
}
