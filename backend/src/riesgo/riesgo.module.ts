import { Module } from '@nestjs/common';
import { RiesgoController, UmbralesController } from './riesgo.controller.js';
import { RiesgoService } from './riesgo.service.js';
import { UmbralesService } from './umbrales.service.js';

@Module({
  controllers: [RiesgoController, UmbralesController],
  providers: [RiesgoService, UmbralesService],
  exports: [RiesgoService],
})
export class RiesgoModule {}
