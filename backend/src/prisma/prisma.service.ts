import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente unico de base de datos, inyectable en cualquier servicio de la
 * aplicacion. Nest gestiona su ciclo de vida: conecta al arrancar el modulo y
 * cierra la conexion limpiamente al apagar el proceso.
 *
 * Desde Prisma 7 la conexion se establece mediante un adaptador de driver
 * (aqui `pg`) en lugar de leer la URL desde schema.prisma.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
