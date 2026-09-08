import { Body, Controller, Get, HttpCode, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { Publico, UsuarioActual } from './decoradores.js';
import { LoginDto } from './dto/login.dto.js';
import type { UsuarioAutenticado } from './tipos.js';

@ApiTags('Autenticacion')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'RF01 - Inicia sesion y devuelve el token JWT' })
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto.email, dto.password, ip);
  }

  @Get('perfil')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Devuelve el usuario de la sesion actual' })
  perfil(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.authService.perfil(usuario.sub);
  }
}
