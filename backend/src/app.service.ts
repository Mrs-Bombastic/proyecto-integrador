import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  /** Comprobacion de disponibilidad usada para el monitoreo (RNF01). */
  async salud() {
    let baseDatos = 'no disponible';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      baseDatos = 'conectada';
    } catch {
      baseDatos = 'error de conexion';
    }

    return {
      estado: 'ok',
      servicio: 'dashboard-seguimiento-academico',
      baseDatos,
      fecha: new Date().toISOString(),
    };
  }
}
