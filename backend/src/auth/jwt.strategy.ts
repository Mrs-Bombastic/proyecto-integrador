import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CargaJwt, Rol, UsuarioAutenticado } from './tipos.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // El mismo origen que usa AuthModule para firmar: si ambos no leen la
      // configuracion por la misma via, los tokens emitidos no se validan.
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'secreto-de-desarrollo',
    });
  }

  /**
   * Se ejecuta en cada peticion autenticada. Consultamos el usuario en lugar
   * de confiar solo en el token para que una cuenta desactivada pierda acceso
   * de inmediato, sin esperar a que expire el JWT.
   */
  async validate(carga: CargaJwt): Promise<UsuarioAutenticado> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: carga.sub },
      include: { rol: true },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Sesion invalida o cuenta desactivada');
    }

    return {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol.nombre as Rol,
      perfilId: carga.perfilId,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
    };
  }
}
