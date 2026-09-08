import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import type {
  ActualizarUsuarioDto,
  CrearUsuarioDto,
  RestablecerPasswordDto,
} from './dto/usuario.dto.js';

/** Campos que se devuelven de un usuario. Nunca incluyen el hash. */
const CAMPOS_PUBLICOS = {
  id: true,
  nombres: true,
  apellidos: true,
  email: true,
  activo: true,
  ultimoAcceso: true,
  bloqueadoHasta: true,
  creadoEn: true,
  rol: { select: { id: true, nombre: true, descripcion: true } },
  estudiante: { select: { id: true, codigoEstudiante: true } },
  docente: { select: { id: true, codigoDocente: true } },
} satisfies Prisma.UsuarioSelect;

/**
 * Gestión de usuarios y roles (caso de uso del administrador).
 *
 * Toda operación queda registrada en la auditoría: crear una cuenta, cambiar
 * un rol o desactivar a alguien son acciones que la institución debe poder
 * rastrear después.
 */
@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: { rol?: string; busqueda?: string; activo?: string }) {
    const where: Prisma.UsuarioWhereInput = {};

    if (filtros.rol) where.rol = { nombre: filtros.rol.toUpperCase() };
    if (filtros.activo === 'true') where.activo = true;
    if (filtros.activo === 'false') where.activo = false;

    if (filtros.busqueda) {
      const termino = filtros.busqueda.trim();
      where.OR = [
        { nombres: { contains: termino, mode: 'insensitive' } },
        { apellidos: { contains: termino, mode: 'insensitive' } },
        { email: { contains: termino, mode: 'insensitive' } },
      ];
    }

    return this.prisma.usuario.findMany({
      where,
      select: CAMPOS_PUBLICOS,
      orderBy: [{ activo: 'desc' }, { apellidos: 'asc' }],
      take: 200,
    });
  }

  /** Roles disponibles, con cuántos usuarios tiene cada uno. */
  async roles() {
    return this.prisma.rol.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        permisos: true,
        _count: { select: { usuarios: true } },
      },
    });
  }

  async crear(dto: CrearUsuarioDto, autor: UsuarioAutenticado) {
    const email = dto.email.toLowerCase().trim();

    const existente = await this.prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const rol = await this.prisma.rol.findUnique({ where: { id: dto.rolId } });
    if (!rol) {
      throw new BadRequestException('El rol indicado no existe');
    }

    // Un usuario con rol ESTUDIANTE o DOCENTE necesita además su ficha
    // académica, que se crea desde matrículas y no desde aquí.
    if (rol.nombre === 'ESTUDIANTE' || rol.nombre === 'DOCENTE') {
      throw new BadRequestException(
        `Las cuentas de ${rol.nombre.toLowerCase()} se crean junto con su ficha académica, no desde la gestión de usuarios`,
      );
    }

    const usuario = await this.prisma.usuario.create({
      data: {
        nombres: dto.nombres.trim(),
        apellidos: dto.apellidos.trim(),
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        rolId: dto.rolId,
      },
      select: CAMPOS_PUBLICOS,
    });

    await this.auditar(autor.sub, 'USUARIO_CREADO', usuario.id, `${email} como ${rol.nombre}`);

    return usuario;
  }

  async actualizar(
    id: string,
    dto: ActualizarUsuarioDto,
    autor: UsuarioAutenticado,
  ) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      include: {
        rol: true,
        estudiante: { select: { id: true } },
        docente: { select: { id: true } },
      },
    });
    if (!usuario) throw new NotFoundException('El usuario no existe');

    // Nadie puede desactivarse ni cambiarse el rol a sí mismo: sería la forma
    // más fácil de dejar el sistema sin ningún administrador.
    if (id === autor.sub && (dto.activo === false || dto.rolId !== undefined)) {
      throw new BadRequestException(
        'No puede cambiar su propio rol ni desactivar su propia cuenta',
      );
    }

    if (dto.rolId !== undefined) {
      const rol = await this.prisma.rol.findUnique({ where: { id: dto.rolId } });
      if (!rol) throw new BadRequestException('El rol indicado no existe');

      // Cambiar el rol de una cuenta con ficha académica la dejaría
      // inconsistente: el token llevaría un perfil que su rol ya no usa.
      if (usuario.estudiante || usuario.docente) {
        throw new BadRequestException(
          'No se puede cambiar el rol de una cuenta con ficha académica asociada',
        );
      }

      await this.verificarQueQuedeUnAdministrador(usuario.rol.nombre, dto.rolId);
    }

    if (dto.activo === false) {
      await this.verificarQueQuedeUnAdministrador(usuario.rol.nombre, null);
    }

    const actualizado = await this.prisma.usuario.update({
      where: { id },
      data: {
        ...(dto.nombres !== undefined ? { nombres: dto.nombres.trim() } : {}),
        ...(dto.apellidos !== undefined ? { apellidos: dto.apellidos.trim() } : {}),
        ...(dto.rolId !== undefined ? { rolId: dto.rolId } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
      select: CAMPOS_PUBLICOS,
    });

    await this.auditar(
      autor.sub,
      'USUARIO_ACTUALIZADO',
      id,
      // Solo los campos realmente enviados: registrar "nombres=undefined"
      // ensucia la auditoría y esconde el cambio que sí ocurrió.
      Object.entries(dto)
        .filter(([, valor]) => valor !== undefined)
        .map(([clave, valor]) => `${clave}=${String(valor)}`)
        .join(', '),
    );

    return actualizado;
  }

  async restablecerPassword(
    id: string,
    dto: RestablecerPasswordDto,
    autor: UsuarioAutenticado,
  ) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('El usuario no existe');

    await this.prisma.usuario.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(dto.password, 10),
        // Restablecer la clave levanta también el bloqueo por intentos.
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    });

    await this.auditar(autor.sub, 'PASSWORD_RESTABLECIDA', id, usuario.email);

    return { mensaje: 'Contraseña restablecida' };
  }

  /** Registro de auditoría, para el administrador (RNF de seguridad). */
  async auditoria(limite = 100) {
    return this.prisma.auditoria.findMany({
      orderBy: { fecha: 'desc' },
      take: Math.min(limite, 500),
      include: {
        usuario: { select: { nombres: true, apellidos: true, email: true } },
      },
    });
  }

  /**
   * Impide que la última cuenta de administrador activa quede desactivada o
   * cambie de rol: sin ningún administrador nadie podría volver a configurar
   * el sistema.
   */
  private async verificarQueQuedeUnAdministrador(
    rolActual: string,
    rolNuevoId: number | null,
  ): Promise<void> {
    if (rolActual !== 'ADMINISTRADOR') return;

    if (rolNuevoId !== null) {
      const rolNuevo = await this.prisma.rol.findUnique({
        where: { id: rolNuevoId },
      });
      if (rolNuevo?.nombre === 'ADMINISTRADOR') return;
    }

    const administradores = await this.prisma.usuario.count({
      where: { activo: true, rol: { nombre: 'ADMINISTRADOR' } },
    });

    if (administradores <= 1) {
      throw new BadRequestException(
        'Debe existir al menos un administrador activo en el sistema',
      );
    }
  }

  private async auditar(
    usuarioId: string,
    accion: string,
    entidadId: string,
    detalle: string,
  ): Promise<void> {
    await this.prisma.auditoria.create({
      data: { usuarioId, accion, entidad: 'usuario', entidadId, detalle },
    });
  }
}
