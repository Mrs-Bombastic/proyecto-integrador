import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CargaJwt, Rol } from './tipos.js';

/**
 * Autenticacion con JWT y control de intentos fallidos.
 *
 * Implementa RF01 y los requisitos de seguridad ampliados: bloqueo temporal
 * de la cuenta tras N intentos fallidos y registro en la tabla de auditoria.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxIntentos = Number(process.env.MAX_INTENTOS_FALLIDOS ?? 5);
  private readonly minutosBloqueo = Number(process.env.MINUTOS_BLOQUEO ?? 15);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string, ip?: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { rol: true, estudiante: true, docente: true },
    });

    // Mensaje unico para credenciales invalidas: no revelamos si el correo
    // existe o no (evita enumeracion de usuarios).
    const credencialesInvalidas = new UnauthorizedException(
      'Correo o contrasena incorrectos',
    );

    if (!usuario || !usuario.activo) {
      throw credencialesInvalidas;
    }

    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      const minutos = Math.ceil(
        (usuario.bloqueadoHasta.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Cuenta bloqueada temporalmente. Intente de nuevo en ${minutos} minuto(s).`,
      );
    }

    const coincide = await bcrypt.compare(password, usuario.passwordHash);

    if (!coincide) {
      await this.registrarIntentoFallido(usuario.id, usuario.intentosFallidos);
      await this.auditar(usuario.id, 'LOGIN_FALLIDO', ip);
      throw credencialesInvalidas;
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        intentosFallidos: 0,
        bloqueadoHasta: null,
        ultimoAcceso: new Date(),
      },
    });
    await this.auditar(usuario.id, 'LOGIN_EXITOSO', ip);

    const carga: CargaJwt = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol.nombre as Rol,
      perfilId: usuario.estudiante?.id ?? usuario.docente?.id,
    };

    return {
      accessToken: await this.jwt.signAsync(carga),
      usuario: {
        id: usuario.id,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        email: usuario.email,
        rol: usuario.rol.nombre,
        permisos: usuario.rol.permisos,
        perfilId: carga.perfilId,
      },
    };
  }

  /** Datos del usuario del token, para que el frontend rehidrate la sesion. */
  async perfil(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { rol: true, estudiante: true, docente: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Sesion invalida');
    }

    return {
      id: usuario.id,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      email: usuario.email,
      rol: usuario.rol.nombre,
      permisos: usuario.rol.permisos,
      perfilId: usuario.estudiante?.id ?? usuario.docente?.id,
      ultimoAcceso: usuario.ultimoAcceso,
    };
  }

  private async registrarIntentoFallido(
    usuarioId: string,
    intentosPrevios: number,
  ): Promise<void> {
    const intentos = intentosPrevios + 1;
    const debeBloquear = intentos >= this.maxIntentos;

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        intentosFallidos: debeBloquear ? 0 : intentos,
        bloqueadoHasta: debeBloquear
          ? new Date(Date.now() + this.minutosBloqueo * 60000)
          : null,
      },
    });

    if (debeBloquear) {
      this.logger.warn(`Usuario ${usuarioId} bloqueado por intentos fallidos`);
    }
  }

  private async auditar(
    usuarioId: string,
    accion: string,
    ip?: string,
  ): Promise<void> {
    await this.prisma.auditoria.create({
      data: { usuarioId, accion, entidad: 'usuario', entidadId: usuarioId, ip },
    });
  }
}
