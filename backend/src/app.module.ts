import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard, RolesGuard } from './auth/guards.js';
import { AlertasModule } from './alertas/alertas.module.js';
import { CorreoModule } from './correo/correo.module.js';
import { EstudiantesModule } from './estudiantes/estudiantes.module.js';
import { ObservacionesModule } from './observaciones/observaciones.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReportesModule } from './reportes/reportes.module.js';
import { RiesgoModule } from './riesgo/riesgo.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CorreoModule,
    AuthModule,
    RiesgoModule,
    AlertasModule,
    EstudiantesModule,
    ObservacionesModule,
    ReportesModule,
    UsuariosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Toda la API exige token salvo lo marcado con @Publico(), y respeta los
    // roles declarados con @Roles(). Asi ningun endpoint queda expuesto por
    // olvido de un decorador.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
