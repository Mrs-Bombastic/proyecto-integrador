import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../auth/decoradores.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { RiesgoService } from '../riesgo/riesgo.service.js';
import { CatalogosService } from './catalogos.service.js';

@ApiTags('Estudiantes')
@ApiBearerAuth()
@Controller('estudiantes')
export class EstudiantesController {
  constructor(private readonly riesgo: RiesgoService) {}

  @Get()
  @Roles('COORDINADOR', 'DOCENTE', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'RF08 / RF11 - Listado de estudiantes con su nivel de riesgo',
  })
  @ApiQuery({ name: 'programaId', required: false })
  @ApiQuery({ name: 'cursoId', required: false })
  @ApiQuery({
    name: 'nivelRiesgo',
    required: false,
    enum: ['NORMAL', 'MEDIO', 'ALTO'],
  })
  @ApiQuery({
    name: 'busqueda',
    required: false,
    description: 'Nombre o codigo',
  })
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('programaId') programaId?: string,
    @Query('cursoId') cursoId?: string,
    @Query('nivelRiesgo') nivelRiesgo?: string,
    @Query('busqueda') busqueda?: string,
    @Query('cohorte') cohorte?: string,
    @Query('periodo') periodo?: string,
  ) {
    return this.riesgo.listarEstudiantes(usuario, {
      programaId,
      cursoId,
      nivelRiesgo,
      busqueda,
      cohorte,
      periodo,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'RF10 / RF12 - Detalle academico, historial y alertas del estudiante',
  })
  detalle(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.riesgo.detalleEstudiante(id, usuario);
  }
}

@ApiTags('Catalogos')
@ApiBearerAuth()
@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get('programas')
  @ApiOperation({
    summary: 'Programas visibles para el usuario, para los filtros',
  })
  programas(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.catalogos.programas(usuario);
  }

  @Get('cohortes')
  @ApiOperation({ summary: 'RF08 - Cohortes con estudiantes, para el filtro' })
  @ApiQuery({ name: 'programaId', required: false })
  cohortes(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('programaId') programaId?: string,
  ) {
    return this.catalogos.cohortes(usuario, programaId);
  }

  @Get('periodos')
  @ApiOperation({ summary: 'RF08 - Periodos académicos registrados' })
  periodos() {
    return this.catalogos.periodos();
  }

  @Get('cursos')
  @ApiOperation({
    summary: 'Cursos visibles para el usuario, para los filtros',
  })
  @ApiQuery({ name: 'programaId', required: false })
  cursos(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('programaId') programaId?: string,
  ) {
    return this.catalogos.cursos(usuario, programaId);
  }
}
