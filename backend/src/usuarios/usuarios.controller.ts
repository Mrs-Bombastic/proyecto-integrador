import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../auth/decoradores.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import {
  ActualizarUsuarioDto,
  CrearUsuarioDto,
  RestablecerPasswordDto,
} from './dto/usuario.dto.js';
import { UsuariosService } from './usuarios.service.js';

@ApiTags('Usuarios y roles')
@ApiBearerAuth()
@Roles('ADMINISTRADOR')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Caso de uso - Gestionar usuarios: listado' })
  @ApiQuery({ name: 'rol', required: false })
  @ApiQuery({ name: 'busqueda', required: false })
  @ApiQuery({ name: 'activo', required: false, enum: ['true', 'false'] })
  listar(
    @Query('rol') rol?: string,
    @Query('busqueda') busqueda?: string,
    @Query('activo') activo?: string,
  ) {
    return this.usuarios.listar({ rol, busqueda, activo });
  }

  @Get('roles')
  @ApiOperation({ summary: 'Caso de uso - Gestionar roles: catálogo y permisos' })
  roles() {
    return this.usuarios.roles();
  }

  @Get('auditoria')
  @ApiOperation({ summary: 'Registro de acciones sensibles del sistema' })
  auditoria(@Query('limite') limite?: string) {
    return this.usuarios.auditoria(limite ? Number(limite) : 100);
  }

  @Post()
  @ApiOperation({ summary: 'Crea una cuenta de coordinador o administrador' })
  crear(
    @Body() dto: CrearUsuarioDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.usuarios.crear(dto, usuario);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cambia datos, rol o estado de una cuenta' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.usuarios.actualizar(id, dto, usuario);
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Restablece la contraseña y levanta el bloqueo' })
  restablecer(
    @Param('id') id: string,
    @Body() dto: RestablecerPasswordDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.usuarios.restablecerPassword(id, dto, usuario);
  }
}
