import { Module } from '@nestjs/common';
import { DesercionController } from './desercion.controller.js';
import { DesercionService } from './desercion.service.js';

@Module({
  controllers: [DesercionController],
  providers: [DesercionService],
  exports: [DesercionService],
})
export class DesercionModule {}
