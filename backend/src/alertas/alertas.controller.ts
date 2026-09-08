import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../auth/decoradores.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { AlertasService, type FiltrosAlertas } from './alertas.service.js';
import { RegistrarSeguimientoDto } from './dto/registrar-seguimiento.dto.js';

@ApiTags('Alertas')
@ApiBearerAuth()
@Controller('alertas')
export class AlertasController {
  constructor(private readonly alertas: AlertasService) {}

  @Get()
  @Roles('COORDINADOR', 'DOCENTE', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Caso de uso 2 - Lista las alertas del alcance del usuario' })
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() filtros: FiltrosAlertas,
  ) {
    return this.alertas.listar(usuario, filtros);
  }

  @Get('resumen')
  @Roles('COORDINADOR', 'DOCENTE', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Contadores de alertas por estado' })
  resumen(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() filtros: FiltrosAlertas,
  ) {
    return this.alertas.resumen(usuario, filtros);
  }

  @Get(':id')
  @Roles('COORDINADOR', 'DOCENTE', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Detalle de una alerta con su historial de seguimiento' })
  detalle(@Param('id') id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.alertas.detalle(id, usuario);
  }

  @Post(':id/seguimiento')
  @Roles('COORDINADOR', 'DOCENTE', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'Caso de uso 2 - Registra una accion de acompanamiento y cambia el estado',
  })
  registrarSeguimiento(
    @Param('id') id: string,
    @Body() dto: RegistrarSeguimientoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.alertas.registrarSeguimiento(id, dto, usuario);
  }
}

@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly alertas: AlertasService) {}

  @Get()
  @ApiOperation({ summary: 'RF09 - Notificaciones en plataforma del usuario en sesion' })
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('noLeidas') noLeidas?: string,
  ) {
    return this.alertas.notificaciones(usuario, noLeidas === 'true');
  }

  @Patch(':id/leida')
  @ApiOperation({ summary: 'Marca una notificacion como leida' })
  marcarLeida(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.alertas.marcarNotificacionLeida(id, usuario);
  }
}
