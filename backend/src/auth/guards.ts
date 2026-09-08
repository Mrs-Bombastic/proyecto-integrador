import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { CLAVE_PUBLICO, CLAVE_ROLES } from './decoradores.js';
import type { Rol, UsuarioAutenticado } from './tipos.js';

/**
 * Exige un JWT valido en todas las rutas, salvo las marcadas con @Publico().
 * Se registra como guard global en AppModule.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(contexto: ExecutionContext) {
    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    return esPublico ? true : super.canActivate(contexto);
  }
}

/**
 * Verifica que el rol del usuario este entre los permitidos por @Roles().
 * Sin decorador @Roles, el endpoint queda abierto a cualquier autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<Rol[]>(
      CLAVE_ROLES,
      [contexto.getHandler(), contexto.getClass()],
    );

    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

    const usuario: UsuarioAutenticado | undefined = contexto
      .switchToHttp()
      .getRequest().user;

    if (!usuario || !rolesPermitidos.includes(usuario.rol)) {
      throw new ForbiddenException(
        'Su rol no tiene permiso para acceder a este recurso',
      );
    }

    return true;
  }
}
