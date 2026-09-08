import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../auth/decoradores.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { CrearObservacionDto } from './dto/crear-observacion.dto.js';
import { ObservacionesService } from './observaciones.service.js';

@ApiTags('Observaciones')
@ApiBearerAuth()
@Controller('observaciones')
export class ObservacionesController {
  constructor(private readonly observaciones: ObservacionesService) {}

  @Post()
  @Roles('DOCENTE')
  @ApiOperation({
    summary: 'RF06 - Registra una observacion cualitativa sobre un estudiante',
  })
  crear(
    @Body() dto: CrearObservacionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.observaciones.crear(dto, usuario);
  }

  @Get('estudiante/:estudianteId')
  @Roles('DOCENTE', 'COORDINADOR', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'RF06 / RF12 - Observaciones de un estudiante' })
  listar(
    @Param('estudianteId') estudianteId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.observaciones.listarDeEstudiante(estudianteId, usuario);
  }
}
