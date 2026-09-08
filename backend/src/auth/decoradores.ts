import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Rol, UsuarioAutenticado } from './tipos.js';

export const CLAVE_ROLES = 'roles';

/**
 * Restringe un endpoint a los roles indicados.
 * Ejemplo: `@Roles('COORDINADOR', 'ADMINISTRADOR')`
 */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);

export const CLAVE_PUBLICO = 'esPublico';

/** Marca un endpoint como accesible sin token (por ejemplo, el login). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Inyecta el usuario autenticado en el parametro de un controlador. */
export const UsuarioActual = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): UsuarioAutenticado =>
    contexto.switchToHttp().getRequest().user,
);
