import { Module } from '@nestjs/common';
import { AlertasModule } from '../alertas/alertas.module.js';
import { ObservacionesModule } from '../observaciones/observaciones.module.js';
import { RiesgoModule } from '../riesgo/riesgo.module.js';
import { ReportesController } from './reportes.controller.js';
import { ReportesService } from './reportes.service.js';

@Module({
  imports: [RiesgoModule, AlertasModule, ObservacionesModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
