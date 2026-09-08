import { Module } from '@nestjs/common';
import { ObservacionesController } from './observaciones.controller.js';
import { ObservacionesService } from './observaciones.service.js';

@Module({
  controllers: [ObservacionesController],
  providers: [ObservacionesService],
  exports: [ObservacionesService],
})
export class ObservacionesModule {}
