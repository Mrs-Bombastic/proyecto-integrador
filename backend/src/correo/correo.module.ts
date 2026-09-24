import { Global, Module } from '@nestjs/common';
import { CorreoService } from './correo.service.js';
import { DestinatariosService } from './destinatarios.service.js';

@Global()
@Module({
  providers: [CorreoService, DestinatariosService],
  exports: [CorreoService, DestinatariosService],
})
export class CorreoModule {}
