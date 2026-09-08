import { Module } from '@nestjs/common';
import { RiesgoModule } from '../riesgo/riesgo.module.js';
import { CatalogosService } from './catalogos.service.js';
import {
  CatalogosController,
  EstudiantesController,
} from './estudiantes.controller.js';

@Module({
  imports: [RiesgoModule],
  controllers: [EstudiantesController, CatalogosController],
  providers: [CatalogosService],
})
export class EstudiantesModule {}
