import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../auth/decoradores.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { ActualizarUmbralDto } from './dto/actualizar-umbral.dto.js';
import { RiesgoService } from './riesgo.service.js';
import { UmbralesService } from './umbrales.service.js';

@ApiTags('Riesgo academico')
@ApiBearerAuth()
@Controller('riesgo')
export class RiesgoController {
  constructor(private readonly riesgo: RiesgoService) {}

  @Get('resumen')
  @Roles('COORDINADOR', 'DOCENTE', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'RF11 - Distribucion de estudiantes por nivel de riesgo',
  })
  resumen(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('programaId') programaId?: string,
    @Query('cursoId') cursoId?: string,
  ) {
    return this.riesgo.resumen(usuario, { programaId, cursoId });
  }

  @Get('estudiante/:id')
  @ApiOperation({
    summary: 'RF10 / RF12 - Indicadores, historial y alertas de un estudiante',
  })
  detalle(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.riesgo.detalleEstudiante(id, usuario);
  }

  @Post('recalcular')
  @Roles('ADMINISTRADOR', 'COORDINADOR')
  @ApiOperation({
    summary:
      'RF05 - Recalcula el riesgo de todos los estudiantes y sincroniza alertas',
  })
  recalcularTodos() {
    return this.riesgo.recalcularTodos();
  }

  @Post('recalcular/:estudianteId')
  @Roles('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE')
  @ApiOperation({ summary: 'RF05 - Recalcula el riesgo de un estudiante' })
  recalcularUno(
    @Param('estudianteId') estudianteId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.riesgo.recalcularEstudiante(estudianteId, usuario);
  }

  @Get('escalamientos')
  @Roles('ADMINISTRADOR', 'COORDINADOR')
  @ApiOperation({
    summary: 'RF13 - Alertas altas sin gestion que deben escalarse a Bienestar',
  })
  escalamientos() {
    return this.riesgo.alertasParaEscalar();
  }

  @Post('escalamientos/despachar')
  @Roles('ADMINISTRADOR', 'COORDINADOR')
  @ApiOperation({
    summary: 'RF13 - Notifica a Bienestar Universitario las alertas sin gestion',
  })
  despacharEscalamientos() {
    return this.riesgo.escalarABienestar();
  }
}

@ApiTags('Umbrales de riesgo')
@ApiBearerAuth()
@Controller('umbrales')
export class UmbralesController {
  constructor(private readonly umbrales: UmbralesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista los umbrales configurados de la matriz de riesgo',
  })
  listar() {
    return this.umbrales.listar();
  }

  @Put(':indicador')
  @Roles('ADMINISTRADOR')
  @ApiOperation({
    summary: 'Caso de uso 5 - Modifica los umbrales sin cambiar el codigo',
  })
  actualizar(
    @Param('indicador') indicador: string,
    @Body() dto: ActualizarUmbralDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.umbrales.actualizar(indicador.toUpperCase(), dto, usuario.sub);
  }
}
