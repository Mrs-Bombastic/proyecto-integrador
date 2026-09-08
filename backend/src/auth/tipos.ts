/** Roles del sistema. Coinciden con los registros de la tabla `rol`. */
export const ROLES = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  COORDINADOR: 'COORDINADOR',
  DOCENTE: 'DOCENTE',
  ESTUDIANTE: 'ESTUDIANTE',
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];

/** Contenido del token JWT emitido al iniciar sesion. */
export interface CargaJwt {
  sub: string; // id del usuario
  email: string;
  rol: Rol;
  /** id de la fila `estudiante` o `docente` asociada, cuando aplica. */
  perfilId?: string;
}

/** Usuario autenticado que Nest adjunta a la peticion. */
export interface UsuarioAutenticado extends CargaJwt {
  nombres: string;
  apellidos: string;
}
