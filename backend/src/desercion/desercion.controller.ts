import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../auth/decoradores.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { DesercionService } from './desercion.service.js';
import { CrearDesercionDto, MOTIVOS_DESERCION } from './dto/crear-desercion.dto.js';
import { ResolverDesercionDto } from './dto/resolver-desercion.dto.js';

@ApiTags('Deserción')
@ApiBearerAuth()
@Controller('desercion')
export class DesercionController {
  constructor(private readonly desercion: DesercionService) {}

  @Post()
  @Roles('ESTUDIANTE')
  @ApiOperation({
    summary:
      'RF14 - El estudiante radica su retiro y explica los motivos. Notifica a docentes y directivos',
  })
  radicar(
    @Body() dto: CrearDesercionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.desercion.radicar(dto, usuario);
  }

  @Get('mias')
  @Roles('ESTUDIANTE')
  @ApiOperation({ summary: 'RF14 - Solicitudes de retiro del propio estudiante' })
  mias(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.desercion.misSolicitudes(usuario);
  }

  @Get('motivos')
  @ApiOperation({ summary: 'Catalogo de motivos de retiro' })
  motivos() {
    return MOTIVOS_DESERCION;
  }

  @Get()
  @Roles('DOCENTE', 'COORDINADOR', 'ADMINISTRADOR')
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'motivo', required: false })
  @ApiQuery({ name: 'programaId', required: false })
  @ApiOperation({ summary: 'RF14 - Solicitudes de retiro dentro de su alcance' })
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('estado') estado?: string,
    @Query('motivo') motivo?: string,
    @Query('programaId') programaId?: string,
  ) {
    return this.desercion.listar(usuario, { estado, motivo, programaId });
  }

  @Get('resumen')
  @Roles('DOCENTE', 'COORDINADOR', 'ADMINISTRADOR')
  @ApiQuery({ name: 'programaId', required: false })
  @ApiOperation({
    summary: 'RF14 - Conteo de retiros por estado y por motivo declarado',
  })
  resumen(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('programaId') programaId?: string,
  ) {
    return this.desercion.resumen(usuario, { programaId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'RF14 - Detalle de una solicitud de retiro' })
  detalle(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.desercion.detalle(id, usuario);
  }

  @Patch(':id')
  @Roles('COORDINADOR', 'ADMINISTRADOR')
  @ApiOperation({
    summary:
      'RF14 - Atiende la solicitud: inicia revision, retiene al estudiante o confirma el retiro',
  })
  resolver(
    @Param('id') id: string,
    @Body() dto: ResolverDesercionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.desercion.resolver(id, dto, usuario);
  }
}
