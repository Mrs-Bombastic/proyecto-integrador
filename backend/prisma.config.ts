import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Configuracion de Prisma 7. Desde esta version la cadena de conexion no vive
 * en schema.prisma: las migraciones la leen de aqui y el runtime la recibe a
 * traves del adaptador de driver (ver src/prisma/prisma.service.ts).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
