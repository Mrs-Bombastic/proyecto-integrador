import { Module } from '@nestjs/common';
import {
  AlertasController,
  NotificacionesController,
} from './alertas.controller.js';
import { AlertasService } from './alertas.service.js';

@Module({
  controllers: [AlertasController, NotificacionesController],
  providers: [AlertasService],
  exports: [AlertasService],
})
export class AlertasModule {}
